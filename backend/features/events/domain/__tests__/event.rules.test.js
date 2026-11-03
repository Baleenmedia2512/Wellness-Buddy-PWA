/**
 * Run: node --test backend/features/events/domain/__tests__/event.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeEventDraft,
  normalizeEventRegistrationDraft,
  normalizeEventStatus,
  parseEventId,
  parseEventUserId,
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
    assert.ok(result.errors.some((line) => line.includes('Place')));
    assert.ok(result.errors.some((line) => line.includes('Date')));
    assert.ok(result.errors.some((line) => line.includes('Ticket price')));
    assert.ok(result.errors.some((line) => line.includes('seats')));
    assert.ok(result.errors.some((line) => line.includes('designated person')));
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
