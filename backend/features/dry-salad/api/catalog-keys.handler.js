/**
 * Approved dry-salad catalog name keys for other features to exclude.
 */
import * as repo from '../data/dry-salad.repo.js';
import { buildCatalogIndex } from '../domain/comboSuggestions.rules.js';

/**
 * @returns {Promise<string[]>}
 */
export async function listApprovedCatalogNameKeys() {
  const rows = await repo.listApproved({ status: 'approved', limit: 200 });
  return [...buildCatalogIndex(rows || []).keys];
}
