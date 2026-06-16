import { ValidationError } from '../../shared/lib/ValidationError.js';
import { isValidPhoneE164 } from './domain/contactIdentifier.js';

function normalizeRecipient(raw, contactType) {
  const trimmed = raw ? String(raw).trim() : raw;
  if (!trimmed) return trimmed;
  return contactType === 'email' ? trimmed.toLowerCase() : trimmed;
}

export function validateSendOtp(body) {
  if (!body) throw new ValidationError(400, 'Recipient is required');
  const contactType = body.contactType || 'phone';
  const recipient = normalizeRecipient(body.recipient, contactType);
  if (!recipient) throw new ValidationError(400, 'Recipient is required');
  if (contactType === 'phone' && !isValidPhoneE164(recipient)) {
    throw new ValidationError(400, 'Invalid phone number');
  }
  return { recipient, contactType };
}

export function validateVerifyOtp(body) {
  if (!body) throw new ValidationError(400, 'Recipient and OTP are required');
  const contactType = body.contactType || 'email';
  const recipient = normalizeRecipient(body.recipient, contactType);
  const { otp } = body;
  if (!recipient || !otp) throw new ValidationError(400, 'Recipient and OTP are required');
  if (contactType === 'phone' && !isValidPhoneE164(recipient)) {
    throw new ValidationError(400, 'Invalid phone number');
  }
  return {
    recipient,
    otp: String(otp),
    contactType,
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
