/**
 * Ensure the Cashfree payment-review phone account exists.
 *
 * Identity constants must stay in sync with
 * backend/features/auth/domain/demo-account.rules.js
 *
 * Run from backend/:
 *   node --env-file=.env scripts/ensure-cashfree-demo.mjs
 */
import { readFileSync, existsSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';

const __dirname = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(__dirname, '..');

const DEMO_PHONE = '9876543211';
const DEMO_NAME = 'cashfree test';

const ROW_SELECT = {
  UserId: true,
  UserName: true,
  Email: true,
  PhoneNumber: true,
  Role: true,
  Status: true,
  SetupSkipped: true,
  CoachApproved: true,
};

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  const text = readFileSync(filePath, 'utf8');
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile(resolve(backendRoot, '.env.local'));
loadEnvFile(resolve(backendRoot, '.env'));

function createPrisma() {
  const url = process.env.MYSQL_DATABASE_URL;
  if (!url) throw new Error('MYSQL_DATABASE_URL is required');
  return new PrismaClient({ datasources: { db: { url } } });
}

function summarize(row) {
  return {
    userId: row.UserId,
    userName: row.UserName,
    phone: row.PhoneNumber,
    role: row.Role,
    status: row.Status,
    setupSkipped: row.SetupSkipped,
    coachApproved: row.CoachApproved,
  };
}

async function insertTeamRow(prisma, data) {
  return prisma.$transaction(async (tx) => {
    const max = await tx.team_table.aggregate({ _max: { UserId: true } });
    const UserId = Number(max._max.UserId || 0) + 1;
    return tx.team_table.create({
      data: { ...data, UserId },
      select: ROW_SELECT,
    });
  });
}

async function main() {
  const prisma = createPrisma();
  try {
    const now = new Date();
    const desired = {
      UserName: DEMO_NAME,
      PhoneNumber: DEMO_PHONE,
      Role: 'user',
      Status: 'Active',
      SetupSkipped: true,
      CoachApproved: 1,
      ConsentAcceptedAt: now,
      ConsentVersion: '2026-07-31',
      LastActiveAt: now,
    };

    const existing = await prisma.team_table.findFirst({
      where: { PhoneNumber: DEMO_PHONE },
      select: ROW_SELECT,
    });
    if (existing) {
      const updated = await prisma.team_table.update({
        where: { UserId: existing.UserId },
        data: desired,
        select: ROW_SELECT,
      });
      console.log('Updated Cashfree demo account:', summarize(updated));
      console.log('Login: phone', DEMO_PHONE, 'OTP 1234');
      return;
    }

    const created = await insertTeamRow(prisma, {
      ...desired,
      EntryDateTime: now,
      EntryUser: 'Cashfree Demo',
      Password: 'User@123#',
      TargetWeightInKg: 0,
    });
    console.log('Created Cashfree demo account:', summarize(created));
    console.log('Login: phone', DEMO_PHONE, 'OTP 1234');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('ensure-cashfree-demo failed:', err.message || err);
  process.exit(1);
});
