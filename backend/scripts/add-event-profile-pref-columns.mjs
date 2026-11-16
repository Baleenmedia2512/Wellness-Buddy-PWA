/**
 * One-shot: ensure team_table event profile preference columns exist.
 * Safe to re-run (duplicate column → success).
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const columns = [
  ['EventTranslation', 'VARCHAR(40) NULL'],
  ['EventYourCity', 'VARCHAR(120) NULL'],
  ['EventLevel', 'VARCHAR(40) NULL'],
];

try {
  for (const [name, type] of columns) {
    try {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE team_table ADD COLUMN ${name} ${type}`,
      );
      console.log(`OK: ${name} column added`);
    } catch (e) {
      const msg = String(e?.message || e);
      if (/Duplicate column|already exists/i.test(msg)) {
        console.log(`OK: ${name} column already exists`);
      } else {
        console.error(`FAIL ${name}:`, msg);
        process.exitCode = 1;
      }
    }
  }
} finally {
  await prisma.$disconnect();
}
