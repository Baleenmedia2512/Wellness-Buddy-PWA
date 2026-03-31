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

async function upsertDailyActivity(supabase, { userId, activityDate, steps, activityType, caloriesBurned, currentSensorTotal, forceWrite = false }) {
  const now = getISTTimestamp();
  // Use activityDate (client's date) for the lookup range — NOT server time.
  // This is critical when the phone date is manually set (e.g. for testing) or
  // the user is in a different timezone: the server's clock may differ from the
  // date the steps were actually recorded.
  const dayStart = `${activityDate}T00:00:00`;
  const dayEnd = `${activityDate}T23:59:59`;

  // Check if a row already exists for this user on this date (by CreatedAt date)
  console.log(`[save-daily-activity] 🔍 Looking up existing row for userId=${userId} date=${activityDate} (range: ${dayStart} → ${dayEnd})`);

  // Order by CreatedAt DESC so that if duplicate rows exist from old races,
  // we always UPDATE the most recent row.
  const { data: existingRows, error: lookupError } = await supabase
    .from('daily_step_activity')
    .select('Id, Steps')
    .eq('UserId', userId)
    .gte('CreatedAt', dayStart)
    .lte('CreatedAt', dayEnd)
    .order('CreatedAt', { ascending: false })
    .limit(2);

  const existing = Array.isArray(existingRows) && existingRows.length > 0 ? existingRows[0] : null;
  const duplicateSuspected = Array.isArray(existingRows) && existingRows.length > 1;

  console.log(`[save-daily-activity] 🗂️ Existing row:`, existing, '| duplicateSuspected:', duplicateSuspected, '| lookupError:', lookupError);

  if (lookupError) throw lookupError;

  // Sanity cap: more than 50,000 walking steps in a single day is physiologically
  // impossible (~40 km). Reject inflated values caused by the old double-counting
  // bug on the frontend so they can never get into the DB going forward.
  const MAX_DAILY_STEPS = 50_000;
  if (steps > MAX_DAILY_STEPS) {
    console.warn(`[save-daily-activity] ⚠️ Rejecting unreasonable step count (${steps} > ${MAX_DAILY_STEPS}) for userId=${userId} date=${activityDate}`);
    return existing || null;
  }

  // Math.max guard: normal saves never let DB steps go down.
  // forceWrite=true bypasses this so correction saves (from React syncDailySteps)
  // can fix inflated DB values back to the real measured count.
  const effectiveSteps = forceWrite ? steps : Math.max(steps, existing?.Steps ?? 0);
  const effectiveCalories = forceWrite
    ? caloriesBurned
    : Math.max(caloriesBurned, existing?.CaloriesBurned ?? 0);

  const payload = {
    UserId: userId,
    Steps: effectiveSteps,
    ActivityType: activityType,
    CaloriesBurned: effectiveCalories,
    UpdatedAt: now
  };

  if (existing) {
    if (effectiveSteps === existing.Steps) {
      console.log(`[save-daily-activity] ⏭️ Skipping update — no change: date=${activityDate} steps=${effectiveSteps}`);
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
  if (!error) return data;

  // Retry-safe handling: if insert failed due to near-simultaneous request,
  // re-check and UPDATE the latest row instead of failing.
  console.warn(`[save-daily-activity] ⚠️ Insert failed, retrying as update fallback: ${error.message}`);
  const { data: retryRows, error: retryLookupError } = await supabase
    .from('daily_step_activity')
    .select('Id, Steps')
    .eq('UserId', userId)
    .gte('CreatedAt', dayStart)
    .lte('CreatedAt', dayEnd)
    .order('CreatedAt', { ascending: false })
    .limit(1);

  if (retryLookupError) throw retryLookupError;
  const retryExisting = Array.isArray(retryRows) && retryRows.length > 0 ? retryRows[0] : null;
  if (!retryExisting) throw error;

  if (!forceWrite && effectiveSteps <= retryExisting.Steps) {
    console.log(`[save-daily-activity] ⏭️ Retry fallback: no improvement needed (${effectiveSteps} <= ${retryExisting.Steps}); returning existing row Id=${retryExisting.Id}`);
    return retryExisting;
  }

  const { data: retryUpdated, error: retryUpdateError } = await supabase
    .from('daily_step_activity')
    .update(payload)
    .eq('Id', retryExisting.Id)
    .select('*')
    .single();

  if (retryUpdateError) throw retryUpdateError;
  console.log(`[save-daily-activity] ✅ Retry fallback update result:`, retryUpdated);
  return retryUpdated;
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
      currentSensorTotal: safeSensorTotal,
      forceWrite: req.body.forceWrite === true
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

