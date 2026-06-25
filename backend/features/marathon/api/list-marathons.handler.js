/**
 * list-marathons.handler.js — Returns a coach's marathon list.
 */
import { validateListMarathons }       from '../validation/marathon.schema.js';
import { canManageMarathon }           from '../domain/permissions/marathon.policy.js';
import { listMarathonsByCoach }        from '../data/marathon.repo.js';
import { ValidationError }             from '../../../shared/lib/ValidationError.js';

/**
 * @param {object} query - { coachId, status? }
 * @returns {{ httpStatus: number, body: object }}
 */
export async function handleListMarathons(query) {
  const { coachId, status } = validateListMarathons(query);

  if (!canManageMarathon({ role: 'coach' })) {
    throw new ValidationError(403, 'Not authorised');
  }

  const marathons = await listMarathonsByCoach(coachId, status);

  return {
    httpStatus: 200,
    body: { ok: true, data: marathons },
  };
}
