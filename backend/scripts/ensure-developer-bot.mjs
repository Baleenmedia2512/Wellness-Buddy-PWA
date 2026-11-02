/**
 * Ensure the developer-bot sponsor exists so onboarding OTP emails
 * go to easy2work.developer@gmail.com.
 *
 * Keep identity constants in sync with
 * backend/features/user/domain/developerBot.rules.js
 *
 * Run from backend/:
 *   node --env-file=.env scripts/ensure-developer-bot.mjs
 */
import { readFileSync, existsSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';

const __dirname = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(__dirname, '..');

const DEVELOPER_BOT_EMAIL = 'easy2work.developer@gmail.com';
const DEVELOPER_BOT_NAME = 'developer bot';
const DEVELOPER_BOT_PHONE = '9000000001';

const ROW_SELECT = {
  UserId: true,
  UserName: true,
  Email: true,
  PhoneNumber: true,
  Role: true,
  Status: true,
  SetupSkipped: true,
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

function findOne(prisma, column, value) {
  return prisma.team_table.findFirst({
    where: { [column]: value },
    select: ROW_SELECT,
  });
}

function summarize(row) {
  return {
    userId: row.UserId,
    userName: row.UserName,
    email: row.Email,
    phone: row.PhoneNumber,
    role: row.Role,
    status: row.Status,
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
      UserName: DEVELOPER_BOT_NAME,
      Email: DEVELOPER_BOT_EMAIL,
      PhoneNumber: DEVELOPER_BOT_PHONE,
      Role: 'developer',
      Status: 'Active',
      SetupSkipped: true,
      CoachApproved: 1,
      ConsentAcceptedAt: now,
      ConsentVersion: '2026-07-31',
      LastActiveAt: now,
    };

    const byEmail = await findOne(prisma, 'Email', DEVELOPER_BOT_EMAIL);
    const byPhone = await findOne(prisma, 'PhoneNumber', DEVELOPER_BOT_PHONE);

    if (byPhone && (!byEmail || String(byPhone.UserId) !== String(byEmail.UserId))) {
      const phoneEmail = String(byPhone.Email || '').trim().toLowerCase();
      if (phoneEmail && phoneEmail !== DEVELOPER_BOT_EMAIL) {
        throw new Error(
          `Phone ${DEVELOPER_BOT_PHONE} already belongs to another user (UserId=${byPhone.UserId}). Pick a different test number.`,
        );
      }
    }

    if (byEmail) {
      const updated = await prisma.team_table.update({
        where: { UserId: byEmail.UserId },
        data: desired,
        select: ROW_SELECT,
      });
      console.log('Updated developer bot sponsor:', summarize(updated));
      return;
    }

    if (byPhone && !String(byPhone.Email || '').trim()) {
      const updated = await prisma.team_table.update({
        where: { UserId: byPhone.UserId },
        data: desired,
        select: ROW_SELECT,
      });
      console.log('Updated existing phone row into developer bot sponsor:', summarize(updated));
      return;
    }

    const created = await insertTeamRow(prisma, {
      ...desired,
      EntryDateTime: now,
      EntryUser: 'Developer Bot',
      Password: 'User@123#',
      TargetWeightInKg: 0,
    });
    console.log('Created developer bot sponsor:', summarize(created));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('ensure-developer-bot failed:', err.message || err);
  process.exit(1);
});
