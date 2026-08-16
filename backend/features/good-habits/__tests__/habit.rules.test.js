import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  HABIT_TYPE_BEFORE_AFTER,
  HABIT_TYPE_IMAGE_NOTES,
  NOTES_MAX_LEN,
  isHabitType,
  clampNotes,
  stripDataUrl,
  normalizeHabitPayload,
  assertHabitImages,
  readHabitImageRow,
} from '../domain/habit.rules.js';

describe('habit.rules', () => {
  it('accepts the two habit types', () => {
    assert.equal(isHabitType(HABIT_TYPE_BEFORE_AFTER), true);
    assert.equal(isHabitType(HABIT_TYPE_IMAGE_NOTES), true);
    assert.equal(isHabitType('food'), false);
  });

  it('clamps notes to 200 characters', () => {
    assert.equal(clampNotes('ok'), 'ok');
    assert.equal(clampNotes('x'.repeat(NOTES_MAX_LEN + 40)).length, NOTES_MAX_LEN);
    assert.equal(clampNotes(null), '');
  });

  it('strips data-URL prefixes', () => {
    assert.equal(stripDataUrl('data:image/jpeg;base64,abc'), 'abc');
    assert.equal(stripDataUrl('abc'), 'abc');
    assert.equal(stripDataUrl(''), null);
  });

  it('requires before and after for before_after', () => {
    const normalized = normalizeHabitPayload({
      habitType: HABIT_TYPE_BEFORE_AFTER,
      notes: 'walked',
      beforeImageBase64: 'data:image/jpeg;base64,before',
      afterImageBase64: 'data:image/jpeg;base64,after',
    });
    assert.equal(normalized.imageBase64, 'after');
    assert.doesNotThrow(() => assertHabitImages(normalized));
    assert.throws(
      () => assertHabitImages(normalizeHabitPayload({
        habitType: HABIT_TYPE_BEFORE_AFTER,
        afterImageBase64: 'after',
      })),
      /Before and After/,
    );
  });

  it('requires one image for image_notes', () => {
    const normalized = normalizeHabitPayload({
      habitType: HABIT_TYPE_IMAGE_NOTES,
      notes: 'n',
      imageBase64: 'pic',
    });
    assert.equal(normalized.beforeImageBase64, null);
    assert.doesNotThrow(() => assertHabitImages(normalized));
    assert.throws(
      () => assertHabitImages(normalizeHabitPayload({
        habitType: HABIT_TYPE_IMAGE_NOTES,
        notes: 'n',
      })),
      /image is required/,
    );
  });

  it('readHabitImageRow returns before and after even with mixed keys', () => {
    const images = readHabitImageRow({
      ImageBase64: 'main',
      beforeImageBase64: 'before-pic',
      AfterImageBase64: 'after-pic',
    });
    assert.equal(images.beforeImageBase64, 'before-pic');
    assert.equal(images.afterImageBase64, 'after-pic');
    assert.equal(images.imageBase64, 'main');
  });

  it('readHabitImageRow falls after back to the main image', () => {
    const images = readHabitImageRow({ ImageBase64: 'only-after' });
    assert.equal(images.beforeImageBase64, null);
    assert.equal(images.afterImageBase64, 'only-after');
    assert.equal(images.imageBase64, 'only-after');
  });
});
