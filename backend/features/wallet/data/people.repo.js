/**
 * Read-only Wellness Valley people lookup for wallet cash-in.
 * Does not change team_table. Only people with a stored profile email qualify.
 */
import { getMysqlClient } from '../../../utils/mysqlClient.js';
import { wellnessValleyEmail } from '../domain/wallet.rules.js';

const TEAM = 'team_table';

export async function findActivePersonByUserId(userId) {
  const uid = Number(userId);
  if (!Number.isFinite(uid) || uid <= 0) return null;
  const db = getMysqlClient();
  const { data, error } = await db
    .from(TEAM)
    .select('UserId, UserName, Email, Status')
    .eq('UserId', uid)
    .limit(1);
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return {
    UserId: Number(row.UserId),
    UserName: row.UserName ? String(row.UserName).trim() : '',
    Email: wellnessValleyEmail(row.Email),
    Status: row.Status ? String(row.Status) : '',
  };
}

/**
 * @param {string} searchQuery already sanitised
 * @returns {Promise<Array<{ userId: number, userName: string, email: string }>>}
 */
export async function searchPeopleWithEmail(searchQuery) {
  const q = String(searchQuery || '').trim();
  if (q.length < 2) return [];
  const db = getMysqlClient();
  const { data, error } = await db
    .from(TEAM)
    .select('UserId, UserName, Email')
    .eq('Status', 'Active')
    .not('Email', 'is', null)
    .neq('Email', '')
    .or(`UserName.ilike.%${q}%,Email.ilike.%${q}%`)
    .order('UserName', { ascending: true })
    .limit(20);
  if (error) throw error;

  const seen = new Set();
  const results = [];
  for (const row of data || []) {
    const email = wellnessValleyEmail(row.Email);
    if (!email) continue;
    const userId = Number(row.UserId);
    if (!Number.isFinite(userId) || seen.has(userId)) continue;
    seen.add(userId);
    results.push({
      userId,
      userName: row.UserName ? String(row.UserName).trim() : 'Member',
      email,
    });
  }
  return results;
}
