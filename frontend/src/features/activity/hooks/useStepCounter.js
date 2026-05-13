/**
 * useStepCounter.js — top-level orchestrator the page component consumes.
 *
 * Wires together every specialised step hook, syncs the stable callback
 * refs, owns the mount-once sensor lifecycle effect and exposes a single
 * flat view-model. The page component is left with nothing to do but
 * destructure and render.
 */
import { useState, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { StepCounterPlugin } from '../../../shared/plugins/stepCounterPlugin';
import { GalleryMonitorPlugin } from '../../../shared/plugins/galleryMonitorPlugin';
import {
  cleanupOldStorageKeys, readLastSavedTime,
} from '../services/stepCounterStorage';
import { saveStepsForDate } from '../services/stepCounterPersistence';
import { toDateKey } from '../services/stepCounterCalculations';
import { useStepRefs } from './useStepRefs';
import { useStepPermissions } from './useStepPermissions';
import { useStepDateGuard } from './useStepDateGuard';
import { useStepSensor } from './useStepSensor';
import { useStepPersistence } from './useStepPersistence';
import { useStepAutoSave } from './useStepAutoSave';
import { useStepSync } from './useStepSync';
import { useStepRecovery } from './useStepRecovery';
import { useStepGps } from './useStepGps';
import { useStepCharts } from './useStepCharts';
import { useStepCalculations } from './useStepCalculations';
import { useStepGoals } from './useStepGoals';

export function useStepCounter({ userId, user, userRole = 'user' }) {
  const isNativePlatform = Capacitor.isNativePlatform();
  const isCoach = ['coach', 'coCoach', 'admin', 'developer'].includes(userRole);

  // UI state
  const [ready, setReady]                   = useState(false);
  const [loading, setLoading]               = useState(true);
  const [todaySteps, setTodaySteps]         = useState(0);
  const [todayCalories, setTodayCalories]   = useState(0);
  const [lastUpdated, setLastUpdated]       = useState(null);
  const [error, setError]                   = useState(null);
  const [saving]                            = useState(false);
  const [lastSaved, setLastSaved]           = useState(() => readLastSavedTime());
  const [refreshing, setRefreshing]         = useState(false);
  const [refreshDone, setRefreshDone]       = useState(false);
  const [suspiciousActivity, setSuspiciousActivity] = useState(null);
  const [selectedMember, setSelectedMember] = useState(null);

  const refs = useStepRefs();
  const dateGuard = useStepDateGuard({ refs });
  const perms = useStepPermissions({ userId, refs });
  const sensor = useStepSensor({
    refs,
    setSensorAvailable: perms.setSensorAvailable,
    setPermissionGranted: perms.setPermissionGranted,
    setLoading, setError, setTodaySteps, setTodayCalories, setLastUpdated, setSuspiciousActivity,
  });
  const persistence = useStepPersistence({ refs });
  const autoSave    = useStepAutoSave({ refs, setTodaySteps, setTodayCalories });
  const charts      = useStepCharts({ refs, selectedMember });

  // Wire stable callback refs (synchronous before effects)
  refs.saveStepsToDatabaseRef.current = persistence.saveStepsToDatabase;
  refs.processSensorValueRef.current  = sensor.processSensorValue;
  refs.loadDailyHistoryRef.current    = charts.loadDailyHistory;

  useStepSync({
    refs, resolvedUserId: perms.resolvedUserId, isNativePlatform,
    setLastSaved, setLoading, setTodaySteps, setTodayCalories,
    runDriftCheck: dateGuard.runDriftCheck,
    checkDeviceDateVsServer: dateGuard.checkDeviceDateVsServer,
  });

  const recovery = useStepRecovery({
    refs, isNativePlatform, setRefreshing, setRefreshDone,
    setLastSaved, setTodaySteps, setTodayCalories,
  });

  const gps = useStepGps({ refs, setSuspiciousActivity });

  // Sensor lifecycle (mount once)
  const lifecycleStartedRef = useRef(false);
  useEffect(() => {
    if (lifecycleStartedRef.current) return;
    lifecycleStartedRef.current = true;
    cleanupOldStorageKeys();
    if (isNativePlatform) sensor.initStepTracking(); else setLoading(false);
    autoSave.setupMidnightReset();
    setReady(true);
    return () => {
      const stepsOnClose = refs.todayStepsRef.current;
      const userOnClose  = refs.resolvedUserIdRef.current;
      if (userOnClose && stepsOnClose > 0 && !refs.wrongDateWarningRef.current) {
        saveStepsForDate({
          userId: userOnClose, dateKey: toDateKey(),
          steps: stepsOnClose, sensorTotal: refs.latestSensorTotalRef.current,
        }).catch(() => {});
        GalleryMonitorPlugin.forceSaveTodaySteps().catch(() => {});
      }
      if (refs.midnightTimerRef.current) clearTimeout(refs.midnightTimerRef.current);
      if (refs.autoSaveTimerRef.current) clearInterval(refs.autoSaveTimerRef.current);
      if (refs.pollIntervalRef.current)  clearInterval(refs.pollIntervalRef.current);
      if (isNativePlatform) {
        StepCounterPlugin.stopTracking().catch(() => {});
        refs.sensorListenerRef.current?.remove?.().catch(() => {});
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Start auto-save timer once userId resolves
  useEffect(() => {
    if (!perms.resolvedUserId) return;
    autoSave.setupAutoSave();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perms.resolvedUserId]);

  const calc  = useStepCalculations({
    selectedMember, memberData: charts.memberData,
    todaySteps, todayCalories, dailyHistory: charts.dailyHistory, loading,
  });
  const goals = useStepGoals(calc.displaySteps);
  const historyData = charts.sliceForView(calc.displayHistory);

  return {
    user, isCoach, isNativePlatform,
    ready, loading, error, saving, lastSaved, lastUpdated,
    refreshing, refreshDone, suspiciousActivity, setSuspiciousActivity,
    todaySteps, todayCalories,
    sensorAvailable: perms.sensorAvailable, permissionGranted: perms.permissionGranted,
    requestPermission: () => perms.requestSensorPermission(sensor.initStepTracking),
    wrongDateWarning: dateGuard.wrongDateWarning, dismissWrongDate: () => dateGuard.setWrongDateWarning(null),
    handleManualRefresh: recovery.handleManualRefresh,
    selectedMember, setSelectedMember,
    historyView: charts.historyView, setHistoryView: charts.setHistoryView,
    historyData, ...calc, ...goals,
    lastGpsPos: gps.lastGpsPos, outdoorDistance: gps.outdoorDistance, outdoorSteps: gps.outdoorSteps,
  };
}
