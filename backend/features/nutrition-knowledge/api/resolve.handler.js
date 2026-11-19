/**
 * backend/features/nutrition-knowledge/api/resolve.handler.js
 */
import { isEnabled } from '../../../shared/lib/feature-flags.js';
import * as repo from '../data/nutrition-knowledge.repo.js';
import {
  findSeedProfile,
  searchSeedProfiles,
} from '../domain/seeds.js';
import {
  profileToSearchItem,
  pickNutrition,
  shouldAutoPromote,
  AUTO_PROMOTE_SIGHTINGS,
  sortByFoodNameMatch,
  buildCustomFoodPortionLabel,
} from '../domain/nutrition.rules.js';
import { buildCustomFoodExportCsv } from '../domain/customFoodExport.rules.js';
import { assertNutritionKnowledgeAdmin } from '../domain/permissions/nutritionAdmin.policy.js';
import { getMysqlClient } from '../../../utils/mysqlClient.js';

async function loadApprovedProfile(name) {
  const dbRow = await repo.findProfileByName(name, { status: 'approved' });
  // null = DB error / missing table → use seeds. undefined = not found in DB.
  if (dbRow === null) return findSeedProfile(name);
  if (dbRow) return dbRow;
  return findSeedProfile(name);
}

/**
 * Resolve full nutrition: master → (caller merges history separately).
 */
export async function resolveProfile({ name, weightG }) {
  if (!isEnabled('ff.nutrition-knowledge')) {
    return {
      httpStatus: 200,
      body: { ok: true, data: { found: false, source: null, item: null } },
    };
  }

  const profile = await loadApprovedProfile(name);
  if (!profile) {
    return {
      httpStatus: 200,
      body: { ok: true, data: { found: false, source: null, item: null } },
    };
  }

  const item = profileToSearchItem(profile, weightG);
  return {
    httpStatus: 200,
    body: {
      ok: true,
      data: {
        found: true,
        source: 'master',
        item,
      },
    },
  };
}

/**
 * Search approved master (+ seed fallback).
 */
export async function searchMaster({ searchTerm }) {
  if (!isEnabled('ff.nutrition-knowledge')) {
    return { httpStatus: 200, body: { ok: true, data: { items: [] } } };
  }

  let rows = await repo.searchProfiles(searchTerm, { status: 'approved', limit: 20 });
  if (rows === null) {
    rows = searchSeedProfiles(searchTerm);
  } else {
    // Always union in-code seeds so common foods (and typo aliases) appear
    // even when the master table has unrelated prefix hits.
    const seedHits = searchSeedProfiles(searchTerm);
    const have = new Set(rows.map((r) => r.normalized_name));
    for (const s of seedHits) {
      if (!have.has(s.normalized_name)) rows.push(s);
    }
  }

  const items = sortByFoodNameMatch(
    rows.map((row) => profileToSearchItem(row)),
    searchTerm,
  );
  return {
    httpStatus: 200,
    body: { ok: true, data: { items } },
  };
}

/**
 * Public helper for food-corrections search merge (no HTTP envelope).
 * @param {string} searchTerm
 * @returns {Promise<object[]>}
 */
export async function listMasterSearchItems(searchTerm) {
  if (!isEnabled('ff.nutrition-knowledge')) return [];
  const result = await searchMaster({ searchTerm });
  return result.body?.data?.items || [];
}

/**
 * After a successful AI food analysis — upsert draft candidates per food item.
 * @param {{ foods?: Array<{ name?: string, weight_g?: number, isLiquid?: boolean, portion?: string, nutrition?: object }>, total?: object }} analysis
 */
export async function recordAiFoodCandidate(analysis) {
  if (!isEnabled('ff.nutrition-knowledge')) {
    return { recorded: 0 };
  }
  const foods = Array.isArray(analysis?.foods) ? analysis.foods : [];
  let recorded = 0;
  for (const food of foods) {
    const name = String(food?.name || '').trim();
    if (!name) continue;
    const nutrition = pickNutrition(food.nutrition || food);
    if (Object.keys(nutrition).length === 0) continue;

    const row = await repo.upsertAiCandidate({
      canonicalName: name,
      nutrition,
      referenceWeightG: food.weight_g > 0 ? Number(food.weight_g) : 100,
      isLiquid: Boolean(food.isLiquid),
      portionLabel: food.portion || null,
    });
    if (!row) continue;
    recorded += 1;

    if (shouldAutoPromote(row, AUTO_PROMOTE_SIGHTINGS) && row.id) {
      await repo.approveProfile(row.id, { reviewedByUserId: null }).catch(() => null);
    }
  }
  return { recorded };
}

export async function approveMasterProfile({ profileId, reviewedByUserId }) {
  if (!isEnabled('ff.nutrition-knowledge')) {
    return {
      httpStatus: 404,
      body: { ok: false, error: { code: 'FLAG_OFF', message: 'Nutrition knowledge is disabled' } },
    };
  }
  const row = await repo.approveProfile(profileId, { reviewedByUserId });
  if (!row) {
    return {
      httpStatus: 404,
      body: { ok: false, error: { code: 'NOT_FOUND', message: 'Profile not found' } },
    };
  }
  return { httpStatus: 200, body: { ok: true, data: { profile: row } } };
}

async function loadTeamRole(userId) {
  const db = getMysqlClient();
  const { data, error } = await db
    .from('team_table')
    .select('"Role"')
    .eq('UserId', userId)
    .limit(1);
  if (error) {
    throw error;
  }
  return data?.[0] || null;
}

/**
 * Create (or return existing) a custom master food: name + g/ml + serving size.
 * Nutrition macros are not required. Always logs a submission row for Excel export.
 * @param {{ name: string, unit: 'g'|'ml', servingSize: number, userId?: number|null }} input
 */
export async function createCustomFood({ name, unit, servingSize, userId = null }) {
  if (!isEnabled('ff.nutrition-knowledge')) {
    return {
      httpStatus: 404,
      body: { ok: false, error: { code: 'FLAG_OFF', message: 'Nutrition knowledge is disabled' } },
    };
  }

  const result = await repo.upsertUserCustomFood({
    canonicalName: name,
    unit,
    servingSize,
    createdByUserId: userId,
  });

  if (!result?.row) {
    return {
      httpStatus: 500,
      body: {
        ok: false,
        error: {
          code: 'SAVE_FAILED',
          message: result?.error || 'Could not save custom food',
        },
      },
    };
  }

  if (userId) {
    await repo.insertCustomFoodSubmission({
      userId,
      foodName: result.row.canonical_name || name,
      unit,
      quantity: servingSize,
      profileId: result.row.id ?? null,
    });
  }

  // Scale master nutrition (once filled) to this user's quantity.
  const item = profileToSearchItem(result.row, servingSize);
  const portion = buildCustomFoodPortionLabel(servingSize, unit);
  return {
    httpStatus: result.created ? 201 : 200,
    body: {
      ok: true,
      data: {
        created: result.created,
        item: {
          ...item,
          name: result.row.canonical_name || name,
          unit,
          is_liquid: unit === 'ml',
          isLiquid: unit === 'ml',
          weight_g: Math.round(servingSize),
          volume_ml: unit === 'ml' ? Math.round(servingSize) : null,
          portion,
          calories: item.calories ?? 0,
          nutrition: item.nutrition || {},
        },
        profileId: result.row.id ?? null,
      },
    },
  };
}

/**
 * CSV download for developers — same columns as Excel template.
 * @param {{ userId: number, pendingOnly?: boolean, limit?: number }} input
 */
export async function exportCustomFoodSubmissions({ userId, pendingOnly = true, limit = 5000 }) {
  if (!isEnabled('ff.nutrition-knowledge')) {
    return {
      httpStatus: 404,
      body: { ok: false, error: { code: 'FLAG_OFF', message: 'Nutrition knowledge is disabled' } },
    };
  }

  const requester = await loadTeamRole(userId);
  assertNutritionKnowledgeAdmin(requester);

  const rows = await repo.listCustomFoodSubmissionsForExport({
    limit,
    pendingNutritionOnly: pendingOnly,
  });
  if (rows === null) {
    return {
      httpStatus: 500,
      body: { ok: false, error: { code: 'EXPORT_FAILED', message: 'Could not load custom food submissions' } },
    };
  }

  const csv = buildCustomFoodExportCsv(rows);
  const stamp = new Date().toISOString().slice(0, 10);
  return {
    httpStatus: 200,
    body: csv,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="custom-food-submissions-${stamp}.csv"`,
      'Cache-Control': 'no-store',
    },
  };
}

/**
 * Developer fills nutrition for a master custom food (shared for all users).
 * Values apply to referenceQuantity (default: profile reference_weight_g).
 * Later adds at other quantities are scaled automatically.
 */
export async function setCustomFoodNutrition({
  userId,
  profileId,
  nutrition,
  referenceWeightG = null,
}) {
  if (!isEnabled('ff.nutrition-knowledge')) {
    return {
      httpStatus: 404,
      body: { ok: false, error: { code: 'FLAG_OFF', message: 'Nutrition knowledge is disabled' } },
    };
  }

  const requester = await loadTeamRole(userId);
  assertNutritionKnowledgeAdmin(requester);

  const profile = await repo.updateProfileNutrition({
    profileId,
    nutrition: pickNutrition(nutrition),
    referenceWeightG,
    reviewedByUserId: userId,
  });

  if (!profile) {
    return {
      httpStatus: 404,
      body: { ok: false, error: { code: 'NOT_FOUND', message: 'Profile not found' } },
    };
  }

  return {
    httpStatus: 200,
    body: {
      ok: true,
      data: {
        profile,
        item: profileToSearchItem(profile),
      },
    },
  };
}
