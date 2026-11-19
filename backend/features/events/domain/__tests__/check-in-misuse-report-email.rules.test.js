import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildCheckInMisuseReportEmail } from '../check-in-misuse-report-email.rules.js';

describe('buildCheckInMisuseReportEmail', () => {
  it('builds guest alert copy', () => {
    const mail = buildCheckInMisuseReportEmail({
      guestName: 'System Ramesh',
      eventName: 'nov meetup',
      ticketNumber: '2131231',
      reportedByName: 'System Nitheesh',
      recipientRole: 'guest',
    });

    assert.match(mail.subject, /Account use alert/i);
    assert.match(mail.subject, /nov meetup/);
    assert.match(mail.text, /Someone is trying to use your account/i);
    assert.match(mail.text, /2131231/);
    assert.match(mail.text, /System Nitheesh/);
    assert.match(mail.html, /Someone is trying to use your account/i);
    assert.match(mail.html, /System Ramesh/);
  });

  it('builds coach alert copy for the downline guest', () => {
    const mail = buildCheckInMisuseReportEmail({
      guestName: 'System Ramesh',
      eventName: 'nov meetup',
      ticketNumber: '2131231',
      reportedByName: 'Host',
      recipientRole: 'coach',
    });

    assert.match(mail.text, /downline member System Ramesh/i);
    assert.match(mail.html, /downline member/);
    assert.match(mail.html, /System Ramesh/);
  });

  it('escapes html in names', () => {
    const mail = buildCheckInMisuseReportEmail({
      guestName: '<script>x</script>',
      eventName: 'Meet & Greet',
      reportedByName: 'Host',
      recipientRole: 'guest',
    });
    assert.doesNotMatch(mail.html, /<script>/);
    assert.match(mail.html, /Meet &amp; Greet/);
  });
});
