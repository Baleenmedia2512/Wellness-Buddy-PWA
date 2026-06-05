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
  getTaskIcon
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
});
