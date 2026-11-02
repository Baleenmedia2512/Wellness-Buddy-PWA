/**
 * Backfill transformation_photos data URIs into Cloudflare R2.
 *
 * Uploads Left/Centre/Right to transformation/{userId}/{slot}/{hash}.jpg
 * and writes frontKey|leftKey|rightKey. Does NOT delete base64 in slots
 * (live ≤3.5.0 clients still need legacy GET responses).
 *
 * From backend/:
 *   node --env-file=.env scripts/backfill-transformation-photos-r2.js
 *   node --env-file=.env scripts/backfill-transformation-photos-r2.js --write --limit=200
 */
import {
  backfillTransformationPhotoKeys,
  r2TransformationPhotosEnabled,
} from '../features/user/transformation-photo-storage.service.js';
import { listTransformationPhotosForBackfill } from '../features/user/user.repository.js';
import { slotsNeedingTransformationR2Upload } from '../features/user/domain/transformationPhotos.rules.js';
import * as repo from '../features/user/user.repository.js';
import logger from '../shared/lib/logger.js';

function parseArgs(argv) {
  const out = { write: false, limit: Infinity, batch: 50 };
  for (const arg of argv) {
    if (arg === '--write') out.write = true;
    else if (arg.startsWith('--limit=')) out.limit = Math.max(0, parseInt(arg.slice(8), 10) || 0);
    else if (arg.startsWith('--batch=')) out.batch = Math.min(100, Math.max(1, parseInt(arg.slice(8), 10) || 50));
  }
  return out;
}

async function main() {
  const { write, limit, batch } = parseArgs(process.argv.slice(2));
  if (!r2TransformationPhotosEnabled()) {
    logger.error('[backfill-transformation-photos-r2] R2 not configured or ff.r2-transformation-photos OFF');
    process.exitCode = 1;
    return;
  }

  logger.info('[backfill-transformation-photos-r2] start', { write, limit, batch });
  let from = 0;
  let scanned = 0;
  let pending = 0;
  let uploaded = 0;
  let failed = 0;

  while (scanned < limit) {
    const rows = await listTransformationPhotosForBackfill({ from, to: from + batch - 1 });
    if (!rows.length) break;

    for (const row of rows) {
      if (scanned >= limit) break;
      scanned += 1;
      const userId = row.UserId;
      const needing = slotsNeedingTransformationR2Upload(row.transformation_photos);
      if (!needing.length) continue;
      pending += 1;

      if (!write) {
        logger.info('[backfill-transformation-photos-r2] would upload', { userId, slots: needing });
        continue;
      }

      try {
        const { record, uploaded: slots } = await backfillTransformationPhotoKeys(
          userId,
          row.transformation_photos,
        );
        if (!slots.length) continue;
        await repo.updateUserById(userId, { transformation_photos: record });
        uploaded += slots.length;
        logger.info('[backfill-transformation-photos-r2] uploaded', { userId, slots });
      } catch (err) {
        failed += 1;
        logger.warn('[backfill-transformation-photos-r2] failed', {
          userId,
          message: err?.message || String(err),
        });
      }
    }

    from += batch;
    if (rows.length < batch) break;
  }

  logger.info('[backfill-transformation-photos-r2] done', {
    write,
    scanned,
    pending,
    uploaded,
    failed,
  });
}

main().catch((err) => {
  logger.error('[backfill-transformation-photos-r2] fatal', { message: err?.message || String(err) });
  process.exitCode = 1;
});
