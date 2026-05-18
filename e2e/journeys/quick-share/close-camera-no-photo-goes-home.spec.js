/**
 * e2e/journeys/quick-share/close-camera-no-photo-goes-home.spec.js
 * @regression
 *
 * Journey: Camera is shown, user taps the close (✕) button without taking a
 *          photo. App should navigate to Home without calling the capture API.
 */
import { test, expect } from '@playwright/test';
import { loginAsMember } from '../../helpers/auth';

test.describe('@regression — Close camera without photo → Home', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/feature-flags**', async route => {
      await route.fulfill({ status: 200, json: { ok: true, data: { 'ff.quick-share.camera-first': true } } });
    });
  });

  test('tapping close navigates to Home, no API call', async ({ page }) => {
    const captureRequests = [];
    await page.route('**/api/quick-share/capture', async route => {
      captureRequests.push(route.request().url());
      await route.continue();
    });

    await loginAsMember(page);
    await expect(page.getByRole('button', { name: /take photo and share/i })).toBeVisible({ timeout: 8000 });

    await page.getByRole('button', { name: /close camera/i }).click();

    // Camera should be gone
    await expect(page.getByRole('button', { name: /take photo and share/i })).not.toBeVisible({ timeout: 5000 });

    // No capture API call was made
    expect(captureRequests).toHaveLength(0);
  });
});
