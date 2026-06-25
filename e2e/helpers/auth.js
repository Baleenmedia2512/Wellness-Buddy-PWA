/**
 * Shared E2E helpers.
 * Per claude.md §9.2, helpers live alongside tests, not under shared/.
 */
const { expect } = require('@playwright/test');

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `Missing required env var ${name}. Create e2e/.env.local (gitignored) — see e2e/README.md.`,
    );
  }
  return v;
}

/**
 * Log in via the public login page. Uses email+password env credentials.
 * Selector strategy: prefer visible-text / placeholder over data-testids so a
 * UI rename surfaces as a real failure rather than a flake.
 */
async function loginAsUser(page, { email, password } = {}) {
  const e = email || requireEnv('E2E_USER_EMAIL');
  const p = password || requireEnv('E2E_USER_PASSWORD');
  await page.goto('/');
  await page
    .getByLabel(/email/i)
    .or(page.getByPlaceholder(/email/i))
    .first()
    .fill(e);
  await page
    .getByLabel(/password/i)
    .or(page.getByPlaceholder(/password/i))
    .first()
    .fill(p);
  await page.getByRole('button', { name: /sign in|log in|login/i }).click();
  await expect(page).toHaveURL(/dashboard|home|tracker|wellness/i, { timeout: 15_000 });
}

async function loginAsCoach(page) {
  return loginAsUser(page, {
    email: requireEnv('E2E_COACH_EMAIL'),
    password: requireEnv('E2E_COACH_PASSWORD'),
  });
}

module.exports = { loginAsUser, loginAsCoach, requireEnv };
