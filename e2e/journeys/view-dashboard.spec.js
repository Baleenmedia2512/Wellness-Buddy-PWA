/**
 * @journey @regression — View dashboard.
 *
 * Status: SCAFFOLD ONLY. Skipped until credentials + real selectors confirmed.
 */
const { test, expect } = require('@playwright/test');
const { loginAsUser } = require('../helpers/auth');

test.describe('View dashboard @journey @regression', () => {
  test.skip(
    !process.env.E2E_USER_EMAIL,
    'E2E_USER_EMAIL not set — see e2e/README.md',
  );

  test('user lands on dashboard and sees core wellness cards', async ({ page }) => {
    await loginAsUser(page);

    // Already on dashboard after login per helpers/auth.js URL pattern.
    // Assert at least three core widgets are visible — water, weight, and one
    // of activity/screen-time/discipline. TODO: confirm card titles.
    await expect(page.getByText(/water/i).first()).toBeVisible();
    await expect(page.getByText(/weight/i).first()).toBeVisible();
    await expect(
      page.getByText(/activity|steps|screen|discipline/i).first(),
    ).toBeVisible();

    // No spinner stuck after settle.
    await expect(page.getByRole('progressbar')).toHaveCount(0, { timeout: 15_000 });
  });
});
