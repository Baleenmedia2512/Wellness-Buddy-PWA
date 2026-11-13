import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  PLAY_STORE_APP_URL,
  buildAppInviteShareText,
  buildAppInviteSharePayload,
} from '../appInvite.rules.js';

describe('appInvite.rules', () => {
  it('defines the correct Google Play Store URL', () => {
    assert.equal(PLAY_STORE_APP_URL, 'https://play.google.com/store/apps/details?id=com.wellnessvalley.app');
  });

  it('builds invite text with default greeting when inviter name is omitted', () => {
    const text = buildAppInviteShareText();
    assert.ok(text.includes('🌟 Join me on Wellness Valley!'));
    assert.ok(text.includes(PLAY_STORE_APP_URL));
  });

  it('personalizes invite text when inviter name is provided', () => {
    const text = buildAppInviteShareText({ inviterName: 'Nitheesh' });
    assert.ok(text.includes('🌟 Nitheesh invites you to join Wellness Valley!'));
    assert.ok(text.includes(PLAY_STORE_APP_URL));
  });

  it('builds share payload with title, url, text, and dialogTitle', () => {
    const payload = buildAppInviteSharePayload({ inviterName: 'Priya' });
    assert.equal(payload.title, 'Join me on Wellness Valley');
    assert.equal(payload.url, PLAY_STORE_APP_URL);
    assert.equal(payload.dialogTitle, 'Invite Friends to Wellness Valley');
    assert.ok(payload.text.includes('Priya'));
  });
});

