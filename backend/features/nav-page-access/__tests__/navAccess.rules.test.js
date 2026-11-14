/**
 * Unit tests for nav page access domain rules.
 * Run: node --test backend/features/nav-page-access/__tests__/navAccess.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveMatrixRole,
  pagesForRole,
  canAccessPage,
  validateMatrixInput,
  mergeOmittedSystemAdmin,
  normalizeMatrix,
  matrixWithDefaultsForNewPages,
  DEFAULT_NAV_ACCESS_MATRIX,
  NAV_PAGE_KEYS,
  allowedPageKeys,
  allPagesAllowed,
} from '../domain/navAccess.rules.js';

describe('resolveMatrixRole', () => {
  it('maps user/empty to user', () => {
    assert.equal(resolveMatrixRole('user'), 'user');
    assert.equal(resolveMatrixRole(''), 'user');
    assert.equal(resolveMatrixRole(null), 'user');
  });

  it('maps coach and upline to coach (Sponsor)', () => {
    assert.equal(resolveMatrixRole('coach'), 'coach');
    assert.equal(resolveMatrixRole('upline'), 'coach');
    assert.equal(resolveMatrixRole('Upline'), 'coach');
  });

  it('maps admin and developer', () => {
    assert.equal(resolveMatrixRole('admin'), 'admin');
    assert.equal(resolveMatrixRole('developer'), 'developer');
  });

  it('keeps system admin on its own row, even with a downline', () => {
    assert.equal(resolveMatrixRole('system_admin'), 'system_admin');
    assert.equal(resolveMatrixRole('System Admin'), 'system_admin');
    assert.equal(resolveMatrixRole('system_admin', { hasSponsorTeam: true }), 'system_admin');
  });

  it('elevates a customer with downline (hasSponsorTeam) to Sponsor pages', () => {
    assert.equal(resolveMatrixRole('user', { hasSponsorTeam: true }), 'coach');
    assert.equal(resolveMatrixRole('user', { hasSponsorTeam: false }), 'user');
    assert.equal(resolveMatrixRole('', { hasSponsorTeam: true }), 'coach');
    assert.equal(resolveMatrixRole('admin', { hasSponsorTeam: true }), 'admin');
    assert.equal(resolveMatrixRole('developer', { hasSponsorTeam: true }), 'developer');
  });
});

describe('DEFAULT_NAV_ACCESS_MATRIX', () => {
  it('seeds customer to Home, Diary, Programmes, Transformation, and BroadCast', () => {
    const pages = DEFAULT_NAV_ACCESS_MATRIX.user;
    assert.equal(pages.home, true);
    assert.equal(pages.dashboard, true);
    assert.equal(pages.enrollment, true);
    assert.equal(pages.testimonials, true);
    assert.equal(pages.broadcast, true);
    assert.equal(pages['create-event'], true);
    assert.equal(pages['activity-report'], false);
    assert.equal(pages.counselling, false);
    assert.equal(pages['physical-club'], false);
    assert.equal(pages.reports, false);
    assert.equal(pages['go-premium'], false);
  });

  it('fills Go Premium from defaults when an older matrix omits it', () => {
    const older = {
      user: {
        home: true,
        dashboard: true,
        enrollment: true,
        testimonials: true,
        'activity-report': false,
        counselling: false,
        'physical-club': false,
        reports: false,
        broadcast: true,
      },
      coach: { home: true },
      admin: { home: true },
      developer: { home: true },
    };
    const filled = matrixWithDefaultsForNewPages(older);
    assert.equal(filled.user['go-premium'], false);
    assert.equal(filled.coach['go-premium'], true);
    assert.equal(filled.admin['go-premium'], true);
    assert.equal(filled.developer['go-premium'], true);
  });

  it('seeds sponsor/admin/developer with all pages on', () => {
    for (const role of ['coach', 'admin', 'developer']) {
      const keys = allowedPageKeys(DEFAULT_NAV_ACCESS_MATRIX[role]);
      assert.equal(keys.length, NAV_PAGE_KEYS.length);
    }
  });

  it('keeps an explicit BroadCast off and fills the key when an older matrix omits it', () => {
    const older = {
      user: {
        home: true,
        dashboard: true,
        enrollment: true,
        testimonials: true,
        'activity-report': false,
        counselling: false,
        'physical-club': false,
        reports: false,
      },
      coach: { home: true, broadcast: false },
      admin: { home: true },
      developer: { home: true },
    };
    const filled = matrixWithDefaultsForNewPages(older);
    assert.equal(filled.user.broadcast, true);
    assert.equal(filled.user.reports, false);
    assert.equal(filled.coach.broadcast, false);
    assert.equal(filled.admin.broadcast, true);
  });
});

describe('pagesForRole / canAccessPage', () => {
  it('upline uses coach matrix row', () => {
    const matrix = normalizeMatrix({
      user: { home: true },
      coach: { home: true, counselling: true },
      admin: { home: true },
      developer: { home: true },
    });
    const pages = pagesForRole(matrix, 'upline');
    assert.equal(canAccessPage(pages, 'counselling'), true);
    assert.equal(canAccessPage(pages, 'reports'), false);
  });

  it('denies unknown page keys', () => {
    assert.equal(canAccessPage(allPagesAllowed(), 'not-a-page'), false);
  });

  it('gives a customer-with-team the Sponsor page map', () => {
    const matrix = normalizeMatrix({
      user: { home: true, counselling: false, reports: false },
      coach: { home: true, counselling: true, reports: true },
      admin: { home: true },
      developer: { home: true },
    });
    const asCustomer = pagesForRole(matrix, 'user');
    const asSponsor = pagesForRole(matrix, 'user', { hasSponsorTeam: true });
    assert.equal(canAccessPage(asCustomer, 'counselling'), false);
    assert.equal(canAccessPage(asSponsor, 'counselling'), true);
    assert.equal(canAccessPage(asSponsor, 'reports'), true);
  });
});

describe('validateMatrixInput', () => {
  it('rejects non-object', () => {
    const r = validateMatrixInput(null);
    assert.equal(r.ok, false);
  });

  it('rejects missing role', () => {
    const r = validateMatrixInput({ user: {}, coach: {}, admin: {} });
    assert.equal(r.ok, false);
    assert.match(r.message, /developer/);
  });

  it('fills System Admin from Customer defaults when an older save omits the column', () => {
    const older = {
      user: { home: true },
      coach: { home: true },
      admin: { home: true },
      developer: { home: true },
    };
    const r = validateMatrixInput(older);
    assert.equal(r.ok, true);
    assert.equal(r.matrix.system_admin.home, true);
    assert.equal(r.matrix.system_admin.reports, false);
    const stored = {
      system_admin: { home: true, reports: true, dashboard: false },
    };
    const merged = mergeOmittedSystemAdmin(older, r.matrix, stored);
    assert.equal(merged.system_admin.reports, true);
    assert.equal(merged.system_admin.home, true);
    const replaced = mergeOmittedSystemAdmin(
      { ...older, system_admin: { home: false, reports: false } },
      validateMatrixInput({ ...older, system_admin: { home: false } }).matrix,
      stored,
    );
    assert.equal(replaced.system_admin.home, false);
    assert.equal(replaced.system_admin.reports, false);
  });

  it('accepts full matrix and normalizes', () => {
    const r = validateMatrixInput({
      user: { home: 1, dashboard: 0 },
      coach: { home: true },
      admin: { home: true },
      developer: { home: true },
    });
    assert.equal(r.ok, true);
    assert.equal(r.matrix.user.home, true);
    assert.equal(r.matrix.user.dashboard, false);
    assert.equal(r.matrix.user.enrollment, false);
  });
});
