import { getSupabaseClient, getISTTimestamp } from '../../utils/supabaseClient.js';
import { buildPhoneLookupVariants } from './domain/phone-identity.rules.js';

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
    .eq('"Recipient"', recipient)
    .eq('"ContactType"', contactType)
    .eq('"IsActive"', true)
    .order('"ID"', { ascending: false })
    .limit(1);
  if (error) throw error;
  return data && data.length > 0 ? data[0] : null;
}

/**
 * Returns true if the given recipient has a verified OTP within the past
 * 15 minutes. Used by the delete-account endpoint to enforce that the OTP
 * flow was completed server-side before data destruction.
 */
export async function fetchRecentlyVerifiedOtp(recipient, contactType) {
  const supabase = getSupabaseClient();
  // Build an IST-relative cutoff (15-minute window)
  const istOffset = 5.5 * 60 * 60 * 1000;
  const cutoff = new Date(Date.now() + istOffset - 15 * 60 * 1000);
  const cutoffStr = cutoff.toISOString().replace('T', ' ').replace('Z', '').substring(0, 23);

  const { data, error } = await supabase
    .from('otp_tokens_table')
    .select('"ID"')
    .eq('"Recipient"', recipient)
    .eq('"ContactType"', contactType)
    .eq('"Verified"', true)
    .gte('"CreatedAt"', cutoffStr)
    .limit(1);
  if (error) throw error;
  return !!(data && data.length > 0);
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

// Phone-based lookups — team_table.PhoneNumber (legacy 10-digit or E.164).
export async function findUserByPhone(phone) {
  const supabase = getSupabaseClient();
  const variants = buildPhoneLookupVariants(phone);

  for (const variant of variants) {
    const { data, error } = await supabase
      .from('team_table')
      .select('*')
      .eq('PhoneNumber', variant)
      .order('UserId', { ascending: true })
      .limit(1);
    if (error) throw error;
    if (data && data.length > 0) return data[0];
  }

  return null;
}

export async function insertUser(payload) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('team_table').insert(payload).select().single();
  if (error) throw error;
  return data;
}

/**
 * Insert a new user keyed on phone number (race-condition-safe).
 *
 * The plain find → insert pattern has a TOCTOU gap: two simultaneous verify-otp
 * requests for the same new number both find null, then both attempt to insert,
 * and the second insert hits the UNIQUE index on PhoneNumber (migration 0013).
 *
 * This function converts that constraint error (PostgreSQL code 23505) into a
 * transparent re-fetch, so callers always receive a stable row regardless of
 * which request won the race.
 *
 * Returns { row: teamTableRow, isNewUser: boolean }.
 */
export async function findOrInsertUserByPhone(payload, phone) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('team_table').insert(payload).select().single();
  if (!error) return { row: data, isNewUser: true };

  // Unique constraint violation — a concurrent request just created this row.
  if (error.code === '23505') {
    const existing = await findUserByPhone(phone);
    if (existing) return { row: existing, isNewUser: false };
    // Extremely rare: constraint hit but row not found (e.g. partial index edge case).
    // Surface the original error for diagnosis rather than silently failing.
  }
  throw error;
}

export { getISTTimestamp };
