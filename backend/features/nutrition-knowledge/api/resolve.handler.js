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
} from '../domain/nutrition.rules.js';

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
