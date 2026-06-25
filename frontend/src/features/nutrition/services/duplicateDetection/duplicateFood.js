// Detect whether a new meal upload duplicates a meal already logged in the
// same time-of-day slot today. Always fail-open (returns isDuplicate:false on error).
import { istToLocalDate } from '../../../../shared/utils/timezoneUtils';
import { getMealCategory, getMealCategoryName } from './mealCategory';
import { extractFoodNames, parseAnalysisData } from './foodNameExtractor';

const buildDateString = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const fetchTodaysMeals = async (apiBaseUrl, userId, dateString) => {
  const cacheBuster = Date.now();
  const res = await fetch(
    `${apiBaseUrl}/api/food-corrections/stats?userId=${userId}&date=${dateString}&detailed=true&_t=${cacheBuster}`,
    { headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' }, cache: 'no-store' },
  );
  if (!res.ok) {
    console.error('Failed to fetch nutrition stats, status:', res.status);
    return null;
  }
  try { return await res.json(); }
  catch (e) { console.error('Invalid JSON response from nutrition stats:', e); return null; }
};

const findDuplicates = (mealsInSlot, newFoodNames) => {
  const out = [];
  for (const meal of mealsInSlot) {
    if (!meal.AnalysisData) { console.warn('Meal missing AnalysisData:', meal.ID); continue; }
    const existing = parseAnalysisData(meal.AnalysisData);
    if (!existing.length) continue;
    for (const newName of newFoodNames) {
      if (out.some((d) => d.toLowerCase() === newName.toLowerCase())) continue;
      if (existing.some((e) => e === newName)) { out.push(newName); break; }
    }
  }
  return out;
};

const formatDuplicateNames = (dupes) => {
  if (dupes.length === 1) return dupes[0];
  if (dupes.length === 2) return dupes.join(' and ');
  return dupes.slice(0, -1).join(', ') + ' and ' + dupes[dupes.length - 1];
};

export async function checkForDuplicateFood({ userId, analysisResult }) {
  try {
    if (!userId || (typeof userId !== 'string' && typeof userId !== 'number')) {
      console.warn('Invalid userId provided to duplicate check:', userId);
      return { isDuplicate: false };
    }
    if (!analysisResult || typeof analysisResult !== 'object') {
      console.warn('Invalid analysis result provided to duplicate check');
      return { isDuplicate: false };
    }
    const currentTime = new Date();
    if (isNaN(currentTime.getTime())) { console.warn('Invalid system time detected'); return { isDuplicate: false }; }

    const mealCategory = getMealCategory(currentTime);
    const mealCategoryName = getMealCategoryName(mealCategory);
    const newFoodNames = extractFoodNames(analysisResult);
    if (!newFoodNames.length) return { isDuplicate: false };

    const apiBaseUrl = process.env.REACT_APP_API_BASE_URL;
    if (!apiBaseUrl) { console.warn('REACT_APP_API_BASE_URL not configured'); return { isDuplicate: false }; }

    let data;
    try { data = await fetchTodaysMeals(apiBaseUrl, userId, buildDateString(currentTime)); }
    catch (e) { console.error('Network error during duplicate check:', e); return { isDuplicate: false }; }
    if (!data || !data.success || !Array.isArray(data.data) || data.data.length === 0) {
      return { isDuplicate: false };
    }

    const mealsInSlot = data.data.filter((meal) => {
      if (!meal || typeof meal !== 'object' || !meal.CreatedAt) return false;
      try {
        const t = istToLocalDate(meal.CreatedAt);
        if (isNaN(t.getTime())) return false;
        return getMealCategory(t) === mealCategory;
      } catch (e) { console.error('Error processing meal time:', e); return false; }
    });
    if (!mealsInSlot.length) return { isDuplicate: false };

    const dupes = findDuplicates(mealsInSlot, newFoodNames);
    if (!dupes.length) return { isDuplicate: false };

    return {
      isDuplicate: true,
      duplicateFoodName: formatDuplicateNames(dupes),
      duplicateFoodNames: dupes,
      duplicateCount: dupes.length,
      mealType: mealCategoryName,
      allFoodNames: newFoodNames,
    };
  } catch (error) {
    console.error('Error checking for duplicate food:', error);
    return { isDuplicate: false };
  }
}
