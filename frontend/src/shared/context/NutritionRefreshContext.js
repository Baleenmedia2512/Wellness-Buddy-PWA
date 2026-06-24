/**
 * NutritionRefreshContext — Centralized nutrition data refresh orchestration
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
 * USAGE:
 *   const { triggerRefresh } = useNutritionRefresh();
 *   await saveMeal();
 *   triggerRefresh(); // Updates everywhere instantly
 */
import React, { createContext, useContext, useState, useCallback, startTransition } from 'react';

const NutritionRefreshContext = createContext(null);

export function NutritionRefreshProvider({ children }) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [pendingRefresh, setPendingRefresh] = useState(false);

  /**
   * Trigger a global nutrition data refresh.
   * Wrapped in startTransition to prevent Suspense errors.
   * @param {Object} options
   * @param {boolean} options.immediate - Skip debounce (default: false)
   * @param {string} options.source - Debug label for who triggered refresh
   */
  const triggerRefresh = useCallback((options = {}) => {
    const { immediate = false, source = 'unknown' } = options;

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
