import { getPrisma } from '../../../shared/lib/prisma.js';
import logger from '../../../shared/lib/logger.js';

let ensureEventsColumnsPromise = null;
let eventColumnsReady = false;

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
 * Additive Venue, StartTime, and EndTime columns — old Place (city) rows stay valid.
 * Read/written via raw SQL so a stale Prisma client without these columns still works.
 * Never throws: returns true when columns are usable.
 */
export async function ensureEventsColumns() {
  if (eventColumnsReady) return true;
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
        if (!(await columnExists(prisma, 'StartTime'))) {
          await prisma.$executeRawUnsafe(
            `ALTER TABLE events_table
             ADD COLUMN StartTime VARCHAR(20) NULL AFTER EventDate`,
          );
        }
        if (!(await columnExists(prisma, 'EndTime'))) {
          await prisma.$executeRawUnsafe(
            `ALTER TABLE events_table
             ADD COLUMN EndTime VARCHAR(20) NULL AFTER StartTime`,
          );
        }
        if (!(await columnExists(prisma, 'EventDates'))) {
          await prisma.$executeRawUnsafe(
            `ALTER TABLE events_table
             ADD COLUMN EventDates JSON NULL AFTER EndTime`,
          );
        }
        if (!(await columnExists(prisma, 'Places'))) {
          await prisma.$executeRawUnsafe(
            `ALTER TABLE events_table
             ADD COLUMN Places JSON NULL AFTER EventDates`,
          );
        }
        if (!(await columnExists(prisma, 'Speakers'))) {
          await prisma.$executeRawUnsafe(
            `ALTER TABLE events_table
             ADD COLUMN Speakers JSON NULL AFTER Places`,
          );
        }
        eventColumnsReady = true;
        return true;
      } catch (error) {
        ensureEventsColumnsPromise = null;
        logger.warn('events columns ensure failed', {
          message: error?.message || String(error),
        });
        return false;
      }
    })();
  }
  return ensureEventsColumnsPromise;
}

export const ensureEventsVenueColumn = ensureEventsColumns;

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

function parseEventDatesJson(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function parseSpeakersJson(value) {
  if (!value) return [];
  const list = Array.isArray(value)
    ? value
    : (typeof value === 'string'
      ? (() => {
        try {
          const parsed = JSON.parse(value);
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      })()
      : []);
  return list
    .map((item) => {
      if (typeof item === 'string') {
        const name = String(item).trim();
        return name ? { name, userId: null } : null;
      }
      const name = String(item?.name || '').trim();
      if (!name) return null;
      const userId = Number(item?.userId);
      return {
        name,
        userId: Number.isInteger(userId) && userId > 0 ? userId : null,
      };
    })
    .filter(Boolean);
}

function speakersFromHostName(hostName) {
  return String(hostName || '')
    .split(' · ')
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name) => ({ name, userId: null }));
}

function parsePlacesJson(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function toEvent(row, detailsById = null) {
  if (!row) return null;
  const place = row.Place;
  const id = row.Id;
  const details = detailsById?.get(id) || {};
  const venue = details.venue !== undefined
    ? details.venue
    : (row.Venue != null ? String(row.Venue || '').trim() || null : null);
  const places = Array.isArray(details.places) && details.places.length > 0
    ? details.places
    : (place ? [{ city: place, place, venue: venue || null }] : []);
  const startTime = details.startTime !== undefined
    ? details.startTime
    : (row.StartTime != null ? String(row.StartTime || '').trim() || null : null);
  const endTime = details.endTime !== undefined
    ? details.endTime
    : (row.EndTime != null ? String(row.EndTime || '').trim() || null : null);
  const eventDate = formatEventDate(row.EventDate);
  const eventDates = Array.isArray(details.eventDates) && details.eventDates.length > 0
    ? details.eventDates
    : (eventDate ? [{ date: eventDate, startTime, endTime }] : []);

  return {
    id,
    createdByUserId: Number(row.CreatedByUserId) || undefined,
    eventName: row.EventName,
    hostName: row.HostName,
    speakers: Array.isArray(details.speakers) && details.speakers.length > 0
      ? details.speakers
      : speakersFromHostName(row.HostName),
    place,
    city: place,
    venue,
    places,
    eventDate,
    startTime,
    endTime,
    eventDates,
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

function eventsDelegate(prisma) {
  const delegate = prisma?.events_table;
  if (!delegate) {
    const err = new Error('events_table is missing from the Prisma client. Run npm run prisma:generate in backend and restart the API.');
    err.code = 'P2021';
    throw err;
  }
  return delegate;
}

/** Load Venue, StartTime, EndTime, EventDates, Places values without going through Prisma model fields. */
async function loadEventDetailsByIds(ids) {
  const map = new Map();
  const list = (Array.isArray(ids) ? ids : [])
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0);
  if (list.length === 0) return map;
  const hasColumns = await ensureEventsColumns();
  if (!hasColumns) return map;
  try {
    const prisma = getPrisma();
    const placeholders = list.map(() => '?').join(', ');
    let rows;
    try {
      rows = await prisma.$queryRawUnsafe(
        `SELECT Id, Venue, StartTime, EndTime, EventDates, Places, Speakers FROM events_table WHERE Id IN (${placeholders})`,
        ...list,
      );
    } catch {
      try {
        rows = await prisma.$queryRawUnsafe(
          `SELECT Id, Venue, StartTime, EndTime, EventDates, Places FROM events_table WHERE Id IN (${placeholders})`,
          ...list,
        );
      } catch {
        rows = await prisma.$queryRawUnsafe(
          `SELECT Id, Venue, StartTime, EndTime, EventDates FROM events_table WHERE Id IN (${placeholders})`,
          ...list,
        );
      }
    }
    for (const row of rows || []) {
      const id = Number(row.Id);
      const venue = String(row.Venue || '').trim() || null;
      const startTime = String(row.StartTime || '').trim() || null;
      const endTime = String(row.EndTime || '').trim() || null;
      const eventDates = parseEventDatesJson(row.EventDates);
      const places = parsePlacesJson(row.Places);
      const speakers = parseSpeakersJson(row.Speakers);
      map.set(id, { venue, startTime, endTime, eventDates, places, speakers });
    }
  } catch (error) {
    logger.warn('events details load failed', { message: error?.message || String(error) });
  }
  return map;
}

async function saveEventDetails(id, { venue, startTime, endTime, eventDates, places, speakers } = {}) {
  const eventId = Number(id);
  if (!Number.isInteger(eventId) || eventId <= 0) return;
  if (
    venue === undefined
    && startTime === undefined
    && endTime === undefined
    && eventDates === undefined
    && places === undefined
    && speakers === undefined
  ) return;
  const hasColumns = await ensureEventsColumns();
  if (!hasColumns) return;
  try {
    const prisma = getPrisma();
    const updates = [];
    const params = [];
    if (venue !== undefined) {
      updates.push('Venue = ?');
      params.push(venue ? String(venue).trim() : null);
    }
    if (startTime !== undefined) {
      updates.push('StartTime = ?');
      params.push(startTime ? String(startTime).trim() : null);
    }
    if (endTime !== undefined) {
      updates.push('EndTime = ?');
      params.push(endTime ? String(endTime).trim() : null);
    }
    if (eventDates !== undefined) {
      updates.push('EventDates = ?');
      params.push(Array.isArray(eventDates) && eventDates.length > 0 ? JSON.stringify(eventDates) : null);
    }
    if (places !== undefined) {
      updates.push('Places = ?');
      params.push(Array.isArray(places) && places.length > 0 ? JSON.stringify(places) : null);
    }
    if (speakers !== undefined) {
      updates.push('Speakers = ?');
      params.push(Array.isArray(speakers) && speakers.length > 0 ? JSON.stringify(speakers) : null);
    }
    if (updates.length === 0) return;
    params.push(eventId);
    await prisma.$executeRawUnsafe(
      `UPDATE events_table SET ${updates.join(', ')} WHERE Id = ?`,
      ...params,
    );
  } catch (error) {
    logger.warn('events details save failed', {
      eventId,
      message: error?.message || String(error),
    });
  }
}

async function withEventDetails(rows) {
  const list = Array.isArray(rows) ? rows.filter(Boolean) : [];
  const detailsById = await loadEventDetailsByIds(list.map((row) => row.Id));
  return list.map((row) => toEvent(row, detailsById));
}

export async function listEventsByOwner(userId) {
  const prisma = getPrisma();
  const rows = await eventsDelegate(prisma).findMany({
    where: { CreatedByUserId: userId, IsDeleted: 0 },
    orderBy: { UpdatedAt: 'desc' },
  });
  return withEventDetails(rows);
}

export async function insertEvent(input) {
  const prisma = getPrisma();
  const row = await eventsDelegate(prisma).create({
    data: {
      CreatedByUserId: input.userId,
      Status: 'scheduled',
      IsDeleted: 0,
      ...fieldData(input),
    },
  });
  await saveEventDetails(row.Id, {
    venue: input.venue,
    startTime: input.startTime,
    endTime: input.endTime,
    eventDates: input.eventDates,
    places: input.places,
    speakers: input.speakers,
  });
  const [event] = await withEventDetails([row]);
  return event;
}

export async function findOwnedEvent(id, userId) {
  const prisma = getPrisma();
  const row = await eventsDelegate(prisma).findFirst({
    where: { Id: id, CreatedByUserId: userId, IsDeleted: 0 },
  });
  if (!row) return null;
  const [event] = await withEventDetails([row]);
  return event;
}

export async function findActiveEventById(id) {
  const prisma = getPrisma();
  const row = await prisma.events_table.findFirst({
    where: { Id: id, IsDeleted: 0 },
  });
  if (!row) return null;
  const [event] = await withEventDetails([row]);
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
    // Do not select additive raw SQL columns here so stale clients keep working.
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
  return withEventDetails(rows);
}

export async function updateOwnedEvent(id, userId, patch) {
  const prisma = getPrisma();
  const result = await eventsDelegate(prisma).updateMany({
    where: { Id: id, CreatedByUserId: userId, IsDeleted: 0 },
    data: fieldData(patch),
  });
  if (result.count !== 1) return null;
  if (
    patch.venue !== undefined
    || patch.startTime !== undefined
    || patch.endTime !== undefined
    || patch.eventDates !== undefined
    || patch.places !== undefined
    || patch.speakers !== undefined
  ) {
    await saveEventDetails(id, {
      venue: patch.venue,
      startTime: patch.startTime,
      endTime: patch.endTime,
      eventDates: patch.eventDates,
      places: patch.places,
      speakers: patch.speakers,
    });
  }
  return findOwnedEvent(id, userId);
}

export async function softDeleteOwnedEvent(id, userId) {
  const prisma = getPrisma();
  const result = await eventsDelegate(prisma).updateMany({
    where: { Id: id, CreatedByUserId: userId, IsDeleted: 0 },
    data: { IsDeleted: 1 },
  });
  return result.count === 1;
}