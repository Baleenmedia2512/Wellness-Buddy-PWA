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
  // Use activityDate (client's date) for the lookup range — NOT server time.
  // This is critical when the phone date is manually set (e.g. for testing) or
  // the user is in a different timezone: the server's clock may differ from the
  // date the steps were actually recorded.
  const dayStart = `${activityDate}T00:00:00`;
  const dayEnd = `${activityDate}T23:59:59`;

  // Check if a row already exists for this user on this date (by CreatedAt date)
  console.log(`[save-daily-activity] 🔍 Looking up existing row for userId=${userId} date=${activityDate} (range: ${dayStart} → ${dayEnd})`);

  // Order by CreatedAt DESC so that if a race condition created duplicate rows
  // for the same user+date, we always UPDATE the most recently inserted one.
  const { data: existing, error: lookupError } = await supabase
    .from('daily_step_activity')
    .select('Id, Steps')
    .eq('UserId', userId)
    .gte('CreatedAt', dayStart)
    .lte('CreatedAt', dayEnd)
    .order('CreatedAt', { ascending: false })
    .limit(1)
    .maybeSingle();

  console.log(`[save-daily-activity] 🗂️ Existing row:`, existing, '| lookupError:', lookupError);

  if (lookupError) throw lookupError;

  // Sanity cap: more than 50,000 walking steps in a single day is physiologically
  // impossible (~40 km). Reject inflated values caused by the old double-counting
  // bug on the frontend so they can never get into the DB going forward.
  const MAX_DAILY_STEPS = 50_000;
  if (steps > MAX_DAILY_STEPS) {
    console.warn(`[save-daily-activity] ⚠️ Rejecting unreasonable step count (${steps} > ${MAX_DAILY_STEPS}) for userId=${userId} date=${activityDate}`);
    return existing || null;
  }

  // Allow the correct value to overwrite a previously inflated value.
  // The old Math.max guard is removed here because the frontend now re-calibrates
  // its sensor baseline on every DB load (writeBaseline fix), making it impossible
  // for a fresh session to send an inflated step count. The only time we'd get a
  // lower value sent is when the app is genuinely correcting corrupted historical data.
  const effectiveSteps = steps;
  // Always store CaloriesBurned as a non-negative number.
  // Some fitness sensors send negative delta values (e.g. -200) when the pedometer
  // resets or corrects itself — Math.abs treats those as real positive activity so
  // discipline calculations downstream count the day correctly.
  const effectiveCalories = Math.abs(caloriesBurned);

  const payload = {
    UserId: userId,
    Steps: effectiveSteps,
    ActivityType: activityType,
    CaloriesBurned: effectiveCalories,
    UpdatedAt: now
  };

  if (existing) {
    if (effectiveSteps === existing.Steps) {
      console.log(`[save-daily-activity] ⏭️ Skipping update — incoming steps (${steps}) not higher than existing (${existing.Steps})`);
      return existing;
    }
    console.log(`[save-daily-activity] ♻️ Updating existing row Id=${existing.Id} with steps=${payload.Steps} (was ${existing.Steps})`);
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
  // Set CreatedAt to noon of activityDate so the row is always found by the
  // date-range lookup regardless of which timezone the server is running in.
  const createdAt = `${activityDate}T12:00:00`;
  const { data, error } = await supabase
    .from('daily_step_activity')
    .insert({ ...payload, CreatedAt: createdAt })
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
        ? Math.abs(Number(caloriesBurned))
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

    // Update LastActiveAt in team_table to track user activity
    try {
      const { error: activityUpdateError } = await supabase
        .from('team_table')
        .update({ LastActiveAt: getISTTimestamp() })
        .eq('UserId', userId);
      
      if (activityUpdateError) {
        console.warn('⚠️ [save-daily-activity] Failed to update LastActiveAt:', activityUpdateError);
      } else {
        console.log('✅ [save-daily-activity] Updated LastActiveAt for user:', userId);
      }
    } catch (err) {
      console.warn('⚠️ [save-daily-activity] Error updating LastActiveAt:', err);
    }

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
