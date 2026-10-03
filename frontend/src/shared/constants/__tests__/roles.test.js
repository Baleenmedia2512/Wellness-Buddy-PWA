/**
 * Role normalization — sticky-privilege / account-switch safety.
 * Run: node --test frontend/src/shared/constants/__tests__/roles.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeAppRole,
  isAdminLikeRole,
  ROLE_USER,
  ROLE_ADMIN,
  ROLE_DEVELOPER,
  ROLE_COACH,
  ROLE_UPLINE,
} from '../roles.js';

describe('normalizeAppRole', () => {
  it('defaults empty / unknown to user (Customer)', () => {
    assert.equal(normalizeAppRole(null), ROLE_USER);
    assert.equal(normalizeAppRole(undefined), ROLE_USER);
    assert.equal(normalizeAppRole(''), ROLE_USER);
    assert.equal(normalizeAppRole('   '), ROLE_USER);
    assert.equal(normalizeAppRole('superadmin'), ROLE_USER);
  });

  it('maps customer/member aliases to user', () => {
    assert.equal(normalizeAppRole('customer'), ROLE_USER);
    assert.equal(normalizeAppRole('Member'), ROLE_USER);
  });

  it('preserves known elevated roles (case-insensitive)', () => {
    assert.equal(normalizeAppRole('Admin'), ROLE_ADMIN);
    assert.equal(normalizeAppRole('developer'), ROLE_DEVELOPER);
    assert.equal(normalizeAppRole('COACH'), ROLE_COACH);
    assert.equal(normalizeAppRole('upline'), ROLE_UPLINE);
  });
});

describe('isAdminLikeRole', () => {
  it('is true only for admin and developer', () => {
    assert.equal(isAdminLikeRole('admin'), true);
    assert.equal(isAdminLikeRole('developer'), true);
    assert.equal(isAdminLikeRole('user'), false);
    assert.equal(isAdminLikeRole(''), false);
    assert.equal(isAdminLikeRole(null), false);
    assert.equal(isAdminLikeRole('coach'), false);
  });
});
