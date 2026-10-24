import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mapDriverError } from '../mysqlSupabaseClient.js';

describe('mapDriverError', () => {
  it('maps a Prisma raw MySQL duplicate to 23505', () => {
    const mapped = mapDriverError({
      code: 'P2010',
      message: 'Raw query failed. Code: `1062`. Message: Duplicate entry \'x\' for key \'team_table.idx_team_email\'',
      meta: { code: '1062' },
    });
    assert.equal(mapped.code, '23505');
  });

  it('maps Prisma P2002 to 23505', () => {
    const mapped = mapDriverError({
      code: 'P2002',
      message: 'Unique constraint failed',
    });
    assert.equal(mapped.code, '23505');
  });

  it('keeps a non-duplicate driver code', () => {
    const mapped = mapDriverError({
      code: 'P2010',
      message: 'Raw query failed',
      meta: { code: '1054' },
    });
    assert.equal(mapped.code, 'P2010');
  });
});
