import React, { useEffect, useMemo } from 'react';
import { useCarouselSwipe } from '../../nutrition/hooks/useCarouselSwipe';
import WellnessScoreDayStrip from './WellnessScoreDayStrip';

const PANELS = [
  { id: 'average', label: 'Average' },
  { id: 'days', label: 'Select day' },
];

export const MULTI_DAY_PANEL = {
  AVERAGE: 'average',
  DAYS: 'days',
};

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

function computeParamAverages(historyDays) {
  if (!historyDays || historyDays.length < 2) return {};

  const totals = {};
  const counts = {};

  for (const day of historyDays) {
    for (const param of day.parameters || []) {
      const key = param.key;
      if (!key) continue;
      if (!totals[key]) {
        totals[key] = { label: param.label || key, earnedSum: 0, maxPoints: param.maxPoints ?? 0 };
        counts[key] = 0;
      }
      totals[key].earnedSum += param.earnedPoints ?? 0;
      if (param.maxPoints > 0) totals[key].maxPoints = param.maxPoints;
      counts[key] += 1;
    }
  }

  const result = {};
  for (const key of Object.keys(totals)) {
    const { label, earnedSum, maxPoints } = totals[key];
    const n = counts[key];
    const earnedAvg = n > 0 ? earnedSum / n : 0;
    const avgPct = maxPoints > 0 ? Math.min(100, Math.round((earnedAvg / maxPoints) * 100)) : 0;
    result[key] = { label, earnedAvg: Math.round(earnedAvg * 10) / 10, maxPoints, avgPct };
  }
  return result;
}

function AverageScorePanel({ historyDays, sections }) {
  const dayAverage = useMemo(
    () => computeDayScoreAverage(historyDays),
    [historyDays],
  );
  const avgByKey = useMemo(
    () => computeParamAverages(historyDays),
    [historyDays],
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

      {avgSections.map((section) => (
        <div key={section.id} className="space-y-2">
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
      ))}

      <p className="text-center text-[10px] font-medium text-gray-400">
        Swipe left to pick a day
      </p>
    </div>
  );
}

/**
 * Swipeable multi-day header — Average first, swipe left for Select day strip.
 */
export default function WellnessScoreMultiDayCarousel({
  historyDays,
  sections,
  selectedDate,
  onSelectDate,
  today,
  onPanelChange,
}) {
  const resetKey = historyDays.map((day) => day.date).join('|');
  const { activeIndex, goTo, swipeHandlers } = useCarouselSwipe({
    cardCount: PANELS.length,
    resetKey,
  });

  const activePanel = PANELS[activeIndex] || PANELS[0];

  useEffect(() => {
    onPanelChange?.(activePanel.id);
  }, [activePanel.id, onPanelChange]);

  if (!historyDays.length || historyDays.length <= 1) return null;

  return (
    <section className="overflow-hidden rounded-2xl border-2 border-emerald-200 bg-emerald-50/60 shadow-sm">
      <div className="flex items-center justify-between border-b border-emerald-100 bg-emerald-100/70 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-emerald-700" aria-hidden>📊</span>
          <h2 className="text-xs font-bold uppercase tracking-wide text-emerald-800">
            {activePanel.id === MULTI_DAY_PANEL.AVERAGE
              ? `Average — Last ${historyDays.length} Days`
              : activePanel.label}
          </h2>
        </div>
        <span className="rounded-full bg-emerald-200 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
          {historyDays.length} days
        </span>
      </div>

      <div
        className="w-full overflow-hidden"
        {...swipeHandlers}
        style={{ touchAction: 'pan-y' }}
      >
        {activePanel.id === MULTI_DAY_PANEL.AVERAGE ? (
          <AverageScorePanel historyDays={historyDays} sections={sections} />
        ) : (
          <div
            onPointerDown={(e) => e.stopPropagation()}
            onPointerMove={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
          >
            <WellnessScoreDayStrip
              days={historyDays}
              selectedDate={selectedDate}
              onSelectDate={onSelectDate}
              today={today}
            />
            <p className="pb-2 pt-1 text-center text-[10px] font-medium text-gray-400">
              Swipe right for average · tap a day below
            </p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-3 border-t border-emerald-100 py-2">
        {PANELS.map((panel, index) => (
          <button
            key={panel.id}
            type="button"
            onClick={() => goTo(index)}
            className="flex items-center gap-1.5 rounded-full px-2 py-1 transition-colors hover:bg-emerald-100/80"
            aria-label={`Show ${panel.label}`}
            aria-current={index === activeIndex ? 'true' : undefined}
          >
            <span
              className={`rounded-full transition-all duration-200 ${
                index === activeIndex ? 'h-1.5 w-4 bg-emerald-500' : 'h-1.5 w-1.5 bg-gray-300'
              }`}
            />
            <span
              className={`text-[10px] font-semibold ${
                index === activeIndex ? 'text-emerald-800' : 'text-gray-400'
              }`}
            >
              {panel.label}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
