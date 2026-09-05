/**
 * Run: node --test backend/shared/lib/r2/__tests__/objectKeys.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  R2_FOLDERS,
  buildAvatarObjectKey,
  buildTransformationObjectKey,
  buildFoodObjectKey,
  buildWeightObjectKey,
  buildEducationObjectKey,
  buildGoodHabitObjectKey,
  isKeyInFolder,
  orphanedAvatarKeys,
} from '../objectKeys.js';

describe('R2 folder isolation', () => {
  it('keeps avatars out of food and transformation prefixes', () => {
    const avatar = buildAvatarObjectKey(42, 'abc123', 'jpg');
    assert.equal(avatar, 'avatars/42/abc123.jpg');
    assert.equal(isKeyInFolder(avatar, R2_FOLDERS.avatar), true);
    assert.equal(isKeyInFolder(avatar, R2_FOLDERS.food), false);
    assert.equal(isKeyInFolder(avatar, R2_FOLDERS.transformation), false);
  });

  it('puts transformation photos under transformation/{userId}/{slot}/', () => {
    const key = buildTransformationObjectKey(42, 'front', 'abc123', 'jpg');
    assert.equal(key, 'transformation/42/front/abc123.jpg');
    assert.equal(isKeyInFolder(key, R2_FOLDERS.transformation), true);
    assert.equal(isKeyInFolder(key, R2_FOLDERS.avatar), false);
  });

  it('puts meal photos under food/{userId}/{mealId}/', () => {
    const key = buildFoodObjectKey(42, 99, 'abc123', 'jpg');
    assert.equal(key, 'food/42/99/abc123.jpg');
    assert.equal(isKeyInFolder(key, R2_FOLDERS.food), true);
    assert.equal(isKeyInFolder(key, R2_FOLDERS.avatar), false);
  });

  it('puts scale photos under weight/{userId}/{recordId}/', () => {
    const key = buildWeightObjectKey(42, 99, 'abc123', 'jpg');
    assert.equal(key, 'weight/42/99/abc123.jpg');
    assert.equal(isKeyInFolder(key, R2_FOLDERS.weight), true);
    assert.equal(isKeyInFolder(key, R2_FOLDERS.food), false);
  });

  it('puts education photos under education/{userId}/{logId}/', () => {
    const key = buildEducationObjectKey(42, 99, 'abc123', 'jpg');
    assert.equal(key, 'education/42/99/abc123.jpg');
    assert.equal(isKeyInFolder(key, R2_FOLDERS.education), true);
  });

  it('puts good-habit slots under good-habits/{userId}/{id}/{slot}/', () => {
    const key = buildGoodHabitObjectKey(42, 99, 'before', 'abc123', 'jpg');
    assert.equal(key, 'good-habits/42/99/before/abc123.jpg');
    assert.equal(isKeyInFolder(key, R2_FOLDERS.goodHabit), true);
  });

  it('rejects path traversal in segments', () => {
    assert.throws(() => buildAvatarObjectKey('42/../x', 'abc', 'jpg'));
    assert.throws(() => buildFoodObjectKey(42, '../secret', 'abc', 'jpg'));
  });
});

describe('orphanedAvatarKeys', () => {
  it('keeps the live key and drops previous hashes under avatars/', () => {
    const live = 'avatars/279/1b41a01648ec9d2c.jpg';
    const orphans = orphanedAvatarKeys(
      [
        live,
        'avatars/279/cdb662cb80ceed99.jpg',
        'food/279/1/meal.jpg',
        'avatars/279/nested/too/deep.jpg',
      ],
      [live],
    );
    assert.deepEqual(orphans, ['avatars/279/cdb662cb80ceed99.jpg']);
  });

  it('deletes nothing when every listed avatar is live', () => {
    const live = ['avatars/1/a.jpg', 'avatars/2/b.jpg'];
    assert.deepEqual(orphanedAvatarKeys(live, live), []);
  });
});
