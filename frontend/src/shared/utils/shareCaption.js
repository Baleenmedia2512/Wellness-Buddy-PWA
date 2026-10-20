/**
 * Pure WhatsApp / Quick Share caption helpers. No I/O.
 *
 * Branding line + activity suffix:
 *   "YASHEER · Wellness Valley v 3.4.0, Consumed: 1 L water so far today"
 * Food: kcal on the brand line, then each item on its own line with GI:
 *   "YASHEER J · Wellness Valley v 3.4.5, 1890 kcal\nMasala Dosa - GI 65 m"
 * Weight (other multi-line) sits under the brand with a blank line:
 *   "Balaji Sekar · Wellness Valley v 3.4.5\n\nIdeal: 73.7 kg\nPrev: 72.9 kg"
 */

/** UTF-8 middle dot separator for share captions: "Name · Wellness Valley v X.Y.Z" */
export const SHARE_TEXT_SEPARATOR = '\u00B7';

/** First line of a food suffix: "1890 kcal" joins onto the brand line. */
const FOOD_KCAL_FIRST_LINE = /^\d[\d,]*\s*kcal$/i;

/** Build the standard Quick Share caption line. */
export function buildQuickShareText(displayName, versionString) {
  const name = (displayName || 'Wellness User').trim();
  const version = (versionString || '').trim();
  return `${name} ${SHARE_TEXT_SEPARATOR} Wellness Valley ${version}`.replace(/\uFFFD/g, '');
}

/**
 * Branding line + optional activity suffix.
 * One-line suffixes stay comma-joined.
 * Food suffixes put kcal on the brand line, then remaining lines under it.
 * Other multi-line suffixes (weight) sit under the brand with a blank line.
 */


export function composeQuickShareCaption(brandLine, activitySuffix = null) {
  const brand = String(brandLine || '').trim();
  const suffix = typeof activitySuffix === 'string'
    ? activitySuffix.trim()
    : '';

  if (!brand) return suffix;
  if (!suffix) return brand;

  // Keep bold WhatsApp captions unchanged.
  if (suffix.startsWith('*')) {
    return `${brand}\n${suffix}`;
  }

  // Keep food captions unchanged.
  if (suffix.includes('\n')) {
    const [first, ...rest] = suffix.split('\n');

    if (FOOD_KCAL_FIRST_LINE.test(first.trim()) && rest.length > 0) {
      return `${brand}, ${first.trim()}\n${rest.join('\n')}`;
    }
  }

  // Apply headings to transformation captions.
  const hasIdeal = /\bIdeal\s*:/i.test(suffix);
  const hasCurrentWeight = /\bCurr\s*:/i.test(suffix);
  const hasMarathon = /\bMarathon\s+Day\s+\d+/i.test(suffix);

  if (hasIdeal && hasCurrentWeight && hasMarathon) {
    const marathonIndex = suffix.search(/\bMarathon\s+Day\s+\d+/i);

    const dayProgress = suffix.slice(0, marathonIndex).trim();
    const lapProgress = suffix.slice(marathonIndex).trim();

    return [
      brand,
      '',
      'DAY PROGRESS',
      '',
      dayProgress,
      '',
      'LAP PROGRESS',
      '',
      lapProgress,
    ].join('\n');
  }

  // Preserve the original behavior for all other captions.
  if (suffix.includes('\n')) {
    return `${brand}\n\n${suffix}`;
  }

  return `${brand}, ${suffix}`;
}

