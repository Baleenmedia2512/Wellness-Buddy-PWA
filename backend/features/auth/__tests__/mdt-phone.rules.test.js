import { formatMdtDialNumber, getMdtSmsConfigGaps, MDT_OTP_EXPIRY_MINUTES, maskPhoneForLog, mdtApiKeyHint } from '../domain/mdt-phone.rules.js';
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
  it('matches Baleen Media DLT template shape', () => {
    const msg = buildMdtOtpMessage('482916');
    expect(msg).toBe(
      'Dear Customer, Your verification code for login is 482916. '
      + 'This code is valid for 10 minutes. Please do not share this code with anyone - Baleen Media',
    );
  });
});

describe('MDT_OTP_EXPIRY_MINUTES', () => {
  it('is 10 to match Baleen DLT template', () => {
    expect(MDT_OTP_EXPIRY_MINUTES).toBe(10);
  });
});

describe('getMdtSmsConfigGaps', () => {
  const saved = { ...process.env };

  afterEach(() => {
    process.env.MDT_SMS_API_KEY = saved.MDT_SMS_API_KEY;
    process.env.MDT_SMS_SENDER_ID = saved.MDT_SMS_SENDER_ID;
    process.env.MDT_SMS_TEMPLATE_ID = saved.MDT_SMS_TEMPLATE_ID;
  });

  it('flags missing DLT template ID', () => {
    process.env.MDT_SMS_API_KEY = 'test-key';
    process.env.MDT_SMS_SENDER_ID = 'BALEEN';
    delete process.env.MDT_SMS_TEMPLATE_ID;
    expect(getMdtSmsConfigGaps()).toEqual(['MDT_SMS_TEMPLATE_ID']);
  });

  it('returns empty when api key, sender, and template are set', () => {
    process.env.MDT_SMS_API_KEY = 'test-key';
    process.env.MDT_SMS_SENDER_ID = 'BALEEN';
    process.env.MDT_SMS_TEMPLATE_ID = '1234567890123456789012345';
    expect(getMdtSmsConfigGaps()).toEqual([]);
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
