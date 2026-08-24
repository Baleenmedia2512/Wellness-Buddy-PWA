/**
 * Run: node --test backend/features/user/__tests__/transformationPhotos.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  mapTransformationPhotos,
  mergeTransformationPhotos,
  hasTransformationPhotoUpdates,
  hashTransformationPhoto,
  buildTransformationPhotoInserts,
  mapLatestTransformationPhotosFromRecords,
  mapTransformationPhotoRecord,
  DEFAULT_TRANSFORMATION_COMPARE_TYPE,
  selectTransformationBeforeAfter,
} from '../domain/transformationPhotos.rules.js';

const FRONT = 'data:image/jpeg;base64,abc';
const LEFT = 'data:image/jpeg;base64,def';

describe('mapTransformationPhotos', () => {
  it('returns empty slots for missing data', () => {
    assert.deepEqual(mapTransformationPhotos(null), { front: null, left: null, right: null });
  });

  it('maps stored object slots', () => {
    assert.deepEqual(mapTransformationPhotos({ front: FRONT, extra: 'x' }), {
      front: FRONT,
      left: null,
      right: null,
    });
  });
});

describe('mergeTransformationPhotos', () => {
  it('keeps existing slots when incoming omits them', () => {
    const merged = mergeTransformationPhotos(
      { front: FRONT, left: LEFT },
      { right: 'data:image/jpeg;base64,ghi' },
    );
    assert.equal(merged.front, FRONT);
    assert.equal(merged.left, LEFT);
    assert.equal(merged.right, 'data:image/jpeg;base64,ghi');
  });

  it('ignores empty incoming values so skip does not wipe photos', () => {
    const merged = mergeTransformationPhotos({ front: FRONT }, { front: '', left: null });
    assert.equal(merged.front, FRONT);
    assert.equal(merged.left, null);
  });
});

describe('hasTransformationPhotoUpdates', () => {
  it('is false for omitted or empty payloads', () => {
    assert.equal(hasTransformationPhotoUpdates(undefined), false);
    assert.equal(hasTransformationPhotoUpdates({}), false);
    assert.equal(hasTransformationPhotoUpdates({ front: '' }), false);
  });

  it('is true when any slot has an image', () => {
    assert.equal(hasTransformationPhotoUpdates({ left: LEFT }), true);
  });
});

describe('buildTransformationPhotoInserts', () => {
  it('snapshots the provided weight onto each uploaded type without mixing slots', () => {
    const rows = buildTransformationPhotoInserts(
      { left: LEFT, right: 'data:image/jpeg;base64,ghi' },
      48,
    );
    assert.equal(rows.length, 2);
    assert.equal(rows[0].imageType, 'left');
    assert.equal(rows[0].weightKg, 48);
    assert.equal(rows[1].imageType, 'right');
    assert.equal(rows[1].weightKg, 48);
    assert.equal(rows[0].contentHash, hashTransformationPhoto(LEFT));
  });

  it('does not ask for or invent a weight when none exists', () => {
    const rows = buildTransformationPhotoInserts({ front: FRONT }, null);
    assert.equal(rows[0].weightKg, null);
  });

  it('snapshots 48 kg onto all three types without mixing them', () => {
    const rows = buildTransformationPhotoInserts(
      { front: FRONT, left: LEFT, right: 'data:image/jpeg;base64,ghi' },
      48,
    );
    assert.deepEqual(rows.map((row) => row.imageType), ['front', 'left', 'right']);
    assert.ok(rows.every((row) => row.weightKg === 48));
  });

  it('keeps the first snapshot independent of a later heavier upload', () => {
    const first = buildTransformationPhotoInserts({ left: LEFT }, 48);
    const second = buildTransformationPhotoInserts({ left: 'data:image/jpeg;base64,left52' }, 52);
    assert.equal(first[0].weightKg, 48);
    assert.equal(second[0].weightKg, 52);
    assert.notEqual(first[0].contentHash, second[0].contentHash);
  });

  it('retries of the same image produce the same content hash', () => {
    const a = buildTransformationPhotoInserts({ left: LEFT }, 48);
    const b = buildTransformationPhotoInserts({ left: LEFT }, 52);
    assert.equal(a[0].contentHash, b[0].contentHash);
  });
});

describe('historical latest mapping', () => {
  it('uses newest row per type and leaves other types empty', () => {
    const latest = mapLatestTransformationPhotosFromRecords([
      { image_type: 'left', image_url: LEFT },
      { image_type: 'left', image_url: FRONT },
      { image_type: 'front', image_url: FRONT },
    ]);
    assert.equal(latest.left, LEFT);
    assert.equal(latest.front, FRONT);
    assert.equal(latest.right, null);
  });

  it('preserves captured weight on mapped history records', () => {
    const mapped = mapTransformationPhotoRecord({
      id: 9,
      image_type: 'left',
      image_url: LEFT,
      weight_kg: '48.00',
      created_at: '2026-08-24T00:00:00.000Z',
    });
    assert.equal(mapped.weight, 48);
    assert.equal(mapped.imageType, 'left');
  });
});

describe('Before vs After pairing', () => {
  it('defaults compare type to left', () => {
    assert.equal(DEFAULT_TRANSFORMATION_COMPARE_TYPE, 'left');
  });

  it('uses earliest same-type record as Before and later same-type as After', () => {
    const pair = selectTransformationBeforeAfter([
      { id: 2, image_type: 'left', image_url: LEFT, weight_kg: 52, created_at: '2026-09-24T00:00:00.000Z' },
      { id: 1, image_type: 'left', image_url: FRONT, weight_kg: 48, created_at: '2026-08-24T00:00:00.000Z' },
      { id: 3, image_type: 'front', image_url: FRONT, weight_kg: 50, created_at: '2026-08-25T00:00:00.000Z' },
    ], 'left');
    assert.equal(pair.before.weight, 48);
    assert.equal(pair.after.weight, 52);
    assert.equal(pair.before.imageType || pair.before.image_type, 'left');
    assert.equal(pair.after.imageType || pair.after.image_type, 'left');
  });

  it('stays on left empty state when only front/right exist', () => {
    const pair = selectTransformationBeforeAfter([
      { image_type: 'front', image_url: FRONT, created_at: '2026-08-24T00:00:00.000Z' },
      { image_type: 'right', image_url: LEFT, created_at: '2026-08-25T00:00:00.000Z' },
    ], 'left');
    assert.equal(pair.before, null);
    assert.equal(pair.after, null);
  });
});
