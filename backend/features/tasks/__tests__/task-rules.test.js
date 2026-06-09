/**
 * task-rules.test.js — Unit tests for task business logic
 * 
 * Per claude.md §9.1: Domain tests require 95% coverage
 * Per claude.md §9.6: Domain tests have no mocks (pure inputs → outputs)
 */

import {
  isTaskVisible,
  shouldTaskExpire,
  shouldSendNotification,
  calculateTaskPriority,
  validateTaskCompletion,
  getTaskTitle,
  getTaskIcon,
  shouldTriggerReminder,
  calculateSnoozeExpiry,
  isDismissedToday,
  isSnoozedNow,
  isWithinTaskWindow,
  MAX_DAILY_REMINDERS,
  VALID_SNOOZE_MINUTES
} from '../domain/task-rules.js';

describe('task-rules', () => {
  describe('isTaskVisible', () => {
    it('should return true for pending task in current time window', () => {
      const task = {
        task_date: '2026-06-04',
        status: 'pending',
        window_start: '03:00:00',
        window_end: '07:30:00'
      };
      const currentDateTime = new Date('2026-06-04T04:00:00');
      
      expect(isTaskVisible(task, currentDateTime)).toBe(true);
    });
    
    it('should return false for task before window start', () => {
      const task = {
        task_date: '2026-06-04',
        status: 'pending',
        window_start: '03:00:00',
        window_end: '07:30:00'
      };
      const currentDateTime = new Date('2026-06-04T02:00:00');
      
      expect(isTaskVisible(task, currentDateTime)).toBe(false);
    });
    
    it('should return false for completed task', () => {
      const task = {
        task_date: '2026-06-04',
        status: 'completed',
        window_start: '03:00:00',
        window_end: '07:30:00'
      };
      const currentDateTime = new Date('2026-06-04T04:00:00');
      
      expect(isTaskVisible(task, currentDateTime)).toBe(false);
    });
    
    it('should return false for task from different day', () => {
      const task = {
        task_date: '2026-06-03',
        status: 'pending',
        window_start: '03:00:00',
        window_end: '07:30:00'
      };
      const currentDateTime = new Date('2026-06-04T04:00:00');
      
      expect(isTaskVisible(task, currentDateTime)).toBe(false);
    });
  });
  
  describe('shouldTaskExpire', () => {
    it('should return true for pending task after midnight', () => {
      const task = {
        task_date: '2026-06-03T00:00:00',
        status: 'pending'
      };
      const currentDateTime = new Date('2026-06-04T00:01:00');
      
      expect(shouldTaskExpire(task, currentDateTime)).toBe(true);
    });
    
    it('should return false for task on same day', () => {
      const task = {
        task_date: '2026-06-04T00:00:00',
        status: 'pending'
      };
      const currentDateTime = new Date('2026-06-04T23:00:00');
      
      expect(shouldTaskExpire(task, currentDateTime)).toBe(false);
    });
    
    it('should return false for already completed task', () => {
      const task = {
        task_date: '2026-06-03T00:00:00',
        status: 'completed'
      };
      const currentDateTime = new Date('2026-06-04T00:01:00');
      
      expect(shouldTaskExpire(task, currentDateTime)).toBe(false);
    });
  });
  
  describe('validateTaskCompletion', () => {
    it('should validate weight completion data', () => {
      const result = validateTaskCompletion('weight', { weight: 75 });
      expect(result.valid).toBe(true);
    });
    
    it('should reject weight without value', () => {
      const result = validateTaskCompletion('weight', {});
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Weight value is required');
    });
    
    it('should reject negative weight', () => {
      const result = validateTaskCompletion('weight', { weight: -5 });
      expect(result.valid).toBe(false);
    });
    
    it('should validate food completion data', () => {
      const result = validateTaskCompletion('breakfast', {
        foodData: { items: ['idli', 'coffee'] }
      });
      expect(result.valid).toBe(true);
    });
    
    it('should validate education completion data', () => {
      const result = validateTaskCompletion('education', {
        activity: 'Read wellness book'
      });
      expect(result.valid).toBe(true);
    });
  });
  
  describe('calculateTaskPriority', () => {
    it('should return high priority for weight task', () => {
      const priority = calculateTaskPriority('weight', new Date(), '07:30:00');
      expect(priority).toBe('high');
    });
    
    it('should return high priority when less than 30 minutes remaining', () => {
      const currentTime = new Date('2026-06-04T07:00:00');
      const priority = calculateTaskPriority('breakfast', currentTime, '07:20:00');
      expect(priority).toBe('high');
    });
    
    it('should return medium priority when 30-120 minutes remaining', () => {
      const currentTime = new Date('2026-06-04T06:00:00');
      const priority = calculateTaskPriority('breakfast', currentTime, '07:30:00');
      expect(priority).toBe('medium');
    });
    
    it('should return low priority when plenty of time remaining', () => {
      const currentTime = new Date('2026-06-04T05:30:00');
      const priority = calculateTaskPriority('breakfast', currentTime, '08:30:00');
      expect(priority).toBe('low');
    });
  });
  
  describe('getTaskTitle', () => {
    it('should return correct title for weight', () => {
      expect(getTaskTitle('weight')).toBe('Log Morning Weight');
    });
    
    it('should return correct title for meals', () => {
      expect(getTaskTitle('breakfast')).toBe('Log Breakfast');
      expect(getTaskTitle('lunch')).toBe('Log Lunch');
      expect(getTaskTitle('dinner')).toBe('Log Dinner');
    });
    
    it('should return default for unknown type', () => {
      expect(getTaskTitle('unknown')).toBe('Complete Task');
    });
  });
  
  describe('getTaskIcon', () => {
    it('should return correct icon for each task type', () => {
      expect(getTaskIcon('weight')).toBe('⚖️');
      expect(getTaskIcon('breakfast')).toBe('🍳');
      expect(getTaskIcon('lunch')).toBe('🍽️');
      expect(getTaskIcon('dinner')).toBe('🌙');
      expect(getTaskIcon('education')).toBe('📚');
      expect(getTaskIcon('water')).toBe('💧');
    });
  });

  // ─── Reminder helpers ─────────────────────────────────────────────────────

  describe('shouldTriggerReminder', () => {
    const BASE_NOW = new Date('2026-06-08T08:00:00');

    it('returns true for pending task with no snooze or dismissal', () => {
      const task = {
        status: 'pending',
        reminder_dismissed_today: false,
        reminder_count: 0,
        snoozed_until: null
      };
      expect(shouldTriggerReminder(task, BASE_NOW)).toBe(true);
    });

    it('returns false when task is not pending', () => {
      const task = { status: 'completed', reminder_dismissed_today: false, reminder_count: 0, snoozed_until: null };
      expect(shouldTriggerReminder(task, BASE_NOW)).toBe(false);
    });

    it('returns false when reminders are dismissed today', () => {
      const task = { status: 'pending', reminder_dismissed_today: true, reminder_count: 0, snoozed_until: null };
      expect(shouldTriggerReminder(task, BASE_NOW)).toBe(false);
    });

    it(`returns false when reminder_count >= ${MAX_DAILY_REMINDERS}`, () => {
      const task = { status: 'pending', reminder_dismissed_today: false, reminder_count: MAX_DAILY_REMINDERS, snoozed_until: null };
      expect(shouldTriggerReminder(task, BASE_NOW)).toBe(false);
    });

    it('returns false while still within an active snooze window', () => {
      const futureSnooze = new Date(BASE_NOW.getTime() + 15 * 60 * 1000).toISOString();
      const task = { status: 'pending', reminder_dismissed_today: false, reminder_count: 1, snoozed_until: futureSnooze };
      expect(shouldTriggerReminder(task, BASE_NOW)).toBe(false);
    });

    it('returns true once snooze window has expired', () => {
      const pastSnooze = new Date(BASE_NOW.getTime() - 1 * 60 * 1000).toISOString();
      const task = { status: 'pending', reminder_dismissed_today: false, reminder_count: 1, snoozed_until: pastSnooze };
      expect(shouldTriggerReminder(task, BASE_NOW)).toBe(true);
    });

    it('handles missing reminder_count (defaults to 0)', () => {
      const task = { status: 'pending', reminder_dismissed_today: false, snoozed_until: null };
      expect(shouldTriggerReminder(task, BASE_NOW)).toBe(true);
    });
  });

  describe('calculateSnoozeExpiry', () => {
    const NOW = new Date('2026-06-08T08:00:00');

    it.each(VALID_SNOOZE_MINUTES)('returns correct expiry for %d minutes', (mins) => {
      const expiry = calculateSnoozeExpiry(mins, NOW);
      const expectedMs = NOW.getTime() + mins * 60 * 1000;
      expect(expiry.getTime()).toBe(expectedMs);
    });

    it('throws for an invalid snooze duration', () => {
      expect(() => calculateSnoozeExpiry(45, NOW)).toThrow('Invalid snooze duration');
    });

    it('throws for zero minutes', () => {
      expect(() => calculateSnoozeExpiry(0, NOW)).toThrow();
    });
  });

  describe('isDismissedToday', () => {
    it('returns true when reminder_dismissed_today is true', () => {
      expect(isDismissedToday({ reminder_dismissed_today: true })).toBe(true);
    });

    it('returns false when reminder_dismissed_today is false', () => {
      expect(isDismissedToday({ reminder_dismissed_today: false })).toBe(false);
    });

    it('returns false when field is absent (falsy)', () => {
      expect(isDismissedToday({})).toBe(false);
    });
  });

  describe('isSnoozedNow', () => {
    const NOW = new Date('2026-06-08T08:00:00');

    it('returns true when snoozed_until is in the future', () => {
      const futureTs = new Date(NOW.getTime() + 10 * 60 * 1000).toISOString();
      expect(isSnoozedNow({ snoozed_until: futureTs }, NOW)).toBe(true);
    });

    it('returns false when snoozed_until is in the past', () => {
      const pastTs = new Date(NOW.getTime() - 1 * 60 * 1000).toISOString();
      expect(isSnoozedNow({ snoozed_until: pastTs }, NOW)).toBe(false);
    });

    it('returns false when snoozed_until is null', () => {
      expect(isSnoozedNow({ snoozed_until: null }, NOW)).toBe(false);
    });

    it('returns false when snoozed_until is undefined', () => {
      expect(isSnoozedNow({}, NOW)).toBe(false);
    });

    it('returns false exactly at the expiry moment (boundary)', () => {
      const exactTs = NOW.toISOString();
      expect(isSnoozedNow({ snoozed_until: exactTs }, NOW)).toBe(false);
    });
  });

  // ─── Window boundary ──────────────────────────────────────────────────────

  describe('isWithinTaskWindow', () => {
    // Weight window from screenshot: 03:00 – 07:30
    const WEIGHT_TASK = { window_start: '03:00:00', window_end: '07:30:00' };
    // Lunch window from screenshot: 12:00 – 16:00
    const LUNCH_TASK  = { window_start: '12:00:00', window_end: '16:00:00' };

    it('returns true when current time is inside the window', () => {
      expect(isWithinTaskWindow(WEIGHT_TASK, new Date('2026-06-09T05:00:00'))).toBe(true);
    });

    it('returns true at the exact window start (boundary)', () => {
      expect(isWithinTaskWindow(WEIGHT_TASK, new Date('2026-06-09T03:00:00'))).toBe(true);
    });

    it('returns true at the exact window end (boundary)', () => {
      expect(isWithinTaskWindow(WEIGHT_TASK, new Date('2026-06-09T07:30:00'))).toBe(true);
    });

    it('returns false before the window opens', () => {
      expect(isWithinTaskWindow(WEIGHT_TASK, new Date('2026-06-09T02:59:00'))).toBe(false);
    });

    it('returns false after the window closes', () => {
      expect(isWithinTaskWindow(WEIGHT_TASK, new Date('2026-06-09T07:31:00'))).toBe(false);
    });

    it('returns false for lunch window at breakfast time', () => {
      expect(isWithinTaskWindow(LUNCH_TASK, new Date('2026-06-09T08:00:00'))).toBe(false);
    });

    it('returns true for lunch window at 1 PM', () => {
      expect(isWithinTaskWindow(LUNCH_TASK, new Date('2026-06-09T13:00:00'))).toBe(true);
    });

    it('returns false for lunch window at 5 PM (window closed at 4 PM)', () => {
      expect(isWithinTaskWindow(LUNCH_TASK, new Date('2026-06-09T17:00:00'))).toBe(false);
    });
  });

  // ─── Personalised reminder 1-minute window (doc test) ────────────────────

  describe('isWithinTaskWindow — 1-minute precision for personalised reminders', () => {
    // Simulates the SQL logic: fire only within 2-minute window of average time
    function isInPersonalisedWindow(avgTimeStr, currentDateTime) {
      const [ah, am] = avgTimeStr.split(':').map(Number);
      const avgMs = (ah * 60 + am) * 60 * 1000;
      const curH  = currentDateTime.getHours();
      const curM  = currentDateTime.getMinutes();
      const curMs = (curH * 60 + curM) * 60 * 1000;
      return curMs >= avgMs && curMs < avgMs + 2 * 60 * 1000;
    }

    it('fires at 06:01 when average is 06:00 (weight scenario)', () => {
      expect(isInPersonalisedWindow('06:00', new Date('2026-06-09T06:01:00'))).toBe(true);
    });

    it('does NOT fire at 06:03 (outside the 2-minute window)', () => {
      expect(isInPersonalisedWindow('06:00', new Date('2026-06-09T06:03:00'))).toBe(false);
    });

    it('fires at 07:31 when average is 07:30 (education scenario)', () => {
      expect(isInPersonalisedWindow('07:30', new Date('2026-06-09T07:31:00'))).toBe(true);
    });

    it('does NOT fire at 07:33 (outside the 2-minute window)', () => {
      expect(isInPersonalisedWindow('07:30', new Date('2026-06-09T07:33:00'))).toBe(false);
    });

    it('fires exactly AT average time (06:00 → 06:00)', () => {
      expect(isInPersonalisedWindow('06:00', new Date('2026-06-09T06:00:00'))).toBe(true);
    });
  });
});
