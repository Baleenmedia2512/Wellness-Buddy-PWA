/**
 * Sponsor visibility for new-member onboarding search.
 * A person can be chosen as a sponsor only when both are set:
 * a verified account email, and a Community ID.
 */

export function hasVerifiedSponsorEmail(user) {
  const email = String(user?.Email || user?.email || '').trim();
  return email.includes('@');
}

export function hasSponsorCommunityId(user) {
  const communityId = String(user?.CommunityId || user?.communityId || '').trim();
  return communityId.length > 0;
}

/** Email alone is not enough — Community ID is required as well. */
export function isEligibleSponsor(user) {
  return hasVerifiedSponsorEmail(user) && hasSponsorCommunityId(user);
}
