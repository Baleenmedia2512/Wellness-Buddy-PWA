import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { validateDeleteAccount } from '../../../features/user/user.validators.js';
import { deleteAccount } from '../../../features/user/user.service.js';
import { hasRecentlyVerifiedOtp } from '../../../features/auth/auth.service.js';

/**
 * DELETE /api/user/account
 *
 * Dual path (§5.1 mobile compatibility):
 * - New: { userId, confirmPhrase: 'DELETE' } — no email OTP
 * - Legacy: { email } — requires recent email OTP (old app binaries)
 */
export default async function handler(req, res) {
  if (applyCors(req, res, 'DELETE, OPTIONS')) return;
  if (req.method !== 'DELETE') return methodNotAllowed(res);
  return runService(res, async () => {
    const parsed = validateDeleteAccount(req.body);

    if (parsed.mode === 'legacyEmail') {
      // Enforce that the caller completed the OTP flow server-side within the
      // last 15 minutes — prevents unauthenticated direct calls from bypassing
      // the OTP gate and deleting arbitrary accounts.
      const otpVerified = await hasRecentlyVerifiedOtp(parsed.email, 'email');
      if (!otpVerified) {
        return {
          httpStatus: 403,
          body: { success: false, message: 'OTP verification required before account deletion.' },
        };
      }
      return deleteAccount({ email: parsed.email });
    }

    return deleteAccount({ userId: parsed.userId });
  });
}
