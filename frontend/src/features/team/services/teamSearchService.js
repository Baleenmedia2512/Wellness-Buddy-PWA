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
  if (!email) return '';
  try {
    const data = await getProfile(email);
    if (!data?.success || !data?.data) return '';
    const name = String(data.data.userName || '').trim();
    const profileEmail = data.data.email || email;
    if (!hasValidProfileName(name, {
      email: profileEmail,
      phoneNumber: data.data.phoneNumber,
    })) {
      return '';
    }
    return name;
  } catch {
    return '';
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

/** Fetch the coach's full team (Active members only) and prepend the coach themselves. */
export async function fetchTeamMembers({ coachId, coachName, coachEmail, coachRole }) {
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
      role: coachRole,
      status: 'Active',
      isSelf: true,
    },
    ...filtered,
  ];
  return Array.from(new Map(withCoach.map((m) => [m.userId, m])).values());
}

/**
 * Case-insensitive name/email substring filter over the Active-only member list.
 * Empty query returns [] (dropdown stays closed until the user types).
 */
export function filterMembers(members, query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return members.filter(
    (m) =>
      (m.userName || '').toLowerCase().includes(q) ||
      (m.email || '').toLowerCase().includes(q),
  );
}

/** Map the slim DB shape into the user-object shape the rest of the app expects. */
export function toSelectedUser(member) {
  return {
    id: member.userId,
    userId: member.userId,
    name: member.userName,
    userName: member.userName,
    email: member.email,
    role: member.role,
    isSelf: member.isSelf,
  };
}
