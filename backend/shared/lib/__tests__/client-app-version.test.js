/**
 * Run: node --test backend/shared/lib/__tests__/client-app-version.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getClientAppVersion } from '../client-app-version.js';

describe('getClientAppVersion', () => {
  it('prefers X-App-Version header', () => {
    assert.equal(
      getClientAppVersion({
        headers: { 'x-app-version': '3.4.3' },
        query: { appVersion: '1.0.0' },
        body: { clientVersion: '2.0.0' },
      }),
      '3.4.3',
    );
  });

  it('falls back to query appVersion', () => {
    assert.equal(
      getClientAppVersion({ headers: {}, query: { appVersion: '3.4.1' } }),
      '3.4.1',
    );
  });

  it('falls back to body clientVersion', () => {
    assert.equal(
      getClientAppVersion({ headers: {}, query: {}, body: { clientVersion: '3.2.0' } }),
      '3.2.0',
    );
  });

  it('returns null when absent', () => {
    assert.equal(getClientAppVersion({ headers: {}, query: {}, body: {} }), null);
    assert.equal(getClientAppVersion(null), null);
  });
});
