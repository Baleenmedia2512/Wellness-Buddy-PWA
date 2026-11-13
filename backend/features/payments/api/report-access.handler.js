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
import { cashfreeCheckoutMode } from '../domain/premium.rules.js';
import {
  canSeeReportDetails,
  resolveReportAccess,
  shouldGateReportDetails,
  trialStartIstYmd,
} from '../domain/report-trial.rules.js';

function parseUserId(raw) {
  const userId = Number.parseInt(String(raw ?? ''), 10);
  return Number.isFinite(userId) && userId > 0 ? userId : null;
}

function accessPayload({ premium, everPaid, startedAt, todayYmd }) {
  const startYmd = premium ? null : trialStartIstYmd(startedAt);
  const resolved = resolveReportAccess({
    premium,
    everPaid: everPaid === true,
    startYmd,
    todayYmd,
  });
  return {
    access: resolved.access,
    daysLeft: resolved.daysLeft,
    canSeeDetails: canSeeReportDetails(resolved.access),
  };
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
  let premium = false;
  try {
    premium = await hasPaid({ userId, mode });
  } catch (error) {
    logger.warn('Report access premium lookup failed', {
      userId,
      message: error?.message || String(error),
    });
  }

  let everPaid = premium;
  if (!premium) {
    try {
      everPaid = await hasEverPaid({ userId, mode });
    } catch (error) {
      logger.warn('Report access ever-paid lookup failed', {
        userId,
        message: error?.message || String(error),
      });
      everPaid = false;
    }
  }

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
 *   todayYmd?: string,
 * }} [deps]
 */
export async function startReportTrial(input, deps = {}) {
  const hasPaid = deps.hasPaid || hasPaidPremium;
  const hasEverPaid = deps.hasEverPaid || hasEverPaidPremium;
  const readStart = deps.readStart || findReportTrialStart;
  const saveStart = deps.saveStart || insertReportTrialStart;
  const userId = parseUserId(input.userId);
  if (!userId) throw new ValidationError(400, 'userId is required');

  const todayYmd = deps.todayYmd || todayInTimezone(IANA_IST);
  const mode = cashfreeCheckoutMode(process.env.CASHFREE_ENV || 'sandbox');
  let premium = false;
  try {
    premium = await hasPaid({ userId, mode });
  } catch (error) {
    logger.warn('Report trial premium lookup failed', {
      userId,
      message: error?.message || String(error),
    });
  }
  if (premium) {
    return {
      httpStatus: 200,
      body: { ok: true, data: accessPayload({ premium: true, everPaid: true, startedAt: null, todayYmd }) },
    };
  }

  let everPaid = false;
  try {
    everPaid = await hasEverPaid({ userId, mode });
  } catch (error) {
    logger.warn('Report trial ever-paid lookup failed', {
      userId,
      message: error?.message || String(error),
    });
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
