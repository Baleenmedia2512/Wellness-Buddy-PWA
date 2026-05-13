// Detect whether a new weight entry is "essentially the same" as one already
// logged today (within 0.5 unit). Always fail-open on errors.
import { istToLocalDate } from '../../../../shared/utils/timezoneUtils';

const TOLERANCE = 0.5; // kg or lbs

const formatTimeAgo = (currentTime, entryTime) => {
  const diffMs = currentTime - entryTime;
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  return 'just now';
};

const fetchRecentWeights = async (apiBaseUrl, userId) => {
  const cacheBuster = Date.now();
  const res = await fetch(
    `${apiBaseUrl}/api/weight/history?userId=${userId}&limit=10&offset=0&includeImage=false&_t=${cacheBuster}`,
    { headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' }, cache: 'no-store' },
  );
  if (!res.ok) {
    console.error('Failed to fetch weight history for duplicate check, status:', res.status);
    return null;
  }
  try { return await res.json(); }
  catch (e) { console.error('Invalid JSON response from weight history:', e); return null; }
};

const filterTodaysEntries = (entries, currentTime) => {
  const todayStart = new Date(currentTime); todayStart.setHours(0, 0, 0, 0);
  return entries.filter((entry) => {
    if (!entry || typeof entry !== 'object' || !entry.CreatedAt) return false;
    try {
      const t = istToLocalDate(entry.CreatedAt);
      return !isNaN(t.getTime()) && t >= todayStart;
    } catch { return false; }
  });
};

const findMatchingWeight = (entries, newWeight) => {
  for (const entry of entries) {
    if (!entry.Weight) continue;
    const existing = parseFloat(entry.Weight);
    if (isNaN(existing)) continue;
    if (Math.abs(newWeight - existing) <= TOLERANCE) return { entry, existing };
  }
  return null;
};

export async function checkForDuplicateWeight({ userId, weightValue, unit = 'kg' }) {
  try {
    if (!userId || (typeof userId !== 'string' && typeof userId !== 'number')) {
      console.warn('Invalid userId provided to weight duplicate check:', userId);
      return { isDuplicate: false };
    }
    const newWeight = parseFloat(weightValue);
    if (!weightValue || isNaN(newWeight)) {
      console.warn('Invalid weight value provided to duplicate check:', weightValue);
      return { isDuplicate: false };
    }
    const currentTime = new Date();
    if (isNaN(currentTime.getTime())) { console.error('Invalid system time detected'); return { isDuplicate: false }; }
    const apiBaseUrl = process.env.REACT_APP_API_BASE_URL;
    if (!apiBaseUrl) { console.error('REACT_APP_API_BASE_URL not configured'); return { isDuplicate: false }; }

    let data;
    try { data = await fetchRecentWeights(apiBaseUrl, userId); }
    catch (e) { console.error('Network error during weight duplicate check:', e); return { isDuplicate: false }; }
    if (!data || !data.success || !Array.isArray(data.data) || data.data.length === 0) {
      return { isDuplicate: false };
    }

    const todayEntries = filterTodaysEntries(data.data, currentTime);
    if (!todayEntries.length) return { isDuplicate: false };

    const match = findMatchingWeight(todayEntries, newWeight);
    if (!match) return { isDuplicate: false };

    try {
      const entryTime = istToLocalDate(match.entry.CreatedAt);
      const timeDifference = formatTimeAgo(currentTime, entryTime);
      const existingTime = entryTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      console.log('✅ Duplicate weight found:', { newWeight, existingWeight: match.existing, timeDifference });
      return { isDuplicate: true, existingWeight: match.existing, timeDifference, existingTime, unit };
    } catch (timeError) {
      console.error('Error calculating time difference:', timeError);
      return { isDuplicate: true, existingWeight: match.existing, timeDifference: 'recently', existingTime: null, unit };
    }
  } catch (error) {
    console.error('Error checking for duplicate weight:', error);
    return { isDuplicate: false };
  }
}
