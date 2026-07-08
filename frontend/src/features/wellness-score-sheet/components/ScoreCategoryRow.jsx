import React from 'react';
import { CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { getParameterMeta } from '../domain/parameterRegistry';

function StatusIcon({ category }) {
  const pct = category.percentage ?? 0;
  if (pct >= 100) return <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden />;
  if (pct <= 0) return <XCircle className="w-4 h-4 text-gray-400 shrink-0" aria-hidden />;
  return <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" aria-hidden />;
}

function barColor(category) {
  const pct = category.percentage ?? 0;
  if (pct >= 100) return 'bg-emerald-500';
  if (pct >= 50) return 'bg-amber-500';
  if (pct > 0) return 'bg-orange-400';
  return 'bg-gray-300';
}

/**
 * Single parameter row in the wellness score sheet.
 */
export default function ScoreCategoryRow({ category, compact = false }) {
  const meta = getParameterMeta(category.key);
  const maxPoints = category.maxPoints ?? 0;
  const earnedPoints = category.earnedPoints ?? 0;
  const progressPct = maxPoints > 0
    ? Math.min(100, Math.round((earnedPoints / maxPoints) * 100))
    : 0;

  return (
    <div
      className={`bg-white/80 border border-gray-200/80 rounded-xl ${compact ? 'p-2.5' : 'p-3'} shadow-sm`}
      data-testid={`score-category-${category.key}`}
    >
      <div className="flex items-start gap-2.5">
        <StatusIcon category={category} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className={`font-semibold text-gray-900 truncate ${compact ? 'text-xs' : 'text-sm'}`}>
              {category.label || meta?.label}
            </p>
            <span className={`shrink-0 font-bold text-gray-800 ${compact ? 'text-xs' : 'text-sm'}`}>
              {Math.round(earnedPoints)}
              <span className="text-gray-400 font-medium">/{maxPoints}</span>
            </span>
          </div>
          {!compact && category.calculationReason && (
            <p className="text-[11px] text-gray-500 mt-0.5">{category.calculationReason}</p>
          )}
          {!compact && meta?.scoringMode && !category.calculationReason && (
            <p className="text-[10px] text-gray-400 mt-0.5 capitalize">{meta.scoringMode} scoring</p>
          )}
          <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${barColor(category)}`}
              style={{ width: `${progressPct}%` }}
              role="progressbar"
              aria-valuenow={progressPct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${category.label} score`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
