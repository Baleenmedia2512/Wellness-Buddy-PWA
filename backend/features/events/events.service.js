import * as repo from './data/events.repo.js';
import { searchActivePeople } from './data/people.repo.js';
import { insertEventRegistration } from './data/registrations.repo.js';

const STORAGE_MESSAGE = 'Events storage is not ready. Run backend/migrations/create_events_table.sql, then npm run prisma:generate in backend, and restart the API.';
const REGISTRATION_STORAGE_MESSAGE = 'Event registration storage is not ready. Run backend/migrations/create_event_registrations_table.sql, then npm run prisma:generate in backend, and restart the API.';

function storageFailure(err) {
  const message = String(err?.message || '');
  const missingRegistration = err?.code === 'P2021'
    || message.includes('event_registrations_table')
    || message.includes('event_registrations');
  if (missingRegistration) {
    return {
      httpStatus: 503,
      body: { success: false, message: REGISTRATION_STORAGE_MESSAGE },
    };
  }
  const missingTable = err?.code === 'P2021'
    || message.includes('events_table')
    || message.includes('does not exist')
    || message.includes('datamodel');
  if (!missingTable) return null;
  return {
    httpStatus: 503,
    body: { success: false, message: STORAGE_MESSAGE },
  };
}

async function run(fn) {
  try {
    return await fn();
  } catch (err) {
    const mapped = storageFailure(err);
    if (mapped) return mapped;
    throw err;
  }
}

export function listEvents(input) {
  return run(async () => {
    const events = await repo.listEventsByOwner(input.userId);
    return { httpStatus: 200, body: { success: true, events } };
  });
}

export function createEvent(input) {
  return run(async () => {
    const event = await repo.insertEvent(input);
    return { httpStatus: 201, body: { success: true, event } };
  });
}

export function updateEvent(input) {
  return run(async () => {
    const event = await repo.updateOwnedEvent(input.id, input.userId, input);
    if (!event) {
      return { httpStatus: 404, body: { success: false, message: 'Event not found.' } };
    }
    return { httpStatus: 200, body: { success: true, event } };
  });
}

export function deleteEvent(input) {
  return run(async () => {
    const removed = await repo.softDeleteOwnedEvent(input.id, input.userId);
    if (!removed) {
      return { httpStatus: 404, body: { success: false, message: 'Event not found.' } };
    }
    return { httpStatus: 200, body: { success: true } };
  });
}

export async function searchEventPeople(input) {
  const people = await searchActivePeople(input.q);
  return { httpStatus: 200, body: { success: true, people } };
}

export function createEventRegistration(input) {
  return run(async () => {
    const event = await repo.findActiveEventById(input.eventId);
    if (!event) {
      return { httpStatus: 404, body: { success: false, message: 'Event not found.' } };
    }
    const registration = await insertEventRegistration(input);
    return { httpStatus: 201, body: { success: true, registration } };
  });
}
