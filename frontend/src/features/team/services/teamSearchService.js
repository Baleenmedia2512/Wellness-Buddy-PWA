/**
 * teamSearchService.js — pure helpers + IO for the team-search slice.
 * Owns the network call(s) and any list normalisation. No React.
 */
import { teamHierarchyService } from '../../../shared/services/teamHierarchyService';

/** Coach-like roles that may search/view other team members. */
const COACH_ROLES = new Set(['coach', 'coCoach', 'admin', 'developer']);

export function isCoachRole(role) {
  return COACH_ROLES.has(role);
}

/** Fetch the saved profile name for the current user (best-effort). */
export async function fetchSavedUserName(email) {
  if (!email) return '';
  const apiBaseUrl = process.env.REACT_APP_API_BASE_URL;
  const cacheBuster = Date.now();
  const res = await fetch(
    `${apiBaseUrl}/api/user/profile?email=${encodeURIComponent(email)}&_t=${cacheBuster}`,
    { cache: 'no-store', headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' } },
  );
  if (!res.ok) return '';
  const data = await res.json();
  return (data?.success && data?.data?.userName) || '';
}

/** Fetch the coach's full team and prepend the coach themselves. */
export async function fetchTeamMembers({ coachId, coachName, coachEmail, coachRole }) {
  const flatList = await teamHierarchyService.getFlatTeamList(coachId);
  const filtered = flatList.filter((m) => m.userId !== coachId);
  const withCoach = [
    {
      userId: coachId,
      userName: coachName,
      email: coachEmail,
      role: coachRole,
      isSelf: true,
    },
    ...filtered,
  ];
  return Array.from(new Map(withCoach.map((m) => [m.userId, m])).values());
}

/** Case-insensitive name/email substring filter. */
export function filterMembers(members, query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return members.filter(
    (m) => m.userName.toLowerCase().includes(q) || m.email.toLowerCase().includes(q),
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
