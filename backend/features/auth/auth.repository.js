import { getSupabaseClient, getISTTimestamp } from '../../utils/supabaseClient.js';

export async function deactivateActiveOtps(recipient, contactType) {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('otp_tokens_table')
    .update({ IsActive: false })
    .eq('"Recipient"', recipient)
    .eq('"ContactType"', contactType)
    .eq('"IsActive"', true);
  if (error) throw error;
}

export async function insertOtpToken(payload) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('otp_tokens_table').insert(payload);
  if (error) throw error;
}

export async function fetchActiveOtp(recipient, contactType) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('otp_tokens_table')
    .select('"ID", "OTPHash", "ExpiresAt"')
    .ilike('Recipient', recipient)
    .eq('"ContactType"', contactType)
    .eq('"IsActive"', true)
    .order('"ID"', { ascending: false })
    .limit(1);
  if (error) throw error;
  return data && data.length > 0 ? data[0] : null;
}

export async function markOtpVerified(id) {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('otp_tokens_table')
    .update({ Verified: true, IsActive: false })
    .eq('"ID"', id);
  if (error) throw error;
}

export async function findUserByEmail(recipient) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('team_table')
    .select('*')
    .ilike('Email', recipient)
    .limit(1);
  if (error) throw error;
  return data && data.length > 0 ? data[0] : null;
}

export async function findUserByEmailLite(recipient) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('team_table')
    .select('"UserId", "UserName", "Email", "Status"')
    .ilike('Email', recipient)
    .limit(1);
  if (error) throw error;
  return data && data.length > 0 ? data[0] : null;
}

export async function insertUser(payload) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('team_table').insert(payload).select().single();
  if (error) throw error;
  return data;
}

export { getISTTimestamp };
