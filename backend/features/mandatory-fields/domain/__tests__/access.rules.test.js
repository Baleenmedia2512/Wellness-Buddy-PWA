/**
 * Run: node --test backend/features/mandatory-fields/domain/__tests__/access.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  isMandatoryRecoveryRoute,
  isMandatorySettingsAdmin,
  mandatoryDeploymentDecision,
  mandatoryEnforcementResponse,
  mandatoryActorLookup,
  resolveMandatoryRequestIdentity,
  resolveRequestIdentity,
} from '../access.rules.js';
import { conditionalIncrementSkip, isMandatorySchemaMissing } from '../../data/mandatoryFields.repo.js';
import { rejectIfMandatoryProfileBlocks } from '../../api/enforce.handler.js';
import { getRegisteredField } from '../fieldRegistry.js';
import { evaluateApiVersionEnforcement } from '../../../app-version/domain/enforce-api.rules.js';

const here = dirname(fileURLToPath(import.meta.url));

describe('mandatory access rules', () => {
  it('allows recovery routes and blocks diary and transformation', () => {
    assert.equal(isMandatoryRecoveryRoute('/api/user/profile'), true);
    assert.equal(isMandatoryRecoveryRoute('/api/user/consent'), true);
    assert.equal(isMandatoryRecoveryRoute('/api/user/community-id/verify-otp'), true);
    assert.equal(isMandatoryRecoveryRoute('/api/user/community-position/verify-otp'), true);
    assert.equal(isMandatoryRecoveryRoute('/api/user/community-positions'), true);
    assert.equal(isMandatoryRecoveryRoute('/api/user/height/request-otp'), true);
    assert.equal(isMandatoryRecoveryRoute('/api/user/verify-onboarding-email'), true);
    assert.equal(isMandatoryRecoveryRoute('/api/user/check-onboarding-email'), true);
    assert.equal(isMandatoryRecoveryRoute('/api/user/save-email'), true);
    assert.equal(isMandatoryRecoveryRoute('/api/user/height/verify-otp'), true);
    assert.equal(isMandatoryRecoveryRoute('/api/user/community-position/request'), true);
    assert.equal(isMandatoryRecoveryRoute('/api/auth/send-otp'), true);
    assert.equal(isMandatoryRecoveryRoute('/api/user/mandatory-fields'), true);
    assert.equal(isMandatoryRecoveryRoute('/api/dashboard'), false);
    assert.equal(isMandatoryRecoveryRoute('/api/coach/team-hierarchy'), false);
    assert.equal(isMandatoryRecoveryRoute('/api/reports/downline-weight-status'), false);
    assert.equal(isMandatoryRecoveryRoute('/api/food-corrections'), false);
    assert.equal(isMandatoryRecoveryRoute('/api/auth/verify-otp'), true);
    assert.equal(isMandatoryRecoveryRoute('/api/app/version-policy'), true);
    assert.equal(isMandatoryRecoveryRoute('/api/diary/list'), false);
    assert.equal(isMandatoryRecoveryRoute('/api/testimonials/submit'), false);
    assert.equal(isMandatoryRecoveryRoute('/api/dashboard'), false);
  });

  it('restricts settings to admin and developer', () => {
    assert.equal(isMandatorySettingsAdmin('admin'), true);
    assert.equal(isMandatorySettingsAdmin('Developer'), true);
    assert.equal(isMandatorySettingsAdmin('user'), false);
    assert.equal(isMandatorySettingsAdmin('coach'), false);
    assert.equal(isMandatorySettingsAdmin('upline'), false);
  });

  it('uses the viewer, not the diary owner, and ignores a body id when asked', () => {
    const actor = resolveRequestIdentity({
      query: { viewerUserId: '15', ownerUserId: '99' },
      body: { userId: 4 },
    });
    assert.equal(actor.userId, 15);

    const queryOnly = resolveRequestIdentity({
      query: { userId: '8' },
      body: { userId: 4 },
    }, { allowBody: false });
    assert.equal(queryOnly.userId, 8);
  });

  it('uses a userId cookie and rejects a different client id', () => {
    const matched = resolveMandatoryRequestIdentity({
      query: { userId: '15' },
      cookies: { userId: '15' },
    }, { allowBody: false });
    assert.equal(matched.userId, 15);
    assert.equal(matched.conflict, false);

    const conflict = resolveMandatoryRequestIdentity({
      query: { userId: '99' },
      body: { userId: 99 },
      cookies: { userId: '15' },
    });
    assert.equal(conflict.conflict, true);
    assert.equal(conflict.userId, null);
  });

  it('does not load a different member when the id and email disagree', () => {
    const mismatch = mandatoryActorLookup({
      userId: 15,
      email: 'other@example.com',
      rowById: { UserId: 15, Email: 'owner@example.com' },
      rowByEmail: { UserId: 99, Email: 'other@example.com' },
    });
    assert.equal(mismatch.ok, false);
    assert.equal(mismatch.status, 403);

    const missingId = mandatoryActorLookup({
      userId: 15,
      email: 'other@example.com',
      rowById: null,
      rowByEmail: { UserId: 99, Email: 'other@example.com' },
    });
    assert.equal(missingId.ok, false);
    assert.equal(missingId.status, 404);
  });

  it('maps a blocking evaluation to 403 and a missing profile to 503', () => {
    const blocked = mandatoryEnforcementResponse({
      blocked: true,
      enforcement: 'evaluated',
      status: 'ok',
      fields: [{ fieldKey: 'email', label: 'Email', blocking: true, graceType: 'days', remaining: 0 }],
    });
    assert.equal(blocked.httpStatus, 403);
    assert.equal(blocked.body.code, 'MANDATORY_PROFILE');
    assert.equal(blocked.body.fields[0].fieldKey, 'email');

    const missing = mandatoryEnforcementResponse({
      blocked: false,
      enforcement: 'unavailable',
      status: 'profile-unavailable',
      fields: [],
    });
    assert.equal(missing.httpStatus, 503);
    assert.equal(missing.body.code, 'PROFILE_UNAVAILABLE');

    const incomplete = mandatoryEnforcementResponse({
      blocked: false,
      enforcement: 'unavailable',
      status: 'profile-unavailable',
      reason: 'campaign-columns-missing',
      fields: [],
    });
    assert.equal(incomplete.httpStatus, 503);
    assert.equal(incomplete.body.code, 'MANDATORY_SCHEMA_INCOMPLETE');
    assert.equal(mandatoryEnforcementResponse({
      blocked: false,
      enforcement: 'evaluated',
      status: 'ok',
      fields: [],
    }), null);
  });
});

describe('conditional skip update', () => {
  it('lets only one of two concurrent skips pass the limit', async () => {
    const row = { user_id: 7, field_key: 'email', skip_count: 2 };
    const client = {
      user_field_grace: {
        updateMany({ where, data }) {
          const expected = where.AND.find((item) => typeof item.skip_count === 'number').skip_count;
          const limit = where.AND.find((item) => item.skip_count && item.skip_count.lt).skip_count.lt;
          if (row.user_id !== where.user_id || row.field_key !== where.field_key) return { count: 0 };
          if (row.skip_count !== expected || row.skip_count >= limit) return { count: 0 };
          row.skip_count += data.skip_count.increment;
          row.last_skipped_at = data.last_skipped_at;
          return { count: 1 };
        },
      },
    };
    const input = {
      userId: 7,
      fieldKey: 'email',
      expectedSkipCount: 2,
      graceLimit: 3,
      skippedAt: new Date('2026-11-10T12:00:00.000Z'),
    };
    const [first, second] = await Promise.all([
      conditionalIncrementSkip(input, client),
      conditionalIncrementSkip(input, client),
    ]);
    assert.equal(first, true);
    assert.equal(second, false);
    assert.equal(row.skip_count, 3);
  });
});

describe('product enforcement helper', () => {
  it('does not run the product handler when the profile is blocking', async () => {
    let statusCode = 0;
    let payload = null;
    const res = {
      status(code) { statusCode = code; return this; },
      json(body) { payload = body; },
    };
    const blocked = await rejectIfMandatoryProfileBlocks({
      method: 'GET',
      url: '/api/diary/list?viewerUserId=15',
      query: { viewerUserId: '15' },
      headers: {},
    }, res, {
      evaluate: async () => ({
        blocked: true,
        enforcement: 'evaluated',
        status: 'ok',
        fields: [{ fieldKey: 'name', label: 'Name', blocking: true, graceType: 'days', remaining: 0 }],
      }),
    });
    assert.equal(blocked, true);
    assert.equal(statusCode, 403);
    assert.equal(payload.code, 'MANDATORY_PROFILE');
  });

  it('returns 503 and does not allow a missing profile', async () => {
    let statusCode = 0;
    let payload = null;
    const res = {
      status(code) { statusCode = code; return this; },
      json(body) { payload = body; },
    };
    const blocked = await rejectIfMandatoryProfileBlocks({
      method: 'GET',
      url: '/api/testimonials/submit?userId=3',
      query: { userId: '3' },
      headers: {},
    }, res, {
      evaluate: async () => ({
        blocked: false,
        enforcement: 'unavailable',
        status: 'profile-unavailable',
        fields: [],
      }),
    });
    assert.equal(blocked, true);
    assert.equal(statusCode, 503);
    assert.equal(payload.code, 'PROFILE_UNAVAILABLE');
  });

  it('does not evaluate a different member when the cookie and query disagree', async () => {
    let statusCode = 0;
    let payload = null;
    let evaluated = false;
    const res = {
      status(code) { statusCode = code; return this; },
      json(body) { payload = body; },
    };
    const blocked = await rejectIfMandatoryProfileBlocks({
      method: 'GET',
      url: '/api/diary/list?userId=99',
      query: { userId: '99' },
      cookies: { userId: '15' },
      headers: {},
    }, res, {
      evaluate: async () => {
        evaluated = true;
        return { blocked: false, enforcement: 'evaluated', status: 'ok', fields: [] };
      },
    });
    assert.equal(blocked, true);
    assert.equal(evaluated, false);
    assert.equal(statusCode, 403);
    assert.equal(payload.code, 'MANDATORY_IDENTITY_MISMATCH');
  });

  it('leaves profile save and community OTP available', async () => {
    const res = { status() { throw new Error('should not respond'); }, json() {} };
    const profile = await rejectIfMandatoryProfileBlocks({
      method: 'POST',
      url: '/api/user/profile',
      query: { userId: '3' },
      headers: {},
    }, res, { evaluate: async () => { throw new Error('should not evaluate'); } });
    const otp = await rejectIfMandatoryProfileBlocks({
      method: 'POST',
      url: '/api/user/community-id/verify-otp',
      query: { userId: '3' },
      headers: {},
    }, res, { evaluate: async () => { throw new Error('should not evaluate'); } });
    assert.equal(profile, false);
    assert.equal(otp, false);
  });
});

describe('version lock on the new routes', () => {
  it('rejects a missing version when API enforcement is on', () => {
    const verdict = evaluateApiVersionEnforcement({
      enforceApi: true,
      clientVersion: null,
      minRequiredVersion: '3.5.0',
    });
    assert.equal(verdict.blocked, true);
    assert.equal(verdict.reason, 'missing_version');
  });

  it('wires the existing 426 helper into the mandatory-field routes', () => {
    const files = [
      '../../../../pages/api/admin/mandatory-fields/index.js',
      '../../../../pages/api/admin/mandatory-fields/[fieldKey].js',
      '../../../../pages/api/user/mandatory-fields/index.js',
      '../../../../pages/api/user/mandatory-fields/[fieldKey]/skip.js',
      '../../../../pages/api/user/community-position/request.js',
      '../../../../pages/api/user/community-position/verify-otp.js',
      '../../../../pages/api/user/community-positions.js',
    ];
    for (const file of files) {
      const source = readFileSync(join(here, file), 'utf8');
      assert.match(source, /rejectIfAppVersionTooOld/);
    }
  });

  it('keeps Community Position on the 3.5.6 editor', () => {
    assert.equal(getRegisteredField('communityPosition').editorMinAppVersion, '3.5.6');
  });
});

describe('deployment and route coverage', () => {
  it('allows a missing schema and stops on a database failure only after activation', () => {
    assert.equal(mandatoryDeploymentDecision({ deployed: false, failed: false, activated: false }), 'allow');
    assert.equal(mandatoryDeploymentDecision({ deployed: true, failed: false, activated: false }), 'allow');
    assert.equal(mandatoryDeploymentDecision({ deployed: true, failed: true, activated: false }), 'unavailable');
    assert.equal(mandatoryDeploymentDecision({ deployed: true, failed: false, activated: true }), 'enforce');
    assert.equal(isMandatorySchemaMissing({ code: 'P2021' }), true);
    assert.equal(isMandatorySchemaMissing({ code: 'P2022' }), true);
    assert.equal(isMandatorySchemaMissing({ code: 'P1001', message: 'Cannot reach database server' }), false);
    assert.equal(isMandatorySchemaMissing({
      message: "Table 'wellness.mandatory_field_rules' doesn't exist",
    }), true);
  });

  it('calls the mandatory gate from every API route', () => {
    const root = join(here, '../../../../pages/api');
    const missing = [];
    function walk(dir) {
      for (const name of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, name.name);
        if (name.isDirectory()) {
          if (name.name === '__tests__') continue;
          walk(full);
          continue;
        }
        if (!name.name.endsWith('.js')) continue;
        const source = readFileSync(full, 'utf8');
        if (!source.includes('runService(') && !source.includes('rejectIfMandatoryProfileBlocks')) {
          missing.push(full.slice(root.length + 1));
        }
      }
    }
    walk(root);
    assert.deepEqual(missing, []);
  });
});
