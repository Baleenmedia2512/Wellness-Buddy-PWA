/**
 * stepCounterConstants.js — single source of truth for all step counter
 * tunables. Pure values, no React, no I/O. Imported by services + hooks.
 */

export const CALORIES_PER_STEP    = 0.04;
export const UPDATE_THROTTLE_MS   = 1000;
export const ACTIVITY_TYPE        = 'walking';
export const AUTO_SAVE_INTERVAL_MS = 30_000;
export const AUTO_SAVE_STEP_DELTA  = 10;
export const POLL_INTERVAL_MS     = 5000;
export const STEP_GOAL            = 10000;
export const RING_RADIUS          = 80;
export const RING_CIRCUMFERENCE   = 2 * Math.PI * RING_RADIUS;

// GPS thresholds
export const GPS_MIN_MOVE_METERS = 10;
export const GPS_MAX_JUMP_METERS = 120;
export const GPS_MAX_WALK_SPEED_MPS = 4;
export const GPS_PATH_ACCURACY_METERS = 20;
export const GPS_VEHICLE_SPEED_MPS = 6;
export const ANTI_FAKE_MAX_STEPS_PER_MIN = 260;
export const ANTI_FAKE_WINDOW_MS = 30_000;

// Anti-cheat engine
export const AC_BURST_WINDOW_MS         = 10_000;
export const AC_BURST_MAX_STEPS         = 60;
export const AC_VARIANCE_WINDOW         = 12;
export const AC_VARIANCE_MIN_REAL_WALK  = 0.08;
export const AC_SUSTAINED_RATE_SPM      = 220;
export const AC_SUSTAINED_RATE_SECS     = 20;
export const AC_GPS_STATIONARY_FAST_SPM = 140;
export const AC_SCORE_DECAY_PER_CLEAN   = 15;
export const AC_SCORE_BLOCK_THRESHOLD   = 70;
export const AC_SCORE_WARN_THRESHOLD    = 40;
export const AC_QUARANTINE_RATIO        = 0.6;

// Time / drift guards
export const STEP_TIME_GUARD_LAST_TS_KEY = 'step_time_guard_last_seen_ts';
export const STEP_TIME_GUARD_LAST_DATE_KEY = 'step_time_guard_last_seen_date';
export const STEP_TIME_DRIFT_BACK_MS = 5 * 60 * 1000;
export const STEP_TIME_JUMP_WINDOW_MS = 36 * 60 * 60 * 1000;
export const SERVER_DATE_CHECK_INTERVAL_MS = 5 * 60 * 1000;

// Backfill
export const BACKFILL_MAX_DELTA_TODAY = 5000;
export const STORAGE_CLEANUP_DAYS = 7;
