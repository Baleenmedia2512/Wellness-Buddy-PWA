/**
 * backend/features/quick-share/api/get-public.handler.js
 * ---------------------------------------------------------------------------
 * Orchestrates the no-auth GET /api/quick-share/public/[token].
 * ---------------------------------------------------------------------------
 */
import * as repo from '../data/quick-share.repo.js';
import { toPublicPayload } from '../domain/public-payload.rules.js';

/**
 * @param {{ token: string }} input
 */
export async function getPublic({ token }) {
  const row = await repo.findByPublicToken(token);
  const payload = toPublicPayload({ row });

  if (payload.status === 'not_found') {
    return { httpStatus: 404, body: { success: false, error: { code: 'not_found' } } };
  }
  if (payload.status === 'expired') {
    return { httpStatus: 410, body: { success: false, error: { code: 'expired' } } };
  }
  return {
    httpStatus: 200,
    headers: { 'Cache-Control': 'no-store' },
    body: { success: true, data: payload },
  };
}
