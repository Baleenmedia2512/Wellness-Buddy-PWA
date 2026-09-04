/** API value for Remote club filter — must match backend ACTIVITY_REPORT_CLUB_REMOTE. */
export const ACTIVITY_REPORT_CLUB_REMOTE = '__remote__';

const SHARE_TEXT_MAX_ROWS = 50;

function formatClub(clubName) {
  if (!clubName || clubName === 'N/A') return 'Remote';
  return String(clubName);
}

function formatClubFilterLabel(clubFilter) {
  if (!clubFilter) return null;
  if (clubFilter === ACTIVITY_REPORT_CLUB_REMOTE) return 'Remote';
  return clubFilter;
}

function activityDetailLine(record, activityId) {
  const club = formatClub(record.clubName);
  const parts = [
    record.memberName || 'N/A',
    `Club: ${club}`,
    `${record.date || '—'} ${record.time || ''}`.trim(),
  ];

  if (activityId === 'weight' && record.weight != null) {
    parts.push(`Weight: ${record.weight} kg`);
  } else if (['breakfast', 'lunch', 'dinner'].includes(activityId)) {
    if (record.mealType) parts.push(`Meal: ${record.mealType}`);
    if (record.calories != null) parts.push(`Calories: ${record.calories}`);
  } else if (activityId === 'water' && record.waterLiters != null) {
    parts.push(`Water: ${record.waterLiters} L`);
  } else if (activityId === 'calories') {
    if (record.steps != null) parts.push(`Steps: ${record.steps}`);
    if (record.caloriesBurned != null) parts.push(`Burned: ${record.caloriesBurned} kcal`);
  }

  const sponsor = record.sponsorName || record.coachName;
  if (sponsor && sponsor !== 'N/A') parts.push(`Sponsor: ${sponsor}`);
  if (record.phone && record.phone !== 'N/A') parts.push(`Phone: ${record.phone}`);

  return parts.join(' | ');
}

/**
 * Build a plain-text Activity Report summary for sharing.
 */
export function buildActivityReportShareText({
  activityLabel = 'Activity',
  dateLabel = '',
  scopeLabel = '',
  clubFilter = '',
  searchQuery = '',
  totalRecords = 0,
  records = [],
  activityId = 'education',
}) {
  const lines = [
    `Activity Report — ${activityLabel}`,
  ];

  const meta = [];
  if (dateLabel) meta.push(`Period: ${dateLabel}`);
  if (scopeLabel) meta.push(`Team: ${scopeLabel}`);
  if (meta.length) lines.push(meta.join(' · '));

  const clubLabel = formatClubFilterLabel(clubFilter);
  if (clubLabel) lines.push(`Club: ${clubLabel}`);
  if (searchQuery?.trim()) lines.push(`Search: ${searchQuery.trim()}`);

  lines.push(`Total records: ${totalRecords}`);
  lines.push('');

  const slice = Array.isArray(records) ? records.slice(0, SHARE_TEXT_MAX_ROWS) : [];
  slice.forEach((record, index) => {
    lines.push(`${index + 1}. ${activityDetailLine(record, activityId)}`);
  });

  const remaining = Math.max(0, (Number(totalRecords) || 0) - slice.length);
  if (remaining > 0) {
    lines.push('');
    lines.push(`… and ${remaining} more record${remaining === 1 ? '' : 's'}`);
  }

  return lines.join('\n');
}
