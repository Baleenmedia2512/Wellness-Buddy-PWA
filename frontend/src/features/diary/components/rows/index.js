/**
 * frontend/src/features/diary/components/rows/index.js
 *
 * Presentational row components for the Diary feed (PR-C / ADR-0003).
 *
 * Each row renders a single entry from the `listDiaryEntries` response,
 * receiving exactly the projected `payload` shape from
 * `backend/features/background-analysis/diary.service.js :: toDiaryEntry`.
 *
 * Design constraints:
 *   - Read-only. Swipe-to-delete + edit affordances are deferred to
 *     PR-D (the App.js flow change PR) so this PR stays under the
 *     §4.4 size cap.
 *   - Visual chrome mirrors the existing per-tab cards (glassmorphism
 *     + image thumb + right-aligned primary value) so users do not see
 *     a jarring style discontinuity when the Diary tab is first
 *     enabled. Sample template: `nutrition/components/dashboard/MealCard`.
 *   - Each row component is a stateless function. Behavioural state
 *     (open-modal, retry, edit) is owned by the parent `DiaryFeed`.
 */

import React from 'react';
import { AppleIcon, Smartphone, GraduationCap, HelpCircle } from 'lucide-react';

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

function Shell({ onClick, children, ariaLabel, dataTestid }) {
  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={ariaLabel}
      data-testid={dataTestid}
      onClick={onClick}
      onKeyDown={(e) => {
        if (!onClick) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className="bg-white/70 backdrop-blur-xl border border-gray-200/80 rounded-xl shadow-sm p-3 flex items-center gap-3 cursor-pointer hover:shadow-md transition-shadow"
    >
      {children}
    </div>
  );
}

// ─── kind: food ─────────────────────────────────────────────────────────────

export function FoodRow({ entry, onOpen }) {
  const p = entry.payload || {};
  const cal = p.totals?.calories ?? 0;
  return (
    <Shell
      onClick={onOpen ? () => onOpen(entry) : undefined}
      ariaLabel={`Food, ${Math.round(cal)} kilocalories`}
      dataTestid="diary-row-food"
    >
      <Thumb imageBase64={p.imageBase64} imagePath={p.imagePath} fallback="🍽️" />
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-gray-900 truncate">Food</h4>
        <p className="text-xs text-gray-500">{formatTime(entry.capturedAt)}</p>
      </div>
      <div className="text-right">
        <p className="font-bold text-base text-gray-900">{Math.round(cal)}</p>
        <p className="text-[11px] text-gray-500 -mt-0.5">kcal</p>
      </div>
    </Shell>
  );
}

// ─── kind: weight ───────────────────────────────────────────────────────────

export function WeightRow({ entry, onOpen }) {
  const p = entry.payload || {};
  return (
    <Shell
      onClick={onOpen ? () => onOpen(entry) : undefined}
      ariaLabel={`Weight, ${p.weight} kilograms`}
      dataTestid="diary-row-weight"
    >
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
    </Shell>
  );
}

// ─── kind: education ────────────────────────────────────────────────────────

export function EducationRow({ entry, onOpen }) {
  const p = entry.payload || {};
  return (
    <Shell
      onClick={onOpen ? () => onOpen(entry) : undefined}
      ariaLabel={`Education, ${p.topic || 'session'}`}
      dataTestid="diary-row-education"
    >
      <Thumb imageBase64={p.imageBase64} fallback={<GraduationCap className="w-6 h-6 text-indigo-600" />} />
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-gray-900 truncate">{p.topic || 'Education'}</h4>
        <p className="text-xs text-gray-500">
          {formatTime(entry.capturedAt)}
          {p.platform ? ` · ${p.platform}` : ''}
        </p>
      </div>
    </Shell>
  );
}

// ─── kind: watch ────────────────────────────────────────────────────────────

export function WatchRow({ entry, onOpen }) {
  const p = entry.payload || {};
  return (
    <Shell
      onClick={onOpen ? () => onOpen(entry) : undefined}
      ariaLabel={`Smartwatch activity, ${p.kcal} kilocalories burned`}
      dataTestid="diary-row-watch"
    >
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
    </Shell>
  );
}

// ─── kind: unknown (the "Other" card) ───────────────────────────────────────

export function OtherRow({ entry, onOpen }) {
  const p = entry.payload || {};
  return (
    <Shell
      onClick={onOpen ? () => onOpen(entry) : undefined}
      ariaLabel="Unrecognised capture, tap to identify"
      dataTestid="diary-row-unknown"
    >
      <Thumb imageBase64={p.imageBase64} imagePath={p.imagePath} fallback={<HelpCircle className="w-6 h-6 text-gray-500" />} />
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-gray-900 truncate">Other</h4>
        <p className="text-xs text-gray-500">
          {formatTime(entry.capturedAt)} · couldn't identify
        </p>
      </div>
      {/* PR-D wires Retry / Edit buttons here; PR-C ships read-only. */}
      <span className="text-xs text-gray-400 italic" aria-hidden="true">tap to fix</span>
    </Shell>
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
