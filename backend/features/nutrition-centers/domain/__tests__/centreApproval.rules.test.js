/**
 * Run: node --test backend/features/nutrition-centers/domain/__tests__/centreApproval.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  centreApprovalRecipientKey,
  centreRegisterNeedsCoachApproval,
  normalizeSeatingCount,
  requiresCentreCoachApproval,
} from '../centreApproval.rules.js';

describe('centre coach approval', () => {
  it('keeps older apps on register without approval when hours are omitted', () => {
    assert.equal(requiresCentreCoachApproval('3.5.6'), false);
    assert.equal(requiresCentreCoachApproval(null), false);
    assert.equal(centreRegisterNeedsCoachApproval({ appVersion: '3.5.6', openingHours: null }), false);
  });

  it('requires approval at 3.5.7 and when the new form sends hours', () => {
    assert.equal(requiresCentreCoachApproval('3.5.7'), true);
    assert.equal(centreRegisterNeedsCoachApproval({
      appVersion: '3.5.6',
      openingHours: { monday: { closed: false, slots: [] } },
    }), true);
  });

  it('scopes the code to the member', () => {
    assert.equal(centreApprovalRecipientKey(15), 'centre-register:15');
  });

  it('treats seating as optional', () => {
    assert.deepEqual(normalizeSeatingCount(''), { value: null });
    assert.deepEqual(normalizeSeatingCount(null), { value: null });
    assert.deepEqual(normalizeSeatingCount('40'), { value: 40 });
    assert.match(normalizeSeatingCount('12.5').error, /whole number/);
    assert.match(normalizeSeatingCount('1000').error, /999/);
  });
});
