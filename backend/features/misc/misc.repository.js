import { getMysqlClient } from '../../utils/mysqlClient.js';
import { applyDateRangeFilter } from '../../shared/lib/datetime/applyDayFilter.js';
import { IANA_IST } from '../../shared/lib/datetime/index.js';

export async function fetchEducationLogs(userId, startDate, endDate, timezoneIana = IANA_IST) {
  const db = getMysqlClient();
  let query = db
    .from('education_logs_table')
    .select('"Id","CreatedAt",attendance_type,nutrition_center_id,center_name')
    .eq('"UserId"', userId)
    .eq('"IsDeleted"', false);
  query = applyDateRangeFilter(query, '"CreatedAt"', startDate, endDate, timezoneIana);
  const { data, error } = await query.order('"CreatedAt"', { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
}

export async function fetchClubsByIds(clubIds) {
  if (!clubIds.length) return [];
  const db = getMysqlClient();
  const { data, error } = await db
    .from('nutrition_centers_table')
    .select('id, center_name, latitude, longitude, owner_user_id')
    .in('id', clubIds)
    .eq('status', 'active')
    .eq('is_deleted', false);
  if (error) return [];
  return data || [];
}

export async function fetchOwnersByIds(ownerIds) {
  if (!ownerIds.length) return [];
  const db = getMysqlClient();
  const { data, error } = await db
    .from('team_table')
    .select('UserId, UserName')
    .in('UserId', ownerIds);
  if (error) return [];
  return data || [];
}
