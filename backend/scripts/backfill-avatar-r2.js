/**
 * Backfill team_table.ProfileImage data URIs into Cloudflare R2 (ADR-0009).
 *
 * Compresses to ≤22 KB / 256 px JPEG before PUT. Dry-run by default.
 * Does not delete ProfileImage.
 *
 * From backend/:
 *   node --env-file=.env scripts/backfill-avatar-r2.js
 *   node --env-file=.env scripts/backfill-avatar-r2.js --write --limit=200
 *   node --env-file=.env scripts/backfill-avatar-r2.js --recompress
 *   node --env-file=.env scripts/backfill-avatar-r2.js --recompress --write
 *   node --env-file=.env scripts/backfill-avatar-r2.js --cleanup
 *   node --env-file=.env scripts/backfill-avatar-r2.js --cleanup --write
 */
import { persistAvatarKey, r2AvatarsEnabled, cleanupOrphanAvatars } from '../features/user/avatar-storage.service.js';
import {
  listPendingAvatarBackfill,
  listAvatarsForRecompress,
} from '../features/user/user.repository.js';
import { shouldStoreProfileImageInR2 } from '../shared/lib/images/dataUri.js';
import logger from '../shared/lib/logger.js';

function parseArgs(argv) {
  const out = { write: false, recompress: false, cleanup: false, limit: Infinity, batch: 50 };
  for (const arg of argv) {
    if (arg === '--write') out.write = true;
    else if (arg === '--recompress') out.recompress = true;
    else if (arg === '--cleanup') out.cleanup = true;
    else if (arg.startsWith('--limit=')) out.limit = Math.max(0, parseInt(arg.slice(8), 10) || 0);
    else if (arg.startsWith('--batch=')) out.batch = Math.min(100, Math.max(1, parseInt(arg.slice(8), 10) || 50));
  }
  return out;
}

async function main() {
  const { write, recompress, cleanup, limit, batch } = parseArgs(process.argv.slice(2));
  if (!r2AvatarsEnabled()) {
    logger.error('[backfill-avatar-r2] R2 is not configured or ff.r2-avatars is OFF');
    process.exitCode = 1;
    return;
  }

  if (cleanup) {
    logger.info('[backfill-avatar-r2] cleanup start', { write });
    const result = await cleanupOrphanAvatars({ write });
    if (result.aborted) {
      process.exitCode = 1;
      return;
    }
    for (const key of result.orphans) {
      logger.info('[backfill-avatar-r2] orphan', { key, write });
    }
    logger.info('[backfill-avatar-r2] cleanup done', {
      write,
      live: result.live,
      listed: result.listed,
      orphans: result.orphans.length,
      deleted: result.deleted,
    });
    return;
  }

  logger.info('[backfill-avatar-r2] start', { write, recompress, limit, batch });
  let from = 0;
  let processed = 0;
  let uploaded = 0;
  let skipped = 0;
  let failed = 0;
  const failedIds = new Set();
  const listRows = recompress ? listAvatarsForRecompress : listPendingAvatarBackfill;
  // Pending+write: rows drop out of the query after ProfileImageKey is set.
  // Recompress+write: rows keep a key, so paginate forward like dry-run.
  const paginateForward = !write || recompress;

  while (processed < limit) {
    const rows = paginateForward
      ? await listRows({ from, to: from + batch - 1 })
      : await listRows({ from: 0, to: batch - 1 });
    if (!rows.length) break;

    const batchRows = !paginateForward
      ? rows.filter((row) => !failedIds.has(Number(row.UserId)))
      : rows;
    if (!batchRows.length) break;

    for (const row of batchRows) {
      if (processed >= limit) break;
      processed += 1;
      const userId = row.UserId;
      if (!shouldStoreProfileImageInR2(row.ProfileImage)) {
        skipped += 1;
        if (write && !paginateForward) failedIds.add(Number(userId));
        continue;
      }
      if (!write) {
        logger.info('[backfill-avatar-r2] dry-run', {
          userId,
          bytes: row.ProfileImage?.length || 0,
          existingKey: row.ProfileImageKey || null,
        });
        uploaded += 1;
        continue;
      }
      const key = await persistAvatarKey(userId, row.ProfileImage);
      if (key) {
        uploaded += 1;
        logger.info('[backfill-avatar-r2] uploaded', { userId, key });
      } else {
        failed += 1;
        if (!paginateForward) failedIds.add(Number(userId));
        logger.warn('[backfill-avatar-r2] failed', { userId });
      }
    }

    if (paginateForward) {
      from += batch;
      if (rows.length < batch) break;
    }
  }

  logger.info('[backfill-avatar-r2] done', { processed, uploaded, skipped, failed, write, recompress });
}

main().catch((err) => {
  logger.error('[backfill-avatar-r2] crashed', { message: err?.message || String(err) });
  process.exitCode = 1;
});
