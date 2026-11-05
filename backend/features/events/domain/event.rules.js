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
  // Place remains the city/location used by registration attend-city options.
  const place = cleanText(input.place) || cleanText(input.city);
  // Venue is additive — old clients can omit it; create UI collects it.
  const venue = cleanText(input.venue);
  const eventDate = parseEventDate(input.eventDate ?? input.date);
  const ticketPrice = parseTicketPrice(input.ticketPrice);
  const seatCount = parseSeatCount(input.seatCount);
  const persons = parseDesignatedPersons(input.designatedPersons);
  const errors = [];

  if (!eventName) errors.push('Event name is required.');
  else if (eventName.length > NAME_MAX) errors.push(`Event name must be ${NAME_MAX} characters or fewer.`);

  if (!hostName) errors.push('Host is required.');
  else if (hostName.length > NAME_MAX) errors.push(`Host must be ${NAME_MAX} characters or fewer.`);

  if (!place) errors.push('City is required.');
  else if (place.length > PLACE_MAX) errors.push(`City must be ${PLACE_MAX} characters or fewer.`);

  if (venue && venue.length > PLACE_MAX) {
    errors.push(`Venue must be ${PLACE_MAX} characters or fewer.`);
  }

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
      venue: venue || null,
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

const TRANSLATION_OPTIONS = Object.freeze([
  'TAMIL',
  'ENGLISH',
  'MALAYALAM',
  'HINDI',
  'TELUGU',
  'KANNADA',
]);

const FOOD_TYPE_OPTIONS = Object.freeze([
  'VEG',
  'NON VEG',
  'VEG & NON VEG',
]);

const LEVEL_OPTIONS = Object.freeze([
  'PC',
  'ASSOCIATE',
  'SV',
  'WT',
  'AWT',
  'GET TEAM',
  '2500 GET TEAM',
  'MILL TEAM',
  'PT',
]);

/** Empty query lists people; 2+ characters filters the full directory. */
export function sanitizeEventPeopleQuery(raw) {
  return String(raw ?? '')
    .trim()
    .replace(/[,%()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parsePickedPerson(raw, label) {
  const userId = parseEventUserId(raw?.userId);
  const name = cleanText(raw?.name ?? raw?.userName);
  if (!userId || !name || name.length > NAME_MAX) {
    return { error: `${label} is required.` };
  }
  const uplineLabel = cleanText(raw?.uplineLabel);
  return {
    person: {
      userId,
      name,
      ...(uplineLabel ? { uplineLabel: uplineLabel.slice(0, 400) } : {}),
    },
  };
}

/**
 * Normalize event interest / registration form payload.
 * @param {unknown} raw
 * @returns {{ ok: true, value: object } | { ok: false, errors: string[] }}
 */
export function normalizeEventRegistrationDraft(raw) {
  const input = raw && typeof raw === 'object' ? raw : {};
  const eventId = parseEventId(input.eventId);
  const translation = cleanText(input.translation).toUpperCase();
  const attendCity = cleanText(input.attendCity ?? input.pdAttendCity);
  const foodType = cleanText(input.foodType).toUpperCase();
  const clubNo = cleanText(input.clubNo);
  const zoomEmail = cleanText(input.zoomEmail).toLowerCase();
  const name = cleanText(input.name ?? input.registrantName);
  const idNo = cleanText(input.idNo);
  const level = cleanText(input.level ?? input.levelName).toUpperCase();
  const phoneNumber = cleanText(input.phoneNumber).replace(/\s+/g, '');
  const ticketNo = cleanText(input.ticketNo);
  const yourCity = cleanText(input.yourCity).toUpperCase();
  const participantCount = Number(input.participantCount);
  const uplinePresident = parsePickedPerson(input.uplinePresidentTeam, 'Upline President Team');
  const uplineMill = parsePickedPerson(input.uplineMillTeam, 'Upline Mill Team');
  const teamIncharge = parsePickedPerson(input.teamIncharge, 'Team Incharge');
  const daicyTeamIncharge = parsePickedPerson(input.daicyTeamIncharge, 'Daicy Team Incharge');
  const errors = [];

  if (!eventId) errors.push('Event is required.');
  if (!TRANSLATION_OPTIONS.includes(translation)) errors.push('Translation is required.');
  if (!attendCity || attendCity.length > PLACE_MAX) errors.push('Attending City is required.');
  if (!FOOD_TYPE_OPTIONS.includes(foodType)) errors.push('Food Type is required.');
  if (uplinePresident.error) errors.push(uplinePresident.error);
  if (uplineMill.error) errors.push(uplineMill.error);
  if (!clubNo || clubNo.length > 80) errors.push('Club No is required.');
  if (!zoomEmail || zoomEmail.length > 120 || !zoomEmail.includes('@')) {
    errors.push('Zoom Email is required.');
  }
  if (!name || name.length > NAME_MAX) errors.push('Name is required.');
  if (!idNo || idNo.length > 80) errors.push('ID No is required.');
  if (!LEVEL_OPTIONS.includes(level)) errors.push('Community Position is required.');
  if (!phoneNumber || phoneNumber.length > 20) errors.push('Phone Number is required.');
  if (!Number.isInteger(participantCount) || participantCount < 1 || participantCount > 10) {
    errors.push('No of Participant must be from 1 to 10.');
  }
  if (!ticketNo || ticketNo.length > 80) errors.push('Your Ticket Number is required.');
  if (ticketNo && ticketNo.includes(':')) {
    errors.push('Your Ticket Number cannot contain ":".');
  }
  if (!yourCity || yourCity.length > 120) errors.push('Your City is required.');
  if (teamIncharge.error) errors.push(teamIncharge.error);
  if (daicyTeamIncharge.error) errors.push(daicyTeamIncharge.error);

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      eventId,
      translation,
      attendCity,
      foodType,
      uplinePresidentTeam: uplinePresident.person,
      uplineMillTeam: uplineMill.person,
      clubNo,
      zoomEmail,
      name,
      idNo,
      level,
      phoneNumber,
      participantCount,
      ticketNo,
      yourCity,
      teamIncharge: teamIncharge.person,
      daicyTeamIncharge: daicyTeamIncharge.person,
    },
  };
}

/** Charge = ticket price × participants (rounded to 2 decimals). */
export function computeRegistrationCharge(ticketPrice, participantCount) {
  const price = Number(ticketPrice);
  const count = Number(participantCount);
  if (!Number.isFinite(price) || price < 0) return null;
  if (!Number.isInteger(count) || count < 1) return null;
  return Math.round(price * count * 100) / 100;
}

/**
 * Legacy helper — new paid registrations use the guest's Ticket Number as EntryCode.
 * Kept so older tests / tooling that still call it do not break.
 */
export function generateEntryCode(existingCodes = new Set()) {
  const used = existingCodes instanceof Set ? existingCodes : new Set(existingCodes || []);
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const code = String(1000 + Math.floor(Math.random() * 9000));
    if (!used.has(code)) return code;
  }
  for (let n = 1000; n <= 9999; n += 1) {
    const code = String(n);
    if (!used.has(code)) return code;
  }
  return null;
}

/**
 * Entry / check-in identity. Accepts the guest ticket number (new) and legacy 4-digit codes.
 * Colon is reserved as the QR payload separator.
 */
export function parseEntryCode(raw) {
  const text = String(raw ?? '').trim();
  if (!text || text.length > 80) return null;
  if (text.includes(':')) return null;
  return text;
}

/** QR payload: eventId:entryCode — unique per event (ticket number or legacy 4-digit). */
export function buildRegistrationQrPayload(eventId, entryCode) {
  const id = parseEventId(eventId);
  const code = parseEntryCode(entryCode);
  if (!id || !code) return null;
  return `${id}:${code}`;
}

export function parseRegistrationQrPayload(raw) {
  const text = String(raw ?? '').trim();
  const match = /^(\d+):(.+)$/.exec(text);
  if (!match) return null;
  const eventId = parseEventId(match[1]);
  const entryCode = parseEntryCode(match[2]);
  if (!eventId || !entryCode) return null;
  return { eventId, entryCode };
}

export function canScanEventRegistrations(event, scannerUserId) {
  const uid = parseEventUserId(scannerUserId);
  if (!event || !uid) return false;
  if (Number(event.createdByUserId) === uid) return true;
  const designated = Array.isArray(event.designatedPersons) ? event.designatedPersons : [];
  return designated.some((person) => Number(person?.userId) === uid);
}
