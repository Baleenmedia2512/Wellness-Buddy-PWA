/**
 * Run: node --test frontend/src/features/payments/domain/premiumStatusStore.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createPremiumStatusStore,
  PREMIUM_STATUS_TTL_MS,
  normalizePremiumMembershipStatus,
} from './premiumStatusStore.js';

function makeStore(answers, extra = {}) {
  let clock = 1_000;
  let calls = 0;
  const store = createPremiumStatusStore({
    loadStatus: async () => {
      const answer = answers[Math.min(calls, answers.length - 1)];
      calls += 1;
      if (answer instanceof Error) throw answer;
      return answer;
    },
    now: () => clock,
    ...extra,
  });
  return {
    store,
    calls: () => calls,
    advance(ms) { clock += ms; },
  };
}

describe('premium status store', () => {
  it('normalizes membership payloads', () => {
    assert.deepEqual(
      normalizePremiumMembershipStatus({
        premium: true,
        daysLeft: 2,
        expiresAt: '2026-12-13',
        expiresAtDisplay: '13 Dec 2026, 4:56 AM',
        showExpiryWarning: true,
      }),
      {
        premium: true,
        daysLeft: 2,
        expiresAt: '2026-12-13',
        expiresAtDisplay: '13 Dec 2026, 4:56 AM',
        showExpiryWarning: true,
      },
    );
    assert.equal(normalizePremiumMembershipStatus(true).premium, true);
  });

  it('asks the server once and then reuses the answer', async () => {
    const t = makeStore([{ premium: true, daysLeft: 10, expiresAt: '2026-12-13', showExpiryWarning: false }]);
    assert.equal(await t.store.load(42), true);
    assert.equal(await t.store.load(42), true);
    assert.equal(t.calls(), 1);
    assert.equal(t.store.get(42), true);
    assert.equal(t.store.getStatus(42).daysLeft, 10);
  });

  it('shares one request between screens that ask at the same time', async () => {
    const t = makeStore([true]);
    const [a, b] = await Promise.all([t.store.load(42), t.store.load(42)]);
    assert.equal(a, true);
    assert.equal(b, true);
    assert.equal(t.calls(), 1);
  });

  it('asks again after the saved answer gets old', async () => {
    const t = makeStore([false, true]);
    assert.equal(await t.store.load(42), false);
    t.advance(PREMIUM_STATUS_TTL_MS + 1);
    assert.equal(await t.store.load(42), true);
    assert.equal(t.calls(), 2);
  });

  it('force asks again right away and tells listeners', async () => {
    const t = makeStore([
      { premium: false, daysLeft: null, expiresAt: null, showExpiryWarning: false },
      { premium: true, daysLeft: 2, expiresAt: '2026-12-13', showExpiryWarning: true },
    ]);
    const seen = [];
    t.store.subscribe(42, (value) => seen.push(value));
    await t.store.load(42);
    await t.store.load(42, { force: true });
    assert.equal(seen[0].premium, false);
    assert.equal(seen[1].premium, true);
    assert.equal(seen[1].showExpiryWarning, true);
  });

  it('checks again while a started payment is waiting to be confirmed', async () => {
    const t = makeStore([false, true], { hasPending: () => true });
    await t.store.load(42);
    assert.equal(await t.store.load(42), true);
    assert.equal(t.calls(), 2);
  });

  it('keeps members separate', async () => {
    const t = makeStore([true]);
    await t.store.load(42);
    assert.equal(t.store.get(7), false);
  });

  it('never invents Premium when the server cannot be reached', async () => {
    const t = makeStore([null]);
    assert.equal(await t.store.load(42), false);
    const failing = makeStore([new Error('boom')]);
    assert.equal(await failing.store.load(42), false);
  });

  it('keeps a known Premium answer when a later check cannot reach the server', async () => {
    const t = makeStore([true, null]);
    await t.store.load(42);
    assert.equal(await t.store.load(42, { force: true }), true);
  });

  it('shows the last saved Premium answer before the server answers', async () => {
    const saved = new Map();
    const t = makeStore(
      [{ premium: true, daysLeft: 31, expiresAt: '2026-12-17', expiresAtDisplay: '17 Dec 2026, 5:29 AM', showExpiryWarning: false }],
      {
        recall: (userId) => saved.get(String(userId)) || null,
        remember: (userId, status) => saved.set(String(userId), status),
      },
    );
    assert.equal(t.store.getStatus(42).premium, false);
    assert.equal(await t.store.load(42), true);
    assert.equal(saved.get('42').daysLeft, 31);

    const reopened = makeStore([null], {
      recall: (userId) => saved.get(String(userId)) || null,
      remember: (userId, status) => saved.set(String(userId), status),
    });
    assert.equal(reopened.store.getStatus(42).premium, true);
    assert.equal(reopened.store.getStatus(42).daysLeft, 31);
    assert.equal(reopened.store.getStatus(7).premium, false);
  });

  it('does not replace Premium when the check is not confirmed', async () => {
    const saved = new Map();
    const t = makeStore([
      {
        entitlementPacket: true,
        premiumConfirmed: true,
        premium: { premium: true, daysLeft: 31, expiresAt: '2026-12-17', expiresAtDisplay: '17 Dec 2026, 5:29 AM', showExpiryWarning: false },
        reportConfirmed: true,
        report: { access: 'premium', daysLeft: null, canSeeDetails: true },
      },
      {
        entitlementPacket: true,
        premiumConfirmed: false,
        reportConfirmed: false,
      },
    ], {
      remember: (userId, status) => saved.set(String(userId), status),
    });
    assert.equal(await t.store.load(42), true);
    t.advance(PREMIUM_STATUS_TTL_MS + 1);
    assert.equal(await t.store.load(42, { force: true }), true);
    assert.equal(t.store.getStatus(42).daysLeft, 31);
    assert.equal(saved.get('42').premium, true);
    assert.equal(t.store.getStatus(7).premium, false);
  });

  it('keeps members apart when one answer arrives late', async () => {
    let releaseFirst;
    const first = new Promise((resolve) => { releaseFirst = resolve; });
    const now = Date.parse('2026-11-17T08:00:00+05:30');
    const store = createPremiumStatusStore({
      loadStatus: (userId) => (
        String(userId) === '1'
          ? first
          : { premium: false, daysLeft: null, expiresAt: null, showExpiryWarning: false }
      ),
      now: () => now,
    });
    const pending = store.load(1);
    assert.equal(await store.load(2), false);
    releaseFirst({
      premium: true,
      daysLeft: 10,
      expiresAt: '2026-12-17',
      showExpiryWarning: false,
    });
    assert.equal(await pending, true);
    assert.equal(store.get(1), true);
    assert.equal(store.get(2), false);
  });

  it('applies a payment refresh after the status check already in flight', async () => {
    let releaseFirst;
    const first = new Promise((resolve) => { releaseFirst = resolve; });
    let calls = 0;
    const now = Date.parse('2026-11-17T08:00:00+05:30');
    const store = createPremiumStatusStore({
      loadStatus: () => {
        calls += 1;
        if (calls === 1) return first;
        return { premium: true, daysLeft: 30, expiresAt: '2026-12-17', showExpiryWarning: false };
      },
      now: () => now,
    });
    const slow = store.load(42);
    const paid = store.load(42, { force: true });
    releaseFirst({ premium: false, daysLeft: null, expiresAt: null, showExpiryWarning: false });
    assert.equal(await slow, false);
    assert.equal(await paid, true);
    assert.equal(store.get(42), true);
    assert.equal(store.getStatus(42).daysLeft, 30);
    assert.equal(calls, 2);
  });

  it('stops showing Premium after the saved expiry, and keeps it when the network fails before then', async () => {
    let clock = Date.parse('2026-11-17T08:00:00+05:30');
    const t = makeStore([
      { premium: true, daysLeft: 20, expiresAt: '2026-12-07', showExpiryWarning: false },
      null,
    ], { now: () => clock });
    assert.equal(await t.store.load(42), true);
    clock += 60 * 60 * 1000;
    assert.equal(await t.store.load(42, { force: true }), true);
    clock = Date.parse('2026-12-08T00:00:00+05:30');
    assert.equal(t.store.get(42), false);
  });

  it('does not keep Premium that has no expiry for more than a day', async () => {
    let clock = Date.parse('2026-11-17T08:00:00+05:30');
    const store = createPremiumStatusStore({
      loadStatus: async () => true,
      now: () => clock,
    });
    assert.equal(await store.load(42), true);
    clock += (24 * 60 * 60 * 1000) + 1;
    assert.equal(store.get(42), false);
  });

  it('ignores a missing member id', async () => {
    const t = makeStore([true]);
    assert.equal(await t.store.load(null), false);
    assert.equal(t.calls(), 0);
  });
});
