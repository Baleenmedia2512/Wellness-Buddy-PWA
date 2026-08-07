/**
 * NutritionRefreshContext — Centralized nutrition / Home dashboard refresh
 *
 * WHY THIS EXISTS:
 * Before: nutritionRefreshKey was only incremented in App.js after camera saves.
 * Edits, deletes, unknowns, retries in NutritionDashboard didn't refresh home screen cards.
 *
 * Solution: Global context that any component can trigger to refresh ALL nutrition views:
 *   - HomeNutritionCarousel (home screen cards)
 *   - NutritionDashboard (detailed meal list)
 *   - Any future nutrition displays
 *
 * ACTIVITY LOG (Home skip-refresh):
 * `triggerRefresh` also advances the shared activity watermark in
 * `homeDashboardActivity.js`. Home only reloads APIs when that watermark is
 * newer than the last one it processed — navigation alone does not reload.
 *
 * USAGE:
 *   const { triggerRefresh } = useNutritionRefresh();
 *   await saveMeal();
 *   triggerRefresh({ immediate: true, source: 'meal-edit' });
 */
import React, { createContext, useContext, useState, useCallback, useRef, startTransition } from 'react';
import { recordDashboardActivity, shouldRefreshHomeDashboard } from '../services/homeDashboardActivity';
import { STALE_PENDING_MS } from '../../features/diary/utils/stalePending';

const NutritionRefreshContext = createContext(null);

/**
 * Safety-net timeout for the "Analyzing…" diary row state.
 *
 * Matches the Phase-1 budget (3 attempts + 15 s grace). If
 * clearCaptureAnalyzing() is never reached, this timeout auto-expires the
 * entry so the user sees Manual Log instead of "Analyzing…" indefinitely.
 */
const ANALYZING_TIMEOUT_MS = STALE_PENDING_MS + 5_000;

export function NutritionRefreshProvider({ children }) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [pendingRefresh, setPendingRefresh] = useState(false);
  /** Capture IDs whose background AI analysis is in-flight. */
  const [analyzingCaptureIds, setAnalyzingCaptureIds] = useState(() => new Set());
  /** Optimistic diary metadata keyed by capture ID (image shown before list refetch). */
  const [pendingCaptureMeta, setPendingCaptureMeta] = useState(() => new Map());

  /**
   * Map of captureId → timeoutId for the ANALYZING_TIMEOUT_MS safety-net timers.
   * Stored in a ref so it is stable across renders without needing to be in
   * any useCallback dependency array.
   */
  const _analyzingTimers = useRef(new Map());

  const markCaptureAnalyzing = useCallback((captureId, meta = {}) => {
    if (captureId == null || captureId === '') return;
    const id = String(captureId);

    // Cancel any existing auto-clear timer (e.g. re-analysis of the same capture).
    if (_analyzingTimers.current.has(id)) {
      clearTimeout(_analyzingTimers.current.get(id));
    }

    setAnalyzingCaptureIds((prev) => {
      if (prev.has(id)) return prev;
      return new Set([...prev, id]);
    });

    // Always update pendingCaptureMeta (merge so image data is never wiped when
    // only the attempt number changes on subsequent onAttempt callbacks).
    setPendingCaptureMeta((prev) => {
      const existing = prev.get(id) ?? {};
      const next = new Map(prev);
      next.set(id, {
        ownerUserId:    meta.ownerUserId    ?? existing.ownerUserId    ?? null,
        imageBase64:    meta.imageBase64    ?? existing.imageBase64    ?? null,
        imagePath:      meta.imagePath      ?? existing.imagePath      ?? null,
        capturedAt:     meta.capturedAt     ?? existing.capturedAt     ?? new Date().toISOString(),
        currentAttempt: meta.currentAttempt ?? existing.currentAttempt ?? null,
        totalAttempts:  meta.totalAttempts  ?? existing.totalAttempts  ?? null,
      });
      return next;
    });

    // Safety net: auto-clear after ANALYZING_TIMEOUT_MS so diary rows never
    // show "AI is analysing…" for hours when a code path misses the manual clear.
    const timerId = setTimeout(() => {
      _analyzingTimers.current.delete(id);
      setAnalyzingCaptureIds((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setPendingCaptureMeta((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
    }, ANALYZING_TIMEOUT_MS);

    _analyzingTimers.current.set(id, timerId);
  }, []);

  const clearCaptureAnalyzing = useCallback((captureId) => {
    if (captureId == null || captureId === '') return;
    const id = String(captureId);

    // Cancel the safety-net timer since we're clearing manually.
    if (_analyzingTimers.current.has(id)) {
      clearTimeout(_analyzingTimers.current.get(id));
      _analyzingTimers.current.delete(id);
    }

    setAnalyzingCaptureIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setPendingCaptureMeta((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  /**
   * Trigger a global nutrition / Home dashboard refresh.
   * Also records an async activity-log entry so remounted Home can decide
   * whether a refetch is needed (newer log) or can keep cached state.
   *
   * Wrapped in startTransition to prevent Suspense errors.
   * @param {Object} options
   * @param {boolean} options.immediate - Skip debounce (default: false)
   * @param {string} options.source - Debug label for who triggered refresh
   */
  const triggerRefresh = useCallback((options = {}) => {
    const { immediate = false, source = 'unknown' } = options;

    // Async activity log: durable watermark for "did anything change?"
    recordDashboardActivity(source);

    if (process.env.NODE_ENV !== 'production') {
      // Use the functional-update form below, so we do NOT need refreshKey
      // in the closure here — the stale value would only be wrong in logs.
      console.log(`🔄 [NutritionRefresh] Triggered by: ${source}`, { immediate });
    }

    // Immediate refresh (used after saves/deletes) - wrapped in startTransition
    if (immediate) {
      startTransition(() => {
        setRefreshKey(prev => {
          const newKey = prev + 1;
          if (process.env.NODE_ENV !== 'production') {
            console.log(`🔄 [NutritionRefresh] Key updated: ${prev} → ${newKey}`);
          }
          return newKey;
        });
        setPendingRefresh(false);
      });
      return;
    }

    // Debounced refresh (accumulate rapid edits) - also wrapped in startTransition
    setPendingRefresh(prev => {
      if (!prev) {
        setTimeout(() => {
          startTransition(() => {
            setRefreshKey(k => k + 1);
            setPendingRefresh(false);
          });
        }, 300); // 300ms debounce window
        return true;
      }
      return prev; // Already pending, skip
    });
  }, []); // stable — uses functional-update form for setRefreshKey, no stale closure risk

  /**
   * Called when the user returns to Home from a nav tab.
   * Only bumps refreshKey when a real mutation advanced the activity log
   * (AI analysis, manual log, meal edit, etc.). Plain tab switches do nothing.
   */
  const refreshOnTabFocus = useCallback(() => {
    if (!shouldRefreshHomeDashboard()) return;
    startTransition(() => {
      setRefreshKey((prev) => prev + 1);
    });
  }, []);

  const value = {
    refreshKey,
    triggerRefresh,
    refreshOnTabFocus,
    pendingRefresh,
    analyzingCaptureIds,
    pendingCaptureMeta,
    markCaptureAnalyzing,
    clearCaptureAnalyzing,
  };

  return (
    <NutritionRefreshContext.Provider value={value}>
      {children}
    </NutritionRefreshContext.Provider>
  );
}

export function useNutritionRefresh() {
  const context = useContext(NutritionRefreshContext);
  if (!context) {
    throw new Error('useNutritionRefresh must be used within NutritionRefreshProvider');
  }
  return context;
}

/** Soft read — returns null when rendered outside the provider (e.g. isolated tests). */
export function useNutritionRefreshOptional() {
  return useContext(NutritionRefreshContext);
}
