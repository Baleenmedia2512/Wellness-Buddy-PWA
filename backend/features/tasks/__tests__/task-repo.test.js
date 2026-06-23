/**
 * task-repo.test.js — Integration tests for the tasks data layer.
 *
 * Per claude.md §9.1  : data layer floor 70 % line / 60 % branch.
 * Per claude.md §9.6  : mock DB at the boundary; pure-connection mock is sufficient.
 *
 * ROOT-CAUSE REGRESSION GUARD (fix: update dbPool import for backward compat)
 * ─────────────────────────────────────────────────────────────────────────────
 * Commit 0b0bdbed changed `const dbPool = getPool` so that `await dbPool()`
 * returned the *pool wrapper* (no `.release()`) instead of a *connection*
 * (which has `.release()`).  Every `finally { client.release() }` block then
 * threw `TypeError: client.release is not a function`, propagating a 500 for
 * every tasks endpoint.
 *
 * These tests guard against a regression to that bug by asserting:
 *   1. The function resolves (does NOT throw) on the happy path.
 *   2. The function propagates DB errors correctly (catch + rethrow).
 *   3. Row-level semantics (length, first row, affectedRows) are correct.
 */

// ─── Mock modules BEFORE any imports (jest.mock is hoisted) ──────────────────
jest.mock('../../../utils/dbPool.js', () => ({
  // Returns a minimal pool-wrapper stub; getConnection() returns the mock client.
  getPool: jest.fn(),
}));

jest.mock('../../../utils/supabaseClient.js', () => ({
  getSupabaseClient: jest.fn(),
}));

jest.mock('../../../shared/lib/logger.js', () => ({
  info:  jest.fn(),
  warn:  jest.fn(),
  error: jest.fn(),
}));

// ─── Import the module under test after mocks are registered ─────────────────
import {
  getTasksByUserAndDate,
  snoozeTask,
  dismissTaskToday,
  expireOldTasks,
  createTask,
  completeTask,
  getTasksNeedingReminder,
} from '../data/task-repo.js';

import { getPool } from '../../../utils/dbPool.js';
import { getSupabaseClient } from '../../../utils/supabaseClient.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a MySQL-style [rows, fields] result as createMySQLResult would return.
 * The rows array carries .affectedRows so we can test expireOldTasks.
 */
function mysqlResult(rows = [], affectedRows = rows.length) {
  const arr = [...rows];
  arr.affectedRows = affectedRows;
  return [arr, []];
}

/** Wire up a fresh mock connection for each test. */
function setupMockConnection(mockQuery, mockRelease) {
  const conn = { query: mockQuery, release: mockRelease };
  const mockGetConnection = jest.fn().mockResolvedValue(conn);
  getPool.mockReturnValue({ getConnection: mockGetConnection });
  return conn;
}

function buildSupabaseTaskRows(rawRows) {
  return rawRows.map((row) => ({
    TaskId: row.task_id,
    UserId: row.user_id,
    TaskType: row.task_type,
    TaskDate: row.task_date,
    Status: row.status,
    Priority: row.priority ?? 'medium',
    CreatedAt: row.created_at ?? null,
    CompletedAt: row.completed_at ?? null,
    TaskData: row.task_data ?? null,
    CompletionData: row.completion_data ?? null,
    NotificationSent: row.notification_sent ?? false,
    NotificationSentAt: row.notification_sent_at ?? null,
    ReminderCount: row.reminder_count ?? 0,
    SnoozedUntil: row.snoozed_until ?? null,
    ReminderDismissedToday: row.reminder_dismissed_today ?? false,
  }));
}

function setupSupabaseForTasks(taskRows = [], windowRows = [], tasksError = null, statusFilter = null) {
  const taskResult = tasksError
    ? Promise.resolve({ data: null, error: tasksError })
    : Promise.resolve({ data: buildSupabaseTaskRows(taskRows), error: null });

  const statusEq = jest.fn().mockReturnValue(taskResult);
  const dateEq = statusFilter
    ? jest.fn().mockReturnValue({ eq: statusEq })
    : jest.fn().mockReturnValue(taskResult);
  const userEq = jest.fn().mockReturnValue({ eq: dateEq });
  const taskSelect = jest.fn().mockReturnValue({ eq: userEq });

  const windowsIs = jest.fn().mockResolvedValue({
    data: windowRows.length
      ? windowRows
      : [{ ActivityType: 'weight', WindowStartTime: '06:00:00', WindowEndTime: '07:30:00' }],
    error: null,
  });
  const windowsSelect = jest.fn().mockReturnValue({ is: windowsIs });

  getSupabaseClient.mockReturnValue({
    from: jest.fn((table) => {
      if (table === 'tasks_table') {
        return { select: taskSelect };
      }
      if (table === 'activity_time_windows_table') {
        return { select: windowsSelect };
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
  });

  return { taskSelect, userEq, dateEq, statusEq };
}

// ─── getTasksByUserAndDate ────────────────────────────────────────────────────

describe('getTasksByUserAndDate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns an array of task rows on the happy path', async () => {
    const fakeTask = {
      task_id:      1,
      user_id:      '339',
      task_type:    'weight',
      task_date:    '2026-06-09',
      status:       'pending',
      window_start: '06:00:00',
      window_end:   '07:30:00',
    };
    setupSupabaseForTasks([fakeTask]);

    const rows = await getTasksByUserAndDate('339', '2026-06-09');

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject(fakeTask);
  });

  it('returns an empty array when no tasks exist for that date', async () => {
    setupSupabaseForTasks([]);

    const rows = await getTasksByUserAndDate('339', '2026-06-09');

    expect([...rows]).toEqual([]);
  });

  it('applies status filter when supplied', async () => {
    const { statusEq } = setupSupabaseForTasks([], [], null, 'pending');

    await getTasksByUserAndDate('339', '2026-06-09', 'pending');

    expect(statusEq).toHaveBeenCalledWith('Status', 'pending');
  });

  it('propagates a DB error', async () => {
    setupSupabaseForTasks([], [], new Error('connection timeout'));

    await expect(getTasksByUserAndDate('339', '2026-06-09')).rejects.toThrow(
      'connection timeout',
    );
  });

  it('REGRESSION: resolves without pg pool connection (Supabase REST path)', async () => {
    setupSupabaseForTasks([]);

    await expect(getTasksByUserAndDate('339', '2026-06-09')).resolves.toBeDefined();
  });
});

// ─── snoozeTask ───────────────────────────────────────────────────────────────

function setupSupabaseForSnooze({ row = { ReminderCount: 0 }, updated = null, readError = null, updateError = null }) {
  const readSingle = jest.fn().mockResolvedValue(
    readError ? { data: null, error: readError } : { data: row, error: null },
  );
  const readChain = {
    eq: jest.fn(function snoozeEq() { return readChain; }),
    single: readSingle,
  };

  const updateSingle = jest.fn().mockResolvedValue(
    updateError ? { data: null, error: updateError } : { data: updated, error: null },
  );
  const updateChain = {
    eq: jest.fn(function snoozeEq() { return updateChain; }),
    select: jest.fn().mockReturnValue({ single: updateSingle }),
  };

  getSupabaseClient.mockReturnValue({
    from: jest.fn(() => ({
      select: jest.fn().mockReturnValue(readChain),
      update: jest.fn().mockReturnValue(updateChain),
    })),
  });
}

describe('snoozeTask', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the updated task row on success', async () => {
    setupSupabaseForSnooze({
      updated: { TaskId: 42, ReminderCount: 1, SnoozedUntil: '2026-06-09T07:15:00' },
    });

    const row = await snoozeTask(42, new Date('2026-06-09T07:15:00'), '339');

    expect(row).toEqual({
      task_id: 42,
      reminder_count: 1,
      snoozed_until: '2026-06-09T07:15:00',
    });
  });

  it('throws when the task is not found or not pending', async () => {
    setupSupabaseForSnooze({ readError: { message: 'not found' } });

    await expect(snoozeTask(99, new Date(), '339')).rejects.toThrow(
      'Task not found or not pending',
    );
  });
});

// ─── dismissTaskToday ─────────────────────────────────────────────────────────

function setupSupabaseForDismiss({ updated = null, updateError = null }) {
  const updateSingle = jest.fn().mockResolvedValue(
    updateError ? { data: null, error: updateError } : { data: updated, error: null },
  );
  const updateChain = {
    eq: jest.fn(function dismissEq() { return updateChain; }),
    select: jest.fn().mockReturnValue({ single: updateSingle }),
  };

  getSupabaseClient.mockReturnValue({
    from: jest.fn(() => ({ update: jest.fn().mockReturnValue(updateChain) })),
  });
}

describe('dismissTaskToday', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the updated row when task is dismissed', async () => {
    setupSupabaseForDismiss({
      updated: { TaskId: 7, ReminderDismissedToday: true },
    });

    const row = await dismissTaskToday(7, '339');

    expect(row.reminder_dismissed_today).toBe(true);
  });

  it('throws when task is not found', async () => {
    setupSupabaseForDismiss({ updateError: { message: 'not found' } });

    await expect(dismissTaskToday(99, '339')).rejects.toThrow('Task not found or not pending');
  });
});

// ─── expireOldTasks ───────────────────────────────────────────────────────────

describe('expireOldTasks', () => {
  let mockQuery;
  let mockRelease;

  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery   = jest.fn();
    mockRelease = jest.fn();
    setupMockConnection(mockQuery, mockRelease);
  });

  it('returns the count of expired tasks via affectedRows', async () => {
    mockQuery.mockResolvedValueOnce(mysqlResult([], 5));

    const count = await expireOldTasks('2026-06-09');

    expect(count).toBe(5);
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });

  it('returns 0 when no tasks needed expiring', async () => {
    mockQuery.mockResolvedValueOnce(mysqlResult([], 0));

    const count = await expireOldTasks('2026-06-09');

    expect(count).toBe(0);
  });
});

// ─── createTask ───────────────────────────────────────────────────────────────

function setupSupabaseForCreateTask({ existing = null, inserted = null, insertError = null, updated = null }) {
  const maybeSingle = jest.fn().mockResolvedValue({ data: existing, error: null });
  const findSelect = jest.fn().mockReturnValue({
    eq: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({ maybeSingle }),
      }),
    }),
  });

  const insertSingle = jest.fn().mockResolvedValue(
    insertError ? { data: null, error: insertError } : { data: inserted, error: null },
  );
  const insert = jest.fn().mockReturnValue({
    select: jest.fn().mockReturnValue({ single: insertSingle }),
  });

  const updateSingle = jest.fn().mockResolvedValue({ data: updated, error: null });
  const update = jest.fn().mockReturnValue({
    eq: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({ single: updateSingle }),
    }),
  });

  getSupabaseClient.mockReturnValue({
    from: jest.fn(() => ({ select: findSelect, insert, update })),
  });

  return { maybeSingle, insert, update };
}

describe('createTask', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the created row with snake_case aliases when insert succeeds', async () => {
    const newRow = { TaskId: 100, UserId: '339', TaskType: 'weight', Status: 'pending' };
    setupSupabaseForCreateTask({ existing: null, inserted: newRow });

    const row = await createTask({
      userId:      '339',
      taskType:    'weight',
      taskDate:    '2026-06-09',
      windowStart: '06:00:00',
      windowEnd:   '07:30:00',
    });

    expect(row).toMatchObject({
      TaskId:    100,
      task_id:   100,
      user_id:   '339',
      task_type: 'weight',
    });
  });

  it('returns null when the task already exists and is not pending', async () => {
    setupSupabaseForCreateTask({
      existing: { TaskId: 1, Status: 'completed', UserId: '339', TaskType: 'weight' },
    });

    const row = await createTask({
      userId:      '339',
      taskType:    'weight',
      taskDate:    '2026-06-09',
      windowStart: '06:00:00',
      windowEnd:   '07:30:00',
    });

    expect(row).toBeNull();
  });

  it('returns null on unique-violation insert (concurrent create)', async () => {
    setupSupabaseForCreateTask({
      existing: null,
      insertError: { code: '23505', message: 'duplicate key' },
    });

    const row = await createTask({
      userId:      '339',
      taskType:    'weight',
      taskDate:    '2026-06-09',
      windowStart: '06:00:00',
      windowEnd:   '07:30:00',
    });

    expect(row).toBeNull();
  });
});

// ─── completeTask ─────────────────────────────────────────────────────────────

function setupSupabaseForCompleteTask({ updated = null, error = null }) {
  const single = jest.fn().mockResolvedValue(
    error ? { data: null, error } : { data: updated, error: null },
  );
  const eq2 = jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue({ single }) });
  const eq1 = jest.fn().mockReturnValue({ eq: eq2 });
  const update = jest.fn().mockReturnValue({ eq: eq1 });

  getSupabaseClient.mockReturnValue({
    from: jest.fn(() => ({ update })),
  });

  return { update, single };
}

describe('completeTask', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the updated row on success', async () => {
    const updatedRow = { TaskId: 1, Status: 'completed', UserId: '339' };
    setupSupabaseForCompleteTask({ updated: updatedRow });

    const row = await completeTask(1, { weight: 70 });

    expect(row).toEqual(updatedRow);
  });

  it('throws when task is not found or already completed', async () => {
    setupSupabaseForCompleteTask({ updated: null });

    await expect(completeTask(999, { weight: 70 })).rejects.toThrow(
      'Task not found or already completed',
    );
  });
});

// ─── getTasksNeedingReminder ──────────────────────────────────────────────────

function setupSupabaseForReminders(pendingTasks = []) {
  const windowsIs = jest.fn().mockReturnValue({
    order: jest.fn().mockResolvedValue({
      data: [{
        ActivityType: 'lunch', WindowStartTime: '12:00:00', WindowEndTime: '16:00:00',
      }],
      error: null,
    }),
  });
  const windowsSelect = jest.fn().mockReturnValue({ is: windowsIs });

  const membersEq = jest.fn().mockResolvedValue({
    data: [{ UserId: 339, PushToken: 'tok_abc', Status: 'Active' }],
    error: null,
  });
  const membersSelect = jest.fn().mockReturnValue({ eq: membersEq });

  const tasksResult = { data: pendingTasks, error: null };
  const tasksChain = {
    eq: jest.fn(function tasksEq() { return tasksChain; }),
    then: (resolve, reject) => Promise.resolve(tasksResult).then(resolve, reject),
  };
  const tasksSelect = jest.fn().mockReturnValue(tasksChain);

  getSupabaseClient.mockReturnValue({
    from: jest.fn((table) => {
      if (table === 'activity_time_windows_table') return { select: windowsSelect };
      if (table === 'team_table') return { select: membersSelect };
      if (table === 'tasks_table') return { select: tasksSelect };
      throw new Error(`Unexpected table: ${table}`);
    }),
  });
}

describe('getTasksNeedingReminder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns eligible reminder rows via Supabase REST (no pg pool)', async () => {
    setupSupabaseForReminders([{
      TaskId: 5,
      UserId: '339',
      TaskType: 'lunch',
      TaskDate: '2026-06-09',
      Status: 'pending',
      ReminderCount: 0,
      ReminderDismissedToday: false,
      NotificationSent: true,
      SnoozedUntil: null,
    }]);

    const rows = await getTasksNeedingReminder('2026-06-09', '13:00:00', new Date('2026-06-09T13:00:00'));

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      task_id: 5,
      user_id: '339',
      PushToken: 'tok_abc',
    });
  });
});
