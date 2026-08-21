/**
 * backend/features/dry-salad/api/search.handler.js
 */
import {
  profileToSearchItem,
  sortByFoodNameMatch,
} from '../../nutrition-knowledge/domain/nutrition.rules.js';
import * as repo from '../data/dry-salad.repo.js';

function toSearchItem(row) {
  return {
    ...profileToSearchItem(row),
    source: 'dry-salad',
  };
}

/**
 * Search the Dry Salad catalog only (not general food history).
 * @param {{ searchTerm: string }} input
 */
export async function searchDrySalad({ searchTerm }) {
  const term = String(searchTerm || '').trim();
  const rows = term
    ? await repo.searchItems(term, { status: 'approved', limit: 20 })
    : await repo.listApproved({ status: 'approved', limit: 50 });
  const items = Array.isArray(rows)
    ? sortByFoodNameMatch(rows.map(toSearchItem), term || 'herbalife')
    : [];
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
