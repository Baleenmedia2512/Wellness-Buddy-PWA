/**
 * water.repo.test.js — Water reminder query tests (Supabase REST path).
 *
 * Regression guard: cron water reminders must use Supabase REST (not pg pool)
 * so they work when DATABASE_URL is broken but SUPABASE_URL is valid.
 */

jest.mock('../../../utils/supabaseClient.js', () => ({
  getSupabaseClient: jest.fn(),
}));

jest.mock('../../../shared/lib/logger.js', () => ({
  info:  jest.fn(),
  warn:  jest.fn(),
  error: jest.fn(),
}));

import {
  getPendingWaterTasksForDate,
  incrementWaterTaskReminderCount,
} from '../data/water.repo.js';
import { getSupabaseClient } from '../../../utils/supabaseClient.js';

function buildChain(finalResult) {
  const chain = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    in: jest.fn(() => chain),
    not: jest.fn(() => chain),
    single: jest.fn(() => Promise.resolve(finalResult)),
    update: jest.fn(() => chain),
    then: (resolve, reject) => Promise.resolve(finalResult).then(resolve, reject),
  };
  return chain;
}

describe('water.repo Supabase reminder queries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getPendingWaterTasksForDate', () => {
    it('returns pending water tasks joined with active push tokens', async () => {
      const tasksChain = buildChain({
        data: [{
          TaskId: 10,
          UserId: '339',
          TaskDate: '2026-06-23',
          WindowStart: '08:00:00',
          WindowEnd: '21:00:00',
          ReminderCount: 0,
          ReminderDismissedToday: false,
          SnoozedUntil: null,
        }],
        error: null,
      });
      const membersChain = buildChain({
        data: [{ UserId: 339, PushToken: 'fcm-token', Status: 'Active' }],
        error: null,
      });

      getSupabaseClient.mockReturnValue({
        from: jest.fn((table) => (table === 'tasks_table' ? tasksChain : membersChain)),
      });

      const result = await getPendingWaterTasksForDate('2026-06-23');

      expect(result).toEqual([{
        task_id: 10,
        user_id: '339',
        task_date: '2026-06-23',
        window_start: '08:00:00',
        window_end: '21:00:00',
        reminder_count: 0,
        reminder_dismissed_today: false,
        snoozed_until: null,
        push_token: 'fcm-token',
      }]);
      expect(getSupabaseClient).toHaveBeenCalled();
    });

    it('throws on Supabase tasks query error (no pg release side-effect)', async () => {
      const tasksChain = buildChain({
        data: null,
        error: { message: 'REST error' },
      });
      getSupabaseClient.mockReturnValue({ from: () => tasksChain });

      await expect(getPendingWaterTasksForDate('2026-06-23')).rejects.toThrow('REST error');
    });
  });

  describe('incrementWaterTaskReminderCount', () => {
    it('reads current count and increments via Supabase update', async () => {
      const readChain = buildChain({ data: { ReminderCount: 1 }, error: null });
      const updateChain = buildChain({ data: null, error: null });
      updateChain.eq = jest.fn(() => Promise.resolve({ data: null, error: null }));

      let call = 0;
      getSupabaseClient.mockReturnValue({
        from: jest.fn(() => {
          call += 1;
          return call === 1 ? readChain : updateChain;
        }),
      });

      await incrementWaterTaskReminderCount(42);

      expect(readChain.single).toHaveBeenCalled();
      expect(updateChain.update).toHaveBeenCalledWith({ ReminderCount: 2 });
    });
  });
});
