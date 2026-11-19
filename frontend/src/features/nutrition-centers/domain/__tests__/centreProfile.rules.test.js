/**
 * Run: node --test frontend/src/features/nutrition-centers/domain/__tests__/centreProfile.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CENTRE_CODE_PREFIX,
  centreCodeBody,
  centreCodeError,
  centreCodeFromSuffix,
  centrePhotosError,
  centrePhotosForApi,
  emptyCentrePhotos,
} from '../centreProfile.rules.js';

describe('centre code', () => {
  it('keeps RS as a fixed prefix', () => {
    assert.equal(CENTRE_CODE_PREFIX, 'RS');
    assert.equal(centreCodeBody('rs-88'), '88');
    assert.equal(centreCodeBody('88'), '88');
    assert.equal(centreCodeFromSuffix('88'), 'RS88');
  });

  it('requires a body after RS', () => {
    assert.match(centreCodeError(''), /required/);
    assert.equal(centreCodeError('A1'), null);
  });
});

describe('centre photos', () => {
  it('requires one photo in each slot', () => {
    const photos = emptyCentrePhotos();
    photos.entrance = [{ dataUrl: 'a' }];
    assert.match(centrePhotosError(photos), /Centre interior photos/);
    photos.interior = [{ dataUrl: 'b' }];
    photos.name_board = [{ dataUrl: 'c' }];
    photos.wellness_activity = [{ dataUrl: 'd' }];
    assert.equal(centrePhotosError(photos), null);
    assert.deepEqual(centrePhotosForApi(photos).entrance, ['a']);
  });
});
