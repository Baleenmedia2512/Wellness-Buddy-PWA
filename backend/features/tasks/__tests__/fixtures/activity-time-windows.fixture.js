/**
 * TEST-ONLY sample rows — NOT production config.
 * Production reads live rows from activity_time_windows_table
 * (EffectiveToDate IS NULL) on every request and cron tick.
 *
 * Columns: ActivityType, WindowStartTime, WindowEndTime
 */
export const ACTIVITY_TIME_WINDOWS_TABLE_ROWS = [
  {
    ActivityType:     'weight',
    WindowStartTime:  '03:00:00',
    WindowEndTime:    '07:30:00',
  },
  {
    ActivityType:     'education',
    WindowStartTime:  '07:15:00',
    WindowEndTime:    '08:45:00',
  },
  {
    ActivityType:     'breakfast',
    WindowStartTime:  '05:30:00',
    WindowEndTime:    '08:30:00',
  },
  {
    ActivityType:     'lunch',
    WindowStartTime:  '12:00:00',
    WindowEndTime:    '16:00:00',
  },
  {
    ActivityType:     'dinner',
    WindowStartTime:  '17:30:00',
    WindowEndTime:    '20:30:00',
  },
];

/** Map keyed by ActivityType (same shape as task-repo getTimeWindowsByUser aliases). */
export const ACTIVITY_TIME_WINDOWS_MAP = Object.fromEntries(
  ACTIVITY_TIME_WINDOWS_TABLE_ROWS.map((row) => [
    row.ActivityType,
    {
      activity_type: row.ActivityType,
      start_time:    row.WindowStartTime,
      end_time:      row.WindowEndTime,
    },
  ]),
);
