import React, { useMemo } from 'react';
import { getSectionIcon } from '../domain/parameterIcons';

function avgBarTone(pct) {
  if (pct >= 100) return 'bg-emerald-500';
  if (pct >= 50) return 'bg-amber-500';
  if (pct > 0) return 'bg-orange-400';
  return 'bg-gray-300';
}

function scoreHeroTone(pct) {
  if (pct >= 75) return 'from-emerald-500 to-emerald-600';
  if (pct >= 50) return 'from-amber-400 to-amber-500';
  return 'from-orange-400 to-red-500';
}

function computeDayScoreAverage(historyDays) {
  const dayCount = historyDays?.length ?? 0;
  if (dayCount === 0) return null;

  const totalEarned = historyDays.reduce((sum, day) => sum + (Number(day.totalEarned) || 0), 0);
  const totalPossible = historyDays.reduce((sum, day) => sum + (Number(day.totalPossible) || 0), 0);
  const avgEarned = Math.round((totalEarned / dayCount) * 10) / 10;
  const avgPossible = Math.round((totalPossible / dayCount) * 10) / 10;
  const avgPct = avgPossible > 0 ? Math.min(100, Math.round((avgEarned / avgPossible) * 100)) : 0;

  return { avgEarned, avgPossible, avgPct, dayCount };
}

/**
 * Average only the keys passed in `activeKeys` (currently enabled params).
 * Missing days count as 0 earned so the divisor is always the full period.
 */
function computeParamAverages(historyDays, activeParams = []) {
  if (!historyDays || historyDays.length < 2 || !activeParams.length) return {};

  const dayCount = historyDays.length;
  const totals = {};

  for (const param of activeParams) {
    const key = param?.key;
    if (!key) continue;
    totals[key] = {
      label: param.label || key,
      earnedSum: 0,
      maxPoints: Number(param.maxPoints) || 0,
    };
  }

  for (const day of historyDays) {
    for (const param of day.parameters || []) {
      const key = param.key;
      if (!key || !totals[key]) continue;
      totals[key].earnedSum += Number(param.earnedPoints) || 0;
      const maxPoints = Number(param.maxPoints) || 0;
      if (maxPoints > 0) totals[key].maxPoints = maxPoints;
    }
  }

  const result = {};
  for (const key of Object.keys(totals)) {
    const { label, earnedSum, maxPoints } = totals[key];
    const earnedAvg = earnedSum / dayCount;
    const avgPct = maxPoints > 0 ? Math.min(100, Math.round((earnedAvg / maxPoints) * 100)) : 0;
    result[key] = { label, earnedAvg: Math.round(earnedAvg * 10) / 10, maxPoints, avgPct };
  }
  return result;
}

function AverageScorePanel({ historyDays, sections }) {
  const activeParams = useMemo(
    () => sections.flatMap((section) => section.parameters || []),
    [sections],
  );
  const dayAverage = useMemo(
    () => computeDayScoreAverage(historyDays),
    [historyDays],
  );
  const avgByKey = useMemo(
    () => computeParamAverages(historyDays, activeParams),
    [historyDays, activeParams],
  );

  const avgSections = sections
    .map((section) => {
      const parameters = section.parameters
        .map((p) => avgByKey[p.key])
        .filter(Boolean);
      return { ...section, parameters };
    })
    .filter((s) => s.parameters.length > 0);

  if (!dayAverage || !avgSections.length) return null;

  const { avgEarned, avgPossible, avgPct, dayCount } = dayAverage;

  return (
    <div className="space-y-3 p-3">
      <div className="rounded-xl border border-emerald-100 bg-white px-3.5 py-3 shadow-sm">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
          Avg score per day
        </p>
        <p className="mt-1 text-2xl font-bold tabular-nums text-gray-900">
          {avgEarned % 1 === 0 ? avgEarned : avgEarned.toFixed(1)}
          <span className="text-base font-semibold text-gray-400">
            /
            {avgPossible % 1 === 0 ? avgPossible : avgPossible.toFixed(1)}
          </span>
          <span className="ml-2 text-sm font-semibold text-emerald-700">{avgPct}%</span>
        </p>
        <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className={`h-full rounded-full bg-gradient-to-r transition-all duration-500 ${scoreHeroTone(avgPct)}`}
            style={{ width: `${avgPct}%` }}
            role="progressbar"
            aria-valuenow={avgPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Average wellness score progress"
          />
        </div>
        <p className="mt-1.5 text-[10px] text-gray-400">over {dayCount} days</p>
      </div>

      {avgSections.map((section) => {
        const SectionIcon = getSectionIcon(section.id);
        const sectionEarned = section.parameters.reduce((sum, p) => sum + (p.earnedAvg ?? 0), 0);
        const sectionMax = section.parameters.reduce((sum, p) => sum + (p.maxPoints ?? 0), 0);
        const sectionEarnedLabel = sectionEarned % 1 === 0
          ? Math.round(sectionEarned)
          : sectionEarned.toFixed(1);
        const sectionMaxLabel = sectionMax % 1 === 0
          ? Math.round(sectionMax)
          : sectionMax.toFixed(1);

        return (
          <section
            key={section.id}
            className="overflow-hidden rounded-xl border border-gray-200/90 bg-white shadow-sm"
          >
            <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/80 px-3.5 py-2.5">
              <div className="flex items-center gap-2">
                <SectionIcon className="h-4 w-4 text-emerald-600" aria-hidden />
                <h3 className="text-xs font-bold uppercase tracking-wide text-gray-700">
                  {section.label}
                </h3>
              </div>
              <span className="text-xs font-semibold tabular-nums text-gray-600">
                {sectionEarnedLabel}/{sectionMaxLabel}
                <span className="ml-1 font-medium text-gray-400">avg</span>
              </span>
            </div>
            <div className="space-y-2 p-2.5">
              {section.parameters.map(({ label, earnedAvg, maxPoints, avgPct: paramPct }) => (
                <div
                  key={label}
                  className="rounded-xl border border-emerald-100 bg-white px-3.5 py-3 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-gray-900">{label}</p>
                    <p className="shrink-0 text-sm font-bold tabular-nums text-gray-900">
                      {earnedAvg % 1 === 0 ? earnedAvg : earnedAvg.toFixed(1)}
                      <span className="font-medium text-gray-400">/{maxPoints}</span>
                      <span className="ml-1.5 text-[11px] font-medium text-emerald-700">{paramPct}%</span>
                    </p>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${avgBarTone(paramPct)}`}
                      style={{ width: `${paramPct}%` }}
                      role="progressbar"
                      aria-valuenow={paramPct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${label} average progress`}
                    />
                  </div>
                  <p className="mt-1 text-[10px] text-gray-400">avg pts/day over {dayCount} days</p>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/**
 * Multi-day wellness score summary — period average only (no per-day picker).
 */
export default function WellnessScoreMultiDayCarousel({
  historyDays,
  sections,
}) {
  if (!historyDays.length || historyDays.length <= 1) return null;

  return (
    <section className="overflow-hidden rounded-2xl border-2 border-emerald-200 bg-emerald-50/60 shadow-sm">
      <div className="flex items-center justify-between border-b border-emerald-100 bg-emerald-100/70 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-emerald-700" aria-hidden>📊</span>
          <h2 className="text-xs font-bold uppercase tracking-wide text-emerald-800">
            {`Average — Last ${historyDays.length} Days`}
          </h2>
        </div>
        <span className="rounded-full bg-emerald-200 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
          {historyDays.length} days
        </span>
      </div>

      <div className="w-full overflow-hidden">
        <AverageScorePanel historyDays={historyDays} sections={sections} />
      </div>
    </section>
  );
}
