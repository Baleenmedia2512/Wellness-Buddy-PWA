/**
 * Digital Portfolio API access (§5.1).
 * Next-release clients: hub open (site credits gate create/publish separately).
 * Older / missing version: keep events-trial / Premium gate.
 */
import { getClientAppVersion } from '../../../shared/lib/client-app-version.js';
import { assertEventsHostToolsAllowed } from '../../payments/api/events-access.handler.js';
import { usesPortfolioSiteSlots } from '../domain/siteSlots.rules.js';

/**
 * @param {object} req
 * @param {unknown} userId
 */
export async function assertDigitalPortfolioAllowed(req, userId) {
  const appVersion = getClientAppVersion(req);
  if (usesPortfolioSiteSlots(appVersion)) {
    return;
  }
  await assertEventsHostToolsAllowed(req, userId);
}

/**
 * @param {object} req
 * @returns {boolean}
 */
export function requestUsesPortfolioSiteSlots(req) {
  return usesPortfolioSiteSlots(getClientAppVersion(req));
}
