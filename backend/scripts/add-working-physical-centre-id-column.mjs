/**
 * One-shot: ensure team_table.WorkingPhysicalCentreId exists.
 * Safe to re-run (duplicate column → success).
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
try {
  await prisma.$executeRawUnsafe(
    'ALTER TABLE team_table ADD COLUMN WorkingPhysicalCentreId INT NULL',
  );
  console.log('OK: WorkingPhysicalCentreId column added');
} catch (e) {
  const msg = String(e?.message || e);
  if (/Duplicate column|already exists/i.test(msg)) {
    console.log('OK: WorkingPhysicalCentreId column already exists');
  } else {
    console.error('FAIL:', msg);
    process.exitCode = 1;
  }
} finally {
  await prisma.$disconnect();
}
