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
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(__dirname, '..');

const DEMO_PHONE = '9876543211';
const DEMO_NAME = 'cashfree test';

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

async function findByPhone(supabase, phone) {
  const { data, error } = await supabase
    .from('team_table')
    .select('UserId, UserName, Email, PhoneNumber, Role, Status, SetupSkipped, CoachApproved')
    .eq('PhoneNumber', phone)
    .limit(1);
  if (error) throw error;
  return data?.[0] || null;
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

async function main() {
  const supabase = createSupabase();
  const now = new Date().toISOString();
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

  const existing = await findByPhone(supabase, DEMO_PHONE);
  if (existing) {
    const { error } = await supabase
      .from('team_table')
      .update(desired)
      .eq('UserId', existing.UserId);
    if (error) throw error;
    const updated = await findByPhone(supabase, DEMO_PHONE);
    console.log('Updated Cashfree demo account:', summarize(updated));
    console.log('Login: phone', DEMO_PHONE, 'OTP 1234');
    return;
  }

  const { data, error } = await supabase
    .from('team_table')
    .insert({
      ...desired,
      EntryDateTime: now,
      EntryUser: 'Cashfree Demo',
      Password: 'User@123#',
      TargetWeightInKg: 0,
    })
    .select('UserId, UserName, PhoneNumber, Role, Status, SetupSkipped, CoachApproved')
    .single();
  if (error) throw error;
  console.log('Created Cashfree demo account:', summarize(data));
  console.log('Login: phone', DEMO_PHONE, 'OTP 1234');
}

main().catch((err) => {
  console.error('ensure-cashfree-demo failed:', err.message || err);
  process.exit(1);
});
