/**
 * Backfill team_table.IdealWeightReachedAt from weight history (BMI 19–23).
 * Suppresses coach email by also setting IdealWeightReachedNotifiedAt.
 *
 * Dry-run by default. From backend/:
 *   node --env-file=.env scripts/backfill-ideal-weight-reached.js
 *   node --env-file=.env scripts/backfill-ideal-weight-reached.js --write --limit=200
 */
import {
  listUsersPendingIdealReachedBackfill,
  listActiveWeightsAsc,
  backfillIdealWeightReachedAt,
} from '../features/weight/data/ideal-weight-milestone.repo.js';
import { findFirstIdealReachedEntry } from '../features/weight/domain/ideal-weight-milestone.rules.js';
import { normalizeStoredTimestampToUtcIso } from '../shared/lib/datetime/index.js';
import logger from '../shared/lib/logger.js';

function parseArgs(argv) {
  const out = { write: false, limit: Infinity, batch: 50 };
  for (const arg of argv) {
    if (arg === '--write') out.write = true;
    else if (arg.startsWith('--limit=')) out.limit = Math.max(0, parseInt(arg.slice(8), 10) || 0);
    else if (arg.startsWith('--batch=')) out.batch = Math.min(200, Math.max(1, parseInt(arg.slice(8), 10) || 50));
  }
  return out;
}

function toIso(createdAt) {
  try {
    return normalizeStoredTimestampToUtcIso(createdAt);
  } catch {
    const d = new Date(createdAt);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
}

async function main() {
  const { write, limit, batch } = parseArgs(process.argv.slice(2));
  logger.info('[backfill-ideal-weight-reached] start', { write, limit, batch });

  let offset = 0;
  let scanned = 0;
  let wouldWrite = 0;
  let written = 0;
  let skipped = 0;

  while (scanned < limit) {
    const pageSize = Math.min(batch, limit - scanned);
    if (pageSize <= 0) break;

    const users = await listUsersPendingIdealReachedBackfill({ limit: pageSize, offset });
    if (!users.length) break;

    for (const user of users) {
      scanned += 1;
      const userId = user.UserId;
      const heightCm = user.Height;
      try {
        const history = await listActiveWeightsAsc(userId);
        const first = findFirstIdealReachedEntry(history, heightCm);
        if (!first) {
          skipped += 1;
          continue;
        }
        const iso = toIso(first.createdAt);
        if (!iso) {
          skipped += 1;
          continue;
        }
        wouldWrite += 1;
        if (write) {
          const ok = await backfillIdealWeightReachedAt(userId, iso, { suppressNotify: true });
          if (ok) written += 1;
        } else {
          logger.info('[backfill-ideal-weight-reached] dry-run candidate', {
            userId,
            reachedAt: iso,
            weight: first.weight,
          });
        }
      } catch (err) {
        logger.warn('[backfill-ideal-weight-reached] user failed', {
          userId,
          error: err?.message || String(err),
        });
      }
    }

    if (users.length < pageSize) break;
    offset += users.length;
  }

  logger.info('[backfill-ideal-weight-reached] done', {
    write,
    scanned,
    wouldWrite,
    written,
    skippedNoReach: skipped,
  });
}

main().catch((err) => {
  logger.error('[backfill-ideal-weight-reached] fatal', { error: err?.message || String(err) });
  process.exitCode = 1;
});
