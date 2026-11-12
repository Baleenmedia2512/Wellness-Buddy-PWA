/**
 * Admin/developer Google Maps Listing queue.
 */
import { ValidationError } from '../../../shared/lib/ValidationError.js';
import { isEnabled } from '../../../shared/lib/feature-flags.js';
import { findByUserId } from '../../user/user.repository.js';
import * as requestRepo from '../data/request.repo.js';
import { assertGbpAdmin } from '../domain/permissions/gbp.policy.js';
import {
  GBP_FLAG,
  GBP_STATUS,
  isAdminEditableGbpStatus,
  toPublicGbpRequest,
} from '../domain/request.rules.js';
import { validateRequestId, validateUserId } from '../validation/access.schema.js';

function featureDisabled() {
  throw new ValidationError(404, 'Google Maps Listing is not available');
}

async function assertAdminRequester(rawRequesterId) {
  const requesterUserId = validateUserId(rawRequesterId);
  const requester = await findByUserId(requesterUserId, '"UserId", "Role", "UserName"');
  if (!requester) throw new ValidationError(404, 'Requester account not found');
  assertGbpAdmin(requester);
  return requester;
}

export async function listAdminRequests({ requesterUserId, status = null }) {
  if (!isEnabled(GBP_FLAG)) featureDisabled();
  await assertAdminRequester(requesterUserId);
  const rows = await requestRepo.listAll({
    status: status ? String(status) : null,
  });
  const counts = {
    total: rows.length,
    draft: 0,
    submitted: 0,
    in_progress: 0,
    live: 0,
    needs_info: 0,
    cancelled: 0,
  };
  for (const row of rows) {
    if (counts[row.status] != null) counts[row.status] += 1;
  }
  return {
    httpStatus: 200,
    body: {
      ok: true,
      data: {
        counts,
        requests: rows.map((row) => toPublicGbpRequest(row)),
      },
    },
  };
}

export async function getAdminRequest({ requesterUserId, requestId: rawId }) {
  if (!isEnabled(GBP_FLAG)) featureDisabled();
  await assertAdminRequester(requesterUserId);
  const requestId = validateRequestId(rawId);
  const row = await requestRepo.findById(requestId);
  if (!row) throw new ValidationError(404, 'Request not found');
  return {
    httpStatus: 200,
    body: { ok: true, data: toPublicGbpRequest(row) },
  };
}

export async function patchAdminRequest({
  requesterUserId,
  requestId: rawId,
  status: rawStatus,
  mapsUrl = null,
  opsNote = null,
}) {
  if (!isEnabled(GBP_FLAG)) featureDisabled();
  await assertAdminRequester(requesterUserId);
  const requestId = validateRequestId(rawId);
  const row = await requestRepo.findById(requestId);
  if (!row) throw new ValidationError(404, 'Request not found');

  const status = String(rawStatus || '').trim().toLowerCase();
  if (!isAdminEditableGbpStatus(status) && status !== GBP_STATUS.DRAFT) {
    throw new ValidationError(400, 'Invalid status');
  }
  if (status === GBP_STATUS.LIVE && !String(mapsUrl || row.mapsUrl || '').trim()) {
    throw new ValidationError(400, 'Maps URL is required when marking Live');
  }

  const updated = await requestRepo.adminUpdate({
    requestId,
    status,
    mapsUrl: mapsUrl != null ? mapsUrl : row.mapsUrl,
    opsNote: opsNote != null ? opsNote : row.opsNote,
  });

  return {
    httpStatus: 200,
    body: { ok: true, data: toPublicGbpRequest(updated) },
  };
}
