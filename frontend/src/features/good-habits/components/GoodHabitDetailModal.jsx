/**
 * Diary tap target for Good Habit — Before vs After photos + optional notes.
 */
import React, { useEffect, useState } from 'react';
import { Loader2, Star, X } from 'lucide-react';
import {
  formatBusinessTime,
  DEFAULT_BUSINESS_TIMEZONE,
} from '../../../shared/utils/datetimeUtils';
import { useGoodHabitDetailImages } from '../hooks/useGoodHabitDetailImages';

function PhotoSlot({ label, src, loading, onOpen }) {
  const canOpen = Boolean(src) && typeof onOpen === 'function';
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700/80">{label}</p>
      <button
        type="button"
        disabled={!canOpen}
        onClick={() => onOpen({ src, label })}
        className="flex h-44 w-full items-center justify-center overflow-hidden rounded-xl border border-emerald-200 bg-emerald-50/60 disabled:cursor-default"
        aria-label={canOpen ? `View ${label} photo full size` : `${label} photo`}
      >
        {src ? (
          <img src={src} alt={`${label} photo`} className="h-full w-full object-cover" />
        ) : loading ? (
          <Loader2 className="h-6 w-6 animate-spin text-emerald-600" aria-label={`Loading ${label}`} />
        ) : (
          <Star className="h-8 w-8 text-emerald-300" aria-hidden />
        )}
      </button>
    </div>
  );
}

function FullScreenPhoto({ src, label, onClose }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-3"
      role="dialog"
      aria-modal="true"
      aria-label={`${label} photo full size`}
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="absolute right-3 top-3 z-[101] rounded-full bg-white/15 p-2.5 text-white backdrop-blur-sm active:bg-white/25"
        aria-label="Close full size photo"
      >
        <X className="h-6 w-6" strokeWidth={2.5} aria-hidden />
      </button>
      <img
        src={src}
        alt={`${label} photo full size`}
        className="max-h-full max-w-full object-contain"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

export default function GoodHabitDetailModal({
  entry,
  ownerUserId,
  timezoneIana = DEFAULT_BUSINESS_TIMEZONE,
  onClose,
}) {
  const p = entry?.payload || {};
  const habitId = p.id;
  const { beforeSrc, afterSrc, loading, error } = useGoodHabitDetailImages({
    userId: ownerUserId,
    habitId,
  });
  const [expanded, setExpanded] = useState(null);
  const notes = String(p.notes || '').trim();
  const timeLabel = entry?.capturedAt
    ? formatBusinessTime(entry.capturedAt, timezoneIana)
    : null;

  if (!entry) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="good-habit-detail-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-4 pb-2 pt-4">
          <div>
            <p id="good-habit-detail-title" className="text-sm font-bold text-emerald-900">
              Before vs After
            </p>
            {timeLabel && (
              <p className="mt-0.5 text-[11px] text-emerald-700/70">{timeLabel}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 hover:bg-emerald-50"
            aria-label="Close"
          >
            <X className="h-4 w-4 text-emerald-600/60" />
          </button>
        </div>

        <div className="flex flex-col gap-3 px-4 pb-5">
          {error && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <PhotoSlot label="Before" src={beforeSrc} loading={loading} onOpen={setExpanded} />
            <PhotoSlot label="After" src={afterSrc} loading={loading} onOpen={setExpanded} />
          </div>
          {notes ? (
            <p className="rounded-xl bg-emerald-50/80 px-3 py-2 text-sm text-emerald-950">{notes}</p>
          ) : null}
        </div>
      </div>
      {expanded?.src && (
        <FullScreenPhoto
          src={expanded.src}
          label={expanded.label}
          onClose={() => setExpanded(null)}
        />
      )}
    </div>
  );
}
