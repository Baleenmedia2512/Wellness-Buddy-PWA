import { ValidationError } from '../../shared/lib/ValidationError.js';
import {
  normalizeEventDraft,
  normalizeEventRegistrationDraft,
  normalizeEventStatus,
  parseEventId,
  parseEventUserId,
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
    || body?.eventDate != null
    || body?.date != null
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
  return { userId, ...draft.value };
}
