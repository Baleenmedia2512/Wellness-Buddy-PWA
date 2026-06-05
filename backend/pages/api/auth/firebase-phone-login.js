import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { validateFirebasePhoneLogin } from '../../../features/auth/auth.validators.js';
import { firebasePhoneLogin } from '../../../features/auth/auth.service.js';

// POST /api/auth/firebase-phone-login
// Body: { idToken: string, name?: string }
// Returns the same shape as /api/auth/verify-otp so the frontend session
// bootstrap is identical for both auth paths.
export default async function handler(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;
  if (req.method !== 'POST') return methodNotAllowed(res);
  return runService(res, () => firebasePhoneLogin(validateFirebasePhoneLogin(req.body)));
}
