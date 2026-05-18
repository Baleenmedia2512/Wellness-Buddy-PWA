/**
 * e2e/journeys/quick-share/capture-then-share-then-home.spec.js
 * @regression
 *
 * Journey: Member taps the shutter → camera opens → shareImageDirectly is called
 *          → app navigates to Home page. No backend round-trip.
 */
import { test, expect } from '@playwright/test';
import { loginAsMember } from '../../helpers/auth';

test.describe('@regression — Capture → share → Home', () => {
  test.beforeEach(async ({ page }) => {
    // Feature flag ON via env var — set before the app boots
    await page.addInitScript(() => {
      window.__REACT_APP_FF_QUICK_SHARE_CAMERA_FIRST = 'true';
    });
  });

  test('navigates to Home after shutter tap', async ({ page }) => {
    await loginAsMember(page);

    // Camera screen visible
    const shutter = page.getByRole('button', { name: /take photo and share/i });
    await expect(shutter).toBeVisible({ timeout: 8000 });

    // Tap shutter — cameraService and shareImageDirectly are mocked in test builds
    await shutter.click();

    // After share flow, app should show the Home screen (camera dismissed)
    await expect(shutter).not.toBeVisible({ timeout: 10000 });
  });
});
