/**
 * GET /api/admin/mandatory-fields
 * Admin and developer only. Rules stay disabled until an admin saves required=true.
 */
import { applyCors, methodNotAllowed, runService } from '../../../../shared/lib/handler.js';
import { rejectIfAppVersionTooOld } from '../../../../features/app-version/api/enforce-api.handler.js';
import { getAdminMandatoryFields } from '../../../../features/mandatory-fields/mandatoryFields.service.js';
import { resolveMandatoryRequestIdentity } from '../../../../features/mandatory-fields/domain/access.rules.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'GET, OPTIONS')) return;
  if (rejectIfAppVersionTooOld(req, res)) return;
  if (req.method !== 'GET') return methodNotAllowed(res);
  const identity = resolveMandatoryRequestIdentity(req, { allowBody: false });
  return runService(res, () => getAdminMandatoryFields(identity));
}
