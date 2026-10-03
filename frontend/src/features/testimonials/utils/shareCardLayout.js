/**
 * Layout math for the 9:16 transformation share card.
 * html2canvas cannot use flex/grid, so the card sizes rows from these numbers.
 */

export const CARD_W = 540;
export const CARD_H = 960;
export const MAX_VISIBLE_ISSUES = 10;

const HEADER_H = 62;
const NAME_H = 52;
const PHOTO_META_H = 44;
const RESULT_PILL_H = 48;
const ISSUES_OUTER_PAD = 26;
const ISSUES_BOX_PAD = 22;
const ISSUES_TITLE_H = 52;
const CHIP_ROW_H = 81;
const EMPTY_BOTTOM = 16;
const PHOTO_MIN = 340;
const PHOTO_MAX = 690;

/**
 * Never more than 4 columns — 5 cramped labels overlap on the share bitmap.
 * 1–3 issues use that many columns so a single chip stays centered-ish.
 */
export function issueColumnsForCount(count) {
  const n = Math.min(MAX_VISIBLE_ISSUES, Math.max(0, Number(count) || 0));
  if (n <= 0) return 0;
  if (n <= 3) return n;
  if (n <= 6) return 3;
  return 4;
}

export function issueRowCount(count) {
  const n = Math.min(MAX_VISIBLE_ISSUES, Math.max(0, Number(count) || 0));
  const cols = issueColumnsForCount(n);
  return cols === 0 ? 0 : Math.ceil(n / cols);
}

export function chunkIssues(list, size) {
  const rows = [];
  const step = Math.max(1, Number(size) || 1);
  const items = Array.isArray(list) ? list : [];
  for (let i = 0; i < items.length; i += step) {
    rows.push(items.slice(i, i + step));
  }
  return rows;
}

/**
 * Spend leftover 9:16 height on photos so the health-issues block
 * is not crushed while a blank strip sits under it.
 */
export function shareCardPhotoHeight({ issueCount = 0, hasResultPill = false } = {}) {
  const rows = issueRowCount(issueCount);
  const issuesH = rows === 0
    ? EMPTY_BOTTOM
    : ISSUES_OUTER_PAD + ISSUES_BOX_PAD + ISSUES_TITLE_H + rows * CHIP_ROW_H;
  const used = HEADER_H
    + NAME_H
    + PHOTO_META_H
    + (hasResultPill ? RESULT_PILL_H : 0)
    + issuesH;
  const raw = CARD_H - used;
  return Math.max(PHOTO_MIN, Math.min(PHOTO_MAX, raw));
}
