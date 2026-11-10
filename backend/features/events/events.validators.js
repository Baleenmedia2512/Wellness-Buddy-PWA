import { ValidationError } from '../../shared/lib/ValidationError.js';
import {
  normalizeEventDraft,
  normalizeEventRegistrationDraft,
  normalizeEventStatus,
  parseEntryCode,
  parseEventId,
  parseEventUserId,
  parseRegistrationQrPayload,
  sanitizeEventPeopleQuery,
} from './domain/event.rules.js';

function requireOwner(raw) {
  const userId = parseEventUserId(raw?.userId);
  if (!userId) throw new ValidationError(400, 'A signed-in user is required.');
  return userId;
}

export function validateListEvents(query) {
  return { userId: requireOwner(query) };
}

export function validateCreateEvent(body) {
  const userId = requireOwner(body);
  const draft = normalizeEventDraft(body);
  if (!draft.ok) throw new ValidationError(400, draft.errors.join(' '));
  return { userId, ...draft.value };
}

export function validateUpdateEvent(body) {
  const userId = requireOwner(body);
  const id = parseEventId(body?.id);
  if (!id) throw new ValidationError(400, 'Event id is required.');

  const hasFields = body?.eventName != null
    || body?.hostName != null
    || body?.host != null
    || body?.place != null
    || body?.places != null
    || body?.venue != null
    || body?.eventDate != null
    || body?.eventDates != null
    || body?.date != null
    || body?.startTime != null
    || body?.endTime != null
    || body?.ticketPrice != null
    || body?.seatCount != null
    || body?.designatedPersons != null;
  const hasStatus = body?.status != null && String(body.status).trim() !== '';

  if (!hasFields && !hasStatus) {
    throw new ValidationError(400, 'Nothing to update.');
  }

  const next = { userId, id };
  if (hasFields) {
    const draft = normalizeEventDraft(body);
    if (!draft.ok) throw new ValidationError(400, draft.errors.join(' '));
    Object.assign(next, draft.value);
  }
  if (hasStatus) {
    const status = normalizeEventStatus(body.status);
    if (!status) throw new ValidationError(400, 'Status must be scheduled, postponed, or cancelled.');
    next.status = status;
  }
  return next;
}

export function validateDeleteEvent(body) {
  const userId = requireOwner(body);
  const id = parseEventId(body?.id);
  if (!id) throw new ValidationError(400, 'Event id is required.');
  return { userId, id };
}

export function validateSearchEventPeople(query) {
  return {
    userId: requireOwner(query),
    q: sanitizeEventPeopleQuery(query?.q),
  };
}

export function validateCreateEventRegistration(body) {
  const userId = requireOwner(body);
  const draft = normalizeEventRegistrationDraft(body);
  if (!draft.ok) throw new ValidationError(400, draft.errors.join(' '));
  const confirmPayment = body?.confirmPayment === true
    || body?.confirmPayment === 1
    || String(body?.confirmPayment || '').toLowerCase() === 'true';
  return { userId, confirmPayment, ...draft.value };
}

export function validateListOpenEvents(query) {
  return { userId: requireOwner(query) };
}

export function validateListMyRegistrations(query) {
  return { userId: requireOwner(query) };
}

export function validateGetMyRegistration(query) {
  const userId = requireOwner(query);
  const id = parseEventId(query?.id);
  if (!id) throw new ValidationError(400, 'Registration id is required.');
  return { userId, id };
}

export function validateEventCheckIn(body) {
  const userId = requireOwner(body);
  // Selected check-in event is authoritative. QR may supply the code, but its event must match.
  const selectedEventId = parseEventId(body?.eventId);
  const fromQr = body?.qrPayload != null ? parseRegistrationQrPayload(body.qrPayload) : null;
  if (fromQr && selectedEventId && fromQr.eventId !== selectedEventId) {
    throw new ValidationError(400, 'This QR belongs to a different event.');
  }
  const eventId = selectedEventId || fromQr?.eventId;
  const entryCode = fromQr?.entryCode || parseEntryCode(body?.entryCode);
  if (!eventId) throw new ValidationError(400, 'Event id is required.');
  if (!entryCode) throw new ValidationError(400, 'Entry code is required.');
  // Additive: missing/unknown type → entry (legacy clients unchanged).
  const checkInType = String(body?.checkInType || 'entry').trim().toLowerCase() === 'food'
    ? 'food'
    : 'entry';
  return {
    userId,
    eventId,
    entryCode,
    checkInType,
    markCheckedIn: body?.markCheckedIn !== false,
  };
}

/** Entry-pass Report only — same event/code rules as check-in; never verifies. */
export function validateEventCheckInReport(body) {
  const base = validateEventCheckIn({
    ...body,
    checkInType: 'entry',
    markCheckedIn: false,
  });
  return {
    userId: base.userId,
    eventId: base.eventId,
    entryCode: base.entryCode,
  };
}
