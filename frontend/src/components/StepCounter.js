import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { Activity, Footprints, Flame, ArrowLeft, ShieldAlert, Calendar, TrendingUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { StepCounterPlugin } from '../plugins/stepCounterPlugin';
import { saveDailyActivity, fetchDailyActivity } from '../services/dailyActivityService';

// Constants
const CALORIES_PER_STEP = 0.04; // Walking: 1 step = 0.04 kcal
const UPDATE_THROTTLE_MS = 1000; // Update UI max once per second
const ACTIVITY_TYPE = 'walking'; // Only walking activity
const AUTO_SAVE_INTERVAL_MS = 60 * 1000; // Auto-save every 1 minute

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
  const [currentSlide, setCurrentSlide] = useState(0); // 0: Today, 1: History
  const [historyView, setHistoryView] = useState('week'); // 'week', 'month'
  const [panelHeight, setPanelHeight] = useState(null);
  const [diagnosticInfo, setDiagnosticInfo] = useState(null);
  const [showDiagnostic, setShowDiagnostic] = useState(false);

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
  const todayPanelRef = useRef(null);
  const historyPanelRef = useRef(null);
  const resolveIntervalRef = useRef(null);
  const swipeRef = useRef({ active: false, startX: 0, lastX: 0 });
  const pollIntervalRef = useRef(null);
  const todayStepsRef = useRef(0);       // Req 8: always-current step count for resume saves
  const lastSavedStepsRef = useRef(null); // Req 8: prevent duplicate saves
  
  /**
   * Diagnostic function to check step counter status
   */
  const runDiagnostic = useCallback(async () => {
    const diagnostic = {
      timestamp: new Date().toISOString(),
      userId: resolvedUserId || 'NOT SET',
      isNativePlatform,
      sensorAvailable,
      permissionGranted,
      todaySteps,
      todayCalories,
      latestSensorTotal: latestSensorTotalRef.current,
      baseline: readBaseline(toDateKey()),
      loading,
      ready,
      error,
      saving,
      lastSaved: lastSaved ? lastSaved.toLocaleTimeString() : 'Never'
    };
    
    // Try to get current sensor reading
    if (isNativePlatform && permissionGranted) {
      try {
        const current = await StepCounterPlugin.getCurrentStepCount();
        diagnostic.currentReading = current;
      } catch (err) {
        diagnostic.currentReadingError = err.message;
      }
    }
    
    console.log('🔍 Step Counter Diagnostic:', diagnostic);
    setDiagnosticInfo(diagnostic);
    setShowDiagnostic(true);
  }, [isNativePlatform, sensorAvailable, permissionGranted, todaySteps, todayCalories, loading, ready, error]);
  
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
    
    // Calculate today's steps
    const dailySteps = Math.max(0, Math.floor(totalSteps - baseline.sensorTotal));
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
      setLoading(false); // Ensure loading is false once we have data
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
      
      // Ensure loading is cleared after a short delay if sensor is slow
      setTimeout(() => {
        if (currentValue === null || !Number.isFinite(currentValue)) {
          console.log('⏱️ Timeout: clearing loading state');
          setLoading(false);
        }
      }, 1000);
      
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
  
  /**
   * Pointer event handlers for swipe gestures
   */
  const handlePointerDown = useCallback((e) => {
    swipeRef.current = {
      active: true,
      startX: e.clientX,
      lastX: e.clientX,
    };
  }, []);
  
  const handlePointerMove = useCallback((e) => {
    if (!swipeRef.current.active) return;
    swipeRef.current.lastX = e.clientX;
  }, []);
  
  const handlePointerEnd = useCallback(() => {
    if (!swipeRef.current.active) return;
    
    const deltaX = swipeRef.current.startX - swipeRef.current.lastX;
    const threshold = 36; // Match NutritionDashboard threshold
    
    if (deltaX > threshold && currentSlide === 0) {
      setCurrentSlide(1); // Swipe left to go to History
    } else if (deltaX < -threshold && currentSlide === 1) {
      setCurrentSlide(0); // Swipe right to go to Today
    }
    
    swipeRef.current = { active: false, startX: 0, lastX: 0 };
  }, [currentSlide]);
  
  /**
   * Dynamic height measurement for smooth panel transitions
   */
  useEffect(() => {
    const updateHeight = () => {
      requestAnimationFrame(() => {
        const activePanel = currentSlide === 0 ? todayPanelRef.current : historyPanelRef.current;
        if (activePanel?.scrollHeight) {
          const newHeight = activePanel.scrollHeight;
          setPanelHeight(newHeight);
        }
      });
    };
    
    // Update height on slide change
    updateHeight();
    
    // Update on window resize
    window.addEventListener('resize', updateHeight);
    
    return () => {
      window.removeEventListener('resize', updateHeight);
    };
  }, [currentSlide, dailyHistory, historyView, todaySteps, todayCalories, loading]);
  
  /**
   * Render loading state
   */
  if (loading && !ready) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-green-100 flex items-center justify-center p-4">
        <div className="bg-white/85 backdrop-blur-xl rounded-2xl border border-gray-100 shadow-lg p-6 sm:p-8 max-w-md w-full">
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mb-4"></div>
            <p className="text-gray-600 text-sm">Initializing Step Counter...</p>
          </div>
        </div>
      </div>
    );
  }
  
  /**
   * Main render
   */
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Go back"
              >
                <ArrowLeft className="w-5 h-5 text-gray-700" />
              </button>
            )}
            <div className="flex items-center gap-2">
              <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-2 rounded-xl">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Step Counter</h1>
                <p className="text-xs text-gray-500">Track your walking activity</p>
              </div>
            </div>
          </div>

        </div>
      </div>
      
      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        
        {/* Error Alert */}
        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-sm text-rose-800">
            <strong>Error:</strong> {error}
          </div>
        )}
        
        {/* Permission Request */}
        {isNativePlatform && sensorAvailable && !permissionGranted && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-orange-800 mb-1">Permission Required</p>
                <p className="text-xs text-orange-700 mb-3">
                  Allow activity recognition to track your steps automatically.
                </p>
                <button
                  onClick={requestPermission}
                  className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
                >
                  Grant Permission
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Sliding Container */}
        <div 
          className="bg-white/90 backdrop-blur-xl rounded-xl sm:rounded-2xl border border-gray-100 shadow-lg overflow-hidden"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
          onPointerLeave={handlePointerEnd}
        >
          {/* Navigation with Side Buttons */}
          <div className="flex items-stretch">
            {/* Left Navigation Button */}
            {currentSlide === 1 && (
              <button
                onClick={() => setCurrentSlide(0)}
                className="flex-shrink-0 p-2 sm:p-3 hover:bg-emerald-50 transition-all duration-300 border-r border-gray-100"
                aria-label="Previous slide"
              >
                <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6 text-gray-600" />
              </button>
            )}
            
            {/* Slides Container with Dynamic Height */}
            <div 
              className="flex-1 overflow-hidden transition-[height] duration-400 ease-out"
              style={panelHeight ? { height: `${panelHeight}px` } : undefined}
            >
              <div 
                className="flex items-start w-[200%] transition-transform duration-500 ease-out"
                style={{ transform: `translateX(${currentSlide === 0 ? '0%' : '-50%'})` }}
              >
            {/* Slide 1: Today */}
            <div ref={todayPanelRef} className="w-1/2 flex-shrink-0 p-4 sm:p-6 md:p-8">
              <div className="text-center">
                <h3 className="text-xs sm:text-sm md:text-base font-medium text-gray-600 mb-3 sm:mb-4">Daily Summary</h3>
                
                {/* Steps Card */}
                <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 rounded-xl sm:rounded-2xl p-4 sm:p-5 md:p-6 mb-3 sm:mb-4">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Footprints className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" />
                    <p className="text-xs sm:text-sm md:text-base font-semibold text-emerald-700">Steps Today</p>
                  </div>
                  {loading ? (
                    <div className="flex flex-col items-center gap-2 py-2">
                      <div className="h-14 sm:h-16 md:h-20 lg:h-24 w-40 sm:w-48 md:w-56 lg:w-64 bg-gradient-to-r from-emerald-300/60 via-emerald-200/40 to-emerald-300/60 rounded-xl animate-pulse"></div>
                      <div className="h-3 sm:h-4 w-24 sm:w-28 bg-emerald-300/40 rounded-full animate-pulse"></div>
                    </div>
                  ) : (
                    <>
                      <p className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-emerald-900 mb-1 sm:mb-2">{todaySteps.toLocaleString()}</p>
                      <p className="text-xs sm:text-sm text-emerald-600">Keep walking!</p>
                    </>
                  )}
                </div>
                
                {/* Calories Card */}
                <div className="bg-gradient-to-br from-rose-50 to-rose-100/50 rounded-xl sm:rounded-2xl p-4 sm:p-5 md:p-6">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Flame className="w-4 h-4 sm:w-5 sm:h-5 text-rose-600" />
                    <p className="text-xs sm:text-sm md:text-base font-semibold text-rose-700">Calories Burned</p>
                  </div>
                  {loading ? (
                    <div className="flex flex-col items-center gap-2 py-2">
                      <div className="h-14 sm:h-16 md:h-20 lg:h-24 w-40 sm:w-48 md:w-56 lg:w-64 bg-gradient-to-r from-rose-300/60 via-rose-200/40 to-rose-300/60 rounded-xl animate-pulse"></div>
                      <div className="h-3 sm:h-4 w-20 sm:w-24 bg-rose-300/40 rounded-full animate-pulse"></div>
                    </div>
                  ) : (
                    <>
                      <p className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-rose-900 mb-1 sm:mb-2">{todayCalories}</p>
                      <p className="text-xs sm:text-sm text-rose-600">kcal burned</p>
                    </>
                  )}
                </div>
                
                {/* Stats */}
                <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-gray-200 grid grid-cols-2 gap-3 sm:gap-4 mb-0">
                  <div className="text-center">
                    <p className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">{CALORIES_PER_STEP}</p>
                    <p className="text-xs sm:text-sm text-gray-500 mt-1">kcal per step</p>
                  </div>
                  <div className="text-center">
                    {loading ? (
                      <div className="flex flex-col items-center gap-2">
                        <div className="h-9 sm:h-10 md:h-12 w-20 sm:w-24 bg-gradient-to-r from-gray-400/70 via-gray-300/50 to-gray-400/70 rounded-lg animate-pulse"></div>
                      </div>
                    ) : (
                      <p className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">{(todaySteps / 1000).toFixed(1)}k</p>
                    )}
                    <p className="text-xs sm:text-sm text-gray-500 mt-1">steps in thousands</p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Slide 2: History */}
            <div ref={historyPanelRef} className="w-1/2 flex-shrink-0 p-4 sm:p-6 md:p-8">
              <div>
                <h3 className="text-xs sm:text-sm md:text-base font-medium text-gray-600 mb-3 sm:mb-4">Activity History</h3>
                
                {/* Toggle Week/Month */}
                <div className="flex gap-2 mb-3 sm:mb-4">
                  <button
                    onClick={() => setHistoryView('week')}
                    className={`flex-1 py-2 px-3 sm:px-4 rounded-lg text-xs sm:text-sm font-semibold transition-colors ${
                      historyView === 'week'
                        ? 'bg-emerald-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    This Week
                  </button>
                  <button
                    onClick={() => setHistoryView('month')}
                    className={`flex-1 py-2 px-3 sm:px-4 rounded-lg text-xs sm:text-sm font-semibold transition-colors ${
                      historyView === 'month'
                        ? 'bg-emerald-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    This Month
                  </button>
                </div>
                
                {/* History List */}
                {dailyHistory.length > 0 && (
                  <>
                    <div className="space-y-2 max-h-64 sm:max-h-80 md:max-h-96 overflow-y-auto mb-3 sm:mb-4">
                      {(historyView === 'week' ? dailyHistory.slice(-7) : dailyHistory).map((day, index) => {
                        const date = new Date(day.date);
                        const isToday = toDateKey(date) === toDateKey();
                        const displaySteps = isToday ? todaySteps : (day.steps || 0);
                        const displayCalories = isToday ? todayCalories : (day.calories || 0);
                        
                        return (
                          <div
                            key={day.date}
                            className={`flex items-center justify-between p-2 sm:p-3 rounded-lg border ${
                              isToday
                                ? 'bg-emerald-50 border-emerald-200'
                                : 'bg-gray-50 border-gray-200'
                            }`}
                          >
                            <div className="flex items-center gap-2 sm:gap-3">
                              <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center ${
                                isToday ? 'bg-emerald-500' : 'bg-gray-300'
                              }`}>
                                <span className="text-white font-bold text-xs sm:text-sm">
                                  {date.toLocaleDateString('en-US', { weekday: 'short' })[0]}
                                </span>
                              </div>
                              <div>
                                <p className={`font-semibold text-xs sm:text-sm ${isToday ? 'text-emerald-900' : 'text-gray-900'}`}>
                                  {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                  {isToday && <span className="ml-1 sm:ml-2 text-xs text-emerald-600">Today</span>}
                                </p>
                                <p className="text-xs sm:text-xs text-gray-500 hidden sm:block">{date.toLocaleDateString('en-US', { weekday: 'long' })}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-sm sm:text-base text-gray-900">{displaySteps.toLocaleString()}</p>
                              <p className="text-xs text-gray-500">{displayCalories} kcal</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* Summary */}
                    <div className="pt-3 sm:pt-4 border-t border-gray-200 grid grid-cols-2 gap-3 sm:gap-4">
                      <div className="text-center">
                        <p className="text-xs sm:text-sm text-gray-600 mb-1">Average</p>
                        <p className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">
                          {Math.round(
                            (historyView === 'week' ? dailyHistory.slice(-7) : dailyHistory).reduce((sum, day) => {
                              const isToday = toDateKey(new Date(day.date)) === toDateKey();
                              return sum + (isToday ? todaySteps : (day.steps || 0));
                            }, 0) / (historyView === 'week' ? Math.min(7, dailyHistory.length) : dailyHistory.length)
                          ).toLocaleString()}
                        </p>
                        <p className="text-xs sm:text-sm text-gray-500">steps/day</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs sm:text-sm text-gray-600 mb-1">Total</p>
                        <p className="text-xl sm:text-2xl md:text-3xl font-bold text-rose-900">
                          {Math.round(
                            (historyView === 'week' ? dailyHistory.slice(-7) : dailyHistory).reduce((sum, day) => {
                              const isToday = toDateKey(new Date(day.date)) === toDateKey();
                              return sum + (isToday ? todayCalories : (day.calories || 0));
                            }, 0)
                          ).toLocaleString()}
                        </p>
                        <p className="text-xs sm:text-sm text-gray-500">kcal</p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
              </div>
            </div>
            
            {/* Right Navigation Button */}
            {currentSlide === 0 && (
              <button
                onClick={() => setCurrentSlide(1)}
                className="flex-shrink-0 p-2 sm:p-3 hover:bg-emerald-50 transition-all duration-300 border-l border-gray-100"
                aria-label="Next slide"
              >
                <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6 text-gray-600" />
              </button>
            )}
          </div>
          
          {/* Slide Indicators */}
          <div className="flex justify-center gap-2 py-3 sm:py-4 border-t border-gray-100">
            <button
              onClick={() => setCurrentSlide(0)}
              className={`h-1.5 sm:h-2 rounded-full transition-all ${
                currentSlide === 0 ? 'w-6 sm:w-8 bg-emerald-500' : 'w-1.5 sm:w-2 bg-gray-300'
              }`}
              aria-label="Go to Today view"
            />
            <button
              onClick={() => setCurrentSlide(1)}
              className={`h-1.5 sm:h-2 rounded-full transition-all ${
                currentSlide === 1 ? 'w-6 sm:w-8 bg-emerald-500' : 'w-1.5 sm:w-2 bg-gray-300'
              }`}
              aria-label="Go to History view"
            />
          </div>
        </div>
        
      </div>
    </div>
  );
};

export default StepCounter;
