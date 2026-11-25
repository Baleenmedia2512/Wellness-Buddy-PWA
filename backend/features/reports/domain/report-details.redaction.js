/**
 * Strip report numbers for a member who is not paid and not inside the trial.
 * Names, ids, and list size stay. Callers must pass a response copy; cached
 * rows are not mutated.
 */

function redactWeightRow(row) {
  if (!row || typeof row !== 'object') return row;
  return {
    ...row,
    currentWeight: null,
    idealMin: null,
    idealMax: null,
    status: null,
    difference: null,
    lastUpdated: null,
    firstReachedAt: null,
    teamPerformance: null,
  };
}

/**
 * @param {{ httpStatus: number, body: object }} result
 * @returns {{ httpStatus: number, body: object }}
 */
export function redactDownlineWeightResponse(result) {
  const data = result?.body?.data;
  if (!data || typeof data !== 'object') return result;
  const all = Number(data.statusCounts?.all) || 0;
  return {
    ...result,
    body: {
      ...result.body,
      data: {
        ...data,
        self: redactWeightRow(data.self),
        members: Array.isArray(data.members) ? data.members.map(redactWeightRow) : data.members,
        statusCounts: { off_track: 0, on_track: 0, no_data: 0, all },
      },
    },
  };
}

function redactWellnessRow(row) {
  if (!row || typeof row !== 'object') return row;
  return {
    ...row,
    todayWeight: null,
    previousWeight: null,
    difference: null,
    percentage: null,
    totalEarned: null,
    wellnessScore: null,
    wellnessScorePossible: null,
    computedAt: null,
  };
}

/**
 * @param {{ httpStatus: number, body: object }} result
 * @returns {{ httpStatus: number, body: object }}
 */
export function redactWellnessScoreResponse(result) {
  const data = result?.body?.data;
  if (!data || typeof data !== 'object') return result;
  return {
    ...result,
    body: {
      ...result.body,
      data: {
        ...data,
        members: Array.isArray(data.members) ? data.members.map(redactWellnessRow) : data.members,
      },
    },
  };
}
