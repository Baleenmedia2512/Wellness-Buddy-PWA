// src/components/WeightCard.js
import React, { useState, useRef, useEffect } from 'react';
import { Scale } from 'lucide-react';
import { istToLocalDate } from '../../../shared/utils/timezoneUtils';

/**
 * WeightCard Component
 * Modern card with profile photo, name, grams diff, and swipe-to-delete
 */
const WeightCard = React.memo(({ 
  data, 
  onDelete, 
  onView,
  previousWeight = null,
  index = 0,
  userName = 'User',
  profileImage = null,
}) => {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [armed, setArmed] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [deletedOnce, setDeletedOnce] = useState(false);

  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const dxRef = useRef(0);
  const draggingRef = useRef(false);
  const armedRef = useRef(false);
  const touchBlockedRef = useRef(false);
  const rafRef = useRef(null);
  const elRef = useRef(null);

  const SWIPE_DELETE_THRESHOLD = 100;
  const SWIPE_MAX = 140;

  const cancelRAF = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => cancelRAF(), []);

  if (!data || !data.Weight || !data.CreatedAt) {
    console.warn('WeightCard received invalid data:', data);
    return null;
  }

  const formatDate = (dateString) => {
    const date = istToLocalDate(dateString);
    if (!date) return '';
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === today.toDateString()) {
      return `Today Â· ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
    }
    if (date.toDateString() === yesterday.toDateString()) {
      return `Yesterday Â· ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
      ' Â· ' + date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const applyDelta = (clientX) => {
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
  };

  const finishGesture = () => {
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
        setTimeout(() => { onDelete(data); }, 180);
      });
      return;
    }
    setAnimating(true);
    requestAnimationFrame(() => {
      setDx(0);
      dxRef.current = 0;
      setTimeout(() => { setAnimating(false); setArmed(false); armedRef.current = false; }, 220);
    });
  };

  // Touch events â€” primary path on iOS
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

  const onTouchEnd = () => finishGesture();
  const onTouchCancel = () => finishGesture();

  // Pointer events â€” fallback for non-touch (desktop/Android mouse)
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

  const onPointerUp = (e) => { if (e.pointerType !== 'touch') finishGesture(); };
  const onPointerCancel = (e) => { if (e.pointerType !== 'touch') finishGesture(); };
  const onPointerLeave = (e) => { if (e.pointerType !== 'touch') finishGesture(); };

  const progress = Math.min(1, Math.abs(dx) / SWIPE_DELETE_THRESHOLD);
  const scale = leaving ? 1 : 1 - Math.min(0.03, Math.abs(dx) / 1000);

  const initials = userName.charAt(0).toUpperCase();

  return (
    <div
      className="relative w-full"
      style={{ touchAction: dragging ? 'none' : 'pan-y', minHeight: 80, animation: 'slideInUp 0.2s ease-out both' }}
    >
      {/* Swipe delete background */}
      <div aria-hidden className="absolute inset-0 z-0 flex items-center justify-end pr-5 overflow-hidden rounded-2xl">
        <div
          className="flex items-center justify-center w-12 h-12 bg-red-500 rounded-full"
          style={{
            opacity: progress,
            transform: `scale(${0.6 + progress * 0.4})`,
            transition: dragging ? 'none' : 'transform 160ms ease, opacity 160ms ease',
          }}
        >
          <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            style={{ transform: `rotate(${armed ? 10 : 0}deg)`, transition: 'transform 160ms cubic-bezier(.2,.8,.2,1.2)', strokeWidth: armed ? 2.2 : 2 }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16" />
          </svg>
        </div>
      </div>

      {/* Card */}
      <div
        ref={elRef}
        role="button"
        aria-label={`Weight: ${data.Weight} kg`}
        tabIndex={0}
        onKeyDown={(e) => {
          if (leaving) return;
          if (e.key === 'Backspace' || e.key === 'Delete') finishGesture();
          if (e.key === 'Enter') onView(data);
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchCancel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onPointerLeave={onPointerLeave}
        onClick={() => { if (!dragging && Math.abs(dx) < 5 && !leaving) onView(data); }}
        className={`relative z-10 bg-white rounded-2xl select-none cursor-pointer overflow-hidden ${leaving ? 'pointer-events-none' : ''}`}
        style={{
          transform: `translateX(${dx}px) scale(${scale})`,
          transition: animating ? 'transform 180ms cubic-bezier(.2,.8,.2,1.1)' : 'none',
          willChange: 'transform',
          boxShadow: '0 1px 4px rgba(0,0,0,0.07), 0 4px 16px rgba(0,0,0,0.05)',
          border: '1px solid rgba(0,0,0,0.06)',
        }}
      >
        {/* Swipe progress bar */}
        <div className="absolute bottom-0 left-0 h-0.5 bg-red-500 rounded-b-2xl"
          style={{ width: `${progress * 100}%`, transition: dragging ? 'none' : 'width 180ms ease', opacity: progress > 0 ? 1 : 0 }} />

        <div className="p-3 flex items-center gap-3">
          {/* Scale image or icon */}
          <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 bg-gradient-to-br from-emerald-50 to-teal-100 flex items-center justify-center shadow-sm">
            {data.WeightImageBase64 && data.WeightImageBase64.trim() !== '' ? (
              <img
                src={data.WeightImageBase64.startsWith('data:image') ? data.WeightImageBase64 : `data:image/jpeg;base64,${data.WeightImageBase64}`}
                alt="Scale"
                className="w-full h-full object-cover"
                loading="lazy"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            ) : (
              <Scale className="w-7 h-7 text-emerald-500" />
            )}
          </div>

          {/* Middle: weight + date + diff badge */}
          <div className="flex-1 min-w-0">
            {/* Weight value */}
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <span className="text-lg font-bold text-gray-900 leading-none">
                {parseFloat(data.Weight).toFixed(2)}
              </span>
              <span className="text-xs text-gray-400 font-medium">kg</span>
              {previousWeight !== null && previousWeight !== undefined && (() => {
                const diff = parseFloat(data.Weight) - parseFloat(previousWeight);
                if (Math.abs(diff) < 0.01) return null;
                const gained = diff > 0;
                return (
                  <span className={`text-xs font-semibold ${gained ? 'text-red-500' : 'text-green-500'}`}>
                    {gained ? 'â†‘' : 'â†“'} {Math.abs(diff).toFixed(1)} kg
                  </span>
                );
              })()}
            </div>
            {/* Date */}
            <p className="text-[11px] text-gray-400 mt-0.5 truncate">{formatDate(data.CreatedAt)}</p>
            
          </div>

          {/* Right: big weight badge */}
          <div className="shrink-0 flex flex-col items-center justify-center bg-emerald-50 rounded-xl px-3 py-2 min-w-[52px]">
            <span className="text-lg font-extrabold text-emerald-600 leading-none">
              {parseFloat(data.Weight).toFixed(2)}
            </span>
            <span className="text-[10px] text-emerald-400 font-medium mt-0.5">kg</span>
          </div>
        </div>
      </div>
    </div>
  );
});

WeightCard.displayName = 'WeightCard';

export default WeightCard;
