/**
 * teamSearchService.js — pure helpers + IO for the team-search slice.
 * Owns the network call(s) and any list normalisation. No React.
 */
import { teamHierarchyService } from '../../../shared/services/teamHierarchyService';
import cacheManager from '../../../shared/services/cacheManager.js';
import { hasValidProfileName } from '../../user/domain/profileCompleteness';
import { getProfile } from '../../user/services/user.api.js';

/** Coach-like roles that may search/view other team members. */
const COACH_ROLES = new Set(['coach', 'coccoach', 'upline', 'admin', 'developer']);

export function isCoachRole(role) {
  return COACH_ROLES.has(String(role || '').toLowerCase());
}

/** True when role grants search or user coaches at least one team_table row. */
export function canUseTeamSearch(role, hasTeamMembers) {
  return isCoachRole(role) || Boolean(hasTeamMembers);
}

/** Check team_table: does any user list this userId as their CoachId? */
export async function fetchHasTeamMembers(userId) {
  if (!userId) return false;
  const key = cacheManager.generateKey('hasTeamMembers', String(userId));
  return cacheManager.execute(
    key,
    async () => {
      const apiBaseUrl = process.env.REACT_APP_API_BASE_URL;
      const res = await fetch(
        `${apiBaseUrl}/api/team/has-members?userId=${encodeURIComponent(userId)}`,
      );
      if (!res.ok) return false;
      const data = await res.json();
      return Boolean(data?.hasTeamMembers);
    },
    cacheManager.ttls.hasTeamMembers,
  );
}

/**
 * Fetch the saved profile UserName for the current user.
 * Returns '' when missing or when UserName is a placeholder (email local-part / phone user_*).
 */
export async function fetchSavedUserName(email) {
  const profile = await fetchSavedSearchProfile(email);
  return profile.userName;
}

/**
 * Profile fields needed for team search (display name + Community ID).
 * userName is '' when missing or a placeholder (email local-part / phone user_*).
 */
export async function fetchSavedSearchProfile(email) {
  if (!email) return { userName: '', communityId: null };
  try {
    const data = await getProfile(email);
    if (!data?.success || !data?.data) return { userName: '', communityId: null };
    const name = String(data.data.userName || '').trim();
    const profileEmail = data.data.email || email;
    const communityId = data.data.communityId != null
      ? String(data.data.communityId).trim() || null
      : null;
    if (!hasValidProfileName(name, {
      email: profileEmail,
      phoneNumber: data.data.phoneNumber,
    })) {
      return { userName: '', communityId };
    }
    return { userName: name, communityId };
  } catch {
    return { userName: '', communityId: null };
  }
}

/**
 * Display name for the team search input — profile UserName only.
 * Never falls back to email local-part.
 */
export function resolveTeamSearchDisplayName(savedUserName, user) {
  const email = user?.email || user?.Email || '';
  const phoneNumber = user?.phoneNumber || user?.PhoneNumber || '';
  const candidates = [
    savedUserName,
    user?.userName,
    user?.username,
    user?.name,
    user?.displayName,
  ];
  for (const candidate of candidates) {
    if (hasValidProfileName(candidate, { email, phoneNumber })) {
      return String(candidate).trim();
    }
  }
  return '';
}

/**
 * Attach each member's direct-coach Community ID for search display.
 *
 * Rule (downline search subtitle):
 *   You (coach CID=C0)
 *   ├── a1, a2, a3     → show C0 (their direct coach is You)
 *   └── a2's children  → show a2's Community ID (their direct coach is a2)
 *
 * Own Community ID stays on `communityId`; display uses `directCoachCommunityId`.
 */
export function withDirectCoachCommunityIds(members) {
  const cidByUserId = new Map();
  for (const m of members) {
    if (m?.userId == null) continue;
    const cid = String(m.communityId || '').trim();
    if (cid) cidByUserId.set(String(m.userId), cid);
  }
  return members.map((m) => {
    if (m.isSelf) {
      return { ...m, directCoachCommunityId: null };
    }
    const coachCid = m.coachId != null
      ? (cidByUserId.get(String(m.coachId)) || null)
      : null;
    return { ...m, directCoachCommunityId: coachCid };
  });
}

/** Fetch the coach's full team (Active members only) and prepend the coach themselves. */
export async function fetchTeamMembers({
  coachId, coachName, coachEmail, coachRole, coachCommunityId = null,
}) {
  const flatList = await teamHierarchyService.getFlatTeamList(coachId);
  // Defense-in-depth: backend already returns Active-only; drop any Inactive rows.
  const activeOnly = flatList.filter((m) => {
    if (m.userId === coachId) return true;
    if (m.status == null) return true;
    return String(m.status).toLowerCase() === 'active';
  });
  const filtered = activeOnly.filter((m) => m.userId !== coachId);
  const withCoach = [
    {
      userId: coachId,
      userName: coachName || '',
      email: coachEmail,
      communityId: coachCommunityId || null,
      role: coachRole,
      status: 'Active',
      isSelf: true,
    },
    ...filtered,
  ];
  const deduped = Array.from(new Map(withCoach.map((m) => [m.userId, m])).values());
  return withDirectCoachCommunityIds(deduped);
}

/**
 * Community ID shown on a search / downline row.
 * Always the person's own ID (including downline coaches).
 * Hidden on the searching coach's own "Me" row — never the direct coach's ID.
 */
export function subtitleCommunityId(member) {
  if (!member || member.isSelf) return null;
  const cid = String(member.communityId || '').trim();
  return cid || null;
}

/**
 * Case-insensitive name/email/communityId substring filter over the Active-only member list.
 * Community ID matches the value shown in the subtitle (the member's own ID).
 * Empty query returns [] (dropdown stays closed until the user types).
 */
export function filterMembers(members, query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return members.filter(
    (m) =>
      (m.userName || '').toLowerCase().includes(q) ||
      (m.email || '').toLowerCase().includes(q) ||
      String(subtitleCommunityId(m) || '').toLowerCase().includes(q),
  );
}

/**
 * Second line for team search / downline rows:
 * "email | communityId", or whichever side is present (never an empty "|").
 * Callers pass the *member's own* Community ID (not the viewing coach's).
 */
export function formatMemberSubtitle(email, communityId) {
  const mail = String(email || '').trim();
  const cid = String(communityId || '').trim();
  if (mail && cid) return `${mail} | ${cid}`;
  if (mail) return mail;
  if (cid) return cid;
  return '';
}

/** Map the slim DB shape into the user-object shape the rest of the app expects. */
export function toSelectedUser(member) {
  return {
    id: member.userId,
    userId: member.userId,
    name: member.userName,
    userName: member.userName,
    email: member.email,
    communityId: member.communityId || null,
    directCoachCommunityId: member.directCoachCommunityId || null,
    coachId: member.coachId ?? null,
    role: member.role,
    isSelf: member.isSelf,
  };
}
