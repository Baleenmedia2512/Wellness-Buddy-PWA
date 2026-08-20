/**
 * Shared Reports Nutrition/Trend viewed-member helpers.
 * selectedMember = null or isSelf → logged-in user.
 */

export function resolveReportsViewedUser(selectedMember, sessionUser) {
  if (!selectedMember || selectedMember.isSelf) return sessionUser;
  return selectedMember;
}

export function reportsSelectedUserLabel(selectedMember) {
  if (!selectedMember || selectedMember.isSelf) return 'My Profile';
  return selectedMember.userName || selectedMember.name || 'Member';
}

/**
 * Prefer selectedMember, then session user fields for the display name.
 * @param {object|null} selectedMember
 * @param {string} noun e.g. "Weight Trend"
 * @param {object|null} [sessionUser] used when selectedMember is self/null for "My …" only
 */
export function reportsMemberPossessiveTitle(selectedMember, noun, sessionUser = null) {
  if (!selectedMember || selectedMember.isSelf) return `My ${noun}`;
  const viewed = resolveReportsViewedUser(selectedMember, sessionUser);
  const name = viewed?.userName
    || viewed?.name
    || selectedMember.userName
    || selectedMember.name
    || 'Member';
  return `${name}'s ${noun}`;
}
