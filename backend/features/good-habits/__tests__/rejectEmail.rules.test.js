/**
 * Run: node --test backend/features/good-habits/__tests__/rejectEmail.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGoodHabitRejectEmail,
  buildGoodHabitRejectUrl,
} from '../domain/rejectEmail.rules.js';

describe('buildGoodHabitRejectUrl', () => {
  it('builds absolute one-click reject API URL', () => {
    assert.equal(
      buildGoodHabitRejectUrl('abc123', 'https://wellnessvalley.in/'),
      'https://wellnessvalley.in/api/good-habits/reject?token=abc123',
    );
  });
});

describe('buildGoodHabitRejectEmail', () => {
  it('includes Reject button in mail with photo', () => {
    const mail = buildGoodHabitRejectEmail({
      memberName: 'Avinash',
      coachName: 'Yasheer',
      rejectUrl: 'https://wellnessvalley.in/api/good-habits/reject?token=tok',
    });
    assert.match(mail.subject, /Avinash/);
    assert.match(mail.text, /score/i);
    assert.match(mail.html, /cid:task-by-coach/);
    assert.match(mail.html, />Reject</);
    assert.match(mail.html, /token=tok/);
  });
});
