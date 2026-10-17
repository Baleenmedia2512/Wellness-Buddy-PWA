/**
 * AI photo-analysis mode: admin switch + fail-closed lookup.
 * Run: node --test backend/features/ai-credits/__tests__/ai-photo-analysis-mode.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { aiPhotoAnalysisModeFromConfigRow } from '../domain/credits.rules.js';
import { readAiPhotoAnalysisMode } from '../data/ai-credits.repo.js';

const LUNCH_ON = {
  breakfast: { enabled: false, start: '05:30:00', end: '08:30:00' },
  lunch: { enabled: true, start: '12:00:00', end: '16:00:00' },
  dinner: { enabled: false, start: '17:30:00', end: '20:30:00' },
};

const ALL_OFF = {
  breakfast: { enabled: false, start: '05:30:00', end: '08:30:00' },
  lunch: { enabled: false, start: '12:00:00', end: '16:00:00' },
  dinner: { enabled: false, start: '17:30:00', end: '20:30:00' },
};

function queryClient(responses) {
  const calls = [];
  const client = {
    calls,
    from(table) {
      calls.push(table);
      const pending = { table };
      const chain = {
        select(columns) {
          pending.columns = columns;
          return chain;
        },
        order() { return chain; },
        limit() { return chain; },
        async maybeSingle() {
          const next = responses.shift();
          if (!next) throw new Error('no fake query response left');
          return next;
        },
      };
      return chain;
    },
  };
  return client;
}

describe('aiPhotoAnalysisModeFromConfigRow', () => {
  it('is off when the admin AI Mode switch is off', () => {
    const mode = aiPhotoAnalysisModeFromConfigRow({
      ai_mode_enabled: false,
      daily_ai_credits: 3,
      availability_windows: LUNCH_ON,
    });
    assert.deepEqual(mode, { known: true, enabled: false });
  });

  it('is on when the admin AI Mode switch is on and a meal slot is on', () => {
    const mode = aiPhotoAnalysisModeFromConfigRow({
      ai_mode_enabled: true,
      daily_ai_credits: 3,
      availability_windows: LUNCH_ON,
    });
    assert.deepEqual(mode, { known: true, enabled: true });
  });

  it('is off when every meal slot is off, matching admin save', () => {
    const mode = aiPhotoAnalysisModeFromConfigRow({
      ai_mode_enabled: true,
      daily_ai_credits: 3,
      availability_windows: ALL_OFF,
    });
    assert.deepEqual(mode, { known: true, enabled: false });
  });

  it('treats a null switch on a saved row as unknown', () => {
    const mode = aiPhotoAnalysisModeFromConfigRow({
      ai_mode_enabled: null,
      daily_ai_credits: 3,
      availability_windows: LUNCH_ON,
    });
    assert.equal(mode.known, false);
    assert.equal(mode.enabled, false);
  });

  it('uses the admin default when no config row exists', () => {
    const mode = aiPhotoAnalysisModeFromConfigRow(null);
    assert.equal(mode.known, true);
    assert.equal(mode.enabled, true);
  });
});

describe('readAiPhotoAnalysisMode', () => {
  it('reads only the injected Supabase client', async () => {
    let productionHits = 0;
    const production = {
      from() {
        productionHits += 1;
        throw new Error('production database');
      },
    };
    const staging = queryClient([{
      data: {
        ai_mode_enabled: false,
        daily_ai_credits: 3,
        availability_windows: LUNCH_ON,
      },
      error: null,
    }]);

    const mode = await readAiPhotoAnalysisMode(staging);
    assert.equal(productionHits, 0);
    assert.deepEqual(staging.calls, ['ai_credits_config_table']);
    assert.deepEqual(mode, { known: true, enabled: false });
  });

  it('fails closed when the config query errors', async () => {
    const client = queryClient([{ data: null, error: { message: 'connection refused' } }]);
    await assert.rejects(
      () => readAiPhotoAnalysisMode(client),
      (err) => err.code === 'AI_MODE_UNKNOWN',
    );
  });

  it('retries without availability_windows when that column is missing', async () => {
    const client = queryClient([
      { data: null, error: { message: 'column availability_windows does not exist' } },
      { data: { ai_mode_enabled: true, daily_ai_credits: 3 }, error: null },
    ]);
    const mode = await readAiPhotoAnalysisMode(client);
    assert.equal(mode.known, true);
    assert.equal(mode.enabled, true);
    assert.equal(client.calls.length, 2);
  });
});
