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
import React, { createContext, useContext, useState, useCallback, startTransition } from 'react';
import { recordDashboardActivity } from '../services/homeDashboardActivity';

const NutritionRefreshContext = createContext(null);

export function NutritionRefreshProvider({ children }) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [pendingRefresh, setPendingRefresh] = useState(false);
  /** Capture IDs whose background AI analysis is in-flight. */
  const [analyzingCaptureIds, setAnalyzingCaptureIds] = useState(() => new Set());
  /** Optimistic diary metadata keyed by capture ID (image shown before list refetch). */
  const [pendingCaptureMeta, setPendingCaptureMeta] = useState(() => new Map());

  const markCaptureAnalyzing = useCallback((captureId, meta = {}) => {
    if (captureId == null || captureId === '') return;
    const id = String(captureId);
    setAnalyzingCaptureIds((prev) => {
      if (prev.has(id)) return prev;
      return new Set([...prev, id]);
    });
    if (meta && (meta.imageBase64 || meta.imagePath || meta.capturedAt)) {
      setPendingCaptureMeta((prev) => {
        const next = new Map(prev);
        next.set(id, {
          imageBase64: meta.imageBase64 ?? null,
          imagePath: meta.imagePath ?? null,
          capturedAt: meta.capturedAt ?? new Date().toISOString(),
        });
        return next;
      });
    }
  }, []);

  const clearCaptureAnalyzing = useCallback((captureId) => {
    if (captureId == null || captureId === '') return;
    const id = String(captureId);
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

  const value = {
    refreshKey,
    triggerRefresh,
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
