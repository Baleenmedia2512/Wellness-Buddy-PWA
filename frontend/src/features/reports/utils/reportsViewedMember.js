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

export function reportsMemberPossessiveTitle(selectedMember, noun) {
  if (!selectedMember || selectedMember.isSelf) return `My ${noun}`;
  const name = selectedMember.userName || selectedMember.name || 'Member';
  return `${name}'s ${noun}`;
}
