/**
 * Search JSON for /api/coach/team-hierarchy?purpose=search.
 * Same people as allMembers today; drops BCM body fields search does not use.
 * Full purpose must not call this — Leadership / BCM still need the extra columns.
 */

/**
 * @param {object} member
 * @returns {object}
 */
export function slimSearchMember(member) {
  if (!member || typeof member !== 'object') return member;
  const row = {
    UserId: member.UserId,
    UserName: member.UserName,
    Email: member.Email,
    CommunityId: member.CommunityId || null,
    Role: member.Role,
    CoachId: member.CoachId,
    CoCoachId: member.CoCoachId,
    Status: member.Status,
    phoneNumber: member.phoneNumber || null,
    clubName: member.clubName || null,
  };
  if (member.isCoCoach) row.isCoCoach = true;
  return row;
}

/**
 * @param {object[]} members
 * @returns {object[]}
 */
export function slimSearchAllMembers(members) {
  if (!Array.isArray(members)) return members;
  return members.map(slimSearchMember);
}
