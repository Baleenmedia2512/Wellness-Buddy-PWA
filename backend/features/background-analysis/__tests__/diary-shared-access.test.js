/**
 * Run: node --test backend/features/background-analysis/__tests__/diary-shared-access.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  allowDiaryViaReportingAccess,
  canAccessDiaryViaSharedLead,
  canAccessDiaryViaDownlineCoCoach,
  isPlatformDiaryReader,
} from '../diary.service.js';

describe('isPlatformDiaryReader', () => {
  it('allows admin and developer to read a diary outside their coach line', () => {
    assert.equal(isPlatformDiaryReader('admin'), true);
    assert.equal(isPlatformDiaryReader('developer'), true);
    assert.equal(isPlatformDiaryReader('ADMIN'), true);
  });

  it('keeps coach, user, and missing roles on the coach-line rules', () => {
    assert.equal(isPlatformDiaryReader('coach'), false);
    assert.equal(isPlatformDiaryReader('user'), false);
    assert.equal(isPlatformDiaryReader(null), false);
  });
});

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

describe('canAccessDiaryViaDownlineCoCoach', () => {
  const You = '100';
  const Lawrence = '200';
  const Leena = '201';
  const LeenaMember = '203';

  const findPartner = async (userId) => {
    if (String(userId) === Leena) return Lawrence;
    if (String(userId) === Lawrence) return Leena;
    return null;
  };

  const getChain = async (userId) => {
    if (String(userId) === Lawrence) return [Lawrence, You];
    if (String(userId) === Leena) return [Leena];
    if (String(userId) === LeenaMember) return [LeenaMember, Leena];
    return [String(userId)];
  };

  it('lets an upline read a downline coach co-coach', async () => {
    const allowed = await canAccessDiaryViaDownlineCoCoach(
      You,
      [Leena],
      findPartner,
      getChain,
    );
    assert.equal(allowed, true);
  });

  it('lets an upline read that co-coach teammate', async () => {
    const allowed = await canAccessDiaryViaDownlineCoCoach(
      You,
      [LeenaMember, Leena],
      findPartner,
      getChain,
    );
    assert.equal(allowed, true);
  });

  it('rejects a diary whose chain has no partner under the viewer', async () => {
    const allowed = await canAccessDiaryViaDownlineCoCoach(
      You,
      ['999', '998'],
      async () => null,
      getChain,
    );
    assert.equal(allowed, false);
  });
});

describe('allowDiaryViaReportingAccess', () => {
  it('allows when the reporting check does not throw', async () => {
    const allowed = await allowDiaryViaReportingAccess('339', '279', async () => {});
    assert.equal(allowed, true);
  });

  it('denies a 403 from the reporting check', async () => {
    const allowed = await allowDiaryViaReportingAccess('3396', '279', async () => {
      const err = new Error('You do not have permission to view this member');
      err.status = 403;
      throw err;
    });
    assert.equal(allowed, false);
  });
});
