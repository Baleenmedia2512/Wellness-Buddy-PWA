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

// ─── getTasksByUserAndDate ────────────────────────────────────────────────────

describe('getTasksByUserAndDate', () => {
  let mockQuery;
  let mockRelease;

  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery   = jest.fn();
    mockRelease = jest.fn();
    setupMockConnection(mockQuery, mockRelease);
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
    mockQuery.mockResolvedValueOnce(mysqlResult([fakeTask]));

    const rows = await getTasksByUserAndDate('339', '2026-06-09');

    expect(rows).toEqual([fakeTask]);
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });

  it('returns an empty array when no tasks exist for that date', async () => {
    mockQuery.mockResolvedValueOnce(mysqlResult([]));

    const rows = await getTasksByUserAndDate('339', '2026-06-09');

    expect(rows).toEqual([]);
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });

  it('includes a $3 placeholder when status filter is supplied', async () => {
    mockQuery.mockResolvedValueOnce(mysqlResult([]));

    await getTasksByUserAndDate('339', '2026-06-09', 'pending');

    const sql = mockQuery.mock.calls[0][0];
    expect(sql).toContain('$3');
  });

  it('propagates a DB error and still calls release()', async () => {
    mockQuery.mockRejectedValueOnce(new Error('connection timeout'));

    await expect(getTasksByUserAndDate('339', '2026-06-09')).rejects.toThrow(
      'connection timeout',
    );
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });

  // ─── REGRESSION: the exact bug that caused the 500 ──────────────────────────
  it('REGRESSION: does NOT throw "client.release is not a function" (commit 0b0bdbed)', async () => {
    mockQuery.mockResolvedValueOnce(mysqlResult([]));

    // Before the fix, the finally block threw TypeError because the pool
    // wrapper has no release() method.
    await expect(getTasksByUserAndDate('339', '2026-06-09')).resolves.toBeDefined();
  });
});

// ─── snoozeTask ───────────────────────────────────────────────────────────────

describe('snoozeTask', () => {
  let mockQuery;
  let mockRelease;

  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery   = jest.fn();
    mockRelease = jest.fn();
    setupMockConnection(mockQuery, mockRelease);
  });

  it('returns the updated task row on success', async () => {
    const updatedRow = { task_id: 42, reminder_count: 1, snoozed_until: '2026-06-09T07:15:00' };
    mockQuery.mockResolvedValueOnce(mysqlResult([updatedRow]));

    const row = await snoozeTask(42, new Date('2026-06-09T07:15:00'));

    expect(row).toEqual(updatedRow);
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });

  it('throws when the task is not found or not pending', async () => {
    mockQuery.mockResolvedValueOnce(mysqlResult([]));

    await expect(snoozeTask(99, new Date())).rejects.toThrow(
      'Task not found or not pending',
    );
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });

  it('propagates unexpected DB errors and still releases', async () => {
    mockQuery.mockRejectedValueOnce(new Error('deadlock detected'));

    await expect(snoozeTask(42, new Date())).rejects.toThrow('deadlock detected');
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });
});

// ─── dismissTaskToday ─────────────────────────────────────────────────────────

describe('dismissTaskToday', () => {
  let mockQuery;
  let mockRelease;

  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery   = jest.fn();
    mockRelease = jest.fn();
    setupMockConnection(mockQuery, mockRelease);
  });

  it('returns the updated row when task is dismissed', async () => {
    const updatedRow = { task_id: 7, reminder_dismissed_today: true };
    mockQuery.mockResolvedValueOnce(mysqlResult([updatedRow]));

    const row = await dismissTaskToday(7);

    expect(row.reminder_dismissed_today).toBe(true);
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });

  it('throws when task is not found', async () => {
    mockQuery.mockResolvedValueOnce(mysqlResult([]));

    await expect(dismissTaskToday(99)).rejects.toThrow('Task not found or not pending');
    expect(mockRelease).toHaveBeenCalledTimes(1);
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

describe('createTask', () => {
  let mockQuery;
  let mockRelease;

  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery   = jest.fn();
    mockRelease = jest.fn();
    setupMockConnection(mockQuery, mockRelease);
  });

  it('returns the created row when insert succeeds', async () => {
    const newRow = { TaskId: 100, UserId: '339', TaskType: 'weight' };
    mockQuery.mockResolvedValueOnce(mysqlResult([newRow]));

    const row = await createTask({
      userId:      '339',
      taskType:    'weight',
      taskDate:    '2026-06-09',
      windowStart: '06:00:00',
      windowEnd:   '07:30:00',
    });

    expect(row).toEqual(newRow);
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });

  it('returns null when the task already exists (ON CONFLICT DO NOTHING)', async () => {
    mockQuery.mockResolvedValueOnce(mysqlResult([]));

    const row = await createTask({
      userId:      '339',
      taskType:    'weight',
      taskDate:    '2026-06-09',
      windowStart: '06:00:00',
      windowEnd:   '07:30:00',
    });

    expect(row).toBeNull();
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });
});

// ─── completeTask ─────────────────────────────────────────────────────────────

describe('completeTask', () => {
  let mockQuery;
  let mockRelease;

  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery   = jest.fn();
    mockRelease = jest.fn();
    setupMockConnection(mockQuery, mockRelease);
  });

  it('returns the updated row on success', async () => {
    const updatedRow = { TaskId: 1, Status: 'completed', UserId: '339' };
    mockQuery.mockResolvedValueOnce(mysqlResult([updatedRow]));

    const row = await completeTask(1, { weight: 70 });

    expect(row).toEqual(updatedRow);
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });

  it('throws when task is not found or already completed', async () => {
    mockQuery.mockResolvedValueOnce(mysqlResult([]));

    await expect(completeTask(999, { weight: 70 })).rejects.toThrow(
      'Task not found or already completed',
    );
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });
});

// ─── getTasksNeedingReminder ──────────────────────────────────────────────────

describe('getTasksNeedingReminder', () => {
  let mockQuery;
  let mockRelease;

  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery   = jest.fn();
    mockRelease = jest.fn();
    setupMockConnection(mockQuery, mockRelease);
  });

  it('returns the reminder rows array', async () => {
    const reminderRow = { task_id: 5, user_id: '339', push_token: 'tok_abc' };
    mockQuery.mockResolvedValueOnce(mysqlResult([reminderRow]));

    const rows = await getTasksNeedingReminder(new Date(), '2026-06-09');

    expect(rows).toEqual([reminderRow]);
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });
});

// Logger mock — prevent console noise in test output
jest.mock('../../../shared/lib/logger.js', () => ({
  info:  jest.fn(),
  warn:  jest.fn(),
  error: jest.fn(),
}));

// ─── Import after mocks are in place ─────────────────────────────────────────
import {
  getTasksByUserAndDate,
  snoozeTask,
  dismissTaskToday,
  expireOldTasks,
  createTask,
  completeTask,
  getTasksNeedingReminder,
} from '../data/task-repo.js';

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

// ─── getTasksByUserAndDate ────────────────────────────────────────────────────

describe('getTasksByUserAndDate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetConnection.mockResolvedValue(mockConnection);
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
    mockQuery.mockResolvedValueOnce(mysqlResult([fakeTask]));

    const rows = await getTasksByUserAndDate('339', '2026-06-09');

    expect(rows).toEqual([fakeTask]);
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });

  it('returns an empty array when no tasks exist for that date', async () => {
    mockQuery.mockResolvedValueOnce(mysqlResult([]));

    const rows = await getTasksByUserAndDate('339', '2026-06-09');

    expect(rows).toEqual([]);
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });

  it('filters by status when the status param is supplied', async () => {
    mockQuery.mockResolvedValueOnce(mysqlResult([]));

    await getTasksByUserAndDate('339', '2026-06-09', 'pending');

    // The SQL passed to query should include a $3 parameter for the status
    const sql = mockQuery.mock.calls[0][0];
    expect(sql).toContain('$3');
  });

  it('propagates a DB error and still calls release()', async () => {
    const dbError = new Error('connection timeout');
    mockQuery.mockRejectedValueOnce(dbError);

    await expect(getTasksByUserAndDate('339', '2026-06-09')).rejects.toThrow(
      'connection timeout',
    );
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });

  // ─── REGRESSION: the exact bug that caused the 500 ──────────────────────────
  it('REGRESSION: does NOT throw "client.release is not a function" (bug from commit 0b0bdbed)', async () => {
    mockQuery.mockResolvedValueOnce(mysqlResult([]));

    // Before the fix this would throw TypeError from the finally block.
    await expect(getTasksByUserAndDate('339', '2026-06-09')).resolves.toBeDefined();
  });
});

// ─── snoozeTask ───────────────────────────────────────────────────────────────

describe('snoozeTask', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetConnection.mockResolvedValue(mockConnection);
  });

  it('returns the updated task row on success', async () => {
    const updatedRow = { task_id: 42, reminder_count: 1, snoozed_until: '2026-06-09T07:15:00' };
    mockQuery.mockResolvedValueOnce(mysqlResult([updatedRow]));

    const row = await snoozeTask(42, new Date('2026-06-09T07:15:00'));

    expect(row).toEqual(updatedRow);
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });

  it('throws when the task is not found or not pending', async () => {
    mockQuery.mockResolvedValueOnce(mysqlResult([])); // empty → task not found

    await expect(snoozeTask(99, new Date())).rejects.toThrow(
      'Task not found or not pending',
    );
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });

  it('propagates unexpected DB errors and still releases', async () => {
    mockQuery.mockRejectedValueOnce(new Error('deadlock detected'));

    await expect(snoozeTask(42, new Date())).rejects.toThrow('deadlock detected');
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });
});

// ─── dismissTaskToday ─────────────────────────────────────────────────────────

describe('dismissTaskToday', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetConnection.mockResolvedValue(mockConnection);
  });

  it('returns the updated row when task is dismissed', async () => {
    const updatedRow = { task_id: 7, reminder_dismissed_today: true };
    mockQuery.mockResolvedValueOnce(mysqlResult([updatedRow]));

    const row = await dismissTaskToday(7);

    expect(row.reminder_dismissed_today).toBe(true);
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });

  it('throws when task is not found', async () => {
    mockQuery.mockResolvedValueOnce(mysqlResult([]));

    await expect(dismissTaskToday(99)).rejects.toThrow('Task not found or not pending');
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });
});

// ─── expireOldTasks ───────────────────────────────────────────────────────────

describe('expireOldTasks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetConnection.mockResolvedValue(mockConnection);
  });

  it('returns the count of expired tasks via affectedRows', async () => {
    mockQuery.mockResolvedValueOnce(mysqlResult([], 5)); // 5 rows affected

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

describe('createTask', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetConnection.mockResolvedValue(mockConnection);
  });

  it('returns the created row when insert succeeds', async () => {
    const newRow = { TaskId: 100, UserId: '339', TaskType: 'weight' };
    mockQuery.mockResolvedValueOnce(mysqlResult([newRow]));

    const row = await createTask({
      userId: '339',
      taskType: 'weight',
      taskDate: '2026-06-09',
      windowStart: '06:00:00',
      windowEnd: '07:30:00',
    });

    expect(row).toEqual(newRow);
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });

  it('returns null when the task already exists (ON CONFLICT DO NOTHING)', async () => {
    mockQuery.mockResolvedValueOnce(mysqlResult([])); // 0 rows = conflict, nothing inserted

    const row = await createTask({
      userId: '339',
      taskType: 'weight',
      taskDate: '2026-06-09',
      windowStart: '06:00:00',
      windowEnd: '07:30:00',
    });

    expect(row).toBeNull();
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });
});

// ─── completeTask ─────────────────────────────────────────────────────────────

describe('completeTask', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetConnection.mockResolvedValue(mockConnection);
  });

  it('returns the updated row on success', async () => {
    const updatedRow = { TaskId: 1, Status: 'completed', UserId: '339' };
    mockQuery.mockResolvedValueOnce(mysqlResult([updatedRow]));

    const row = await completeTask(1, { weight: 70 });

    expect(row).toEqual(updatedRow);
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });

  it('throws when task is not found or already completed', async () => {
    mockQuery.mockResolvedValueOnce(mysqlResult([]));

    await expect(completeTask(999, { weight: 70 })).rejects.toThrow(
      'Task not found or already completed',
    );
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });
});

// ─── getTasksNeedingReminder ──────────────────────────────────────────────────

describe('getTasksNeedingReminder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetConnection.mockResolvedValue(mockConnection);
  });

  it('returns the reminder rows array', async () => {
    const reminderRow = { task_id: 5, user_id: '339', push_token: 'tok_abc' };
    mockQuery.mockResolvedValueOnce(mysqlResult([reminderRow]));

    const rows = await getTasksNeedingReminder(new Date(), '2026-06-09');

    expect(rows).toEqual([reminderRow]);
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });
});
