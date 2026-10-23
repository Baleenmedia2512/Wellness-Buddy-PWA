/**
 * Fill Working Physical Centre when profile JSON has no club yet.
 * Uses the club list plus the upline chain (direct coach, then that coach's coach).
 */
import { getApiBaseUrl } from '../../../config/api.config.js';
import { apiFetch } from '../../../shared/services/apiFetch.js';
import { resolveWorkingPhysicalCentreFromChain } from '../domain/workingPhysicalCentre.js';

const MAX_UPLINE_STEPS = 25;
const EMPTY = { id: null, name: null, options: [] };

function hasCentre(centre) {
  return Boolean(centre?.name) || (Array.isArray(centre?.options) && centre.options.length > 0);
}

async function readDirectCoachId(userId) {
  const res = await apiFetch(
    `${getApiBaseUrl()}/api/user/get-active-coach?userId=${encodeURIComponent(userId)}`,
  );
  const body = await res.json().catch(() => ({}));
  const parent = Number(body?.data?.originalCoachId);
  return Number.isFinite(parent) && parent > 0 ? parent : null;
}

async function readAllCentres(userId) {
  const res = await apiFetch(
    `${getApiBaseUrl()}/api/nutrition-centers?userId=${encodeURIComponent(userId)}&scope=all&metrics=0&paginate=0`,
  );
  const body = await res.json().catch(() => ({}));
  return Array.isArray(body?.data) ? body.data : [];
}

export async function loadWorkingPhysicalCentre({ userId, profileCentre = null }) {
  if (hasCentre(profileCentre)) return profileCentre;
  const start = Number(userId);
  if (!Number.isFinite(start) || start <= 0) return EMPTY;

  const centers = await readAllCentres(start);
  const owners = new Set(
    centers.map((center) => Number(center?.owner_user_id)).filter((id) => Number.isFinite(id) && id > 0),
  );
  const chain = [];
  const seen = new Set();
  let current = start;
  while (Number.isFinite(current) && current > 0 && !seen.has(current) && chain.length < MAX_UPLINE_STEPS) {
    seen.add(current);
    chain.push(current);
    if (owners.has(current)) break;
    const parent = await readDirectCoachId(current);
    if (parent == null || parent === current) break;
    current = parent;
  }
  return resolveWorkingPhysicalCentreFromChain(start, centers, chain);
}
