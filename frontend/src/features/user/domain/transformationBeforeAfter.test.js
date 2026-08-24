/**
 * Run: node --test frontend/src/features/user/domain/transformationBeforeAfter.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_TRANSFORMATION_COMPARE_TYPE,
  filterTransformationHistoryByType,
  formatTransformationRecordWeight,
  historyWithLatestSlotFallback,
  selectTransformationBeforeAfter,
} from './transformationBeforeAfter.js';

const LEFT_EARLY = {
  id: 1,
  imageType: 'left',
  imageUrl: 'data:image/jpeg;base64,left48',
  weight: 48,
  createdAt: '2026-08-24T00:00:00.000Z',
};
const LEFT_LATE = {
  id: 3,
  imageType: 'left',
  imageUrl: 'data:image/jpeg;base64,left52',
  weight: 52,
  createdAt: '2026-09-24T00:00:00.000Z',
};
const FRONT = {
  id: 2,
  imageType: 'front',
  imageUrl: 'data:image/jpeg;base64,front',
  weight: 50,
  createdAt: '2026-08-25T00:00:00.000Z',
};
const RIGHT = {
  id: 4,
  imageType: 'right',
  imageUrl: 'data:image/jpeg;base64,right',
  weight: 51,
  createdAt: '2026-08-26T00:00:00.000Z',
};

describe('transformation Before vs After pairing', () => {
  it('defaults the compare type to left', () => {
    assert.equal(DEFAULT_TRANSFORMATION_COMPARE_TYPE, 'left');
  });

  it('pairs earliest left with later left and keeps historical weights', () => {
    const pair = selectTransformationBeforeAfter(
      [LEFT_LATE, FRONT, LEFT_EARLY, RIGHT],
      'left',
    );
    assert.equal(pair.before.imageUrl, LEFT_EARLY.imageUrl);
    assert.equal(pair.before.weight, 48);
    assert.equal(pair.after.imageUrl, LEFT_LATE.imageUrl);
    assert.equal(pair.after.weight, 52);
  });

  it('never mixes types even when left is missing', () => {
    const pair = selectTransformationBeforeAfter([FRONT, RIGHT], 'left');
    assert.equal(pair.before, null);
    assert.equal(pair.after, null);
    assert.equal(filterTransformationHistoryByType([FRONT, RIGHT], 'front').length, 1);
  });

  it('returns empty pair with no images', () => {
    assert.deepEqual(selectTransformationBeforeAfter([], 'left'), { before: null, after: null });
  });

  it('does not invent weight from profile', () => {
    assert.equal(formatTransformationRecordWeight({ weight: 48 }), 48);
    assert.equal(formatTransformationRecordWeight({}), null);
  });

  it('falls back to latest JSON slots without inventing weight', () => {
    const rows = historyWithLatestSlotFallback([], {
      left: LEFT_EARLY.imageUrl,
      front: FRONT.imageUrl,
    });
    const pair = selectTransformationBeforeAfter(rows, 'left');
    assert.equal(pair.before.imageUrl, LEFT_EARLY.imageUrl);
    assert.equal(pair.before.weight, null);
    assert.equal(pair.after, null);
  });

  it('keeps Left empty when only Front and Right exist (does not auto-switch)', () => {
    const rows = historyWithLatestSlotFallback([FRONT, RIGHT], { front: FRONT.imageUrl, right: RIGHT.imageUrl });
    const left = selectTransformationBeforeAfter(rows, DEFAULT_TRANSFORMATION_COMPARE_TYPE);
    assert.equal(DEFAULT_TRANSFORMATION_COMPARE_TYPE, 'left');
    assert.equal(left.before, null);
    assert.equal(left.after, null);
  });

  it('fills a JSON-only type when history already has other types', () => {
    const rows = historyWithLatestSlotFallback([FRONT], {
      front: FRONT.imageUrl,
      left: LEFT_EARLY.imageUrl,
    });
    const left = selectTransformationBeforeAfter(rows, 'left');
    assert.equal(left.before.imageUrl, LEFT_EARLY.imageUrl);
    assert.equal(left.before.weight, null);
  });
});
