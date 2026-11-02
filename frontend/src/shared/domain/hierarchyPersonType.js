/**
 * Hierarchy person-type labels (not profile Role).
 * Has any CoachId downline → Sponsor; no team members → Customer.
 * API / storage tokens stay `sponsor` | `member` for mobile compatibility.
 */

export const HIERARCHY_PERSON_TYPE = Object.freeze({
  CUSTOMER: 'member',
  SPONSOR: 'sponsor',
});

export const HIERARCHY_PERSON_TYPE_COLUMN_LABEL = 'Type';

/**
 * @param {unknown} memberType API value (`member` | `sponsor`)
 * @returns {'Customer'|'Sponsor'}
 */
export function formatHierarchyPersonType(memberType) {
  return String(memberType || '').toLowerCase() === HIERARCHY_PERSON_TYPE.SPONSOR
    ? 'Sponsor'
    : 'Customer';
}
