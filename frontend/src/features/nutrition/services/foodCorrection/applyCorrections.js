// Orchestrator: walk an analysis's foods[], skip solids, look up corrections,
// build corrected food objects, and emit the auto-correction summary log.
import { isFoodLiquidOrShake, normalizeFoodName } from './normalize';
import { getGlobalCorrectionsMap } from './correctionMap';
import { findCorrectionMatch } from './correctionMatcher';
import { buildCorrectedFood } from './correctionApplier';
import { debugLog } from '../../../../shared/utils/logger.js';

const logSummary = (corrected, totalLiquids) => {
  if (corrected.length === 0) {
    if (totalLiquids > 0) debugLog(`   ℹ️ No liquid foods matched corrections (${totalLiquids} liquids analyzed)`);
    return;
  }
  debugLog(`✅ [HYBRID-AUTO] Auto-corrected ${corrected.length} of ${totalLiquids} liquid foods:`);
  const globalC = corrected.filter((c) => c.source === 'global').length;
  const userC   = corrected.filter((c) => c.source === 'user-specific').length;
  if (globalC > 0) debugLog(`   🌍 ${globalC} global corrections applied`);
  if (userC   > 0) debugLog(`   👤 ${userC} user-specific corrections applied`);
  corrected.forEach((c) => debugLog(`   ${c.source === 'user-specific' ? '👤' : '🌍'} "${c.original}" → "${c.corrected}" (${c.matchType})`));
};

export async function applyGlobalAutoCorrections(foods, currentUserId = null) {
  if (!foods || !Array.isArray(foods) || foods.length === 0) return foods;
  try {
    const correctionMap = await getGlobalCorrectionsMap(currentUserId);
    if (correctionMap.size === 0) return foods;

    let totalLiquids = 0;
    const correctedSummary = [];

    const processed = foods.map((food) => {
      // Solid items skipped — autocorrection only targets liquids/shakes.
      if (!isFoodLiquidOrShake(food)) return food;
      totalLiquids++;

      const original = food.name;
      const trueOriginalAiName = food.originalAiName || original;
      const normalized = normalizeFoodName(original);
      const match = findCorrectionMatch(correctionMap, normalized);
      if (!match) return food;

      const { food: nextFood, skipped } = buildCorrectedFood(food, match.correction, match.matchType, trueOriginalAiName);
      if (skipped) return food;

      correctedSummary.push({
        original,
        corrected: match.correction.user_corrected,
        matchType: match.matchType,
        source: match.correction.source || (match.correction.user_id ? 'user-specific' : 'global'),
      });
      return nextFood;
    });

    logSummary(correctedSummary, totalLiquids);
    return processed;
  } catch (error) {
    console.error('[HYBRID-AUTO] Error:', error);
    return foods;
  }
}

/** Backward-compatible alias of applyGlobalAutoCorrections. */
export const applyUserCorrections = applyGlobalAutoCorrections;
