/**
 * Run: node --test backend/features/user/__tests__/communityPositionOtpEmail.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildCommunityPositionOtpEmail } from '../domain/communityPositionOtpEmail.rules.js';

describe('buildCommunityPositionOtpEmail', () => {
  it('asks the coach to share the code for the chosen role', () => {
    const mail = buildCommunityPositionOtpEmail({
      otp: '4821',
      memberName: 'Asha',
      positionLabel: 'MILL TEAM',
      expiresHours: 24,
    });
    assert.match(mail.subject, /Asha - Community Position approval/);
    assert.match(mail.text, /community position MILL TEAM/);
    assert.doesNotMatch(mail.text, /Usage:/);
    assert.doesNotMatch(mail.html, /Usage:/);
    assert.match(mail.text, /Approval code: 4821/);
    assert.match(mail.html, /4821/);
  });
});
