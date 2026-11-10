/**
 * Team-member profile GET. Must go through apiFetch so X-App-Version is sent —
 * APP_VERSION_ENFORCE_API rejects missing_version with HTTP 426.
 */
import { apiFetch } from '../../services/apiFetch.js';

export async function fetchTeamMemberProfile(memberEmail, apiBaseUrl, memberUserId) {
  const email = String(memberEmail || '').trim();
  const userId = memberUserId != null && String(memberUserId).trim() !== ''
    ? String(memberUserId).trim()
    : '';
  const query = email
    ? `email=${encodeURIComponent(email)}`
    : `userId=${encodeURIComponent(userId)}`;
  const res = await apiFetch(
    `/api/user/profile?${query}&_t=${Date.now()}`,
    {
      apiBaseUrl,
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
    },
  );
  if (!res.ok) throw new Error('Failed to load profile');
  return res.json();
}
