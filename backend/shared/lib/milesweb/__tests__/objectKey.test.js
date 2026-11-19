import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isAllowedUploadKey, mediaKeyFromServedUrl, mileswebRedirectUrl } from '../objectKey.js';

describe('MilesWeb upload keys', () => {
  it('accepts the seven cPanel folders', () => {
    assert.equal(isAllowedUploadKey('avatars/42/ab12.jpg'), true);
    assert.equal(isAllowedUploadKey('food/7/99/ab.jpg'), true);
    assert.equal(isAllowedUploadKey('good-habits/1/2/main/ab.jpg'), true);
    assert.equal(isAllowedUploadKey('transformation/3/front/ab.jpg'), true);
  });

  it('rejects paths that leave the upload folders', () => {
    assert.equal(isAllowedUploadKey('../etc/passwd'), false);
    assert.equal(isAllowedUploadKey('avatars/../../x.jpg'), false);
    assert.equal(isAllowedUploadKey('/avatars/1/a.jpg'), false);
    assert.equal(isAllowedUploadKey('other/1/a.jpg'), false);
  });

  it('reads the file key back from a same-API media URL', () => {
    assert.equal(
      mediaKeyFromServedUrl('/api/media/avatars/339/ca9babca1dff5bdc.jpg'),
      'avatars/339/ca9babca1dff5bdc.jpg',
    );
    assert.equal(mediaKeyFromServedUrl('https://cdn.example/avatars/1/a.jpg'), null);
    assert.equal(mediaKeyFromServedUrl('/api/media/../etc/passwd'), null);
  });

  it('builds a same-API path when no public site URL is set', () => {
    const prev = process.env.MILESWEB_PUBLIC_UPLOAD_BASE;
    delete process.env.MILESWEB_PUBLIC_UPLOAD_BASE;
    assert.equal(mileswebRedirectUrl('food/7/99/ab.jpg'), '/api/media/food/7/99/ab.jpg');
    if (prev === undefined) delete process.env.MILESWEB_PUBLIC_UPLOAD_BASE;
    else process.env.MILESWEB_PUBLIC_UPLOAD_BASE = prev;
  });
});
