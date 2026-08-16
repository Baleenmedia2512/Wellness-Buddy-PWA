/**
 * Diary tap target for Good Habit — Before vs After photos + optional notes.
 */
import React from 'react';
import { Loader2, Star, X } from 'lucide-react';
import {
  formatBusinessTime,
  DEFAULT_BUSINESS_TIMEZONE,
} from '../../../shared/utils/datetimeUtils';
import { useGoodHabitDetailImages } from '../hooks/useGoodHabitDetailImages';

function PhotoSlot({ label, src, loading }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700/80">{label}</p>
      <div className="flex h-44 items-center justify-center overflow-hidden rounded-xl border border-emerald-200 bg-emerald-50/60">
        {src ? (
          <img src={src} alt={`${label} photo`} className="h-full w-full object-cover" />
        ) : loading ? (
          <Loader2 className="h-6 w-6 animate-spin text-emerald-600" aria-label={`Loading ${label}`} />
        ) : (
          <Star className="h-8 w-8 text-emerald-300" aria-hidden />
        )}
      </div>
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
            <PhotoSlot label="Before" src={beforeSrc} loading={loading} />
            <PhotoSlot label="After" src={afterSrc} loading={loading} />
          </div>
          {notes ? (
            <p className="rounded-xl bg-emerald-50/80 px-3 py-2 text-sm text-emerald-950">{notes}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
