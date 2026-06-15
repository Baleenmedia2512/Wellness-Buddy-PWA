import { formatMdtDialNumber, MDT_OTP_EXPIRY_MINUTES, maskPhoneForLog, mdtApiKeyHint } from '../domain/mdt-phone.rules.js';
import { buildMdtOtpMessage } from '../domain/otp-message.rules.js';

describe('formatMdtDialNumber', () => {
  it('converts +91 E.164 to 10-digit Indian format per MDT PDF', () => {
    expect(formatMdtDialNumber('+919876543210')).toBe('9876543210');
  });

  it('keeps bare 10-digit Indian numbers', () => {
    expect(formatMdtDialNumber('9876543210')).toBe('9876543210');
  });

  it('strips leading 0 from 11-digit local numbers', () => {
    expect(formatMdtDialNumber('09876543210')).toBe('9876543210');
  });

  it('returns empty for too-short numbers', () => {
    expect(formatMdtDialNumber('+123')).toBe('');
  });
});

describe('buildMdtOtpMessage', () => {
  it('matches MDT DLT template shape', () => {
    const msg = buildMdtOtpMessage('482916', 'Wellness Valley');
    expect(msg).toContain('Dear 482916');
    expect(msg).toContain('login to Wellness Valley');
    expect(msg).toContain('30 minutes');
  });
});

describe('MDT_OTP_EXPIRY_MINUTES', () => {
  it('is 30 to match provider template', () => {
    expect(MDT_OTP_EXPIRY_MINUTES).toBe(30);
  });
});

describe('maskPhoneForLog', () => {
  it('masks all but last 4 digits', () => {
    expect(maskPhoneForLog('+919876543210')).toBe('***3210');
  });
});

describe('mdtApiKeyHint', () => {
  it('shows last 4 chars only', () => {
    expect(mdtApiKeyHint('pdtPO9aL4m8RSQTV')).toBe('***SQTV');
  });

  it('returns missing when empty', () => {
    expect(mdtApiKeyHint('')).toBe('missing');
  });
});
