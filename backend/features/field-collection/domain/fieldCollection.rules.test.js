/**
 * Run: node --test backend/features/field-collection/domain/fieldCollection.rules.test.js
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  collectionRoleFromAppRole,
  decideField,
  defaultFieldPolicy,
  hasFieldValue,
  normalizeFieldPolicy,
  planCollectionStep,
  valuesFromProfile,
} from './fieldCollection.rules.js';

const NOW = new Date('2026-11-12T04:30:00.000Z'); // 10:00 IST
const YESTERDAY = '2026-11-11T04:30:00.000Z';
const TODAY = '2026-11-12T02:30:00.000Z';

const filledEntry = {
  communityPosition: 'PC',
  gender: 'Female',
  age: 32,
  height: 160,
  diet: 'Vegetarian',
  lifestyle: 'moderate',
  photoLeft: 'data:image/jpeg;base64,aaa',
  photoCentre: 'data:image/jpeg;base64,bbb',
  photoRight: 'data:image/jpeg;base64,ccc',
  currentWeight: 70,
  weightRecordedAt: TODAY,
  fatPercent: 22,
  bodyAge: 30,
  chest: 90,
  waist: 80,
  hip: 95,
  healthIssues: ['Knee Pain'],
};

function settledStates(overrides = {}) {
  const keys = ['fatPercent', 'bodyAge', 'chest', 'waist', 'hip', 'healthIssues'];
  const states = {};
  keys.forEach((key) => {
    states[key] = {
      skipCount: 0,
      cycleStartedAt: null,
      lastFilledAt: TODAY,
      lastSkippedAt: null,
    };
  });
  return { ...states, ...overrides };
}

describe('collectionRoleFromAppRole', () => {
  it('maps app roles onto member, coach, or exempt', () => {
    assert.equal(collectionRoleFromAppRole('user'), 'member');
    assert.equal(collectionRoleFromAppRole('coach'), 'coach');
    assert.equal(collectionRoleFromAppRole('upline'), 'coach');
    assert.equal(collectionRoleFromAppRole('admin'), 'exempt');
    assert.equal(collectionRoleFromAppRole('developer'), 'exempt');
    assert.equal(collectionRoleFromAppRole(''), 'member');
  });
});

describe('normalizeFieldPolicy', () => {
  it('keeps an admin schedule for community position', () => {
    const fields = normalizeFieldPolicy([{
      key: 'communityPosition',
      phase: 'scheduled',
      audience: 'coach',
      positions: ['PC'],
      askEveryDays: 1,
      maxSkips: 4,
      mustFillWithinDays: 3,
    }]);
    const position = fields.find((field) => field.key === 'communityPosition');
    assert.equal(position.phase, 'scheduled');
    assert.equal(position.audience, 'coach');
    assert.deepEqual(position.positions, ['PC']);
    assert.equal(position.maxSkips, 4);
    assert.equal(position.locked, false);
  });

  it('asks again the same day when every days is 0', () => {
    const fields = normalizeFieldPolicy([{
      key: 'currentWeight',
      phase: 'scheduled',
      askEveryDays: 0,
      maxSkips: 2,
      mustFillWithinDays: 3,
    }]);
    const weight = fields.find((field) => field.key === 'currentWeight');
    assert.equal(weight.askEveryDays, 0);

    const plan = planCollectionStep({
      fields,
      values: { ...filledEntry, currentWeight: 70, weightRecordedAt: TODAY },
      states: {
        currentWeight: {
          skipCount: 1,
          cycleStartedAt: TODAY,
          lastFilledAt: null,
          lastSkippedAt: TODAY,
        },
      },
      role: 'member',
      now: NOW,
    });
    assert.equal(plan.step, 'scheduled');
    assert.equal(plan.scheduled.key, 'currentWeight');
    assert.equal(plan.scheduled.mode, 'ask_skippable');
  });

  it('moves past a same-day field after it was handled in this visit', () => {
    const fields = defaultFieldPolicy().map((field) => (
      field.key === 'currentWeight'
        ? { ...field, askEveryDays: 0, maxSkips: 2, mustFillWithinDays: 3 }
        : field
    ));
    const plan = planCollectionStep({
      fields,
      values: { ...filledEntry, currentWeight: 70, weightRecordedAt: TODAY },
      states: settledStates({
        currentWeight: {
          skipCount: 1,
          cycleStartedAt: TODAY,
          lastFilledAt: null,
          lastSkippedAt: TODAY,
        },
      }),
      deferKeys: ['currentWeight'],
      role: 'member',
      now: NOW,
    });
    assert.notEqual(plan.scheduled?.key, 'currentWeight');
  });

  it('keeps later-field schedule numbers inside bounds', () => {
    const fields = normalizeFieldPolicy([{
      key: 'fatPercent',
      phase: 'scheduled',
      audience: 'member',
      positions: ['pc', 'NOPE'],
      askEveryDays: 3,
      maxSkips: 1,
      mustFillWithinDays: 9,
    }]);
    const fat = fields.find((field) => field.key === 'fatPercent');
    assert.equal(fat.audience, 'member');
    assert.deepEqual(fat.positions, ['PC']);
    assert.equal(fat.askEveryDays, 3);
    assert.equal(fat.maxSkips, 1);
    assert.equal(fat.mustFillWithinDays, 9);
  });
});

describe('hasFieldValue communityPosition', () => {
  it('accepts legacy codes', () => {
    assert.equal(hasFieldValue('communityPosition', { communityPosition: 'PC' }), true);
    assert.equal(hasFieldValue('communityPosition', { communityPosition: 'associate' }), true);
  });

  it('accepts catalog codes outside the legacy list', () => {
    assert.equal(hasFieldValue('communityPosition', { communityPosition: 'WORLD TEAM' }), true);
  });

  it('rejects empty or invalid codes', () => {
    assert.equal(hasFieldValue('communityPosition', { communityPosition: '' }), false);
    assert.equal(hasFieldValue('communityPosition', { communityPosition: '!!!' }), false);
  });
});

describe('valuesFromProfile communityPosition', () => {
  it('falls back to communityPosition.code when eventLevel is empty', () => {
    const values = valuesFromProfile({
      eventLevel: '',
      communityPosition: { code: 'WORLD TEAM', label: 'World Team' },
    });
    assert.equal(values.communityPosition, 'WORLD TEAM');
  });
});

describe('planCollectionStep', () => {
  it('asks community position before any other field', () => {
    const plan = planCollectionStep({
      fields: defaultFieldPolicy(),
      values: { ...filledEntry, communityPosition: '' },
      role: 'member',
      now: NOW,
    });
    assert.equal(plan.step, 'communityPosition');
    assert.deepEqual(plan.entryFields, []);
  });

  it('does not re-ask when a catalog community position is already saved', () => {
    const plan = planCollectionStep({
      fields: defaultFieldPolicy(),
      values: { ...filledEntry, communityPosition: 'WORLD TEAM' },
      role: 'member',
      now: NOW,
      states: settledStates(),
    });
    assert.notEqual(plan.step, 'communityPosition');
  });

  it('asks entry fields while community position is set to ask later', () => {
    const fields = defaultFieldPolicy().map((field) => (
      field.key === 'communityPosition'
        ? { ...field, phase: 'scheduled', askEveryDays: 1, maxSkips: 2, mustFillWithinDays: 3 }
        : field
    ));
    const plan = planCollectionStep({
      fields,
      values: { ...filledEntry, communityPosition: '', gender: '' },
      role: 'member',
      now: NOW,
    });
    assert.equal(plan.step, 'entryFields');
    assert.deepEqual(plan.entryFields, ['gender']);
  });

  it('asks a later community position with a skip', () => {
    const fields = defaultFieldPolicy().map((field) => (
      field.key === 'communityPosition'
        ? { ...field, phase: 'scheduled', askEveryDays: 1, maxSkips: 2, mustFillWithinDays: 3 }
        : field
    ));
    const plan = planCollectionStep({
      fields,
      values: { ...filledEntry, communityPosition: '' },
      states: settledStates(),
      role: 'member',
      now: NOW,
    });
    assert.equal(plan.step, 'scheduled');
    assert.equal(plan.scheduled.key, 'communityPosition');
    assert.equal(plan.scheduled.mode, 'ask_skippable');
    assert.equal(plan.scheduled.skipsRemaining, 2);
  });

  it('hides a position-specific field until community position is known', () => {
    const fields = defaultFieldPolicy().map((field) => (
      field.key === 'height' ? { ...field, positions: ['WT'] } : field
    ));
    const mode = decideField({
      field: fields.find((field) => field.key === 'height'),
      values: { ...filledEntry, communityPosition: '', height: '' },
      role: 'member',
      now: NOW,
    });
    assert.equal(mode, 'hidden');
  });

  it('asks only the missing entry fields after position is set', () => {
    const plan = planCollectionStep({
      fields: defaultFieldPolicy(),
      values: { ...filledEntry, age: '', diet: '' },
      role: 'member',
      now: NOW,
    });
    assert.equal(plan.step, 'entryFields');
    assert.deepEqual(plan.entryFields, ['age', 'diet']);
  });

  it('hides a coach-only field from a member', () => {
    const fields = defaultFieldPolicy().map((field) => (
      field.key === 'age' ? { ...field, audience: 'coach' } : field
    ));
    const plan = planCollectionStep({
      fields,
      values: { ...filledEntry, age: '' },
      states: settledStates(),
      role: 'member',
      now: NOW,
    });
    assert.equal(plan.step, 'done');
  });

  it('hides a field that does not apply to this community position', () => {
    const fields = defaultFieldPolicy().map((field) => (
      field.key === 'height' ? { ...field, positions: ['WT'] } : field
    ));
    const mode = decideField({
      field: fields.find((field) => field.key === 'height'),
      values: { ...filledEntry, communityPosition: 'PC', height: '' },
      role: 'member',
      now: NOW,
    });
    assert.equal(mode, 'hidden');
  });

  it('asks left, centre, and right before lifestyle when those photos are missing', () => {
    const plan = planCollectionStep({
      fields: defaultFieldPolicy(),
      values: { ...filledEntry, photoLeft: '', photoCentre: '', photoRight: '', lifestyle: '' },
      role: 'coach',
      now: NOW,
    });
    assert.equal(plan.step, 'photos');
    assert.deepEqual(plan.photoSlots, ['left', 'front', 'right']);
  });

  it('does not stop admin or developer', () => {
    const plan = planCollectionStep({
      fields: defaultFieldPolicy(),
      values: {},
      role: 'exempt',
      now: NOW,
    });
    assert.equal(plan.step, 'done');
  });

  it('asks current weight the next IST day, and allows a skip until the limit', () => {
    const due = planCollectionStep({
      fields: defaultFieldPolicy(),
      values: { ...filledEntry, currentWeight: 70, weightRecordedAt: YESTERDAY },
      states: settledStates(),
      role: 'member',
      now: NOW,
    });
    assert.equal(due.step, 'scheduled');
    assert.equal(due.scheduled.key, 'currentWeight');
    assert.equal(due.scheduled.mode, 'ask_skippable');

    const fresh = planCollectionStep({
      fields: defaultFieldPolicy(),
      values: { ...filledEntry, currentWeight: 70, weightRecordedAt: TODAY },
      states: settledStates(),
      role: 'member',
      now: NOW,
    });
    assert.equal(fresh.step, 'done');

    const blocked = planCollectionStep({
      fields: defaultFieldPolicy(),
      values: { ...filledEntry, currentWeight: 70, weightRecordedAt: YESTERDAY },
      states: settledStates({
        currentWeight: { skipCount: 2, cycleStartedAt: YESTERDAY, lastFilledAt: null, lastSkippedAt: YESTERDAY },
      }),
      role: 'member',
      now: NOW,
    });
    assert.equal(blocked.scheduled.mode, 'ask_blocking');
    assert.equal(blocked.scheduled.skipsRemaining, 0);
  });

  it('blocks a later field once the must-fill day has passed', () => {
    const plan = planCollectionStep({
      fields: defaultFieldPolicy(),
      values: filledEntry,
      states: settledStates({
        fatPercent: {
          skipCount: 0,
          cycleStartedAt: '2026-11-01T04:30:00.000Z',
          lastFilledAt: null,
          lastSkippedAt: TODAY,
        },
      }),
      role: 'member',
      now: NOW,
    });
    assert.equal(plan.step, 'scheduled');
    assert.equal(plan.scheduled.key, 'fatPercent');
    assert.equal(plan.scheduled.mode, 'ask_blocking');
  });

  it('keeps profile introduction fields off the gate until an admin asks for them', () => {
    const title = defaultFieldPolicy().find((field) => field.key === 'professionalTitle');
    assert.equal(title.phase, 'profile');
    const plan = planCollectionStep({
      fields: defaultFieldPolicy(),
      values: filledEntry,
      states: settledStates(),
      role: 'member',
      now: NOW,
    });
    assert.equal(plan.step, 'done');
  });

  it('asks profile introduction fields while entering when the admin sets that', () => {
    const fields = defaultFieldPolicy().map((field) => (
      field.key === 'professionalTitle' ? { ...field, phase: 'entry' } : field
    ));
    const plan = planCollectionStep({
      fields,
      values: filledEntry,
      states: settledStates(),
      role: 'member',
      now: NOW,
    });
    assert.equal(plan.step, 'profileIntro');
    assert.deepEqual(plan.profileFields, ['professionalTitle']);
  });
});
