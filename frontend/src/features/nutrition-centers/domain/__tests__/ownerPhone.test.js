/**
 * Run: node --test frontend/src/features/nutrition-centers/domain/__tests__/ownerPhone.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { accountPhoneFromUser, phonesMatch, splitOwnerPhone } from '../ownerPhone.js';

describe('splitOwnerPhone', () => {
  it('keeps +91 ahead of +1 prefix match', () => {
    const result = splitOwnerPhone('+911234567899');
    assert.equal(result.countryCode, '+91');
    assert.equal(result.phone, '1234567899');
  });

  it('parses UAE and US codes', () => {
    assert.deepEqual(splitOwnerPhone('+971501234567'), {
      countryCode: '+971',
      phone: '501234567',
    });
    assert.deepEqual(splitOwnerPhone('+12125550100'), {
      countryCode: '+1',
      phone: '2125550100',
    });
  });

  it('defaults bare digits to +91', () => {
    assert.deepEqual(splitOwnerPhone('9876543210'), {
      countryCode: '+91',
      phone: '9876543210',
    });
  });
});

describe('account phone', () => {
  it('reads the signed-in mobile number', () => {
    assert.equal(accountPhoneFromUser({ phoneNumber: '9876543210' }), '9876543210');
    assert.equal(accountPhoneFromUser({ phone: '+919876543210' }), '+919876543210');
  });

  it('treats +91 and 10 digits as the same number', () => {
    assert.equal(phonesMatch('+919876543210', '9876543210'), true);
    assert.equal(phonesMatch('+919876543210', '9123456780'), false);
  });
});
