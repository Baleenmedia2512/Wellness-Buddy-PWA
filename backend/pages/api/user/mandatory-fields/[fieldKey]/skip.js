/**
 * POST /api/user/mandatory-fields/:fieldKey/skip?userId=
 * Does not write profile columns. A body userId is ignored.
 */
import { applyCors, methodNotAllowed, runService } from '../../../../../shared/lib/handler.js';
import { getClientAppVersion } from '../../../../../shared/lib/client-app-version.js';
import { rejectIfAppVersionTooOld } from '../../../../../features/app-version/api/enforce-api.handler.js';
import { skipMandatoryField } from '../../../../../features/mandatory-fields/mandatoryFields.service.js';
import { resolveMandatoryRequestIdentity } from '../../../../../features/mandatory-fields/domain/access.rules.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;
  if (rejectIfAppVersionTooOld(req, res)) return;
  if (req.method !== 'POST') return methodNotAllowed(res);
  const identity = resolveMandatoryRequestIdentity(req, { allowBody: false });
  return runService(res, () => skipMandatoryField({
    userId: identity.userId,
    email: identity.email,
    conflict: identity.conflict,
    fieldKey: req.query.fieldKey,
    appVersion: getClientAppVersion(req),
  }));
}
