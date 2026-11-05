import { getPrisma } from '../../../shared/lib/prisma.js';
import logger from '../../../shared/lib/logger.js';

let ensureEventsColumnsPromise = null;
let venueColumnReady = false;

async function columnExists(prisma, columnName) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*) AS c
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'events_table'
       AND COLUMN_NAME = ?`,
    columnName,
  );
  return Number(Array.isArray(rows) ? rows[0]?.c : 0) > 0;
}

/**
 * Additive Venue column — old Place (city) rows stay valid.
 * Venue is read/written via raw SQL so a stale Prisma client without Venue still works.
 * Never throws: returns true when Venue is usable.
 */
export async function ensureEventsVenueColumn() {
  if (venueColumnReady) return true;
  if (!ensureEventsColumnsPromise) {
    ensureEventsColumnsPromise = (async () => {
      try {
        const prisma = getPrisma();
        if (!(await columnExists(prisma, 'Venue'))) {
          await prisma.$executeRawUnsafe(
            `ALTER TABLE events_table
             ADD COLUMN Venue VARCHAR(300) NULL AFTER Place`,
          );
        }
        venueColumnReady = true;
        return true;
      } catch (error) {
        ensureEventsColumnsPromise = null;
        logger.warn('events venue column ensure failed', {
          message: error?.message || String(error),
        });
        return false;
      }
    })();
  }
  return ensureEventsColumnsPromise;
}

function formatEventDate(value) {
  if (!value) return '';
  if (typeof value === 'string') return value.slice(0, 10);
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, '0');
  const day = String(value.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function money(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * 100) / 100;
}

function people(value) {
  const list = Array.isArray(value) ? value : [];
  return list
    .map((item) => ({
      userId: Number(item?.userId),
      name: String(item?.name || '').trim(),
    }))
    .filter((item) => Number.isInteger(item.userId) && item.userId > 0 && item.name);
}

function toEvent(row, venueById = null) {
  if (!row) return null;
  const place = row.Place;
  const id = row.Id;
  let venue = null;
  if (venueById && venueById.has(id)) {
    venue = venueById.get(id);
  } else if (row.Venue != null) {
    venue = String(row.Venue || '').trim() || null;
  }
  return {
    id,
    createdByUserId: Number(row.CreatedByUserId) || undefined,
    eventName: row.EventName,
    hostName: row.HostName,
    place,
    // Additive aliases for check-in / create UI — place stays for older clients.
    city: place,
    venue,
    eventDate: formatEventDate(row.EventDate),
    ticketPrice: money(row.TicketPrice),
    seatCount: row.SeatCount,
    designatedPersons: people(row.DesignatedPersons),
    status: row.Status,
    createdAt: row.CreatedAt,
    updatedAt: row.UpdatedAt,
  };
}

function fieldData(patch) {
  const data = {};
  if (patch.eventName != null) data.EventName = patch.eventName;
  if (patch.hostName != null) data.HostName = patch.hostName;
  if (patch.place != null) data.Place = patch.place;
  if (patch.eventDate != null) data.EventDate = new Date(`${patch.eventDate}T00:00:00.000Z`);
  if (patch.ticketPrice != null) data.TicketPrice = patch.ticketPrice.toFixed(2);
  if (patch.seatCount != null) data.SeatCount = patch.seatCount;
  if (patch.designatedPersons != null) data.DesignatedPersons = patch.designatedPersons;
  if (patch.status != null) data.Status = patch.status;
  return data;
}

/** Load Venue values without going through Prisma model fields. */
async function loadVenuesByIds(ids) {
  const map = new Map();
  const list = (Array.isArray(ids) ? ids : [])
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0);
  if (list.length === 0) return map;
  const hasVenue = await ensureEventsVenueColumn();
  if (!hasVenue) return map;
  try {
    const prisma = getPrisma();
    const placeholders = list.map(() => '?').join(', ');
    const rows = await prisma.$queryRawUnsafe(
      `SELECT Id, Venue FROM events_table WHERE Id IN (${placeholders})`,
      ...list,
    );
    for (const row of rows || []) {
      const id = Number(row.Id);
      const venue = String(row.Venue || '').trim() || null;
      map.set(id, venue);
    }
  } catch (error) {
    logger.warn('events venue load failed', { message: error?.message || String(error) });
  }
  return map;
}

async function saveVenueForEvent(id, venue) {
  const eventId = Number(id);
  if (!Number.isInteger(eventId) || eventId <= 0) return;
  if (venue === undefined) return;
  const hasVenue = await ensureEventsVenueColumn();
  if (!hasVenue) return;
  try {
    const prisma = getPrisma();
    const value = venue ? String(venue).trim() : null;
    await prisma.$executeRawUnsafe(
      `UPDATE events_table SET Venue = ? WHERE Id = ?`,
      value,
      eventId,
    );
  } catch (error) {
    logger.warn('events venue save failed', {
      eventId,
      message: error?.message || String(error),
    });
  }
}

async function withVenues(rows) {
  const list = Array.isArray(rows) ? rows.filter(Boolean) : [];
  const venueById = await loadVenuesByIds(list.map((row) => row.Id));
  return list.map((row) => toEvent(row, venueById));
}

export async function listEventsByOwner(userId) {
  const prisma = getPrisma();
  const rows = await prisma.events_table.findMany({
    where: { CreatedByUserId: userId, IsDeleted: 0 },
    orderBy: { UpdatedAt: 'desc' },
  });
  return withVenues(rows);
}

export async function insertEvent(input) {
  const prisma = getPrisma();
  const row = await prisma.events_table.create({
    data: {
      CreatedByUserId: input.userId,
      Status: 'scheduled',
      IsDeleted: 0,
      ...fieldData(input),
    },
  });
  await saveVenueForEvent(row.Id, input.venue);
  const [event] = await withVenues([row]);
  return event;
}

export async function findOwnedEvent(id, userId) {
  const prisma = getPrisma();
  const row = await prisma.events_table.findFirst({
    where: { Id: id, CreatedByUserId: userId, IsDeleted: 0 },
  });
  if (!row) return null;
  const [event] = await withVenues([row]);
  return event;
}

export async function findActiveEventById(id) {
  const prisma = getPrisma();
  const row = await prisma.events_table.findFirst({
    where: { Id: id, IsDeleted: 0 },
  });
  if (!row) return null;
  const [event] = await withVenues([row]);
  return event;
}

/** Registrable events for Wellness Events list (not owner-scoped). */
export async function listOpenEvents() {
  const prisma = getPrisma();
  const rows = await prisma.events_table.findMany({
    where: {
      IsDeleted: 0,
      Status: { in: ['scheduled', 'postponed'] },
    },
    // Only fields the list/register UI needs — keeps open-list fast.
    // Do not select Venue here — Prisma client may be stale; venue loaded via raw SQL.
    select: {
      Id: true,
      CreatedByUserId: true,
      EventName: true,
      HostName: true,
      Place: true,
      EventDate: true,
      TicketPrice: true,
      SeatCount: true,
      DesignatedPersons: true,
      Status: true,
      CreatedAt: true,
      UpdatedAt: true,
    },
    orderBy: [{ EventDate: 'asc' }, { UpdatedAt: 'desc' }],
  });
  return withVenues(rows);
}

export async function updateOwnedEvent(id, userId, patch) {
  const prisma = getPrisma();
  const result = await prisma.events_table.updateMany({
    where: { Id: id, CreatedByUserId: userId, IsDeleted: 0 },
    data: fieldData(patch),
  });
  if (result.count !== 1) return null;
  if (patch.venue !== undefined) {
    await saveVenueForEvent(id, patch.venue);
  }
  return findOwnedEvent(id, userId);
}

export async function softDeleteOwnedEvent(id, userId) {
  const prisma = getPrisma();
  const result = await prisma.events_table.updateMany({
    where: { Id: id, CreatedByUserId: userId, IsDeleted: 0 },
    data: { IsDeleted: 1 },
  });
  return result.count === 1;
}
