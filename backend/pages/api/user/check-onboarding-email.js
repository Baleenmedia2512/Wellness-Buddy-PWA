import { applyCors, methodNotAllowed, runService } from '../../../shared/lib/handler.js';
import { readJsonBody } from '../../../shared/lib/readJsonBody.js';
import { validateCheckOnboardingEmail } from '../../../features/user/user.validators.js';
import { checkOnboardingEmail } from '../../../features/user/onboarding-email.service.js';

export const config = {
  api: { bodyParser: false },
};

export default async function handler(req, res) {
  if (applyCors(req, res, 'POST, OPTIONS')) return;
  if (req.method !== 'POST') return methodNotAllowed(res);

  const parsed = await readJsonBody(req);
  if (!parsed.ok) {
    return res.status(400).json({ success: false, message: parsed.message });
  }

  return runService(res, () => checkOnboardingEmail(validateCheckOnboardingEmail(parsed.body)));
}
