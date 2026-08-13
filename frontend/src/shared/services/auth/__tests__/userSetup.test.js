/**
 * fetchUserStatus — deleted account must not fail-open on HTTP 404.
 */
import { describe, it, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { fetchUserStatus } from '../userSetup.js';

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
});
