/**
 * Run: node --test backend/features/mandatory-fields/domain/__tests__/evaluateMandatoryFields.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { listRegisteredFieldKeys } from '../fieldRegistry.js';
import {
  evaluateMandatoryFields,
  planSkip,
  roleMatchesAudience,
  validateAdminRule,
} from '../evaluateMandatoryFields.js';

const NOW = new Date('2026-11-10T12:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;

const emptyProfile = {
  userName: '',
  email: '',
  phoneNumber: '',
  height: null,
  dietType: '',
  gender: '',
  bodyFat: null,
  latestWeightBodyFat: null,
  bodyMetrics: null,
  communityId: null,
  physicalActivityLevel: '',
  bmr: null,
};

function rule(overrides) {
  return {
    fieldKey: 'name',
    required: true,
    graceType: 'days',
    graceLimit: 0,
    audience: 'both',
    minAppVersion: '3.5.0',
    notifyEnabled: true,
    ...overrides,
  };
}

describe('mandatory field registry', () => {
  it('registers the supported fields and nothing else', () => {
    assert.deepEqual(listRegisteredFieldKeys(), [
      'name',
      'gender',
      'height',
      'diet',
      'bodyFat',
      'email',
      'phone',
      'communityId',
      'communityPosition',
      'physicalActivity',
      'bmr',
    ]);
  });

  it('rejects an unknown admin key', () => {
    const result = validateAdminRule({
      fieldKey: 'address',
      required: true,
      graceType: 'days',
      graceLimit: 7,
      audience: 'both',
      minAppVersion: '3.5.0',
    });
    assert.equal(result.ok, false);
  });

  it('rejects a minimum version below the editor floor', () => {
    const result = validateAdminRule({
      fieldKey: 'communityId',
      required: true,
      graceType: 'skips',
      graceLimit: 3,
      audience: 'member',
      minAppVersion: '3.4.9',
    });
    assert.equal(result.ok, false);
  });
});

describe('evaluateMandatoryFields', () => {
  it('does not prompt when the stored value is already filled', () => {
    const result = evaluateMandatoryFields({
      rules: [rule({ fieldKey: 'name' }), rule({ fieldKey: 'email' })],
      profile: { ...emptyProfile, userName: 'Dhivya', email: 'dhivya@example.com' },
      role: 'user',
      appVersion: '3.5.5',
      now: NOW,
    });
    assert.equal(result.blocked, false);
    assert.deepEqual(result.fields, []);
  });

  it('treats user_<digits> as an empty name', () => {
    const result = evaluateMandatoryFields({
      rules: [rule()],
      profile: { ...emptyProfile, userName: 'user_919876543210', phoneNumber: '9876543210' },
      role: 'user',
      appVersion: '3.5.5',
      now: NOW,
    });
    assert.equal(result.fields.length, 1);
    assert.equal(result.fields[0].fieldKey, 'name');
    assert.equal(result.blocked, true);
  });

  it('blocks immediately when days or skips is zero', () => {
    const days = evaluateMandatoryFields({
      rules: [rule({ graceType: 'days', graceLimit: 0 })],
      profile: emptyProfile,
      role: 'user',
      appVersion: '3.5.5',
      now: NOW,
    });
    const skips = evaluateMandatoryFields({
      rules: [rule({ fieldKey: 'email', graceType: 'skips', graceLimit: 0 })],
      profile: emptyProfile,
      role: 'user',
      appVersion: '3.5.5',
      now: NOW,
    });
    assert.equal(days.blocked, true);
    assert.equal(skips.blocked, true);
    assert.equal(skips.fields[0].remaining, 0);
  });

  it('starts a day window on first presentation and blocks after it ends', () => {
    const first = evaluateMandatoryFields({
      rules: [rule({ graceType: 'days', graceLimit: 7 })],
      profile: emptyProfile,
      role: 'user',
      appVersion: '3.5.5',
      now: NOW,
    });
    assert.equal(first.blocked, false);
    assert.equal(first.fields[0].recordFirstNotification, true);
    assert.equal(first.fields[0].remaining, 7);

    const expired = evaluateMandatoryFields({
      rules: [rule({ graceType: 'days', graceLimit: 7 })],
      profile: emptyProfile,
      graceRows: [{ fieldKey: 'name', firstNotifiedAt: new Date(NOW.getTime() - (7 * DAY)), skipCount: 0 }],
      role: 'user',
      appVersion: '3.5.5',
      now: NOW,
    });
    assert.equal(expired.blocked, true);
    assert.equal(expired.fields[0].recordFirstNotification, false);
  });

  it('counts skips without treating a skip as completion', () => {
    const open = evaluateMandatoryFields({
      rules: [rule({ fieldKey: 'communityId', graceType: 'skips', graceLimit: 3 })],
      profile: { ...emptyProfile, communityId: '' },
      graceRows: [{ fieldKey: 'communityId', skipCount: 2, firstNotifiedAt: NOW }],
      role: 'user',
      appVersion: '3.5.5',
      now: NOW,
    });
    assert.equal(open.blocked, false);
    assert.equal(open.fields[0].remaining, 1);

    const planned = planSkip({
      rule: rule({ fieldKey: 'communityId', graceType: 'skips', graceLimit: 3 }),
      profile: { ...emptyProfile, communityId: '' },
      grace: { fieldKey: 'communityId', skipCount: 2, firstNotifiedAt: NOW },
      role: 'user',
      appVersion: '3.5.5',
      now: NOW,
    });
    assert.equal(planned.ok, true);
    assert.equal(planned.marksComplete, false);
    assert.equal(planned.nextSkipCount, 3);
    assert.equal(planned.expectedSkipCount, 2);

    const raced = planSkip({
      rule: rule({ fieldKey: 'communityId', graceType: 'skips', graceLimit: 3 }),
      profile: emptyProfile,
      grace: { fieldKey: 'communityId', skipCount: 3, firstNotifiedAt: NOW },
      role: 'user',
      appVersion: '3.5.5',
      now: NOW,
    });
    assert.equal(raced.ok, false);
    assert.equal(raced.reason, 'grace-expired');
  });

  it('lists every empty field and drops one when it becomes filled', () => {
    const rules = [
      rule({ fieldKey: 'name', graceLimit: 0 }),
      rule({ fieldKey: 'email', graceType: 'skips', graceLimit: 0 }),
      rule({ fieldKey: 'communityId', graceType: 'skips', graceLimit: 1 }),
    ];
    const both = evaluateMandatoryFields({
      rules,
      profile: emptyProfile,
      role: 'user',
      appVersion: '3.5.5',
      now: NOW,
    });
    assert.deepEqual(both.fields.map((field) => field.fieldKey), ['name', 'email', 'communityId']);
    assert.equal(both.blocked, true);

    const emailFilled = evaluateMandatoryFields({
      rules,
      profile: { ...emptyProfile, email: 'ada@example.com' },
      role: 'user',
      appVersion: '3.5.5',
      now: NOW,
    });
    assert.deepEqual(emailFilled.fields.map((field) => field.fieldKey), ['name', 'communityId']);
  });

  it('removes the block when the rule is turned off', () => {
    const result = evaluateMandatoryFields({
      rules: [rule({ required: false, graceLimit: 0 })],
      profile: emptyProfile,
      graceRows: [{ fieldKey: 'name', firstNotifiedAt: new Date(NOW.getTime() - DAY), skipCount: 9 }],
      role: 'user',
      appVersion: '3.5.5',
      now: NOW,
    });
    assert.equal(result.blocked, false);
    assert.deepEqual(result.fields, []);
  });

  it('does not let a missing version skip the field', () => {
    const missing = evaluateMandatoryFields({
      rules: [rule()],
      profile: emptyProfile,
      role: 'user',
      appVersion: null,
      now: NOW,
    });
    const blank = evaluateMandatoryFields({
      rules: [rule()],
      profile: emptyProfile,
      role: 'user',
      appVersion: 'not-a-version',
      now: NOW,
    });
    assert.equal(missing.fields.length, 1);
    assert.equal(blank.fields.length, 1);
  });

  it('does not enforce a field the installed version cannot edit', () => {
    const old = evaluateMandatoryFields({
      rules: [rule({ fieldKey: 'communityId', graceLimit: 0 })],
      profile: emptyProfile,
      role: 'user',
      appVersion: '3.4.9',
      now: NOW,
    });
    const current = evaluateMandatoryFields({
      rules: [rule({ fieldKey: 'communityId', graceLimit: 0 })],
      profile: emptyProfile,
      role: 'user',
      appVersion: '3.5.0',
      now: NOW,
    });
    assert.deepEqual(old.fields, []);
    assert.equal(current.blocked, true);
  });

  it('matches members and coaches and leaves admin out', () => {
    assert.equal(roleMatchesAudience('user', 'member'), true);
    assert.equal(roleMatchesAudience('coach', 'member'), false);
    assert.equal(roleMatchesAudience('upline', 'coach'), true);
    assert.equal(roleMatchesAudience('admin', 'both'), false);
    assert.equal(roleMatchesAudience('developer', 'both'), false);

    const coachOnly = evaluateMandatoryFields({
      rules: [rule({ audience: 'coach' })],
      profile: emptyProfile,
      role: 'user',
      appVersion: '3.5.5',
      now: NOW,
    });
    assert.deepEqual(coachOnly.fields, []);
  });

  it('ignores an unknown stored rule key', () => {
    const result = evaluateMandatoryFields({
      rules: [rule({ fieldKey: 'address', required: true })],
      profile: emptyProfile,
      role: 'user',
      appVersion: '3.5.5',
      now: NOW,
    });
    assert.deepEqual(result.unknownFieldKeys, ['address']);
    assert.equal(result.blocked, false);
  });

  it('still shows the field when notify is off, and days still expire', () => {
    const soft = evaluateMandatoryFields({
      rules: [rule({ graceType: 'days', graceLimit: 7, notifyEnabled: false })],
      profile: emptyProfile,
      role: 'user',
      appVersion: '3.5.5',
      now: NOW,
    });
    assert.equal(soft.enforcement, 'evaluated');
    assert.equal(soft.fields[0].showPrompt, true);
    assert.equal(soft.fields[0].notifyEnabled, false);
    assert.equal(soft.fields[0].recordFirstNotification, true);
    assert.equal(soft.blocked, false);
    assert.equal(soft.fields[0].remaining, 7);

    const later = evaluateMandatoryFields({
      rules: [rule({ graceType: 'days', graceLimit: 7, notifyEnabled: false })],
      profile: emptyProfile,
      graceRows: [{ fieldKey: 'name', firstNotifiedAt: new Date(NOW.getTime() - (8 * DAY)), skipCount: 0 }],
      role: 'user',
      appVersion: '3.5.5',
      now: NOW,
    });
    assert.equal(later.blocked, true);
    assert.equal(later.fields[0].showPrompt, true);
  });

  it('still shows a skips field when notify is off so the skip can be used', () => {
    const open = evaluateMandatoryFields({
      rules: [rule({ fieldKey: 'email', graceType: 'skips', graceLimit: 3, notifyEnabled: false })],
      profile: emptyProfile,
      graceRows: [{ fieldKey: 'email', skipCount: 1, firstNotifiedAt: NOW }],
      role: 'user',
      appVersion: '3.5.5',
      now: NOW,
    });
    assert.equal(open.fields[0].showPrompt, true);
    assert.equal(open.fields[0].notifyEnabled, false);
    assert.equal(open.blocked, false);
    assert.equal(open.fields[0].remaining, 2);

    const planned = planSkip({
      rule: rule({ fieldKey: 'email', graceType: 'skips', graceLimit: 3, notifyEnabled: false }),
      profile: emptyProfile,
      grace: { fieldKey: 'email', skipCount: 1, firstNotifiedAt: NOW },
      role: 'user',
      appVersion: '3.5.5',
      now: NOW,
    });
    assert.equal(planned.ok, true);
    assert.equal(planned.increment, true);
    assert.equal(planned.marksComplete, false);
    assert.equal(planned.nextSkipCount, 2);
  });

  it('returns an explicit unavailable result when the profile row could not be loaded', () => {
    const result = evaluateMandatoryFields({
      rules: [rule()],
      profile: null,
      role: 'user',
      appVersion: '3.5.5',
      now: NOW,
    });
    assert.equal(result.status, 'profile-unavailable');
    assert.equal(result.enforcement, 'unavailable');
    assert.deepEqual(result.fields, []);
    assert.equal(result.blocked, false);
    assert.notEqual(result.enforcement, 'evaluated');

    const skipped = planSkip({
      rule: rule({ graceType: 'skips', graceLimit: 3 }),
      profile: null,
      grace: { fieldKey: 'name', skipCount: 0 },
      role: 'user',
      appVersion: '3.5.5',
      now: NOW,
    });
    assert.equal(skipped.ok, false);
    assert.equal(skipped.reason, 'profile-unavailable');
    assert.equal(skipped.marksComplete, false);
  });

  it('accepts stored height, phone, diet, activity, bmr, and community id', () => {
    const result = evaluateMandatoryFields({
      rules: [
        rule({ fieldKey: 'height' }),
        rule({ fieldKey: 'phone' }),
        rule({ fieldKey: 'diet' }),
        rule({ fieldKey: 'physicalActivity' }),
        rule({ fieldKey: 'bmr' }),
        rule({ fieldKey: 'communityId' }),
        rule({ fieldKey: 'gender' }),
        rule({ fieldKey: 'bodyFat' }),
      ],
      profile: {
        ...emptyProfile,
        userName: 'Ada',
        height: '170.00',
        phoneNumber: '9876543210',
        dietType: 'Vegetarian',
        physicalActivityLevel: 'moderate',
        bmr: 1400,
        communityId: 'RS02E02',
        gender: 'Female',
        latestWeightBodyFat: 22,
      },
      role: 'user',
      appVersion: '3.5.5',
      now: NOW,
    });
    assert.deepEqual(result.fields, []);
  });

  it('accepts any community position when the scope is all', () => {
    const filled = evaluateMandatoryFields({
      rules: [rule({
        fieldKey: 'communityPosition',
        minAppVersion: '3.5.6',
        positionScope: 'all',
      })],
      profile: { ...emptyProfile, communityPosition: 'pt' },
      role: 'user',
      appVersion: '3.5.6',
      now: NOW,
    });
    assert.deepEqual(filled.fields, []);
  });

  it('accepts only the named community positions when the scope is specific', () => {
    const held = evaluateMandatoryFields({
      rules: [rule({
        fieldKey: 'communityPosition',
        minAppVersion: '3.5.6',
        positionScope: 'specific',
        positionCodes: ['PC', 'SV'],
      })],
      profile: { ...emptyProfile, communityPosition: 'pc' },
      role: 'user',
      appVersion: '3.5.6',
      now: NOW,
    });
    assert.deepEqual(held.fields, []);

    const other = evaluateMandatoryFields({
      rules: [rule({
        fieldKey: 'communityPosition',
        minAppVersion: '3.5.6',
        positionScope: 'specific',
        positionCodes: ['PC', 'SV'],
      })],
      profile: { ...emptyProfile, communityPosition: 'PT' },
      role: 'user',
      appVersion: '3.5.6',
      now: NOW,
    });
    assert.equal(other.fields[0].fieldKey, 'communityPosition');
    assert.equal(other.fields[0].blocking, true);
    assert.deepEqual(other.fields[0].positionCodes, ['PC', 'SV']);
  });

  it('does not block an app older than the community position editor', () => {
    const result = evaluateMandatoryFields({
      rules: [rule({ fieldKey: 'communityPosition', minAppVersion: '3.5.6', graceLimit: 0 })],
      profile: emptyProfile,
      role: 'user',
      appVersion: '3.5.5',
      now: NOW,
    });
    assert.equal(result.blocked, false);
    assert.deepEqual(result.fields, []);
  });

  it('asks again after the configured number of days, and still shows a blocking field', () => {
    const open = evaluateMandatoryFields({
      rules: [rule({
        fieldKey: 'email',
        graceType: 'days',
        graceLimit: 10,
        remindEveryDays: 3,
      })],
      profile: emptyProfile,
      graceRows: [{
        fieldKey: 'email',
        firstNotifiedAt: new Date('2026-11-01T00:00:00.000Z'),
        lastPromptedAt: new Date('2026-11-08T00:00:00.000Z'),
        skipCount: 0,
      }],
      role: 'user',
      appVersion: '3.5.5',
      now: new Date('2026-11-09T00:00:00.000Z'),
    });
    assert.equal(open.fields[0].showPrompt, false);
    assert.equal(open.fields[0].blocking, false);
    assert.equal(open.fields[0].recordPrompt, false);

    const due = evaluateMandatoryFields({
      rules: [rule({
        fieldKey: 'email',
        graceType: 'days',
        graceLimit: 10,
        remindEveryDays: 3,
      })],
      profile: emptyProfile,
      graceRows: [{
        fieldKey: 'email',
        firstNotifiedAt: new Date('2026-11-01T00:00:00.000Z'),
        lastSkippedAt: new Date('2026-11-07T00:00:00.000Z'),
        skipCount: 0,
      }],
      role: 'user',
      appVersion: '3.5.5',
      now: new Date('2026-11-10T00:00:00.000Z'),
    });
    assert.equal(due.fields[0].showPrompt, true);
    assert.equal(due.fields[0].recordPrompt, true);
    assert.equal(due.blocked, false);

    const locked = evaluateMandatoryFields({
      rules: [rule({
        fieldKey: 'email',
        graceType: 'days',
        graceLimit: 7,
        remindEveryDays: 3,
      })],
      profile: emptyProfile,
      graceRows: [{
        fieldKey: 'email',
        firstNotifiedAt: new Date('2026-11-01T00:00:00.000Z'),
        lastPromptedAt: new Date('2026-11-10T00:00:00.000Z'),
        skipCount: 0,
      }],
      role: 'user',
      appVersion: '3.5.5',
      now: new Date('2026-11-11T00:00:00.000Z'),
    });
    assert.equal(locked.fields[0].blocking, true);
    assert.equal(locked.fields[0].showPrompt, true);
    assert.equal(locked.fields[0].recordPrompt, false);
  });

  it('rejects an empty specific position list and a negative ask interval', () => {
    const positions = validateAdminRule({
      fieldKey: 'communityPosition',
      required: true,
      graceType: 'days',
      graceLimit: 7,
      audience: 'both',
      minAppVersion: '3.5.6',
      positionScope: 'specific',
      positionCodes: [],
    });
    assert.equal(positions.ok, false);

    const interval = validateAdminRule({
      fieldKey: 'email',
      required: true,
      graceType: 'days',
      graceLimit: 7,
      audience: 'both',
      minAppVersion: '3.5.0',
      remindEveryDays: -1,
    });
    assert.equal(interval.ok, false);

    const saved = validateAdminRule({
      fieldKey: 'communityPosition',
      required: true,
      graceType: 'skips',
      graceLimit: 3,
      audience: 'member',
      minAppVersion: '3.5.6',
      remindEveryDays: 3,
      positionScope: 'specific',
      positionCodes: ['get team', 'PC'],
    });
    assert.equal(saved.ok, true);
    assert.equal(saved.rule.remindEveryDays, 3);
    assert.deepEqual(saved.rule.positionCodes, ['GET TEAM', 'PC']);
  });
});
