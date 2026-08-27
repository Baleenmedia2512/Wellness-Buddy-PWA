/**
 * Run: node --test frontend/src/features/reports/domain/__tests__/reportsAccess.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { canAccessReportsModule } from '../reportsAccess.rules.js';

describe('canAccessReportsModule', () => {
  it('allows coach, upline, admin, developer (and co-coach variants)', () => {
    assert.equal(canAccessReportsModule('coach'), true);
    assert.equal(canAccessReportsModule('Coach'), true);
    assert.equal(canAccessReportsModule('upline'), true);
    assert.equal(canAccessReportsModule('admin'), true);
    assert.equal(canAccessReportsModule('developer'), true);
    assert.equal(canAccessReportsModule('coccoach'), true);
    assert.equal(canAccessReportsModule('co-coach'), true);
  });

  it('denies regular members and empty role', () => {
    assert.equal(canAccessReportsModule('user'), false);
    assert.equal(canAccessReportsModule('member'), false);
    assert.equal(canAccessReportsModule(''), false);
    assert.equal(canAccessReportsModule(null), false);
  });
});
