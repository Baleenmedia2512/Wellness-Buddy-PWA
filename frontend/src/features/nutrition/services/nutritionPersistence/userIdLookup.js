// Resolve an email/userId to the team_table UserID required by the API.

export async function lookupUserId(email) {
  const apiBaseUrl = process.env.REACT_APP_API_BASE_URL;
  try {
    const res = await fetch(`${apiBaseUrl}/api/user/lookup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to lookup user ID');
    return data;
  } catch (err) {
    console.error('[lookupUserId] Error:', err);
    throw err;
  }
}

/**
 * Resolve any userId-shaped input (numeric ID, email) into a team_table UserID.
 * Throws if the value cannot be safely resolved.
 */
export async function resolveTeamUserId(userId) {
  if (userId && String(userId).includes('@')) {
    try {
      const lookup = await lookupUserId(userId);
      if (lookup.success && lookup.userId) return lookup.userId;
      console.warn('[resolveTeamUserId] No UserID found in team_table for:', userId);
      throw new Error('User not found in team_table. Please contact support.');
    } catch (lookupErr) {
      console.error('[resolveTeamUserId] UserID lookup failed:', lookupErr.message);
      throw new Error(`Unable to save: ${lookupErr.message}`);
    }
  }
  if (userId && !isNaN(userId)) return userId;
  console.warn('[resolveTeamUserId] Non-email userId provided:', userId);
  throw new Error('Please log in with a valid email to save nutrition data.');
}
