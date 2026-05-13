import { useCallback, useEffect, useRef, useState } from 'react';

const SWIPE_DELETE_THRESHOLD = 140;
const SWIPE_MAX = 140;

export function useSwipeToDelete({ onDelete }) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [armed, setArmed] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [deletedOnce, setDeletedOnce] = useState(false);

  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const dxRef = useRef(0);
  const rafRef = useRef(null);
  const elRef = useRef(null);
  const draggingRef = useRef(false);
  const armedRef = useRef(false);
  const touchBlockedRef = useRef(false);

  const cancelRAF = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  const applyDelta = useCallback((clientX) => {
    const delta = clientX - startXRef.current;
    const nextDx = Math.max(Math.min(delta, 0), -SWIPE_MAX);
    dxRef.current = nextDx;
    if (!rafRef.current) {
      rafRef.current = requestAnimationFrame(() => {
        setDx(dxRef.current);
        rafRef.current = null;
        const isNowArmed = Math.abs(dxRef.current) >= SWIPE_DELETE_THRESHOLD;
        if (isNowArmed !== armedRef.current) {
          armedRef.current = isNowArmed;
          setArmed(isNowArmed);
          if (isNowArmed && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            try { navigator.vibrate(10); } catch {}
          }
        }
      });
    }
  }, []);

  const finishGesture = useCallback(() => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setDragging(false);
    cancelRAF();
    if (Math.abs(dxRef.current) >= SWIPE_DELETE_THRESHOLD) {
      if (deletedOnce) return;
      setDeletedOnce(true);
      setLeaving(true);
      setAnimating(true);
      requestAnimationFrame(() => {
        setDx(-window.innerWidth);
        dxRef.current = -window.innerWidth;
        setTimeout(() => { onDelete && onDelete(); }, 180);
      });
      return;
    }
    setAnimating(true);
    requestAnimationFrame(() => {
      setDx(0);
      dxRef.current = 0;
      setTimeout(() => { setAnimating(false); setArmed(false); armedRef.current = false; }, 220);
    });
  }, [deletedOnce, onDelete]);

  const onTouchStart = (e) => {
    if (leaving) return;
    touchBlockedRef.current = false;
    const t = e.touches[0];
    startXRef.current = t.clientX;
    startYRef.current = t.clientY;
    dxRef.current = 0;
    draggingRef.current = true;
    setDragging(true);
    setAnimating(false);
  };

  const onTouchMove = (e) => {
    if (!draggingRef.current || leaving) return;
    const t = e.touches[0];
    const deltaX = t.clientX - startXRef.current;
    const deltaY = t.clientY - startYRef.current;
    if (!touchBlockedRef.current && Math.abs(deltaY) > Math.abs(deltaX) + 5) {
      touchBlockedRef.current = true;
      draggingRef.current = false;
      setDragging(false);
      cancelRAF();
      setAnimating(true);
      requestAnimationFrame(() => { setDx(0); dxRef.current = 0; setTimeout(() => setAnimating(false), 220); });
      return;
    }
    if (touchBlockedRef.current) return;
    if (deltaX < 0) e.preventDefault();
    applyDelta(t.clientX);
  };

  const onPointerDown = (e) => {
    if (!e.isPrimary || leaving || e.pointerType === 'touch') return;
    cancelRAF();
    draggingRef.current = true;
    setDragging(true);
    setAnimating(false);
    startXRef.current = e.clientX;
    dxRef.current = 0;
    try { elRef.current?.setPointerCapture?.(e.pointerId); } catch {}
  };

  const onPointerMove = (e) => {
    if (!draggingRef.current || !e.isPrimary || leaving || e.pointerType === 'touch') return;
    applyDelta(e.clientX);
  };

  const stopIfNotTouch = (e) => { if (e.pointerType !== 'touch') finishGesture(); };

  useEffect(() => () => cancelRAF(), []);

  const progress = Math.min(1, Math.abs(dx) / SWIPE_DELETE_THRESHOLD);
  const scale = leaving ? 1 : 1 - Math.min(0.03, Math.abs(dx) / 1000);

  return {
    dx, dragging, animating, armed, leaving, progress, scale, elRef,
    handlers: {
      onTouchStart, onTouchMove, onTouchEnd: finishGesture, onTouchCancel: finishGesture,
      onPointerDown, onPointerMove, onPointerUp: stopIfNotTouch,
      onPointerCancel: stopIfNotTouch, onPointerLeave: stopIfNotTouch,
    },
  };
}

export { SWIPE_DELETE_THRESHOLD, SWIPE_MAX };
