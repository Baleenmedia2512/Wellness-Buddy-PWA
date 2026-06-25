/**
 * stepCounterBackfillService.js — background-service step backfill logic.
 *
 * Reconciles per-day step totals between the cloud DB (single source of
 * truth) and the GalleryMonitorService SharedPreferences buffer. Runs once
 * per app open. Returns the list of {date, steps} corrections that were
 * pushed to the service so the caller can re-sync today's dbOffset if
 * today was among them.
 */
import { Capacitor } from '@capacitor/core';
import { StepCounterPlugin } from '../../../shared/plugins/stepCounterPlugin';
import { GalleryMonitorPlugin } from '../../../shared/plugins/galleryMonitorPlugin';
import { fetchDailyActivity } from './dailyActivityService';
import { ACTIVITY_TYPE, BACKFILL_MAX_DELTA_TODAY } from './stepCounterConstants';
import { toDateKey } from './stepCounterCalculations';
import { debugLog } from '../../../shared/utils/logger.js';

/**
 * Compare BG service totals against DB totals for the past 7 days.
 * Pushes corrections via GalleryMonitorPlugin.syncDailySteps.
 *
 * @returns {Promise<Array<{date:string, steps:number}>>} list of corrections applied
 */
export const runBackgroundBackfill = async (resolvedUserId) => {
  if (!Capacitor.isNativePlatform() || !resolvedUserId) return [];

  const { history } = await StepCounterPlugin.getBackgroundStepHistory(7);
  if (!Array.isArray(history) || history.length === 0) return [];
  const bgDays = history.filter((e) => e.steps > 0);
  if (bgDays.length === 0) return [];

  const dbResponse = await fetchDailyActivity(resolvedUserId, 7, ACTIVITY_TYPE, toDateKey());
  const dbTrend = dbResponse.trend || dbResponse.data || [];
  const dbMap   = new Map(dbTrend.map((d) => [d.date, d.steps]));
  const todayKey = toDateKey();

  // Days needing correction: BG > DB, except today's overshoot beyond the
  // suspicious-delta threshold (which indicates stale phantom SharedPrefs data).
  const toFix = bgDays.filter((e) => {
    const dbSteps = dbMap.get(e.date) || 0;
    if (e.steps <= dbSteps) return false;
    if (e.date === todayKey && dbSteps > 0 && (e.steps - dbSteps) > BACKFILL_MAX_DELTA_TODAY) return false;
    return true;
  });

  // Stale today's-baseline correction: reset SharedPrefs to DB value
  const todayBg = bgDays.find((e) => e.date === todayKey);
  if (todayBg) {
    const todayDb = dbMap.get(todayKey) || 0;
    if (todayDb > 0 && (todayBg.steps - todayDb) > BACKFILL_MAX_DELTA_TODAY) {
      console.warn('[StepCounter] Correcting stale bgService baseline:', todayBg.steps, '→', todayDb);
      GalleryMonitorPlugin.syncDailySteps(todayKey, todayDb).catch(() => {});
    }
  }

  if (toFix.length === 0) return [];

  debugLog('[StepCounter] Fixing', toFix.length, 'day(s) from background service');
  // Sequential — service-side in-flight guard would otherwise drop entries
  await toFix.reduce(
    (chain, e) => chain.then(() => GalleryMonitorPlugin.syncDailySteps(e.date, e.steps)),
    Promise.resolve()
  );
  return toFix;
};
