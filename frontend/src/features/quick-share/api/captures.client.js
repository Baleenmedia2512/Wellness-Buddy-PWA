/**
 * frontend/src/features/quick-share/api/captures.client.js
 * ---------------------------------------------------------------------------
 * Thin client for POST /api/quick-share/captures. No business rules.
 * Returns the server payload as-is. Callers handle errors.
 * ---------------------------------------------------------------------------
 */

const API_BASE = process.env.REACT_APP_API_BASE_URL || '';

/**
 * @param {{ userId: string, imageBase64: string, clientNonce?: string }} args
 * @returns {Promise<{ success: boolean, token: string, viewUrl: string, expiresAt: string }>}
 */
export async function createCapture({ userId, imageBase64, clientNonce }) {
  const res = await fetch(`${API_BASE}/api/quick-share/captures`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, kind: 'food', imageBase64, clientNonce }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body?.message || `Quick-share upload failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}
