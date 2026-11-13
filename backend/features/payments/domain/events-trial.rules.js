/**
 * Version gate for Create Event / Check-in / Paid Features.
 * Trial length and window math live in report-trial.rules.js (centralized 14-day trial).
 * Apps older than 3.5.7, and requests with no version, keep free host tools.
 */
import { isAtLeastVersion } from '../../app-version/domain/version.rules.js';
import {
  REPORT_TRIAL_LENGTH_DAYS,
  canSeeReportDetails,
  reportTrialWindow,
  resolveReportAccess,
  trialStartIstYmd,
} from './report-trial.rules.js';

/** Same length as Reports — one shared free trial. */
export const EVENTS_TRIAL_LENGTH_DAYS = REPORT_TRIAL_LENGTH_DAYS;
/** First app version whose Create Event / Check-in / Paid Features require trial or Premium. */
export const EVENTS_HOST_MIN_VERSION = '3.5.7';

export { trialStartIstYmd, reportTrialWindow as eventsTrialWindow, resolveReportAccess as resolveEventsAccess };

/**
 * @param {unknown} access
 * @returns {boolean}
 */
export function canUseEventsHostTools(access) {
  return canSeeReportDetails(access);
}

/**
 * Gate only the new app. Missing and older versions keep free host tools.
 * The flag is a kill switch: off means nobody is gated.
 * @param {{ flagEnabled?: boolean, appVersion?: string|null }} input
 * @returns {boolean}
 */
export function shouldGateEventsHostTools({ flagEnabled = false, appVersion = null } = {}) {
  if (!flagEnabled) return false;
  return isAtLeastVersion(appVersion, EVENTS_HOST_MIN_VERSION) === true;
}
