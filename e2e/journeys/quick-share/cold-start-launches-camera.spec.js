/**
 * e2e/journeys/quick-share/cold-start-launches-camera.spec.js
 * @regression
 *
 * Journey: Member cold-starts the app with ff.quick-share.camera-first ON.
 *          Verifies the camera screen renders as the first UI.
 */
import { test, expect } from '@playwright/test';
import { loginAsMember } from '../../helpers/auth';

test.describe('@regression — Cold start launches camera for member', () => {
  test.beforeEach(async ({ page }) => {
    // Seed feature flag ON for test session
    await page.route('**/api/feature-flags**', async route => {
      await route.fulfill({
        status: 200,
        json: { ok: true, data: { 'ff.quick-share.camera-first': true } },
      });
    });
  });

  test('camera-first screen shown on cold start for member role', async ({ page }) => {
    await loginAsMember(page);
    // Wait for app to load — camera screen should be first
    await expect(page.getByRole('button', { name: /take photo and share/i })).toBeVisible({ timeout: 8000 });
  });

  test('no camera screen for coach role', async ({ page }) => {
    // Override auth helper to log in as coach (reuse existing helpers/auth.js pattern)
    await page.route('**/api/user/context**', async route => {
      await route.fulfill({
        status: 200,
        json: { ok: true, data: { userId: 'coach-1', role: 'coach', firstName: 'CoachX' } },
      });
    });
    await loginAsMember(page); // auth flow — role override above wins
    // Coach should NOT see camera shutter
    await expect(page.getByRole('button', { name: /take photo and share/i })).not.toBeVisible({ timeout: 4000 });
  });
});
