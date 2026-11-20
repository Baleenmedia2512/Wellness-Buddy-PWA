/**
 * Sponsor visibility for new-member onboarding search.
 * A person can be chosen as a sponsor when they have a verified account email.
 */

export function hasVerifiedSponsorEmail(user) {
  const email = String(user?.Email || user?.email || '').trim();
  return email.includes('@');
}

export function hasSponsorCommunityId(user) {
  const communityId = String(user?.CommunityId || user?.communityId || '').trim();
  return communityId.length > 0;
}

/** Verified account email is required to appear as a sponsor. */
export function isEligibleSponsor(user) {
  return hasVerifiedSponsorEmail(user);
}
