/**
 * useCarouselSwipe — generic N-card horizontal swipe for touch/pointer devices.
 *
 * Mirrors the pointer-event pattern used in useSwipePanelHeight (36px threshold,
 * primary pointer only) but supports N cards and exposes an active index rather
 * than a named panel key.
 *
 * Resets to card 0 whenever `resetKey` changes (e.g. on date change).
 */
import { useState, useRef, useCallback, useEffect } from 'react';

const SWIPE_THRESHOLD_PX = 36;

export function useCarouselSwipe({ cardCount, resetKey }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const swipeRef = useRef({ active: false, startX: 0, lastX: 0 });

  // Reset to first card when the caller supplies a new resetKey.
  useEffect(() => {
    setActiveIndex(0);
  }, [resetKey]);

  const onPointerDown = useCallback((e) => {
    if (!e.isPrimary) return;
    swipeRef.current.active = true;
    swipeRef.current.startX = e.clientX;
    swipeRef.current.lastX  = e.clientX;
  }, []);

  const onPointerMove = useCallback((e) => {
    if (!swipeRef.current.active || !e.isPrimary) return;
    swipeRef.current.lastX = e.clientX;
  }, []);

  const onPointerUp = useCallback(() => {
    const s = swipeRef.current;
    if (!s.active) return;
    s.active = false;
    const delta = s.lastX - s.startX;
    if (Math.abs(delta) < SWIPE_THRESHOLD_PX) return;
    if (delta < 0) {
      setActiveIndex((i) => Math.min(i + 1, cardCount - 1));
    } else {
      setActiveIndex((i) => Math.max(i - 1, 0));
    }
  }, [cardCount]);

  const goTo = useCallback((index) => {
    setActiveIndex(Math.min(Math.max(index, 0), cardCount - 1));
  }, [cardCount]);

  return { activeIndex, goTo, swipeHandlers: { onPointerDown, onPointerMove, onPointerUp } };
}
