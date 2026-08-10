/**
 * diary/api/beverageIntakeClient.js
 *
 * Day beverage totals for WhatsApp share captions ("so far today").
 * Hits the same GET /api/water/intake contract as the water feature,
 * kept inside diary to avoid a cross-slice import (VSA).
 */

import { getApiBaseUrl } from '../../../config/api.config.js';

/**
 * @param {string|number} userId
 * @param {string} dateYmd YYYY-MM-DD business calendar date
 * @returns {Promise<{ totalMl: number, totalAfreshScoops: number }>}
 */
export async function fetchDayBeverageIntake(userId, dateYmd) {
  if (userId == null || userId === '' || !dateYmd) {
    throw new Error('userId and date required');
  }
  const url = `${getApiBaseUrl()}/api/water/intake?userId=${encodeURIComponent(
    userId,
  )}&date=${encodeURIComponent(dateYmd)}&_t=${Date.now()}`;
  const res = await fetch(url, {
    cache: 'no-store',
    headers: { 'Cache-Control': 'no-cache' },
  });
  if (!res.ok) throw new Error(`Server error ${res.status}`);
  const data = await res.json();
  return {
    totalMl: Math.max(0, Math.round(Number(data?.totalMl) || 0)),
    totalAfreshScoops: Math.max(0, Math.round(Number(data?.totalAfreshScoops) || 0)),
  };
}
