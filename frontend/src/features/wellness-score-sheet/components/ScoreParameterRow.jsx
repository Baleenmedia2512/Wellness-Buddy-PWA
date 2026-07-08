import React from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Clock } from 'lucide-react';

function StatusIcon({ param }) {
  if (param.scoringType === 'deferred') {
    return <Clock className="w-4 h-4 text-gray-400 shrink-0" aria-hidden />;
  }
  if (!param.enabled) {
    return <Clock className="w-4 h-4 text-gray-300 shrink-0" aria-hidden />;
  }
  if (param.exceeded) {
    return <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" aria-hidden />;
  }
  if (param.scoringType === 'binary') {
    return param.achieved
      ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden />
      : <XCircle className="w-4 h-4 text-gray-400 shrink-0" aria-hidden />;
  }
  if (param.earnedMark >= param.maxMark * 0.75) {
    return <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden />;
  }
  return <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" aria-hidden />;
}

function barColor(param) {
  if (param.exceeded) return 'bg-red-500';
  if (!param.enabled || param.scoringType === 'deferred') return 'bg-gray-300';
  if (param.scoringType === 'binary') return param.achieved ? 'bg-emerald-500' : 'bg-gray-300';
  const ratio = param.maxMark > 0 ? param.earnedMark / param.maxMark : 0;
  if (ratio >= 0.75) return 'bg-emerald-500';
  if (ratio >= 0.4) return 'bg-amber-500';
  return 'bg-orange-400';
}

/**
 * Single parameter row in the wellness score sheet.
 */
export default function ScoreParameterRow({ param, compact = false }) {
  const progressPct = param.maxMark > 0
    ? Math.min(100, Math.round((param.earnedMark / param.maxMark) * 100))
    : 0;

  return (
    <div
      className={`bg-white/80 border border-gray-200/80 rounded-xl ${compact ? 'p-2.5' : 'p-3'} shadow-sm`}
      data-testid={`score-row-${param.key}`}
    >
      <div className="flex items-start gap-2.5">
        <StatusIcon param={param} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className={`font-semibold text-gray-900 truncate ${compact ? 'text-xs' : 'text-sm'}`}>
              {param.label}
            </p>
            <span className={`shrink-0 font-bold text-gray-800 ${compact ? 'text-xs' : 'text-sm'}`}>
              {param.earnedMark}
              <span className="text-gray-400 font-medium">/{param.maxMark}</span>
            </span>
          </div>
          {!compact && param.detail && (
            <p className="text-[11px] text-gray-500 mt-0.5 truncate">{param.detail}</p>
          )}
          <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${barColor(param)}`}
              style={{ width: `${progressPct}%` }}
              role="progressbar"
              aria-valuenow={progressPct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${param.label} score`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
