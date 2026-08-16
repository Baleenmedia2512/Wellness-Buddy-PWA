/**
 * lookupUserId must send X-App-Version (APP_VERSION_ENFORCE_API).
 * Run: node --test frontend/src/shared/services/nutritionPersistence/__tests__/userIdLookup.test.js
 */
import { describe, it, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { lookupUserId } from '../userIdLookup.js';
import { APP_VERSION_HEADER } from '../../apiFetch.js';
import APP_VERSION from '../../../../config/version.js';

describe('lookupUserId', () => {
  afterEach(() => {
    mock.restoreAll();
  });

  it('sends X-App-Version on POST /api/user/lookup', async () => {
    let capturedUrl;
    let capturedHeaders;
    mock.method(global, 'fetch', async (url, opts) => {
      capturedUrl = String(url);
      capturedHeaders = opts?.headers;
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, userId: 42 }),
      };
    });

    const data = await lookupUserId('ada@example.com');

    assert.match(capturedUrl, /\/api\/user\/lookup$/);
    assert.equal(capturedHeaders[APP_VERSION_HEADER], APP_VERSION.VERSION);
    assert.equal(data.userId, 42);
  });
});
