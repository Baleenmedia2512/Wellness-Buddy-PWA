import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { Activity, Footprints, Flame, ArrowLeft, ShieldAlert, Calendar, TrendingUp } from 'lucide-react';
import { StepCounterPlugin } from '../plugins/stepCounterPlugin';
import { saveDailyActivity, fetchDailyActivity } from '../services/dailyActivityService';
import LoadingSpinner from './LoadingSpinner';

// Constants
const CALORIES_PER_STEP = 0.04; // Walking: 1 step = 0.04 kcal
const UPDATE_THROTTLE_MS = 1000; // Update UI max once per second
const ACTIVITY_TYPE = 'walking'; // Only walking activity
const AUTO_SAVE_INTERVAL_MS = 60 * 1000; // Auto-save every 1 minute
const STEP_GOAL = 10000; // Daily step goal
const RING_RADIUS = 80;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/**
 * Get date key in YYYY-MM-DD format
 */
const toDateKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Calculate calories from steps
 */
const calcCalories = (steps) => {
  return Number((steps * CALORIES_PER_STEP).toFixed(2));
};

/**
 * Local storage keys for baseline tracking
 */
const getBaselineKey = (dateKey) => `step_counter_baseline_${dateKey}`;
const getLastUpdateKey = () => 'step_counter_last_update';

/**
 * Read baseline from localStorage
 */
const readBaseline = (dateKey) => {
  try {
    const raw = localStorage.getItem(getBaselineKey(dateKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Number.isFinite(parsed?.sensorTotal)) return null;
    return parsed;
  } catch {
    return null;
  }
};

/**
 * Write baseline to localStorage
 */
const writeBaseline = (dateKey, sensorTotal) => {
  const payload = {
    sensorTotal,
    savedAt: Date.now(),
    date: dateKey
  };
  localStorage.setItem(getBaselineKey(dateKey), JSON.stringify(payload));
  localStorage.setItem(getLastUpdateKey(), Date.now().toString());
};

/**
 * Main Step Counter Component
 */
const StepCounter = ({ onBack, userId }) => {
  const isNativePlatform = Capacitor.isNativePlatform();
  
  // State management
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sensorAvailable, setSensorAvailable] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [todaySteps, setTodaySteps] = useState(0);
  const [todayCalories, setTodayCalories] = useState(0);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState(null);
  const [dailyHistory, setDailyHistory] = useState([]);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [historyView, setHistoryView] = useState('week'); // 'week', 'month'
  // Resolve the real DB userId with multi-source fallback
  const [resolvedUserId, setResolvedUserId] = useState(() => {
    // Try initializing from prop or localStorage immediately (synchronous)
    if (userId) return userId;
    const stored = localStorage.getItem('dbUserId');
    return stored ? Number(stored) : null;
  });

  useEffect(() => {
    // If already resolved, nothing to do
    if (resolvedUserId) return;

    let cancelled = false;

    const tryResolve = async () => {
      // 1. Check prop
      if (userId) {
        if (!cancelled) setResolvedUserId(userId);
        return true;
      }
      // 2. Check localStorage (written by App.js after login)
      const stored = localStorage.getItem('dbUserId');
      if (stored) {
        console.log('✅ [StepCounter] userId from localStorage:', stored);
        if (!cancelled) setResolvedUserId(Number(stored));
        return true;
      }
      // 3. Final fallback: call lookup-user-id with stored email
      const email = localStorage.getItem('userEmail');
      if (email) {
        try {
          const apiBaseUrl = process.env.REACT_APP_API_BASE_URL;
          const res = await fetch(`${apiBaseUrl}/api/lookup-user-id`, {
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
          console.warn('[StepCounter] API fallback failed:', e.message);
        }
      }
      return false;
    };

    // Try immediately, then poll every second for up to 30s
    tryResolve().then(resolved => {
      if (resolved || cancelled) return;
      let attempts = 0;
      const interval = setInterval(() => {
        attempts++;
        tryResolve().then(ok => {
          if (ok || attempts >= 30) clearInterval(interval);
        });
      }, 1000);
      // Store interval ref for cleanup
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
  
  // Refs for internal state
  const latestSensorTotalRef = useRef(null);
  const sensorListenerRef = useRef(null);
  const lastUIUpdateRef = useRef(0);
  const midnightTimerRef = useRef(null);
  const autoSaveTimerRef = useRef(null);
  const resolveIntervalRef = useRef(null);
  const pollIntervalRef = useRef(null);
  const todayStepsRef = useRef(0);       // Req 8: always-current step count for resume saves
  const lastSavedStepsRef = useRef(null); // Req 8: prevent duplicate saves
  const dbStepsFloorRef = useRef(0);     // Floor from DB to protect against reinstall data loss
  const dbFloorCheckedRef = useRef(false); // Whether DB floor check has completed
  const sensorReadyRef = useRef(false);    // Whether first sensor reading arrived
  
  /**
   * Process sensor value and calculate daily steps
   */
  const processSensorValue = useCallback((totalSteps) => {
    if (!Number.isFinite(totalSteps)) {
      console.warn('⚠️ Invalid sensor value:', totalSteps);
      return;
    }
    
    const todayKey = toDateKey();
    let baseline = readBaseline(todayKey);
    
    console.log('📊 Processing sensor value:', {
      totalSteps,
      todayKey,
      baseline: baseline?.sensorTotal,
      hasBaseline: !!baseline
    });
    
    // First reading of the day - set baseline
    if (!baseline) {
      baseline = { sensorTotal: totalSteps };
      writeBaseline(todayKey, totalSteps);
      console.log('✅ Baseline set for first time:', totalSteps);
    }
    
    // Device reboot detection - sensor reset to lower value
    if (totalSteps < baseline.sensorTotal) {
      console.log('🔄 Device reboot detected, resetting baseline');
      baseline = { sensorTotal: totalSteps };
      writeBaseline(todayKey, totalSteps);
    }
    
    // Calculate today's steps (use DB floor to prevent losing data after reinstall)
    const sensorSteps = Math.max(0, Math.floor(totalSteps - baseline.sensorTotal));
    const dailySteps = Math.max(sensorSteps, dbStepsFloorRef.current);
    const calories = calcCalories(dailySteps);
    
    console.log('🚶 Daily steps calculated:', {
      dailySteps,
      calories,
      totalSteps,
      baseline: baseline.sensorTotal
    });
    
    // Only update if it's been more than throttle time OR this is first update
    const now = Date.now();
    if (now - lastUIUpdateRef.current >= UPDATE_THROTTLE_MS || lastUIUpdateRef.current === 0) {
      lastUIUpdateRef.current = now;
      latestSensorTotalRef.current = totalSteps;
      todayStepsRef.current = dailySteps; // Keep ref in sync for resume saves
      setTodaySteps(dailySteps);
      setTodayCalories(calories);
      setLastUpdated(new Date());
      sensorReadyRef.current = true;
      // Only clear loading if DB floor check is done OR steps > 0
      // (avoids flashing 0 on reinstall while DB fetch is pending)
      if (dailySteps > 0 || dbFloorCheckedRef.current) {
        setLoading(false);
      }
      console.log('✅ UI updated with new step count:', dailySteps);
    }
  }, []);
  
  /**
   * Save current steps to database
   */
  const saveStepsToDatabase = useCallback(async (stepsOverride, caloriesOverride) => {
    // Allow callers (e.g. resume handler) to pass freshly computed values to avoid stale state
    const steps = (stepsOverride !== undefined && stepsOverride !== null) ? stepsOverride : todaySteps;
    const calories = (caloriesOverride !== undefined && caloriesOverride !== null) ? caloriesOverride : todayCalories;

    console.log('💾 Save attempt:', {
      userId: resolvedUserId,
      steps,
      calories,
      latestSensorTotal: latestSensorTotalRef.current
    });
    
    if (!resolvedUserId) {
      console.log('⏭️ Skipping save: No userId resolved');
      return;
    }
    
    if (steps === 0) {
      console.log('⏭️ Skipping save: No steps yet');
      return;
    }
    
    // Skip duplicate saves when steps have not changed
    if (lastSavedStepsRef.current === steps) {
      console.log('⏭️ Skipping save: Steps unchanged since last save', steps);
      return;
    }
    
    try {
      setSaving(true);
      const payload = {
        userId: resolvedUserId,
        activityDate: toDateKey(),
        steps,
        activityType: ACTIVITY_TYPE,
        caloriesBurned: calories,
        currentSensorTotal: latestSensorTotalRef.current
      };
      
      console.log('📤 Sending to database:', payload);
      const result = await saveDailyActivity(payload);
      console.log('✅ Save result:', result);
      
      lastSavedStepsRef.current = steps; // Track last persisted step count
      setLastSaved(new Date());
      console.log('💾 Steps saved to database successfully:', steps);
    } catch (err) {
      console.error('❌ Failed to save steps:', err);
      setError(`Save failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }, [resolvedUserId, todaySteps, todayCalories]);
  
  /**
   * Load daily history from database
   */
  const loadDailyHistory = useCallback(async () => {
    console.log('🔍 loadDailyHistory called, userId:', resolvedUserId);
    
    if (!resolvedUserId) return;

    try {
      const response = await fetchDailyActivity(resolvedUserId, 30, ACTIVITY_TYPE);
      const trend = response.trend || response.data;
      if (response.success && Array.isArray(trend)) {
        const normalized = trend.map(d => ({ ...d, calories: d.caloriesBurned ?? d.calories ?? 0 }));
        setDailyHistory(normalized);
      }
    } catch (err) {
      console.error('❌ Failed to load history:', err);
    }
  }, [resolvedUserId]);

  // Re-load real history once resolvedUserId becomes available
  // (initial mount may fire before userId resolves)
  useEffect(() => {
    if (resolvedUserId) {
      loadDailyHistory();
      // Fetch today's steps from DB to protect against reinstall data loss
      fetchDailyActivity(resolvedUserId, 1, ACTIVITY_TYPE)
        .then((response) => {
          const trend = response.trend || response.data;
          dbFloorCheckedRef.current = true;
          if (response.success && Array.isArray(trend)) {
            const todayKey = toDateKey();
            const todayEntry = trend.find((d) => d.date === todayKey);
            if (todayEntry && todayEntry.steps > 0) {
              dbStepsFloorRef.current = todayEntry.steps;
              console.log('🛡️ DB steps floor set:', todayEntry.steps);
              // Immediately update UI if current steps are below the DB floor
              // (e.g. after reinstall when baseline was lost)
              if (todayEntry.steps > todayStepsRef.current) {
                const floorCalories = calcCalories(todayEntry.steps);
                todayStepsRef.current = todayEntry.steps;
                setTodaySteps(todayEntry.steps);
                setTodayCalories(floorCalories);
                setLastUpdated(new Date());
                console.log('🛡️ UI updated from DB floor:', todayEntry.steps);
              }
            }
            // DB check done — clear loading if sensor already came back with 0
            if (sensorReadyRef.current) {
              setLoading(false);
            }
          }
        })
        .catch((err) => {
          console.warn('⚠️ Failed to fetch DB step floor:', err);
          dbFloorCheckedRef.current = true;
          // DB failed — clear loading if sensor is ready
          if (sensorReadyRef.current) {
            setLoading(false);
          }
        });
    }
  }, [resolvedUserId, loadDailyHistory]);

  /**
   * Initialize step tracking with sensor
   */
  const initStepTracking = useCallback(async () => {
    console.log('🔧 Initializing step tracking...');
    
    try {
      const availability = await StepCounterPlugin.isAvailable();
      const available = !!availability?.available;
      setSensorAvailable(available);
      
      console.log('📱 Sensor availability:', { available, availability });
      
      if (!available) {
        setPermissionGranted(false);
        setLoading(false);
        return;
      }
      
      const permission = await StepCounterPlugin.getPermissionStatus();
      const granted = !!permission?.granted;
      setPermissionGranted(granted);
      
      console.log('🔐 Permission status:', { granted, permission });
      
      if (!granted) {
        console.log('⚠️ Permission not granted');
        setLoading(false); // Stop loading even if no data yet
        return;
      }
      
      // Start tracking
      console.log('▶️ Starting step tracking...');
      const startResult = await StepCounterPlugin.startTracking();
      console.log('▶️ Start tracking result:', startResult);
      
      // Remove old listener if exists
      if (sensorListenerRef.current) {
        await sensorListenerRef.current.remove();
        sensorListenerRef.current = null;
        console.log('🔇 Removed old listener');
      }
      
      // Add sensor listener
      console.log('👂 Adding sensor listener...');
      sensorListenerRef.current = await StepCounterPlugin.addListener('stepUpdate', (event) => {
        console.log('📨 Step update event received:', event);
        const steps = Number.parseInt(event?.totalSteps, 10);
        if (Number.isFinite(steps)) {
          processSensorValue(steps);
        } else {
          console.warn('⚠️ Invalid steps in event:', event);
        }
      });
      console.log('👂 Listener added successfully');
      
      // Get current step count
      console.log('📊 Getting current step count...');
      const current = await StepCounterPlugin.getCurrentStepCount();
      console.log('📊 Current step count result:', current);
      
      const currentValue = Number.parseInt(current?.totalSteps, 10);
      if (Number.isFinite(currentValue)) {
        console.log('✅ Processing initial sensor value:', currentValue);
        processSensorValue(currentValue);
      } else {
        console.warn('⚠️ Invalid current step count, but clearing loading state');
        // Clear loading even if we don't have initial data
        setLoading(false);
      }
      
      // Safety timeout: clear loading after 3s regardless (prevents infinite spinner)
      setTimeout(() => {
        setLoading(false);
      }, 3000);
      
      // Start polling for step updates every 5 seconds as a fallback
      // This ensures UI updates even if the event listener doesn't fire
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      
      pollIntervalRef.current = setInterval(async () => {
        try {
          const current = await StepCounterPlugin.getCurrentStepCount();
          const currentValue = Number.parseInt(current?.totalSteps, 10);
          if (Number.isFinite(currentValue)) {
            processSensorValue(currentValue);
          }
        } catch (err) {
          console.warn('⚠️ Polling failed:', err);
        }
      }, 5000); // Poll every 5 seconds
      
      console.log('✅ Step tracking initialized successfully with polling fallback');
    } catch (err) {
      console.error('❌ Failed to initialize step tracking:', err);
      setError('Failed to initialize step counter');
      setLoading(false);
    }
  }, [processSensorValue]);
  
  /**
   * Request permission for activity recognition
   */
  const requestPermission = useCallback(async () => {
    try {
      const permission = await StepCounterPlugin.requestPermission();
      const granted = !!permission?.granted;
      setPermissionGranted(granted);
      
      if (granted) {
        await initStepTracking();
      }
    } catch (err) {
      console.error('❌ Permission request failed:', err);
      setError('Failed to get permission');
    }
  }, [initStepTracking]);
  
  /**
   * Setup auto-save timer
   */
  const setupAutoSave = useCallback(() => {
    if (autoSaveTimerRef.current) {
      clearInterval(autoSaveTimerRef.current);
    }
    
    autoSaveTimerRef.current = setInterval(() => {
      saveStepsToDatabase();
    }, AUTO_SAVE_INTERVAL_MS);
    
    console.log(`💾 Auto-save enabled (every ${AUTO_SAVE_INTERVAL_MS / 1000}s)`);
  }, [saveStepsToDatabase]);
  
  /**
   * Setup midnight reset timer
   */
  const setupMidnightReset = useCallback(() => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const msUntilMidnight = tomorrow.getTime() - now.getTime();
    
    if (midnightTimerRef.current) {
      clearTimeout(midnightTimerRef.current);
    }
    
    midnightTimerRef.current = setTimeout(async () => {
      console.log('🌙 Midnight reset triggered');
      
      // Save final steps before reset
      await saveStepsToDatabase();
      
      // Get current sensor value and set it as new baseline
      if (latestSensorTotalRef.current !== null) {
        const todayKey = toDateKey();
        writeBaseline(todayKey, latestSensorTotalRef.current);
      }
      
      // Reset displayed values
      setTodaySteps(0);
      setTodayCalories(0);
      
      // Reload history
      await loadDailyHistory();
      
      // Setup next midnight timer
      setupMidnightReset();
    }, msUntilMidnight);
    
    console.log(`⏰ Midnight reset scheduled in ${Math.floor(msUntilMidnight / 1000 / 60)} minutes`);
  }, [saveStepsToDatabase, loadDailyHistory]);
  
  /**
   * Initialize on mount
   */
  useEffect(() => {
    let active = true;
    
    const setup = async () => {
      setLoading(true);
      
      try {
        if (isNativePlatform) {
          await initStepTracking();
        } else {
          setLoading(false);
        }
        
        // Load daily history (will generate dummy if no userId)
        await loadDailyHistory();
        
        // Setup auto-save only if userId resolved
        if (resolvedUserId) {
          setupAutoSave();
        }
        
        // Setup midnight reset
        setupMidnightReset();
      } catch (err) {
        console.error('❌ Setup failed:', err);
        if (active) {
          setError('Failed to initialize step counter');
          setLoading(false);
        }
      } finally {
        if (active) {
          setReady(true);
          // Don't set loading to false here - let processSensorValue or loadDummyData do it when data is ready
        }
      }
    };
    
    setup();
    
    return () => {
      active = false;
      
      // Save before cleanup (only if userId resolved)
      if (resolvedUserId && todaySteps > 0) {
        saveStepsToDatabase().catch(() => {});
      }
      
      // Cleanup timers
      if (midnightTimerRef.current) {
        clearTimeout(midnightTimerRef.current);
      }
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current);
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      
      if (isNativePlatform) {
        StepCounterPlugin.stopTracking().catch(() => {});
        if (sensorListenerRef.current?.remove) {
          sensorListenerRef.current.remove().catch(() => {});
        }
      }
    };
  }, [isNativePlatform, resolvedUserId, initStepTracking, loadDailyHistory, setupAutoSave, setupMidnightReset, todaySteps, saveStepsToDatabase]);
  
  /**
   * Handle app resume (Android)
   */
  useEffect(() => {
    if (!isNativePlatform) return;
    
    const handleResume = async () => {
      console.log('📱 App resumed');
      
      if (permissionGranted && sensorAvailable) {
        try {
          const current = await StepCounterPlugin.getCurrentStepCount();
          const currentValue = Number.parseInt(current?.totalSteps, 10);
          if (Number.isFinite(currentValue)) {
            // Req 4 & 9: Update UI state from latest sensor reading
            processSensorValue(currentValue);

            // React setState is async, so compute steps inline and save immediately
            // instead of relying on the (stale) todaySteps state value
            const todayKey = toDateKey();
            const baseline = readBaseline(todayKey);
            if (baseline) {
              const resumeSteps = Math.max(0, Math.floor(currentValue - baseline.sensorTotal));
              const resumeCalories = calcCalories(resumeSteps);
              console.log('📱 Resume: persisting steps to DB:', resumeSteps);
              await saveStepsToDatabase(resumeSteps, resumeCalories);
            }
          }
        } catch (err) {
          console.error('❌ Resume fetch failed:', err);
        }
      }
    };
    
    // Listen for app resume events
    document.addEventListener('resume', handleResume);
    window.addEventListener('focus', handleResume);
    
    return () => {
      document.removeEventListener('resume', handleResume);
      window.removeEventListener('focus', handleResume);
    };
  // saveStepsToDatabase added so resume handler always uses the freshest closure
  }, [isNativePlatform, permissionGranted, sensorAvailable, processSensorValue, saveStepsToDatabase]);

  
  // Progress ring calculations
  const stepProgress = Math.min(todaySteps / STEP_GOAL, 1);
  const ringOffset = RING_CIRCUMFERENCE * (1 - stepProgress);

  // History data
  const historyData = historyView === 'week' ? dailyHistory.slice(-7) : dailyHistory;
  const maxStepsInHistory = Math.max(
    ...historyData.map(d => {
      const isToday = toDateKey(new Date(d.date)) === toDateKey();
      return isToday ? todaySteps : (d.steps || 0);
    }), 1
  );

  if (loading && !ready) {
    return <LoadingSpinner context="steps" />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/30 to-teal-50/40">
      {/* ──── Header ──── */}
      <div className="bg-white/90 backdrop-blur-lg border-b border-emerald-100/50 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="p-2 -ml-2 rounded-xl hover:bg-emerald-50 active:bg-emerald-100 transition-colors" aria-label="Go back">
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
          )}
          <div className="flex items-center gap-2.5 flex-1">
            <div className="bg-gradient-to-br from-emerald-500 to-teal-500 p-2 rounded-xl shadow-sm">
              <Footprints className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-lg font-bold text-gray-900">Step Counter</h1>
          </div>
          {saving && <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="Saving..." />}
        </div>
      </div>

      {/* ──── Content ──── */}
      <div className="max-w-lg mx-auto px-4 pt-5 pb-8 space-y-4 sm:space-y-5">

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-3.5 flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Permission */}
        {isNativePlatform && sensorAvailable && !permissionGranted && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-900 mb-1">Permission Required</p>
                <p className="text-xs text-amber-700 mb-3">Allow activity recognition to track your steps.</p>
                <button onClick={requestPermission} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white text-sm font-semibold rounded-xl transition-colors">
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
              {loading ? (
                <div className="w-full h-full rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 animate-pulse" />
              ) : (
                <>
                  <svg viewBox="0 0 200 200" className="w-full h-full -rotate-90">
                    <circle cx="100" cy="100" r={RING_RADIUS} fill="none" stroke="#e5e7eb" strokeWidth="10" />
                    <circle cx="100" cy="100" r={RING_RADIUS} fill="none"
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
                      {todaySteps.toLocaleString()}
                    </p>
                    <p className="text-xs sm:text-sm text-gray-400 mt-1 font-medium">
                      / {STEP_GOAL.toLocaleString()}
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Goal progress text */}
            {!loading && (
              <p className="text-sm text-gray-500 font-medium mb-1">
                {stepProgress >= 1
                  ? '\ud83c\udf89 Goal reached!'
                  : `${Math.round(stepProgress * 100)}% of daily goal`}
              </p>
            )}
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-3 mt-5">
            <div className="bg-emerald-50 rounded-2xl p-3.5 sm:p-4 text-center">
              <Footprints className="w-4 h-4 text-emerald-600 mx-auto mb-1.5" />
              {loading ? (
                <div className="h-6 w-16 bg-emerald-200/60 rounded-lg animate-pulse mx-auto" />
              ) : (
                <p className="text-lg sm:text-xl font-bold text-emerald-900">{todaySteps.toLocaleString()}</p>
              )}
              <p className="text-xs text-emerald-600 mt-0.5 font-medium">Steps</p>
            </div>
            <div className="bg-rose-50 rounded-2xl p-3.5 sm:p-4 text-center">
              <Flame className="w-4 h-4 text-rose-500 mx-auto mb-1.5" />
              {loading ? (
                <div className="h-6 w-16 bg-rose-200/60 rounded-lg animate-pulse mx-auto" />
              ) : (
                <p className="text-lg sm:text-xl font-bold text-rose-900">{todayCalories}</p>
              )}
              <p className="text-xs text-rose-500 mt-0.5 font-medium">Calories</p>
            </div>
          </div>
        </div>

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
                        return sum + (isToday ? todaySteps : (day.steps || 0));
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
                        return sum + (isToday ? todayCalories : (day.calories || 0));
                      }, 0)
                    ).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Daily List */}
              <div className="mt-4 space-y-2 max-h-64 sm:max-h-80 overflow-y-auto">
                {[...historyData].reverse().map((day) => {
                  const date = new Date(day.date);
                  const isToday = toDateKey(date) === toDateKey();
                  const displaySteps = isToday ? todaySteps : (day.steps || 0);
                  const displayCalories = isToday ? todayCalories : (day.calories || 0);

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
                        <p className="text-sm font-bold text-gray-900">{displaySteps.toLocaleString()}</p>
                        <p className="text-xs text-gray-400">{displayCalories} kcal</p>
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