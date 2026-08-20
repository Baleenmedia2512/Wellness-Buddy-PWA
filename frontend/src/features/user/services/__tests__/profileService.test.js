/**
 * saveProfile must send X-App-Version (APP_VERSION_ENFORCE_API).
 * Run: node --test frontend/src/features/user/services/__tests__/profileService.test.js
 */
import { describe, it, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { saveProfile } from '../profileService.js';
import { APP_VERSION_HEADER } from '../../../../shared/services/apiFetch.js';
import APP_VERSION from '../../../../config/version.js';

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => (String(name).toLowerCase() === 'content-type' ? 'application/json' : null) },
    json: async () => body,
  };
}

describe('saveProfile', () => {
  afterEach(() => {
    mock.restoreAll();
  });

  it('sends X-App-Version on POST /api/user/profile', async () => {
    let capturedUrl;
    let capturedHeaders;
    mock.method(global, 'fetch', async (url, opts) => {
      capturedUrl = String(url);
      capturedHeaders = opts?.headers;
      return jsonResponse({ success: true, data: { userName: 'Ada' } });
    });

    const data = await saveProfile({ email: 'ada@example.com', name: 'Ada' });

    assert.match(capturedUrl, /\/api\/user\/profile$/);
    assert.equal(capturedHeaders[APP_VERSION_HEADER], APP_VERSION.VERSION);
    assert.equal(data.success, true);
  });
});
