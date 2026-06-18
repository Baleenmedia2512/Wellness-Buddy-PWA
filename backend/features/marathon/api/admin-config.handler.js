/**
 * admin-config.handler.js — Admin-configurable discipline window settings.
 */
import { validateSaveAdminConfig }              from '../validation/marathon.schema.js';
import { canGenerateCard }                       from '../domain/permissions/marathon.policy.js';
import { getMarathonConfig, saveMarathonConfig, findMarathonById } from '../data/marathon.repo.js';
import { ValidationError }                       from '../../../shared/lib/ValidationError.js';

export async function handleGetAdminConfig(query) {
  const { marathonId } = query || {};
  if (!marathonId || isNaN(Number(marathonId))) throw new ValidationError(400, 'marathonId required');
  const config = await getMarathonConfig(Number(marathonId));
  return {
    httpStatus: 200,
    body: { ok: true, data: { marathonId: Number(marathonId), ...config } },
  };
}

export async function handleSaveAdminConfig(body) {
  const { marathonId, coachId, disciplineStartTime, disciplineEndTime } = validateSaveAdminConfig(body);

  const marathon = await findMarathonById(marathonId);
  if (!marathon) throw new ValidationError(404, 'Marathon not found');

  if (!canGenerateCard({ requestingCoachId: coachId, marathonCoachId: marathon.coach_id, role: 'coach' })) {
    throw new ValidationError(403, 'Not authorised to configure this marathon');
  }

  await saveMarathonConfig(marathonId, { disciplineStartTime, disciplineEndTime });

  return {
    httpStatus: 200,
    body: { ok: true, data: { marathonId, disciplineStartTime, disciplineEndTime } },
  };
}
