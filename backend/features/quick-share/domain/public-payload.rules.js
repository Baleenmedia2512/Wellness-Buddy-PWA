/**
 * backend/features/quick-share/domain/public-payload.rules.js
 * ---------------------------------------------------------------------------
 * Pure transformation from a food_nutrition_data_table row into the JSON
 * payload that is served by the public (no-auth) endpoint.
 *
 * Privacy rule (claude.md §8.3): the public payload MUST NOT include any
 * PII — no userId, no email, no name, no phone, no coach/team data.
 * ---------------------------------------------------------------------------
 */
import { isExpired } from './token.rules.js';

/**
 * @param {object} args
 * @param {object|null} args.row  raw food_nutrition_data_table row, or null
 * @param {number} [args.nowMs]
 * @returns {{ status: 'not_found'|'expired'|'pending'|'ready'|'failed',
 *             kind: 'food',
 *             createdAt: string|null,
 *             nutrition: object|null,
 *             foods: Array|null,
 *             confidence: number|null }}
 */
export function toPublicPayload({ row, nowMs = Date.now() }) {
  if (!row) {
    return { status: 'not_found', kind: 'food', createdAt: null, nutrition: null, foods: null, confidence: null };
  }
  if (isExpired(row.ShareExpiresAt, nowMs)) {
    return { status: 'expired', kind: 'food', createdAt: null, nutrition: null, foods: null, confidence: null };
  }
  // IsDeleted flag is set by soft-delete in background-analysis. Treat as gone.
  if (row.IsDeleted === 1) {
    return { status: 'not_found', kind: 'food', createdAt: null, nutrition: null, foods: null, confidence: null };
  }

  const analysis = parseAnalysis(row.AnalysisData);
  if (analysis == null) {
    return {
      status: 'pending',
      kind: 'food',
      createdAt: row.CreatedAt ?? null,
      nutrition: null,
      foods: null,
      confidence: null,
    };
  }

  const total = analysis.total ?? null;
  const nutrition = total
    ? {
        calories: total.calories ?? null,
        protein:  total.protein  ?? null,
        carbs:    total.carbs    ?? null,
        fat:      total.fat      ?? null,
        fiber:    total.fiber    ?? null,
      }
    : null;

  return {
    status: 'ready',
    kind: 'food',
    createdAt: row.CreatedAt ?? null,
    nutrition,
    foods: Array.isArray(analysis.foods) ? analysis.foods : null,
    confidence: typeof row.ConfidenceScore === 'number' ? row.ConfidenceScore : null,
  };
}

function parseAnalysis(value) {
  if (value == null) return null;
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
