/**
 * useSummarySwipe.js — touch-driven horizontal swipe between two view ids.
 *
 * Returns a ref to attach to the swipeable element. Calls onChange with
 * either 'next' or 'prev' when the user swipes more than 40 px.
 */
import { useEffect, useRef } from 'react';

export default function useSummarySwipe(onSwipe) {
  const ref = useRef(null);
  const startX = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onStart = (e) => { startX.current = e.touches[0].clientX; };
    const onMove = (e) => {
      if (startX.current == null) return;
      const dx = Math.abs(startX.current - e.touches[0].clientX);
      if (dx > 5) e.preventDefault();
    };
    const onEnd = (e) => {
      if (startX.current == null) return;
      const diff = startX.current - e.changedTouches[0].clientX;
      startX.current = null;
      if (Math.abs(diff) > 40) onSwipe(diff > 0 ? 'next' : 'prev');
    };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
    };
  }, [onSwipe]);

  return ref;
}
