/**
 * Unit tests for backend/features/water/domain/reminder.rules.js
 *
 * All functions are pure → no mocks needed.
 * Coverage target: ≥ 95% lines / ≥ 90% branches (claude.md §9.1).
 */

import {
  WATER_ML_PER_KG,
  DEFAULT_WATER_ML,
  REMINDER_SLOT_WINDOW_MINUTES,
  timeStrToMinutes,
  calculateWaterTarget,
  calculateWaterReminderSchedule,
  isWaterReminderSlotNow,
  shouldSendWaterReminder,
  buildWaterReminderBody,
} from '../domain/reminder.rules.js';

// ─── timeStrToMinutes ─────────────────────────────────────────────────────────

describe('timeStrToMinutes', () => {
  it('converts HH:MM correctly', () => {
    expect(timeStrToMinutes('08:00')).toBe(480);
    expect(timeStrToMinutes('17:30')).toBe(1050);
    expect(timeStrToMinutes('00:00')).toBe(0);
    expect(timeStrToMinutes('23:59')).toBe(1439);
  });

  it('ignores seconds (HH:MM:SS)', () => {
    expect(timeStrToMinutes('08:00:00')).toBe(480);
    expect(timeStrToMinutes('17:00:00')).toBe(1020);
  });

  it.each([null, undefined, '', 42, true])('returns 0 for invalid input %p', (v) => {
    expect(timeStrToMinutes(v)).toBe(0);
  });

  it('returns 0 for non-numeric segments', () => {
    expect(timeStrToMinutes('xx:yy')).toBe(0);
  });
});

// ─── calculateWaterTarget ────────────────────────────────────────────────────

describe('calculateWaterTarget', () => {
  it('60 kg → 3,000 ml, 3 reminders', () => {
    const result = calculateWaterTarget(60);
    expect(result).toEqual({
      requiredMl:    3000,
      reminderCount: 3,
      weightKg:      60,
      isDefault:     false,
    });
  });

  it('80 kg → 4,000 ml, 4 reminders', () => {
    const result = calculateWaterTarget(80);
    expect(result).toEqual({
      requiredMl:    4000,
      reminderCount: 4,
      weightKg:      80,
      isDefault:     false,
    });
  });

  it('98 kg → 4,900 ml, 5 reminders', () => {
    const result = calculateWaterTarget(98);
    expect(result).toEqual({
      requiredMl:    4900,
      reminderCount: 5,
      weightKg:      98,
      isDefault:     false,
    });
  });

  it('uses WATER_ML_PER_KG constant (50 ml/kg)', () => {
    const { requiredMl } = calculateWaterTarget(70);
    expect(requiredMl).toBe(70 * WATER_ML_PER_KG);
  });

  it('parses string weight', () => {
    expect(calculateWaterTarget('75').requiredMl).toBe(3750);
  });

  it.each([null, undefined, '', 'abc', 0, -5, NaN])(
    'falls back to DEFAULT_WATER_ML for invalid weight %p',
    (w) => {
      const r = calculateWaterTarget(w);
      expect(r.requiredMl).toBe(DEFAULT_WATER_ML);
      expect(r.weightKg).toBeNull();
      expect(r.isDefault).toBe(true);
      expect(r.reminderCount).toBe(Math.round(DEFAULT_WATER_ML / 1000));
    },
  );
});

// ─── calculateWaterReminderSchedule ──────────────────────────────────────────

describe('calculateWaterReminderSchedule', () => {
  // 9-hour window: 08:00 → 17:00 (540 min) — matches user's examples exactly
  const START = '08:00';
  const END   = '17:00';

  it('60 kg — 3 reminders, 180 min apart', () => {
    const s = calculateWaterReminderSchedule(60, START, END);
    expect(s.requiredMl).toBe(3000);
    expect(s.reminderCount).toBe(3);
    expect(s.intervalMin).toBe(180);           // floor(540 / 3)
    expect(s.scheduledMinutes).toEqual([
      480,        // 08:00
      480 + 180,  // 11:00
      480 + 360,  // 14:00
    ]);
  });

  it('80 kg — 4 reminders, 135 min apart', () => {
    const s = calculateWaterReminderSchedule(80, START, END);
    expect(s.requiredMl).toBe(4000);
    expect(s.reminderCount).toBe(4);
    expect(s.intervalMin).toBe(135);           // floor(540 / 4)
    expect(s.scheduledMinutes).toHaveLength(4);
    expect(s.scheduledMinutes[0]).toBe(480);   // 08:00
  });

  it('98 kg — 5 reminders, 108 min apart', () => {
    const s = calculateWaterReminderSchedule(98, START, END);
    expect(s.requiredMl).toBe(4900);
    expect(s.reminderCount).toBe(5);
    expect(s.intervalMin).toBe(108);           // floor(540 / 5)
    expect(s.scheduledMinutes).toHaveLength(5);
  });

  it('returns windowStartMin and windowEndMin', () => {
    const s = calculateWaterReminderSchedule(60, '07:00', '22:00');
    expect(s.windowStartMin).toBe(420);
    expect(s.windowEndMin).toBe(1320);
  });

  it('handles HH:MM:SS strings from DB', () => {
    const s = calculateWaterReminderSchedule(60, '08:00:00', '17:00:00');
    expect(s.scheduledMinutes[0]).toBe(480);
  });

  it('falls back to defaults when window strings are missing', () => {
    const s = calculateWaterReminderSchedule(60, null, null);
    // default 07:00 – 22:00 = 900 min / 3 = 300
    expect(s.intervalMin).toBe(300);
    expect(s.scheduledMinutes[0]).toBe(420); // 07:00
  });

  it('guards against inverted / zero window (min 60 min)', () => {
    const s = calculateWaterReminderSchedule(60, '10:00', '10:00');
    expect(s.intervalMin).toBeGreaterThan(0);
  });
});

// ─── isWaterReminderSlotNow ───────────────────────────────────────────────────

describe('isWaterReminderSlotNow', () => {
  const slots = [480, 660, 840]; // 08:00, 11:00, 14:00

  it('returns true at exact slot start (sentCount=0)', () => {
    expect(isWaterReminderSlotNow(slots, 0, 480)).toBe(true);
  });

  it('returns true within the slot window', () => {
    expect(isWaterReminderSlotNow(slots, 0, 481)).toBe(true);
  });

  it('returns false at slot boundary + window', () => {
    // slot window is [480, 482) — 482 should be false
    expect(isWaterReminderSlotNow(slots, 0, 480 + REMINDER_SLOT_WINDOW_MINUTES)).toBe(false);
  });

  it('returns false before the slot', () => {
    expect(isWaterReminderSlotNow(slots, 0, 479)).toBe(false);
  });

  it('returns true for second slot when sentCount=1', () => {
    expect(isWaterReminderSlotNow(slots, 1, 660)).toBe(true);
  });

  it('returns false when sentCount equals scheduledMinutes length', () => {
    expect(isWaterReminderSlotNow(slots, 3, 840)).toBe(false);
  });

  it('returns false when sentCount exceeds length', () => {
    expect(isWaterReminderSlotNow(slots, 99, 840)).toBe(false);
  });
});

// ─── shouldSendWaterReminder ─────────────────────────────────────────────────

describe('shouldSendWaterReminder', () => {
  // 60 kg, 08:00–17:00 window — slots: 480, 660, 840
  const schedule = calculateWaterReminderSchedule(60, '08:00', '17:00');

  it('returns true when on the first slot, no water logged yet', () => {
    expect(shouldSendWaterReminder({
      schedule,
      sentCount:      0,
      totalMl:        0,
      currentMinutes: 480,
    })).toBe(true);
  });

  it('returns false when daily goal is already met', () => {
    expect(shouldSendWaterReminder({
      schedule,
      sentCount:      0,
      totalMl:        schedule.requiredMl,
      currentMinutes: 480,
    })).toBe(false);
  });

  it('returns false when goal exceeded', () => {
    expect(shouldSendWaterReminder({
      schedule,
      sentCount:      0,
      totalMl:        schedule.requiredMl + 500,
      currentMinutes: 480,
    })).toBe(false);
  });

  it('returns false when all reminders sent', () => {
    expect(shouldSendWaterReminder({
      schedule,
      sentCount:      schedule.reminderCount, // 3
      totalMl:        0,
      currentMinutes: 480,
    })).toBe(false);
  });

  it('returns false outside any slot window', () => {
    expect(shouldSendWaterReminder({
      schedule,
      sentCount:      0,
      totalMl:        0,
      currentMinutes: 490, // not in slot [480, 482)
    })).toBe(false);
  });

  it('respects partial progress — allows reminder when totalMl < required', () => {
    expect(shouldSendWaterReminder({
      schedule,
      sentCount:      1,
      totalMl:        800,   // drank some but not enough
      currentMinutes: 660,   // second slot
    })).toBe(true);
  });

  it('returns true for 80 kg user at second slot', () => {
    const s80 = calculateWaterReminderSchedule(80, '08:00', '17:00');
    // slots: 480, 615, 750, 885
    expect(shouldSendWaterReminder({
      schedule:       s80,
      sentCount:      1,
      totalMl:        1000,
      currentMinutes: 615, // slot 1 = 480 + 135
    })).toBe(true);
  });

  it('returns true for 98 kg user at third slot', () => {
    const s98 = calculateWaterReminderSchedule(98, '08:00', '17:00');
    const thirdSlot = s98.scheduledMinutes[2];
    expect(shouldSendWaterReminder({
      schedule:       s98,
      sentCount:      2,
      totalMl:        2000,
      currentMinutes: thirdSlot,
    })).toBe(true);
  });
});

// ─── buildWaterReminderBody ───────────────────────────────────────────────────

describe('buildWaterReminderBody', () => {
  it('formats correctly when no water logged', () => {
    const body = buildWaterReminderBody(0, 3000, 1, 3);
    expect(body).toBe('3.0L left to reach your 3.0L goal. Reminder 1 of 3.');
  });

  it('shows remaining correctly when some water logged', () => {
    const body = buildWaterReminderBody(1000, 3000, 2, 3);
    expect(body).toBe('2.0L left to reach your 3.0L goal. Reminder 2 of 3.');
  });

  it('shows 0.0L remaining when goal is exactly met', () => {
    const body = buildWaterReminderBody(3000, 3000, 3, 3);
    expect(body).toBe('0.0L left to reach your 3.0L goal. Reminder 3 of 3.');
  });

  it('clamps negative remaining to 0', () => {
    const body = buildWaterReminderBody(4000, 3000, 3, 3);
    expect(body).toBe('0.0L left to reach your 3.0L goal. Reminder 3 of 3.');
  });

  it('formats 80 kg goal (4L) correctly', () => {
    const body = buildWaterReminderBody(1500, 4000, 2, 4);
    expect(body).toBe('2.5L left to reach your 4.0L goal. Reminder 2 of 4.');
  });

  it('formats 98 kg goal (4.9L) correctly', () => {
    const body = buildWaterReminderBody(0, 4900, 1, 5);
    expect(body).toBe('4.9L left to reach your 4.9L goal. Reminder 1 of 5.');
  });
});
