import { ValidationError } from '../../shared/lib/ValidationError.js';
import { isValidPhoneE164 } from './domain/contactIdentifier.js';
import {
  isValidOtpForContactType,
  otpValidationMessageForContactType,
} from './domain/otp-length.rules.js';

function normalizeRecipient(raw, contactType) {
  const trimmed = raw ? String(raw).trim() : raw;
  if (!trimmed) return trimmed;
  return contactType === 'email' ? trimmed.toLowerCase() : trimmed;
}

function extractConsent(body) {
  if (!body || typeof body !== 'object') {
    return { consentAccepted: false, consentVersion: '', deviceInfo: '' };
  }
  const deviceInfo = body.deviceInfo != null ? String(body.deviceInfo).trim().slice(0, 500) : '';
  return {
    consentAccepted: body.consentAccepted === true,
    consentVersion: body.consentVersion != null ? String(body.consentVersion).trim() : '',
    // Client may send platform hint; IP is never taken from the body.
    deviceInfo,
  };
}

export function validateSendOtp(body) {
  if (!body) throw new ValidationError(400, 'Recipient is required');
  const contactType = body.contactType || 'phone';
  const recipient = normalizeRecipient(body.recipient, contactType);
  if (!recipient) throw new ValidationError(400, 'Recipient is required');
  if (contactType === 'phone' && !isValidPhoneE164(recipient)) {
    throw new ValidationError(400, 'Invalid phone number');
  }
  return { recipient, contactType, ...extractConsent(body) };
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
  if (!isValidOtpForContactType(String(otp).trim(), contactType)) {
    throw new ValidationError(400, otpValidationMessageForContactType(contactType));
  }
  return {
    recipient,
    otp: String(otp),
    contactType,
    purpose: body.purpose || '',
    timezoneIana: body.timezoneIana ?? body.timezone ?? undefined,
    ...extractConsent(body),
    // Populated by the route handler from the HTTP request.
    ipAddress: body.ipAddress != null ? String(body.ipAddress).trim().slice(0, 64) : null,
  };
}

// Firebase Phone Auth validator removed (no Firebase integration configured)
