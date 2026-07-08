/**
 * Mock daily scores for UI development — replace with API in Phase 2.
 */
import { WELLNESS_PARAMETERS, buildDefaultCoachConfig } from './parameterRegistry';

function hashSeed(str) {
  let h = 0;
  for (let i = 0; i < str.length; i += 1) h = (h * 31 + str.charCodeAt(i)) % 9973;
  return h;
}

function mockPct(key, dateStr) {
  const h = hashSeed(`${key}-${dateStr}`);
  return 40 + (h % 61);
}

function mockBinaryAchieved(key, dateStr) {
  return hashSeed(`${key}-bin-${dateStr}`) % 3 !== 0;
}

/**
 * @param {string} [dateStr] YYYY-MM-DD
 * @returns {{ date: string, parameters: object[], overallScore: number, totalEarned: number, totalPossible: number }}
 */
export function buildMockDailyScore(dateStr = new Date().toISOString().slice(0, 10)) {
  const config = buildDefaultCoachConfig().filter((c) => c.enabled && c.scoringType !== 'deferred');

  const parameters = WELLNESS_PARAMETERS.map((spec) => {
    const cfg = config.find((c) => c.key === spec.key) || {
      enabled: spec.defaultEnabled,
      maxMark: spec.defaultMaxMark,
      scoringType: spec.scoringType,
    };

    if (!cfg.enabled || spec.scoringType === 'deferred') {
      return {
        key: spec.key,
        label: spec.label,
        section: spec.section,
        scoringType: spec.scoringType,
        maxMark: cfg.maxMark,
        earnedMark: 0,
        pct: 0,
        enabled: cfg.enabled,
        detail: spec.scoringType === 'deferred' ? 'Coming soon' : 'Disabled',
      };
    }

    if (spec.scoringType === 'binary') {
      const achieved = mockBinaryAchieved(spec.key, dateStr);
      return {
        key: spec.key,
        label: spec.label,
        section: spec.section,
        scoringType: spec.scoringType,
        maxMark: cfg.maxMark,
        earnedMark: achieved ? cfg.maxMark : 0,
        pct: achieved ? 100 : 0,
        achieved,
        enabled: true,
        detail: achieved ? 'Completed on time' : 'Not logged yet',
      };
    }

    const pct = mockPct(spec.key, dateStr);
    const exceeded = spec.scoringType === 'limit' && pct > 100;
    const effectivePct = spec.scoringType === 'limit' ? Math.min(pct, 100) : Math.min(pct, 100);
    const earnedMark = exceeded
      ? 0
      : Math.round((effectivePct / 100) * cfg.maxMark);

    return {
      key: spec.key,
      label: spec.label,
      section: spec.section,
      scoringType: spec.scoringType,
      maxMark: cfg.maxMark,
      earnedMark,
      pct,
      exceeded: exceeded || false,
      enabled: true,
      detail: exceeded
        ? 'Over limit — 0 marks'
        : `${pct}% of target`,
    };
  });

  const active = parameters.filter((p) => p.enabled && p.scoringType !== 'deferred');
  const totalEarned = active.reduce((s, p) => s + p.earnedMark, 0);
  const totalPossible = active.reduce((s, p) => s + p.maxMark, 0);
  const overallScore = totalPossible > 0
    ? Math.round((totalEarned / totalPossible) * 100)
    : 0;

  return {
    date: dateStr,
    parameters,
    overallScore,
    totalEarned,
    totalPossible,
  };
}
