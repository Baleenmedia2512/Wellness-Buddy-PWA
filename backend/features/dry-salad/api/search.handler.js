/**
 * backend/features/dry-salad/api/search.handler.js
 */
import { isEnabled } from '../../../shared/lib/feature-flags.js';
import {
  profileToSearchItem,
  sortByFoodNameMatch,
} from '../../nutrition-knowledge/domain/nutrition.rules.js';
import * as repo from '../data/dry-salad.repo.js';
import { listSeedProfiles, searchSeedProfiles } from '../domain/seeds.js';

function toSearchItem(row) {
  return {
    ...profileToSearchItem(row),
    source: 'dry-salad',
  };
}

function unionRows(dbRows, seedRows) {
  const have = new Set(dbRows.map((r) => r.normalized_name));
  const out = dbRows.slice();
  for (const seed of seedRows) {
    if (!have.has(seed.normalized_name)) out.push(seed);
  }
  return out;
}

/**
 * Search the Dry Salad catalog only (not general food history).
 * @param {{ searchTerm: string }} input
 */
export async function searchDrySalad({ searchTerm }) {
  if (!isEnabled('ff.dry-salad-catalog')) {
    return {
      httpStatus: 200,
      body: { success: true, masterItems: [], myItems: [], communityItems: [] },
    };
  }

  const term = String(searchTerm || '').trim();
  let rows = term
    ? await repo.searchItems(term, { status: 'approved', limit: 20 })
    : await repo.listApproved({ status: 'approved', limit: 50 });

  const seedHits = term ? searchSeedProfiles(term) : listSeedProfiles();
  if (rows === null) {
    rows = seedHits;
  } else {
    rows = unionRows(rows, seedHits);
  }

  const items = sortByFoodNameMatch(rows.map(toSearchItem), term || 'herbalife');
  return {
    httpStatus: 200,
    body: {
      success: true,
      masterItems: items,
      myItems: [],
      communityItems: [],
    },
  };
}
