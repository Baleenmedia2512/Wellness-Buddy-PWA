/**
 * OTP SMS message bodies — pure string builders (no I/O).
 * Must match the DLT-approved Baleen Media template exactly (incl. 10-minute expiry).
 */

export function buildMdtOtpMessage(otp) {
  const code = String(otp || '').trim();
  return (
    `Dear Customer, Your verification code for login is ${code}. `
    + 'This code is valid for 10 minutes. Please do not share this code with anyone - Baleen Media'
  );
}
