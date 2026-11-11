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
      places: [
        { city: 'Club hall', place: 'Club hall', venue: null },
      ],
      eventDate: '2026-11-02',
      startTime: null,
      endTime: null,
      eventDates: [
        { date: '2026-11-02', startTime: null, endTime: null },
      ],
      ticketPrice: 199.5,
      seatCount: 40,
      designatedPersons: [
        { userId: 12, name: 'Ravi' },
        { userId: 18, name: 'Meera' },
      ],
    });
  });

  it('accepts multiple places and optional venues', () => {
    const result = normalizeEventDraft({
      ...validDraft,
      places: [
        { city: 'Chennai', venue: 'Trade Centre' },
        { city: 'Madurai' },
      ],
    });
    assert.equal(result.ok, true);
    assert.equal(result.value.place, 'Chennai');
    assert.equal(result.value.venue, 'Trade Centre');
    assert.deepEqual(result.value.places, [
      { city: 'Chennai', place: 'Chennai', venue: 'Trade Centre' },
      { city: 'Madurai', place: 'Madurai', venue: null },
    ]);
  });

  it('accepts multiple eventDates and sorts them chronologically', () => {
    const result = normalizeEventDraft({
      ...validDraft,
      eventDates: [
        { date: '2026-11-20', startTime: '14:00', endTime: '17:00' },
        { date: '2026-11-15', startTime: '09:00', endTime: '12:00' },
      ],
    });
    assert.equal(result.ok, true);
    assert.equal(result.value.eventDate, '2026-11-15');
    assert.equal(result.value.startTime, '09:00');
    assert.equal(result.value.endTime, '12:00');
    assert.deepEqual(result.value.eventDates, [
      { date: '2026-11-15', startTime: '09:00', endTime: '12:00' },
      { date: '2026-11-20', startTime: '14:00', endTime: '17:00' },
    ]);
  });

  it('accepts valid start and end times and normalizes them', () => {
    const result = normalizeEventDraft({
      ...validDraft,
      startTime: '09:30',
      endTime: '11:00',
    });
    assert.equal(result.ok, true);
    assert.equal(result.value.startTime, '09:30');
    assert.equal(result.value.endTime, '11:00');
  });

  it('accepts 12-hour AM/PM times and normalizes to 24-hour format', () => {
    const result = normalizeEventDraft({
      ...validDraft,
      startTime: '9:30 AM',
      endTime: '2:15 PM',
    });
    assert.equal(result.ok, true);
    assert.equal(result.value.startTime, '09:30');
    assert.equal(result.value.endTime, '14:15');
  });

  it('rejects startTime equal to or after endTime', () => {
    const result = normalizeEventDraft({
      ...validDraft,
      startTime: '14:00',
      endTime: '10:00',
    });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((line) => line.includes('End time must be after start time')));

    const sameTimeResult = normalizeEventDraft({
      ...validDraft,
      startTime: '10:00',
      endTime: '10:00',
    });
    assert.equal(sameTimeResult.ok, false);
    assert.ok(sameTimeResult.errors.some((line) => line.includes('End time must be after start time')));
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

  it('accepts NO PREFERENCE and normalizes non-veg food types', () => {
    const res1 = normalizeEventRegistrationDraft({
      eventId: 8,
      translation: 'tamil',
      attendCity: 'Community Hall',
      foodType: 'no preference',
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
      },
    });
    assert.equal(res1.ok, true);
    assert.equal(res1.value.foodType, 'NO PREFERENCE');

    const res2 = normalizeEventRegistrationDraft({
      eventId: 8,
      translation: 'tamil',
      attendCity: 'Community Hall',
      foodType: 'non-veg',
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
      },
    });
    assert.equal(res2.ok, true);
    assert.equal(res2.value.foodType, 'NON VEG');
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
