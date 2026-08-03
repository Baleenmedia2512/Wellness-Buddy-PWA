import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isLinkPreviewBot,
  resolveStoreUrl,
  APP_STORE_NATIVE_URL,
  PLAY_STORE_NATIVE_URL,
  PLAY_STORE_URL,
} from '../shareLandingRedirect.js';

describe('shareLandingRedirect', () => {
  it('detects WhatsApp crawler', () => {
    assert.equal(isLinkPreviewBot('WhatsApp/2.23'), true);
    assert.equal(isLinkPreviewBot('Mozilla/5.0 Android'), false);
  });

  it('sends iOS users to App Store native URL', () => {
    assert.equal(
      resolveStoreUrl('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'),
      APP_STORE_NATIVE_URL,
    );
  });

  it('sends Android users to HTTPS Play Store (works in WhatsApp browser)', () => {
    assert.equal(
      resolveStoreUrl('Mozilla/5.0 (Linux; Android 14) Chrome/120'),
      PLAY_STORE_URL,
    );
  });

  it('defaults desktop to HTTPS Play Store', () => {
    assert.equal(
      resolveStoreUrl('Mozilla/5.0 (Windows NT 10.0) Chrome/120'),
      PLAY_STORE_URL,
    );
  });
});
