import React from 'react';
import { getParameterMeta } from '../domain/parameterRegistry';
import {
  getParameterIcon,
  getScoringModeHint,
  SCORING_MODE_LABELS,
} from '../domain/parameterIcons';
import { formatCalculationReason } from '../domain/formatCalculationReason';

function progressTone(pct) {
  if (pct >= 100) return { bar: 'bg-emerald-500', text: 'text-emerald-700' };
  if (pct >= 50) return { bar: 'bg-amber-500', text: 'text-amber-700' };
  if (pct > 0) return { bar: 'bg-orange-400', text: 'text-orange-700' };
  return { bar: 'bg-gray-300', text: 'text-gray-500' };
}

/**
 * Parameter row — icon, scoring rule caption, today's status, and points.
 * Tap opens contribution sheet (same pattern as nutrition macros).
 */
export default function ScoreCategoryRow({
  category,
  compact = false,
  goalMode,
  timeWindows = null,
  onOpenContribution,
}) {
  const meta = getParameterMeta(category.key);
  const Icon = getParameterIcon(category.key);
  const label = category.label || meta?.label || category.key;
  const scoringMode = category.scoringMode || meta?.scoringMode;
  const modeLabel = SCORING_MODE_LABELS[scoringMode] || scoringMode;
  const modeHint = getScoringModeHint(scoringMode, category.key, goalMode, { timeWindows });
  const maxPoints = category.maxPoints ?? 0;
  const earnedPoints = category.earnedPoints ?? 0;
  const progressPct = maxPoints > 0
    ? Math.min(100, Math.round((earnedPoints / maxPoints) * 100))
    : 0;
  const tone = progressTone(progressPct);
  const clickable = typeof onOpenContribution === 'function';

  const open = () => {
    if (clickable) onOpenContribution(category);
  };

  return (
    <article
      className={`rounded-xl border border-gray-200/90 bg-white shadow-sm overflow-hidden ${
        compact ? 'p-3' : 'p-3.5'
      } ${clickable ? 'cursor-pointer active:scale-[0.99] transition-transform hover:border-emerald-200 hover:shadow-md' : ''}`}
      data-testid={`score-category-${category.key}`}
      onClick={open}
      onKeyDown={clickable ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      } : undefined}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      aria-label={clickable ? `View ${label} contribution` : undefined}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-emerald-100 bg-emerald-50"
          aria-hidden
        >
          <Icon className="h-5 w-5 text-emerald-700" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <p className={`truncate font-semibold text-gray-900 ${compact ? 'text-xs' : 'text-sm'}`}>
                  {label}
                </p>
                {modeLabel && (
                  <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-100">
                    {modeLabel}
                  </span>
                )}
              </div>
              {!compact && modeHint && (
                <p className="mt-1 text-[10px] leading-snug text-gray-500">
                  {modeHint}
                </p>
              )}
              {!compact && category.calculationReason && (
                <p className="mt-1 text-[11px] font-medium leading-snug text-gray-700">
                  Today: {formatCalculationReason(category.calculationReason)}
                </p>
              )}
            </div>
            <div className="shrink-0 text-right">
              <p className={`text-sm font-bold tabular-nums text-gray-900 ${compact ? 'text-xs' : ''}`}>
                {Math.round(earnedPoints)}
                <span className="font-medium text-gray-400">/{maxPoints}</span>
              </p>
              {clickable && (
                <p className="mt-0.5 text-[10px] font-medium text-emerald-600">Details</p>
              )}
            </div>
          </div>

          <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className={`h-full rounded-full transition-all duration-500 ${tone.bar}`}
              style={{ width: `${progressPct}%` }}
              role="progressbar"
              aria-valuenow={progressPct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${label} progress`}
            />
          </div>
        </div>
      </div>
    </article>
  );
}
