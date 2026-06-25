/**
 * setup.service.js — User feature: POST /api/user/skip-setup.
 *
 * Records a setup-skip and (optionally) saves a chosen coach. Preserves
 * response shape byte-identical to the legacy handler.
 */
import * as repo from './user.repository.js';

export async function skipSetup({ email, coachId }) {
  const user = await repo.findByEmail(email, 'UserId, SetupSkipped');
  if (!user) return { httpStatus: 404, body: { success: false, error: 'User not found' } };

  const updateData = { SetupSkipped: true };
  if (coachId) updateData.CoachId = coachId;
  await repo.updateUserByEmail(email, updateData);

  return {
    httpStatus: 200,
    body: { success: true, message: 'Setup skip recorded successfully', coachSaved: !!coachId },
  };
}
