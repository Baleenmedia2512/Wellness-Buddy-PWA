/**
 * Run: node --test backend/features/weight/__tests__/ideal-weight-milestone.service.test.js
 */
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { maybeRecordIdealWeightMilestone } from '../ideal-weight-milestone.service.js';

describe('maybeRecordIdealWeightMilestone', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.FF_REPORTS_MODULE = 'true';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  function makeDeps(overrides = {}) {
    const state = {
      reachedAt: null,
      notifiedAt: null,
      emails: [],
    };
    return {
      state,
      deps: {
        getIdealWeightReachedAt: async () => state.reachedAt,
        listActiveWeightsAsc: async () => [
          { ID: 1, Weight: 80, CreatedAt: '2024-01-01T00:00:00.000Z' },
          { ID: 2, Weight: 60, CreatedAt: '2024-06-01T00:00:00.000Z' },
        ],
        claimIdealWeightReachedAt: async (_userId, iso) => {
          if (state.reachedAt) return false;
          state.reachedAt = iso;
          return true;
        },
        claimIdealWeightReachedNotify: async () => {
          if (state.notifiedAt) return false;
          state.notifiedAt = new Date().toISOString();
          return true;
        },
        findMemberCoachContext: async () => ({
          coachId: 99,
          memberName: 'Alice',
          heightCm: 170,
        }),
        findCoachContact: async (id) => {
          if (String(id) === '99') return { email: 'sponsor@example.com', name: 'Sponsor' };
          if (String(id) === '77') return { email: 'coach@example.com', name: 'Ideal Coach' };
          return { email: null, name: null };
        },
        resolveSponsorAndIdealCoach: async () => ({
          sponsorId: '99',
          sponsorName: 'Sponsor',
          idealCoachId: '77',
          idealCoachName: 'Ideal Coach',
        }),
        sendCoachEmail: async (payload) => {
          state.emails.push(payload);
          return { success: true };
        },
        ...overrides,
      },
    };
  }

  it('stamps and emails sponsor + ideal coach when this insert is first in-range', async () => {
    const { state, deps } = makeDeps({
      listActiveWeightsAsc: async () => [
        { ID: 2, Weight: 60, CreatedAt: '2024-06-01T00:00:00.000Z' },
      ],
    });
    const result = await maybeRecordIdealWeightMilestone({
      userId: 1,
      weightKg: 60,
      heightCm: 170,
      isNewInsert: true,
      newEntryId: 2,
      newEntryCreatedAt: '2024-06-01T00:00:00.000Z',
    }, deps);

    assert.equal(result.recorded, true);
    assert.equal(result.notified, true);
    assert.equal(result.reason, 'sent');
    assert.equal(result.emailed, 2);
    assert.ok(state.reachedAt);
    assert.equal(state.emails.length, 2);
    assert.match(state.emails[0].subject, /reached ideal weight/i);
  });

  it('sends one email when sponsor and ideal coach are the same person', async () => {
    const { state, deps } = makeDeps({
      listActiveWeightsAsc: async () => [
        { ID: 2, Weight: 60, CreatedAt: '2024-06-01T00:00:00.000Z' },
      ],
      resolveSponsorAndIdealCoach: async () => ({
        sponsorId: '99',
        sponsorName: 'Same Person',
        idealCoachId: '99',
        idealCoachName: 'Same Person',
      }),
      findCoachContact: async () => ({ email: 'same@example.com', name: 'Same Person' }),
    });
    const result = await maybeRecordIdealWeightMilestone({
      userId: 1,
      weightKg: 60,
      heightCm: 170,
      isNewInsert: true,
      newEntryId: 2,
      newEntryCreatedAt: '2024-06-01T00:00:00.000Z',
    }, deps);
    assert.equal(result.emailed, 1);
    assert.equal(state.emails.length, 1);
  });

  it('records historical first without email when earlier in-range exists', async () => {
    const { state, deps } = makeDeps();
    const result = await maybeRecordIdealWeightMilestone({
      userId: 1,
      weightKg: 59,
      heightCm: 170,
      isNewInsert: true,
      newEntryId: 99,
      newEntryCreatedAt: '2024-07-01T00:00:00.000Z',
    }, deps);

    assert.equal(result.recorded, true);
    assert.equal(result.notified, false);
    assert.equal(result.reason, 'recorded_historical_first');
    assert.equal(state.emails.length, 0);
  });

  it('skips edits and out-of-range inserts', async () => {
    const { deps } = makeDeps();
    const edit = await maybeRecordIdealWeightMilestone({
      userId: 1,
      weightKg: 60,
      heightCm: 170,
      isNewInsert: false,
      newEntryId: 2,
    }, deps);
    assert.equal(edit.reason, 'not_new_insert');

    const out = await maybeRecordIdealWeightMilestone({
      userId: 1,
      weightKg: 90,
      heightCm: 170,
      isNewInsert: true,
      newEntryId: 3,
    }, deps);
    assert.equal(out.reason, 'not_in_ideal_range');
  });

  it('dedupes notify claim', async () => {
    const { deps } = makeDeps({
      listActiveWeightsAsc: async () => [
        { ID: 2, Weight: 60, CreatedAt: '2024-06-01T00:00:00.000Z' },
      ],
      claimIdealWeightReachedNotify: async () => false,
    });
    const result = await maybeRecordIdealWeightMilestone({
      userId: 1,
      weightKg: 60,
      heightCm: 170,
      isNewInsert: true,
      newEntryId: 2,
      newEntryCreatedAt: '2024-06-01T00:00:00.000Z',
    }, deps);
    assert.equal(result.recorded, true);
    assert.equal(result.notified, false);
    assert.equal(result.reason, 'notify_already_claimed');
  });
});
