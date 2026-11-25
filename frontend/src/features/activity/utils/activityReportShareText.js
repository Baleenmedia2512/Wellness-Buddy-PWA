import { formatHierarchyPersonType } from '../../../shared/domain/hierarchyPersonType.js';

/** API value for Remote club filter — must match backend ACTIVITY_REPORT_CLUB_REMOTE. */
export const ACTIVITY_REPORT_CLUB_REMOTE = '__remote__';

const SHARE_TEXT_MAX_ROWS = 50;

export function formatActivityReportLevel(level) {
  if (level == null || level === '') return '—';
  const n = Number(level);
  return Number.isFinite(n) ? String(n) : '—';
}

/**
 * API Reg. Time is HH:mm or HH:mm:ss (24h). Show like Diary: h:mm AM/PM.
 * @param {unknown} time
 * @returns {string}
 */
export function formatActivityReportTime(time) {
  if (time == null || time === '' || time === 'N/A') return '';
  const s = String(time).trim();
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?/.exec(s);
  if (!match) return s;
  const hour = Number.parseInt(match[1], 10);
  const minute = match[2];
  if (!Number.isFinite(hour) || hour < 0 || hour > 23) return s;
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${minute} ${ampm}`;
}

/** @deprecated Prefer formatHierarchyPersonType — kept for Activity Report imports. */
export function formatActivityReportMemberType(memberType) {
  return formatHierarchyPersonType(memberType);
}

function formatClub(clubName) {
  if (!clubName || clubName === 'N/A') return 'Remote';
  return String(clubName);
}

function formatClubFilterLabel(clubFilter) {
  if (!clubFilter) return null;
  if (clubFilter === ACTIVITY_REPORT_CLUB_REMOTE) return 'Remote';
  return clubFilter;
}

function activityDetailLine(record) {
  const club = formatClub(record.clubName);
  const time12 = formatActivityReportTime(record.time);
  const dateTime = `${record.date || '—'} ${time12 || record.time || ''}`.trim();
  return [
    record.memberName || 'N/A',
    `Club: ${club}`,
    dateTime,
  ].join(' | ');
}

/**
 * Build a plain-text Activity Report summary for sharing.
 */
export function buildActivityReportShareText({
  activityLabel = 'Activity',
  dateLabel = '',
  scopeLabel = '',
  clubFilter = '',
  columnFilter = '',
  searchQuery = '',
  attendanceLabel = '',
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
  if (attendanceLabel) meta.push(attendanceLabel);
  if (meta.length) lines.push(meta.join(' · '));

  const clubLabel = formatClubFilterLabel(clubFilter);
  if (clubLabel) lines.push(`Club: ${clubLabel}`);
  if (columnFilter) lines.push(`Filter: ${columnFilter}`);
  if (searchQuery?.trim()) lines.push(`Search: ${searchQuery.trim()}`);

  lines.push(`Total records: ${totalRecords}`);
  lines.push('');

  const slice = Array.isArray(records) ? records.slice(0, SHARE_TEXT_MAX_ROWS) : [];
  slice.forEach((record, index) => {
    lines.push(`${index + 1}. ${activityDetailLine(record)}`);
  });

  const remaining = Math.max(0, (Number(totalRecords) || 0) - slice.length);
  if (remaining > 0) {
    lines.push('');
    lines.push(`… and ${remaining} more record${remaining === 1 ? '' : 's'}`);
  }

  return lines.join('\n');
}
