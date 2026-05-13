/**
 * stepCounterCalculations.js — pure math + key helpers.
 * No React, no I/O. Safe to call anywhere.
 */
import { CALORIES_PER_STEP } from './stepCounterConstants';

/** YYYY-MM-DD for a given Date (defaults to today, local time). */
export const toDateKey = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/** Calories burned from a step count, rounded to 2 dp. */
export const calcCalories = (steps) => Number((steps * CALORIES_PER_STEP).toFixed(2));

/** localStorage key helpers — exported so storage layer can build keys. */
export const getBaselineKey   = (dateKey) => `step_counter_baseline_${dateKey}`;
export const getSaveSensorKey = (dateKey) => `step_save_sensor_${dateKey}`;
export const getSaveStepsKey  = (dateKey) => `step_save_steps_${dateKey}`;
export const getDistanceStorageKey = (dateKey) => `step_outdoor_dist_${dateKey}`;

/** Lat/lng sanity check. */
export const isValidLatLng = (lat, lng) =>
  Number.isFinite(lat) && Number.isFinite(lng)
  && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;

/** Haversine distance in meters between {lat,lng} pairs. */
export const distanceInMeters = (a, b) => {
  if (!a || !b) return 0;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};
