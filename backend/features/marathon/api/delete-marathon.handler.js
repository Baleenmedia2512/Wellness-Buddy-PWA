/**
 * delete-marathon.handler.js — Soft-deletes (cancels) a marathon LAP.
 */
import { ValidationError }            from '../../../shared/lib/ValidationError.js';
import { canGenerateCard }             from '../domain/permissions/marathon.policy.js';
import { findMarathonById }            from '../data/marathon.repo.js';
import { getSupabaseClient }           from '../../../utils/supabaseClient.js';
import logger                          from '../../../shared/lib/logger.js';

export async function handleDeleteMarathon(body) {
  const { marathonId, coachId } = body || {};
  if (!marathonId || isNaN(Number(marathonId))) throw new ValidationError(400, 'marathonId required');
  if (!coachId    || isNaN(Number(coachId)))    throw new ValidationError(400, 'coachId required');

  const marathon = await findMarathonById(Number(marathonId));
  if (!marathon) throw new ValidationError(404, 'Marathon not found');

  if (!canGenerateCard({ requestingCoachId: Number(coachId), marathonCoachId: marathon.coach_id, role: 'coach' })) {
    throw new ValidationError(403, 'Not authorised to delete this marathon');
  }

  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('marathon_table')
    .update({ status: 'cancelled' })
    .eq('id', Number(marathonId));
  if (error) throw error;

  logger.info('[handleDeleteMarathon] Marathon cancelled', { marathonId, coachId });
  return { httpStatus: 200, body: { ok: true } };
}
