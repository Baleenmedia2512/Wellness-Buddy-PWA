/**
 * Diary list must be requested as the account's team_table UserId.
 * A stale session id (no team row) is rejected with 403 for every other diary.
 *
 * @param {string|number|null|undefined} sessionViewerId
 * @param {{ success?: boolean, userId?: string|number|null }|null|undefined} lookup
 * @returns {string}
 */
export function diaryViewerIdAfterAccountLookup(sessionViewerId, lookup) {
  const accountId = lookup?.success ? lookup.userId : null;
  if (accountId != null && String(accountId).trim() !== '') {
    return String(accountId);
  }
  return sessionViewerId == null ? '' : String(sessionViewerId);
}
