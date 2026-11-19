/**
 * Working Physical Centre for Profile.
 * Own active clubs, else the nearest upline's clubs. None when the chain has none.
 */
import * as repo from './centers.repository.js';
import { coachIdByUser, resolveWorkingPhysicalCentre } from './domain/searchClub.rules.js';

const MAX_UPLINE_STEPS = 25;
const EMPTY = { id: null, name: null, options: [] };

export async function getWorkingPhysicalCentre(userId) {
  const start = Number(userId);
  if (!Number.isFinite(start) || start <= 0) return EMPTY;

  const chain = [];
  const coachRows = [];
  const seen = new Set();
  let current = start;

  while (Number.isFinite(current) && current > 0 && !seen.has(current) && chain.length < MAX_UPLINE_STEPS) {
    seen.add(current);
    chain.push(current);
    const parent = await repo.findCoachId(current);
    coachRows.push({ UserId: current, CoachId: parent });
    if (parent == null || parent === current) break;
    current = parent;
  }

  const centers = await repo.findActiveCentersByOwnerIds(chain);
  return resolveWorkingPhysicalCentre(start, centers, coachIdByUser(coachRows));
}
