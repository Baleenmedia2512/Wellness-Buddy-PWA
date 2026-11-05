/**
 * Run: node --test backend/features/events/domain/__tests__/event.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildRegistrationQrPayload,
  computeRegistrationCharge,
  generateEntryCode,
  normalizeEventDraft,
  normalizeEventRegistrationDraft,
  normalizeEventStatus,
  parseEventId,
  parseEventUserId,
  parseRegistrationQrPayload,
  sanitizeEventPeopleQuery,
} from '../event.rules.js';

const validDraft = {
  eventName: '  Morning Walk  ',
  hostName: 'Anita',
  place: 'Club hall',
  eventDate: '2026-11-02',
  ticketPrice: '199.50',
  seatCount: '40',
  designatedPersons: [
    { userId: 12, name: 'Ravi' },
    { userId: '12', name: 'Ravi duplicate' },
    { userId: 18, name: 'Meera' },
  ],
};

describe('normalizeEventDraft', () => {
  it('accepts the event fields and dedupes designated persons', () => {
    const result = normalizeEventDraft(validDraft);
    assert.equal(result.ok, true);
    assert.deepEqual(result.value, {
      eventName: 'Morning Walk',
      hostName: 'Anita',
      place: 'Club hall',
      venue: null,
      eventDate: '2026-11-02',
      ticketPrice: 199.5,
      seatCount: 40,
      designatedPersons: [
        { userId: 12, name: 'Ravi' },
        { userId: 18, name: 'Meera' },
      ],
    });
  });

  it('rejects missing fields, a bad date, and no designated person', () => {
    const result = normalizeEventDraft({
      eventName: '',
      host: '',
      place: '',
      eventDate: '2026-02-31',
      ticketPrice: '-1',
      seatCount: 0,
      designatedPersons: [],
    });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((line) => line.includes('Event name')));
    assert.ok(result.errors.some((line) => line.includes('Host')));
    assert.ok(result.errors.some((line) => line.includes('City')));
    assert.ok(result.errors.some((line) => line.includes('Date')));
    assert.ok(result.errors.some((line) => line.includes('Ticket price')));
    assert.ok(result.errors.some((line) => line.includes('seats')));
    assert.ok(result.errors.some((line) => line.includes('designated person')));
  });

  it('accepts city alias and venue', () => {
    const result = normalizeEventDraft({
      ...validDraft,
      city: 'Madurai',
      place: '',
      venue: 'Supervisor Academy Hall',
    });
    assert.equal(result.ok, true);
    assert.equal(result.value.place, 'Madurai');
    assert.equal(result.value.venue, 'Supervisor Academy Hall');
  });

  it('rejects a fractional seat count', () => {
    const result = normalizeEventDraft({ ...validDraft, seatCount: 1.5 });
    assert.equal(result.ok, false);
  });
});

describe('normalizeEventStatus', () => {
  it('accepts postponed and cancelled', () => {
    assert.equal(normalizeEventStatus('Postponed'), 'postponed');
    assert.equal(normalizeEventStatus('cancelled'), 'cancelled');
    assert.equal(normalizeEventStatus('scheduled'), 'scheduled');
  });

  it('rejects an unknown status', () => {
    assert.equal(normalizeEventStatus('deleted'), null);
    assert.equal(normalizeEventStatus(''), null);
  });
});

describe('id parsers', () => {
  it('accepts positive integers only', () => {
    assert.equal(parseEventUserId('12'), 12);
    assert.equal(parseEventUserId(0), null);
    assert.equal(parseEventId('3.2'), null);
    assert.equal(parseEventId(8), 8);
  });
});

describe('sanitizeEventPeopleQuery', () => {
  it('trims and strips filter-breaking characters', () => {
    assert.equal(sanitizeEventPeopleQuery('  Balaji,Sekar  '), 'Balaji Sekar');
    assert.equal(sanitizeEventPeopleQuery(''), '');
  });
});

describe('normalizeEventRegistrationDraft', () => {
  it('accepts a full registration payload', () => {
    const result = normalizeEventRegistrationDraft({
      eventId: 8,
      translation: 'tamil',
      attendCity: 'Community Hall',
      foodType: 'VEG',
      uplinePresidentTeam: { userId: 21, name: 'President Ravi' },
      uplineMillTeam: { userId: 22, name: 'Mill Meena' },
      clubNo: 'CLUB-17',
      zoomEmail: 'creator@example.com',
      name: 'Logged In User',
      idNo: '17',
      level: 'ASSOCIATE',
      phoneNumber: '9000000017',
      participantCount: 1,
      ticketNo: 'T-55',
      yourCity: 'CHENNAI',
      teamIncharge: { userId: 23, name: 'Incharge Arun' },
      daicyTeamIncharge: {
        userId: 24,
        name: 'Daicy Devi',
        uplineLabel: 'Incharge Arun / President Ravi',
      },
    });
    assert.equal(result.ok, true);
    assert.equal(result.value.translation, 'TAMIL');
    assert.equal(result.value.eventId, 8);
    assert.equal(result.value.daicyTeamIncharge.uplineLabel, 'Incharge Arun / President Ravi');
  });

  it('rejects missing required registration fields', () => {
    const result = normalizeEventRegistrationDraft({ eventId: 8 });
    assert.equal(result.ok, false);
    assert.ok(result.errors.length > 0);
  });
});

describe('registration payment helpers', () => {
  it('computes charge as ticket price times participants', () => {
    assert.equal(computeRegistrationCharge(199.5, 2), 399);
    assert.equal(computeRegistrationCharge(0, 1), 0);
  });

  it('builds and parses QR payload with event id and ticket/entry code', () => {
    assert.equal(buildRegistrationQrPayload(12, '4821'), '12:4821');
    assert.deepEqual(parseRegistrationQrPayload('12:4821'), { eventId: 12, entryCode: '4821' });
    assert.equal(buildRegistrationQrPayload(12, 'T-55'), '12:T-55');
    assert.deepEqual(parseRegistrationQrPayload('12:T-55'), { eventId: 12, entryCode: 'T-55' });
  });

  it('still generates a unique 4-digit entry code for legacy callers', () => {
    const code = generateEntryCode(new Set(['1000', '1001']));
    assert.match(code, /^\d{4}$/);
    assert.notEqual(code, '1000');
    assert.notEqual(code, '1001');
  });
});
