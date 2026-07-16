/**
 * Unit tests for Body Parameters Card ↔ Profile sync rules.
 * Run: node --test backend/features/body-parameters-card/domain/sync.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  syncValuesEqual,
  buildTeamTableDiff,
  buildWeightInsertIfChanged,
  buildCardPatchFromProfile,
  hasSyncWrites,
} from './sync.rules.js';

describe('syncValuesEqual', () => {
  it('treats null/undefined/empty as equal', () => {
    assert.equal(syncValuesEqual(null, undefined), true);
    assert.equal(syncValuesEqual('', null), true);
  });

  it('compares numbers numerically', () => {
    assert.equal(syncValuesEqual(170, 170.0), true);
    assert.equal(syncValuesEqual(170, 171), false);
  });

  it('trims strings', () => {
    assert.equal(syncValuesEqual(' Ada ', 'Ada'), true);
  });
});

describe('buildTeamTableDiff', () => {
  const card = {
    name: 'Ada',
    height_cm: 170,
    weight_kg: 70,
    fat_percent: 20,
    bmr: 1500,
  };

  it('returns empty when profile already matches', () => {
    // Katch-McArdle: 70kg @ 20% → LBM 56 → BMR 1580
    const diff = buildTeamTableDiff(card, {
      userName: 'Ada',
      height: 170,
      bmr: 1580,
    });
    assert.deepEqual(diff, {});
  });

  it('includes only changed team_table fields', () => {
    const diff = buildTeamTableDiff(card, {
      userName: 'Old',
      height: 165,
      bmr: 1400,
    });
    assert.equal(diff.UserName, 'Ada');
    assert.equal(diff.Height, 170);
    assert.equal(diff.Bmr, 1580);
  });

  it('does not overwrite with null card values', () => {
    const diff = buildTeamTableDiff(
      { name: null, height_cm: null, weight_kg: null, fat_percent: null, bmr: null },
      { userName: 'Ada', height: 170, bmr: 1500 },
    );
    assert.deepEqual(diff, {});
  });
});

describe('buildWeightInsertIfChanged', () => {
  const card = {
    weight_kg: 70,
    fat_percent: 20,
    bmi: 24.2,
    bmr: 1500,
  };

  it('returns null when card has no weight', () => {
    assert.equal(buildWeightInsertIfChanged({ weight_kg: null }, 1, null), null);
  });

  it('inserts when no prior weight record', () => {
    const row = buildWeightInsertIfChanged(card, 42, null);
    assert.equal(row.UserId, 42);
    assert.equal(row.Weight, 70);
    assert.equal(row.BodyFat, 20);
    assert.equal(row.Bmi, 24.2);
    assert.equal(row.Bmr, 1580);
  });

  it('skips insert when latest weight already matches', () => {
    const row = buildWeightInsertIfChanged(card, 42, {
      weight: 70,
      bodyFat: 20,
      bmi: 24.2,
      bmr: 1580,
    });
    assert.equal(row, null);
  });

  it('inserts when fat % changed', () => {
    const row = buildWeightInsertIfChanged(card, 42, {
      weight: 70,
      bodyFat: 18,
      bmi: 24.2,
      bmr: 1580,
    });
    assert.ok(row);
    assert.equal(row.BodyFat, 20);
  });
});

describe('buildCardPatchFromProfile', () => {
  const card = { name: 'Ada', height_cm: 170, bmr: 1500 };

  it('returns empty when nothing changed', () => {
    assert.deepEqual(
      buildCardPatchFromProfile(card, { name: 'Ada', height: 170, bmr: 1500 }),
      {},
    );
  });

  it('patches only changed fields', () => {
    const patch = buildCardPatchFromProfile(card, {
      name: 'Ada Lovelace',
      height: 172,
      bmr: 1600,
    });
    assert.deepEqual(patch, {
      name: 'Ada Lovelace',
      height_cm: 172,
      bmr: 1600,
    });
  });

  it('never includes card-only fields', () => {
    const patch = buildCardPatchFromProfile(card, {
      name: 'Ada',
      age: 30,
      gender: 'Female',
      chest: 90,
    });
    assert.deepEqual(patch, {});
  });
});

describe('hasSyncWrites', () => {
  it('detects team or weight writes', () => {
    assert.equal(hasSyncWrites({}, null), false);
    assert.equal(hasSyncWrites({ Height: 170 }, null), true);
    assert.equal(hasSyncWrites({}, { Weight: 70 }), true);
  });
});
