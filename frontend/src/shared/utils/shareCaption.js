/**
 * Pure WhatsApp / Quick Share caption helpers. No I/O.
 *
 * Branding line + activity suffix:
 *   "YASHEER · Wellness Valley v 3.4.0, Consumed: 1 L water so far today"
 * Food: kcal on the brand line, then each item on its own line with GI:
 *   "YASHEER J · Wellness Valley v 3.4.5, 1890 kcal\nMasala Dosa - GI 65 m"
 * Weight (other multi-line) sits under the brand with a blank line:
 *   "Balaji Sekar · Wellness Valley v 3.4.5\n\nIdeal: 73.7 kg\nPrev: 72.9 kg"
 * Transformation caption with DAY PROGRESS and LAP PROGRESS headings:
 *   "ALLAN · Wellness Valley v 3.5.2\n\nDAY PROGRESS\n\nIdeal: 79.57 kg\nPrev: 80 kg\nCurr: 80 kg\n\nLAP PROGRESS\n\nMarathon Day 5\nDay 0 : — → Curr: 80.00 kg"
 */

/** UTF-8 middle dot separator for share captions: "Name · Wellness Valley v X.Y.Z" */
export const SHARE_TEXT_SEPARATOR = '\u00B7';

/** First line of a food suffix: "1890 kcal" joins onto the brand line. */
const FOOD_KCAL_FIRST_LINE = /^\d[\d,]*\s*kcal$/i;

/** Weight details indicators */
const WEIGHT_INDICATOR_PATTERN = /\b(Ideal|Prev|Curr)\s*:/i;

/** Marathon start indicators */
const MARATHON_START_PATTERN = /(?:Tomorrow\s+is\s+)?Marathon\s+Day\s+\d+|Previous\s+Marathon\s+End\s+weight\s*:/i;

/** Build the standard Quick Share caption line. */
export function buildQuickShareText(displayName, versionString) {
  const name = (displayName || 'Wellness User').trim();
  const version = (versionString || '').trim();
  return `${name} ${SHARE_TEXT_SEPARATOR} Wellness Valley ${version}`.replace(/\uFFFD/g, '');
}

/**
 * Break a string into lines, converting literal '\n' into actual newlines,
 * and splitting space-separated transformation items when no newlines exist.
 *
 * @param {string} text
 * @returns {string[]}
 */
export function splitTransformationLines(text) {
  if (!text || typeof text !== 'string') return [];
  let s = text.replace(/\\n/g, '\n').trim();

  // Insert newlines before known item boundaries when preceded by whitespace
  s = s
    .replace(/\s+(?=Ideal\s*:)/gi, '\n')
    .replace(/\s+(?=Prev\s*:)/gi, '\n')
    .replace(/(?<![→\->]\s*)\s+(?=Curr\s*:)/gi, '\n')
    .replace(/(?<!Tomorrow\s+is)\s+(?=Tomorrow\s+is\s+Marathon\s+Day\s+\d+|Marathon\s+Day\s+\d+)/gi, '\n')
    .replace(/\s+(?=Day\s+\d+\s*:)/gi, '\n')
    .replace(/\s+(?=Previous\s+Marathon\s+End\s+weight\s*:)/gi, '\n')
    .replace(/\s+(?=Current\s+Weight\s*:)/gi, '\n');

  return s.split('\n').map((l) => l.trim()).filter(Boolean);
}

/**
 * Formats a transformation caption with DAY PROGRESS and LAP PROGRESS headings.
 * Handles full captions (brand + suffix) or standalone suffixes.
 * Preserves existing brand lines, non-transformation captions, food/education,
 * and avoids duplicate headings.
 *
 * @param {string} caption
 * @returns {string}
 */
export function formatTransformationCaption(caption) {
  if (!caption || typeof caption !== 'string') return '';
  const clean = caption.replace(/\\n/g, '\n').trim();

  // If already has both headings, return as is (do not duplicate)
  if (/\bDAY\s+PROGRESS\b/i.test(clean) && /\bLAP\s+PROGRESS\b/i.test(clean)) {
    return clean;
  }

  // Check if this caption qualifies as a transformation (has weight details AND marathon details)
  const hasWeight = WEIGHT_INDICATOR_PATTERN.test(clean);
  const hasMarathon = MARATHON_START_PATTERN.test(clean);
  if (!hasWeight || !hasMarathon) {
    return clean;
  }

  // Split lines
  const allLines = splitTransformationLines(clean);
  if (allLines.length === 0) return clean;

  // Determine if the first line is a brand line.
  // A brand line contains "Wellness Valley" or does not match any weight/marathon/heading prefix.
  let brand = '';
  let contentLines = allLines;

  const firstLine = allLines[0];
  const isWeightOrMarathon =
    WEIGHT_INDICATOR_PATTERN.test(firstLine) ||
    MARATHON_START_PATTERN.test(firstLine) ||
    /^(DAY|LAP)\s+PROGRESS$/i.test(firstLine);

  if (!isWeightOrMarathon) {
    brand = firstLine;
    contentLines = allLines.slice(1);
  }

  // Strip out any existing isolated heading lines so we don't duplicate
  const filteredLines = contentLines.filter((l) => !/^(DAY|LAP)\s+PROGRESS$/i.test(l));

  const marathonIndex = filteredLines.findIndex((l) => MARATHON_START_PATTERN.test(l));
  if (marathonIndex === -1) {
    return clean;
  }

  const dayProgressLines = filteredLines.slice(0, marathonIndex);
  const lapProgressLines = filteredLines.slice(marathonIndex);

  if (dayProgressLines.length === 0 || lapProgressLines.length === 0) {
    return clean;
  }

  const parts = [];
  if (brand) {
    parts.push(brand, '');
  }
  parts.push(
    'DAY PROGRESS',
    '',
    ...dayProgressLines,
    '',
    'LAP PROGRESS',
    '',
    ...lapProgressLines,
  );

  return parts.join('\n');
}

/**
 * Branding line + optional activity suffix.
 * One-line suffixes stay comma-joined.
 * Food suffixes put kcal on the brand line, then remaining lines under it.
 * Other multi-line suffixes (weight) sit under the brand with a blank line.
 * Transformation suffixes (weight + marathon) are formatted with DAY PROGRESS
 * and LAP PROGRESS headings.
 */
export function composeQuickShareCaption(brandLine, activitySuffix = null) {
  const brand = String(brandLine || '').trim();
  const suffix = typeof activitySuffix === 'string' ? activitySuffix.trim() : '';

  if (!brand) return formatTransformationCaption(suffix);
  if (!suffix) return brand;
  if (suffix.includes('\n')) {
    return `${brand}\n\n${suffix}`;
  }
  // Single-line WhatsApp-formatted items (`*bold*`) sit on a new line under the brand
  if (suffix.startsWith('*')) {
    return `${brand}\n${suffix}`;
  }
  return `${brand}, ${suffix}`;
}
