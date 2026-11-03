/**
 * Active Wellness Valley people for event designated-person picking.
 * Does not change team_table. Independent of wallet and sponsor search.
 */
import { getMysqlClient } from '../../../utils/mysqlClient.js';
import { EVENT_PEOPLE_LIMIT, sanitizeEventPeopleQuery } from '../domain/event.rules.js';

function toPerson(row) {
  const userId = Number(row?.UserId);
  const name = String(row?.UserName || '').trim();
  if (!Number.isInteger(userId) || userId <= 0 || !name) return null;
  return {
    userId,
    name,
    email: String(row?.Email || '').trim(),
  };
}

export async function searchActivePeople(rawQuery) {
  const q = sanitizeEventPeopleQuery(rawQuery);
  const db = getMysqlClient();
  let request = db
    .from('team_table')
    .select('UserId, UserName, Email')
    .eq('Status', 'Active');

  if (q.length >= 2) {
    request = request.or(`UserName.ilike.%${q}%,Email.ilike.%${q}%`);
  }

  const { data, error } = await request
    .order('UserName', { ascending: true })
    .limit(EVENT_PEOPLE_LIMIT);
  if (error) throw error;

  const seen = new Set();
  const people = [];
  for (const row of data || []) {
    const person = toPerson(row);
    if (!person || seen.has(person.userId)) continue;
    seen.add(person.userId);
    people.push(person);
  }
  return people;
}
