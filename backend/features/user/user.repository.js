/**
 * User feature — repository layer. Owns team_table + cross-cutting deletes
 * needed for account removal.
 */
import { getSupabaseClient, getISTTimestamp } from '../../utils/supabaseClient.js';

const TEAM = 'team_table';
const APPROVALS = 'approval_requests_table';

export async function findByEmail(email, columns = '"UserId", "UserName", "Email"') {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TEAM)
    .select(columns)
    .ilike('Email', email)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function findByExactEmail(email, columns) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TEAM)
    .select(columns)
    .eq('"Email"', email)
    .limit(1);
  if (error) throw error;
  return Array.isArray(data) && data.length > 0 ? data[0] : null;
}

export async function findByUsername(username) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TEAM)
    .select('"UserId"')
    .eq('"UserName"', username)
    .limit(1);
  if (error) throw error;
  return Array.isArray(data) && data.length > 0 ? data[0] : null;
}

export async function getProfile(email) {
  return findByEmail(
    email,
    '"UserId", "UserName", "Email", "Height", "DietType", "ProfileImage", "CoachId", "PhoneNumber", "Bmr", profile_pic_snooze, "WeightGoalMode"'
  );
}

export async function getLatestWeight(userId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('weight_records_table')
    .select('"Weight", "CreatedAt"')
    .eq('"UserId"', userId)
    .or('"IsDeleted".is.null,"IsDeleted".eq.false')
    .order('"CreatedAt"', { ascending: false })
    .limit(1);
  if (error) return null;
  return Array.isArray(data) && data.length > 0 ? data[0] : null;
}

export async function updateUserByEmail(email, updateData) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TEAM)
    .update(updateData)
    .eq('Email', email)
    .select('UserId');
  if (error) throw error;
  return data || [];
}

export async function updateUserById(userId, updateData) {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from(TEAM)
    .update(updateData)
    .eq('UserId', userId);
  if (error) throw error;
}

export async function verifyProfile(userId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TEAM)
    .select('UserId, Height, DietType, PhoneNumber')
    .eq('UserId', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function insertUser(payload) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TEAM)
    .insert(payload)
    .select()
    .single();
  return { data, error };
}

export async function setUserStatus(userId, status) {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from(TEAM)
    .update({ Status: status })
    .eq('"UserId"', userId);
  if (error) console.warn('[user.repo] setUserStatus failed:', error.message);
}

export async function getStatusFields(email) {
  return findByEmail(email, '"UserId", "TeamId", "CoachId", "Role", "SetupSkipped"');
}

export async function getPendingApproval(userId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(APPROVALS)
    .select('"Id", "UplineCoachId", "Status", "OtpExpiresAt", "RequestedAt"')
    .eq('"RequesterId"', userId)
    .eq('"Status"', 'pending')
    .order('"RequestedAt"', { ascending: false })
    .limit(1);
  if (error) {
    console.warn('[user.repo] getPendingApproval failed:', error.message);
    return null;
  }
  return Array.isArray(data) && data.length > 0 ? data[0] : null;
}

export async function deleteApproval(id) {
  const supabase = getSupabaseClient();
  await supabase.from(APPROVALS).delete().eq('"Id"', id);
}

/**
 * Fetch only the public-facing fields needed by the share landing page.
 * Returns null when the user is not found or on error (non-fatal).
 */
export async function findPublicProfileById(userId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TEAM)
    .select('"UserName", "ProfileImage"')
    .eq('"UserId"', userId)
    .maybeSingle();
  if (error) return null;
  return data || null;
}

export async function getSnoozeRow(userId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TEAM)
    .select('profile_pic_snooze')
    .eq('UserId', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function setSnooze(userId, newSnooze) {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from(TEAM)
    .update({ profile_pic_snooze: newSnooze })
    .eq('UserId', userId);
  if (error) throw error;
}

/**
 * Cascade-delete all user data. Returns the parallel deletion results so the
 * caller can log them.
 */
export async function purgeUserData(userId, normalizedEmail) {
  const supabase = getSupabaseClient();
  const results = await Promise.allSettled([
    supabase.from('food_nutrition_data_table').delete().eq('"UserID"', userId.toString()),
    supabase.from('weight_records_table').delete().eq('UserId', userId),
    supabase.from('education_logs_table').delete().eq('UserId', userId),
    supabase.from('daily_step_activity').delete().eq('UserId', userId),
    supabase.from('ai_token_usage_table').delete().eq('UserId', userId),
    supabase.from('wellness_university_enrollments_table').delete().eq('UserId', userId),
    supabase.from('wellness_counselling_assessments').delete().eq('UserId', userId),
    supabase.from('otp_tokens_table').delete().ilike('recipient', normalizedEmail),
  ]);
  return results;
}

export async function deleteTeamRow(userId) {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from(TEAM)
    .delete()
    .eq('UserId', userId);
  if (error) throw error;
}

/** Fetch raw food correction / nutrition data needed by user context. */
export async function getUserContextData(userId) {
  const supabase = getSupabaseClient();
  return Promise.all([
    supabase
      .from('food_corrections_table')
      .select('"AiDetected", "UserCorrected", "TimesCorrected"')
      .eq('"UserId"', userId)
      .order('"TimesCorrected"', { ascending: false })
      .order('"LastCorrected"', { ascending: false })
      .limit(10),
    supabase
      .from('food_corrections_table')
      .select('"AiDetected", "UserCorrected", "UserId", "TimesCorrected", "LastCorrected"')
      .order('"LastCorrected"', { ascending: false }),
    supabase
      .from(TEAM)
      .select('"DietType"')
      .eq('"UserId"', userId)
      .maybeSingle(),
    supabase
      .from('food_nutrition_data_table')
      .select('"AnalysisData", "CreatedAt"')
      .eq('"UserId"', userId)
      .or('"IsDeleted".is.null,"IsDeleted".eq.0')
      .order('"CreatedAt"', { ascending: false })
      .limit(3),
  ]);
}

export { getISTTimestamp };
