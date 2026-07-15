import { EMPTY_DAILY_STATS } from './dailyStatsRules';
import { formatWellnessDayLabel } from '../../wellness-score-sheet/domain/dateRange';

const SUM_KEYS = Object.keys(EMPTY_DAILY_STATS).filter(
  (k) => k !== 'averageGlycemicIndex' && k !== 'mealCount',
);

/**
 * Sum nutrition across every day in the selected period (zeros on days without logs).
 */
export function sumDailyStatsForPeriod(statsArray) {
  const list = statsArray || [];
  if (!list.length) return { ...EMPTY_DAILY_STATS };

  const summed = {};
  for (const key of SUM_KEYS) {
    summed[key] = list.reduce((sum, day) => sum + (Number(day?.[key]) || 0), 0);
  }

  let giCarbProduct = 0;
  let giTotalCarbs = 0;
  for (const day of list) {
    if (day?.averageGlycemicIndex != null && (day?.totalCarbs ?? 0) > 0) {
      giCarbProduct += day.averageGlycemicIndex * day.totalCarbs;
      giTotalCarbs += day.totalCarbs;
    }
  }

  summed.averageGlycemicIndex = giTotalCarbs > 0
    ? Math.round(giCarbProduct / giTotalCarbs)
    : null;
  summed.mealCount = list.reduce((sum, day) => sum + (Number(day?.mealCount) || 0), 0);

  return summed;
}

/**
 * Wellness period: sum(earned) vs sum(possible) — true progress over the range.
 */
export function aggregateWellnessPeriodScore(days) {
  if (!days?.length) return null;

  const totalEarned = days.reduce((sum, d) => sum + (Number(d.totalEarned) || 0), 0);
  const totalPossible = days.reduce((sum, d) => sum + (Number(d.totalPossible) || 0), 0);
  const percentage = totalPossible > 0 ? Math.round((totalEarned / totalPossible) * 100) : 0;

  return {
    totalEarned,
    totalPossible,
    percentage,
    dayCount: days.length,
  };
}

function formatShortYmd(dateStr) {
  const [y, m, d] = String(dateStr).split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * User-facing period copy — what track is active and how goals scale.
 */
export function getCarouselPeriodContext({
  preset,
  isMultiDay,
  dayCount,
  loggedDayCount,
  startDate,
  endDate,
  today,
}) {
  let title = 'Today';
  if (preset === 'yesterday') title = 'Yesterday';
  else if (preset === 'last7days') title = 'Last 7 days';
  else if (preset === 'custom' && startDate && endDate) {
    title = startDate === endDate
      ? formatWellnessDayLabel(startDate, today)
      : `${formatShortYmd(startDate)} – ${formatShortYmd(endDate)}`;
  }

  const isRange = isMultiDay && dayCount > 1;

  return {
    title,
    isMultiDay: isRange,
    dayCount: dayCount || 1,
    loggedDayCount: loggedDayCount || 0,
    goalScale: dayCount || 1,
    trackingLabel: isRange ? 'Period progress' : 'Daily track',
    achievedLabel: isRange ? 'Total achieved' : 'Achieved',
    goalLabel: isRange ? 'Period goal' : 'Daily goal',
    progressHint: isRange
      ? `${loggedDayCount} of ${dayCount} days with food logs`
      : 'Goal vs what you logged today',
  };
}

export function scaleMicronutrientTiles(tiles, goalScale = 1) {
  if (!goalScale || goalScale <= 1) return tiles;
  return tiles.map((tile) => {
    const target = Math.round(tile.target * goalScale);
    const pct = target > 0
      ? Math.min(100, Math.round((tile.consumed / target) * 100))
      : 0;
    return { ...tile, target, pct };
  });
}
