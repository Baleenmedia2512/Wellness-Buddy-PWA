/**
 * Run: node --test frontend/src/features/user/domain/profileIntro.test.js
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { validateProfileIntro } from './profileIntro.js';

describe('validateProfileIntro', () => {
  it('requires professional title when that key is asked', () => {
    assert.equal(
      validateProfileIntro({ professionalTitle: '  ' }, ['professionalTitle']),
      'Professional title is required.',
    );
    assert.equal(
      validateProfileIntro({ professionalTitle: 'Wellness coach' }, ['professionalTitle']),
      '',
    );
  });

  it('does not require professional title when only another key is asked', () => {
    assert.equal(validateProfileIntro({ instagram: '' }, ['instagram']), '');
  });
});
