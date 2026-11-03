import { getPrisma } from '../../../shared/lib/prisma.js';

function toRegistration(row) {
  if (!row) return null;
  return {
    id: row.Id,
    eventId: row.EventId,
    registrantUserId: row.RegistrantUserId,
    translation: row.Translation,
    attendCity: row.PdAttendCity,
    foodType: row.FoodType,
    uplinePresidentTeam: {
      userId: row.UplinePresidentUserId,
      name: row.UplinePresidentName,
    },
    uplineMillTeam: {
      userId: row.UplineMillUserId,
      name: row.UplineMillName,
    },
    clubNo: row.ClubNo,
    zoomEmail: row.ZoomEmail,
    name: row.RegistrantName,
    idNo: row.IdNo,
    level: row.LevelName,
    phoneNumber: row.PhoneNumber,
    participantCount: row.ParticipantCount,
    ticketNo: row.TicketNo,
    yourCity: row.YourCity,
    teamIncharge: {
      userId: row.TeamInchargeUserId,
      name: row.TeamInchargeName,
    },
    daicyTeamIncharge: {
      userId: row.DaicyTeamInchargeUserId,
      name: row.DaicyTeamInchargeName,
      uplineLabel: row.DaicyTeamInchargeUpline || undefined,
    },
    createdAt: row.CreatedAt,
    updatedAt: row.UpdatedAt,
  };
}

export async function insertEventRegistration(input) {
  const prisma = getPrisma();
  const row = await prisma.event_registrations_table.create({
    data: {
      EventId: input.eventId,
      RegistrantUserId: input.userId,
      Translation: input.translation,
      PdAttendCity: input.attendCity,
      FoodType: input.foodType,
      UplinePresidentUserId: input.uplinePresidentTeam.userId,
      UplinePresidentName: input.uplinePresidentTeam.name,
      UplineMillUserId: input.uplineMillTeam.userId,
      UplineMillName: input.uplineMillTeam.name,
      ClubNo: input.clubNo,
      ZoomEmail: input.zoomEmail,
      RegistrantName: input.name,
      IdNo: input.idNo,
      LevelName: input.level,
      PhoneNumber: input.phoneNumber,
      ParticipantCount: input.participantCount,
      TicketNo: input.ticketNo,
      YourCity: input.yourCity,
      TeamInchargeUserId: input.teamIncharge.userId,
      TeamInchargeName: input.teamIncharge.name,
      DaicyTeamInchargeUserId: input.daicyTeamIncharge.userId,
      DaicyTeamInchargeName: input.daicyTeamIncharge.name,
      DaicyTeamInchargeUpline: input.daicyTeamIncharge.uplineLabel || null,
    },
  });
  return toRegistration(row);
}
