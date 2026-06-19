/**
 * my-laps.handler.js — Returns all active LAPs for a member with live per-lap data.
 */
import { validateGetMyLaps }             from '../validation/marathon.schema.js';
import { listActiveMarathonsForUser, computeCardData } from '../data/marathon.repo.js';

export async function handleGetMyLaps(query) {
  const { userId } = validateGetMyLaps(query);

  const marathons = await listActiveMarathonsForUser(userId);
  if (!marathons.length) {
    return { httpStatus: 200, body: { ok: true, data: [] } };
  }

  // Load live participant data for each LAP in parallel
  const lapsWithData = await Promise.all(
    marathons.map(async marathon => {
      try {
        const cardData = await computeCardData(marathon.id, 'team');
        return {
          marathonId:    marathon.id,
          marathonName:  cardData.marathonName,
          lapRole:       marathon.lapRole,
          lapNumber:     cardData.lapNumber,
          dayNumber:     cardData.dayNumber,
          participants:  cardData.participants,
          teamDailyTotal: cardData.teamDailyTotal,
          disciplineConfig: cardData.disciplineConfig,
        };
      } catch {
        return {
          marathonId:   marathon.id,
          marathonName: marathon.team_name ? `${marathon.team_name} - LAP ${marathon.lap_sequence}` : marathon.name,
          lapRole:      marathon.lapRole,
          lapNumber:    null,
          dayNumber:    null,
          participants: [],
          error:        'Failed to load live data',
        };
      }
    }),
  );

  return {
    httpStatus: 200,
    body: { ok: true, data: lapsWithData },
  };
}
