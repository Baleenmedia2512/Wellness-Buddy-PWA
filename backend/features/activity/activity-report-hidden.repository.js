/**
 * Persistence for Activity Report hidden members.
 * Hide is global: IsHidden=true for a member removes them from everyone's
 * Activity Report. ViewerUserId is who performed the hide (audit).
 */
import { getSupabaseClient } from '../../utils/supabaseClient.js';
import { nowUtc } from '../../shared/lib/datetime/index.js';

/**
 * All member IDs currently hidden from Activity Report (any viewer).
 * @returns {Promise<number[]>}
 */
export async function fetchHiddenUserIds() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('activity_report_hidden_users_table')
    .select('"HiddenUserId"')
    .eq('IsHidden', true);

  if (error) {
    console.error('[activity-report-hidden] fetchHiddenUserIds failed:', error.message);
    // Soft-fail when the table is not migrated yet so Activity Report stays available.
    if (/does not exist|PGRST205|42P01/i.test(String(error.message || error.code || ''))) {
      return [];
    }
    throw error;
  }

  const unique = new Set(
    (data || [])
      .map((row) => Number(row.HiddenUserId))
      .filter((id) => Number.isFinite(id) && id > 0),
  );
  return [...unique];
}

/**
 * Globally hidden members, optionally limited to a set of user IDs (viewer scope).
 *
 * @param {Array<number|string>} [scopeUserIds]
 * @returns {Promise<Array<{ userId: number, memberName: string, communityId: string|null }>>}
 */
export async function listHiddenMembers(scopeUserIds = null) {
  let hiddenIds = await fetchHiddenUserIds();
  if (hiddenIds.length === 0) return [];

  if (Array.isArray(scopeUserIds)) {
    const allowed = new Set(
      scopeUserIds.map(Number).filter((id) => Number.isFinite(id)),
    );
    hiddenIds = hiddenIds.filter((id) => allowed.has(id));
  }
  if (hiddenIds.length === 0) return [];

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('team_table')
    .select('UserId, UserName, CommunityId')
    .in('UserId', hiddenIds);

  if (error) {
    console.error('[activity-report-hidden] listHiddenMembers failed:', error.message);
    throw error;
  }

  const byId = new Map(
    (data || []).map((row) => [Number(row.UserId), row]),
  );

  return hiddenIds.map((id) => {
    const row = byId.get(id);
    return {
      userId: id,
      memberName: row?.UserName || `User ${id}`,
      communityId: row?.CommunityId != null && String(row.CommunityId).trim()
        ? String(row.CommunityId).trim()
        : null,
    };
  }).sort((a, b) => String(a.memberName).localeCompare(String(b.memberName)));
}

/**
 * Mark a member globally hidden. Does not delete any user/activity data.
 * ViewerUserId records who hid them.
 *
 * @param {number} viewerUserId
 * @param {number} hiddenUserId
 * @returns {Promise<void>}
 */
export async function setMemberHidden(viewerUserId, hiddenUserId) {
  const viewerId = Number(viewerUserId);
  const targetId = Number(hiddenUserId);
  if (!Number.isFinite(viewerId) || !Number.isFinite(targetId)) {
    throw new Error('Invalid viewer or hidden user id');
  }

  const supabase = getSupabaseClient();
  const stamp = nowUtc();

  // Any existing rows for this member → flip all to hidden (global).
  const { data: existingRows, error: lookupError } = await supabase
    .from('activity_report_hidden_users_table')
    .select('"Id"')
    .eq('HiddenUserId', targetId);

  if (lookupError) {
    console.error('[activity-report-hidden] setMemberHidden lookup failed:', lookupError.message);
    throw lookupError;
  }

  if (Array.isArray(existingRows) && existingRows.length > 0) {
    const { error } = await supabase
      .from('activity_report_hidden_users_table')
      .update({ IsHidden: true, UpdatedAt: stamp })
      .eq('HiddenUserId', targetId);
    if (error) {
      console.error('[activity-report-hidden] setMemberHidden update failed:', error.message);
      throw error;
    }
    return;
  }

  const { error } = await supabase
    .from('activity_report_hidden_users_table')
    .insert({
      ViewerUserId: viewerId,
      HiddenUserId: targetId,
      IsHidden: true,
      CreatedAt: stamp,
      UpdatedAt: stamp,
    });

  if (error) {
    console.error('[activity-report-hidden] setMemberHidden insert failed:', error.message);
    throw error;
  }
}

/**
 * Unhide a member globally for every viewer. Does not delete any user/activity data.
 *
 * @param {number} hiddenUserId
 * @returns {Promise<boolean>} true when at least one row was updated
 */
export async function setMemberVisible(hiddenUserId) {
  const targetId = Number(hiddenUserId);
  if (!Number.isFinite(targetId)) {
    throw new Error('Invalid hidden user id');
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('activity_report_hidden_users_table')
    .update({ IsHidden: false, UpdatedAt: nowUtc() })
    .eq('HiddenUserId', targetId)
    .eq('IsHidden', true)
    .select('"Id"');

  if (error) {
    console.error('[activity-report-hidden] setMemberVisible failed:', error.message);
    throw error;
  }

  return Array.isArray(data) && data.length > 0;
}
