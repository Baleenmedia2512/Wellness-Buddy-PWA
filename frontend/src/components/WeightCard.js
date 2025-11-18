// src/components/WeightCard.js
import React, { useState, useRef, useEffect } from 'react';
import { Scale } from 'lucide-react';

/**
 * WeightCard Component
 * Compact horizontal card similar to MealCard in NutritionDashboard
 * Includes swipe-to-delete functionality
 */
const WeightCard = React.memo(({ 
  data, 
  onDelete, 
  onView,
  previousWeight = null,
  index = 0 
}) => {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [armed, setArmed] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [deletedOnce, setDeletedOnce] = useState(false);

  const startXRef = useRef(0);
  const rafRef = useRef(null);
  const elRef = useRef(null);

  const SWIPE_DELETE_THRESHOLD = 100;
  const SWIPE_MAX = 140;

  // Calculate weight change
  const weightChange = previousWeight 
    ? (parseFloat(data.Weight) - parseFloat(previousWeight)).toFixed(1)
    : null;

  /**
   * Format date with day and time
   */
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Check if it's today
    if (date.toDateString() === today.toDateString()) {
      return `Today ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
    }
    
    // Check if it's yesterday
    if (date.toDateString() === yesterday.toDateString()) {
      return `Yesterday ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
    }
    
    // For other dates, show the date
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const cancelRAF = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  const onPointerDown = (e) => {
    if (!e.isPrimary || leaving) return;
    cancelRAF();
    setDragging(true);
    setAnimating(false);
    startXRef.current = e.clientX;
    elRef.current?.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e) => {
    if (!dragging || !e.isPrimary || leaving) return;
    const delta = e.clientX - startXRef.current;
    const nextDx = Math.max(Math.min(delta, 0), -SWIPE_MAX);
    if (!rafRef.current) {
      rafRef.current = requestAnimationFrame(() => {
        setDx(nextDx);
        rafRef.current = null;
        const isNowArmed = Math.abs(nextDx) >= SWIPE_DELETE_THRESHOLD;
        if (isNowArmed !== armed) {
          setArmed(isNowArmed);
          if (isNowArmed && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            try { navigator.vibrate(10); } catch {}
          }
        }
      });
    }
  };

  const finishInteraction = (e) => {
    if (!dragging) return;
    setDragging(false);
    cancelRAF();
    elRef.current?.releasePointerCapture?.(e?.pointerId);

    if (Math.abs(dx) >= SWIPE_DELETE_THRESHOLD) {
      if (deletedOnce) return;
      setDeletedOnce(true);
      setLeaving(true);
      setAnimating(true);

      requestAnimationFrame(() => {
        setDx(-window.innerWidth);
        setTimeout(() => {
          onDelete(data);
        }, 180);
      });

      return;
    }

    setAnimating(true);
    requestAnimationFrame(() => {
      setDx(0);
      setTimeout(() => {
        setAnimating(false);
        setArmed(false);
      }, 220);
    });
  };

  const onPointerUp = (e) => finishInteraction(e);
  const onPointerCancel = (e) => finishInteraction(e);
  const onPointerLeave = (e) => finishInteraction(e);

  useEffect(() => () => cancelRAF(), []);

  const progress = Math.min(1, Math.abs(dx) / SWIPE_DELETE_THRESHOLD);
  const scale = leaving ? 1 : 1 - Math.min(0.03, Math.abs(dx) / 1000);

  return (
    <div 
      className="relative w-full"
      style={{ 
        touchAction: 'pan-y',
        height: 84,
        animation: `slideInUp 0.3s ease-out ${index * 0.05}s both`
      }}
    >
      {/* Background delete reveal */}
      <div aria-hidden className="absolute inset-0 z-0 flex items-center justify-end pr-5 overflow-hidden rounded-xl">
        <div
          className="flex items-center justify-center w-12 h-12 bg-red-500 rounded-full"
          style={{
            opacity: progress,
            transform: `scale(${0.6 + progress * 0.4})`,
            transition: dragging ? 'none' : 'transform 160ms ease, opacity 160ms ease',
          }}
        >
          <svg
            className="w-6 h-6 text-white"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            style={{
              transform: `rotate(${armed ? 10 : 0}deg)`,
              transition: 'transform 160ms cubic-bezier(.2,.8,.2,1.2)',
              strokeWidth: armed ? 2.2 : 2,
            }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16" />
          </svg>
        </div>
      </div>

      {/* Foreground card */}
      <div
        ref={elRef}
        role="button"
        aria-label={`Weight: ${data.Weight} kg`}
        tabIndex={0}
        onKeyDown={(e) => {
          if (leaving) return;
          if (e.key === 'Backspace' || e.key === 'Delete') finishInteraction(e);
          if (e.key === 'Enter') onView(data);
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onPointerLeave={onPointerLeave}
        onClick={() => {
          if (!dragging && Math.abs(dx) < 5 && !leaving) onView(data);
        }}
        className={`relative z-10 bg-white/70 backdrop-blur-xl border border-emerald-200/80 rounded-xl select-none cursor-pointer overflow-hidden
          ${leaving ? 'pointer-events-none' : ''}`}
        style={{
          transform: `translateX(${dx}px) scale(${scale})`,
          transition: animating ? 'transform 180ms cubic-bezier(.2,.8,.2,1.1), box-shadow 180ms ease' : 'none',
          minHeight: 76,
          willChange: 'transform',
          boxShadow: `
            0 10px 30px -10px rgba(0,0,0,${progress * 0.15 + 0.05}),
            inset 0 0 0 1px rgba(0,0,0,0.05)
          `,
        }}
      >
        {/* Bottom progress bar */}
        <div
          className="absolute bottom-0 left-0 h-0.5 bg-red-500 rounded-b-xl"
          style={{
            width: `${progress * 100}%`,
            transition: dragging ? 'none' : 'width 180ms ease',
            opacity: progress > 0 ? 1 : 0,
          }}
        />

        <div className="p-4 flex items-center gap-4">
          {/* Thumbnail */}
          <div className="w-12 h-12 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-lg flex items-center justify-center overflow-hidden shrink-0 border-2 border-emerald-200">
            {data.WeightImageBase64 && data.WeightImageBase64.trim() !== '' ? (
              <img
                src={data.WeightImageBase64.startsWith('data:image') ? data.WeightImageBase64 : `data:image/jpeg;base64,${data.WeightImageBase64}`}
                alt="Scale"
                className="w-full h-full object-cover"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            ) : (
              <Scale className="w-6 h-6 text-emerald-600" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <h3 className="text-base font-bold text-gray-900">
                {data.Weight}
                <span className="text-sm font-normal text-gray-600 ml-1">kg</span>
              </h3>
              {weightChange && (
                <span className={`text-xs font-medium ${
                  parseFloat(weightChange) > 0 ? 'text-red-600' : 'text-green-600'
                }`}>
                  {parseFloat(weightChange) > 0 ? '↑' : '↓'} {Math.abs(parseFloat(weightChange))} kg
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">{formatDate(data.CreatedAt)}</p>
          </div>

          {/* Calories equivalent */}
          <div className="text-right shrink-0">
            <p className="text-lg font-bold text-emerald-600">
              {data.Weight}
            </p>
            <p className="text-xs text-gray-500">kg</p>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes slideInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
});

WeightCard.displayName = 'WeightCard';

export default WeightCard;
