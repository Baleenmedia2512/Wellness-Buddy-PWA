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

export function parseEventTime(raw) {
  if (raw == null) return null;
  const text = String(raw).trim();
  if (!text) return null;
  const match = /^([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?(?:\s*([APap][Mm]))?$/.exec(text);
  if (match) {
    let hours = Number(match[1]);
    const minutes = match[2];
    const ampm = match[3]?.toUpperCase();
    if (ampm === 'PM' && hours < 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;
    return `${String(hours).padStart(2, '0')}:${minutes}`;
  }
  return text.slice(0, 20);
}

export function parseEventDates(raw, fallbackDate = null, fallbackStart = null, fallbackEnd = null, today = null) {
  const dates = [];
  const errors = [];
  if (Array.isArray(raw) && raw.length > 0) {
    for (let i = 0; i < raw.length; i += 1) {
      const item = raw[i];
      if (!item) continue;
      const dateText = typeof item === 'string' ? item : (item.date ?? item.eventDate);
      const parsedDate = parseEventDate(dateText);
      if (!parsedDate) {
        errors.push(`Date #${i + 1} is invalid. Use YYYY-MM-DD.`);
        continue;
      }
      const itemStart = parseEventTime(item.startTime ?? item.StartTime);
      const itemEnd = parseEventTime(item.endTime ?? item.EndTime);
      if (itemStart && itemEnd && itemStart >= itemEnd) {
        errors.push(raw.length === 1
          ? 'End time must be after start time.'
          : `For date ${parsedDate}: End time must be after start time.`);
      }
      if (today && parsedDate < today) {
        errors.push(raw.length === 1
          ? 'Choose today or a later date.'
          : `Date ${parsedDate} is in the past. Choose today or a later date.`);
      }
      dates.push({
        date: parsedDate,
        startTime: itemStart || null,
        endTime: itemEnd || null,
      });
    }
  }

  if (dates.length === 0 && fallbackDate) {
    const singleDate = parseEventDate(fallbackDate);
    if (!singleDate) {
      errors.push('Date is invalid. Use YYYY-MM-DD.');
    } else {
      const start = parseEventTime(fallbackStart);
      const end = parseEventTime(fallbackEnd);
      if (start && end && start >= end) {
        errors.push('End time must be after start time.');
      }
      if (today && singleDate < today) {
        errors.push('Choose today or a later date.');
      }
      dates.push({
        date: singleDate,
        startTime: start || null,
        endTime: end || null,
      });
    }
  }

  const uniqueDatesMap = new Map();
  for (const d of dates) {
    if (!uniqueDatesMap.has(d.date)) {
      uniqueDatesMap.set(d.date, d);
    }
  }
  const uniqueDates = Array.from(uniqueDatesMap.values());
  uniqueDates.sort((a, b) => a.date.localeCompare(b.date) || (a.startTime || '').localeCompare(b.startTime || ''));

  return { dates: uniqueDates, errors };
}

export function parseEventPlaces(raw, fallbackPlace = null, fallbackVenue = null) {
  const places = [];
  const errors = [];
  if (Array.isArray(raw) && raw.length > 0) {
    for (let i = 0; i < raw.length; i += 1) {
      const item = raw[i];
      if (!item) continue;
      const city = cleanText(typeof item === 'string' ? item : (item.city ?? item.place));
      if (!city) {
        errors.push(raw.length === 1 ? 'City is required.' : `City #${i + 1} is required.`);
        continue;
      }
      if (city.length > PLACE_MAX) {
        errors.push(`City must be ${PLACE_MAX} characters or fewer.`);
      }
      const venue = cleanText(typeof item === 'object' ? item.venue : null);
      if (venue && venue.length > PLACE_MAX) {
        errors.push(`Venue must be ${PLACE_MAX} characters or fewer.`);
      }
      places.push({
        city,
        place: city,
        venue: venue || null,
      });
    }
  }

  if (places.length === 0 && fallbackPlace) {
    const city = cleanText(fallbackPlace);
    if (city.length > PLACE_MAX) {
      errors.push(`City must be ${PLACE_MAX} characters or fewer.`);
    }
    const venue = cleanText(fallbackVenue);
    if (venue && venue.length > PLACE_MAX) {
      errors.push(`Venue must be ${PLACE_MAX} characters or fewer.`);
    }
    places.push({
      city,
      place: city,
      venue: venue || null,
    });
  }

  return { places, errors };
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

const SPEAKER_MAX = 20;
const SPEAKER_NAME_MAX = 80;

function speakerFromItem(item) {
  if (typeof item === 'string') {
    const name = cleanText(item);
    return name ? { name, userId: null } : null;
  }
  if (!item || typeof item !== 'object') return null;
  const name = cleanText(item.name ?? item.userName);
  if (!name) return null;
  return { name, userId: parseEventUserId(item.userId) };
}

function parseSpeakers(rawList, hostName) {
  let source = Array.isArray(rawList) ? rawList : [];
  if (source.length === 0 && hostName) source = String(hostName).split(' · ');
  if (source.length > SPEAKER_MAX) {
    return { error: `Add at most ${SPEAKER_MAX} speakers.` };
  }
  const seen = new Set();
  const speakers = [];
  for (const item of source) {
    const speaker = speakerFromItem(item);
    if (!speaker) return { error: 'Each speaker needs a name.' };
    if (speaker.name.length > SPEAKER_NAME_MAX) {
      return { error: `Each speaker name must be ${SPEAKER_NAME_MAX} characters or fewer.` };
    }
    const key = speaker.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    speakers.push(speaker);
  }
  if (speakers.length === 0) return { error: 'Add at least one speaker.' };
  const hostNameJoined = speakers.map((speaker) => speaker.name).join(' · ');
  if (hostNameJoined.length > NAME_MAX) {
    return { error: 'Speaker names together must be 200 characters or fewer.' };
  }
  return { speakers, hostName: hostNameJoined };
}

/**
 * @param {unknown} raw
 * @param {{ today?: string|null }} [options]
 * @returns {{ ok: true, value: object } | { ok: false, errors: string[] }}
 */
export function normalizeEventDraft(raw, options = {}) {
  const input = raw && typeof raw === 'object' ? raw : {};
  const eventName = cleanText(input.eventName);
  const speakerDraft = parseSpeakers(input.speakers, cleanText(input.hostName ?? input.host));
  const fallbackPlace = cleanText(input.place) || cleanText(input.city);
  const fallbackVenue = cleanText(input.venue);
  const { places, errors: placeErrors } = parseEventPlaces(
    input.places,
    fallbackPlace,
    fallbackVenue,
  );
  const fallbackDate = cleanText(input.eventDate) || cleanText(input.date);
  const today = typeof options.today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(options.today)
    ? options.today
    : null;
  const { dates, errors: dateErrors } = parseEventDates(
    input.eventDates,
    fallbackDate,
    input.startTime ?? input.StartTime,
    input.endTime ?? input.EndTime,
    today,
  );
  const ticketPrice = parseTicketPrice(input.ticketPrice);
  const seatCount = parseSeatCount(input.seatCount);
  const persons = parseDesignatedPersons(input.designatedPersons);
  const errors = [...placeErrors, ...dateErrors];

  if (!eventName) errors.push('Event name is required.');
  else if (eventName.length > NAME_MAX) errors.push(`Event name must be ${NAME_MAX} characters or fewer.`);

  if (speakerDraft.error) errors.push(speakerDraft.error);

  if (places.length === 0) errors.push('City is required.');
  if (dates.length === 0) errors.push('Date is required.');
  if (ticketPrice == null) errors.push('Ticket price must be a number with up to 2 decimal places.');
  if (seatCount == null) errors.push('No of seats must be a whole number from 1 to 100000.');
  if (persons.error) errors.push(persons.error);

  if (errors.length > 0) return { ok: false, errors };
  const primaryDate = dates[0];
  const primaryPlace = places[0];
  return {
    ok: true,
    value: {
      eventName,
      hostName: speakerDraft.hostName || '',
      speakers: speakerDraft.speakers || [],
      place: primaryPlace.city,
      venue: primaryPlace.venue || null,
      places,
      eventDate: primaryDate.date,
      startTime: primaryDate.startTime || null,
      endTime: primaryDate.endTime || null,
      eventDates: dates,
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

/**
 * A live event with at least one booking cannot be deleted.
 * A cancelled event can be deleted even when people had booked it.
 */
export function eventDeleteBlockedByBookings(seatsTaken, status) {
  if (String(status || '').toLowerCase() === 'cancelled') return false;
  const taken = Number(seatsTaken);
  return Number.isFinite(taken) && taken > 0;
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
  'NO PREFERENCE',
  'VEG & NON VEG',
]);

/**
 * Fallback when community_positions_table cannot be loaded.
 * New roles are added in that catalog, not in this list.
 */
const LEVEL_OPTIONS = Object.freeze([
  'PC',
  'ASSOCIATE',
  'SV',
  'WT',
  'AWT',
  'GET',
  'GET 2500',
  'MILL',
  'MILL 7500',
  'PT',
  // Legacy renamed codes (still accepted if catalog is unavailable)
  'GET TEAM',
  '2500 GET TEAM',
  'MILL TEAM',
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
 * @param {{ levelOptions?: string[] }} [options]
 * @returns {{ ok: true, value: object } | { ok: false, errors: string[] }}
 */
export function normalizeEventRegistrationDraft(raw, options = {}) {
  const input = raw && typeof raw === 'object' ? raw : {};
  const eventId = parseEventId(input.eventId);
  const translation = cleanText(input.translation).toUpperCase();
  const attendCity = cleanText(input.attendCity ?? input.pdAttendCity);
  const rawFoodType = cleanText(input.foodType).toUpperCase().replace(/-/g, ' ').replace(/\s+/g, ' ');
  const foodType = rawFoodType === 'VEGETARIAN'
    ? 'VEG'
    : (rawFoodType === 'NON VEGETARIAN' ? 'NON VEG' : rawFoodType);
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
  const levelOptions = Array.isArray(options.levelOptions) && options.levelOptions.length > 0
    ? options.levelOptions.map((code) => String(code).trim().toUpperCase())
    : LEVEL_OPTIONS;
  const errors = [];

  const attendOnline = attendCity.trim().toLowerCase() === 'online';

  if (!eventId) errors.push('Event is required.');
  if (!TRANSLATION_OPTIONS.includes(translation)) errors.push('Translation is required.');
  if (!attendCity || attendCity.length > PLACE_MAX) errors.push('Attending City is required.');
  // Online attendance has no venue meal — Food Type may be omitted (stored empty).
  if (attendOnline) {
    if (foodType && !FOOD_TYPE_OPTIONS.includes(foodType)) {
      errors.push('Food Type is required.');
    }
  } else if (!FOOD_TYPE_OPTIONS.includes(foodType)) {
    errors.push('Food Type is required.');
  }
  if (uplinePresident.error) errors.push(uplinePresident.error);
  if (uplineMill.error) errors.push(uplineMill.error);
  if (!clubNo || clubNo.length > 80) errors.push('Club No is required.');
  if (!zoomEmail || zoomEmail.length > 120 || !zoomEmail.includes('@')) {
    errors.push('Zoom Email is required.');
  }
  if (!name || name.length > NAME_MAX) errors.push('Name is required.');
  if (!idNo || idNo.length > 80) errors.push('ID No is required.');
  const allowedLevels = Array.isArray(options.levelOptions) && options.levelOptions.length
    ? options.levelOptions.map((code) => cleanText(code).toUpperCase())
    : LEVEL_OPTIONS;
  if (!allowedLevels.includes(level)) errors.push('Community Position is required.');
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
      foodType: attendOnline && !FOOD_TYPE_OPTIONS.includes(foodType) ? '' : foodType,
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
