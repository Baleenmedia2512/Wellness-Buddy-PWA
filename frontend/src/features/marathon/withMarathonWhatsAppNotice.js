/**
 * Live-date wrapper around appendMarathonWhatsAppNotice.
 * Honours `marathon.testDate` when no explicit YYYY-MM-DD is passed
 * (same QA override as the Home banner).
 */
import { todayBusinessDate } from '../../shared/utils/datetimeUtils';
import storage from '../../shared/lib/storage';
import {
  resolveMarathonToday,
  MARATHON_TEST_DATE_STORAGE_KEY,
} from './domain/marathonCalendar';
import { appendMarathonWhatsAppNotice } from './domain/marathonShareCaption';

/**
 * @param {unknown} caption
 * @param {unknown} [ymdOverride]
 * @returns {string}
 */
export function withMarathonWhatsAppNotice(caption, ymdOverride) {
  const live = ymdOverride || todayBusinessDate();
  const stored = ymdOverride ? null : storage.get(MARATHON_TEST_DATE_STORAGE_KEY);
  return appendMarathonWhatsAppNotice(caption, resolveMarathonToday(live, stored));
}
