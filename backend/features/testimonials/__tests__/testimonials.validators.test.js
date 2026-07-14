/**
 * Unit tests for testimonials validators.
 * Run: node --test backend/features/testimonials/__tests__/testimonials.validators.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateSubmitTestimonial,
  validateEditTestimonial,
} from '../testimonials.validators.js';
import { ValidationError } from '../../../shared/lib/ValidationError.js';

const TINY_BASE64 = 'a'.repeat(100);

function beforeOnlyBody(overrides = {}) {
  return {
    userId: 713,
    beforeImageBase64: TINY_BASE64,
    beforeWeightKg: 85,
    goalType: 'loss',
    durationText: '3 months',
    ...overrides,
  };
}

describe('validateSubmitTestimonial', () => {
  it('accepts before-only submit without recovered health issues', () => {
    const result = validateSubmitTestimonial(beforeOnlyBody());
    assert.equal(result.hasAfter, false);
    assert.deepEqual(result.recoveredHealthIssues, []);
    assert.equal(result.userId, 713);
  });

  it('does not require legacy medicalCondition field on before-only submit', () => {
    assert.doesNotThrow(() => validateSubmitTestimonial(beforeOnlyBody()));
  });

  it('maps legacy medicalCondition string to recoveredHealthIssues when provided', () => {
    const result = validateSubmitTestimonial(beforeOnlyBody({ medicalCondition: 'Diabetes' }));
    assert.deepEqual(result.recoveredHealthIssues, ['Diabetes']);
  });

  it('requires recovered health issues when after photo is included', () => {
    assert.throws(
      () => validateSubmitTestimonial(beforeOnlyBody({
        afterImageBase64: TINY_BASE64,
        afterWeightKg: 72,
      })),
      (err) => err instanceof ValidationError && /recovered health issue/i.test(err.message),
    );
  });

  it('accepts after photo submit when recovered health issues are present', () => {
    const result = validateSubmitTestimonial(beforeOnlyBody({
      afterImageBase64: TINY_BASE64,
      afterWeightKg: 72,
      recoveredHealthIssues: ['Diabetes'],
    }));
    assert.equal(result.hasAfter, true);
    assert.deepEqual(result.recoveredHealthIssues, ['Diabetes']);
  });
});

describe('validateEditTestimonial', () => {
  it('accepts before-only metadata edit without recovered health issues', () => {
    const result = validateEditTestimonial({
      userId: 713,
      beforeWeightKg: 84,
    });
    assert.equal(result.userId, 713);
    assert.equal(result.beforeWeightKg, 84);
    assert.equal(result.recoveredHealthIssues, undefined);
  });
});
