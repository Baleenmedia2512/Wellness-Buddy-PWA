/**
 * Layout math for the 9:16 transformation share card.
 * html2canvas cannot use flex/grid, so the card sizes rows from these numbers.
 */

export const CARD_W = 540;
export const CARD_H = 960;
export const MAX_VISIBLE_ISSUES = 10;

const HEADER_H = 62;
/** Name block: pad 13+11 + 28px line — must not under-budget or disclaimer clips. */
const NAME_H = 52;
/** BEFORE/AFTER label + weight kg line under each photo (must not clip). */
const PHOTO_META_H = 56;
const RESULT_PILL_H = 44;
/** Keep health-issues compact so photos stay close to the no-issues card size. */
const ISSUES_OUTER_PAD = 8;
const ISSUES_BOX_PAD = 10;
/** Title + “while joining the community” + gap before chips. */
const ISSUES_TITLE_H = 42;
/** Chip row height for 14px issue labels (may wrap once on long names). */
const CHIP_ROW_H = 64;
const EMPTY_BOTTOM = 4;
/**
 * Red DISCLAIMER SVG footer under the result pill / health issues.
 * Must match TransformationShareCard: marginTop + pad + SVG (420×88) + padBottom.
 */
export const DISCLAIMER_H = 110;
/** Soft floor — photos may shrink below this when issues + disclaimer need the space. */
const PHOTO_MIN = 400;
/** Never crush photos below this; prefer clipping issues over a tiny photo strip. */
const PHOTO_HARD_MIN = 320;
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
    + issuesH
    + DISCLAIMER_H;
  const raw = CARD_H - used;
  // Prefer PHOTO_MIN when there is room; never grow past raw or the disclaimer clips.
  if (raw < PHOTO_MIN) {
    return Math.min(PHOTO_MAX, Math.max(PHOTO_HARD_MIN, raw));
  }
  return Math.min(PHOTO_MAX, raw);
}
