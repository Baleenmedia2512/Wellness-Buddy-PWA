/**
 * useSwipePanelHeight — overview panel swipe + dynamic height sync.
 *
 * Responsibilities:
 *  - track active overview panel ('summary' | 'trend')
 *  - swipe gesture handlers (pointer-based, 36px threshold)
 *  - measure active panel scrollHeight and expose it for animated container height
 *  - keep height in sync with content/layout changes via `heightDeps`
 *
 * Extracted from NutritionDashboard.js. Swipe direction, threshold, and
 * height re-measurement timing (rAF + resize) preserved exactly.
 */
import { useState, useEffect, useRef, useCallback } from 'react';

export function useSwipePanelHeight({ heightDeps = [] } = {}) {
  const [activeOverviewPanel, setActiveOverviewPanel] = useState('summary');
  const [overviewPanelHeight, setOverviewPanelHeight] = useState(null);
  const overviewSwipeRef = useRef({ active: false, startX: 0, lastX: 0 });
  const summaryPanelRef = useRef(null);
  const trendPanelRef = useRef(null);

  const handleOverviewPointerDown = useCallback((e) => {
    if (!e.isPrimary) return;
    overviewSwipeRef.current.active = true;
    overviewSwipeRef.current.startX = e.clientX;
    overviewSwipeRef.current.lastX = e.clientX;
  }, []);

  const handleOverviewPointerMove = useCallback((e) => {
    if (!overviewSwipeRef.current.active || !e.isPrimary) return;
    overviewSwipeRef.current.lastX = e.clientX;
  }, []);

  const handleOverviewPointerEnd = useCallback(() => {
    const swipe = overviewSwipeRef.current;
    if (!swipe.active) return;
    swipe.active = false;

    const deltaX = swipe.lastX - swipe.startX;
    const threshold = 36;
    if (Math.abs(deltaX) < threshold) return;

    if (deltaX < 0) {
      setActiveOverviewPanel('trend');
    } else {
      setActiveOverviewPanel('summary');
    }
  }, []);

  // Measure active panel height on mount, panel switch, and content changes.
  useEffect(() => {
    const updateOverviewHeight = () => {
      const activeRef =
        activeOverviewPanel === 'summary' ? summaryPanelRef : trendPanelRef;
      if (activeRef.current) {
        setOverviewPanelHeight(activeRef.current.scrollHeight);
      }
    };

    // Wait one frame so content/layout is fully settled.
    const rafId = requestAnimationFrame(updateOverviewHeight);
    window.addEventListener('resize', updateOverviewHeight);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', updateOverviewHeight);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: listed deps would cause an infinite re-render
  }, [activeOverviewPanel, ...heightDeps]);

  return {
    activeOverviewPanel,
    setActiveOverviewPanel,
    overviewPanelHeight,
    summaryPanelRef,
    trendPanelRef,
    swipeHandlers: {
      onPointerDown: handleOverviewPointerDown,
      onPointerMove: handleOverviewPointerMove,
      onPointerUp: handleOverviewPointerEnd,
      onPointerCancel: handleOverviewPointerEnd,
      onPointerLeave: handleOverviewPointerEnd,
    },
  };
}
