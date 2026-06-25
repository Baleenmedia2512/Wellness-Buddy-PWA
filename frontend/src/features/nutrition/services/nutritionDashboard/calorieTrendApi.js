// Calorie trend (multi-day total calories chart data).
import { parseAnalysisData, toLocalDateString } from './analysisHelpers';

const sumDayCalories = (list) =>
  list.reduce((sum, analysis) => {
    if (analysis.isUndoPlaceholder) return sum;
    const foodData = parseAnalysisData(analysis.AnalysisData);
    const n = foodData.nutrition || {};
    return sum + (n.calories || analysis.TotalCalories || 0);
  }, 0);

const fetchOneDay = async (apiBaseUrl, userId, dateString) => {
  const cacheBuster = Date.now() + Math.random();
  const res = await fetch(
    `${apiBaseUrl}/api/food-corrections/stats?userId=${userId}&date=${dateString}&detailed=true&_t=${cacheBuster}`,
    { cache: 'no-store', headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' } },
  );
  const data = await res.json();
  return data?.success ? (data.data || []) : [];
};

/** Returns array of { key, date, label, calories, hasData, target } points. */
export async function fetchCalorieTrend({ apiBaseUrl, userId, selectedDate, days, calorieTarget }) {
  if (!userId) return [];

  const dates = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(selectedDate);
    d.setDate(selectedDate.getDate() - i);
    dates.push(d);
  }

  try {
    return await Promise.all(
      dates.map(async (d) => {
        const dateString = toLocalDateString(d);
        const list = await fetchOneDay(apiBaseUrl, userId, dateString);
        return {
          key: dateString,
          date: d,
          label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          calories: Math.round(sumDayCalories(list)),
          hasData: list.some((a) => !a.isUndoPlaceholder),
          target: calorieTarget,
        };
      }),
    );
  } catch (err) {
    console.error('[fetchCalorieTrend] Error:', err);
    return [];
  }
}
