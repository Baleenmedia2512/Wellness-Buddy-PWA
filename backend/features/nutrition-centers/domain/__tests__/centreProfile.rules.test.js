/**
 * Run: node --test backend/features/nutrition-centers/domain/__tests__/centreProfile.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CENTRE_PROFILE_MIN_APP_VERSION,
  centrePhotoRows,
  groupCentrePhotos,
  normalizeCentreCode,
  prepareCentreProfile,
  requiresCentreProfile,
} from '../centreProfile.rules.js';

const jpeg = `data:image/jpeg;base64,/9j/${'A'.repeat(40)}`;

function fullPhotos() {
  return {
    entrance: [jpeg],
    interior: [jpeg],
    wellness_activity: [jpeg],
  };
}

describe('requiresCentreProfile', () => {
  it('keeps older, missing, and unknown versions on the legacy path', () => {
    assert.equal(CENTRE_PROFILE_MIN_APP_VERSION, '3.5.7');
    assert.equal(requiresCentreProfile('3.5.6'), false);
    assert.equal(requiresCentreProfile(null), false);
    assert.equal(requiresCentreProfile(''), false);
    assert.equal(requiresCentreProfile('not-a-version'), false);
  });

  it('requires the new profile from 3.5.7', () => {
    assert.equal(requiresCentreProfile('3.5.7'), true);
    assert.equal(requiresCentreProfile('3.6.0'), true);
  });
});

describe('normalizeCentreCode', () => {
  it('adds the RS prefix and uppercases the body', () => {
    assert.equal(normalizeCentreCode('1024'), 'RS1024');
    assert.equal(normalizeCentreCode('rs-10 24'), 'RS1024');
    assert.equal(normalizeCentreCode('RS88'), 'RS88');
    assert.equal(normalizeCentreCode(''), '');
  });
});

describe('prepareCentreProfile', () => {
  it('stores a valid code and photos when an older app sends them', () => {
    const result = prepareCentreProfile({
      centerCode: 'ab12',
      photos: fullPhotos(),
      appVersion: '3.5.6',
      mode: 'register',
    });
    assert.equal(result.error, undefined);
    assert.equal(result.centerCode, 'RSAB12');
    assert.equal(result.photos.wellness_activity.length, 1);
  });

  it('still accepts legacy name_board photos when an older client sends them', () => {
    const photos = fullPhotos();
    photos.name_board = [jpeg, jpeg];
    const result = prepareCentreProfile({
      centerCode: 'ab12',
      photos,
      appVersion: '3.5.6',
      mode: 'register',
    });
    assert.equal(result.error, undefined);
    assert.equal(result.photos.name_board.length, 2);
  });

  it('lets an older app register without the new fields', () => {
    const result = prepareCentreProfile({
      appVersion: '3.5.6',
      mode: 'register',
    });
    assert.equal(result.centerCode, null);
    assert.equal(result.photos, undefined);
  });

  it('lets a request with no version update without clearing stored fields', () => {
    const result = prepareCentreProfile({ mode: 'update' });
    assert.equal(result.centerCode, undefined);
    assert.equal(result.photos, undefined);
  });

  it('rejects a new app that omits the centre code', () => {
    const result = prepareCentreProfile({
      photos: fullPhotos(),
      appVersion: '3.5.7',
      mode: 'register',
    });
    assert.match(result.error, /Centre code is required/);
  });

  it('rejects a new app that omits photos', () => {
    const result = prepareCentreProfile({
      centerCode: 'RS10',
      appVersion: '3.5.7',
      mode: 'register',
    });
    assert.match(result.error, /Centre entrance photos/);
  });

  it('rejects a partial photo set whenever photos are sent', () => {
    const photos = fullPhotos();
    photos.interior = [];
    const result = prepareCentreProfile({
      centerCode: 'RS10',
      photos,
      appVersion: null,
      mode: 'register',
    });
    assert.match(result.error, /Shake counter Image/);
  });

  it('rejects a code that is only the prefix', () => {
    const result = prepareCentreProfile({
      centerCode: 'RS',
      photos: fullPhotos(),
      appVersion: '3.5.7',
      mode: 'register',
    });
    assert.match(result.error, /must start with RS/);
  });
});

describe('centre photo rows', () => {
  it('stores file keys and groups them back', () => {
    const entrance = 'nutrition-centres/9/entrance/abcd1234abcd1234.jpg';
    const rows = centrePhotoRows(9, {
      entrance: [entrance],
      interior: ['nutrition-centres/9/interior/abcd1234abcd1234.jpg'],
      wellness_activity: ['nutrition-centres/9/wellness_activity/abcd1234abcd1234.jpg'],
      name_board: [
        'nutrition-centres/9/name_board/abcd1234abcd1234.jpg',
        'nutrition-centres/9/name_board/bbbb1234bbbb1234.jpg',
      ],
    });
    assert.equal(rows.length, 5);
    assert.equal(rows[3].category, 'name_board');
    assert.equal(rows[3].image_key.endsWith('.jpg'), true);
    assert.equal(rows[0].image_data, undefined);
    const grouped = groupCentrePhotos(rows);
    assert.equal(grouped.entrance[0], entrance);
  });

  it('keeps a photo that is already stored as a file URL', () => {
    const photos = fullPhotos();
    photos.entrance = ['https://cdn.example/uploads/nutrition-centres/4/entrance/abcd1234abcd1234.jpg'];
    const result = prepareCentreProfile({
      centerCode: 'RS10',
      photos,
      appVersion: '3.5.7',
      mode: 'update',
    });
    assert.equal(result.error, undefined);
    assert.equal(result.photos.entrance[0].type, 'keep');
    assert.equal(result.photos.entrance[0].key, 'nutrition-centres/4/entrance/abcd1234abcd1234.jpg');
    assert.equal(result.photos.interior[0].type, 'upload');
  });
});
