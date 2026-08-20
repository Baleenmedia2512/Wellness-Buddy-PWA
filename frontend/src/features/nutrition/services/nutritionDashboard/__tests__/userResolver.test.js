/**
 * resolveDashboardUserId must send X-App-Version (APP_VERSION_ENFORCE_API).
 * Run: node --test frontend/src/features/nutrition/services/nutritionDashboard/__tests__/userResolver.test.js
 */
import { describe, it, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { resolveDashboardUserId } from '../userResolver.js';
import { APP_VERSION_HEADER } from '../../../../../shared/services/apiFetch.js';
import APP_VERSION from '../../../../../config/version.js';

describe('resolveDashboardUserId', () => {
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
        json: async () => ({ success: true, userId: 11 }),
      };
    });

    const userId = await resolveDashboardUserId(
      { email: 'ada@example.com' },
      'https://api.example.com',
    );

    assert.match(capturedUrl, /\/api\/user\/lookup$/);
    assert.equal(capturedHeaders[APP_VERSION_HEADER], APP_VERSION.VERSION);
    assert.equal(userId, 11);
  });
});
