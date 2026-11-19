/**
 * Run: node --test frontend/src/features/payments/domain/premiumStatusStore.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createPremiumStatusStore, PREMIUM_STATUS_TTL_MS } from './premiumStatusStore.js';

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
  it('asks the server once and then reuses the answer', async () => {
    const t = makeStore([true]);
    assert.equal(await t.store.load(42), true);
    assert.equal(await t.store.load(42), true);
    assert.equal(t.calls(), 1);
    assert.equal(t.store.get(42), true);
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
    const t = makeStore([false, true]);
    const seen = [];
    t.store.subscribe(42, (value) => seen.push(value));
    await t.store.load(42);
    await t.store.load(42, { force: true });
    assert.deepEqual(seen, [false, true]);
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

  it('ignores a missing member id', async () => {
    const t = makeStore([true]);
    assert.equal(await t.store.load(null), false);
    assert.equal(t.calls(), 0);
  });
});
