/**
 * Persistence for Activity Report per-viewer hidden members.
 */
import { getSupabaseClient } from '../../utils/supabaseClient.js';
import { nowUtc } from '../../shared/lib/datetime/index.js';

/**
 * @param {number} viewerUserId
 * @returns {Promise<number[]>}
 */
export async function fetchHiddenUserIds(viewerUserId) {
  const viewerId = Number(viewerUserId);
  if (!Number.isFinite(viewerId) || viewerId <= 0) return [];

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('activity_report_hidden_users_table')
    .select('"HiddenUserId"')
    .eq('ViewerUserId', viewerId)
    .eq('IsHidden', true);

  if (error) {
    console.error('[activity-report-hidden] fetchHiddenUserIds failed:', error.message);
    // Soft-fail when the table is not migrated yet so Activity Report stays available.
    if (/does not exist|PGRST205|42P01/i.test(String(error.message || error.code || ''))) {
      return [];
    }
    throw error;
  }

  return (data || [])
    .map((row) => Number(row.HiddenUserId))
    .filter((id) => Number.isFinite(id) && id > 0);
}

/**
 * @param {number} viewerUserId
 * @returns {Promise<Array<{ userId: number, memberName: string, communityId: string|null }>>}
 */
export async function listHiddenMembers(viewerUserId) {
  const hiddenIds = await fetchHiddenUserIds(viewerUserId);
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
 * Upsert IsHidden = true for (viewer, target). Does not delete any user/activity data.
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

  const { data: existing, error: lookupError } = await supabase
    .from('activity_report_hidden_users_table')
    .select('"Id"')
    .eq('ViewerUserId', viewerId)
    .eq('HiddenUserId', targetId)
    .maybeSingle();

  if (lookupError) {
    console.error('[activity-report-hidden] setMemberHidden lookup failed:', lookupError.message);
    throw lookupError;
  }

  if (existing?.Id != null) {
    const { error } = await supabase
      .from('activity_report_hidden_users_table')
      .update({ IsHidden: true, UpdatedAt: stamp })
      .eq('Id', existing.Id);
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
 * Set IsHidden = false for (viewer, target). Does not delete any user/activity data.
 *
 * @param {number} viewerUserId
 * @param {number} hiddenUserId
 * @returns {Promise<boolean>} true when a row was updated
 */
export async function setMemberVisible(viewerUserId, hiddenUserId) {
  const viewerId = Number(viewerUserId);
  const targetId = Number(hiddenUserId);
  if (!Number.isFinite(viewerId) || !Number.isFinite(targetId)) {
    throw new Error('Invalid viewer or hidden user id');
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('activity_report_hidden_users_table')
    .update({ IsHidden: false, UpdatedAt: nowUtc() })
    .eq('ViewerUserId', viewerId)
    .eq('HiddenUserId', targetId)
    .eq('IsHidden', true)
    .select('"Id"');

  if (error) {
    console.error('[activity-report-hidden] setMemberVisible failed:', error.message);
    throw error;
  }

  return Array.isArray(data) && data.length > 0;
}
