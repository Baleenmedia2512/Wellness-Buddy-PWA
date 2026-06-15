/**
 * OTP SMS message bodies — pure string builders (no I/O).
 * MDT template must match the DLT-approved wording from the provider.
 */

import { MDT_APP_NAME } from './mdt-phone.rules.js';

export function buildMdtOtpMessage(otp, appName = MDT_APP_NAME) {
  const code = String(otp || '').trim();
  const name = String(appName || MDT_APP_NAME).trim();
  return (
    `Dear ${code}, Your OTP for login to ${name}. Valid for 30 minutes. `
    + 'Please do not share this OTP. Regards, My Dreams Technology Team'
  );
}
