import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildCheckInVerifiedEmail } from '../check-in-verified-email.rules.js';

describe('buildCheckInVerifiedEmail', () => {
  it('builds subject, text, and html with verifier details', () => {
    const mail = buildCheckInVerifiedEmail({
      guestName: 'System Ramesh',
      eventName: 'nov meetup',
      ticketNumber: '2131231',
      verifierName: 'System Nitheesh',
      verifierCommunityId: 'W112072001',
    });

    assert.match(mail.subject, /Successfully verified/i);
    assert.match(mail.subject, /nov meetup/);
    assert.match(mail.text, /System Ramesh/);
    assert.match(mail.text, /2131231/);
    assert.match(mail.text, /System Nitheesh \(W112072001\)/);
    assert.match(mail.html, /Successfully verified/);
    assert.match(mail.html, /Verified by/);
    assert.match(mail.html, /W112072001/);
  });

  it('escapes html in guest and event names', () => {
    const mail = buildCheckInVerifiedEmail({
      guestName: '<script>x</script>',
      eventName: 'Meet & Greet',
      verifierName: 'Host',
    });
    assert.doesNotMatch(mail.html, /<script>/);
    assert.match(mail.html, /Meet &amp; Greet/);
  });

  it('builds food verification copy when checkInType is food', () => {
    const mail = buildCheckInVerifiedEmail({
      guestName: 'System Ramesh',
      eventName: 'nov meetup',
      ticketNumber: '2131231',
      verifierName: 'Host',
      checkInType: 'food',
    });
    assert.match(mail.subject, /Food successfully verified/i);
    assert.match(mail.text, /food has been successfully verified/i);
    assert.match(mail.html, /Food successfully verified/);
  });
});
