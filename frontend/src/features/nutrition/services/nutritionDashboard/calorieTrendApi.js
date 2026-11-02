// Calorie trend (multi-day total calories chart data).
import { toLocalDateString } from './analysisHelpers';

const fetchOneDayTotals = async (apiBaseUrl, userId, dateString) => {
  const cacheBuster = Date.now() + Math.random();
  const res = await fetch(
    `${apiBaseUrl}/api/food-corrections/stats?userId=${userId}&date=${dateString}&detailed=true&totalsOnly=true&_t=${cacheBuster}`,
    { cache: 'no-store', headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' } },
  );
  const data = await res.json();
  if (!data?.success) return { calories: 0, hasData: false };
  const calories = Math.round(data.dailyTotals?.totalCalories || 0);
  const mealCount = data.dailyTotals?.mealCount || data.queryInfo?.recordCount || 0;
  return { calories, hasData: mealCount > 0 || calories > 0 };
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
        const { calories, hasData } = await fetchOneDayTotals(apiBaseUrl, userId, dateString);
        return {
          key: dateString,
          date: d,
          label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          calories,
          hasData,
          target: calorieTarget,
        };
      }),
    );
  } catch (err) {
    console.error('[fetchCalorieTrend] Error:', err);
    return [];
  }
}
