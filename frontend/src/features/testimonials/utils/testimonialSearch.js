/**
 * Team transformation search helpers.
 */
import {
  searchMedicalConditions,
  VISIBLE_SUGGESTION_CAP,
} from '../domain/medicalConditionSearch.js';
import { ALL_MEDICAL_CONDITIONS } from '../data/medicalConditions.js';

/** Normalize a search query: trim whitespace and lowercase. */
export function normalizeSearchQuery(query) {
  return (query || '').trim().toLowerCase();
}

function rowHealthIssues(row) {
  const fromTestimonial = row?.testimonial?.recoveredHealthIssues;
  const fromRow = row?.recoveredHealthIssues;
  const issues = Array.isArray(fromTestimonial) ? fromTestimonial : fromRow;
  return Array.isArray(issues) ? issues : [];
}

/** Case-insensitive partial match against the member's display name only. */
export function rowMatchesSearch(row, query) {
  const normalized = normalizeSearchQuery(query);
  if (!normalized) return true;
  const userName = String(row?.user?.userName || '').toLowerCase();
  return userName.includes(normalized);
}

/** Case-insensitive partial match against recovered health issues. */
export function rowMatchesHealthIssue(row, query) {
  const normalized = normalizeSearchQuery(query);
  if (!normalized) return true;
  return rowHealthIssues(row).some((issue) => String(issue || '').toLowerCase().includes(normalized));
}

/** Filter rows by member name (empty query returns all rows). */
export function filterRowsBySearch(rows, query) {
  const normalized = normalizeSearchQuery(query);
  if (!normalized) return rows;
  return rows.filter((row) => rowMatchesSearch(row, normalized));
}

/** Build member-name auto-suggestions. */
export function buildSearchSuggestions(rows, query, limit = 8) {
  const normalized = normalizeSearchQuery(query);
  if (!normalized) return [];
  return filterRowsBySearch(rows, normalized).slice(0, limit);
}

/** Health-issue labels matching the query (catalog + issues already used on the team). */
export function buildHealthIssueSuggestions(query, extraIssues = [], limit = VISIBLE_SUGGESTION_CAP) {
  const normalized = normalizeSearchQuery(query);
  if (!normalized) return [];
  const catalog = [...new Set([...ALL_MEDICAL_CONDITIONS, ...extraIssues.filter(Boolean)])];
  return searchMedicalConditions(query, { conditions: catalog }).slice(0, limit);
}
