/**
 * Gemini model pinning — never float to *-latest or undeclared versions.
 * Run: node --test backend/shared/lib/gemini/__tests__/modelPinning.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  PINNED_PRIMARY_MODEL,
  PINNED_FALLBACK_MODEL,
  ALLOWED_GEMINI_MODELS,
  resolvePinnedGeminiModel,
  MODEL_NAME,
  FALLBACK_MODEL_NAME,
} from '../geminiClient.js';

describe('resolvePinnedGeminiModel', () => {
  it('returns the declared pin when request is empty', () => {
    assert.equal(resolvePinnedGeminiModel(null, PINNED_PRIMARY_MODEL), PINNED_PRIMARY_MODEL);
    assert.equal(resolvePinnedGeminiModel('', PINNED_FALLBACK_MODEL), PINNED_FALLBACK_MODEL);
  });

  it('accepts allowlisted model ids only', () => {
    assert.equal(
      resolvePinnedGeminiModel('gemini-2.5-flash', PINNED_PRIMARY_MODEL),
      'gemini-2.5-flash',
    );
    assert.equal(
      resolvePinnedGeminiModel('gemini-2.5-pro', PINNED_FALLBACK_MODEL),
      'gemini-2.5-pro',
    );
  });

  it('rejects floating aliases and keeps the pin', () => {
    assert.equal(
      resolvePinnedGeminiModel('gemini-2.5-flash-latest', PINNED_PRIMARY_MODEL),
      PINNED_PRIMARY_MODEL,
    );
    assert.equal(
      resolvePinnedGeminiModel('gemini-flash-latest', PINNED_PRIMARY_MODEL),
      PINNED_PRIMARY_MODEL,
    );
    assert.equal(
      resolvePinnedGeminiModel('gemini-pro', PINNED_FALLBACK_MODEL),
      PINNED_FALLBACK_MODEL,
    );
  });

  it('rejects newer undeclared families (e.g. 3.5) and keeps the pin', () => {
    assert.equal(
      resolvePinnedGeminiModel('gemini-3.5-pro', PINNED_FALLBACK_MODEL),
      PINNED_FALLBACK_MODEL,
    );
    assert.equal(
      resolvePinnedGeminiModel('gemini-3.0-flash', PINNED_PRIMARY_MODEL),
      PINNED_PRIMARY_MODEL,
    );
  });
});

describe('runtime exports', () => {
  it('exports only allowlisted primary/fallback models', () => {
    assert.ok(ALLOWED_GEMINI_MODELS.includes(MODEL_NAME));
    assert.ok(ALLOWED_GEMINI_MODELS.includes(FALLBACK_MODEL_NAME));
    assert.equal(MODEL_NAME, PINNED_PRIMARY_MODEL);
    assert.equal(FALLBACK_MODEL_NAME, PINNED_FALLBACK_MODEL);
  });
});
