import { validateSnoozeRequest } from '../validation/snooze-task.schema.js';

describe('validateSnoozeRequest', () => {
  it('accepts 15, 30, and 60 minute snooze', () => {
    expect(validateSnoozeRequest({ taskId: 1, snoozeMinutes: 15 }).valid).toBe(true);
    expect(validateSnoozeRequest({ taskId: 1, snoozeMinutes: 30 }).valid).toBe(true);
    expect(validateSnoozeRequest({ taskId: 1, snoozeMinutes: 60 }).valid).toBe(true);
  });

  it('rejects 5, 10, and other values', () => {
    for (const minutes of [5, 10, 45]) {
      const result = validateSnoozeRequest({ taskId: 1, snoozeMinutes: minutes });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatch(/snoozeMinutes must be one of: 15, 30, 60/);
    }
  });
});
