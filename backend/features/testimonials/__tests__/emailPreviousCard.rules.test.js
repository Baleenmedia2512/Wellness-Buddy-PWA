/**
 * Run: node --test backend/features/testimonials/__tests__/emailPreviousCard.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  hasPreviousCardForEmailCompare,
  previousEmailCardPaths,
  shouldShowPreviousNewEmailCards,
} from '../domain/emailPreviousCard.rules.js';

const BEFORE = '42/before_1.jpg';
const CLONE_AFTER = '42/before_1.jpg';
const REAL_AFTER = '42/after_1.jpg';
const NEW_BEFORE = '42/before_2.jpg';
const NEW_AFTER = '42/after_2.jpg';
const PLACEHOLDER = '42/x_video_only_placeholder.jpg';

describe('hasPreviousCardForEmailCompare', () => {
  it('is true when previous After is a Before clone (Mine card)', () => {
    assert.equal(hasPreviousCardForEmailCompare(BEFORE, CLONE_AFTER), true);
  });

  it('is true when previous After is a distinct photo', () => {
    assert.equal(hasPreviousCardForEmailCompare(BEFORE, REAL_AFTER), true);
  });

  it('is true when previous After is missing but Before exists', () => {
    assert.equal(hasPreviousCardForEmailCompare(BEFORE, null), true);
  });

  it('is false on first submit with no previous photos', () => {
    assert.equal(hasPreviousCardForEmailCompare(null, null), false);
  });

  it('is false for video-only placeholder', () => {
    assert.equal(hasPreviousCardForEmailCompare(PLACEHOLDER, PLACEHOLDER), false);
  });
});

describe('shouldShowPreviousNewEmailCards', () => {
  it('shows Previous | New when clone card photos/weight change', () => {
    assert.equal(shouldShowPreviousNewEmailCards({
      previousBeforePath: BEFORE,
      previousAfterPath: CLONE_AFTER,
      cardDetailsChanged: true,
    }), true);
  });

  it('keeps distinct previous After on Previous | New', () => {
    assert.equal(shouldShowPreviousNewEmailCards({
      previousBeforePath: BEFORE,
      previousAfterPath: REAL_AFTER,
      cardDetailsChanged: true,
    }), true);
  });

  it('does not show Previous | New on first submit', () => {
    assert.equal(shouldShowPreviousNewEmailCards({
      previousBeforePath: null,
      previousAfterPath: null,
      cardDetailsChanged: true,
    }), false);
  });

  it('does not show Previous | New when nothing on the card changed', () => {
    assert.equal(shouldShowPreviousNewEmailCards({
      previousBeforePath: BEFORE,
      previousAfterPath: REAL_AFTER,
      cardDetailsChanged: false,
    }), false);
  });
});

describe('previousEmailCardPaths', () => {
  it('keeps clone After as Previous After instead of the new After', () => {
    assert.deepEqual(previousEmailCardPaths({
      previousBeforePath: BEFORE,
      previousAfterPath: CLONE_AFTER,
      currentBeforePath: NEW_BEFORE,
      currentAfterPath: NEW_AFTER,
    }), { beforePath: BEFORE, afterPath: CLONE_AFTER });
  });

  it('falls back to current paths only when no previous photos exist', () => {
    assert.deepEqual(previousEmailCardPaths({
      previousBeforePath: null,
      previousAfterPath: null,
      currentBeforePath: NEW_BEFORE,
      currentAfterPath: NEW_AFTER,
    }), { beforePath: NEW_BEFORE, afterPath: NEW_AFTER });
  });
});
