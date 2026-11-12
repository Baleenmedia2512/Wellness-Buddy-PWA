/**
 * GET /api/user/mandatory-fields?userId=
 * Identity comes from the query. Body user ids are ignored.
 */
import { applyCors, methodNotAllowed, runService } from '../../../../shared/lib/handler.js';
import { getClientAppVersion } from '../../../../shared/lib/client-app-version.js';
import { rejectIfAppVersionTooOld } from '../../../../features/app-version/api/enforce-api.handler.js';
import { getUserMandatoryFields } from '../../../../features/mandatory-fields/mandatoryFields.service.js';
import { resolveMandatoryRequestIdentity } from '../../../../features/mandatory-fields/domain/access.rules.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, OPTIONS')) return;
  if (rejectIfAppVersionTooOld(req, res)) return;
  if (req.method !== 'GET') return methodNotAllowed(res);
  const identity = resolveMandatoryRequestIdentity(req, { allowBody: false });
  return runService(res, () => getUserMandatoryFields({
    ...identity,
    appVersion: getClientAppVersion(req),
  }));
}
