import { formatMdtDialNumber, MDT_OTP_EXPIRY_MINUTES } from '../domain/mdt-phone.rules.js';
import { buildMdtOtpMessage } from '../domain/otp-message.rules.js';

describe('formatMdtDialNumber', () => {
  it('strips + and non-digits from E.164', () => {
    expect(formatMdtDialNumber('+919876543210')).toBe('919876543210');
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
