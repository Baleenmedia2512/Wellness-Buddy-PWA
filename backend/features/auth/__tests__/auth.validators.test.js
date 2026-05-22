import { validateSendOtp, validateVerifyOtp } from '../auth.validators.js';

function expectValidationError(fn, status, messageSubstring) {
  let caught;
  try { fn(); } catch (e) { caught = e; }
  expect(caught).toBeDefined();
  expect(caught.statusCode || caught.status).toBe(status);
  if (messageSubstring) {
    expect(String(caught.message)).toEqual(expect.stringContaining(messageSubstring));
  }
}

describe('auth.validators · validateSendOtp', () => {
  it('lowercases + trims recipient and defaults contactType to "phone"', () => {
    const out = validateSendOtp({ recipient: '  USER@Example.COM  ' });
    expect(out).toEqual({ recipient: 'user@example.com', contactType: 'phone' });
  });

  it('passes through explicit contactType', () => {
    const out = validateSendOtp({ recipient: '+919876543210', contactType: 'email' });
    expect(out.contactType).toBe('email');
    expect(out.recipient).toBe('+919876543210');
  });

  it.each([
    ['null body', null],
    ['undefined body', undefined],
    ['missing recipient', {}],
    ['empty string recipient', { recipient: '' }],
    ['whitespace-only recipient', { recipient: '   ' }],
  ])('rejects when %s', (_label, body) => {
    expectValidationError(() => validateSendOtp(body), 400, 'Recipient is required');
  });
});

describe('auth.validators · validateVerifyOtp', () => {
  it('lowercases recipient, coerces otp to string, defaults contactType/purpose', () => {
    const out = validateVerifyOtp({ recipient: 'USER@x.io', otp: 123456 });
    expect(out).toEqual({
      recipient: 'user@x.io',
      otp: '123456',
      contactType: 'email',
      purpose: '',
    });
  });

  it('passes through explicit contactType + purpose', () => {
    const out = validateVerifyOtp({
      recipient: 'a@b.com', otp: '0000', contactType: 'phone', purpose: 'login',
    });
    expect(out.contactType).toBe('phone');
    expect(out.purpose).toBe('login');
  });

  it.each([
    ['null body', null],
    ['empty body', {}],
    ['recipient only', { recipient: 'a@b.com' }],
    ['otp only', { otp: '1234' }],
    ['blank recipient', { recipient: '   ', otp: '1234' }],
  ])('rejects when %s', (_label, body) => {
    expectValidationError(() => validateVerifyOtp(body), 400, 'Recipient and OTP are required');
  });
});
