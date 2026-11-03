import { getPrisma } from '../../../shared/lib/prisma.js';

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

function toEvent(row) {
  if (!row) return null;
  return {
    id: row.Id,
    createdByUserId: Number(row.CreatedByUserId) || undefined,
    eventName: row.EventName,
    hostName: row.HostName,
    place: row.Place,
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

export async function listEventsByOwner(userId) {
  const prisma = getPrisma();
  const rows = await prisma.events_table.findMany({
    where: { CreatedByUserId: userId, IsDeleted: 0 },
    orderBy: { UpdatedAt: 'desc' },
  });
  return rows.map(toEvent);
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
  return toEvent(row);
}

export async function findOwnedEvent(id, userId) {
  const prisma = getPrisma();
  const row = await prisma.events_table.findFirst({
    where: { Id: id, CreatedByUserId: userId, IsDeleted: 0 },
  });
  return toEvent(row);
}

export async function findActiveEventById(id) {
  const prisma = getPrisma();
  const row = await prisma.events_table.findFirst({
    where: { Id: id, IsDeleted: 0 },
  });
  return toEvent(row);
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
  return rows.map(toEvent);
}

export async function updateOwnedEvent(id, userId, patch) {
  const prisma = getPrisma();
  const result = await prisma.events_table.updateMany({
    where: { Id: id, CreatedByUserId: userId, IsDeleted: 0 },
    data: fieldData(patch),
  });
  if (result.count !== 1) return null;
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
