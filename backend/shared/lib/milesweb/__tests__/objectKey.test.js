import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isAllowedUploadKey, mileswebRedirectUrl } from '../objectKey.js';

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

  it('builds a same-API path when no public site URL is set', () => {
    const prev = process.env.MILESWEB_PUBLIC_UPLOAD_BASE;
    delete process.env.MILESWEB_PUBLIC_UPLOAD_BASE;
    assert.equal(mileswebRedirectUrl('food/7/99/ab.jpg'), '/api/media/food/7/99/ab.jpg');
    if (prev === undefined) delete process.env.MILESWEB_PUBLIC_UPLOAD_BASE;
    else process.env.MILESWEB_PUBLIC_UPLOAD_BASE = prev;
  });
});
