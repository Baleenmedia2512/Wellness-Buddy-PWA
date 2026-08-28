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
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(__dirname, '..');

const DEVELOPER_BOT_EMAIL = 'easy2work.developer@gmail.com';
const DEVELOPER_BOT_NAME = 'developer bot';
const DEVELOPER_BOT_PHONE = '9000000001';

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

function createSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY (or SUPABASE_ANON_KEY) are required');
  }
  return createClient(url, key);
}

async function findOne(supabase, column, value) {
  const { data, error } = await supabase
    .from('team_table')
    .select('UserId, UserName, Email, PhoneNumber, Role, Status, SetupSkipped')
    .ilike(column, value)
    .limit(1);
  if (error) throw error;
  return data?.[0] || null;
}

async function findByPhone(supabase, phone) {
  const { data, error } = await supabase
    .from('team_table')
    .select('UserId, UserName, Email, PhoneNumber, Role, Status, SetupSkipped')
    .eq('PhoneNumber', phone)
    .limit(1);
  if (error) throw error;
  return data?.[0] || null;
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

async function main() {
  const supabase = createSupabase();
  const now = new Date().toISOString();
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

  const byEmail = await findOne(supabase, 'Email', DEVELOPER_BOT_EMAIL);
  const byPhone = await findByPhone(supabase, DEVELOPER_BOT_PHONE);

  if (byPhone && (!byEmail || String(byPhone.UserId) !== String(byEmail.UserId))) {
    const phoneEmail = String(byPhone.Email || '').trim().toLowerCase();
    if (phoneEmail && phoneEmail !== DEVELOPER_BOT_EMAIL) {
      throw new Error(
        `Phone ${DEVELOPER_BOT_PHONE} already belongs to another user (UserId=${byPhone.UserId}). Pick a different test number.`,
      );
    }
  }

  if (byEmail) {
    const { error } = await supabase
      .from('team_table')
      .update(desired)
      .eq('UserId', byEmail.UserId);
    if (error) throw error;
    const updated = await findOne(supabase, 'Email', DEVELOPER_BOT_EMAIL);
    console.log('Updated developer bot sponsor:', summarize(updated));
    return;
  }

  if (byPhone && !String(byPhone.Email || '').trim()) {
    const { error } = await supabase
      .from('team_table')
      .update(desired)
      .eq('UserId', byPhone.UserId);
    if (error) throw error;
    const updated = await findByPhone(supabase, DEVELOPER_BOT_PHONE);
    console.log('Updated existing phone row into developer bot sponsor:', summarize(updated));
    return;
  }

  const { data, error } = await supabase
    .from('team_table')
    .insert({
      ...desired,
      EntryDateTime: now,
      EntryUser: 'Developer Bot',
      Password: 'User@123#',
      TargetWeightInKg: 0,
    })
    .select('UserId, UserName, Email, PhoneNumber, Role, Status')
    .single();
  if (error) throw error;
  console.log('Created developer bot sponsor:', summarize(data));
}

main().catch((err) => {
  console.error('ensure-developer-bot failed:', err.message || err);
  process.exit(1);
});
