/**
 * Backup team_table.transformation_photos before R2 backfill.
 * Writes a JSON file you can restore from if needed.
 *
 * From backend/:
 *   node --env-file=.env scripts/backup-transformation-photos.js
 *
 * Restore (only if needed — ask before running):
 *   node --env-file=.env scripts/backup-transformation-photos.js --restore=./backups/transformation_photos_YYYYMMDD.json
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getSupabaseClient } from '../utils/supabaseClient.js';
import logger from '../shared/lib/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEAM = 'team_table';
const BATCH = 100;

function parseArgs(argv) {
  const out = { restore: null };
  for (const arg of argv) {
    if (arg.startsWith('--restore=')) out.restore = arg.slice('--restore='.length);
  }
  return out;
}

async function fetchAllRows(supabase) {
  const rows = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from(TEAM)
      .select('"UserId", transformation_photos')
      .not('transformation_photos', 'is', null)
      .order('UserId', { ascending: true })
      .range(from, from + BATCH - 1);
    if (error) throw error;
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < BATCH) break;
    from += BATCH;
  }
  return rows;
}

async function backup() {
  const supabase = getSupabaseClient();
  const rows = await fetchAllRows(supabase);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = path.join(__dirname, '..', 'backups');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `transformation_photos_${stamp}.json`);
  const payload = {
    createdAt: new Date().toISOString(),
    table: TEAM,
    column: 'transformation_photos',
    count: rows.length,
    rows: rows.map((r) => ({
      UserId: r.UserId,
      transformation_photos: r.transformation_photos,
    })),
  };
  fs.writeFileSync(file, JSON.stringify(payload), 'utf8');
  logger.info('[backup-transformation-photos] wrote', { file, count: rows.length });
  return file;
}

async function restore(filePath) {
  const abs = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(abs)) {
    throw new Error(`Backup file not found: ${abs}`);
  }
  const payload = JSON.parse(fs.readFileSync(abs, 'utf8'));
  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  const supabase = getSupabaseClient();
  let ok = 0;
  let failed = 0;
  for (const row of rows) {
    const userId = row.UserId;
    try {
      const { error } = await supabase
        .from(TEAM)
        .update({ transformation_photos: row.transformation_photos ?? null })
        .eq('UserId', userId);
      if (error) throw error;
      ok += 1;
    } catch (err) {
      failed += 1;
      logger.warn('[backup-transformation-photos] restore row failed', {
        userId,
        message: err?.message || String(err),
      });
    }
  }
  logger.info('[backup-transformation-photos] restore done', { file: abs, ok, failed, total: rows.length });
}

async function main() {
  const { restore: restorePath } = parseArgs(process.argv.slice(2));
  if (restorePath) {
    await restore(restorePath);
    return;
  }
  await backup();
}

main().catch((err) => {
  logger.error('[backup-transformation-photos] fatal', { message: err?.message || String(err) });
  process.exitCode = 1;
});
