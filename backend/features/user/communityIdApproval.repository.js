/**
 * Pending Community ID OTP requests.
 */
import { getSupabaseClient } from '../../utils/supabaseClient.js';
import { nowUtc } from '../../shared/lib/datetime/index.js';
import {
  REQUEST_KIND_CREATE,
  REQUEST_STATUS_CANCELLED,
  REQUEST_STATUS_EXPIRED,
  REQUEST_STATUS_PENDING,
} from './domain/communityIdApproval.rules.js';

const TABLE = 'community_id_requests_table';

function isMissingTable(error) {
  const msg = String(error?.message || error || '');
  return /community_id_requests_table/i.test(msg)
    && /does not exist|not find|schema cache|relation/i.test(msg);
}

export function isCommunityIdRequestsTableMissing(error) {
  return isMissingTable(error);
}

const PUBLIC_COLS = [
  'Id',
  'RequesterId',
  'ApproverId',
  'CommunityId',
  'RequestKind',
  'MainSponsorId',
  'MainSponsorName',
  'OtpHash',
  'OtpExpiresAt',
  'OtpSentAt',
  'OtpAttempts',
  'Status',
  'RequestedAt',
].join(', ');

export async function findPendingByRequesterId(requesterId) {
  const uid = Number(requesterId);
  if (!Number.isFinite(uid)) return null;
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select(PUBLIC_COLS)
    .eq('RequesterId', uid)
    .eq('Status', REQUEST_STATUS_PENDING)
    .order('RequestedAt', { ascending: false })
    .limit(1);
  if (error) throw error;
  return data?.[0] || null;
}

export async function findPendingCreateByCommunityId(communityId, excludeRequesterId = null) {
  const code = String(communityId || '').trim();
  if (!code) return null;
  const supabase = getSupabaseClient();
  let query = supabase
    .from(TABLE)
    .select(PUBLIC_COLS)
    .eq('CommunityId', code)
    .eq('RequestKind', REQUEST_KIND_CREATE)
    .eq('Status', REQUEST_STATUS_PENDING)
    .order('RequestedAt', { ascending: false })
    .limit(5);
  const { data, error } = await query;
  if (error) throw error;
  const exclude = excludeRequesterId != null ? Number(excludeRequesterId) : null;
  return (data || []).find((row) => {
    if (!Number.isFinite(exclude)) return true;
    return Number(row.RequesterId) !== exclude;
  }) || null;
}

export async function cancelPendingByRequesterId(requesterId) {
  const uid = Number(requesterId);
  if (!Number.isFinite(uid)) return;
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from(TABLE)
    .update({
      Status: REQUEST_STATUS_CANCELLED,
      ProcessedAt: nowUtc(),
    })
    .eq('RequesterId', uid)
    .eq('Status', REQUEST_STATUS_PENDING);
  if (error) throw error;
}

export async function insertRequest(row) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE)
    .insert([row])
    .select(PUBLIC_COLS);
  if (error) throw error;
  return data?.[0] || null;
}

export async function incrementOtpAttempts(id, nextAttempts) {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from(TABLE)
    .update({ OtpAttempts: nextAttempts })
    .eq('Id', id);
  if (error) throw error;
}

export async function markExpired(id) {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from(TABLE)
    .update({
      Status: REQUEST_STATUS_EXPIRED,
      ProcessedAt: nowUtc(),
    })
    .eq('Id', id);
  if (error) throw error;
}

export async function markApproved(id) {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from(TABLE)
    .update({
      Status: 'approved',
      ProcessedAt: nowUtc(),
    })
    .eq('Id', id);
  if (error) throw error;
}

export async function findTeamIdOwners(communityId, excludeUserId = null) {
  const code = String(communityId || '').trim();
  if (!code) return [];
  const supabase = getSupabaseClient();
  let query = supabase
    .from('team_table')
    .select('UserId')
    .eq('TeamId', code);
  const exclude = excludeUserId != null ? Number(excludeUserId) : null;
  if (Number.isFinite(exclude)) {
    query = query.neq('UserId', exclude);
  }
  const { data, error } = await query.limit(5);
  if (error) throw error;
  return (data || []).map((row) => Number(row.UserId)).filter((id) => Number.isFinite(id));
}

export async function findActiveCoachTeam(communityId) {
  const code = String(communityId || '').trim();
  if (!code) return null;
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('coach_teams_table')
    .select('TeamId, CoachId, CoCoachId, Status')
    .eq('TeamId', code)
    .eq('Status', 'active')
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function findUserIdentity(userId) {
  const uid = Number(userId);
  if (!Number.isFinite(uid)) return null;
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('team_table')
    .select('UserId, UserName, Email, CoachId, TeamId, CoachTeamId, CommunityId, Role, Status')
    .eq('UserId', uid)
    .limit(1);
  if (error) throw error;
  return data?.[0] || null;
}
