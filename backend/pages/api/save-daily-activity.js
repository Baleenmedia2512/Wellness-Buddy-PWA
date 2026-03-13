import { getSupabaseClient, getISTTimestamp } from '../../utils/supabaseClient.js';

const ALLOWED_ACTIVITY_TYPES = new Set(['walking']);

function toDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function caloriesFor(activityType, steps) {
  const safeSteps = Math.max(0, Number.parseInt(steps, 10) || 0);
  const multipliers = { walking: 0.04 };
  const multiplier = multipliers[activityType] || multipliers.walking;
  return Number((safeSteps * multiplier).toFixed(2));
}

async function upsertDailyActivity(supabase, { userId, activityDate, steps, activityType, caloriesBurned, currentSensorTotal }) {
  const now = getISTTimestamp();
  const dayStart = `${activityDate}T00:00:00`;
  const dayEnd = `${activityDate}T23:59:59`;

  // Check if a row already exists for this user on this date (by CreatedAt date)
  console.log(`[save-daily-activity] 🔍 Looking up existing row for userId=${userId} date=${activityDate} (range: ${dayStart} → ${dayEnd})`);

  const { data: existing, error: lookupError } = await supabase
    .from('daily_step_activity')
    .select('Id')
    .eq('UserId', userId)
    .gte('CreatedAt', dayStart)
    .lte('CreatedAt', dayEnd)
    .limit(1)
    .maybeSingle();

  console.log(`[save-daily-activity] 🗂️ Existing row:`, existing, '| lookupError:', lookupError);

  if (lookupError) throw lookupError;

  const payload = {
    UserId: userId,
    Steps: steps,
    ActivityType: activityType,
    CaloriesBurned: caloriesBurned,
    UpdatedAt: now
  };

  if (existing) {
    console.log(`[save-daily-activity] ♻️ Updating existing row Id=${existing.Id} with steps=${payload.Steps}`);
    const { data, error } = await supabase
      .from('daily_step_activity')
      .update(payload)
      .eq('Id', existing.Id)
      .select('*')
      .single();
    console.log(`[save-daily-activity] ✅ Update result:`, data, '| error:', error);
    if (error) throw error;
    return data;
  }

  console.log(`[save-daily-activity] ➕ Inserting new row with steps=${payload.Steps}`);
  const { data, error } = await supabase
    .from('daily_step_activity')
    .insert({ ...payload, CreatedAt: now })
    .select('*')
    .single();
  console.log(`[save-daily-activity] ✅ Insert result:`, data, '| error:', error);
  if (error) throw error;
  return data;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Cache-Control, Pragma');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ success: false, message: 'Method not allowed' });
    return;
  }

  try {
    const {
      userId,
      activityDate = toDateKey(),
      steps,
      activityType = 'walking',
      caloriesBurned,
      currentSensorTotal = null
    } = req.body || {};

    if (!userId || steps === undefined || steps === null) {
      res.status(400).json({
        success: false,
        message: 'Missing required fields: userId, steps'
      });
      return;
    }

    const safeSteps = Math.max(0, Number.parseInt(steps, 10) || 0);
    const safeActivityType = String(activityType).toLowerCase();

    if (!ALLOWED_ACTIVITY_TYPES.has(safeActivityType)) {
      res.status(400).json({
        success: false,
        message: 'Invalid activityType. Only walking is supported.'
      });
      return;
    }

    const computedCalories =
      caloriesBurned !== undefined && caloriesBurned !== null
        ? Number(caloriesBurned)
        : caloriesFor(safeActivityType, safeSteps);

    const safeSensorTotal =
      currentSensorTotal === null || currentSensorTotal === undefined
        ? null
        : Math.max(0, Number.parseInt(currentSensorTotal, 10) || 0);

    const supabase = getSupabaseClient();

    console.log('[save-daily-activity] 📥 Incoming request body:', { userId, activityDate, steps: safeSteps, activityType: safeActivityType, caloriesBurned: computedCalories, currentSensorTotal: safeSensorTotal });

    const savedRow = await upsertDailyActivity(supabase, {
      userId: Number.parseInt(userId, 10),
      activityDate,
      steps: safeSteps,
      activityType: safeActivityType,
      caloriesBurned: computedCalories,
      currentSensorTotal: safeSensorTotal
    });

    res.status(200).json({
      success: true,
      message: 'Daily activity saved successfully',
      data: savedRow
    });
  } catch (error) {
    console.error('❌ [save-daily-activity] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save daily activity',
      error: error.message
    });
  }
}
