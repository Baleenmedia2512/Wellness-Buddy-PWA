/**
 * Production aggregate eligibility — hide internal developer accounts from
 * public leaderboards and coach-facing member lists while preserving self-access
 * for production test plans.
 */

import { isDeveloperBotName } from './developerBot.rules.js';

export const DEVELOPER_ROLE = 'developer';

export function isProductionEnvironment() {
  return process.env.NODE_ENV === 'production';
}

export function normalizeUserRole(role) {
  return String(role || 'user').toLowerCase().trim();
}

export function isDeveloperRole(role) {
  return normalizeUserRole(role) === DEVELOPER_ROLE;
}

/**
 * @param {{ Role?: string, role?: string, UserId?: string|number, userId?: string|number }|null|undefined} userRow
 */
export function isDeveloperUser(userRow) {
  if (!userRow) return false;
  return isDeveloperRole(userRow.Role ?? userRow.role);
}

/**
 * In production, exclude developer accounts from public aggregates unless the
 * viewer is the developer (self-access for prod testing).
 *
 * @param {object} userRow
 * @param {{ viewerUserId?: string|number|null }} [options]
 */
export function shouldExcludeDeveloperFromAggregates(userRow, { viewerUserId } = {}) {
  if (!isProductionEnvironment()) return false;
  if (!isDeveloperUser(userRow)) return false;
  const uid = userRow.UserId ?? userRow.userId;
  if (viewerUserId != null && uid != null && String(uid) === String(viewerUserId)) {
    return false;
  }
  return true;
}

/**
 * @param {object[]} users
 * @param {{ viewerUserId?: string|number|null }} [options]
 */
export function filterPublicAggregateUsers(users, options = {}) {
  if (!Array.isArray(users)) return [];
  if (!isProductionEnvironment()) return users;
  return users.filter((u) => !shouldExcludeDeveloperFromAggregates(u, options));
}

/**
 * Skip developer ancestors when resolving ideal-weight coach in production.
 *
 * @param {Array<{ userId: string }>} ancestors
 * @param {Map<string, string>|undefined} roleByUserId
 */
export function filterAncestorsForIdealCoach(ancestors, roleByUserId) {
  if (!isProductionEnvironment() || !Array.isArray(ancestors)) return ancestors;
  return ancestors.filter((node) => {
    if (!node?.userId) return false;
    const role = roleByUserId?.get(String(node.userId));
    return !isDeveloperRole(role);
  });
}

/**
 * Mask sponsor / ideal-coach labels when those users are developers (production).
 * Self-view keeps labels visible so developers can run prod test plans.
 *
 * @param {object|null|undefined} resolved
 * @param {{ memberUserId?: string|number, viewerUserId?: string|number|null, roleByUserId?: Map<string, string> }} [options]
 */
export function sanitizeSponsorCoachLabels(resolved, {
  memberUserId,
  viewerUserId,
  roleByUserId,
} = {}) {
  if (!resolved || !isProductionEnvironment()) return resolved;

  const memberId = memberUserId != null ? String(memberUserId) : null;
  const viewerId = viewerUserId != null ? String(viewerUserId) : null;
  const isSelfView = Boolean(memberId && viewerId && memberId === viewerId);

  const roleFor = (id) => {
    if (id == null || !roleByUserId) return null;
    return roleByUserId.get(String(id)) ?? null;
  };

  // Only a developer viewing their own profile keeps developer sponsor/coach labels
  // visible for production test plans. Regular members never see developer labels,
  // except the dedicated onboarding-test bot so testers can confirm sponsor OTP.
  const allowDeveloperLabels = isSelfView && isDeveloperRole(roleFor(memberId));

  let out = { ...resolved };

  if (
    out.sponsorId
    && isDeveloperRole(roleFor(out.sponsorId))
    && !allowDeveloperLabels
    && !isDeveloperBotName(out.sponsorName)
  ) {
    out = { ...out, sponsorId: null, sponsorName: null };
  }
  if (out.idealCoachId && isDeveloperRole(roleFor(out.idealCoachId)) && !allowDeveloperLabels) {
    out = { ...out, idealCoachId: null, idealCoachName: null };
  }

  return out;
}

/**
 * @param {Map<string, { role?: string|null }>} profiles
 * @returns {Map<string, string>}
 */
export function buildRoleByUserIdFromProfiles(profiles) {
  const map = new Map();
  if (!profiles) return map;
  for (const [id, profile] of profiles.entries()) {
    if (profile?.role != null) map.set(String(id), normalizeUserRole(profile.role));
  }
  return map;
}
