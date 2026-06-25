// Match a normalized AI-detected name against the corrections map.
// Returns { correction, matchType } or null.

export function findCorrectionMatch(correctionMap, normalizedOriginal) {
  // Exact lookup — backend already prioritises user > global.
  if (correctionMap.has(normalizedOriginal)) {
    return { correction: correctionMap.get(normalizedOriginal), matchType: 'exact' };
  }

  // Fuzzy: longest correction key that contains the normalized AI token wins.
  if (normalizedOriginal.length < 3) return null;
  let bestMatch = null;
  let bestLen = 0;
  for (const [key, value] of correctionMap.entries()) {
    if (key.includes(normalizedOriginal) && key.length > bestLen) {
      bestMatch = { correction: value, matchType: 'fuzzy-contained-in', key };
      bestLen = key.length;
    }
  }
  return bestMatch;
}
