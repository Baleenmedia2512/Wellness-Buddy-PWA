/**
 * Run: node --test backend/features/user/__tests__/communityIdOtpEmail.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCoSponsorCommunityIdOtpEmail,
  buildCreateCommunityIdOtpEmail,
} from '../domain/communityIdOtpEmail.rules.js';

describe('buildCreateCommunityIdOtpEmail', () => {
  it('includes member name, community ID, approval code, and 24h expiry', () => {
    const mail = buildCreateCommunityIdOtpEmail({
      otp: '4321',
      memberName: 'Kabilan',
      communityId: 'WB1234',
      expiresHours: 24,
    });
    assert.match(mail.subject, /Kabilan/);
    assert.match(mail.text, /create Community ID WB1234/);
    assert.match(mail.text, /Approval code: 4321/);
    assert.match(mail.text, /24 hours/);
    assert.match(mail.html, /4321/);
  });
});

describe('buildCoSponsorCommunityIdOtpEmail', () => {
  it('names the main sponsor and includes the approval code', () => {
    const mail = buildCoSponsorCommunityIdOtpEmail({
      otp: '8765',
      memberName: 'Priya',
      communityId: 'WB1234',
      mainSponsorName: 'Ada Lovelace',
      expiresHours: 24,
    });
    assert.match(mail.subject, /Co-Sponsor/);
    assert.match(mail.text, /become co-sponsor with Ada Lovelace/);
    assert.match(mail.text, /Community ID WB1234/);
    assert.match(mail.text, /Approval code: 8765/);
    assert.match(mail.html, /Ada Lovelace/);
  });
});
