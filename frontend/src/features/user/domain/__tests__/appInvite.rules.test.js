import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  APP_SHARE_URL,
  PLAY_STORE_APP_URL,
  APP_INVITE_MESSAGE,
  buildAppInviteShareText,
  buildWhatsAppInviteUrl,
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
    assert.ok(text.includes('Join me on the Wellness Valley app!'));
    assert.ok(text.includes('Download the app using the link below:'));
    assert.ok(text.includes('wellnessvalley.in/share'));
    assert.ok(!text.includes('https://wellnessvalley.in/share'));
    assert.ok(text.includes('Step 1: Enter your mobile number.'));
    assert.ok(text.includes('Step 2: Enter the OTP sent to your mobile number.'));
    assert.ok(text.includes('Step 3: Enter your sponsor under Sponsor Name and select it.'));
    assert.ok(text.includes('Step 4: Enter the OTP received by your sponsor.'));
    assert.ok(text.includes('Step 5: Complete your profile and enjoy the app!'));
  });

  it('replaces inviter name in step 3 when provided', () => {
    const text = buildAppInviteShareText({ inviterName: 'System Nitheesh' });
    assert.ok(text.includes('Step 3: Enter System Nitheesh under Sponsor Name and select it.'));
  });

  it('builds direct WhatsApp URL with encoded message', () => {
    const url = buildWhatsAppInviteUrl({ inviterName: 'System Nitheesh' });
    assert.ok(url.startsWith('https://api.whatsapp.com/send?text='));
    assert.ok(url.includes(encodeURIComponent('Join me on the Wellness Valley app!')));
    assert.ok(url.includes(encodeURIComponent('Step 3: Enter System Nitheesh under Sponsor Name and select it.')));
  });

  it('builds share payload with title, url, text, and dialogTitle', () => {
    const payload = buildAppInviteSharePayload({ inviterName: 'Nitheesh' });
    assert.equal(payload.title, 'Wellness Valley Invite');
    assert.equal(payload.url, 'https://wellnessvalley.in/share');
    assert.equal(payload.dialogTitle, 'Share on WhatsApp');
    assert.ok(payload.text.includes('wellnessvalley.in/share'));
    assert.ok(payload.whatsappUrl.startsWith('https://api.whatsapp.com/send?text='));
  });
});
