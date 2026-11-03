import * as repo from './data/events.repo.js';
import { searchActivePeople } from './data/people.repo.js';
import {
  countSeatsTaken,
  countSeatsTakenByEventIds,
  findRegistrationByEventAndEntryCode,
  findRegistrationByEventAndUser,
  findRegistrationByIdForUser,
  insertEventRegistration,
  insertPaidEventRegistration,
  listEntryCodesForEvent,
  listRegistrationsByUser,
  markRegistrationCheckedIn,
} from './data/registrations.repo.js';
import {
  buildRegistrationQrPayload,
  canScanEventRegistrations,
  computeRegistrationCharge,
  generateEntryCode,
} from './domain/event.rules.js';
import { debitForEventTicket } from '../wallet/data/wallet.repo.js';

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

function withEventSummary(registration, event) {
  if (!registration) return null;
  return {
    ...registration,
    qrPayload: registration.entryCode
      ? buildRegistrationQrPayload(registration.eventId, registration.entryCode)
      : null,
    event: event
      ? {
          id: event.id,
          eventName: event.eventName,
          hostName: event.hostName,
          place: event.place,
          eventDate: event.eventDate,
          ticketPrice: event.ticketPrice,
          status: event.status,
        }
      : undefined,
  };
}

export function listEvents(input) {
  return run(async () => {
    const events = await repo.listEventsByOwner(input.userId);
    return { httpStatus: 200, body: { success: true, events } };
  });
}

export function listOpenEvents() {
  return run(async () => {
    const events = await repo.listOpenEvents();
    const takenMap = await countSeatsTakenByEventIds(events.map((event) => event.id));
    const withSeats = events.map((event) => {
      const seatCount = Number(event.seatCount) || 0;
      const seatsTaken = takenMap.get(Number(event.id)) || 0;
      const seatsLeft = seatCount > 0 ? Math.max(0, seatCount - seatsTaken) : null;
      const soldOut = seatCount > 0 && seatsTaken >= seatCount;
      return {
        ...event,
        seatsTaken,
        seatsLeft,
        soldOut,
      };
    });
    return { httpStatus: 200, body: { success: true, events: withSeats } };
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

/**
 * Legacy: confirmPayment absent/false → insert only (no wallet debit).
 * New UI: confirmPayment true → debit wallet, issue EntryCode + QR payload.
 *
 * Legacy removal: after no supported client needs save-only POST and app version
 * policy no longer allows that path.
 */
export function createEventRegistration(input) {
  return run(async () => {
    const event = await repo.findActiveEventById(input.eventId);
    if (!event) {
      return { httpStatus: 404, body: { success: false, message: 'Event not found.' } };
    }
    if (String(event.status || '').toLowerCase() === 'cancelled') {
      return { httpStatus: 400, body: { success: false, message: 'This event is cancelled.' } };
    }

    if (!input.confirmPayment) {
      const registration = await insertEventRegistration(input);
      return { httpStatus: 201, body: { success: true, registration } };
    }

    const existing = await findRegistrationByEventAndUser(input.eventId, input.userId);
    if (existing && (existing.paymentStatus === 'paid' || existing.entryCode)) {
      return {
        httpStatus: 409,
        body: { success: false, message: 'You are already registered for this event.' },
      };
    }

    const seatsTaken = await countSeatsTaken(input.eventId);
    const nextSeats = seatsTaken + Number(input.participantCount || 1);
    if (Number(event.seatCount) > 0 && nextSeats > Number(event.seatCount)) {
      return {
        httpStatus: 409,
        body: { success: false, message: 'No seats left for this event.' },
      };
    }

    const amountCharged = computeRegistrationCharge(event.ticketPrice, input.participantCount);
    if (amountCharged == null) {
      return { httpStatus: 400, body: { success: false, message: 'Invalid ticket price.' } };
    }

    const usedCodes = await listEntryCodesForEvent(input.eventId);
    const entryCode = generateEntryCode(usedCodes);
    if (!entryCode) {
      return {
        httpStatus: 503,
        body: { success: false, message: 'Could not allocate an entry code. Please try again.' },
      };
    }

    let debit;
    try {
      debit = await debitForEventTicket({
        userId: input.userId,
        amount: amountCharged,
        eventId: input.eventId,
      });
    } catch (error) {
      if (String(error?.message) === 'WALLET_INSUFFICIENT_BALANCE') {
        return {
          httpStatus: 402,
          body: {
            success: false,
            code: 'INSUFFICIENT_WALLET_BALANCE',
            message: 'Insufficient wallet balance. Add cash to your wallet and try again.',
            amountRequired: amountCharged,
          },
        };
      }
      throw error;
    }

    let registration;
    try {
      registration = await insertPaidEventRegistration(input, {
        entryCode,
        amountCharged,
        walletLedgerId: debit.ledgerId,
      });
    } catch (error) {
      // Best-effort note: debit already happened. Prefer unique-conflict messaging.
      const message = String(error?.message || '');
      if (error?.code === 'P2002' || message.includes('Duplicate')) {
        return {
          httpStatus: 409,
          body: { success: false, message: 'You are already registered for this event.' },
        };
      }
      throw error;
    }

    return {
      httpStatus: 201,
      body: {
        success: true,
        message: 'Successfully Submitted',
        registration: withEventSummary(registration, event),
        balanceAfter: debit.balance,
      },
    };
  });
}

export function listMyEventRegistrations(input) {
  return run(async () => {
    const rows = await listRegistrationsByUser(input.userId);
    const eventsById = new Map();
    const registrations = [];
    for (const row of rows) {
      if (!eventsById.has(row.eventId)) {
        eventsById.set(row.eventId, await repo.findActiveEventById(row.eventId));
      }
      registrations.push(withEventSummary(row, eventsById.get(row.eventId)));
    }
    return { httpStatus: 200, body: { success: true, registrations } };
  });
}

export function getMyEventRegistration(input) {
  return run(async () => {
    const registration = await findRegistrationByIdForUser(input.id, input.userId);
    if (!registration) {
      return { httpStatus: 404, body: { success: false, message: 'Booking not found.' } };
    }
    const event = await repo.findActiveEventById(registration.eventId);
    return {
      httpStatus: 200,
      body: { success: true, registration: withEventSummary(registration, event) },
    };
  });
}

export function checkInEventRegistration(input) {
  return run(async () => {
    const event = await repo.findActiveEventById(input.eventId);
    if (!event) {
      return { httpStatus: 404, body: { success: false, message: 'Event not found.' } };
    }
    if (!canScanEventRegistrations(event, input.userId)) {
      return {
        httpStatus: 403,
        body: { success: false, message: 'Only the event creator or designated persons can check in guests.' },
      };
    }

    let registration = await findRegistrationByEventAndEntryCode(input.eventId, input.entryCode);
    if (!registration) {
      return { httpStatus: 404, body: { success: false, message: 'No registration found for this code.' } };
    }

    if (input.markCheckedIn && !registration.checkedInAt) {
      registration = await markRegistrationCheckedIn(registration.id, input.userId);
    }

    return {
      httpStatus: 200,
      body: {
        success: true,
        registration: withEventSummary(registration, event),
        photoUserId: registration.registrantUserId,
      },
    };
  });
}
