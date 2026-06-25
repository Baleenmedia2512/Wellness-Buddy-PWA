/**
 * stepCounterStorage.js — all localStorage I/O for the step counter.
 *
 * The original component sprinkled getItem/setItem calls across half a dozen
 * scopes. Centralising them here keeps the hooks free of magic strings and
 * lets us cleanup or migrate keys in one place.
 */
import {
  getBaselineKey, getSaveSensorKey, getSaveStepsKey, getDistanceStorageKey,
  toDateKey, isValidLatLng,
} from './stepCounterCalculations';
import { STORAGE_CLEANUP_DAYS } from './stepCounterConstants';

// ── Daily sensor baseline ──────────────────────────────────────────────────
export const readBaseline = (dateKey) => {
  try {
    const raw = localStorage.getItem(getBaselineKey(dateKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Number.isFinite(parsed?.sensorTotal) ? parsed : null;
  } catch { return null; }
};

export const writeBaseline = (dateKey, sensorTotal) => {
  localStorage.setItem(
    getBaselineKey(dateKey),
    JSON.stringify({ sensorTotal, savedAt: Date.now(), date: dateKey })
  );
};

// ── Last-save anchors (for reopen baseline math) ──────────────────────────
export const writeSaveAnchors = (dateKey, sensorTotal, steps) => {
  if (Number.isFinite(sensorTotal)) localStorage.setItem(getSaveSensorKey(dateKey), String(sensorTotal));
  if (Number.isFinite(steps))       localStorage.setItem(getSaveStepsKey(dateKey),  String(steps));
};

export const readSaveAnchors = (dateKey) => {
  const sensorStr = localStorage.getItem(getSaveSensorKey(dateKey));
  const stepsStr  = localStorage.getItem(getSaveStepsKey(dateKey));
  return {
    savedSensor: sensorStr ? Number(sensorStr) : null,
    savedSteps:  stepsStr  ? Number(stepsStr)  : null,
  };
};

// ── Outdoor distance accumulator ──────────────────────────────────────────
export const readPersistedDistance = (dateKey) => {
  try {
    const raw = localStorage.getItem(getDistanceStorageKey(dateKey));
    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    return Number.isFinite(parsed?.totalMeters) ? parsed.totalMeters : 0;
  } catch { return 0; }
};

export const persistDistance = (dateKey, totalMeters) => {
  localStorage.setItem(getDistanceStorageKey(dateKey), JSON.stringify({ totalMeters, dateKey }));
};

export const clearDistance = (dateKey) =>
  localStorage.removeItem(getDistanceStorageKey(dateKey));

// ── Last-saved DB timestamp (label on UI) ─────────────────────────────────
export const writeLastSavedTime = (dt) =>
  localStorage.setItem('step_last_saved_time', String(dt.getTime()));

export const readLastSavedTime = () => {
  const stored = localStorage.getItem('step_last_saved_time');
  return stored ? new Date(Number(stored)) : null;
};

// ── Last GPS position (for indoor/outdoor strip on reopen) ────────────────
export const writeLastGpsPos = (pos) =>
  localStorage.setItem('step_last_gps_pos', JSON.stringify(pos));

export const readLastGpsPos = () => {
  try {
    const raw = localStorage.getItem('step_last_gps_pos');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const TEN_MIN_MS = 10 * 60 * 1000;
    const isFresh = parsed.ts && (Date.now() - parsed.ts) < TEN_MIN_MS;
    if (isValidLatLng(parsed.lat, parsed.lng) && parsed.date === toDateKey() && isFresh) return parsed;
    localStorage.removeItem('step_last_gps_pos');
    return null;
  } catch { return null; }
};

export const clearLastGpsPos = () => localStorage.removeItem('step_last_gps_pos');

// ── Mirror of dbUserId (multi-source userId fallback chain) ──────────────
export const readStoredUserId = () => {
  const stored = localStorage.getItem('dbUserId');
  return stored ? Number(stored) : null;
};
export const writeStoredUserId = (id) => localStorage.setItem('dbUserId', String(id));
export const readStoredEmail   = () => localStorage.getItem('userEmail');

// ── Cleanup: remove stale per-day keys older than 7 days ──────────────────
export const cleanupOldStorageKeys = () => {
  const now = Date.now();
  const limit = STORAGE_CLEANUP_DAYS * 24 * 60 * 60 * 1000;
  const remove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    const m = key.match(/^step_(?:counter_baseline|save_sensor)_(\d{4}-\d{2}-\d{2})$/);
    if (m) {
      const t = new Date(m[1]).getTime();
      if (now - t > limit) remove.push(key);
    }
  }
  remove.forEach(k => localStorage.removeItem(k));
  return remove.length;
};
