/**
 * Run: node --test frontend/src/shared/domain/__tests__/phoneContact.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  digitsOnlyPhone,
  isCallablePhone,
  whatsAppPhoneDigits,
  telHref,
  whatsAppHref,
} from '../phoneContact.js';

describe('digitsOnlyPhone', () => {
  it('strips formatting', () => {
    assert.equal(digitsOnlyPhone('+91 98765-43210'), '919876543210');
  });
});

describe('isCallablePhone', () => {
  it('rejects empty and placeholders', () => {
    assert.equal(isCallablePhone(''), false);
    assert.equal(isCallablePhone(null), false);
    assert.equal(isCallablePhone('N/A'), false);
    assert.equal(isCallablePhone('—'), false);
  });

  it('accepts E.164 and 10-digit Indian numbers', () => {
    assert.equal(isCallablePhone('+919876543210'), true);
    assert.equal(isCallablePhone('9876543210'), true);
  });
});

describe('whatsAppPhoneDigits', () => {
  it('prefixes 91 for 10-digit Indian numbers', () => {
    assert.equal(whatsAppPhoneDigits('9876543210'), '919876543210');
  });

  it('keeps full international digits', () => {
    assert.equal(whatsAppPhoneDigits('+971501234567'), '971501234567');
  });
});

describe('telHref / whatsAppHref', () => {
  it('builds tel and wa.me links', () => {
    assert.equal(telHref('9876543210'), 'tel:+919876543210');
    assert.equal(whatsAppHref('9876543210'), 'https://wa.me/919876543210');
    assert.equal(telHref('+971501234567'), 'tel:+971501234567');
    assert.equal(whatsAppHref('N/A'), '');
  });
});
