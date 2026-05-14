/**
 * stepCounterTimeGuard.js — silent drift detection + server date check.
 *
 * Detects when the device clock has been moved backwards (or jumped > 1 day
 * forward in less than 36 h of real elapsed time) and exposes a server-date
 * comparator for the visible "Wrong Device Date" warning banner.
 */
import { getServerTime } from '../../misc/services/misc.api';
import { toDateKey } from './stepCounterCalculations';
import {
  STEP_TIME_GUARD_LAST_TS_KEY, STEP_TIME_GUARD_LAST_DATE_KEY,
  STEP_TIME_DRIFT_BACK_MS, STEP_TIME_JUMP_WINDOW_MS,
} from './stepCounterConstants';

/**
 * Compare current device clock against the most recent value we recorded.
 * Returns true when manual time/date manipulation is likely.
 * Always updates the persisted snapshot to "now" before returning.
 */
export const detectSilentTimeDrift = () => {
  try {
    const nowMs = Date.now();
    const nowDate = toDateKey();
    const previousTsRaw = localStorage.getItem(STEP_TIME_GUARD_LAST_TS_KEY);
    const previousDate  = localStorage.getItem(STEP_TIME_GUARD_LAST_DATE_KEY);
    const previousTs    = previousTsRaw ? Number(previousTsRaw) : null;

    let drift = false;
    if (Number.isFinite(previousTs)) {
      if (nowMs + STEP_TIME_DRIFT_BACK_MS < previousTs) {
        drift = true;
      } else if (previousDate && nowMs >= previousTs) {
        const elapsedMs = nowMs - previousTs;
        const prevDateObj = new Date(previousDate);
        const nowDateObj  = new Date(nowDate);
        if (!Number.isNaN(prevDateObj.getTime()) && !Number.isNaN(nowDateObj.getTime())) {
          const dayJump = Math.round(
            (nowDateObj.getTime() - prevDateObj.getTime()) / (24 * 60 * 60 * 1000)
          );
          if ((dayJump > 1 && elapsedMs < STEP_TIME_JUMP_WINDOW_MS) || dayJump < 0) drift = true;
        }
      }
    }

    localStorage.setItem(STEP_TIME_GUARD_LAST_TS_KEY,   String(nowMs));
    localStorage.setItem(STEP_TIME_GUARD_LAST_DATE_KEY, nowDate);
    return drift;
  } catch (e) {
    console.warn('[StepCounter] Silent time drift check failed:', e.message);
    return false;
  }
};

/**
 * Ask the server for its current IST date and return it ONLY when it
 * disagrees with the device's local date. Returns null on agreement
 * or when the network call fails (offline → no false alarm).
 */
export const fetchServerDateMismatch = async () => {
  try {
    const data = await getServerTime();
    const serverDate = data?.date;
    const deviceDate = toDateKey();
    if (serverDate && serverDate !== deviceDate) {
      console.warn(`[StepCounter] Device date mismatch: device=${deviceDate} server=${serverDate}`);
      return serverDate;
    }
    return null;
  } catch (e) {
    console.warn('[StepCounter] Server date check failed (offline?):', e.message);
    return null;
  }
};
