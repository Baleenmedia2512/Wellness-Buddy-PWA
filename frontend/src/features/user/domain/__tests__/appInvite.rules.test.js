import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  APP_SHARE_URL,
  PLAY_STORE_APP_URL,
  APP_INVITE_MESSAGE,
  buildAppInviteShareText,
  buildAppInviteSharePayload,
} from '../appInvite.rules.js';

describe('appInvite.rules', () => {
  it('defines the correct share URL and Play Store URL', () => {
    assert.equal(APP_SHARE_URL, 'https://wellnessvalley.in/share');
    assert.equal(PLAY_STORE_APP_URL, 'https://play.google.com/store/apps/details?id=com.wellnessvalley.app');
  });

  it('builds invite text matching the welcome message and instructions', () => {
    const text = buildAppInviteShareText();
    assert.equal(text, APP_INVITE_MESSAGE);
    assert.ok(text.includes('🎉 Welcome to Wellness Valley! 🌿'));
    assert.ok(text.includes('https://wellnessvalley.in/share'));
    assert.ok(text.includes('Step 1: Enter your mobile number and verify it using the OTP.'));
    assert.ok(text.includes("Step 2: Select the Sponsor's email address who invited you and verify it using the OTP sent to that email."));
    assert.ok(text.includes('Step 3: Fill in all the required details in the Complete Profile form.'));
    assert.ok(!text.includes('Get started on your wellness journey'));
  });

  it('builds share payload with title, url, text, and dialogTitle', () => {
    const payload = buildAppInviteSharePayload({ inviterName: 'Nitheesh' });
    assert.equal(payload.title, 'Welcome to Wellness Valley');
    assert.equal(payload.url, 'https://wellnessvalley.in/share');
    assert.equal(payload.dialogTitle, 'Invite Friends to Wellness Valley');
    assert.ok(payload.text.includes('https://wellnessvalley.in/share'));
  });
});
