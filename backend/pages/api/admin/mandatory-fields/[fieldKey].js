/**
 * PUT /api/admin/mandatory-fields/:fieldKey
 * Full replacement of one registered rule. Omitted required saves as off.
 * The actor is the query identity. A user id in the rule body is not the actor.
 */
import { applyCors, methodNotAllowed, runService } from '../../../../shared/lib/handler.js';
import { rejectIfAppVersionTooOld } from '../../../../features/app-version/api/enforce-api.handler.js';
import { putAdminMandatoryField } from '../../../../features/mandatory-fields/mandatoryFields.service.js';
import { resolveMandatoryRequestIdentity } from '../../../../features/mandatory-fields/domain/access.rules.js';

export default async function handler(req, res) {
  if (applyCors(req, res, 'PUT, OPTIONS')) return;
  if (rejectIfAppVersionTooOld(req, res)) return;
  if (req.method !== 'PUT') return methodNotAllowed(res);
  const identity = resolveMandatoryRequestIdentity(req, { allowBody: false });
  const body = req.body || {};
  return runService(res, () => putAdminMandatoryField({
    userId: identity.userId,
    email: identity.email,
    conflict: identity.conflict,
    fieldKey: req.query.fieldKey,
    required: body.required,
    graceType: body.graceType,
    graceLimit: body.graceLimit,
    audience: body.audience,
    minAppVersion: body.minAppVersion,
    notifyEnabled: body.notifyEnabled,
    remindEveryDays: body.remindEveryDays,
    positionScope: body.positionScope,
    positionCodes: body.positionCodes,
  }));
}
