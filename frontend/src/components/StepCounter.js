import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { Activity, Footprints, Flame, ArrowLeft, ShieldAlert, Calendar, TrendingUp, RefreshCw, MapPin, Share2 } from 'lucide-react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Tooltip, useMap } from 'react-leaflet';
import { Geolocation } from '@capacitor/geolocation';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import 'leaflet/dist/leaflet.css';
import { StepCounterPlugin } from '../plugins/stepCounterPlugin';
import { GalleryMonitorPlugin } from '../plugins/galleryMonitorPlugin';
import { fetchDailyActivity, saveDailyActivity } from '../services/dailyActivityService';
import LoadingSpinner from './LoadingSpinner';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const CALORIES_PER_STEP    = 0.04;
const UPDATE_THROTTLE_MS   = 1000;        // Max one UI update per second
const ACTIVITY_TYPE        = 'walking';
const AUTO_SAVE_INTERVAL_MS = 30_000;     // Auto-save check interval (every 30 s)
const AUTO_SAVE_STEP_DELTA  = 10;         // Save when steps increase by this many
const POLL_INTERVAL_MS     = 5000;        // Fallback sensor poll every 5 seconds
const STEP_GOAL            = 10000;
const RING_RADIUS          = 80;
const RING_CIRCUMFERENCE   = 2 * Math.PI * RING_RADIUS;
const GPS_MIN_MOVE_METERS = 10;      // minimum gap to draw a new segment (↑ from 8 → fewer, cleaner points)
const GPS_MAX_JUMP_METERS = 120;
const GPS_MAX_WALK_SPEED_MPS = 4;
const MAX_ROUTE_POINTS_PER_DAY = 1500;
// ── GPS line accuracy ──────────────────────────────────────────────────────
const GPS_PATH_ACCURACY_METERS = 20;  // min GPS accuracy required to draw the route line
const GPS_SMOOTH_ALPHA = 0.25;        // EMA weight for new GPS fix (↓ from 0.35 → smoother curves)
// ── GPS spike / stationary suppression ────────────────────────────────────
// Reject a new GPS point if it would create a sharp U-turn (> MAX_COURSE_CHANGE_DEG)
// on a short segment (< SPIKE_MIN_GAP_METERS). Eliminates the "arrow" jitter when
// standing still and short GPS bounce-backs.
const GPS_MAX_COURSE_CHANGE_DEG = 120; // any direction reversal sharper than 120° on a short segment = spike
const GPS_SPIKE_MIN_GAP_METERS  = 18;  // only apply heading check when gap < 18 m (large gaps are real turns)
// If the last N accepted points are all within STATIONARY_RADIUS_METERS of their centroid,
// the user is standing still — stop drawing until movement of STATIONARY_RESUME_METERS.
const GPS_STATIONARY_CLUSTER_SIZE   = 5;   // number of recent points to inspect
const GPS_STATIONARY_RADIUS_METERS  = 12;  // all 5 within 12 m → stationary
const GPS_STATIONARY_RESUME_METERS  = 20;  // must move 20 m from cluster centroid to resume
// ── Anti-fake step detection ───────────────────────────────────────────────
const GPS_VEHICLE_SPEED_MPS = 6;         // ≥ 6 m/s (~22 kph) → likely vehicle/cycling
const ANTI_FAKE_MAX_STEPS_PER_MIN = 260; // beyond human sprint capability
const ANTI_FAKE_WINDOW_MS = 30_000;      // 30-second sliding measurement window

// ── Pro-level Anti-Cheat Engine constants ─────────────────────────────────
// Layer 1: Step cadence burst — phone shaking produces inhuman bursts
const AC_BURST_WINDOW_MS         = 10_000;  // 10-second burst window
const AC_BURST_MAX_STEPS         = 60;      // > 60 steps in 10 s = impossible burst (360/min)
// Layer 2: Variance signature — real walking has natural rhythm variation;
//          shaking produces unnaturally uniform inter-event gaps
const AC_VARIANCE_WINDOW         = 12;      // last 12 sensor events
const AC_VARIANCE_MIN_REAL_WALK  = 0.08;   // real walking variance floor (seconds²)
// Layer 3: Sustained impossible rate — > 220 steps/min for > 20 consecutive seconds
const AC_SUSTAINED_RATE_SPM      = 220;    // steps/min threshold
const AC_SUSTAINED_RATE_SECS     = 20;     // must last this many seconds to flag
// Layer 4: GPS contradiction — steps accumulating fast while GPS shows stationary
const AC_GPS_STATIONARY_FAST_SPM = 140;    // rapid steps while GPS reports no movement
// Layer 5: Score decay — each clean window reduces cheat score
const AC_SCORE_DECAY_PER_CLEAN   = 15;    // points cleared per clean 10-s window
const AC_SCORE_BLOCK_THRESHOLD   = 70;    // score ≥ 70 → block save
const AC_SCORE_WARN_THRESHOLD    = 40;    // score ≥ 40 → show warning (but still save)
// Layer 6: Suspicious steps quarantine — fake steps are quarantined, not added to DB
const AC_QUARANTINE_RATIO        = 0.6;   // if cheat score ≥ block, quarantine 60% of new steps
const STEP_TIME_GUARD_LAST_TS_KEY = 'step_time_guard_last_seen_ts';
const STEP_TIME_GUARD_LAST_DATE_KEY = 'step_time_guard_last_seen_date';
const STEP_TIME_DRIFT_BACK_MS = 5 * 60 * 1000; // 5 minutes
const STEP_TIME_JUMP_WINDOW_MS = 36 * 60 * 60 * 1000; // 36 hours
// Interval (ms) between server-date checks (re-check every 5 minutes while app is open)
const SERVER_DATE_CHECK_INTERVAL_MS = 5 * 60 * 1000;

// ─────────────────────────────────────────────────────────────────────────────
// PURE UTILITY FUNCTIONS (no React state, safe to call anywhere)
// ─────────────────────────────────────────────────────────────────────────────

/** Returns YYYY-MM-DD string for a given Date (or today). */
const toDateKey = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/** Calories burned from a step count. */
const calcCalories = (steps) => Number((steps * CALORIES_PER_STEP).toFixed(2));

/** localStorage key for the day's sensor baseline. */
const getBaselineKey   = (dateKey) => `step_counter_baseline_${dateKey}`;
/** localStorage key for the sensor total at the time of the last DB save. */
const getSaveSensorKey = (dateKey) => `step_save_sensor_${dateKey}`;
/** localStorage key for persisted GPS route of the day. */
const getRouteStorageKey = (dateKey) => `step_route_points_${dateKey}`;

/** Read today's sensor baseline from localStorage. Returns null if absent/invalid. */
const readBaseline = (dateKey) => {
  try {
    const raw    = localStorage.getItem(getBaselineKey(dateKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Number.isFinite(parsed?.sensorTotal) ? parsed : null;
  } catch {
    return null;
  }
};

/** Persist today's sensor baseline to localStorage. */
const writeBaseline = (dateKey, sensorTotal) => {
  localStorage.setItem(
    getBaselineKey(dateKey),
    JSON.stringify({ sensorTotal, savedAt: Date.now(), date: dateKey })
  );
};

const isValidLatLng = (lat, lng) =>
  Number.isFinite(lat) &&
  Number.isFinite(lng) &&
  lat >= -90 &&
  lat <= 90 &&
  lng >= -180 &&
  lng <= 180;

const distanceInMeters = (a, b) => {
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

/**
 * Compass bearing (0–360°) from point a to point b.
 * Used to detect sharp direction reversals (GPS spike / bounce-back).
 */
const bearingDeg = (a, b) => {
  const toRad = (d) => (d * Math.PI) / 180;
  const toDeg = (r) => (r * 180) / Math.PI;
  const dLng  = toRad(b.lng - a.lng);
  const lat1  = toRad(a.lat);
  const lat2  = toRad(b.lat);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
};

/**
 * Geographic centroid (average lat/lng) of an array of points.
 */
const centroidOf = (points) => {
  if (!points.length) return null;
  const sumLat = points.reduce((s, p) => s + p.lat, 0);
  const sumLng = points.reduce((s, p) => s + p.lng, 0);
  return { lat: sumLat / points.length, lng: sumLng / points.length };
};

const readPersistedRoute = (dateKey) => {
  try {
    const raw = localStorage.getItem(getRouteStorageKey(dateKey));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((p) => ({
        lat: Number(p?.lat),
        lng: Number(p?.lng),
        timestamp: Number(p?.timestamp) || Date.now(),
        accuracy: Number(p?.accuracy),
      }))
      .filter((p) => isValidLatLng(p.lat, p.lng));
  } catch {
    return [];
  }
};

const persistRoute = (dateKey, points) => {
  const safe = Array.isArray(points) ? points.slice(-MAX_ROUTE_POINTS_PER_DAY) : [];
  localStorage.setItem(getRouteStorageKey(dateKey), JSON.stringify(safe));
};

// ─────────────────────────────────────────────────────────────────────────────
// BUILD WALK SHARE CANVAS
// Renders the route as a clean fitness card using pure Canvas 2D API.
// No external tile fetches — works in Android WebView / Capacitor with no CORS.
// Returns a Promise<Blob>.
// ─────────────────────────────────────────────────────────────────────────────
const buildWalkShareCanvas = (points, distanceMeters, steps, dateLabel) => {
  return new Promise((resolve, reject) => {
    const W = 800;
    const H = 500;
    const PAD = 48;
    const canvas = document.createElement('canvas');
    canvas.width  = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) { reject(new Error('Canvas not supported')); return; }

    // ── Background gradient ────────────────────────────────────────────────
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#0f172a');   // slate-900
    bg.addColorStop(1, '#134e4a');   // teal-900
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // ── Grid lines (subtle) ─────────────────────────────────────────────────
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

    // ── Draw route polyline ────────────────────────────────────────────────
    const routeAreaH = H - 160;  // bottom 160px reserved for stats bar
    if (points && points.length >= 2) {
      // Project lat/lng → canvas pixels (simple equirectangular)
      const lats = points.map(p => p.lat);
      const lngs = points.map(p => p.lng);
      const minLat = Math.min(...lats), maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
      const spanLat = maxLat - minLat || 0.0001;
      const spanLng = maxLng - minLng || 0.0001;
      // Keep aspect ratio
      const scaleX = (W - PAD * 2) / spanLng;
      const scaleY = (routeAreaH - PAD * 2) / spanLat;
      const scale  = Math.min(scaleX, scaleY);
      const projX  = lng => PAD + (lng - minLng) * scale + ((W - PAD * 2) - spanLng * scale) / 2;
      const projY  = lat => PAD + (routeAreaH - PAD * 2) - (lat - minLat) * scale + ((routeAreaH - PAD * 2) - spanLat * scale) / 2;

      // Glow shadow
      ctx.shadowColor = '#10b981';
      ctx.shadowBlur  = 12;

      // Route line
      ctx.beginPath();
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth   = 4;
      ctx.lineJoin    = 'round';
      ctx.lineCap     = 'round';
      points.forEach((p, i) => {
        const x = projX(p.lng), y = projY(p.lat);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Start dot (green)
      const sx = projX(points[0].lng), sy = projY(points[0].lat);
      ctx.beginPath();
      ctx.arc(sx, sy, 8, 0, Math.PI * 2);
      ctx.fillStyle   = '#10b981';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth   = 2;
      ctx.stroke();

      // End dot (rose)
      const ex = projX(points[points.length - 1].lng), ey = projY(points[points.length - 1].lat);
      ctx.beginPath();
      ctx.arc(ex, ey, 8, 0, Math.PI * 2);
      ctx.fillStyle   = '#f43f5e';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth   = 2;
      ctx.stroke();

      // Start label
      ctx.font      = 'bold 13px system-ui, sans-serif';
      ctx.fillStyle = '#a7f3d0';
      ctx.fillText('Start', sx + 12, sy + 5);

      // End label
      const distLabel = distanceMeters >= 1000
        ? `${(distanceMeters / 1000).toFixed(2)} km`
        : `${Math.round(distanceMeters)} m`;
      ctx.fillStyle = '#fda4af';
      ctx.fillText(distLabel, ex + 12, ey + 5);
    } else {
      // No route — draw placeholder text
      ctx.font      = 'bold 18px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.textAlign = 'center';
      ctx.fillText('No route recorded yet', W / 2, routeAreaH / 2);
      ctx.textAlign = 'left';
    }

    // ── Stats bar ──────────────────────────────────────────────────────────
    const BAR_Y = H - 150;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    const barR = 16;
    ctx.beginPath();
    ctx.moveTo(0 + barR, BAR_Y);
    ctx.lineTo(W - barR, BAR_Y);
    ctx.lineTo(W, BAR_Y + barR);
    ctx.lineTo(W, H); ctx.lineTo(0, H);
    ctx.lineTo(0, BAR_Y + barR);
    ctx.closePath();
    ctx.fill();

    // Distance
    const distStr = distanceMeters >= 1000
      ? (distanceMeters / 1000).toFixed(2)
      : String(Math.round(distanceMeters));
    const distUnit = distanceMeters >= 1000 ? 'km' : 'm';
    ctx.textAlign = 'center';
    ctx.font      = 'bold 42px system-ui, sans-serif';
    ctx.fillStyle = '#10b981';
    ctx.fillText(distStr, W * 0.25, BAR_Y + 55);
    ctx.font      = 'bold 16px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillText(distUnit + '  walked', W * 0.25, BAR_Y + 78);

    // Steps
    ctx.font      = 'bold 42px system-ui, sans-serif';
    ctx.fillStyle = '#f59e0b';
    ctx.fillText(steps.toLocaleString(), W * 0.65, BAR_Y + 55);
    ctx.font      = 'bold 16px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillText('steps', W * 0.65, BAR_Y + 78);

    // Date + branding
    ctx.font      = '13px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillText(dateLabel || '', W * 0.25, BAR_Y + 108);
    ctx.fillText('Wellness Valley', W * 0.65, BAR_Y + 108);
    ctx.textAlign = 'left';

    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('toBlob returned null'));
    }, 'image/png');
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
// MAP AUTO-FIT — re-centers/zooms to fit all path points whenever they change.
// Must live inside <MapContainer> so useMap() can access the Leaflet instance.
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// MAP FIT TO SHARE — called on demand to fit all points before screenshot
// ─────────────────────────────────────────────────────────────────────────────
const MapFitToShare = ({ points, triggerFit, onFitDone }) => {
  const map = useMap();
  useEffect(() => {
    if (!triggerFit || !points || points.length < 2) return;
    const bounds = points.map(p => [p.lat, p.lng]);
    map.fitBounds(bounds, { padding: [32, 32], maxZoom: 18, animate: false });
    // Wait one frame for tile re-render, then signal ready
    const t = setTimeout(() => onFitDone?.(), 600);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerFit]);
  return null;
};

const MapAutoFit = ({ points, centerPoint }) => {
  const map = useMap();
  const prevLenRef = useRef(0);
  const indoorCenteredRef = useRef(false); // center indoor map only once per mount
  useEffect(() => {
    if (points && points.length >= 2) {
      // Outdoor route active — reset indoor flag so it re-centers if user goes back indoors later
      indoorCenteredRef.current = false;
      const latest = points[points.length - 1];
      const isNewPoint = points.length > prevLenRef.current;
      prevLenRef.current = points.length;

      if (points.length === 2) {
        // First two points — fit bounds so both are visible
        map.fitBounds(points.map(p => [p.lat, p.lng]), { padding: [40, 40], maxZoom: 18 });
      } else if (isNewPoint) {
        // Subsequent points — smoothly pan to latest, keep current zoom (street level)
        map.flyTo([latest.lat, latest.lng], Math.max(map.getZoom(), 17), {
          animate: true,
          duration: 0.8,
        });
      }
    } else if (centerPoint && !indoorCenteredRef.current) {
      // Indoor: center map only once on the first GPS fix (avoids jitter every 5 s)
      map.setView([centerPoint.lat, centerPoint.lng], 17);
      indoorCenteredRef.current = true;
      prevLenRef.current = 0;
    }
  }, [map, points, centerPoint]);
  return null;
};

/**
 * Main Step Counter Component
 */
const StepCounter = ({ onBack, userId, userRole = 'user', user }) => {
  const isNativePlatform = Capacitor.isNativePlatform();
  const isCoach = userRole === 'coach' || userRole === 'coCoach' || userRole === 'admin' || userRole === 'developer';

  // ── UI State (display-only; mutated via setters, never read by callbacks) ──
  const [ready, setReady]                   = useState(false);
  const [loading, setLoading]               = useState(true);
  const [sensorAvailable, setSensorAvailable] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [todaySteps, setTodaySteps]         = useState(0);
  const [todayCalories, setTodayCalories]   = useState(0);
  const [lastUpdated, setLastUpdated]       = useState(null);
  const [error, setError]                   = useState(null);
  const [dailyHistory, setDailyHistory]     = useState([]);
  const [saving, setSaving]                 = useState(false);
  const [lastSaved, setLastSaved]           = useState(() => {
    // Restore last save time from localStorage so it's visible on reopen.
    const stored = localStorage.getItem('step_last_saved_time');
    return stored ? new Date(Number(stored)) : null;
  });
  const [historyView, setHistoryView]       = useState('week');
  const [refreshing, setRefreshing]         = useState(false); // manual refresh button
  const [refreshDone, setRefreshDone]       = useState(false); // brief "✓" toast after refresh
  // null = no problem; string = server date (e.g. "2026-03-27") that differs from device date
  const [wrongDateWarning, setWrongDateWarning] = useState(null);
  // Ref mirror — Effect closures (unmount, pause) can't read state directly
  const wrongDateWarningRef = useRef(null);
  useEffect(() => { wrongDateWarningRef.current = wrongDateWarning; }, [wrongDateWarning]);

  // ── GPS Map State ──────────────────────────────────────────────
  const [showMap, setShowMap]           = useState(false);
  const [pathPoints, setPathPoints]     = useState([]); // [{lat, lng}, ...]
  const [gpsPermission, setGpsPermission] = useState('unknown'); // 'unknown'|'granted'|'denied'
  // Last known GPS position (updated even when indoor — used to show map without a route)
  const [lastGpsPos, setLastGpsPos]     = useState(null); // {lat, lng, isOutdoor}
  // Anti-fake activity warning: null | 'high_step_rate' | 'vehicle_detected'
  const [suspiciousActivity, setSuspiciousActivity] = useState(null);
  // Share flow: when true, MapFitToShare fits map to bounds, then share capture fires
  const [shareFitTrigger, setShareFitTrigger] = useState(false);
  const shareFitResolverRef = useRef(null); // resolves the promise after fit+tiles ready
  const gpsLastTsRef                   = useRef(0);    // dedup: skip duplicate GPS reads
  const gpsIntervalRef                 = useRef(null); // GPS poll interval handle
  const mapCardRef                     = useRef(null); // ref to the map card for screenshot
  const mapDivRef                      = useRef(null); // ref to the inner map div (for share capture)
  const routeDateRef                   = useRef(toDateKey());
  const gpsSmoothedRef                 = useRef(null); // EMA smoothed {lat,lng} for clean route line
  const stepRateWindowRef              = useRef([]);   // anti-fake: [{steps, ts}] ring buffer
  const suspiciousActivityRef          = useRef(null); // ref mirror of suspiciousActivity state

  // ── Pro Anti-Cheat Engine refs ─────────────────────────────────────────────
  const acScoreRef              = useRef(0);    // cumulative cheat score (0–100)
  const acEventTimesRef         = useRef([]);   // timestamps of each sensor stepUpdate event
  const acLastGpsMovedRef       = useRef(true); // did GPS report movement in the last window?
  const acQuarantinedStepsRef   = useRef(0);    // steps withheld from DB due to cheat flag
  const acSustainedStartRef     = useRef(null); // timestamp when high-rate started (Layer 3)
  const acLastCleanWindowRef    = useRef(0);    // timestamp of last clean (decay) window

  // ── Outdoor steps tracking ─────────────────────────────────────────────────
  // Counts steps taken only while GPS confirms outdoor (accuracy < threshold).
  // Technique: record todaySteps when isOutdoor flips true ("session start"),
  // then add the delta when isOutdoor flips false or on day rollover.
  const [outdoorSteps, setOutdoorSteps]         = useState(0);
  const outdoorStepsRef                         = useRef(0);   // accumulated outdoor steps
  const outdoorSessionStartStepsRef             = useRef(null); // todaySteps when went outdoor (null = indoor)
  const outdoorLastIsOutdoorRef                 = useRef(false); // previous isOutdoor state


  // ── Viewing other member (coaches only) ───────────────────────────────────
  const [selectedMember, setSelectedMember] = useState(null);
  const [memberData, setMemberData]         = useState({ steps: 0, calories: 0, history: [], loading: false });

  // Resolve the real DB userId with multi-source fallback
  const [resolvedUserId, setResolvedUserId] = useState(() => {
    if (userId) return userId;
    const stored = localStorage.getItem('dbUserId');
    return stored ? Number(stored) : null;
  });

  // ── Refs: always-current mirrors / stable handles ──────────────────────────
  //
  // FIX (core): All mutable values that callbacks (save, poll, cleanup) need are
  // mirrored into refs. This means those callbacks can have stable references
  // (no state in their dep arrays), which stops the chain reaction where every
  // step increments todaySteps → recreates saveStepsToDatabase → recreates
  // setupAutoSave → re-runs the main useEffect → tears down and rebuilds the
  // sensor listener and poll on EVERY step.
  //
  const todayStepsRef        = useRef(0);    // mirror of todaySteps state
  const todayCaloriesRef     = useRef(0);    // mirror of todayCalories state
  const resolvedUserIdRef    = useRef(null); // mirror of resolvedUserId state
  const latestSensorTotalRef = useRef(null); // raw cumulative sensor total
  const lastUIUpdateRef      = useRef(0);    // throttle: timestamp of last setState
  const lastSavedStepsRef    = useRef(null); // dedup: prevents redundant DB writes
  const lastAutoSaveTimeRef   = useRef(0);   // throttle: timestamp of last auto-save
  // DB offset: today's steps already saved in DB before this session opened.
  // Added on top of sensor-based steps so the counter continues from where it
  // left off rather than resetting to 0 on every fresh app open.
  const dbOffsetRef            = useRef(0);
  // Guard: block UI updates until DB offset is fetched.
  // Prevents showing a wrong (sensor-only) value before DB data arrives.
  const dbOffsetLoadedRef      = useRef(false);
  // Tracks the date string of the last processed sensor event.
  // Used to detect midnight rollovers when the app spans across days.
  const currentDateRef         = useRef(toDateKey());

  // Timer and listener handles
  const sensorListenerRef  = useRef(null);
  const pollIntervalRef    = useRef(null);
  const autoSaveTimerRef   = useRef(null);
  const midnightTimerRef   = useRef(null);
  const resolveIntervalRef = useRef(null);
  const lastPushTimestampRef = useRef(0);  // track last push event time — used to skip redundant polls
  const lastResumeTimeRef    = useRef(0);  // debounce double-resume (Capacitor 'resume' + window 'focus')
  const driftDetectedRef     = useRef(false); // silent flag: true when device date/time likely changed manually

  // Stable function refs — intervals/cleanup always call the LATEST function
  // version without needing it in their dependency arrays.
  const saveStepsToDatabaseRef  = useRef(null);
  const processSensorValueRef   = useRef(null);
  const loadDailyHistoryRef     = useRef(null);
  const runAntiCheatEngineRef   = useRef(null);

  // Sync value mirrors on every render (synchronous, before effects run)
  resolvedUserIdRef.current = resolvedUserId;

  // Keep "DB saved" label aligned with backend timestamps (foreground or background writes).
  const syncLastSavedFromEntry = useCallback((entry) => {
    const ts = entry?.savedAt || entry?.updatedAt || entry?.createdAt || null;
    if (!ts) return;
    const dt = new Date(ts);
    if (Number.isNaN(dt.getTime())) return;
    localStorage.setItem('step_last_saved_time', String(dt.getTime()));
    setLastSaved(dt);
  }, []);

  // Silent detection only (no UI warning): if time moves back or date jumps too far
  // in a very short elapsed real-time window, treat it as manual date/time change.
  const detectSilentTimeDrift = useCallback(() => {
    try {
      const nowMs = Date.now();
      const nowDate = toDateKey();
      const previousTsRaw = localStorage.getItem(STEP_TIME_GUARD_LAST_TS_KEY);
      const previousDate = localStorage.getItem(STEP_TIME_GUARD_LAST_DATE_KEY);
      const previousTs = previousTsRaw ? Number(previousTsRaw) : null;

      let drift = false;

      if (Number.isFinite(previousTs)) {
        if (nowMs + STEP_TIME_DRIFT_BACK_MS < previousTs) {
          drift = true;
        } else if (previousDate && nowMs >= previousTs) {
          const elapsedMs = nowMs - previousTs;
          const prevDateObj = new Date(previousDate);
          const nowDateObj = new Date(nowDate);
          if (!Number.isNaN(prevDateObj.getTime()) && !Number.isNaN(nowDateObj.getTime())) {
            const dayJump = Math.round((nowDateObj.getTime() - prevDateObj.getTime()) / (24 * 60 * 60 * 1000));
            if ((dayJump > 1 && elapsedMs < STEP_TIME_JUMP_WINDOW_MS) || dayJump < 0) {
              drift = true;
            }
          }
        }
      }

      driftDetectedRef.current = drift;
      localStorage.setItem(STEP_TIME_GUARD_LAST_TS_KEY, String(nowMs));
      localStorage.setItem(STEP_TIME_GUARD_LAST_DATE_KEY, nowDate);
    } catch (e) {
      console.warn('[StepCounter] Silent time drift check failed:', e.message);
    }
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // SERVER DATE CHECK — detects manual device date/time manipulation
  // Compares server's current date (IST) against the device's local date.
  // Sets wrongDateWarning to the server date if they don't match.
  // ─────────────────────────────────────────────────────────────────────────
  const checkDeviceDateVsServer = useCallback(async () => {
    try {
      const baseURL = process.env.REACT_APP_API_BASE_URL || '';
      const resp = await fetch(`${baseURL}/api/server-time`, { cache: 'no-store' });
      if (!resp.ok) return; // silently ignore network failures
      const data = await resp.json();
      const serverDate = data?.date;  // "YYYY-MM-DD" in IST
      const deviceDate = toDateKey(); // "YYYY-MM-DD" from device clock
      if (serverDate && serverDate !== deviceDate) {
        console.warn(`⚠️ [StepCounter] Device date mismatch: device=${deviceDate} server=${serverDate}`);
        setWrongDateWarning(serverDate);
      } else {
        setWrongDateWarning(null);
      }
    } catch (e) {
      // Network error or offline — do nothing, don't show false warning
      console.warn('[StepCounter] Server date check failed (offline?):', e.message);
    }
  }, []);

  useEffect(() => {
    detectSilentTimeDrift();
    // Run server-date check on mount and every SERVER_DATE_CHECK_INTERVAL_MS
    checkDeviceDateVsServer();
    const timer = setInterval(checkDeviceDateVsServer, SERVER_DATE_CHECK_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [detectSilentTimeDrift, checkDeviceDateVsServer]);

  // ─────────────────────────────────────────────────────────────────────────
  // USER-ID RESOLUTION (multi-source fallback: prop → localStorage → API)
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (resolvedUserId) return; // already resolved

    let cancelled = false;

    const tryResolve = async () => {
      if (userId) {
        if (!cancelled) setResolvedUserId(userId);
        return true;
      }
      const stored = localStorage.getItem('dbUserId');
      if (stored) {
        console.log('✅ [StepCounter] userId from localStorage:', stored);
        if (!cancelled) setResolvedUserId(Number(stored));
        return true;
      }
      const email = localStorage.getItem('userEmail');
      if (email) {
        try {
          const apiBaseUrl = process.env.REACT_APP_API_BASE_URL;
          const res  = await fetch(`${apiBaseUrl}/api/lookup-user-id`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
          });
          const data = await res.json();
          if (data.success && data.userId) {
            console.log('✅ [StepCounter] userId from API fallback:', data.userId);
            localStorage.setItem('dbUserId', String(data.userId));
            if (!cancelled) setResolvedUserId(data.userId);
            return true;
          }
        } catch (e) {
          console.warn('[StepCounter] userId API fallback failed:', e.message);
        }
      }
      return false;
    };

    // Try immediately, then poll every 1 s for up to 30 s
    tryResolve().then(resolved => {
      if (resolved || cancelled) return;
      let attempts = 0;
      const interval = setInterval(() => {
        attempts++;
        tryResolve().then(ok => {
          if (ok || attempts >= 30) clearInterval(interval);
        });
      }, 1000);
      resolveIntervalRef.current = interval;
    });

    return () => {
      cancelled = true;
      if (resolveIntervalRef.current) {
        clearInterval(resolveIntervalRef.current);
        resolveIntervalRef.current = null;
      }
    };
  }, [userId, resolvedUserId]);

  // ─────────────────────────────────────────────────────────────────────────
  // SENSOR VALUE PROCESSOR
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * FIX 1: No DB floor logic.
   *   Old code: dailySteps = Math.max(sensorSteps, dbStepsFloor)
   *   This caused the counter to freeze whenever dbStepsFloor > sensorSteps
   *   (e.g. after a reboot, reinstall, or when the auto-save failed to run).
   *
   *   New code: dailySteps = sensor − baseline  (pure, always live)
   *   If the sensor resets below the stored baseline, we detect it and update
   *   the baseline, so the counter starts fresh from 0 for that session.
   *
   * FIX 2: Writes to refs BEFORE calling setState.
   *   This guarantees that any callback running concurrently (save, poll,
   *   cleanup) reads the correct current value even if React hasn't re-rendered.
   */

  // ─────────────────────────────────────────────────────────────────────────
  // PRO ANTI-CHEAT ENGINE
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * Called on every sensor event BEFORE updating step counts.
   * Returns { score, shouldBlock, shouldWarn, reason }
   *
   * Scoring layers (additive):
   *   L1 — burst:       +50  if > AC_BURST_MAX_STEPS in AC_BURST_WINDOW_MS
   *   L2 — variance:    +35  if inter-event timing is unnaturally uniform
   *   L3 — sustained:   +30  if high rate held for > AC_SUSTAINED_RATE_SECS
   *   L4 — GPS contra:  +25  if fast steps but GPS shows no movement
   *   Decay:            −AC_SCORE_DECAY_PER_CLEAN per clean window
   *
   * Does NOT block saves on its own — `processSensorValue` consults the score
   * to decide whether to quarantine the new steps.
   */
  const runAntiCheatEngine = useCallback((newDailySteps) => {
    const now = Date.now();

    // ── Record this event timestamp (for variance + burst analysis) ─────────
    acEventTimesRef.current.push(now);
    // Keep only events within the last 30 s (largest window we analyse)
    acEventTimesRef.current = acEventTimesRef.current.filter(t => now - t <= 30_000);

    let scoreDelta = 0;
    const reasons  = [];

    // ── Layer 1: Burst detection ─────────────────────────────────────────────
    // Count sensor events in the last AC_BURST_WINDOW_MS (10 s).
    // Each sensor event = 1 step update from Android hardware pedometer.
    // Normal walking: ~1–2 events/sec. Phone shaking: 5–10+ events/sec.
    const burstEvents = acEventTimesRef.current.filter(t => now - t <= AC_BURST_WINDOW_MS);
    if (burstEvents.length > AC_BURST_MAX_STEPS) {
      scoreDelta += 50;
      reasons.push(`burst:${burstEvents.length}events/10s`);
    }

    // ── Layer 2: Timing variance signature ───────────────────────────────────
    // Real walking produces steps with natural rhythm variance (stride-to-stride).
    // Shaking a phone produces unnaturally regular or irregular ultra-fast bursts.
    // We measure the variance of inter-event gaps in the last AC_VARIANCE_WINDOW events.
    if (acEventTimesRef.current.length >= AC_VARIANCE_WINDOW) {
      const recent = acEventTimesRef.current.slice(-AC_VARIANCE_WINDOW);
      const gaps   = [];
      for (let i = 1; i < recent.length; i++) {
        gaps.push((recent[i] - recent[i - 1]) / 1000); // gap in seconds
      }
      const meanGap = gaps.reduce((s, g) => s + g, 0) / gaps.length;
      const variance = gaps.reduce((s, g) => s + (g - meanGap) ** 2, 0) / gaps.length;
      // If mean gap < 0.25 s (> 240 steps/min) AND variance is very low (robotic) = fake
      if (meanGap < 0.25 && variance < AC_VARIANCE_MIN_REAL_WALK) {
        scoreDelta += 35;
        reasons.push(`variance:${variance.toFixed(3)},gap:${meanGap.toFixed(2)}s`);
      }
      // If mean gap < 0.20 s (> 300 steps/min) regardless of variance = impossible
      if (meanGap < 0.20) {
        scoreDelta += 35;
        reasons.push(`impossible_rate:${(60 / meanGap).toFixed(0)}spm`);
      }
    }

    // ── Layer 3: Sustained impossible rate ───────────────────────────────────
    // If steps-per-minute has been above AC_SUSTAINED_RATE_SPM for at least
    // AC_SUSTAINED_RATE_SECS, it cannot be real exercise.
    const window30 = acEventTimesRef.current.filter(t => now - t <= 30_000);
    if (window30.length >= 4) {
      const spanSec = (now - window30[0]) / 1000;
      const spm30   = spanSec > 3 ? (window30.length / spanSec) * 60 : 0;
      if (spm30 >= AC_SUSTAINED_RATE_SPM) {
        if (!acSustainedStartRef.current) acSustainedStartRef.current = now;
        const sustainedSec = (now - acSustainedStartRef.current) / 1000;
        if (sustainedSec >= AC_SUSTAINED_RATE_SECS) {
          scoreDelta += 30;
          reasons.push(`sustained:${spm30.toFixed(0)}spm_for_${sustainedSec.toFixed(0)}s`);
        }
      } else {
        acSustainedStartRef.current = null; // reset when rate drops
      }
    }

    // ── Layer 4: GPS contradiction ────────────────────────────────────────────
    // If GPS reports the user is stationary but steps are accumulating fast,
    // the steps are likely fake (phone shaking while sitting still).
    // acLastGpsMovedRef is set by processPosition in the GPS useEffect.
    const recentBurstSpm = burstEvents.length > 1
      ? (burstEvents.length / (AC_BURST_WINDOW_MS / 1000)) * 60 : 0;
    if (!acLastGpsMovedRef.current && recentBurstSpm > AC_GPS_STATIONARY_FAST_SPM) {
      scoreDelta += 25;
      reasons.push(`gps_stationary+fast:${recentBurstSpm.toFixed(0)}spm`);
    }

    // ── Score decay: clean window reduces suspicion ───────────────────────────
    if (scoreDelta === 0) {
      if (now - acLastCleanWindowRef.current >= AC_BURST_WINDOW_MS) {
        acLastCleanWindowRef.current = now;
        acScoreRef.current = Math.max(0, acScoreRef.current - AC_SCORE_DECAY_PER_CLEAN);
      }
    }

    // Apply new delta (capped 0–100)
    acScoreRef.current = Math.min(100, Math.max(0, acScoreRef.current + scoreDelta));

    const score       = acScoreRef.current;
    const shouldBlock = score >= AC_SCORE_BLOCK_THRESHOLD;
    const shouldWarn  = score >= AC_SCORE_WARN_THRESHOLD;

    if (reasons.length > 0) {
      console.warn(`⚠️ [AntiCheat] score=${score} delta=+${scoreDelta} reasons=[${reasons.join(', ')}]`);
    }

    return { score, shouldBlock, shouldWarn, reasons };
  }, []); // Stable — reads/writes only refs

  const processSensorValue = useCallback((totalSteps) => {
    if (!Number.isFinite(totalSteps)) {
      console.warn('⚠️ [StepCounter] Invalid sensor value:', totalSteps);
      return;
    }

    const todayKey = toDateKey();

    // ── Midnight / day-rollover detection ────────────────────────────────────
    // Handles the case where the app is open (or resumed) across midnight and
    // the midnight timer never fired (background kill, Doze, etc.).
    if (todayKey !== currentDateRef.current) {
      console.log('🌙 [StepCounter] Day rollover detected:', currentDateRef.current, '→', todayKey);
      currentDateRef.current    = todayKey;
      dbOffsetRef.current       = 0;
      dbOffsetLoadedRef.current = true;  // new day = 0 DB offset, safe to show
      lastSavedStepsRef.current = null;
      todayStepsRef.current     = 0;
      todayCaloriesRef.current  = 0;
      setTodaySteps(0);
      setTodayCalories(0);
    }
    // ─────────────────────────────────────────────────────────────────────────

    let baseline = readBaseline(todayKey);

    // First reading of the day → establish baseline
    if (!baseline) {
      writeBaseline(todayKey, totalSteps);
      baseline = { sensorTotal: totalSteps };
      console.log('✅ [StepCounter] Baseline established:', totalSteps);
    }

    // Sensor reset detection: hardware counter was cleared (device reboot / reinstall).
    // totalSteps is now smaller than our stored baseline → update baseline to match.
    if (totalSteps < baseline.sensorTotal) {
      console.log('🔄 [StepCounter] Sensor reset — updating baseline from', baseline.sensorTotal, 'to', totalSteps);
      writeBaseline(todayKey, totalSteps);
      baseline = { sensorTotal: totalSteps };
    }

    // Calculate steps this sensor session (since baseline was set this app open)
    const sensorSteps = Math.max(0, Math.floor(totalSteps - baseline.sensorTotal));
    // Add DB offset: steps already recorded in DB from earlier sessions today.
    // This means when the app opens and sensor starts at 0 relative to baseline,
    // we still display the correct cumulative daily total (e.g. 3311 + new steps).
    const rawDailySteps = dbOffsetRef.current + sensorSteps;

    // ── Pro Anti-Cheat Engine ─────────────────────────────────────────────────
    // Run before committing steps to refs/state/DB.
    // `runAntiCheatEngine` is read from ref so processSensorValue stays stable.
    const acResult = runAntiCheatEngineRef.current?.(rawDailySteps) ?? { score: 0, shouldBlock: false, shouldWarn: false };

    // Steps committed to DB: if blocked, quarantine AC_QUARANTINE_RATIO of new steps.
    // The user still SEES the raw count (hardware sensor is trusted for display),
    // but the DB save uses a reduced value to prevent fake steps inflating history.
    let dailySteps = rawDailySteps;
    if (acResult.shouldBlock) {
      const prevCommitted = (lastSavedStepsRef.current ?? dbOffsetRef.current ?? 0);
      const newRaw        = rawDailySteps - prevCommitted;
      if (newRaw > 0) {
        const allowed          = Math.floor(newRaw * (1 - AC_QUARANTINE_RATIO));
        acQuarantinedStepsRef.current += (newRaw - allowed);
        dailySteps = prevCommitted + allowed;
        console.warn(`🚫 [AntiCheat] Quarantine: +${newRaw} new steps → only +${allowed} committed (score=${acResult.score})`);
      }
    }

    // Update warning state
    const newWarning = acResult.shouldBlock
      ? 'fake_detected'
      : acResult.shouldWarn
      ? 'high_step_rate'
      : (suspiciousActivityRef.current === 'vehicle_detected' ? 'vehicle_detected' : null);
    if (newWarning !== suspiciousActivityRef.current) {
      suspiciousActivityRef.current = newWarning;
      setSuspiciousActivity(newWarning);
    }

    const calories = calcCalories(dailySteps);
    // ─────────────────────────────────────────────────────────────────────────

    // Update refs synchronously FIRST so any concurrent callback sees the latest values
    latestSensorTotalRef.current = totalSteps;
    todayStepsRef.current        = dailySteps;
    todayCaloriesRef.current     = calories;

    // Hold UI update until DB offset is loaded — avoids showing a wrong value
    // on first open while the DB fetch is still in-flight.
    if (!dbOffsetLoadedRef.current) return;

    // ── Auto-save trigger: save whenever steps increase by ≥ 10 ─────────────
    // Runs synchronously in the sensor callback — saveStepsToDatabase has its
    // own 30-second throttle so this never causes a burst of DB writes.
    saveStepsToDatabaseRef.current?.();

    // Throttle React state updates to at most once per UPDATE_THROTTLE_MS
    const now = Date.now();
    if (now - lastUIUpdateRef.current >= UPDATE_THROTTLE_MS || lastUIUpdateRef.current === 0) {
      lastUIUpdateRef.current = now;
      setTodaySteps(dailySteps);
      setTodayCalories(calories);
      setLastUpdated(new Date());
      setLoading(false);
    }

    console.log('🚶 [StepCounter]', { dailySteps, calories, totalSteps, baseline: baseline.sensorTotal });
  }, []); // Stable — reads/writes only refs and localStorage, no state deps

  // ─────────────────────────────────────────────────────────────────────────
  // DATABASE: SAVE
  // ─────────────────────────────────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────
  // DATABASE: AUTO-SAVE STEPS
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * Called by the 30-second timer AND by processSensorValue when steps increase
   * by ≥ AUTO_SAVE_STEP_DELTA (10).
   * Rules:
   *   - Only saves when steps actually increased by ≥ 10 since last save
   *   - Throttled: at most once per 30 s (prevents burst on fast walks)
   *   - forceWrite: false → backend Math.max guard keeps DB from ever going down
   */
  const saveStepsToDatabase = useCallback(async () => {
    const userId = resolvedUserIdRef.current;
    if (!userId) return;
    const steps = todayStepsRef.current;
    if (steps <= 0) return;
    // Block saves when the device clock has been manually set to a wrong date.
    // Background service continues independently and is protected by Math.max.
    if (wrongDateWarningRef.current) {
      console.warn('⚠️ [StepCounter] Auto-save blocked — device date mismatch (device ≠', wrongDateWarningRef.current, ')');
      return;
    }

    const lastSaved = lastSavedStepsRef.current ?? 0;
    const delta     = steps - lastSaved;
    if (delta < AUTO_SAVE_STEP_DELTA) return; // not enough new steps yet

    const now = Date.now();
    if (now - lastAutoSaveTimeRef.current < AUTO_SAVE_INTERVAL_MS) return; // throttle

    lastAutoSaveTimeRef.current = now;
    lastSavedStepsRef.current   = steps; // optimistic update to prevent duplicate saves

    try {
      const todayKey = toDateKey();
      await saveDailyActivity({
        userId,
        activityDate:   todayKey,
        steps,
        activityType:   ACTIVITY_TYPE,
        caloriesBurned: calcCalories(steps),
        forceWrite:     false // Math.max in API — DB never decreases
      });
      // Keep reopen baseline math aligned with the last successful foreground save.
      const sensorAtSave = latestSensorTotalRef.current;
      if (Number.isFinite(sensorAtSave)) {
        localStorage.setItem(getSaveSensorKey(todayKey), String(sensorAtSave));
      }
      console.log('💾 [StepCounter] Auto-save:', steps, 'steps (+' + delta + ')');
    } catch (err) {
      // Roll back optimistic update so next tick retries
      lastSavedStepsRef.current = lastSaved;
      console.warn('⚠️ [StepCounter] Auto-save failed:', err?.message || err);
    }
  }, []); // Stable — reads only refs

  // ─────────────────────────────────────────────────────────────────────────
  // DATABASE: FETCH HISTORY
  // ─────────────────────────────────────────────────────────────────────────
  const loadDailyHistory = useCallback(async () => {
    const userId = resolvedUserIdRef.current;
    if (!userId) return;
    try {
      // Pass client's local date so history range ends on device's today, not server UTC today.
      const response = await fetchDailyActivity(userId, 30, ACTIVITY_TYPE, toDateKey());
      const trend    = response.trend || response.data;
      if (response.success && Array.isArray(trend)) {
        setDailyHistory(trend.map(d => ({ ...d, calories: d.caloriesBurned ?? d.calories ?? 0 })));
      }
    } catch (err) {
      console.error('❌ [StepCounter] Load history failed:', err);
    }
  }, []); // Stable — reads userId from ref

  // ─────────────────────────────────────────────────────────────────────────
  // MEMBER DATA FETCH (coaches viewing a team member)
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedMember || selectedMember.isSelf) {
      setMemberData({ steps: 0, calories: 0, history: [], loading: false });
      return;
    }
    const memberId = selectedMember.id || selectedMember.userId;
    setMemberData(prev => ({ ...prev, loading: true }));
    Promise.all([
      fetchDailyActivity(memberId, 1, ACTIVITY_TYPE, toDateKey()),
      fetchDailyActivity(memberId, 30, ACTIVITY_TYPE, toDateKey()),
    ]).then(([todayRes, histRes]) => {
      const todayTrend  = todayRes.trend || todayRes.data || [];
      const todayEntry  = todayTrend.find(d => d.date === toDateKey());
      const steps       = todayEntry?.steps || 0;
      const calories    = todayEntry?.caloriesBurned ?? todayEntry?.calories ?? calcCalories(steps);
      const histTrend   = histRes.trend || histRes.data || [];
      const history     = histTrend.map(d => ({ ...d, calories: d.caloriesBurned ?? d.calories ?? 0 }));
      setMemberData({ steps, calories, history, loading: false });
    }).catch(err => {
      console.error('[StepCounter] Failed to load member data:', err);
      setMemberData({ steps: 0, calories: 0, history: [], loading: false });
    });
  }, [selectedMember]);

  // ─────────────────────────────────────────────────────────────────────────
  // MANUAL REFRESH (Requirement 6)
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * Fallback for when Android Doze or background throttle delays sensor events.
   * User taps the refresh icon in the header to force an immediate sensor read.
   */
  const handleManualRefresh = useCallback(async () => {
    setRefreshing(true);
    setRefreshDone(false);
    if (!isNativePlatform) {
      // Web: just re-fetch DB history
      try {
        await loadDailyHistoryRef.current?.();
      } catch (err) {
        console.warn('[StepCounter] Web refresh failed:', err?.message || err);
      } finally {
        setRefreshing(false);
        setRefreshDone(true);
        setTimeout(() => setRefreshDone(false), 1500);
      }
      return;
    }
    try {
      const current = await StepCounterPlugin.getCurrentStepCount();
      const val     = Number.parseInt(current?.totalSteps, 10);
      if (Number.isFinite(val)) {
        // Re-anchor only when silent drift detection says date/time was likely changed.
        if (driftDetectedRef.current && resolvedUserIdRef.current) {
          try {
            const todayKey = toDateKey();
            const response = await fetchDailyActivity(resolvedUserIdRef.current, 1, ACTIVITY_TYPE, todayKey);
            const trend = response?.trend || response?.data || [];
            const todayEntry = trend.find((d) => d.date === todayKey);
            const dbSteps = todayEntry?.steps || 0;
            syncLastSavedFromEntry(todayEntry);

            dbOffsetRef.current = dbSteps;
            dbOffsetLoadedRef.current = true;
            lastSavedStepsRef.current = dbSteps;
            currentDateRef.current = todayKey;

            // Re-anchor today's baseline to current sensor value.
            writeBaseline(todayKey, val);
            localStorage.setItem(getSaveSensorKey(todayKey), String(val));

            todayStepsRef.current = dbSteps;
            todayCaloriesRef.current = calcCalories(dbSteps);
            setTodaySteps(dbSteps);
            setTodayCalories(calcCalories(dbSteps));
            driftDetectedRef.current = false;
          } catch (syncErr) {
            console.warn('[StepCounter] Refresh re-sync failed, continuing normal refresh:', syncErr?.message || syncErr);
          }
        }

        processSensorValueRef.current?.(val);

        // ── Direct DB save from in-app step count ─────────────────────────
        // Blocked when device date is wrong — saving under a wrong date key
        // would corrupt history. Background service is the safety net.
        if (wrongDateWarningRef.current) {
          console.warn('⚠️ [StepCounter] Refresh DB save blocked — device date mismatch (device ≠', wrongDateWarningRef.current, ')');
        } else {
          const stepsToSave = todayStepsRef.current;
          if (resolvedUserIdRef.current && stepsToSave > 0) {
            try {
              const todayKey = toDateKey();
              await saveDailyActivity({
                userId:        resolvedUserIdRef.current,
                activityDate:  todayKey,
                steps:         stepsToSave,
                activityType:  ACTIVITY_TYPE,
                caloriesBurned: calcCalories(stepsToSave),
                forceWrite:    false   // Math.max in API — DB never decreases
              });
              console.log('💾 [StepCounter] Refresh direct save:', stepsToSave, 'steps');
            } catch (saveErr) {
              console.warn('[StepCounter] Refresh direct save failed:', saveErr?.message || saveErr);
            }
          }
          // Ask service (single writer) to also flush its SharedPreferences value.
          await GalleryMonitorPlugin.forceSaveTodaySteps();
        }
        // Brief pause to let the service's network call complete, then re-sync
        // the DB offset so the display reflects exactly what was just saved.
        await new Promise((r) => setTimeout(r, 1200));
        if (resolvedUserIdRef.current) {
          try {
            const todayKey   = toDateKey();
            const freshResp  = await fetchDailyActivity(resolvedUserIdRef.current, 1, ACTIVITY_TYPE, todayKey);
            const freshTrend = freshResp?.trend || freshResp?.data || [];
            const freshEntry = freshTrend.find((d) => d.date === todayKey);
            if (freshEntry?.steps > 0) {
              dbOffsetRef.current       = freshEntry.steps;
              lastSavedStepsRef.current = freshEntry.steps;
              syncLastSavedFromEntry(freshEntry);
              // Re-anchor baseline to current sensor value so future deltas
              // add on top of the freshly-confirmed DB total.
              writeBaseline(todayKey, val);
              localStorage.setItem(getSaveSensorKey(todayKey), String(val));
              processSensorValueRef.current?.(val);
              console.log('🔄 [StepCounter] DB offset synced after refresh:', freshEntry.steps);
            }
          } catch (syncErr) {
            console.warn('[StepCounter] Post-refresh DB sync failed:', syncErr?.message || syncErr);
          }
        }
        await loadDailyHistoryRef.current?.();
        console.log('🔄 [StepCounter] Manual refresh complete — sensor total:', val);
      }
    } catch (err) {
      console.error('❌ [StepCounter] Manual refresh failed:', err);
    } finally {
      setRefreshing(false);
      // Show a brief "Done" indicator for 1.5 s so the user sees feedback
      setRefreshDone(true);
      setTimeout(() => setRefreshDone(false), 1500);
    }
  }, [isNativePlatform, syncLastSavedFromEntry]);

  // ─────────────────────────────────────────────────────────────────────────
  // SENSOR INITIALIZATION
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * FIX 4: Uses processSensorValueRef.current inside the listener and poll
   * callbacks instead of capturing processSensorValue directly (which would
   * create a dependency chain). With this pattern:
   *   - initStepTracking has NO state deps → it is stable (deps: [])
   *   - The listener and poll always call the latest processSensorValue via ref
   *   - Re-calling initStepTracking (e.g. after permission grant) safely
   *     removes the old listener before adding a new one
   */
  const initStepTracking = useCallback(async () => {
    console.log('🔧 [StepCounter] Initializing step tracking...');
    try {
      const availability = await StepCounterPlugin.isAvailable();
      const available    = !!availability?.available;
      setSensorAvailable(available);

      if (!available) {
        setPermissionGranted(false);
        setLoading(false);
        return;
      }

      const permission = await StepCounterPlugin.getPermissionStatus();
      const granted    = !!permission?.granted;
      setPermissionGranted(granted);

      if (!granted) {
        setLoading(false);
        return;
      }

      await StepCounterPlugin.startTracking();

      // Remove any existing listener before attaching a new one
      if (sensorListenerRef.current) {
        await sensorListenerRef.current.remove();
        sensorListenerRef.current = null;
      }

      // Push-based: native sensor fires stepUpdate events when steps change
      sensorListenerRef.current = await StepCounterPlugin.addListener('stepUpdate', (event) => {
        const steps = Number.parseInt(event?.totalSteps, 10);
        if (Number.isFinite(steps)) {
          lastPushTimestampRef.current = Date.now(); // record push time so poll can skip
          processSensorValueRef.current?.(steps);
        } else {
          console.warn('⚠️ [StepCounter] Invalid stepUpdate payload:', event);
        }
      });

      // Seed the UI with the current value immediately on open
      const current      = await StepCounterPlugin.getCurrentStepCount();
      const currentValue = Number.parseInt(current?.totalSteps, 10);
      if (Number.isFinite(currentValue)) {
        processSensorValueRef.current?.(currentValue);
      } else {
        setLoading(false);
      }

      // Safety: ensure loading spinner is cleared after 3 s even if sensor is silent
      setTimeout(() => setLoading(false), 3000);

      // Pull-based fallback: handles Android Doze / background throttle where
      // push events are delayed. Polls every POLL_INTERVAL_MS.
      // Skipped when push events are actively firing to avoid redundant native bridge calls.
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = setInterval(async () => {
        // If a push event fired within the last 2 poll cycles, the sensor is active — skip poll
        if (Date.now() - lastPushTimestampRef.current < POLL_INTERVAL_MS * 2) return;
        try {
          const c = await StepCounterPlugin.getCurrentStepCount();
          const v = Number.parseInt(c?.totalSteps, 10);
          if (Number.isFinite(v)) processSensorValueRef.current?.(v);
        } catch (e) {
          console.warn('⚠️ [StepCounter] Poll failed:', e.message);
        }
      }, POLL_INTERVAL_MS);

      console.log('✅ [StepCounter] Sensor initialized with push + poll fallback');
    } catch (err) {
      console.error('❌ [StepCounter] initStepTracking failed:', err);
      setError('Failed to initialize step counter');
      setLoading(false);
    }
  }, []); // Stable — no state deps; uses processSensorValueRef internally

  // ─────────────────────────────────────────────────────────────────────────
  // PERMISSION REQUEST
  // ─────────────────────────────────────────────────────────────────────────
  const requestPermission = useCallback(async () => {
    try {
      const permission = await StepCounterPlugin.requestPermission();
      const granted    = !!permission?.granted;
      setPermissionGranted(granted);
      if (granted) await initStepTracking();
    } catch (err) {
      console.error('❌ [StepCounter] Permission request failed:', err);
      setError('Failed to get permission');
    }
  }, [initStepTracking]); // initStepTracking is stable

  // ─────────────────────────────────────────────────────────────────────────
  // AUTO-SAVE TIMER
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * Kept only to preserve existing component lifecycle shape.
   * saveStepsToDatabaseRef is a no-op under single-writer architecture.
   */
  const setupAutoSave = useCallback(() => {
    if (autoSaveTimerRef.current) clearInterval(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setInterval(() => {
      saveStepsToDatabaseRef.current?.();
    }, AUTO_SAVE_INTERVAL_MS);
    console.log(`ℹ️ [StepCounter] UI timer started (${AUTO_SAVE_INTERVAL_MS / 1000}s interval)`);
  }, []); // Stable — interval body only references a ref

  // ─────────────────────────────────────────────────────────────────────────
  // MIDNIGHT RESET TIMER
  // ─────────────────────────────────────────────────────────────────────────
  const setupMidnightReset = useCallback(() => {
    const now             = new Date();
    const tomorrow        = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const msUntilMidnight = tomorrow.getTime() - now.getTime();

    if (midnightTimerRef.current) clearTimeout(midnightTimerRef.current);

    midnightTimerRef.current = setTimeout(async () => {
      console.log('🌙 [StepCounter] Midnight reset');

      // Service performs DB save on day rollover; React stays read-only.

      // Write new day's baseline using the last known raw sensor total
      if (latestSensorTotalRef.current !== null) {
        writeBaseline(toDateKey(), latestSensorTotalRef.current);
      }

      // Reset counters for the new day
      todayStepsRef.current     = 0;
      todayCaloriesRef.current  = 0;
      lastSavedStepsRef.current = null;
      dbOffsetRef.current       = 0;
      dbOffsetLoadedRef.current = true;  // new day = 0 offset, sensor steps shown immediately
      currentDateRef.current    = toDateKey();
      setTodaySteps(0);
      setTodayCalories(0);

      // Reload history to include the completed day
      await loadDailyHistoryRef.current?.();

      // Re-schedule for the next midnight
      setupMidnightReset();
    }, msUntilMidnight);

    console.log(`⏰ [StepCounter] Midnight reset scheduled in ${Math.floor(msUntilMidnight / 60000)} min`);
  }, []); // Stable — uses only refs and reschedules itself

  // ─────────────────────────────────────────────────────────────────────────
  // SYNC FUNCTION REFS (runs synchronously on every render, before effects)
  // ─────────────────────────────────────────────────────────────────────────
  // This ensures that intervals, listeners, and cleanup closures always invoke
  // the most up-to-date version of each callback, even if the reference changed.
  saveStepsToDatabaseRef.current = saveStepsToDatabase;
  processSensorValueRef.current  = processSensorValue;
  loadDailyHistoryRef.current    = loadDailyHistory;
  runAntiCheatEngineRef.current  = runAntiCheatEngine;

  // ─────────────────────────────────────────────────────────────────────────
  // EFFECT 1: SENSOR LIFECYCLE — runs ONCE on mount / cleans up on unmount
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * FIX 6 (root cause): Empty deps array.
   *   Old code had todaySteps and saveStepsToDatabase in the dep array.
   *   Every step update → todaySteps changed → saveStepsToDatabase recreated →
   *   setupAutoSave recreated → this effect re-ran → sensor listener torn down
   *   and rebuilt → counter appeared stuck mid-walk during the re-init window.
   *
   *   All callbacks called here are stable (deps: []) so listing them in deps
   *   would be equivalent to []. We use [] explicitly and suppress the lint
   *   warning to make the intent clear.
   */
  useEffect(() => {
    // Cleanup localStorage keys older than 7 days to prevent unbounded accumulation.
    // Runs once on mount — safe to do synchronously since localStorage access is cheap.
    const cleanupOldKeys = () => {
      const now = Date.now();
      const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        const match = key.match(/^step_(?:counter_baseline|save_sensor)_(\d{4}-\d{2}-\d{2})$/);
        if (match) {
          const keyDate = new Date(match[1]).getTime();
          if (now - keyDate > SEVEN_DAYS_MS) keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
      if (keysToRemove.length > 0) console.log(`🧹 [StepCounter] Cleaned up ${keysToRemove.length} old localStorage key(s)`);
    };
    cleanupOldKeys();

    if (isNativePlatform) {
      initStepTracking();
    } else {
      setLoading(false);
    }
    setupMidnightReset();
    setReady(true);

    return () => {
      // ── Save steps before teardown (user navigates away / back press) ─────
      // Blocked when device date is wrong — background service is the safety net.
      const stepsOnClose = todayStepsRef.current;
      const userOnClose  = resolvedUserIdRef.current;
      if (userOnClose && stepsOnClose > 0 && !wrongDateWarningRef.current) {
        const dateOnClose = toDateKey();
        saveDailyActivity({
          userId:         userOnClose,
          activityDate:   dateOnClose,
          steps:          stepsOnClose,
          activityType:   ACTIVITY_TYPE,
          caloriesBurned: calcCalories(stepsOnClose),
          forceWrite:     false
        }).then(() => {
          const sensorAtSave = latestSensorTotalRef.current;
          if (Number.isFinite(sensorAtSave)) {
            localStorage.setItem(getSaveSensorKey(dateOnClose), String(sensorAtSave));
          }
        }).catch(() => {});
        GalleryMonitorPlugin.forceSaveTodaySteps().catch(() => {});
        console.log('💾 [StepCounter] Unmount save:', stepsOnClose, 'steps');
      } else if (wrongDateWarningRef.current) {
        console.warn('⚠️ [StepCounter] Unmount save blocked — device date mismatch');
      }
      // Tear down all timers and the native sensor listener
      if (midnightTimerRef.current)  clearTimeout(midnightTimerRef.current);
      if (autoSaveTimerRef.current)  clearInterval(autoSaveTimerRef.current);
      if (pollIntervalRef.current)   clearInterval(pollIntervalRef.current);
      if (isNativePlatform) {
        StepCounterPlugin.stopTracking().catch(() => {});
        sensorListenerRef.current?.remove().catch(() => {});
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Intentionally empty — sensor lifecycle tied to component mount only

  // ─────────────────────────────────────────────────────────────────────────
  // EFFECT 2: DB + AUTO-SAVE — runs once when userId resolves
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!resolvedUserId) return;

    // Load today's DB steps as the starting offset for this session.
    // This ensures the counter shows the correct cumulative total on fresh
    // app opens instead of starting from 0 each time.
    // Pass client's local date so the backend doesn't use server UTC (fixes
    // the 5.5-hour window each day where IST != UTC date).
    fetchDailyActivity(resolvedUserId, 1, ACTIVITY_TYPE, toDateKey())
      .then((response) => {
        const trend = response.trend || response.data;
        if (response.success && Array.isArray(trend)) {
          const todayKey   = toDateKey();
          const todayEntry = trend.find((d) => d.date === todayKey);
          syncLastSavedFromEntry(todayEntry);
          if (todayEntry && todayEntry.steps > 0) {
            dbOffsetRef.current = todayEntry.steps;
            // Update lastSavedStepsRef so the first auto-save doesn't
            // re-save the same DB value we just loaded.
            lastSavedStepsRef.current = todayEntry.steps;
            console.log('🗄️ [StepCounter] DB offset loaded:', todayEntry.steps);
            // Unlock UI — from this point processSensorValue will update the display
            dbOffsetLoadedRef.current = true;
            if (latestSensorTotalRef.current !== null) {
              const currentSensor  = latestSensorTotalRef.current;
              // After manual date/time changes, show DB value first by anchoring
              // baseline to current sensor (no carry-over). Normal case keeps
              // sensor-at-last-save recovery so same-day reopen remains cumulative.
              let baselineToUse = currentSensor;
              if (!driftDetectedRef.current) {
                const savedSensorStr = localStorage.getItem(getSaveSensorKey(toDateKey()));
                const savedSensor    = savedSensorStr ? Number(savedSensorStr) : null;
                const MAX_UNSAVED = 3_000;
                const unsavedIfTrusted = Math.max(0, currentSensor - (savedSensor ?? currentSensor));
                baselineToUse =
                  (savedSensor !== null &&
                   Number.isFinite(savedSensor) &&
                   savedSensor <= currentSensor &&
                   unsavedIfTrusted <= MAX_UNSAVED)
                    ? savedSensor
                    : currentSensor;
              }
              writeBaseline(toDateKey(), baselineToUse);
              // Reprocess with the corrected baseline
              processSensorValueRef.current?.(currentSensor);
            } else {
              // Sensor hasn't fired yet — seed UI directly from DB
              const offsetCalories = calcCalories(todayEntry.steps);
              todayStepsRef.current    = todayEntry.steps;
              todayCaloriesRef.current = offsetCalories;
              setTodaySteps(todayEntry.steps);
              setTodayCalories(offsetCalories);
              setLoading(false);
            }
          } else {
            // New day or first use — DB has 0 steps (or no entry yet).
            // dbOffset stays 0; just unlock the UI so sensor steps are shown.
            dbOffsetLoadedRef.current = true;
            if (latestSensorTotalRef.current !== null) {
              processSensorValueRef.current?.(latestSensorTotalRef.current);
            } else {
              setLoading(false);
            }
          }
        }
      })
      .catch((err) => {
        console.warn('⚠️ [StepCounter] Failed to load DB offset:', err);
        // DB fetch failed — unlock UI anyway so sensor value is shown
        dbOffsetLoadedRef.current = true;
        if (latestSensorTotalRef.current !== null) {
          processSensorValueRef.current?.(latestSensorTotalRef.current);
        } else {
          setLoading(false);
        }
      });

    loadDailyHistoryRef.current?.();
    setupAutoSave(); // no-op timer under single-writer rule

    // ── Background service backfill + correction ─────────────────────────────
    // GalleryMonitorService records per-day steps in SharedPreferences.
    // On app open we:
    //   (a) Fill any DB days that show 0 steps (app was never opened that day)
    //   (b) Correct any DB days that are inflated beyond what the background
    //       service actually measured — those are corrupted by the old
    //       double-counting bug (multiple sessions pre-fix) and should be reset
    //       to the accurate value from SharedPreferences.
    if (isNativePlatform) {
      StepCounterPlugin.getBackgroundStepHistory(7).then(({ history }) => {
        if (!Array.isArray(history) || history.length === 0) return;
        const bgDays = history.filter(e => e.steps > 0);
        if (bgDays.length === 0) return;

        // Re-fetch DB history to compare against background service values
        fetchDailyActivity(resolvedUserId, 7, ACTIVITY_TYPE, toDateKey())
          .then((dbResponse) => {
            const dbTrend = dbResponse.trend || dbResponse.data || [];
            const dbMap   = new Map(dbTrend.map(d => [d.date, d.steps]));
            const todayKey = toDateKey();

            // Fix days where:
            //   (a) DB has 0 steps — app was never opened that day, OR
            //   (b) Background service recorded MORE steps than DB — app was
            //       opened briefly then kept walking after close.
            //
            // We do NOT update if DB already has a HIGHER value than background
            // service — that means in-app sensor saved more (trust higher DB value).
            // We also never overwrite today's non-zero DB value from background
            // service (today is handled by the live sensor + dbOffset path).
            const MAX_BACKFILL_DELTA = 5000; // kept for today-stale-SharedPrefs checks below
            const toFix = bgDays.filter(e => {
              const dbSteps = dbMap.get(e.date) || 0;
              if (e.steps <= dbSteps) return false;
              // Never overwrite today's non-zero DB value from background service.
              if (e.date === todayKey && dbSteps > 0) return false;
              // For all past days, trust background service unconditionally.
              // Removed the 5 000-step delta cap which was silently dropping full
              // day backfills for users who never opened the app that day.
              return true;
            });

            // ── Stale SharedPreferences correction ─────────────────────────
            // If today's background service value is much larger than DB (and DB
            // has a real value), it means SharedPreferences has phantom/stale data
            // (e.g. from manual date testing). Fix it NOW so the background service
            // stops writing the wrong number to DB every 60 seconds.
            const todayBg  = bgDays.find(e => e.date === todayKey);
            if (todayBg) {
              const todayDb = dbMap.get(todayKey) || 0;
              if (todayDb > 0 && (todayBg.steps - todayDb) > MAX_BACKFILL_DELTA) {
                console.warn('🔧 [StepCounter] Correcting stale bgService baseline for today:',
                  todayBg.steps, '→', todayDb);
                GalleryMonitorPlugin.syncDailySteps(todayKey, todayDb).catch(() => {});
              }

              // NOTE: Auto-sanitize block intentionally removed.
              // On reinstall the cloud DB value is the only surviving source of truth
              // (SharedPreferences is wiped). Lowering DB to match the local counter
              // would permanently destroy the user's real step history.
              // The service catches up to the DB value naturally as new steps are saved.
            }
            // ───────────────────────────────────────────────────────────────

            if (toFix.length === 0) return;

            console.log('🔄 [StepCounter] Fixing', toFix.length, 'day(s) from background service:', toFix);
            // Send sequentially so service-side in-flight guard never drops a day.
            toFix.reduce(
              (chain, e) => chain.then(() => GalleryMonitorPlugin.syncDailySteps(e.date, e.steps)),
              Promise.resolve()
            ).then(() => {
              console.log('✅ [StepCounter] Backfill/correction complete');
              loadDailyHistoryRef.current?.(); // refresh chart

              // ── Critical fix: if TODAY was backfilled, update dbOffset immediately.
              // Without this, the in-app session still thinks dbOffset = 0 and will
              // overwrite the backfilled value on next auto-save (e.g. saves 20 in-app
              // steps instead of the correct 2000 + 20).
              const todayKey = toDateKey();
              const todayBackfill = toFix.find(e => e.date === todayKey);
              if (todayBackfill && todayBackfill.steps > dbOffsetRef.current) {
                console.log('🔄 [StepCounter] Updating dbOffset after today backfill:', dbOffsetRef.current, '→', todayBackfill.steps);
                dbOffsetRef.current       = todayBackfill.steps;
                lastSavedStepsRef.current = todayBackfill.steps;
                // Re-anchor baseline to current sensor so only steps walked AFTER
                // this moment are counted as new (avoids double-counting bg steps).
                if (latestSensorTotalRef.current !== null) {
                  localStorage.setItem(getSaveSensorKey(todayKey), String(latestSensorTotalRef.current));
                  writeBaseline(todayKey, latestSensorTotalRef.current);
                  processSensorValueRef.current?.(latestSensorTotalRef.current);
                } else {
                  // Sensor hasn't fired yet — seed UI directly from backfill value
                  todayStepsRef.current    = todayBackfill.steps;
                  todayCaloriesRef.current = calcCalories(todayBackfill.steps);
                  setTodaySteps(todayBackfill.steps);
                  setTodayCalories(calcCalories(todayBackfill.steps));
                }
              }
            }).catch(err => console.warn('⚠️ [StepCounter] Backfill failed:', err));
          })
          .catch(err => console.warn('⚠️ [StepCounter] Backfill DB fetch failed:', err));
      });
    }
    // ─────────────────────────────────────────────────────────────────────────
  }, [resolvedUserId, setupAutoSave, syncLastSavedFromEntry]); // setupAutoSave is stable (deps: [])

  // ─────────────────────────────────────────────────────────────────────────
  // EFFECT 3: APP RESUME / FOREGROUND HANDLER (Requirement 7)
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isNativePlatform) return;

    const handleResume = async () => {
      detectSilentTimeDrift();
      // Debounce: Capacitor 'resume' and window 'focus' both fire when the app
      // comes to foreground, often within milliseconds. Ignore the second one.
      const now = Date.now();
      if (now - lastResumeTimeRef.current < 2000) return;
      lastResumeTimeRef.current = now;
      console.log('📱 [StepCounter] App resumed — refreshing sensor + re-syncing DB offset');
      try {
        // ── Re-fetch DB offset so this session continues from the latest saved value ──
        // Critical for multiple opens in one day: each open must start from the
        // most recent DB total (which background service may have updated while
        // the app was closed), not the stale value from the first open.
        if (resolvedUserIdRef.current) {
          try {
            const todayKey   = toDateKey();
            const dbResp     = await fetchDailyActivity(resolvedUserIdRef.current, 1, ACTIVITY_TYPE, todayKey);
            const dbTrend    = dbResp?.trend || dbResp?.data || [];
            const dbEntry    = dbTrend.find(d => d.date === todayKey);
            const latestDb   = dbEntry?.steps || 0;
            if (latestDb > dbOffsetRef.current) {
              console.log('🔄 [StepCounter] Resume: DB offset updated', dbOffsetRef.current, '→', latestDb);
              dbOffsetRef.current       = latestDb;
              lastSavedStepsRef.current = latestDb;
              syncLastSavedFromEntry(dbEntry);
              // Re-anchor baseline so new steps add on top of fresh DB value
              const sensor = latestSensorTotalRef.current;
              if (sensor !== null) {
                writeBaseline(todayKey, sensor);
                localStorage.setItem(getSaveSensorKey(todayKey), String(sensor));
              }
            }
          } catch (dbErr) {
            console.warn('[StepCounter] Resume DB sync failed:', dbErr?.message || dbErr);
          }
        }
        const current      = await StepCounterPlugin.getCurrentStepCount();
        const currentValue = Number.parseInt(current?.totalSteps, 10);
        if (Number.isFinite(currentValue)) {
          processSensorValueRef.current?.(currentValue);
        }
        // Re-check device date on every resume (user may have changed date while app was away)
        checkDeviceDateVsServer();
      } catch (err) {
        console.error('❌ [StepCounter] Resume handler failed:', err);
      }
    };

    // ── Save on app pause/background (home button, switch app) ─────────────
    // Blocked when device date is wrong — background service is the safety net.
    const handlePause = () => {
      const steps  = todayStepsRef.current;
      const userId = resolvedUserIdRef.current;
      if (!userId || steps <= 0) return;
      if (wrongDateWarningRef.current) {
        console.warn('⚠️ [StepCounter] Pause save blocked — device date mismatch');
        return;
      }
      const dateOnPause = toDateKey();
      saveDailyActivity({
        userId,
        activityDate:   dateOnPause,
        steps,
        activityType:   ACTIVITY_TYPE,
        caloriesBurned: calcCalories(steps),
        forceWrite:     false
      }).then(() => {
        const sensorAtSave = latestSensorTotalRef.current;
        if (Number.isFinite(sensorAtSave)) {
          localStorage.setItem(getSaveSensorKey(dateOnPause), String(sensorAtSave));
        }
      }).catch(() => {});
      GalleryMonitorPlugin.forceSaveTodaySteps().catch(() => {});
      console.log('💾 [StepCounter] Pause save:', steps, 'steps');
    };

    document.addEventListener('resume', handleResume);
    document.addEventListener('pause',  handlePause);
    window.addEventListener('focus',  handleResume);
    window.addEventListener('blur',   handlePause);
    return () => {
      document.removeEventListener('resume', handleResume);
      document.removeEventListener('pause',  handlePause);
      window.removeEventListener('focus',  handleResume);
      window.removeEventListener('blur',   handlePause);
    };
  }, [isNativePlatform, detectSilentTimeDrift, syncLastSavedFromEntry, checkDeviceDateVsServer]);

  // Load GPS permission + restore today's persisted route on open.
  useEffect(() => {
    let cancelled = false;

    if (Capacitor.isNativePlatform()) {
      Geolocation.checkPermissions()
        .then((perm) => {
          if (cancelled) return;
          const granted = perm?.location === 'granted' || perm?.coarseLocation === 'granted';
          setGpsPermission(granted ? 'granted' : 'denied');
        })
        .catch(() => {
          if (!cancelled) setGpsPermission('denied');
        });
    } else {
      setGpsPermission('granted');
    }

    const todayKey = toDateKey();
    routeDateRef.current = todayKey;
    const restored = readPersistedRoute(todayKey);
    if (restored.length >= 2) {
      setPathPoints(restored);
      setShowMap(true);
      gpsLastTsRef.current = restored[restored.length - 1].timestamp || 0;
    }

    // Restore last known GPS position (supports indoor map display on reopen)
    // Only restore if it was saved today — discard stale positions from a previous day
    try {
      const raw = localStorage.getItem('step_last_gps_pos');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (isValidLatLng(parsed.lat, parsed.lng) && parsed.date === toDateKey()) {
          setLastGpsPos(parsed);
        } else {
          // Stale (different day) — remove it
          localStorage.removeItem('step_last_gps_pos');
        }
      }
    } catch { /* ignore */ }

    return () => { cancelled = true; };
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // GPS TRACKING
  // Primary  : Geolocation.watchPosition — fires on every GPS fix (1–3 s on Android).
  //            This draws the polyline smoothly in real-time as the user walks.
  // Secondary: SharedPrefs poll every 5 s — picks up GPS written by
  //            GalleryMonitorService while the screen was off / app backgrounded.
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      let watchId = null;

      // ── Shared processor (called by both watchPosition and the poll) ────
      // speed: GPS Doppler speed m/s from watchPosition; null = unknown (poll path)
      const processPosition = (lat, lng, accuracy, timestamp, speed = null) => {
        if (!isValidLatLng(lat, lng)) return;

        const todayKey = toDateKey();
        if (routeDateRef.current !== todayKey) {
          const previousDateKey = routeDateRef.current;
          routeDateRef.current = todayKey;
          gpsSmoothedRef.current = null; // reset EMA on day rollover
          // Reset outdoor steps on day rollover
          outdoorStepsRef.current = 0;
          outdoorSessionStartStepsRef.current = null;
          outdoorLastIsOutdoorRef.current = false;
          setOutdoorSteps(0);
          setPathPoints([]);
          setShowMap(false);
          setLastGpsPos(null);
          localStorage.removeItem('step_last_gps_pos');
          if (previousDateKey) localStorage.removeItem(getRouteStorageKey(previousDateKey));
        }

        // watchPosition (speed known): use 25 m threshold — outdoor GPS gives 5–20 m;
        //   indoor GPS rarely drops below 25 m, preventing fake routes when indoors.
        // SharedPrefs poll (speed=null): keep Android's 50 m threshold.
        const outdoorAccuracyThreshold = speed !== null ? 25 : 50;
        const isOutdoor = accuracy < outdoorAccuracyThreshold;

        // ── Outdoor steps: track transitions ────────────────────────────────
        // When GPS flips outdoor→indoor (or indoor→outdoor), compute the delta.
        const wasOutdoor = outdoorLastIsOutdoorRef.current;
        if (!wasOutdoor && isOutdoor) {
          // Just went outdoor — start a new session
          outdoorSessionStartStepsRef.current = todayStepsRef.current;
          outdoorLastIsOutdoorRef.current = true;
        } else if (wasOutdoor && !isOutdoor) {
          // Just went indoor — close the session and add delta
          if (outdoorSessionStartStepsRef.current !== null) {
            const delta = Math.max(0, todayStepsRef.current - outdoorSessionStartStepsRef.current);
            outdoorStepsRef.current += delta;
            setOutdoorSteps(outdoorStepsRef.current);
          }
          outdoorSessionStartStepsRef.current = null;
          outdoorLastIsOutdoorRef.current = false;
        } else if (wasOutdoor && isOutdoor) {
          // Still outdoor — update display with running delta so it ticks up live
          if (outdoorSessionStartStepsRef.current !== null) {
            const liveDelta = Math.max(0, todayStepsRef.current - outdoorSessionStartStepsRef.current);
            setOutdoorSteps(outdoorStepsRef.current + liveDelta);
          }
        }

        const pos = { lat, lng, isOutdoor, accuracy: Math.round(accuracy), speed: speed !== null ? speed : null, date: todayKey };
        setLastGpsPos(pos);
        localStorage.setItem('step_last_gps_pos', JSON.stringify(pos));

        // ── Vehicle / cycling speed detection ─────────────────────────────
        // GPS Doppler speed > 6 m/s (~22 kph) while steps accumulate = likely in a vehicle.
        if (speed !== null && speed > GPS_VEHICLE_SPEED_MPS) {
          if (suspiciousActivityRef.current !== 'vehicle_detected') {
            suspiciousActivityRef.current = 'vehicle_detected';
            setSuspiciousActivity('vehicle_detected');
            console.warn(`⚠️ [AntiCheat] Vehicle speed detected: ${(speed * 3.6).toFixed(1)} kph`);
          }
        } else if (speed !== null && speed <= GPS_VEHICLE_SPEED_MPS
          && suspiciousActivityRef.current === 'vehicle_detected') {
          suspiciousActivityRef.current = null;
          setSuspiciousActivity(null);
        }
        // ─────────────────────────────────────────────────────────────────

        if (isOutdoor && accuracy <= GPS_PATH_ACCURACY_METERS) {
          // GPS Doppler speed = 0 when stationary — rejects shaking/sitting still.
          // Only guard when speed is actually available from watchPosition.
          if (speed !== null && speed < 0.3) return;

          // ── EMA coordinate smoothing ────────────────────────────────────
          // Applies an Exponential Moving Average to GPS lat/lng before drawing,
          // which removes the high-frequency noise that causes zigzag lines while
          // still following the actual walking path with ~1-2 s of lag.
          let smoothedLat = lat;
          let smoothedLng = lng;
          if (gpsSmoothedRef.current) {
            smoothedLat = GPS_SMOOTH_ALPHA * lat + (1 - GPS_SMOOTH_ALPHA) * gpsSmoothedRef.current.lat;
            smoothedLng = GPS_SMOOTH_ALPHA * lng + (1 - GPS_SMOOTH_ALPHA) * gpsSmoothedRef.current.lng;
          }
          gpsSmoothedRef.current = { lat: smoothedLat, lng: smoothedLng };
          // ─────────────────────────────────────────────────────────────────

          const incoming = { lat: smoothedLat, lng: smoothedLng, timestamp, accuracy };
          setPathPoints((prev) => {
            const last  = prev[prev.length - 1];
            const prev2 = prev[prev.length - 2];

            if (last) {
              const gapMeters = distanceInMeters(last, incoming);
              // Floor dtSec to 2 s so rapid watchPosition callbacks don't produce
              // falsely high speed values that reject valid walking points.
              const dtSec  = Math.max(2, ((incoming.timestamp || Date.now()) - (last.timestamp || 0)) / 1000);
              const speedMps = gapMeters / dtSec;
              if (gapMeters < GPS_MIN_MOVE_METERS) return prev;
              if (gapMeters > GPS_MAX_JUMP_METERS && dtSec <= 10) return prev;
              if (speedMps > GPS_MAX_WALK_SPEED_MPS) return prev;

              // ── Directional spike filter ─────────────────────────────────
              if (prev2 && gapMeters < GPS_SPIKE_MIN_GAP_METERS) {
                const prevBearing  = bearingDeg(prev2, last);
                const newBearing   = bearingDeg(last, incoming);
                const courseChange = Math.abs(((newBearing - prevBearing + 540) % 360) - 180);
                if (courseChange > GPS_MAX_COURSE_CHANGE_DEG) return prev;
              }
              // ─────────────────────────────────────────────────────────────

              // ── Stationary cluster detection ─────────────────────────────
              if (prev.length >= GPS_STATIONARY_CLUSTER_SIZE) {
                const cluster   = prev.slice(-GPS_STATIONARY_CLUSTER_SIZE);
                const centroid  = centroidOf(cluster);
                const maxSpread = Math.max(...cluster.map(p => distanceInMeters(p, centroid)));
                if (maxSpread <= GPS_STATIONARY_RADIUS_METERS) {
                  // ── Feed anti-cheat: GPS says user is stationary ─────────
                  acLastGpsMovedRef.current = false;
                  if (distanceInMeters(centroid, incoming) < GPS_STATIONARY_RESUME_METERS) {
                    return prev;
                  }
                  gpsSmoothedRef.current = { lat: lat, lng: lng };
                }
              }
              // ─────────────────────────────────────────────────────────────
            }

            // ── Feed anti-cheat: GPS recorded real movement ───────────────
            acLastGpsMovedRef.current = true;

            const next = [...prev, incoming].slice(-MAX_ROUTE_POINTS_PER_DAY);
            persistRoute(todayKey, next);
            if (next.length >= 2) setShowMap(true);
            return next;
          });
        }
      };

      // ── Primary: watchPosition — continuous real-time GPS ───────────────
      Geolocation.watchPosition(
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 3000 },
        (position, err) => {
          if (err || !position) return;
          try {
            // coords.speed: GPS Doppler m/s — 0 when still, ~1.2 when walking, null if unavailable
            const speed = typeof position.coords.speed === 'number' ? position.coords.speed : null;
            processPosition(
              position.coords.latitude,
              position.coords.longitude,
              position.coords.accuracy,
              position.timestamp || Date.now(),
              speed
            );
          } catch (e) { /* silent */ }
        }
      ).then(id => { watchId = id; }).catch(() => {});

      // ── Secondary: SharedPrefs poll — catches background-written GPS ────
      const poll = async () => {
        try {
          const loc = await StepCounterPlugin.getLastGpsLocation();
          if (!loc.hasLocation) return;
          if (loc.timestamp <= gpsLastTsRef.current) return;
          gpsLastTsRef.current = Number(loc.timestamp) || Date.now();
          processPosition(
            Number(loc.lat),
            Number(loc.lng),
            Number(loc.accuracy),
            gpsLastTsRef.current
          );
        } catch (e) { /* silent */ }
      };
      poll();
      gpsIntervalRef.current = setInterval(poll, 5000);

      // ── Load background-recorded route points from GalleryMonitorService ──
      // The service accumulates GPS fixes into SharedPrefs while the app is closed.
      // On mount we fetch those points, deduplicate by timestamp, and pre-seed the
      // live route so the walk that happened while the screen was off is visible.
      (async () => {
        try {
          const result = await StepCounterPlugin.getBackgroundRoutePoints();
          const raw = JSON.parse(result?.points || '[]');
          if (!Array.isArray(raw) || raw.length === 0) return;
          const bgPoints = raw
            .filter(p => isValidLatLng(p.lat, p.lng))
            .map(p => ({ lat: p.lat, lng: p.lng, accuracy: p.accuracy, timestamp: p.timestamp }));
          if (bgPoints.length === 0) return;
          setPathPoints(prev => {
            const existing = new Set(prev.map(p => p.timestamp));
            const newPts = bgPoints.filter(p => !existing.has(p.timestamp));
            if (newPts.length === 0) return prev;
            // Prepend background points (they are older) before live points
            const merged = [...newPts, ...prev].slice(-MAX_ROUTE_POINTS_PER_DAY);
            persistRoute(toDateKey(), merged);
            if (merged.length >= 2) setShowMap(true);
            return merged;
          });
        } catch (e) { /* silent — not critical */ }
      })();

      return () => {
        if (watchId !== null) Geolocation.clearWatch({ id: watchId }).catch(() => {});
        if (gpsIntervalRef.current) clearInterval(gpsIntervalRef.current);
      };
    } else {
      // ── Web demo path ───────────────────────────────────────────────────
      // Simulate a short outdoor walk so the map card appears in the browser.
      // Tight demo walk — ~5 m between each point, same block
      const DEMO_POINTS = [
        { lat: 1.35220, lng: 103.81980 },
        { lat: 1.35224, lng: 103.81985 },
        { lat: 1.35228, lng: 103.81991 },
        { lat: 1.35233, lng: 103.81996 },
        { lat: 1.35237, lng: 103.82001 },
        { lat: 1.35241, lng: 103.82007 },
        { lat: 1.35245, lng: 103.82012 },
        { lat: 1.35249, lng: 103.82017 },
      ];
      let idx = 0;
      const addNext = () => {
        if (idx >= DEMO_POINTS.length) return;
        setPathPoints(prev => [...prev, DEMO_POINTS[idx]]);
        setShowMap(true);
        idx++;
      };
      // Stagger demo points so the polyline draws visibly
      const timers = DEMO_POINTS.map((_, i) => setTimeout(addNext, 800 + i * 600));
      return () => timers.forEach(clearTimeout);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─────────────────────────────────────────────────────────────────────────
  // DERIVED DISPLAY VALUES
  // ─────────────────────────────────────────────────────────────────────────
  const isViewingOther  = !!(selectedMember && !selectedMember.isSelf);
  const displaySteps    = isViewingOther ? memberData.steps    : todaySteps;
  const displayCalories = isViewingOther ? memberData.calories : todayCalories;
  const displayHistory  = isViewingOther ? memberData.history  : dailyHistory;
  const displayLoading  = isViewingOther ? memberData.loading  : loading;

  const stepProgress = Math.min(displaySteps / STEP_GOAL, 1);
  const ringOffset   = RING_CIRCUMFERENCE * (1 - stepProgress);
  const historyData  = historyView === 'week' ? displayHistory.slice(-7) : displayHistory;
  const validPathPoints = pathPoints.filter(
    (point) => point && Number.isFinite(Number(point.lat)) && Number.isFinite(Number(point.lng))
  );
  const lastPathPoint = validPathPoints[validPathPoints.length - 1];
  const hasRouteForDisplay = validPathPoints.length >= 2;
  // Map center: prefer last outdoor route point, fall back to any GPS fix (indoor)
  const mapCenterPoint = lastPathPoint || lastGpsPos;
  // Show map whenever we have any GPS position (outdoor route OR indoor fix)
  const shouldShowMap = !!(mapCenterPoint && (showMap || hasRouteForDisplay || lastGpsPos));
  const routeDistanceMeters = validPathPoints.reduce((sum, point, idx, arr) => {
    if (idx === 0) return 0;
    return sum + distanceInMeters(arr[idx - 1], point);
  }, 0);

  if (loading && !ready) {
    return <LoadingSpinner context="steps" />;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/30 to-teal-50/40">

      {/* ──── Header ──── */}
      <div className="bg-white/90 backdrop-blur-lg border-b border-emerald-100/50 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 -ml-2 rounded-xl hover:bg-emerald-50 active:bg-emerald-100 transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
          )}
          <div className="flex items-center gap-2.5 flex-1">
            <div className="bg-gradient-to-br from-emerald-500 to-teal-500 p-2 rounded-xl shadow-sm">
              <Footprints className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Step Counter</h1>
              {isViewingOther && (
                <p className="text-xs text-emerald-600 font-medium">Viewing {selectedMember.userName}'s data</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Manual Refresh Button */}
            {!isViewingOther && (
              <button
                onClick={handleManualRefresh}
                disabled={refreshing}
                aria-label="Refresh steps"
                title="Refresh Steps"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 active:scale-95
                  ${
                    refreshDone
                      ? 'bg-emerald-500 text-white shadow-md shadow-emerald-200'
                      : refreshing
                      ? 'bg-emerald-100 text-emerald-600 cursor-not-allowed'
                      : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:shadow-sm'
                  }`}
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${
                    refreshing ? 'animate-spin' : refreshDone ? '' : ''
                  }`}
                />
                <span>
                  {refreshing ? 'Refreshing…' : refreshDone ? '✓ Updated' : 'Refresh'}
                </span>
              </button>
            )}
            {saving && (
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="Saving..." />
            )}
          </div>
        </div>
      </div>

      {/* ──── My Steps Content ──── */}
      <div className="max-w-lg mx-auto px-4 pt-5 pb-8 space-y-4 sm:space-y-5">

        {/* Error banner */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-3.5 flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Wrong device date warning banner */}
        {wrongDateWarning && (
          <div className="bg-orange-50 border border-orange-300 rounded-2xl p-4 flex items-start gap-3">
            <Calendar className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-orange-900">Wrong Device Date Detected</p>
              <p className="text-xs text-orange-700 mt-0.5">
                Your device date appears incorrect. The actual date is{' '}
                <span className="font-bold">{wrongDateWarning}</span>.
                Step data shown may not match the correct day.
              </p>
              <p className="text-xs text-orange-600 mt-1">
                Please correct your device date in Settings → Date &amp; Time.
              </p>
            </div>
            <button
              onClick={() => setWrongDateWarning(null)}
              className="text-orange-400 hover:text-orange-600 active:text-orange-700 text-lg leading-none font-bold flex-shrink-0 -mt-0.5"
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        )}

        {/* ── Anti-fake suspicious activity warning ── */}
        {suspiciousActivity && !isViewingOther && (
          <div className={`border rounded-2xl p-4 flex items-start gap-3 ${
            suspiciousActivity === 'fake_detected'
              ? 'bg-red-50 border-red-300'
              : suspiciousActivity === 'vehicle_detected'
              ? 'bg-orange-50 border-orange-300'
              : 'bg-amber-50 border-amber-300'
          }`}>
            <ShieldAlert className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
              suspiciousActivity === 'fake_detected' ? 'text-red-500'
              : suspiciousActivity === 'vehicle_detected' ? 'text-orange-500'
              : 'text-amber-500'
            }`} />
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${
                suspiciousActivity === 'fake_detected' ? 'text-red-900'
                : suspiciousActivity === 'vehicle_detected' ? 'text-orange-900'
                : 'text-amber-900'
              }`}>
                {suspiciousActivity === 'fake_detected'
                  ? '⚠ Fake Steps Detected — Saving Reduced'
                  : suspiciousActivity === 'vehicle_detected'
                  ? 'Vehicle Movement Detected'
                  : 'Unusual Step Rate'}
              </p>
              <p className={`text-xs mt-0.5 ${
                suspiciousActivity === 'fake_detected' ? 'text-red-700'
                : suspiciousActivity === 'vehicle_detected' ? 'text-orange-700'
                : 'text-amber-700'
              }`}>
                {suspiciousActivity === 'fake_detected'
                  ? 'Movement patterns are inconsistent with real walking (phone shaking or automated tool detected). Suspicious steps are being quarantined and not saved to your history.'
                  : suspiciousActivity === 'vehicle_detected'
                  ? 'GPS shows movement at vehicle speed (~22+ kph). Steps counted while in a vehicle may be reviewed by your coach.'
                  : 'Step rate is above normal human limits. Activity is being monitored.'}
              </p>
            </div>
            <button
              onClick={() => {
                suspiciousActivityRef.current = null;
                setSuspiciousActivity(null);
              }}
              className="text-gray-400 hover:text-gray-600 text-lg leading-none font-bold flex-shrink-0 -mt-0.5"
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        )}

        {/* Permission banner */}
        {!isViewingOther && isNativePlatform && sensorAvailable && !permissionGranted && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-900 mb-1">Permission Required</p>
                <p className="text-xs text-amber-700 mb-3">Allow activity recognition to track your steps.</p>
                <button
                  onClick={requestPermission}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white text-sm font-semibold rounded-xl transition-colors"
                >
                  Grant Permission
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ──── Circular Progress Ring + Stats ──── */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100/80 p-5 sm:p-7">
          <div className="flex flex-col items-center">
            {/* Ring */}
            <div className="relative w-44 h-44 sm:w-52 sm:h-52 mb-4">
              {displayLoading ? (
                <div className="w-full h-full rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 animate-pulse" />
              ) : (
                <>
                  <svg viewBox="0 0 200 200" className="w-full h-full -rotate-90">
                    <circle cx="100" cy="100" r={RING_RADIUS} fill="none" stroke="#e5e7eb" strokeWidth="10" />
                    <circle
                      cx="100" cy="100" r={RING_RADIUS} fill="none"
                      stroke="url(#stepGradient)" strokeWidth="10" strokeLinecap="round"
                      strokeDasharray={RING_CIRCUMFERENCE} strokeDashoffset={ringOffset}
                      className="transition-all duration-700 ease-out"
                    />
                    <defs>
                      <linearGradient id="stepGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#10b981" />
                        <stop offset="100%" stopColor="#14b8a6" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <Footprints className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-500 mb-1" />
                    <p className="text-3xl sm:text-4xl font-extrabold text-gray-900 leading-none">
                      {displaySteps.toLocaleString()}
                    </p>
                    <p className="text-xs sm:text-sm text-gray-400 mt-1 font-medium">
                      / {STEP_GOAL.toLocaleString()}
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Goal progress text */}
            {!displayLoading && (
              <p className="text-sm text-gray-500 font-medium mb-1">
                {stepProgress >= 1
                  ? '🎉 Goal reached!'
                  : `${Math.round(stepProgress * 100)}% of daily goal`}
              </p>
            )}
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-3 mt-5">
            <div className="bg-emerald-50 rounded-2xl p-3.5 sm:p-4 text-center">
              <Footprints className="w-4 h-4 text-emerald-600 mx-auto mb-1.5" />
              {displayLoading ? (
                <div className="h-6 w-16 bg-emerald-200/60 rounded-lg animate-pulse mx-auto" />
              ) : (
                <p className="text-lg sm:text-xl font-bold text-emerald-900">{displaySteps.toLocaleString()}</p>
              )}
              <p className="text-xs text-emerald-600 mt-0.5 font-medium">Steps</p>
            </div>
            <div className="bg-rose-50 rounded-2xl p-3.5 sm:p-4 text-center">
              <Flame className="w-4 h-4 text-rose-500 mx-auto mb-1.5" />
              {displayLoading ? (
                <div className="h-6 w-16 bg-rose-200/60 rounded-lg animate-pulse mx-auto" />
              ) : (
                <p className="text-lg sm:text-xl font-bold text-rose-900">{displayCalories}</p>
              )}
              <p className="text-xs text-rose-500 mt-0.5 font-medium">Calories</p>
            </div>
          </div>


        </div>

        {/* ──── GPS permission prompt (native only, when denied) ──── */}
        {isNativePlatform && gpsPermission === 'denied' && (
          <div className="bg-orange-50 border border-orange-200 rounded-3xl p-5 flex items-start gap-3">
            <MapPin className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-orange-900">Location permission needed</p>
              <p className="text-xs text-orange-700 mt-0.5">Allow location access so the outdoor walk map can track your route.</p>
              <button
                onClick={async () => {
                  try {
                    const result = await Geolocation.requestPermissions({ permissions: ['location'] });
                    const granted = result?.location === 'granted' || result?.coarseLocation === 'granted';
                    setGpsPermission(granted ? 'granted' : 'denied');
                  } catch (e) { /* user declined */ }
                }}
                className="mt-2 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold rounded-xl transition-colors"
              >
                Grant Location
              </button>
            </div>
          </div>
        )}

        {/* ──── GPS "waiting for outdoor signal" hint (granted but no GPS fix at all) ──── */}
        {isNativePlatform && gpsPermission === 'granted' && !hasRouteForDisplay && !lastGpsPos && (
          <div className="bg-emerald-50 border border-emerald-100 rounded-3xl p-4 flex items-center gap-3">
            <MapPin className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <p className="text-xs text-emerald-700">Walk map will appear once GPS gets a location fix.</p>
          </div>
        )}

        {/* ──── GPS Status Strip (always visible when permission granted) ──── */}
        {isNativePlatform && gpsPermission === 'granted' && lastGpsPos && (
          <div className={`rounded-2xl px-4 py-2.5 flex items-center gap-2.5 ${
            lastGpsPos.isOutdoor ? 'bg-emerald-50 border border-emerald-200' : 'bg-blue-50 border border-blue-200'
          }`}>
            <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
              lastGpsPos.isOutdoor ? 'bg-emerald-500 animate-pulse' : 'bg-blue-400'
            }`} />
            <span className={`text-xs font-bold flex-1 ${lastGpsPos.isOutdoor ? 'text-emerald-800' : 'text-blue-800'}`}>
              {lastGpsPos.isOutdoor ? 'Outdoor' : 'Indoor'}
            </span>
            {hasRouteForDisplay && (
              <span className="text-xs font-semibold text-emerald-700 flex-shrink-0">
                {routeDistanceMeters >= 1000
                  ? `${(routeDistanceMeters / 1000).toFixed(2)} km`
                  : `${Math.round(routeDistanceMeters)} m`} walked
              </span>
            )}
          </div>
        )}

        {/* ──── GPS Map Card (shows for both outdoor route and indoor position) ──── */}
        {shouldShowMap && mapCenterPoint && (
          <div ref={mapCardRef} className="bg-white rounded-3xl shadow-sm border border-gray-100/80 overflow-hidden">
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-500" />
                {hasRouteForDisplay ? 'Outdoor Walk' : 'Current Location'}
                {!Capacitor.isNativePlatform() && (
                  <span className="text-xs font-semibold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-lg">DEMO</span>
                )}
                {Capacitor.isNativePlatform() && lastGpsPos && (
                  <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-lg ${
                    lastGpsPos.isOutdoor ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {lastGpsPos.isOutdoor ? 'OUTDOOR' : 'INDOOR'}
                  </span>
                )}
              </h2>
              <div className="flex items-center gap-2">
                {/* Share button — always shown, disabled when no route */}
                <button
                  disabled={!hasRouteForDisplay}
                  onClick={async () => {
                    try {
                      const dateLabel = new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
                      const blob = await buildWalkShareCanvas(validPathPoints, routeDistanceMeters, todaySteps, dateLabel);
                      const distStr = routeDistanceMeters >= 1000
                        ? `${(routeDistanceMeters / 1000).toFixed(2)} km`
                        : `${Math.round(routeDistanceMeters)} m`;
                      const shareText = `I walked ${distStr} today with Wellness Valley!`;

                      if (Capacitor.isNativePlatform()) {
                        // Native Android/iOS: write to cache file then use Capacitor Share
                        try {
                          const base64 = await new Promise((resolve, reject) => {
                            const reader = new FileReader();
                            reader.onload = () => resolve(reader.result.split(',')[1]);
                            reader.onerror = reject;
                            reader.readAsDataURL(blob);
                          });
                          const fileName = `walk-${Date.now()}.png`;
                          await Filesystem.writeFile({
                            path: fileName,
                            data: base64,
                            directory: Directory.Cache,
                          });
                          const { uri } = await Filesystem.getUri({
                            path: fileName,
                            directory: Directory.Cache,
                          });
                          await Share.share({
                            title: 'My Walk',
                            text: shareText,
                            url: uri,
                            dialogTitle: 'Share your walk',
                          });
                        } catch (nativeErr) {
                          if (nativeErr?.message?.toLowerCase().includes('cancel')) return;
                          console.warn('Native share failed:', nativeErr);
                        }
                      } else {
                        // Web fallback: navigator.share or download
                        const file = new File([blob], 'my-walk.png', { type: 'image/png' });
                        const shareData = { title: 'My Walk', text: shareText, files: [file] };
                        if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
                          await navigator.share(shareData);
                        } else {
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url; a.download = 'my-walk.png'; a.click();
                          URL.revokeObjectURL(url);
                        }
                      }
                    } catch (e) {
                      if (e?.name !== 'AbortError') console.warn('Share failed:', e);
                    }
                  }}
                  className={`p-1.5 rounded-xl transition-colors ${
                    hasRouteForDisplay
                      ? 'bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200'
                      : 'bg-gray-100 opacity-40 cursor-not-allowed'
                  }`}
                  aria-label="Share walk as image"
                >
                  <Share2 className={`w-4 h-4 ${hasRouteForDisplay ? 'text-emerald-600' : 'text-gray-400'}`} />
                </button>
              </div>
            </div>
            <div ref={mapDivRef} style={{ height: 220 }}>
              <MapContainer
                center={[mapCenterPoint.lat, mapCenterPoint.lng]}
                zoom={17}
                style={{ height: '100%', width: '100%' }}
                zoomControl={false}
                attributionControl={false}
              >
                <TileLayer
                  url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                  attribution='&copy; OpenStreetMap contributors &copy; CARTO'
                />
                {/* ── Outdoor route polyline ─────────────────────────────── */}
                {hasRouteForDisplay && (
                  <Polyline
                    positions={validPathPoints.map((p) => [p.lat, p.lng])}
                    color="#10b981"
                    weight={4}
                    opacity={0.9}
                  />
                )}
                {/* ── Start marker ──────────────────────────────────────── */}
                {hasRouteForDisplay && (
                  <CircleMarker
                    center={[validPathPoints[0].lat, validPathPoints[0].lng]}
                    radius={7}
                    pathOptions={{ color: '#fff', fillColor: '#10b981', fillOpacity: 1, weight: 2 }}
                  >
                    <Tooltip permanent direction="top" offset={[0, -10]} className="leaflet-label-start">
                      🟢 Start
                    </Tooltip>
                  </CircleMarker>
                )}
                {/* ── End / current position marker ─────────────────────── */}
                {hasRouteForDisplay && validPathPoints.length >= 2 && (
                  <CircleMarker
                    center={[validPathPoints[validPathPoints.length - 1].lat, validPathPoints[validPathPoints.length - 1].lng]}
                    radius={7}
                    pathOptions={{ color: '#fff', fillColor: '#f43f5e', fillOpacity: 1, weight: 2 }}
                  >
                    <Tooltip permanent direction="top" offset={[0, -10]} className="leaflet-label-end">
                      📍 {routeDistanceMeters >= 1000
                        ? `${(routeDistanceMeters / 1000).toFixed(2)} km`
                        : `${Math.round(routeDistanceMeters)} m`}
                    </Tooltip>
                  </CircleMarker>
                )}
                {/* ── Indoor: blue dot at current position ──────────────── */}
                {!hasRouteForDisplay && mapCenterPoint && (
                  <CircleMarker
                    center={[mapCenterPoint.lat, mapCenterPoint.lng]}
                    radius={8}
                    pathOptions={{ color: '#fff', fillColor: '#3b82f6', fillOpacity: 0.9, weight: 2 }}
                  >
                    <Tooltip permanent direction="top" offset={[0, -12]} className="leaflet-label-start">
                      📍 Here
                    </Tooltip>
                  </CircleMarker>
                )}
                {/* ── Auto-fit while walking ─────────────────────────────── */}
                <MapAutoFit points={validPathPoints} centerPoint={mapCenterPoint} />
              </MapContainer>
            </div>
          </div>
        )}

        {/* ──── History Section ──── */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100/80 p-5 sm:p-7">
          {/* Header + Toggle */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-500" />
              History
            </h2>
            <div className="flex bg-gray-100 rounded-xl p-0.5">
              <button
                onClick={() => setHistoryView('week')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  historyView === 'week' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500'
                }`}
              >Week</button>
              <button
                onClick={() => setHistoryView('month')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  historyView === 'month' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500'
                }`}
              >Month</button>
            </div>
          </div>

          {historyData.length > 0 ? (
            <>
              {/* Summary Row */}
              <div className="grid grid-cols-2 gap-3 pt-1 border-t border-gray-100">
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                    <p className="text-xs text-gray-500 font-medium">Avg Steps</p>
                  </div>
                  <p className="text-lg sm:text-xl font-bold text-gray-900">
                    {Math.round(
                      historyData.reduce((sum, day) => {
                        const isToday = toDateKey(new Date(day.date)) === toDateKey();
                        return sum + (isToday ? displaySteps : (day.steps || 0));
                      }, 0) / historyData.length
                    ).toLocaleString()}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Flame className="w-3.5 h-3.5 text-rose-400" />
                    <p className="text-xs text-gray-500 font-medium">Total Calories</p>
                  </div>
                  <p className="text-lg sm:text-xl font-bold text-rose-600">
                    {Math.round(
                      historyData.reduce((sum, day) => {
                        const isToday = toDateKey(new Date(day.date)) === toDateKey();
                        return sum + (isToday ? displayCalories : (day.calories || 0));
                      }, 0)
                    ).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Daily List */}
              <div className="mt-4 space-y-2 max-h-64 sm:max-h-80 overflow-y-auto">
                {[...historyData].reverse().map((day) => {
                  const date      = new Date(day.date);
                  const isToday   = toDateKey(date) === toDateKey();
                  const rowSteps    = isToday ? displaySteps    : (day.steps    || 0);
                  const rowCalories = isToday ? displayCalories : (day.calories || 0);

                  return (
                    <div
                      key={day.date}
                      className={`flex items-center justify-between p-3 rounded-xl transition-colors ${
                        isToday ? 'bg-emerald-50 ring-1 ring-emerald-200' : 'bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-white font-bold text-xs ${
                          isToday ? 'bg-gradient-to-br from-emerald-500 to-teal-500' : 'bg-gray-300'
                        }`}>
                          {date.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 2)}
                        </div>
                        <div>
                          <p className={`text-sm font-semibold ${isToday ? 'text-emerald-900' : 'text-gray-800'}`}>
                            {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            {isToday && <span className="ml-1.5 text-xs text-emerald-500 font-medium">Today</span>}
                          </p>
                          <p className="text-xs text-gray-400">{date.toLocaleDateString('en-US', { weekday: 'long' })}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-gray-900">{rowSteps.toLocaleString()}</p>
                        <p className="text-xs text-gray-400">{rowCalories} kcal</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="text-center py-10">
              <Activity className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400 font-medium">No activity data yet</p>
              <p className="text-xs text-gray-300 mt-1">Start walking to see your history</p>
            </div>
          )}
        </div>


      </div>
    </div>
  );
};

export default StepCounter;



