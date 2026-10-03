/**
 * Sponsor visibility — only users with a verified account email appear
 * in new-member sponsor search. Email is assigned after OTP ownership
 * proof (or Google login), so a real Email on the row = eligible.
 */

export function hasVerifiedSponsorEmail(user) {
  const email = String(user?.Email || user?.email || '').trim();
  return email.includes('@');
}
