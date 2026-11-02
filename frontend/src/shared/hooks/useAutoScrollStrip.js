/**
 * @file useAutoScrollStrip — GPU-smooth infinite marquee (translate3d).
 * Tap toggles pause. Horizontal swipe scrubs the strip, then resumes
 * (unless the user had already tapped to pause).
 */

import { useCallback, useEffect, useRef, useState } from 'react';

const DRAG_THRESHOLD_PX = 18;
/** Pixels per second — smooth time-based motion (not per-frame jumps). */
const DEFAULT_PX_PER_SEC = 55;

/**
 * @param {object} opts
 * @param {boolean} [opts.enabled=true]
 * @param {number}  [opts.pxPerSec=55]  Auto-scroll speed in px/second
 * @returns {{
 *   viewportRef: React.MutableRefObject<HTMLElement|null>,
 *   trackRef: React.MutableRefObject<HTMLElement|null>,
 *   isPaused: boolean,
 *   interactionHandlers: {
 *     onPointerDown: (e: PointerEvent) => void,
 *     onClick: () => void,
 *   },
 * }}
 */
export function useAutoScrollStrip({ enabled = true, pxPerSec = DEFAULT_PX_PER_SEC } = {}) {
  const viewportRef = useRef(null);
  const trackRef = useRef(null);
  const offsetRef = useRef(0);
  const pausedRef = useRef(false);
  const trackingRef = useRef(null);
  const didDragRef = useRef(false);
  const [isPaused, setIsPaused] = useState(false);

  const setPaused = useCallback((next) => {
    pausedRef.current = next;
    setIsPaused(next);
  }, []);

  // Time-based translate3d loop — runs on compositor, feels smooth
  useEffect(() => {
    if (!enabled) return undefined;

    let rafId = 0;
    let lastTs = 0;

    const tick = (ts) => {
      if (!lastTs) lastTs = ts;
      const dt = Math.min(64, ts - lastTs); // clamp huge tab-blur gaps
      lastTs = ts;

      const track = trackRef.current;
      if (track && !pausedRef.current) {
        const half = track.scrollWidth / 2;
        if (half > 0) {
          offsetRef.current += (pxPerSec * dt) / 1000;
          if (offsetRef.current >= half) {
            offsetRef.current -= half;
          }
          track.style.transform = `translate3d(${-offsetRef.current}px,0,0)`;
        }
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [enabled, pxPerSec]);

  // Re-apply transform after data/layout changes
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return undefined;
    const apply = () => {
      track.style.transform = `translate3d(${-offsetRef.current}px,0,0)`;
    };
    apply();
    const ro = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(apply)
      : null;
    if (ro) ro.observe(track);
    return () => ro?.disconnect();
  }, [enabled]);

  const detachTracking = useCallback(() => {
    const t = trackingRef.current;
    if (!t) return;
    window.removeEventListener('pointermove', t.onMove);
    window.removeEventListener('pointerup', t.onEnd);
    window.removeEventListener('pointercancel', t.onEnd);
    trackingRef.current = null;
  }, []);

  useEffect(() => () => detachTracking(), [detachTracking]);

  const onPointerDown = useCallback((e) => {
    if (e.button != null && e.button !== 0) return;

    detachTracking();
    didDragRef.current = false;

    const startX = e.clientX;
    const startY = e.clientY;
    const startOffset = offsetRef.current;
    const wasPaused = pausedRef.current;
    let dragging = false;

    const onMove = (ev) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!dragging && Math.abs(dx) > DRAG_THRESHOLD_PX && Math.abs(dx) >= Math.abs(dy)) {
        dragging = true;
        didDragRef.current = true;
        pausedRef.current = true; // hold auto-scroll while scrubbing
      }
      if (!dragging) return;

      const track = trackRef.current;
      if (!track) return;
      const half = track.scrollWidth / 2;
      if (half <= 0) return;

      // Drag right → reveal earlier content (decrease offset)
      let next = startOffset - dx;
      while (next < 0) next += half;
      while (next >= half) next -= half;
      offsetRef.current = next;
      track.style.transform = `translate3d(${-next}px,0,0)`;
    };

    const onEnd = () => {
      detachTracking();
      if (dragging) {
        // Restore tap-pause state after swipe
        setPaused(wasPaused);
      }
    };

    trackingRef.current = { onMove, onEnd };
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerup', onEnd, { passive: true });
    window.addEventListener('pointercancel', onEnd, { passive: true });
  }, [detachTracking, setPaused]);

  const onClick = useCallback(() => {
    if (didDragRef.current) {
      didDragRef.current = false;
      return;
    }
    setPaused(!pausedRef.current);
  }, [setPaused]);

  return {
    viewportRef,
    trackRef,
    isPaused,
    interactionHandlers: {
      onPointerDown,
      onClick,
    },
  };
}
