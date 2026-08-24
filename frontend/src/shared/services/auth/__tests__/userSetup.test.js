/**
 * fetchUserStatus — deleted account must not fail-open on HTTP 404.
 * Setup/status lookups must send X-App-Version (APP_VERSION_ENFORCE_API).
 */
import { describe, it, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { fetchUserStatus, fetchSetupStatus } from '../userSetup.js';
import { APP_VERSION_HEADER } from '../../apiFetch.js';
import APP_VERSION from '../../../../config/version.js';

describe('fetchUserStatus', () => {
  afterEach(() => {
    mock.restoreAll();
  });

  it('returns userNotFound when lookup responds 404', async () => {
    mock.method(global, 'fetch', async () => ({
      ok: false,
      status: 404,
      json: async () => ({ success: false, userNotFound: true, message: 'User not found' }),
    }));

    const result = await fetchUserStatus({
      apiBaseUrl: 'http://test',
      email: 'deleted@example.com',
    });

    assert.equal(result.result, 'userNotFound');
  });

  it('fail-opens on 500 server errors', async () => {
    mock.method(global, 'fetch', async () => ({
      ok: false,
      status: 500,
      json: async () => ({ success: false, message: 'Internal error' }),
    }));

    const result = await fetchUserStatus({
      apiBaseUrl: 'http://test',
      email: 'user@example.com',
    });

    assert.equal(result.result, 'active');
  });

  it('sends X-App-Version on lookup', async () => {
    let capturedHeaders;
    mock.method(global, 'fetch', async (_url, opts) => {
      capturedHeaders = opts?.headers;
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, isActive: true, role: 'user' }),
      };
    });

    await fetchUserStatus({ apiBaseUrl: 'http://test', email: 'user@example.com' });

    assert.equal(capturedHeaders[APP_VERSION_HEADER], APP_VERSION.VERSION);
  });
});

describe('fetchSetupStatus', () => {
  afterEach(() => {
    mock.restoreAll();
  });

  it('sends X-App-Version on status fetch', async () => {
    let capturedHeaders;
    mock.method(global, 'fetch', async (_url, opts) => {
      capturedHeaders = opts?.headers;
      return {
        ok: true,
        status: 200,
        json: async () => ({ setupComplete: true }),
      };
    });

    const result = await fetchSetupStatus({
      apiBaseUrl: 'http://test',
      email: 'user@example.com',
    });

    assert.equal(result.result, 'complete');
    assert.equal(capturedHeaders[APP_VERSION_HEADER], APP_VERSION.VERSION);
  });

  it('returns error when status responds 426', async () => {
    mock.method(global, 'fetch', async () => ({
      ok: false,
      status: 426,
      clone() {
        return this;
      },
      json: async () => ({
        success: false,
        code: 'APP_UPDATE_REQUIRED',
        message: 'Please update Wellness Valley to continue.',
      }),
    }));

    const result = await fetchSetupStatus({
      apiBaseUrl: 'http://test',
      email: 'user@example.com',
    });

    assert.equal(result.result, 'error');
  });
});
