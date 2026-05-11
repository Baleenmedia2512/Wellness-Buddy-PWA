/**
 * User feature — repository (sole owner of team_table + cross-table user deletes).
 */
import { getSupabaseClient, getISTTimestamp } from '../../utils/supabaseClient.js';

const TEAM = 'team_table';

export async function findByEmail(email, columns = '"UserId", "UserName", "Email", "Status", "Role"') {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TEAM).select(columns).ilike('Email', email).maybeSingle();
  if (error) throw error;
  return data;
}

export async function findByEmailExact(email, columns) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TEAM).select(columns).eq('"Email"', email).limit(1);
  if (error) throw error;
  return (data && data[0]) || null;
}

export async function deactivateUser(userId) {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from(TEAM).update({ Status: 'Inactive' }).eq('"UserId"', userId);
  if (error) throw error;
}

export async function findProfileFull(email) {
  return findByEmail(
    email,
    '"UserId", "UserName", "Email", "Height", "DietType", "ProfileImage", "CoachId", "PhoneNumber", "Bmr", profile_pic_snooze'
  );
}

export async function findLatestWeight(userId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('weight_records_table')
    .select('"Weight", "CreatedAt"')
    .eq('"UserId"', userId)
    .or('"IsDeleted".is.null,"IsDeleted".eq.false')
    .order('"CreatedAt"', { ascending: false })
    .limit(1);
  if (error) return null;
  return (data && data[0]) || null;
}

export async function findUserIdByEmail(email) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TEAM).select('UserId').eq('Email', email).maybeSingle();
  if (error) throw error;
  return data?.UserId || null;
}

export async function updateUserById(userId, updates) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TEAM).update(updates).eq('UserId', userId).select('UserId');
  if (error) throw error;
  return data || [];
}

export async function updateBmr(userId, bmrValue) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from(TEAM).update({ Bmr: bmrValue }).eq('UserId', userId);
  if (error) throw error;
}

export async function verifyProfile(userId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TEAM).select('UserId, Height, DietType, PhoneNumber').eq('UserId', userId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function touchLastActive(userId) {
  const supabase = getSupabaseClient();
  await supabase.from(TEAM).update({ LastActiveAt: getISTTimestamp() }).eq('UserId', userId);
}

export async function getSnoozeRow(userId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TEAM).select('profile_pic_snooze').eq('UserId', userId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function setSnooze(userId, snoozePayload) {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from(TEAM).update({ profile_pic_snooze: snoozePayload }).eq('UserId', userId);
  if (error) throw error;
}

// — Google sign-up —
export async function findUsername(username) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TEAM).select('"UserId"').eq('"UserName"', username).limit(1);
  if (error) throw error;
  return (data && data.length > 0);
}

export async function insertUser(payload) {
  const supabase = getSupabaseClient();
  return supabase.from(TEAM).insert(payload).select().single();
}

export async function setProfileImage(email, photoURL) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from(TEAM).update({ ProfileImage: photoURL }).eq('"Email"', email);
  if (error) throw error;
}

// — Delete cascade —
export async function deleteAllUserData(userId, normalizedEmail) {
  const supabase = getSupabaseClient();
  return Promise.allSettled([
    supabase.from('food_nutrition_data_table').delete().eq('"UserID"', userId.toString()),
    supabase.from('weight_records_table').delete().eq('UserId', userId),
    supabase.from('education_logs_table').delete().eq('UserId', userId),
    supabase.from('daily_step_activity').delete().eq('UserId', userId),
    supabase.from('ai_token_usage_table').delete().eq('UserId', userId),
    supabase.from('wellness_university_enrollments_table').delete().eq('UserId', userId),
    supabase.from('wellness_counselling_assessments').delete().eq('UserId', userId),
    supabase.from('otp_tokens_table').delete().ilike('recipient', normalizedEmail),
  ]);
}

export async function deleteUser(userId) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from(TEAM).delete().eq('UserId', userId);
  if (error) throw error;
}

// — User context (food corrections, recent meals) —
export async function fetchUserContextData(userId) {
  const supabase = getSupabaseClient();
  return Promise.all([
    supabase.from('food_corrections_table')
      .select('"AiDetected", "UserCorrected", "TimesCorrected"')
      .eq('"UserId"', userId)
      .order('"TimesCorrected"', { ascending: false })
      .order('"LastCorrected"', { ascending: false })
      .limit(10),
    supabase.from('food_corrections_table')
      .select('"AiDetected", "UserCorrected", "UserId", "TimesCorrected", "LastCorrected"')
      .order('"LastCorrected"', { ascending: false }),
    supabase.from(TEAM).select('"DietType"').eq('"UserId"', userId).maybeSingle(),
    supabase.from('food_nutrition_data_table')
      .select('"AnalysisData", "CreatedAt"')
      .eq('"UserId"', userId)
      .or('"IsDeleted".is.null,"IsDeleted".eq.0')
      .order('"CreatedAt"', { ascending: false })
      .limit(3),
  ]);
}

// — User status / approval requests —
export async function findStatusUser(email) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TEAM)
    .select('"UserId", "TeamId", "CoachId", "Role", "SetupSkipped", "UplineCoachId"')
    .ilike('Email', email)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function findPendingApprovalRequest(userId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('approval_requests_table')
    .select('"Id", "UplineCoachId", "Status", "OtpExpiresAt", "RequestedAt"')
    .eq('"RequesterId"', userId)
    .eq('"Status"', 'pending')
    .order('"RequestedAt"', { ascending: false })
    .limit(1);
  if (error) return null;
  return (data && data[0]) || null;
}

export async function deleteApprovalRequest(requestId) {
  const supabase = getSupabaseClient();
  await supabase.from('approval_requests_table').delete().eq('"Id"', requestId);
}

export async function updateUserByEmail(email, updates) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from(TEAM).update(updates).eq('Email', email);
  if (error) throw error;
}

export async function findUserSkipFlag(email) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TEAM).select('UserId, SetupSkipped').eq('Email', email).maybeSingle();
  if (error) throw error;
  return data;
}
