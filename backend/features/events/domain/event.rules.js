/**
 * Create Event field and status rules. No I/O.
 * Statuses: scheduled (live), postponed, cancelled.
 */

export const EVENT_STATUSES = Object.freeze(['scheduled', 'postponed', 'cancelled']);

const NAME_MAX = 200;
const PLACE_MAX = 300;
const SEAT_MAX = 100000;
const PRICE_MAX = 1000000;
const PERSON_MAX = 30;

export function parseEventUserId(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

export function parseEventId(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

function cleanText(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

function parseEventDate(raw) {
  const text = String(raw ?? '').trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    return null;
  }
  return text;
}

function parseTicketPrice(raw) {
  const text = String(raw ?? '').trim().replace(/[₹,\s]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
  const amount = Math.round(Number(text) * 100) / 100;
  if (!Number.isFinite(amount) || amount < 0 || amount > PRICE_MAX) return null;
  return amount;
}

function parseSeatCount(raw) {
  const count = typeof raw === 'number' ? raw : Number(String(raw ?? '').trim());
  if (!Number.isInteger(count) || count < 1 || count > SEAT_MAX) return null;
  return count;
}

function parseDesignatedPersons(raw) {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { error: 'Select at least one designated person.' };
  }
  if (raw.length > PERSON_MAX) {
    return { error: `Select at most ${PERSON_MAX} designated persons.` };
  }
  const seen = new Set();
  const people = [];
  for (const item of raw) {
    const userId = parseEventUserId(item?.userId);
    const name = cleanText(item?.name ?? item?.userName);
    if (!userId || !name || name.length > NAME_MAX) {
      return { error: 'Each designated person needs a name and account.' };
    }
    if (seen.has(userId)) continue;
    seen.add(userId);
    people.push({ userId, name });
  }
  if (people.length === 0) return { error: 'Select at least one designated person.' };
  return { people };
}

/**
 * @param {unknown} raw
 * @returns {{ ok: true, value: object } | { ok: false, errors: string[] }}
 */
export function normalizeEventDraft(raw) {
  const input = raw && typeof raw === 'object' ? raw : {};
  const eventName = cleanText(input.eventName);
  const hostName = cleanText(input.hostName ?? input.host);
  const place = cleanText(input.place);
  const eventDate = parseEventDate(input.eventDate ?? input.date);
  const ticketPrice = parseTicketPrice(input.ticketPrice);
  const seatCount = parseSeatCount(input.seatCount);
  const persons = parseDesignatedPersons(input.designatedPersons);
  const errors = [];

  if (!eventName) errors.push('Event name is required.');
  else if (eventName.length > NAME_MAX) errors.push(`Event name must be ${NAME_MAX} characters or fewer.`);

  if (!hostName) errors.push('Host is required.');
  else if (hostName.length > NAME_MAX) errors.push(`Host must be ${NAME_MAX} characters or fewer.`);

  if (!place) errors.push('Place is required.');
  else if (place.length > PLACE_MAX) errors.push(`Place must be ${PLACE_MAX} characters or fewer.`);

  if (!eventDate) errors.push('Date is required.');
  if (ticketPrice == null) errors.push('Ticket price must be a number with up to 2 decimal places.');
  if (seatCount == null) errors.push('No of seats must be a whole number from 1 to 100000.');
  if (persons.error) errors.push(persons.error);

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      eventName,
      hostName,
      place,
      eventDate,
      ticketPrice,
      seatCount,
      designatedPersons: persons.people,
    },
  };
}

/**
 * @param {unknown} status
 * @returns {string|null}
 */
export function normalizeEventStatus(status) {
  const value = String(status ?? '').trim().toLowerCase();
  if (!EVENT_STATUSES.includes(value)) return null;
  return value;
}

export const EVENT_PEOPLE_LIMIT = 30;

/** Empty query lists people; 2+ characters filters the full directory. */
export function sanitizeEventPeopleQuery(raw) {
  return String(raw ?? '')
    .trim()
    .replace(/[,%()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
