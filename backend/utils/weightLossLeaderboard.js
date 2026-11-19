/**
 * Weight Loss Leaderboard — window ranking helpers.
 * Today vs Yesterday stays the default; days=10 uses a net loss over the window.
 */

/** Preset length for home "Last 10 Days". */
export const WEIGHT_LEADERBOARD_WINDOW_DAYS = 10;

/** Inclusive custom-range / API window cap (IST). */
export const WEIGHT_LEADERBOARD_MAX_WINDOW_DAYS = 30;

/**
 * Resolve `days` for weight leaderboard.
 * Missing / invalid / 1 → Today vs Yesterday (legacy).
 * 2..30 → multi-day IST window. 31+ → legacy today (do not expand).
 * Released apps only omit `days` or send `days=10` — both stay unchanged.
 *
 * @param {unknown} rawDays
 * @returns {number}
 */
export function resolveWeightLeaderboardWindowDays(rawDays) {
  const n = parseInt(rawDays, 10);
  if (!Number.isFinite(n) || n < 2) return 1;
  if (n > WEIGHT_LEADERBOARD_MAX_WINDOW_DAYS) return 1;
  return n;
}

/** Plausibility cap for the Today vs Yesterday strip (OCR / bad reads). */
export const MAX_TODAY_VS_YESTERDAY_LOSS_KG = 3;

/**
 * Cap for last-10-day net loss (aligns with >7d weight plausibility ≤ 10 kg).
 * @see backend/utils/weightValidation.js / CLAUDE.md §4.5
 */
export const MAX_TEN_DAY_LOSS_KG = 10;

/**
 * Pick earliest + latest weight per user from a newest-first range fetch.
 * Loss = startWeight − endWeight; requires different IST calendar days.
 *
 * @param {Array<{ UserId: number, Weight: number|string, CreatedAt: string }>} records
 * @param {(ts: string) => string|null} toYmd
 * @param {number} maxLossKg
 * @returns {Array<{
 *   userId: number,
 *   weightLoss: number,
 *   startWeight: number,
 *   endWeight: number,
 *   startDate: string,
 *   endDate: string,
 * }>}
 */
export function buildWindowWeightLossCandidates(records, toYmd, maxLossKg) {
  const byUser = new Map();

  for (const record of records || []) {
    const userId = Number(record.UserId);
    if (!Number.isFinite(userId) || userId <= 0) continue;
    const dayYmd = toYmd(record.CreatedAt);
    if (!dayYmd) continue;
    const weight = parseFloat(record.Weight);
    if (!Number.isFinite(weight)) continue;

    const createdAt = String(record.CreatedAt || '');
    let entry = byUser.get(userId);
    if (!entry) {
      entry = {
        userId,
        latest: { weight, createdAt, dayYmd },
        earliest: { weight, createdAt, dayYmd },
      };
      byUser.set(userId, entry);
      continue;
    }

    // Newest-first fetch: first row wins as latest; keep scanning for oldest.
    if (createdAt > entry.latest.createdAt) {
      entry.latest = { weight, createdAt, dayYmd };
    }
    if (createdAt < entry.earliest.createdAt) {
      entry.earliest = { weight, createdAt, dayYmd };
    }
  }

  const candidates = [];
  for (const entry of byUser.values()) {
    if (entry.earliest.dayYmd === entry.latest.dayYmd) continue;
    const weightLoss = entry.earliest.weight - entry.latest.weight;
    if (!(weightLoss > 0 && weightLoss <= maxLossKg)) continue;
    candidates.push({
      userId: entry.userId,
      weightLoss: parseFloat(weightLoss.toFixed(2)),
      startWeight: parseFloat(entry.earliest.weight.toFixed(2)),
      endWeight: parseFloat(entry.latest.weight.toFixed(2)),
      startDate: entry.earliest.createdAt,
      endDate: entry.latest.createdAt,
    });
  }
  return candidates;
}
