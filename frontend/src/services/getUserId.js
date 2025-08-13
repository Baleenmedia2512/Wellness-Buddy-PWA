// src/services/getUserId.js
/**
 * Looks up the real UserID from the backend using email or firebaseUid.
 * Returns the UserID from the DB, or null if not found.
 */
export async function getUserId(user) {
  const apiBaseUrl = process.env.REACT_APP_API_BASE_URL;
  if (!user) return null;
  const email = user.email || null;
  const firebaseUid = user.uid || null;
  if (!email && !firebaseUid) return null;
  try {
    const res = await fetch(`${apiBaseUrl}/api/lookup-user-id`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, firebaseUid })
    });
    const data = await res.json();
    if (data.success && data.userId) {
      return data.userId;
    }
    return null;
  } catch (err) {
    console.error('[getUserId] Error:', err);
    return null;
  }
}
