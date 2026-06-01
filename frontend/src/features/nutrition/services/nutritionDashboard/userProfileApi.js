/**
 * fetchUserLatestWeight — fetch latestWeight from the user profile endpoint.
 * Returns null if the profile call fails or weight is not set.
 */
export async function fetchUserLatestWeight({ apiBaseUrl, email }) {
  if (!email) return null;
  try {
    const res = await fetch(
      `${apiBaseUrl}/api/user/profile?email=${encodeURIComponent(email)}&_t=${Date.now()}`,
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data.success && data.data?.latestWeight) {
      const w = parseFloat(data.data.latestWeight);
      return Number.isFinite(w) && w > 0 ? w : null;
    }
    return null;
  } catch {
    return null;
  }
}
