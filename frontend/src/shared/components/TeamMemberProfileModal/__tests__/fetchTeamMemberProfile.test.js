/**
 * Team-member profile GET must send X-App-Version (APP_VERSION_ENFORCE_API).
 * Run: node --test frontend/src/shared/components/TeamMemberProfileModal/__tests__/fetchTeamMemberProfile.test.js
 */
import { describe, it, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { fetchTeamMemberProfile } from '../fetchTeamMemberProfile.js';
import { APP_VERSION_HEADER } from '../../../services/apiFetch.js';
import APP_VERSION from '../../../../config/version.js';

describe('fetchTeamMemberProfile', () => {
  afterEach(() => {
    mock.restoreAll();
  });

  it('sends X-App-Version on GET /api/user/profile', async () => {
    let capturedUrl;
    let capturedHeaders;
    mock.method(global, 'fetch', async (url, opts) => {
      capturedUrl = String(url);
      capturedHeaders = opts?.headers;
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: { userName: 'Balaji', email: 'a@b.com' } }),
      };
    });

    const data = await fetchTeamMemberProfile('a@b.com', 'https://api.example.com');

    assert.match(capturedUrl, /\/api\/user\/profile\?email=a%40b\.com/);
    assert.equal(capturedHeaders[APP_VERSION_HEADER], APP_VERSION.VERSION);
    assert.equal(data.success, true);
    assert.equal(data.data.userName, 'Balaji');
  });
});
