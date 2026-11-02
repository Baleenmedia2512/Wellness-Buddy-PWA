/**
 * Parse a voice transcript into multiple food names.
 * Splits on commas, " and ", newlines; drops filler words.
 */

const NOISE = new Set([
  'um',
  'uh',
  'ah',
  'er',
  'like',
  'please',
  'add',
  'also',
  'then',
  'and',
  'with',
  'some',
  'a',
  'an',
  'the',
  'of',
  'to',
  'my',
  'meal',
  'food',
  'items',
  'item',
]);

const MAX_NAMES = 8;

/**
 * @param {string} transcript
 * @param {{ max?: number }} [opts]
 * @returns {string[]}
 */
export function parseVoiceFoodNames(transcript, opts = {}) {
  const max = Number.isFinite(opts.max) ? opts.max : MAX_NAMES;
  const raw = String(transcript || '').trim();
  if (!raw) return [];

  const chunks = raw
    .split(/,|\band\b|\n+/i)
    .map((part) =>
      part
        .replace(/[.!?;:]+$/g, '')
        .replace(/^[\s.!?;:]+/g, '')
        .trim(),
    )
    .filter(Boolean);

  const names = [];
  const seen = new Set();

  for (const chunk of chunks) {
    const cleaned = chunk
      .split(/\s+/)
      .filter((w) => !NOISE.has(w.toLowerCase().replace(/[^a-z']/gi, '')))
      .join(' ')
      .trim();
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(cleaned);
    if (names.length >= max) break;
  }

  return names;
}

export default parseVoiceFoodNames;
