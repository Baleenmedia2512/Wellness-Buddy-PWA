/**
 * context.service.js — User feature: GET /api/user/context.
 *
 * Builds the personalized food-correction context (personal corrections,
 * de-duplicated global patterns with chained-correction resolution, recent
 * meals, diet preference). Preserves response shape byte-identical to the
 * legacy handler.
 */
import * as repo from './user.repository.js';

function normalizeFoodName(name) {
  if (!name) return '';
  return name.toLowerCase().trim().replace(/[-–—_()[\]{}]/g, ' ').replace(/\s+/g, ' ').trim();
}

function groupCorrectionsByAi(rows) {
  const map = new Map();
  for (const row of rows) {
    const k = normalizeFoodName(row.AiDetected);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push({
      aiDetected: row.AiDetected, userCorrected: row.UserCorrected, userId: row.UserId,
      timesCorrected: row.TimesCorrected || 1, lastCorrected: row.LastCorrected,
    });
  }
  return map;
}

function pickMostRecentPerCorrectionGroup(aiDetectionMap) {
  const out = new Map();
  aiDetectionMap.forEach((corrections, normalizedAi) => {
    const groups = new Map();
    for (const corr of corrections) {
      const nc = normalizeFoodName(corr.userCorrected);
      if (!groups.has(nc)) {
        groups.set(nc, {
          ai_detected: corr.aiDetected, user_corrected: corr.userCorrected,
          normalized_ai: normalizedAi, users: new Set(), total_corrections: 0,
          lastCorrected: corr.lastCorrected,
        });
      }
      const g = groups.get(nc);
      g.users.add(corr.userId);
      g.total_corrections += corr.timesCorrected;
      if (new Date(corr.lastCorrected) > new Date(g.lastCorrected)) {
        g.lastCorrected = corr.lastCorrected;
        g.user_corrected = corr.userCorrected;
      }
    }
    const mostRecent = Array.from(groups.values())
      .sort((a, b) => new Date(b.lastCorrected) - new Date(a.lastCorrected))[0];
    if (mostRecent) out.set(`${normalizedAi}|${normalizeFoodName(mostRecent.user_corrected)}`, mostRecent);
  });
  return out;
}

function buildCorrectionChain(globalPatternsMap) {
  const chain = new Map();
  globalPatternsMap.forEach((p) => {
    const k = p.normalized_ai;
    if (!chain.has(k)) chain.set(k, []);
    chain.get(k).push({
      target: p.user_corrected, normalized_target: normalizeFoodName(p.user_corrected),
      total_corrections: p.total_corrections, user_count: p.users.size, lastCorrected: p.lastCorrected,
    });
  });
  chain.forEach((arr) => arr.sort((a, b) => new Date(b.lastCorrected) - new Date(a.lastCorrected)));
  return chain;
}

function resolveFinalPatterns(globalPatternsMap, correctionChainMap) {
  const followChain = (foodName, visited = new Set()) => {
    const n = normalizeFoodName(foodName);
    if (visited.has(n)) return foodName;
    visited.add(n);
    const arr = correctionChainMap.get(n);
    if (!arr?.length) return foodName;
    return followChain(arr[0].target, visited);
  };
  const out = new Map();
  globalPatternsMap.forEach((p) => {
    const final = followChain(p.ai_detected);
    if (normalizeFoodName(final) !== p.normalized_ai) {
      const key = `${p.normalized_ai}|${normalizeFoodName(final)}`;
      if (!out.has(key)) {
        out.set(key, {
          ai_detected: p.ai_detected, user_corrected: final,
          user_count: p.users.size, total_corrections: p.total_corrections,
        });
      } else {
        out.get(key).total_corrections += p.total_corrections;
      }
    }
  });
  return out;
}

function projectRecentMeals(rows) {
  return (rows || []).map((meal) => {
    try {
      const ad = typeof meal.AnalysisData === 'string' ? JSON.parse(meal.AnalysisData) : meal.AnalysisData;
      const foods = (ad?.detailedItems || []).map((i) => i.name).filter(Boolean);
      return { foods, created_at: meal.CreatedAt };
    } catch { return { foods: [], created_at: meal.CreatedAt }; }
  }).filter((m) => m.foods.length > 0);
}

export async function getContext({ userId }) {
  const startTime = Date.now();
  const [userCorrectionsResult, globalPatternsResult, userProfileResult, recentMealsResult] =
    await repo.getUserContextData(userId);

  const aiDetectionMap = groupCorrectionsByAi(globalPatternsResult.data || []);
  const globalPatternsMap = pickMostRecentPerCorrectionGroup(aiDetectionMap);
  const correctionChainMap = buildCorrectionChain(globalPatternsMap);
  const finalGlobalPatterns = resolveFinalPatterns(globalPatternsMap, correctionChainMap);

  const globalPatterns = Array.from(finalGlobalPatterns.values())
    .filter((p) => p.user_count >= 1)
    .sort((a, b) => (b.total_corrections - a.total_corrections) || (b.user_count - a.user_count))
    .slice(0, 100);

  const recentMeals = projectRecentMeals(recentMealsResult.data);

  return {
    httpStatus: 200,
    body: {
      success: true,
      data: {
        userId: parseInt(userId),
        personalCorrections: userCorrectionsResult.data || [],
        globalPatterns,
        dietPreference: userProfileResult.data?.DietType || null,
        recentMeals,
        metadata: {
          totalPersonalCorrections: (userCorrectionsResult.data || []).length,
          totalGlobalPatterns: globalPatterns.length,
          totalRecentMeals: recentMeals.length,
          queryTimeMs: Date.now() - startTime,
        },
      },
    },
  };
}
