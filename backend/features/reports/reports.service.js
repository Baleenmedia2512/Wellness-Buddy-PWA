/**
 * reports.service.js — Business logic for the Reports feature.
 * Zero HTTP concerns. Orchestrates: validation → data → domain → response shape.
 */
import { validateDownlineWeightStatus } from './reports.validators.js';
import {
  getCoachMember,
  getFullTeamMembers,
  getLatestWeightsForUsers,
} from './reports.repository.js';
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

function buildWeightRow(member, weightMap) {
  const currentWeight = weightMap.get(member.UserId) ?? null;
  const idealRange = computeIdealWeightRange(member.Height);
  const status = classifyStatus(currentWeight, idealRange);

  return {
    userId: member.UserId,
    userName: member.UserName,
    heightCm: member.Height ? parseFloat(member.Height) : null,
    currentWeight,
    idealMin: idealRange?.idealMin ?? null,
    idealMax: idealRange?.idealMax ?? null,
    status,
  };
}

/**
 * GET /api/reports/downline-weight-status
 *
 * Returns the coach's own row plus every descendant's weight status so the
 * client can filter by Mine / Direct Team / Full Team without extra requests.
 *
 * @param {{ coachId: string }} rawQuery
 * @returns {{ httpStatus: number, body: object }}
 */
export async function getDownlineWeightStatus(rawQuery) {
  const { coachId } = validateDownlineWeightStatus(rawQuery);

  const [coachMember, fullTeamMembers] = await Promise.all([
    getCoachMember(coachId),
    getFullTeamMembers(coachId),
  ]);

  const userIds = [
    coachId,
    ...fullTeamMembers.map((m) => m.UserId),
  ];
  const weightMap = await getLatestWeightsForUsers(userIds);

  const selfMember = coachMember || {
    UserId: coachId,
    UserName: 'You',
    Height: null,
  };
  const self = buildWeightRow(selfMember, weightMap);

  const members = fullTeamMembers.map((m) => ({
    ...buildWeightRow(m, weightMap),
    isDirect: m.isDirectToRoot ?? m.CoachId === coachId,
    coachId: m.HierarchyParent ?? m.CoachId,
  }));

  members.sort((a, b) => (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99));

  return {
    httpStatus: 200,
    body: { success: true, data: { self, members } },
  };
}
