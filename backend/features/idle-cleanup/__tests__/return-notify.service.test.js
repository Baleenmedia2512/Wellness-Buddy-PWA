/**
 * Unit tests for idle return-notify service (claim-first dedupe).
 * Run: node --test backend/features/idle-cleanup/__tests__/return-notify.service.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { notifyCoachIfReturningIdleUser } from '../api/return-notify.service.js';

describe('notifyCoachIfReturningIdleUser (claim-first)', () => {
  const now = new Date('2026-08-24T12:00:00Z');
  const idleAt = new Date('2026-08-01T12:00:00Z');

  function deps({ claimed = true, sendOk = true } = {}) {
    const calls = { claim: 0, send: 0 };
    return {
      calls,
      api: {
        claimIdleReturnNotify: async () => {
          calls.claim += 1;
          return claimed;
        },
        findMemberCoachContext: async () => ({
          coachId: 10,
          memberName: 'kabilan',
        }),
        findCoachContact: async () => ({
          email: 'coach@example.com',
          name: 'ADHITYA',
        }),
        sendCoachEmail: async () => {
          calls.send += 1;
          return { success: sendOk };
        },
      },
    };
  }

  it('skips when not idle (no claim, no email)', async () => {
    const { calls, api } = deps();
    const r = await notifyCoachIfReturningIdleUser({
      userId: 1,
      lastActiveAt: new Date('2026-08-23T12:00:00Z'),
      now,
    }, api);
    assert.equal(r.reason, 'not_idle');
    assert.equal(calls.claim, 0);
    assert.equal(calls.send, 0);
  });

  it('sends email only when claim wins', async () => {
    const { calls, api } = deps({ claimed: true });
    const r = await notifyCoachIfReturningIdleUser({
      userId: 1,
      lastActiveAt: idleAt,
      now,
    }, api);
    assert.equal(r.notified, true);
    assert.equal(r.reason, 'sent');
    assert.equal(calls.claim, 1);
    assert.equal(calls.send, 1);
  });

  it('does not send when another lookup already claimed', async () => {
    const { calls, api } = deps({ claimed: false });
    const r = await notifyCoachIfReturningIdleUser({
      userId: 1,
      lastActiveAt: idleAt,
      now,
    }, api);
    assert.equal(r.notified, false);
    assert.equal(r.reason, 'already_claimed');
    assert.equal(calls.claim, 1);
    assert.equal(calls.send, 0);
  });
});
