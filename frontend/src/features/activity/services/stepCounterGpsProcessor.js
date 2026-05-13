/**
 * stepCounterGpsProcessor.js — pure-ish GPS fix processor.
 *
 * Called from both Geolocation.watchPosition (live, with speed) and the
 * 5-second SharedPrefs poll (no speed). Mutates the refs the caller hands
 * in. Kept out of the hook so the hook stays under the LOC cap.
 *
 * Behaviour preserved verbatim from the original component:
 *   - Day rollover wipes outdoor distance + step session + last-known pos
 *   - Outdoor classification: accuracy < 25 m (live) or < 50 m (poll)
 *   - Outdoor-step session math (start on indoor→outdoor, close on the flip)
 *   - Vehicle detection: GPS Doppler speed > GPS_VEHICLE_SPEED_MPS
 *   - Distance accumulation: only when isOutdoor && accuracy ≤ 20 m,
 *     with 10 m min-move, 120 m max-jump and 4 m/s max walk-speed gates
 */
import {
  GPS_VEHICLE_SPEED_MPS, GPS_PATH_ACCURACY_METERS,
  GPS_MIN_MOVE_METERS, GPS_MAX_JUMP_METERS, GPS_MAX_WALK_SPEED_MPS,
} from './stepCounterConstants';
import { isValidLatLng, distanceInMeters, toDateKey, getDistanceStorageKey } from './stepCounterCalculations';
import { writeLastGpsPos, persistDistance, clearLastGpsPos } from './stepCounterStorage';

const handleDayRollover = ({ refs, todayKey, setOutdoorSteps, setOutdoorDistance, setLastGpsPos }) => {
  const previousDateKey = refs.routeDateRef.current;
  refs.routeDateRef.current = todayKey;
  refs.outdoorStepsRef.current = 0;
  refs.outdoorSessionStartStepsRef.current = null;
  refs.outdoorLastIsOutdoorRef.current = false;
  refs.outdoorDistanceRef.current = 0;
  refs.lastAcceptedGpsPtRef.current = null;
  setOutdoorSteps(0);
  setOutdoorDistance(0);
  setLastGpsPos(null);
  clearLastGpsPos();
  if (previousDateKey) localStorage.removeItem(getDistanceStorageKey(previousDateKey));
};

const updateOutdoorStepsSession = ({ refs, isOutdoor, setOutdoorSteps }) => {
  const wasOutdoor = refs.outdoorLastIsOutdoorRef.current;
  if (!wasOutdoor && isOutdoor) {
    refs.outdoorSessionStartStepsRef.current = refs.todayStepsRef.current;
    refs.outdoorLastIsOutdoorRef.current = true;
  } else if (wasOutdoor && !isOutdoor) {
    if (refs.outdoorSessionStartStepsRef.current !== null) {
      const delta = Math.max(0, refs.todayStepsRef.current - refs.outdoorSessionStartStepsRef.current);
      refs.outdoorStepsRef.current += delta;
      setOutdoorSteps(refs.outdoorStepsRef.current);
    }
    refs.outdoorSessionStartStepsRef.current = null;
    refs.outdoorLastIsOutdoorRef.current = false;
  } else if (wasOutdoor && isOutdoor && refs.outdoorSessionStartStepsRef.current !== null) {
    const liveDelta = Math.max(0, refs.todayStepsRef.current - refs.outdoorSessionStartStepsRef.current);
    setOutdoorSteps(refs.outdoorStepsRef.current + liveDelta);
  }
};

const updateVehicleDetection = ({ refs, speed, setSuspiciousActivity }) => {
  if (speed === null) return;
  if (speed > GPS_VEHICLE_SPEED_MPS) {
    if (refs.suspiciousActivityRef.current !== 'vehicle_detected') {
      refs.suspiciousActivityRef.current = 'vehicle_detected';
      setSuspiciousActivity('vehicle_detected');
      console.warn(`[AntiCheat] Vehicle speed: ${(speed * 3.6).toFixed(1)} kph`);
    }
  } else if (refs.suspiciousActivityRef.current === 'vehicle_detected') {
    refs.suspiciousActivityRef.current = null;
    setSuspiciousActivity(null);
  }
};

const accumulateDistance = ({ refs, lat, lng, timestamp, todayKey, speed, setOutdoorDistance }) => {
  if (speed !== null && speed < 0.3) { refs.acLastGpsMovedRef.current = false; return; }

  const incoming = { lat, lng, timestamp };
  const last = refs.lastAcceptedGpsPtRef.current;
  if (!last) { refs.lastAcceptedGpsPtRef.current = incoming; return; }

  const gapMeters = distanceInMeters(last, incoming);
  const dtSec     = Math.max(2, ((incoming.timestamp || Date.now()) - (last.timestamp || 0)) / 1000);
  const speedMps  = gapMeters / dtSec;

  if (gapMeters < GPS_MIN_MOVE_METERS) { refs.acLastGpsMovedRef.current = false; return; }
  if (gapMeters > GPS_MAX_JUMP_METERS && dtSec <= 10) return;
  if (speedMps > GPS_MAX_WALK_SPEED_MPS) return;

  refs.outdoorDistanceRef.current += gapMeters;
  setOutdoorDistance(refs.outdoorDistanceRef.current);
  persistDistance(todayKey, refs.outdoorDistanceRef.current);
  refs.acLastGpsMovedRef.current = true;
  refs.lastAcceptedGpsPtRef.current = incoming;
};

/** Process one GPS fix. `speed` may be null when called from the SharedPrefs poll. */
export const processGpsPosition = ({
  refs, lat, lng, accuracy, timestamp, speed = null,
  setOutdoorSteps, setOutdoorDistance, setLastGpsPos, setSuspiciousActivity,
}) => {
  if (!isValidLatLng(lat, lng)) return;
  const todayKey = toDateKey();
  if (refs.routeDateRef.current !== todayKey) {
    handleDayRollover({ refs, todayKey, setOutdoorSteps, setOutdoorDistance, setLastGpsPos });
  }

  const outdoorAccuracyThreshold = speed !== null ? 25 : 50;
  const isOutdoor = accuracy < outdoorAccuracyThreshold;

  updateOutdoorStepsSession({ refs, isOutdoor, setOutdoorSteps });

  const pos = { lat, lng, isOutdoor, accuracy: Math.round(accuracy), speed: speed !== null ? speed : null, date: todayKey, ts: Date.now() };
  setLastGpsPos(pos);
  writeLastGpsPos(pos);

  updateVehicleDetection({ refs, speed, setSuspiciousActivity });

  if (isOutdoor && accuracy <= GPS_PATH_ACCURACY_METERS) {
    accumulateDistance({ refs, lat, lng, timestamp, todayKey, speed, setOutdoorDistance });
  }
};
