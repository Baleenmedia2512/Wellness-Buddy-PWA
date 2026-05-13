/**
 * stepCounterAntiCheat.js — pro anti-cheat scoring engine.
 *
 * Pure function (apart from mutating the refs the caller hands in).
 * Returns { score, shouldBlock, shouldWarn, reasons } — the caller decides
 * what to do with the verdict (quarantine steps, raise warning, etc.).
 */
import {
  AC_BURST_WINDOW_MS, AC_BURST_MAX_STEPS,
  AC_VARIANCE_WINDOW, AC_VARIANCE_MIN_REAL_WALK,
  AC_SUSTAINED_RATE_SPM, AC_SUSTAINED_RATE_SECS,
  AC_GPS_STATIONARY_FAST_SPM,
  AC_SCORE_DECAY_PER_CLEAN, AC_SCORE_BLOCK_THRESHOLD, AC_SCORE_WARN_THRESHOLD,
} from './stepCounterConstants';

const computeVariance = (events) => {
  const recent = events.slice(-AC_VARIANCE_WINDOW);
  const gaps = [];
  for (let i = 1; i < recent.length; i++) gaps.push((recent[i] - recent[i - 1]) / 1000);
  const meanGap = gaps.reduce((s, g) => s + g, 0) / gaps.length;
  const variance = gaps.reduce((s, g) => s + (g - meanGap) ** 2, 0) / gaps.length;
  return { meanGap, variance };
};

/**
 * Run the anti-cheat engine for one sensor event.
 *
 * @param {object} refs - { acScoreRef, acEventTimesRef, acLastGpsMovedRef,
 *                          acSustainedStartRef, acLastCleanWindowRef }
 * @returns {{ score:number, shouldBlock:boolean, shouldWarn:boolean, reasons:string[] }}
 */
export const runAntiCheatEngine = (refs) => {
  const now = Date.now();
  refs.acEventTimesRef.current.push(now);
  refs.acEventTimesRef.current = refs.acEventTimesRef.current.filter(t => now - t <= 30_000);

  let scoreDelta = 0;
  const reasons = [];

  // L1: burst
  const burstEvents = refs.acEventTimesRef.current.filter(t => now - t <= AC_BURST_WINDOW_MS);
  if (burstEvents.length > AC_BURST_MAX_STEPS) {
    scoreDelta += 50;
    reasons.push(`burst:${burstEvents.length}events/10s`);
  }

  // L2: variance
  if (refs.acEventTimesRef.current.length >= AC_VARIANCE_WINDOW) {
    const { meanGap, variance } = computeVariance(refs.acEventTimesRef.current);
    if (meanGap < 0.25 && variance < AC_VARIANCE_MIN_REAL_WALK) {
      scoreDelta += 35;
      reasons.push(`variance:${variance.toFixed(3)},gap:${meanGap.toFixed(2)}s`);
    }
    if (meanGap < 0.20) {
      scoreDelta += 35;
      reasons.push(`impossible_rate:${(60 / meanGap).toFixed(0)}spm`);
    }
  }

  // L3: sustained rate
  const window30 = refs.acEventTimesRef.current.filter(t => now - t <= 30_000);
  if (window30.length >= 4) {
    const spanSec = (now - window30[0]) / 1000;
    const spm30   = spanSec > 3 ? (window30.length / spanSec) * 60 : 0;
    if (spm30 >= AC_SUSTAINED_RATE_SPM) {
      if (!refs.acSustainedStartRef.current) refs.acSustainedStartRef.current = now;
      const sustainedSec = (now - refs.acSustainedStartRef.current) / 1000;
      if (sustainedSec >= AC_SUSTAINED_RATE_SECS) {
        scoreDelta += 30;
        reasons.push(`sustained:${spm30.toFixed(0)}spm_for_${sustainedSec.toFixed(0)}s`);
      }
    } else {
      refs.acSustainedStartRef.current = null;
    }
  }

  // L4: GPS contradiction
  const recentBurstSpm = burstEvents.length > 1
    ? (burstEvents.length / (AC_BURST_WINDOW_MS / 1000)) * 60 : 0;
  if (!refs.acLastGpsMovedRef.current && recentBurstSpm > AC_GPS_STATIONARY_FAST_SPM) {
    scoreDelta += 25;
    reasons.push(`gps_stationary+fast:${recentBurstSpm.toFixed(0)}spm`);
  }

  // Decay on clean windows
  if (scoreDelta === 0 && now - refs.acLastCleanWindowRef.current >= AC_BURST_WINDOW_MS) {
    refs.acLastCleanWindowRef.current = now;
    refs.acScoreRef.current = Math.max(0, refs.acScoreRef.current - AC_SCORE_DECAY_PER_CLEAN);
  }

  refs.acScoreRef.current = Math.min(100, Math.max(0, refs.acScoreRef.current + scoreDelta));
  const score = refs.acScoreRef.current;

  if (reasons.length > 0) {
    console.warn(`[AntiCheat] score=${score} delta=+${scoreDelta} reasons=[${reasons.join(', ')}]`);
  }

  return {
    score,
    shouldBlock: score >= AC_SCORE_BLOCK_THRESHOLD,
    shouldWarn:  score >= AC_SCORE_WARN_THRESHOLD,
    reasons,
  };
};
