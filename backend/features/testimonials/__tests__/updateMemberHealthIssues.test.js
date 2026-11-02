/**
 * Coaches must not edit downline health issues on Transformation.
 * Run: node --test backend/features/testimonials/__tests__/updateMemberHealthIssues.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { updateMemberHealthIssues } from '../testimonials.service.js';
import { ValidationError } from '../../../shared/lib/ValidationError.js';

describe('updateMemberHealthIssues', () => {
  it('rejects coach updates of member health issues with 403', async () => {
    await assert.rejects(
      () => updateMemberHealthIssues({
        coachId: 10,
        userId: 713,
        recoveredHealthIssues: ['Back Pain'],
      }),
      (err) => (
        err instanceof ValidationError
        && err.status === 403
        && /cannot edit health issues/i.test(err.message)
      ),
    );
  });
});
