/**
 * useStepDateGuard.js — wrong device date detection.
 *
 * Two probes:
 *   - detectSilentTimeDrift on every focus/resume (used internally by
 *     `useStepRecovery` to decide whether to re-anchor the baseline).
 *   - Server date check on mount + every SERVER_DATE_CHECK_INTERVAL_MS,
 *     surfacing a wrongDateWarning string when device clock disagrees.
 *
 * Mirrors `wrongDateWarning` into refs.wrongDateWarningRef so the save
 * paths can short-circuit without React re-render.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  detectSilentTimeDrift, fetchServerDateMismatch,
} from '../services/stepCounterTimeGuard';
import { SERVER_DATE_CHECK_INTERVAL_MS } from '../services/stepCounterConstants';

export function useStepDateGuard({ refs }) {
  const [wrongDateWarning, setWrongDateWarning] = useState(null);

  // Mirror to ref so callbacks read the latest value synchronously
  useEffect(() => { refs.wrongDateWarningRef.current = wrongDateWarning; }, [wrongDateWarning, refs.wrongDateWarningRef]);

  const checkDeviceDateVsServer = useCallback(async () => {
    const mismatch = await fetchServerDateMismatch();
    setWrongDateWarning(mismatch); // null clears the banner on agreement
  }, []);

  const runDriftCheck = useCallback(() => {
    refs.driftDetectedRef.current = detectSilentTimeDrift();
  }, [refs.driftDetectedRef]);

  useEffect(() => {
    runDriftCheck();
    checkDeviceDateVsServer();
    const t = setInterval(checkDeviceDateVsServer, SERVER_DATE_CHECK_INTERVAL_MS);
    return () => clearInterval(t);
  }, [runDriftCheck, checkDeviceDateVsServer]);

  return { wrongDateWarning, setWrongDateWarning, checkDeviceDateVsServer, runDriftCheck };
}
