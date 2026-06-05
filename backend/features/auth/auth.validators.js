import { ValidationError } from '../../shared/lib/ValidationError.js';

export function validateSendOtp(body) {
  if (!body) throw new ValidationError(400, 'Recipient is required');
  const rawRecipient = body.recipient;
  const recipient = rawRecipient ? String(rawRecipient).toLowerCase().trim() : rawRecipient;
  if (!recipient) throw new ValidationError(400, 'Recipient is required');
  return { recipient, contactType: body.contactType || 'phone' };
}

export function validateVerifyOtp(body) {
  if (!body) throw new ValidationError(400, 'Recipient and OTP are required');
  const rawRecipient = body.recipient;
  const recipient = rawRecipient ? String(rawRecipient).toLowerCase().trim() : rawRecipient;
  const { otp } = body;
  if (!recipient || !otp) throw new ValidationError(400, 'Recipient and OTP are required');
  return {
    recipient,
    otp: String(otp),
    contactType: body.contactType || 'email',
    purpose: body.purpose || '',
  };
}

// Phone login via Firebase. We DO NOT generate/verify the OTP ourselves — the
// Firebase SDK does that client-side and hands us a signed ID token, which we
// re-verify server-side in auth.service.js → firebasePhoneLogin().
export function validateFirebasePhoneLogin(body) {
  if (!body) throw new ValidationError(400, 'idToken is required');
  const { idToken, name } = body;
  if (!idToken || typeof idToken !== 'string' || idToken.length < 20) {
    throw new ValidationError(400, 'idToken is required');
  }
  return {
    idToken,
    name: name ? String(name).trim().slice(0, 60) : '',
  };
}
