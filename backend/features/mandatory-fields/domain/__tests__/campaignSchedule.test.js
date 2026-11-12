/**
 * Run: node --test backend/features/mandatory-fields/domain/__tests__/campaignSchedule.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  campaignBlocksAccess,
  campaignDayIndex,
  dueReminderDays,
  nextRequiredSince,
} from '../campaignSchedule.js';
import { claimReminderSlot, releaseReminderSlot, mandatoryRulesReadState } from '../../data/mandatoryFields.repo.js';
import { authorizeMandatoryCron } from '../access.rules.js';
import { evaluateMandatoryFields } from '../evaluateMandatoryFields.js';
import { runDueMandatoryReminders } from '../../campaignReminders.service.js';

const START = new Date('2026-11-01T00:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;

function atDay(day) {
  return new Date(START.getTime() + (day * DAY) + 1000);
}

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
  communityPosition: null,
};

function nameRule(overrides) {
  return {
    fieldKey: 'name',
    required: true,
    graceType: 'days',
    graceLimit: 0,
    audience: 'both',
    minAppVersion: '3.5.0',
    notifyEnabled: true,
    requiredSince: START,
    ...overrides,
  };
}

describe('campaign clock', () => {
  it('marks days 0, 2, 4, 6, and 8 without blocking before day 10', () => {
    assert.equal(campaignDayIndex(START, atDay(0)), 0);
    assert.deepEqual(dueReminderDays(0, 0), []);
    assert.deepEqual(dueReminderDays(2, 0), [2]);
    assert.deepEqual(dueReminderDays(4, 0), [2, 4]);
    assert.deepEqual(dueReminderDays(6, 0b011), [6]);
    assert.deepEqual(dueReminderDays(8, 0), [2, 4, 6, 8]);
    assert.equal(campaignBlocksAccess(8), false);
    assert.equal(campaignBlocksAccess(10), true);
  });

  it('does not restart the clock when the same requiredSince is reused', () => {
    const first = campaignDayIndex(START, atDay(3));
    const again = campaignDayIndex(START, atDay(3));
    assert.equal(first, again);
  });

  it('blocks at exactly ten 24-hour periods and not one millisecond earlier', () => {
    const start = new Date('2026-11-01T18:30:00.000Z');
    const almost = new Date(start.getTime() + (10 * DAY) - 1);
    const exact = new Date(start.getTime() + (10 * DAY));
    assert.equal(campaignDayIndex(start, almost), 9);
    assert.equal(campaignBlocksAccess(campaignDayIndex(start, almost)), false);
    assert.equal(campaignDayIndex('2026-11-01T18:30:00.000Z', exact.toISOString()), 10);
    assert.equal(campaignBlocksAccess(campaignDayIndex(start, exact)), true);
  });

  it('starts a new clock when Required turns on again and keeps it while Required stays on', () => {
    const now = new Date('2026-11-20T00:00:00.000Z');
    const expired = new Date('2026-11-01T00:00:00.000Z');
    const again = nextRequiredSince({
      wasRequired: false,
      previousSince: expired,
      required: true,
      now,
    });
    assert.equal(again.restarted, true);
    assert.equal(again.requiredSince, now);
    assert.equal(campaignBlocksAccess(campaignDayIndex(again.requiredSince, now)), false);

    const resume = nextRequiredSince({
      wasRequired: true,
      previousSince: expired,
      required: true,
      now,
    });
    assert.equal(resume.restarted, false);
    assert.equal(resume.requiredSince, expired);

    const off = nextRequiredSince({
      wasRequired: true,
      previousSince: expired,
      required: false,
      now,
    });
    assert.equal(off.restarted, false);
    assert.equal(off.requiredSince, expired);
  });
});

describe('campaign enforcement', () => {
  it('requires a zero grace immediately and keeps a real grace period until day 10', () => {
    const immediate = evaluateMandatoryFields({
      rules: [nameRule({ graceLimit: 0 })],
      profile: emptyProfile,
      role: 'user',
      appVersion: '3.5.6',
      now: atDay(0),
    });
    assert.equal(immediate.blocked, true);
    assert.equal(immediate.fields[0].blocking, true);
    assert.equal(immediate.fields[0].remaining, 0);

    const grace = evaluateMandatoryFields({
      rules: [nameRule({ graceLimit: 10 })],
      profile: emptyProfile,
      graceRows: [{ fieldKey: 'name', firstNotifiedAt: START, skipCount: 0 }],
      role: 'user',
      appVersion: '3.5.6',
      now: atDay(0),
    });
    assert.equal(grace.blocked, false);
    assert.equal(grace.fields[0].blocking, false);
    assert.equal(grace.fields[0].remaining, 10);

    const locked = evaluateMandatoryFields({
      rules: [nameRule({ graceLimit: 10 })],
      profile: emptyProfile,
      graceRows: [{ fieldKey: 'name', firstNotifiedAt: START, skipCount: 0 }],
      role: 'user',
      appVersion: '3.5.6',
      now: atDay(10),
    });
    assert.equal(locked.blocked, true);
    assert.equal(locked.fields[0].blocking, true);
  });

  it('unlocks when the field is filled and when the rule is turned off', () => {
    const filled = evaluateMandatoryFields({
      rules: [nameRule()],
      profile: { ...emptyProfile, userName: 'Asha' },
      role: 'user',
      appVersion: '3.5.6',
      now: atDay(12),
    });
    assert.equal(filled.blocked, false);
    assert.deepEqual(filled.fields, []);

    const off = evaluateMandatoryFields({
      rules: [nameRule({ required: false })],
      profile: emptyProfile,
      role: 'user',
      appVersion: '3.5.6',
      now: atDay(12),
    });
    assert.equal(off.blocked, false);
    assert.deepEqual(off.fields, []);
  });

  it('blocks when any one of several campaigns is past day 10', () => {
    const result = evaluateMandatoryFields({
      rules: [
        nameRule(),
        nameRule({
          fieldKey: 'phone',
          graceLimit: 10,
          requiredSince: atDay(8),
        }),
      ],
      profile: { ...emptyProfile, userName: 'Asha' },
      role: 'user',
      appVersion: '3.5.6',
      now: atDay(10),
    });
    assert.equal(result.blocked, false);
    assert.deepEqual(result.fields.map((field) => field.fieldKey), ['phone']);

    const overdue = evaluateMandatoryFields({
      rules: [
        nameRule(),
        nameRule({ fieldKey: 'phone', requiredSince: START }),
      ],
      profile: { ...emptyProfile, userName: 'Asha' },
      role: 'user',
      appVersion: '3.5.6',
      now: atDay(10),
    });
    assert.equal(overdue.blocked, true);
    assert.deepEqual(overdue.fields.map((field) => field.fieldKey), ['phone']);

    const bothOpen = evaluateMandatoryFields({
      rules: [
        nameRule(),
        nameRule({ fieldKey: 'phone', graceLimit: 10, requiredSince: atDay(8) }),
      ],
      profile: emptyProfile,
      role: 'user',
      appVersion: '3.5.6',
      now: atDay(10),
    });
    assert.equal(bothOpen.blocked, true);
    assert.deepEqual(bothOpen.fields.map((field) => field.fieldKey), ['name', 'phone']);
    assert.equal(bothOpen.fields.find((field) => field.fieldKey === 'phone').blocking, false);
  });

  it('blocks when the campaign timestamp cannot be read', () => {
    const result = evaluateMandatoryFields({
      rules: [nameRule({ requiredSince: 'not-a-date' })],
      profile: emptyProfile,
      role: 'user',
      appVersion: '3.5.6',
      now: atDay(0),
    });
    assert.equal(result.blocked, true);
    assert.equal(result.fields[0].blocking, true);
  });

  it('does not block admin accounts', () => {
    const result = evaluateMandatoryFields({
      rules: [nameRule()],
      profile: emptyProfile,
      role: 'admin',
      appVersion: '3.5.6',
      now: atDay(12),
    });
    assert.deepEqual(result.fields, []);
  });
});

describe('reminder pass', () => {
  it('sends each due slot once and skips a completed field', async () => {
    const sent = [];
    const claims = [];
    const result = await runDueMandatoryReminders({
      now: atDay(4),
      listRules: async () => [{
        field_key: 'name',
        required: true,
        required_since: START,
        notify_enabled: true,
        audience: 'both',
        position_scope: 'all',
        position_codes: null,
      }],
      listCandidates: async () => [
        { UserId: 7, Email: 'member@example.com', Role: 'user', UserName: '', EventLevel: null },
        { UserId: 8, Email: 'done@example.com', Role: 'user', UserName: 'Done', EventLevel: null },
        { UserId: 9, Email: 'admin@example.com', Role: 'admin', UserName: '', EventLevel: null },
      ],
      listGrace: async () => [],
      claimSlot: async (input) => {
        claims.push(input);
        return true;
      },
      send: async (message) => {
        sent.push(message);
      },
    });
    assert.equal(result.sent, 2);
    assert.deepEqual(sent.map((message) => message.to), ['member@example.com', 'member@example.com']);
    assert.equal(claims.length, 2);
    assert.equal(claims[0].expectedMask, 0);
    assert.equal(claims[1].expectedMask, claims[0].nextMask);
  });

  it('does not send when the slot was already claimed', async () => {
    const sent = [];
    const result = await runDueMandatoryReminders({
      now: atDay(2),
      listRules: async () => [{
        field_key: 'name',
        required: true,
        required_since: START,
        notify_enabled: true,
        audience: 'member',
        position_scope: 'all',
      }],
      listCandidates: async () => [
        { UserId: 7, Email: 'member@example.com', Role: 'user', UserName: '' },
      ],
      listGrace: async () => [{ user_id: 7, field_key: 'name', reminder_mask: 1 }],
      claimSlot: async () => true,
      send: async (message) => sent.push(message),
    });
    assert.equal(result.sent, 0);
    assert.deepEqual(sent, []);
  });

  it('releases the slot when sending fails and does not send a later day', async () => {
    const claims = [];
    const releases = [];
    const result = await runDueMandatoryReminders({
      now: atDay(4),
      listRules: async () => [{
        field_key: 'name',
        required: true,
        required_since: START,
        notify_enabled: true,
        audience: 'member',
        position_scope: 'all',
      }],
      listCandidates: async () => [
        { UserId: 7, Email: 'member@example.com', Role: 'user', UserName: '' },
      ],
      listGrace: async () => [],
      claimSlot: async (input) => {
        claims.push(input);
        return true;
      },
      releaseSlot: async (input) => {
        releases.push(input);
        return true;
      },
      send: async () => {
        throw new Error('smtp down for member@example.com');
      },
    });
    assert.equal(result.sent, 0);
    assert.equal(result.failed, 1);
    assert.equal(claims.length, 1);
    assert.equal(claims[0].expectedMask, 0);
    assert.equal(releases.length, 1);
    assert.equal(releases[0].previousMask, 0);
    assert.equal(releases[0].expectedMask, claims[0].nextMask);
  });

  it('does not claim a slot when the member has no email address', async () => {
    let claims = 0;
    const result = await runDueMandatoryReminders({
      now: atDay(2),
      listRules: async () => [{
        field_key: 'name',
        required: true,
        required_since: START,
        notify_enabled: true,
        audience: 'member',
        position_scope: 'all',
      }],
      listCandidates: async () => [
        { UserId: 7, Email: '   ', Role: 'user', UserName: '' },
      ],
      listGrace: async () => [],
      claimSlot: async () => {
        claims += 1;
        return true;
      },
      send: async () => {
        throw new Error('should not send');
      },
    });
    assert.equal(claims, 0);
    assert.equal(result.sent, 0);
    assert.equal(result.skippedNoEmail, 1);
  });

  it('lets only one of two concurrent claims take a slot', async () => {
    let store = null;
    const client = {
      user_field_grace: {
        async updateMany({ where, data }) {
          if (!store || store.reminder_mask !== where.reminder_mask) return { count: 0 };
          store.reminder_mask = data.reminder_mask;
          return { count: 1 };
        },
        async create({ data }) {
          if (store) {
            const err = new Error('unique');
            err.code = 'P2002';
            throw err;
          }
          store = { ...data };
        },
      },
    };
    const input = { userId: 7, fieldKey: 'name', expectedMask: 0, nextMask: 1 };
    const [first, second] = await Promise.all([
      claimReminderSlot(input, client),
      claimReminderSlot(input, client),
    ]);
    assert.equal(first !== second, true);
    assert.equal(store.reminder_mask, 1);
    const released = await releaseReminderSlot({
      userId: 7,
      fieldKey: 'name',
      expectedMask: 1,
      previousMask: 0,
    }, client);
    assert.equal(released, true);
    assert.equal(store.reminder_mask, 0);
  });
});

describe('campaign schema and cron auth', () => {
  it('fails closed when campaign columns are missing and stays open when the tables are absent', () => {
    const columns = mandatoryRulesReadState({ code: 'P2022' });
    assert.equal(columns.reason, 'campaign-columns-missing');
    assert.equal(columns.failed, true);
    assert.equal(columns.schemaReady, false);
    const tables = mandatoryRulesReadState({
      message: "Table 'wellness.mandatory_field_rules' doesn't exist",
    });
    assert.equal(tables.reason, 'tables-missing');
    assert.equal(tables.failed, false);
    assert.equal(mandatoryRulesReadState({ code: 'P1001', message: 'Cannot reach database server' }).reason, 'read-failed');
  });

  it('rejects a missing secret, a bad bearer, and a disallowed method before running', () => {
    assert.equal(authorizeMandatoryCron({ method: 'POST', authorization: 'Bearer secret', secret: '' }).status, 500);
    assert.equal(authorizeMandatoryCron({ method: 'POST', authorization: 'Bearer wrong', secret: 'secret' }).status, 401);
    assert.equal(authorizeMandatoryCron({ method: 'DELETE', authorization: 'Bearer secret', secret: 'secret' }).status, 405);
    assert.equal(authorizeMandatoryCron({ method: 'POST', authorization: 'Bearer secret', secret: 'secret' }).ok, true);
    assert.equal(authorizeMandatoryCron({ method: 'GET', authorization: 'Bearer secret', secret: 'secret' }).ok, true);
  });
});
