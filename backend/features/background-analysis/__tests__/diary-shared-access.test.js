/**
 * Run: node --test backend/features/background-analysis/__tests__/diary-shared-access.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { canAccessDiaryViaSharedLead } from '../diary.service.js';

describe('canAccessDiaryViaSharedLead', () => {
  it('allows a viewer paired to an ancestor coach in the owner chain', async () => {
    const seen = [];
    const allowed = await canAccessDiaryViaSharedLead(
      '964',
      ['847', '339', '735'],
      async (viewerId, candidateUserId) => {
        seen.push([viewerId, candidateUserId]);
        return candidateUserId === '339';
      },
    );

    assert.equal(allowed, true);
    assert.deepEqual(seen, [
      ['964', '847'],
      ['964', '339'],
    ]);
  });

  it('rejects when no shared lead pair exists in the owner chain', async () => {
    const allowed = await canAccessDiaryViaSharedLead(
      '964',
      ['847', '339', '735'],
      async () => false,
    );

    assert.equal(allowed, false);
  });

  it('skips self entries in the coach chain', async () => {
    const seen = [];
    const allowed = await canAccessDiaryViaSharedLead(
      '964',
      ['964', '339'],
      async (viewerId, candidateUserId) => {
        seen.push([viewerId, candidateUserId]);
        return candidateUserId === '339';
      },
    );

    assert.equal(allowed, true);
    assert.deepEqual(seen, [['964', '339']]);
  });
});
