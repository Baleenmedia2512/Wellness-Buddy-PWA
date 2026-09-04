/**
 * Home-hero banner for marathon reminders near Take Photo / Gallery:
 * eve of Day 0, and Days 3 / 8 (eve of Detox Days).
 * Calendar rules live in domain/marathonCalendar.js.
 */
import React from 'react';
import { Bell } from 'lucide-react';
import { useBusinessToday } from '../../../shared/hooks/useBusinessToday';
import storage from '../../../shared/lib/storage';
import {
  getDetoxReminder,
  resolveMarathonToday,
  MARATHON_TEST_DATE_STORAGE_KEY,
} from '../domain/marathonCalendar';
import { resolveMarathonTimezoneSource } from '../withMarathonWhatsAppNotice';

/**
 * @param {object} props
 * @param {string} [props.today] YYYY-MM-DD override (tests). Defaults to the
 *   signed-in user's business date (Qatar / USA / India) or
 *   `localStorage.marathon.testDate` when set for QA.
 * @param {object|null} [props.user] Signed-in user (`timezone` / `timezoneIana`).
 */
export default function DetoxDayReminder({ today: todayOverride, user = null } = {}) {
  const timezoneSource = resolveMarathonTimezoneSource(user);
  const liveToday = useBusinessToday(timezoneSource);
  const today = resolveMarathonToday(
    liveToday,
    todayOverride || storage.get(MARATHON_TEST_DATE_STORAGE_KEY),
  );
  const reminder = getDetoxReminder(today);
  if (!reminder) return null;

  return (
    <div
      className="mt-3 flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5"
      role="status"
      aria-live="polite"
      data-testid="detox-day-reminder"
    >
      <div className="h-8 w-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
        <Bell className="w-4 h-4" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-bold text-amber-900">{reminder.title}</p>
        <p className="text-xs text-amber-800/90 mt-0.5">{reminder.subtitle}</p>
      </div>
    </div>
  );
}
