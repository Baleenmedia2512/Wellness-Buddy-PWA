import React, { useState, useRef, useEffect } from 'react';
import { BookOpen, Monitor, Video, Users, Trash2 } from 'lucide-react';

const MAX_SWIPE_DISTANCE = 140;
const DELETE_THRESHOLD = 100;

/**
 * Get platform icon based on platform name
 */
const getPlatformIcon = (platform) => {
  const normalized = platform?.toLowerCase() || '';
  
  if (normalized.includes('meet')) return <Video className="w-5 h-5" />;
  if (normalized.includes('zoom')) return <Monitor className="w-5 h-5" />;
  if (normalized.includes('teams')) return <Users className="w-5 h-5" />;
  
  return <BookOpen className="w-5 h-5" />;
};

/**
 * Get platform color based on platform name
 */
const getPlatformColor = (platform) => {
  const normalized = platform?.toLowerCase() || '';
  
  if (normalized.includes('meet')) return 'from-green-500 to-emerald-600';
  if (normalized.includes('zoom')) return 'from-blue-500 to-cyan-600';
  if (normalized.includes('teams')) return 'from-purple-500 to-violet-600';
  
  return 'from-indigo-500 to-purple-600';
};

/**
 * Format date with day and time (matching WeightCard style)
 */
const formatDate = (dateString) => {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  
  if (isNaN(date.getTime())) return '';
  
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

const EducationCard = React.memo(({ data, onDelete, onClick, index = 0 }) => {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [armed, setArmed] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [deletedOnce, setDeletedOnce] = useState(false);

  const startXRef = useRef(0);
  const rafRef = useRef(null);
  const elRef = useRef(null);

  const cancelRAF = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  useEffect(() => () => cancelRAF(), []);

  if (!data || !data.CreatedAt) {
    console.warn('EducationCard received invalid data:', data);
    return null;
  }

  const platformColor = getPlatformColor(data.Platform);
  const platformIcon = getPlatformIcon(data.Platform);

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
    const nextDx = Math.max(Math.min(delta, 0), -MAX_SWIPE_DISTANCE);
    if (!rafRef.current) {
      rafRef.current = requestAnimationFrame(() => {
        setDx(nextDx);
        rafRef.current = null;
        const isNowArmed = Math.abs(nextDx) >= DELETE_THRESHOLD;
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

    if (Math.abs(dx) >= DELETE_THRESHOLD) {
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

  const progress = Math.min(1, Math.abs(dx) / DELETE_THRESHOLD);
  const scale = leaving ? 1 : 1 - Math.min(0.03, Math.abs(dx) / 1000);

  return (
    <div 
      className="relative w-full"
      style={{ 
        touchAction: 'pan-y',
        minHeight: 72,
        animation: 'slideInUp 0.2s ease-out both'
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
          <Trash2 
            className="w-6 h-6 text-white"
            style={{
              transform: `rotate(${armed ? 10 : 0}deg)`,
              transition: 'transform 160ms cubic-bezier(.2,.8,.2,1.2)',
              strokeWidth: armed ? 2.2 : 2,
            }}
          />
        </div>
      </div>

      {/* Main card */}
      <div
        ref={elRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onPointerLeave={onPointerLeave}
        onClick={() => {
          if (!dragging && Math.abs(dx) < 5 && !leaving && onClick) {
            onClick(data);
          }
        }}
        className={`
          relative z-10 bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100
          ${dragging ? 'cursor-grabbing' : 'cursor-grab'}
        `}
        style={{
          transform: `translateX(${dx}px) scale(${scale})`,
          opacity: leaving ? 0 : 1,
          transition: animating 
            ? 'transform 220ms cubic-bezier(.2,.8,.2,1), opacity 180ms ease' 
            : 'none',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          willChange: dragging ? 'transform' : 'auto'
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

        <div className="flex items-center gap-2 xs:gap-3 sm:gap-4 p-2.5 xs:p-3 sm:p-4">
          {/* Screenshot Image or Platform Icon */}
          {data.ImageBase64 ? (
            <div className="flex-shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded-lg overflow-hidden shadow-md">
              <img 
                src={data.ImageBase64} 
                alt={data.Topic || 'Meeting Screenshot'} 
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className={`flex-shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded-lg bg-gradient-to-br ${platformColor} flex items-center justify-center text-white shadow-md`}>
              {platformIcon}
            </div>
          )}

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Topic */}
            <h4 className="text-sm sm:text-base font-semibold text-gray-900 truncate">
              {data.Topic || 'Education Meeting'}
            </h4>

            {/* Platform & Date */}
            <p className="text-xs sm:text-sm text-gray-500 truncate mt-0.5">
              {data.Platform || 'Online Meeting'} • {formatDate(data.CreatedAt)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
});

EducationCard.displayName = 'EducationCard';

export default EducationCard;
