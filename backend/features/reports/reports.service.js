/**
 * reports.service.js — Business logic for the Reports feature.
 * Zero HTTP concerns. Orchestrates: validation → data → domain → response shape.
 */
import { validateDownlineWeightStatus } from './reports.validators.js';
import { getDirectDownline, getLatestWeightsForUsers } from './reports.repository.js';
import { computeIdealWeightRange } from '../../utils/weightValidation.js';

/**
 * Classify a member's weight status relative to their ideal range.
 * @param {number|null} currentWeight
 * @param {{ idealMin: number, idealMax: number }|null} idealRange
 * @returns {'above_ideal'|'below_ideal'|'on_track'|'no_weight'|'no_height'}
 */
function classifyStatus(currentWeight, idealRange) {
  if (!idealRange) return 'no_height';
  if (currentWeight === null || currentWeight === undefined) return 'no_weight';
  if (currentWeight > idealRange.idealMax) return 'above_ideal';
  if (currentWeight < idealRange.idealMin) return 'below_ideal';
  return 'on_track';
}

const STATUS_ORDER = { above_ideal: 0, below_ideal: 1, on_track: 2, no_weight: 3, no_height: 4 };

/**
 * GET /api/reports/downline-weight-status
 *
 * @param {{ coachId: string }} rawQuery
 * @returns {{ httpStatus: number, body: object }}
 */
export async function getDownlineWeightStatus(rawQuery) {
  const { coachId } = validateDownlineWeightStatus(rawQuery);

  // 1. Fetch direct downline
  const members = await getDirectDownline(coachId);
  if (members.length === 0) {
    return {
      httpStatus: 200,
      body: { success: true, data: [] },
    };
  }

  // 2. Fetch latest weight for each member in one round-trip
  const userIds = members.map((m) => m.UserId);
  const weightMap = await getLatestWeightsForUsers(userIds);

  // 3. Build response rows
  const rows = members.map((m) => {
    const currentWeight = weightMap.get(m.UserId) ?? null;
    const idealRange = computeIdealWeightRange(m.Height);
    const status = classifyStatus(currentWeight, idealRange);

    return {
      userId:        m.UserId,
      userName:      m.UserName,
      heightCm:      m.Height ? parseFloat(m.Height) : null,
      currentWeight,
      idealMin:      idealRange?.idealMin ?? null,
      idealMax:      idealRange?.idealMax ?? null,
      status,
    };
  });

  // 4. Sort: off-track first (above/below), then on_track, then no data
  rows.sort((a, b) => (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99));

  return {
    httpStatus: 200,
    body: { success: true, data: rows },
  };
}
