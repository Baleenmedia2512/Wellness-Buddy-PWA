import { validateSnoozeRequest } from '../validation/snooze-task.schema.js';

describe('validateSnoozeRequest', () => {
  it('accepts 5 and 10 minute snooze', () => {
    expect(validateSnoozeRequest({ taskId: 1, snoozeMinutes: 5 }).valid).toBe(true);
    expect(validateSnoozeRequest({ taskId: 1, snoozeMinutes: 10 }).valid).toBe(true);
  });

  it('rejects legacy 15/30/60 and other values', () => {
    for (const minutes of [15, 30, 60, 45]) {
      const result = validateSnoozeRequest({ taskId: 1, snoozeMinutes: minutes });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatch(/snoozeMinutes must be one of: 5, 10/);
    }
  });
});
