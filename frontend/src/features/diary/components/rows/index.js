/**
 * frontend/src/features/diary/components/rows/index.js
 *
 * Interactive card components for the Diary feed (PR-D / ADR-0003).
 *
 * Each row renders a single entry from the `listDiaryEntries` response,
 * receiving exactly the projected `payload` shape from
 * `backend/features/background-analysis/diary.service.js :: toDiaryEntry`.
 *
 * Design constraints:
 *   - Interactive with swipe-to-delete gestures matching original dashboard tabs
 *   - Visual chrome mirrors the existing per-tab cards (glassmorphism
 *     + image thumb + right-aligned primary value)
 *   - Uses shared useSwipeToDelete hook (§2.4)
 *   - Each row is stateless; delete callbacks are passed from parent DiaryFeed
 */

import React from 'react';
import { Smartphone, GraduationCap, HelpCircle } from 'lucide-react';
import { useSwipeToDelete } from '../../../../shared/hooks/useSwipeToDelete';
import { parseAnalysisData } from '../../../nutrition/services/nutritionDashboard/analysisHelpers';

const WeighingScaleIcon = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="3" width="18" height="18" rx="3" ry="3" />
    <path d="M6 10 C6 7, 18 7, 18 10" />
    <line x1="12" y1="12" x2="12" y2="9" />
  </svg>
);

// ─── shared chrome ──────────────────────────────────────────────────────────

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function Thumb({ imageBase64, imagePath, fallback }) {
  const src =
    imageBase64 && imageBase64.trim() !== ''
      ? imageBase64.startsWith('data:image')
        ? imageBase64
        : `data:image/jpeg;base64,${imageBase64}`
      : imagePath || null;

  return (
    <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden shrink-0">
      {src ? (
        <img
          src={src}
          alt=""
          className="w-full h-full object-cover"
          loading="lazy"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      ) : (
        <span aria-hidden="true">{fallback}</span>
      )}
    </div>
  );
}

// ─── kind: food ─────────────────────────────────────────────────────────────

export function FoodRow({ entry, onOpen, onDelete }) {
  const p = entry.payload || {};
  const cal = p.totals?.calories ?? 0;
  const swipe = useSwipeToDelete({ onDelete: () => onDelete?.(entry) });

  // Parse analysisData to extract meal name and item details
  // This matches the display behavior of the original MealCard in NutritionDashboard
  const foodData = parseAnalysisData(p.analysisData, 'text-gray-400');
  const mealName = typeof foodData.name === 'string' ? foodData.name : 'Food';

  return (
    <div
      className="relative w-full"
      style={{ touchAction: swipe.dragging ? 'none' : 'pan-y', minHeight: 84 }}
    >
      {/* Swipe-delete background */}
      <div aria-hidden className="absolute inset-0 z-0 flex items-center justify-end pr-5 overflow-hidden rounded-xl">
        <div
          className="flex items-center justify-center w-12 h-12 bg-red-500 rounded-full"
          style={{
            opacity: swipe.progress,
            transform: `scale(${0.6 + swipe.progress * 0.4})`,
            transition: swipe.dragging ? 'none' : 'transform 160ms ease, opacity 160ms ease',
          }}
        >
          <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            style={{ transform: `rotate(${swipe.armed ? 10 : 0}deg)`, transition: 'transform 160ms cubic-bezier(.2,.8,.2,1.2)', strokeWidth: swipe.armed ? 2.2 : 2 }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16" />
          </svg>
        </div>
      </div>

      {/* Card */}
      <div
        ref={swipe.elRef}
        role="button"
        tabIndex={0}
        aria-label={`${mealName}, ${Math.round(cal)} kilocalories`}
        data-testid="diary-row-food"
        {...swipe.touchHandlers}
        {...swipe.pointerHandlers}
        onKeyDown={(e) => {
          if (swipe.leaving) return;
          if (e.key === 'Enter' && !swipe.dragging) onOpen?.(entry);
        }}
        onClick={() => { if (!swipe.dragging && Math.abs(swipe.dx) < 5 && !swipe.leaving) onOpen?.(entry); }}
        className={`relative z-10 bg-white/70 backdrop-blur-xl border border-gray-200/80 rounded-xl shadow-sm p-3 flex items-center gap-3 cursor-pointer hover:shadow-md transition-shadow select-none overflow-hidden ${swipe.leaving ? 'pointer-events-none' : ''}`}
        style={{
          transform: `translateX(${swipe.dx}px) scale(${swipe.scale})`,
          transition: swipe.animating ? 'transform 180ms cubic-bezier(.2,.8,.2,1.1)' : 'none',
          willChange: 'transform',
        }}
      >
        {/* Progress bar */}
        <div className="absolute bottom-0 left-0 h-0.5 bg-red-500 rounded-b-xl"
          style={{ width: `${swipe.progress * 100}%`, transition: swipe.dragging ? 'none' : 'width 180ms ease', opacity: swipe.progress > 0 ? 1 : 0 }} />

        <Thumb imageBase64={p.imageBase64} imagePath={p.imagePath} fallback="🍽️" />
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-gray-900 truncate">{mealName}</h4>
          <p className="text-xs text-gray-500">{formatTime(entry.capturedAt)}</p>
          {(p.totals?.protein > 0 || p.totals?.carbs > 0 || p.totals?.fat > 0) && (
            <p className="text-[10px] text-gray-400 mt-0.5">
              P {Math.round(p.totals?.protein ?? 0)}g · C {Math.round(p.totals?.carbs ?? 0)}g · F {Math.round(p.totals?.fat ?? 0)}g
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="font-bold text-base text-gray-900">{Math.round(cal)}</p>
          <p className="text-[11px] text-gray-500 -mt-0.5">kcal</p>
        </div>
      </div>
    </div>
  );
}

// ─── kind: weight ───────────────────────────────────────────────────────────

export function WeightRow({ entry, onOpen, onDelete }) {
  const p = entry.payload || {};
  const swipe = useSwipeToDelete({ onDelete: () => onDelete?.(entry) });

  return (
    <div
      className="relative w-full"
      style={{ touchAction: swipe.dragging ? 'none' : 'pan-y', minHeight: 84 }}
    >
      {/* Swipe-delete background */}
      <div aria-hidden className="absolute inset-0 z-0 flex items-center justify-end pr-5 overflow-hidden rounded-xl">
        <div
          className="flex items-center justify-center w-12 h-12 bg-red-500 rounded-full"
          style={{
            opacity: swipe.progress,
            transform: `scale(${0.6 + swipe.progress * 0.4})`,
            transition: swipe.dragging ? 'none' : 'transform 160ms ease, opacity 160ms ease',
          }}
        >
          <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            style={{ transform: `rotate(${swipe.armed ? 10 : 0}deg)`, transition: 'transform 160ms cubic-bezier(.2,.8,.2,1.2)', strokeWidth: swipe.armed ? 2.2 : 2 }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16" />
          </svg>
        </div>
      </div>

      {/* Card */}
      <div
        ref={swipe.elRef}
        role="button"
        tabIndex={0}
        aria-label={`Weight, ${p.weight} kilograms`}
        data-testid="diary-row-weight"
        {...swipe.touchHandlers}
        {...swipe.pointerHandlers}
        onKeyDown={(e) => {
          if (swipe.leaving) return;
          if (e.key === 'Enter' && !swipe.dragging) onOpen?.(entry);
        }}
        onClick={() => { if (!swipe.dragging && Math.abs(swipe.dx) < 5 && !swipe.leaving) onOpen?.(entry); }}
        className={`relative z-10 bg-white/70 backdrop-blur-xl border border-gray-200/80 rounded-xl shadow-sm p-3 flex items-center gap-3 cursor-pointer hover:shadow-md transition-shadow select-none overflow-hidden ${swipe.leaving ? 'pointer-events-none' : ''}`}
        style={{
          transform: `translateX(${swipe.dx}px) scale(${swipe.scale})`,
          transition: swipe.animating ? 'transform 180ms cubic-bezier(.2,.8,.2,1.1)' : 'none',
          willChange: 'transform',
        }}
      >
        {/* Progress bar */}
        <div className="absolute bottom-0 left-0 h-0.5 bg-red-500 rounded-b-xl"
          style={{ width: `${swipe.progress * 100}%`, transition: swipe.dragging ? 'none' : 'width 180ms ease', opacity: swipe.progress > 0 ? 1 : 0 }} />

        <Thumb imageBase64={p.imageBase64} fallback={<WeighingScaleIcon className="w-6 h-6 text-emerald-600" />} />
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-gray-900 truncate">Weight</h4>
          <p className="text-xs text-gray-500">
            {formatTime(entry.capturedAt)}
            {typeof p.bmi === 'number' ? ` · BMI ${p.bmi.toFixed(1)}` : ''}
          </p>
        </div>
        <div className="text-right">
          <p className="font-bold text-base text-gray-900">{p.weight}</p>
          <p className="text-[11px] text-gray-500 -mt-0.5">kg</p>
        </div>
      </div>
    </div>
  );
}

// ─── kind: education ────────────────────────────────────────────────────────

export function EducationRow({ entry, onOpen, onDelete }) {
  const p = entry.payload || {};
  const swipe = useSwipeToDelete({ onDelete: () => onDelete?.(entry) });

  return (
    <div
      className="relative w-full"
      style={{ touchAction: swipe.dragging ? 'none' : 'pan-y', minHeight: 84 }}
    >
      {/* Swipe-delete background */}
      <div aria-hidden className="absolute inset-0 z-0 flex items-center justify-end pr-5 overflow-hidden rounded-xl">
        <div
          className="flex items-center justify-center w-12 h-12 bg-red-500 rounded-full"
          style={{
            opacity: swipe.progress,
            transform: `scale(${0.6 + swipe.progress * 0.4})`,
            transition: swipe.dragging ? 'none' : 'transform 160ms ease, opacity 160ms ease',
          }}
        >
          <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            style={{ transform: `rotate(${swipe.armed ? 10 : 0}deg)`, transition: 'transform 160ms cubic-bezier(.2,.8,.2,1.2)', strokeWidth: swipe.armed ? 2.2 : 2 }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16" />
          </svg>
        </div>
      </div>

      {/* Card */}
      <div
        ref={swipe.elRef}
        role="button"
        tabIndex={0}
        aria-label={`Education, ${p.topic || 'session'}`}
        data-testid="diary-row-education"
        {...swipe.touchHandlers}
        {...swipe.pointerHandlers}
        onKeyDown={(e) => {
          if (swipe.leaving) return;
          if (e.key === 'Enter' && !swipe.dragging) onOpen?.(entry);
        }}
        onClick={() => { if (!swipe.dragging && Math.abs(swipe.dx) < 5 && !swipe.leaving) onOpen?.(entry); }}
        className={`relative z-10 bg-white/70 backdrop-blur-xl border border-gray-200/80 rounded-xl shadow-sm p-3 flex items-center gap-3 cursor-pointer hover:shadow-md transition-shadow select-none overflow-hidden ${swipe.leaving ? 'pointer-events-none' : ''}`}
        style={{
          transform: `translateX(${swipe.dx}px) scale(${swipe.scale})`,
          transition: swipe.animating ? 'transform 180ms cubic-bezier(.2,.8,.2,1.1)' : 'none',
          willChange: 'transform',
        }}
      >
        {/* Progress bar */}
        <div className="absolute bottom-0 left-0 h-0.5 bg-red-500 rounded-b-xl"
          style={{ width: `${swipe.progress * 100}%`, transition: swipe.dragging ? 'none' : 'width 180ms ease', opacity: swipe.progress > 0 ? 1 : 0 }} />

        <Thumb imageBase64={p.imageBase64} fallback={<GraduationCap className="w-6 h-6 text-indigo-600" />} />
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-gray-900 truncate">{p.topic || 'Education'}</h4>
          <p className="text-xs text-gray-500">
            {formatTime(entry.capturedAt)}
            {p.platform ? ` · ${p.platform}` : ''}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── kind: watch ────────────────────────────────────────────────────────────

export function WatchRow({ entry, onOpen, onDelete }) {
  const p = entry.payload || {};
  const swipe = useSwipeToDelete({ onDelete: () => onDelete?.(entry) });

  return (
    <div
      className="relative w-full"
      style={{ touchAction: swipe.dragging ? 'none' : 'pan-y', minHeight: 84 }}
    >
      {/* Swipe-delete background */}
      <div aria-hidden className="absolute inset-0 z-0 flex items-center justify-end pr-5 overflow-hidden rounded-xl">
        <div
          className="flex items-center justify-center w-12 h-12 bg-red-500 rounded-full"
          style={{
            opacity: swipe.progress,
            transform: `scale(${0.6 + swipe.progress * 0.4})`,
            transition: swipe.dragging ? 'none' : 'transform 160ms ease, opacity 160ms ease',
          }}
        >
          <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            style={{ transform: `rotate(${swipe.armed ? 10 : 0}deg)`, transition: 'transform 160ms cubic-bezier(.2,.8,.2,1.2)', strokeWidth: swipe.armed ? 2.2 : 2 }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16" />
          </svg>
        </div>
      </div>

      {/* Card */}
      <div
        ref={swipe.elRef}
        role="button"
        tabIndex={0}
        aria-label={`Smartwatch activity, ${p.kcal} kilocalories burned`}
        data-testid="diary-row-watch"
        {...swipe.touchHandlers}
        {...swipe.pointerHandlers}
        onKeyDown={(e) => {
          if (swipe.leaving) return;
          if (e.key === 'Enter' && !swipe.dragging) onOpen?.(entry);
        }}
        onClick={() => { if (!swipe.dragging && Math.abs(swipe.dx) < 5 && !swipe.leaving) onOpen?.(entry); }}
        className={`relative z-10 bg-white/70 backdrop-blur-xl border border-gray-200/80 rounded-xl shadow-sm p-3 flex items-center gap-3 cursor-pointer hover:shadow-md transition-shadow select-none overflow-hidden ${swipe.leaving ? 'pointer-events-none' : ''}`}
        style={{
          transform: `translateX(${swipe.dx}px) scale(${swipe.scale})`,
          transition: swipe.animating ? 'transform 180ms cubic-bezier(.2,.8,.2,1.1)' : 'none',
          willChange: 'transform',
        }}
      >
        {/* Progress bar */}
        <div className="absolute bottom-0 left-0 h-0.5 bg-red-500 rounded-b-xl"
          style={{ width: `${swipe.progress * 100}%`, transition: swipe.dragging ? 'none' : 'width 180ms ease', opacity: swipe.progress > 0 ? 1 : 0 }} />

        <div className="w-12 h-12 bg-amber-50 rounded-lg flex items-center justify-center shrink-0">
          <Smartphone className="w-6 h-6 text-amber-600" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-gray-900 truncate">Smartwatch</h4>
          <p className="text-xs text-gray-500">{formatTime(entry.capturedAt)}</p>
        </div>
        <div className="text-right">
          <p className="font-bold text-base text-gray-900">{p.kcal}</p>
          <p className="text-[11px] text-gray-500 -mt-0.5">kcal burned</p>
        </div>
      </div>
    </div>
  );
}

// ─── kind: unknown (the "Other" card) ───────────────────────────────────────
// Unknown entries have their own delete flow via UnknownEntryFlow modal with
// undo functionality, so we keep this as a simple clickable card without
// swipe-to-delete.

export function OtherRow({ entry, onOpen }) {
  const p = entry.payload || {};
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen ? () => onOpen(entry) : undefined}
      onKeyDown={(e) => {
        if (!onOpen) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(entry);
        }
      }}
      aria-label="Unrecognised capture, tap to identify"
      data-testid="diary-row-unknown"
      className="bg-white/70 backdrop-blur-xl border border-gray-200/80 rounded-xl shadow-sm p-3 flex items-center gap-3 cursor-pointer hover:shadow-md transition-shadow"
    >
      <Thumb imageBase64={p.imageBase64} imagePath={p.imagePath} fallback={<HelpCircle className="w-6 h-6 text-gray-500" />} />
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-gray-900 truncate">Other</h4>
        <p className="text-xs text-gray-500">
          {formatTime(entry.capturedAt)} · couldn't identify
        </p>
      </div>
      <span className="text-xs text-gray-400 italic" aria-hidden="true">tap to fix</span>
    </div>
  );
}

// Default export — small registry so DiaryFeed dispatches via a lookup,
// not a switch statement that duplicates kind enums.
const ROWS_BY_KIND = Object.freeze({
  food:      FoodRow,
  weight:    WeightRow,
  education: EducationRow,
  watch:     WatchRow,
  unknown:   OtherRow,
});

export default ROWS_BY_KIND;
