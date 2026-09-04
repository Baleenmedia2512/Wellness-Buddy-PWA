/**
 * Run: node --test frontend/src/features/reports/domain/__tests__/reportsAccess.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { canAccessReportsModule } from '../reportsAccess.rules.js';

describe('canAccessReportsModule', () => {
  it('allows every signed-in role, including leaf members', () => {
    for (const role of [
      'user',
      'member',
      'coach',
      'Coach',
      'upline',
      'coccoach',
      'co-coach',
      'admin',
      'developer',
    ]) {
      assert.equal(canAccessReportsModule(role), true, role);
    }
  });

  it('allows empty role so nav does not flicker while profile loads', () => {
    assert.equal(canAccessReportsModule(''), true);
    assert.equal(canAccessReportsModule(null), true);
  });
});
