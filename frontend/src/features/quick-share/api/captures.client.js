/**
 * frontend/src/features/quick-share/api/captures.client.js
 * ---------------------------------------------------------------------------
 * API client for POST /api/quick-share/captures.
 * ---------------------------------------------------------------------------
 */
import { debugLog } from '../../../shared/utils/logger.js';

/**
 * Upload a captured image to the backend for background AI analysis.
 * Returns the share token and public view URL immediately.
 *
 * @param {{ imageBase64: string, mimeType: string, userId: string }} opts
 * @returns {Promise<{ token: string, viewUrl: string, expiresAt: string }>}
 */
export async function postCapture({ imageBase64, mimeType, userId }) {
  const apiBase = process.env.REACT_APP_API_BASE_URL || '';
  debugLog('[captures.client] Posting capture for background analysis...');

  const response = await fetch(`${apiBase}/api/quick-share/captures`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64, mimeType, userId }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody?.error?.message || `HTTP ${response.status}`);
  }

  const json = await response.json();
  if (!json.ok) {
    throw new Error(json.error?.message || 'Unexpected response from server.');
  }

  debugLog('[captures.client] Capture posted, token received:', json.data.token);
  return json.data;
}
