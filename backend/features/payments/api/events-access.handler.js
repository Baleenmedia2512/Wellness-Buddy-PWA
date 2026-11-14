/**
 * Digital Portfolio access. Create Event and Check-in are not gated here.
 * Uses the SAME centralized 14-day trial as Reports (`report_trials_table`).
 * If a member already started Reports and has days left, that window continues here.
 * Premium unlocks all gated modules.
 */
import { ValidationError } from '../../../shared/lib/ValidationError.js';
import logger from '../../../shared/lib/logger.js';
import { isEnabled } from '../../../shared/lib/feature-flags.js';
import { getClientAppVersion } from '../../../shared/lib/client-app-version.js';
import { getReportAccess, startReportTrial } from './report-access.handler.js';
import { shouldGateEventsHostTools } from '../domain/events-trial.rules.js';

/**
 * @param {{ httpStatus: number, body: { ok: boolean, data: object } }} result
 */
function mapToHostTools(result) {
  const data = result?.body?.data || {};
  return {
    httpStatus: result.httpStatus,
    body: {
      ok: true,
      data: {
        access: data.access,
        daysLeft: data.daysLeft,
        canUseHostTools: data.canSeeDetails === true,
      },
    },
  };
}

/**
 * @param {{ userId: unknown }} input
 * @param {object} [deps]
 */
export async function getEventsAccess(input, deps = {}) {
  return mapToHostTools(await getReportAccess(input, deps));
}

/**
 * Starts or continues the shared Reports 14-day trial (one start per member).
 * @param {{ userId: unknown }} input
 * @param {object} [deps]
 */
export async function startEventsTrial(input, deps = {}) {
  return mapToHostTools(await startReportTrial(input, deps));
}

/**
 * New app versions block Digital Portfolio unless this member is paid or in the shared trial.
 * Lookup failures block host tools. Older apps are not gated.
 * @param {object} req
 * @param {unknown} userId
 * @returns {Promise<boolean>}
 */
export async function shouldBlockEventsHostTools(req, userId) {
  if (!shouldGateEventsHostTools({
    flagEnabled: isEnabled('ff.events-trial'),
    appVersion: getClientAppVersion(req),
  })) {
    return false;
  }
  try {
    const result = await getEventsAccess({ userId });
    return result.body.data.canUseHostTools !== true;
  } catch (error) {
    logger.warn('Events host tools gate failed closed', {
      message: error?.message || String(error),
    });
    return true;
  }
}

/**
 * Throw when a gated client opens Digital Portfolio without trial or Premium.
 * Create Event and Check-in are not premium.
 * @param {object} req
 * @param {unknown} userId
 */
export async function assertEventsHostToolsAllowed(req, userId) {
  if (await shouldBlockEventsHostTools(req, userId)) {
    throw new ValidationError(
      403,
      'Digital Portfolio needs a free trial or Premium.',
    );
  }
}
