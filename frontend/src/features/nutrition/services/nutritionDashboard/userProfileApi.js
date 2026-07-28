/**
 * fetchUserMacroProfile — fetch latestWeight + gender from the user profile endpoint.
 * Gender comes from coach-recorded body metrics (body_parameters_cards) when present.
 * Returns nulls when the profile call fails or fields are unset.
 *
 * @returns {Promise<{ latestWeight: number|null, gender: string|null }>}
 */
export async function fetchUserMacroProfile({ apiBaseUrl, email }) {
  if (!email) return { latestWeight: null, gender: null };
  try {
    const res = await fetch(
      `${apiBaseUrl}/api/user/profile?email=${encodeURIComponent(email)}&_t=${Date.now()}`,
    );
    if (!res.ok) return { latestWeight: null, gender: null };
    const data = await res.json();
    if (!data.success || !data.data) return { latestWeight: null, gender: null };

    let latestWeight = null;
    if (data.data.latestWeight) {
      const w = parseFloat(data.data.latestWeight);
      latestWeight = Number.isFinite(w) && w > 0 ? w : null;
    }

    const rawGender = data.data.bodyMetrics?.gender;
    const gender = rawGender && String(rawGender).trim() ? String(rawGender).trim() : null;

    return { latestWeight, gender };
  } catch {
    return { latestWeight: null, gender: null };
  }
}

/**
 * @deprecated Prefer fetchUserMacroProfile — kept for callers that only need weight.
 */
export async function fetchUserLatestWeight({ apiBaseUrl, email }) {
  const { latestWeight } = await fetchUserMacroProfile({ apiBaseUrl, email });
  return latestWeight;
}
