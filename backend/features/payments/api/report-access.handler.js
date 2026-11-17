/**
 * Report detail access for one member: paid, 14-day trial (once), or locked.
 * After Premium expires, show recharge — never a second free trial.
 */
import { ValidationError } from '../../../shared/lib/ValidationError.js';
import logger from '../../../shared/lib/logger.js';
import { isEnabled } from '../../../shared/lib/feature-flags.js';
import { getClientAppVersion } from '../../../shared/lib/client-app-version.js';
import { todayInTimezone, IANA_IST } from '../../../shared/lib/datetime/datetime.js';
import {
  hasPaidPremium,
  hasEverPaidPremium,
} from '../data/premium.repository.js';
import {
  findReportTrialStart,
  insertReportTrialStart,
} from '../data/report-trial.repository.js';
import { getEventProfilePreferences } from '../../user/user.repository.js';
import { cashfreeCheckoutMode } from '../domain/premium.rules.js';
import {
  canSeeReportDetails,
  resolveReportAccess,
  shouldGateReportDetails,
  trialExpiresAtDisplay,
  trialStartIstYmd,
} from '../domain/report-trial.rules.js';

export const COMMUNITY_POSITION_REQUIRED_MESSAGE = 'Fill Community Position on your profile.';

async function readStoredCommunityPosition(userId) {
  const prefs = await getEventProfilePreferences(userId);
  return prefs?.eventLevel;
}

function parseUserId(raw) {
  const userId = Number.parseInt(String(raw ?? ''), 10);
  return Number.isFinite(userId) && userId > 0 ? userId : null;
}

/**
 * Same Premium read Reports and Digital Portfolio share.
 * A failed lookup is not "not Premium" — callers must not open a trial from it.
 */
async function readPremiumFlags({ hasPaid, hasEverPaid, userId, mode, logLabel }) {
  let premium;
  try {
    premium = await hasPaid({ userId, mode });
  } catch (error) {
    logger.warn(logLabel, { userId, message: error?.message || String(error) });
    throw new ValidationError(503, 'Premium status could not be checked');
  }
  if (premium === true) return { premium: true, everPaid: true };
  let everPaid;
  try {
    everPaid = await hasEverPaid({ userId, mode });
  } catch (error) {
    logger.warn(logLabel, { userId, message: error?.message || String(error) });
    throw new ValidationError(503, 'Premium status could not be checked');
  }
  return { premium: false, everPaid: everPaid === true };
}

function accessPayload({ premium, everPaid, startedAt, todayYmd }) {
  const startYmd = premium ? null : trialStartIstYmd(startedAt);
  const resolved = resolveReportAccess({
    premium,
    everPaid: everPaid === true,
    startYmd,
    todayYmd,
  });
  const data = {
    access: resolved.access,
    daysLeft: resolved.daysLeft,
    canSeeDetails: canSeeReportDetails(resolved.access),
  };
  // Extra field. Older apps ignore it. Only an active trial has an end time.
  if (resolved.access === 'trial') {
    const expiresAtDisplay = trialExpiresAtDisplay(startYmd);
    if (expiresAtDisplay) data.expiresAtDisplay = expiresAtDisplay;
  }
  return data;
}

/**
 * @param {{ userId: unknown }} input
 * @param {{
 *   hasPaid?: Function,
 *   hasEverPaid?: Function,
 *   readStart?: Function,
 *   todayYmd?: string,
 * }} [deps]
 */
export async function getReportAccess(input, deps = {}) {
  const hasPaid = deps.hasPaid || hasPaidPremium;
  const hasEverPaid = deps.hasEverPaid || hasEverPaidPremium;
  const readStart = deps.readStart || findReportTrialStart;
  const userId = parseUserId(input.userId);
  if (!userId) throw new ValidationError(400, 'userId is required');

  const todayYmd = deps.todayYmd || todayInTimezone(IANA_IST);
  const mode = cashfreeCheckoutMode(process.env.CASHFREE_ENV || 'sandbox');
  const { premium, everPaid } = await readPremiumFlags({
    hasPaid,
    hasEverPaid,
    userId,
    mode,
    logLabel: 'Report access premium lookup failed',
  });

  // Trial start only matters for first-time (never paid) members.
  let startedAt = null;
  if (!premium && !everPaid) {
    startedAt = await readStart(userId);
  }

  return {
    httpStatus: 200,
    body: { ok: true, data: accessPayload({ premium, everPaid, startedAt, todayYmd }) },
  };
}

/**
 * Start the 14-day trial once. Not available after a Premium payment (even expired).
 * A later tap returns the original window.
 * @param {{ userId: unknown }} input
 * @param {{
 *   hasPaid?: Function,
 *   hasEverPaid?: Function,
 *   readStart?: Function,
 *   saveStart?: Function,
 *   readCommunityPosition?: Function,
 *   todayYmd?: string,
 * }} [deps]
 */
export async function startReportTrial(input, deps = {}) {
  const hasPaid = deps.hasPaid || hasPaidPremium;
  const hasEverPaid = deps.hasEverPaid || hasEverPaidPremium;
  const readStart = deps.readStart || findReportTrialStart;
  const saveStart = deps.saveStart || insertReportTrialStart;
  const readCommunityPosition = deps.readCommunityPosition || readStoredCommunityPosition;
  const userId = parseUserId(input.userId);
  if (!userId) throw new ValidationError(400, 'userId is required');

  const todayYmd = deps.todayYmd || todayInTimezone(IANA_IST);
  const mode = cashfreeCheckoutMode(process.env.CASHFREE_ENV || 'sandbox');
  const { premium, everPaid } = await readPremiumFlags({
    hasPaid,
    hasEverPaid,
    userId,
    mode,
    logLabel: 'Report trial premium lookup failed',
  });
  if (premium) {
    return {
      httpStatus: 200,
      body: { ok: true, data: accessPayload({ premium: true, everPaid: true, startedAt: null, todayYmd }) },
    };
  }

  if (everPaid) {
    return {
      httpStatus: 200,
      body: {
        ok: true,
        data: accessPayload({ premium: false, everPaid: true, startedAt: null, todayYmd }),
      },
    };
  }

  let startedAt = await readStart(userId);
  if (!startedAt) {
    const position = await readCommunityPosition(userId);
    if (!String(position || '').trim()) {
      throw new ValidationError(422, COMMUNITY_POSITION_REQUIRED_MESSAGE);
    }
    startedAt = await saveStart(userId);
  }
  if (!startedAt) {
    throw new ValidationError(500, 'The free trial could not be started');
  }

  return {
    httpStatus: 200,
    body: {
      ok: true,
      data: accessPayload({ premium: false, everPaid: false, startedAt, todayYmd }),
    },
  };
}

/**
 * New app versions hide report numbers unless this member is paid or in trial.
 * Lookup failures hide the numbers. Older apps are not gated.
 * @param {object} req
 * @param {unknown} userId
 * @returns {Promise<boolean>}
 */
export async function shouldHideReportDetails(req, userId) {
  if (!shouldGateReportDetails({
    flagEnabled: isEnabled('ff.report-trial'),
    appVersion: getClientAppVersion(req),
  })) {
    return false;
  }
  try {
    const result = await getReportAccess({ userId });
    return result.body.data.canSeeDetails !== true;
  } catch (error) {
    logger.warn('Report detail gate failed closed', {
      message: error?.message || String(error),
    });
    return true;
  }
}
