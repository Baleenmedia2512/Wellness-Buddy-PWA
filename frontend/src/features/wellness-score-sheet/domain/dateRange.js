import { formatLocalDateString, todayDateInIST } from '../../../shared/utils/timezoneUtils';

function ymdFromValue(val) {
  if (!val) return '';
  if (val instanceof Date) return formatLocalDateString(val);
  return String(val);
}

function parseYmd(dateStr) {
  const [y, m, d] = String(dateStr).split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDaysYmd(dateStr, deltaDays) {
  const d = parseYmd(dateStr);
  d.setDate(d.getDate() + deltaDays);
  return formatLocalDateString(d);
}

export function resolveWellnessDateRange({
  preset,
  customStartDate,
  customEndDate,
  today = todayDateInIST(),
}) {
  switch (preset) {
    case 'yesterday': {
      const day = addDaysYmd(today, -1);
      return { startDate: day, endDate: day, isMultiDay: false };
    }
    case 'last7days':
      return {
        startDate: addDaysYmd(today, -6),
        endDate: today,
        isMultiDay: true,
      };
    case 'custom': {
      const start = ymdFromValue(customStartDate) || today;
      const end = ymdFromValue(customEndDate) || start;
      const startDate = start <= end ? start : end;
      const endDate = start <= end ? end : start;
      return {
        startDate,
        endDate,
        isMultiDay: startDate !== endDate,
      };
    }
    case 'today':
    default:
      return { startDate: today, endDate: today, isMultiDay: false };
  }
}

export function formatWellnessDayLabel(dateStr, today = todayDateInIST()) {
  if (dateStr === today) return 'Today';
  if (dateStr === addDaysYmd(today, -1)) return 'Yesterday';
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export function dateFromPickerValue(date) {
  return ymdFromValue(date);
}
