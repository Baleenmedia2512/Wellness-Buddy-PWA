import {
  buildPhoneLookupVariants,
  canonicalPhoneForStorage,
  phonesMatch,
} from '../domain/phone-identity.rules.js';

describe('buildPhoneLookupVariants', () => {
  it('includes E.164 and 10-digit forms for Indian numbers', () => {
    const variants = buildPhoneLookupVariants('+917845834957');
    expect(variants).toContain('+917845834957');
    expect(variants).toContain('7845834957');
    expect(variants).toContain('917845834957');
  });

  it('includes E.164 when input is 10-digit national', () => {
    const variants = buildPhoneLookupVariants('9876543210');
    expect(variants).toContain('9876543210');
    expect(variants).toContain('+919876543210');
  });
});

describe('canonicalPhoneForStorage', () => {
  it('stores 10-digit national for +91 E.164', () => {
    expect(canonicalPhoneForStorage('+917845834957')).toBe('7845834957');
  });

  it('keeps 10-digit national unchanged', () => {
    expect(canonicalPhoneForStorage('9876543210')).toBe('9876543210');
  });
});

describe('phonesMatch', () => {
  it('matches E.164 to legacy 10-digit row', () => {
    expect(phonesMatch('+917845834957', '7845834957')).toBe(true);
  });

  it('does not match different numbers', () => {
    expect(phonesMatch('+917845834957', '9876543210')).toBe(false);
  });
});
