import { getPrisma } from '../../../shared/lib/prisma.js';
import logger from '../../../shared/lib/logger.js';

let ensurePromise = null;

function money(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * 100) / 100;
}

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
    entryCode: row.EntryCode || null,
    paymentStatus: row.PaymentStatus || 'saved',
    amountCharged: money(row.AmountCharged),
    walletLedgerId: row.WalletLedgerId != null ? Number(row.WalletLedgerId) : null,
    checkedInAt: row.CheckedInAt || null,
    checkedInByUserId: row.CheckedInByUserId != null ? Number(row.CheckedInByUserId) : null,
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

async function columnExists(prisma, columnName) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*) AS c
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'event_registrations_table'
       AND COLUMN_NAME = ?`,
    columnName,
  );
  return Number(Array.isArray(rows) ? rows[0]?.c : 0) > 0;
}

async function indexExists(prisma, indexName) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*) AS c
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'event_registrations_table'
       AND INDEX_NAME = ?`,
    indexName,
  );
  return Number(Array.isArray(rows) ? rows[0]?.c : 0) > 0;
}

export async function ensureRegistrationPaymentColumns() {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      const prisma = getPrisma();
      if (!(await columnExists(prisma, 'EntryCode'))) {
        await prisma.$executeRawUnsafe(
          `ALTER TABLE event_registrations_table
           ADD COLUMN EntryCode VARCHAR(4) NULL AFTER TicketNo`,
        );
      }
      if (!(await columnExists(prisma, 'PaymentStatus'))) {
        await prisma.$executeRawUnsafe(
          `ALTER TABLE event_registrations_table
           ADD COLUMN PaymentStatus VARCHAR(20) NOT NULL DEFAULT 'saved' AFTER EntryCode`,
        );
      }
      if (!(await columnExists(prisma, 'AmountCharged'))) {
        await prisma.$executeRawUnsafe(
          `ALTER TABLE event_registrations_table
           ADD COLUMN AmountCharged DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER PaymentStatus`,
        );
      }
      if (!(await columnExists(prisma, 'WalletLedgerId'))) {
        await prisma.$executeRawUnsafe(
          `ALTER TABLE event_registrations_table
           ADD COLUMN WalletLedgerId BIGINT NULL AFTER AmountCharged`,
        );
      }
      if (!(await columnExists(prisma, 'CheckedInAt'))) {
        await prisma.$executeRawUnsafe(
          `ALTER TABLE event_registrations_table
           ADD COLUMN CheckedInAt DATETIME NULL AFTER WalletLedgerId`,
        );
      }
      if (!(await columnExists(prisma, 'CheckedInByUserId'))) {
        await prisma.$executeRawUnsafe(
          `ALTER TABLE event_registrations_table
           ADD COLUMN CheckedInByUserId INT NULL AFTER CheckedInAt`,
        );
      }
      if (!(await indexExists(prisma, 'uq_event_reg_event_entry'))) {
        try {
          await prisma.$executeRawUnsafe(
            `CREATE UNIQUE INDEX uq_event_reg_event_entry
             ON event_registrations_table (EventId, EntryCode)`,
          );
        } catch (error) {
          logger.warn('event registration entry-code unique index skipped', {
            message: error?.message || String(error),
          });
        }
      }
    })().catch((error) => {
      ensurePromise = null;
      throw error;
    });
  }
  return ensurePromise;
}

function formData(input) {
  return {
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
  };
}

/** Legacy save-only insert (no wallet debit, no entry code). */
export async function insertEventRegistration(input) {
  await ensureRegistrationPaymentColumns();
  const prisma = getPrisma();
  const row = await prisma.event_registrations_table.create({
    data: {
      ...formData(input),
      PaymentStatus: 'saved',
      AmountCharged: 0,
    },
  });
  return toRegistration(row);
}

export async function findRegistrationByEventAndUser(eventId, userId) {
  await ensureRegistrationPaymentColumns();
  const prisma = getPrisma();
  const row = await prisma.event_registrations_table.findFirst({
    where: {
      EventId: Number(eventId),
      RegistrantUserId: Number(userId),
    },
    orderBy: { Id: 'desc' },
  });
  return toRegistration(row);
}

export async function countSeatsTaken(eventId) {
  const map = await countSeatsTakenByEventIds([eventId]);
  return map.get(Number(eventId)) || 0;
}

/** Batch seat usage for open-event list (one query). */
export async function countSeatsTakenByEventIds(eventIds) {
  await ensureRegistrationPaymentColumns();
  const ids = [...new Set((eventIds || []).map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))];
  const map = new Map();
  if (ids.length === 0) return map;

  const prisma = getPrisma();
  const rows = await prisma.event_registrations_table.findMany({
    where: {
      EventId: { in: ids },
      OR: [
        { PaymentStatus: 'paid' },
        { PaymentStatus: 'saved' },
        { EntryCode: { not: null } },
      ],
    },
    select: { EventId: true, ParticipantCount: true },
  });
  for (const row of rows) {
    const id = Number(row.EventId);
    map.set(id, (map.get(id) || 0) + (Number(row.ParticipantCount) || 0));
  }
  return map;
}

export async function listEntryCodesForEvent(eventId) {
  await ensureRegistrationPaymentColumns();
  const prisma = getPrisma();
  const rows = await prisma.event_registrations_table.findMany({
    where: {
      EventId: Number(eventId),
      EntryCode: { not: null },
    },
    select: { EntryCode: true },
  });
  return new Set(rows.map((row) => String(row.EntryCode || '')).filter(Boolean));
}

/**
 * Insert a paid registration. Caller must have already debited the wallet when amount > 0.
 */
export async function insertPaidEventRegistration(input, { entryCode, amountCharged, walletLedgerId }) {
  await ensureRegistrationPaymentColumns();
  const prisma = getPrisma();
  const row = await prisma.event_registrations_table.create({
    data: {
      ...formData(input),
      EntryCode: entryCode,
      PaymentStatus: 'paid',
      AmountCharged: Number(amountCharged).toFixed(2),
      WalletLedgerId: walletLedgerId != null ? BigInt(walletLedgerId) : null,
    },
  });
  return toRegistration(row);
}

export async function listRegistrationsByUser(userId) {
  await ensureRegistrationPaymentColumns();
  const prisma = getPrisma();
  const rows = await prisma.event_registrations_table.findMany({
    where: { RegistrantUserId: Number(userId) },
    orderBy: { CreatedAt: 'desc' },
  });
  return rows.map(toRegistration);
}

export async function findRegistrationByIdForUser(id, userId) {
  await ensureRegistrationPaymentColumns();
  const prisma = getPrisma();
  const row = await prisma.event_registrations_table.findFirst({
    where: {
      Id: Number(id),
      RegistrantUserId: Number(userId),
    },
  });
  return toRegistration(row);
}

export async function findRegistrationByEventAndEntryCode(eventId, entryCode) {
  await ensureRegistrationPaymentColumns();
  const prisma = getPrisma();
  const row = await prisma.event_registrations_table.findFirst({
    where: {
      EventId: Number(eventId),
      EntryCode: String(entryCode),
    },
  });
  return toRegistration(row);
}

export async function markRegistrationCheckedIn(id, checkedInByUserId) {
  await ensureRegistrationPaymentColumns();
  const prisma = getPrisma();
  await prisma.event_registrations_table.update({
    where: { Id: Number(id) },
    data: {
      CheckedInAt: new Date(),
      CheckedInByUserId: Number(checkedInByUserId),
    },
  });
  const row = await prisma.event_registrations_table.findFirst({
    where: { Id: Number(id) },
  });
  return toRegistration(row);
}
