import { getSupabaseClient } from '../../utils/supabaseClient.js';
import fs from 'fs/promises';
import path from 'path';

const ALLOWED_ACTIVITY_TYPES = new Set(['walking']);

function toDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function shiftDate(dateKey, deltaDays) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + deltaDays);
  return toDateKey(date);
}

function fromTimestampToDateKey(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return toDateKey(date);
}
function normalizeRow(row) {
  if (!row) return null;
  const derivedDate = fromTimestampToDateKey(row.CreatedAt);
  return {
    userId: row.UserId ?? null,
    activityDate: derivedDate,
    steps: Number.parseInt(row.Steps ?? 0, 10) || 0,
    activityType: (row.ActivityType ?? 'walking').toLowerCase(),
    caloriesBurned: Number(row.CaloriesBurned ?? 0) || 0
  };
}

function buildTrend(rows, todayKey, days) {
  const rowMap = new Map();
  rows.forEach((row) => {
    const normalized = normalizeRow(row);
    if (normalized?.activityDate) {
      rowMap.set(normalized.activityDate, normalized);
    }
  });

  const trend = [];
  const startKey = shiftDate(todayKey, -(days - 1));

  for (let i = 0; i < days; i++) {
    const dateKey = shiftDate(startKey, i);
    const item = rowMap.get(dateKey);
    trend.push({
      date: dateKey,
      steps: item?.steps || 0,
      caloriesBurned: Number((item?.caloriesBurned || 0).toFixed(2)),
      activityType: item?.activityType || null
    });
  }

  return trend;
}

async function loadSeedRows(userId, activityType = null) {
  const multipliers = { walking: 0.04 };
  const seedPath = path.join(process.cwd(), 'test-data', 'daily-activity-test-data.json');
  const raw = await fs.readFile(seedPath, 'utf8');
  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed
    .filter((item) => Number.parseInt(item.userId, 10) === Number.parseInt(userId, 10))
    .filter((item) => {
      if (!activityType) return true;
      return String(item.activityType || 'walking').toLowerCase() === activityType;
    })
    .map((item) => ({
      UserId: Number.parseInt(item.userId, 10),
      EntryDateTime: item.entryDateTime || `${item.activityDate}T12:00:00`,
      ActivityDate: item.activityDate,
      Steps: Number.parseInt(item.steps, 10) || 0,
      ActivityType: String(item.activityType || 'walking').toLowerCase(),
      CaloriesBurned:
        item.caloriesBurned !== undefined && item.caloriesBurned !== null
          ? Number(item.caloriesBurned)
          : Number(
              (
                (Number.parseInt(item.steps, 10) || 0) *
                (multipliers[String(item.activityType || 'walking').toLowerCase()] || multipliers.walking)
              ).toFixed(2)
            )
    }));
}

async function fetchRowsByStyle(supabase, userId, startDate, endDate, activityType = null) {
  let query = supabase
    .from('daily_step_activity')
    .select('*')
    .eq('UserId', userId)
    .gte('CreatedAt', `${startDate}T00:00:00`)
    .lte('CreatedAt', `${endDate}T23:59:59`)
    .order('CreatedAt', { ascending: true });

  if (activityType) {
    query = query.eq('ActivityType', activityType);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Cache-Control, Pragma');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ success: false, message: 'Method not allowed' });
    return;
  }

  try {
    const { userId, days = '7', activityType } = req.query;
    const normalizedActivityType = activityType
      ? String(activityType).toLowerCase()
      : null;

    if (normalizedActivityType && !ALLOWED_ACTIVITY_TYPES.has(normalizedActivityType)) {
      res.status(400).json({
        success: false,
        message: 'Invalid activityType. Only walking is supported.'
      });
      return;
    }


    if (!userId) {
      res.status(400).json({ success: false, message: 'userId is required' });
      return;
    }

    const trendDays = Math.min(30, Math.max(1, Number.parseInt(days, 10) || 7));
    const todayKey = toDateKey();
    const startDate = shiftDate(todayKey, -(trendDays - 1));

    const supabase = getSupabaseClient();

    const rows = await fetchRowsByStyle(supabase, userId, startDate, todayKey, normalizedActivityType);

    const trend = buildTrend(rows, todayKey, trendDays);
    const today = trend[trend.length - 1] || {
      date: todayKey,
      steps: 0,
      caloriesBurned: 0,
      activityType: null
    };

    res.status(200).json({
      success: true,
      today,
      trend
    });
  } catch (error) {
    const isMissingTable =
      String(error?.message || '').includes("Could not find the table 'public.daily_step_activity'");

    if (isMissingTable) {
      try {
        const { userId, days = '7', activityType } = req.query;
        const normalizedActivityType = activityType
          ? String(activityType).toLowerCase()
          : null;
        const trendDays = Math.min(30, Math.max(1, Number.parseInt(days, 10) || 7));
        const todayKey = toDateKey();
        const seedRows = await loadSeedRows(userId, normalizedActivityType);
        const trend = buildTrend(seedRows, todayKey, trendDays);
        const today = trend[trend.length - 1] || {
          date: todayKey,
          steps: 0,
          caloriesBurned: 0,
          activityType: null
        };

        res.status(200).json({
          success: true,
          usingMockData: true,
          today,
          trend
        });
        return;
      } catch (seedError) {
        console.error('❌ [get-daily-activity] Seed fallback failed:', seedError);
      }
    }

    console.error('❌ [get-daily-activity] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch daily activity data',
      error: error.message
    });
  }
}
