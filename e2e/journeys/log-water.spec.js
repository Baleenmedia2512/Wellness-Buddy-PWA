/**
 * @journey @regression — Log water.
 *
 * Status: SCAFFOLD ONLY. Skipped until:
 *   1. E2E_USER_EMAIL / E2E_USER_PASSWORD are provided (see e2e/README.md).
 *   2. Real selectors are confirmed against the running app — the locators
 *      below are best-guess heuristics that almost certainly need tweaking
 *      after first live run.
 *
 * Once enabled, this journey covers:
 *   - login
 *   - navigate to Water tracker
 *   - log a fixed amount (e.g. 250 ml)
 *   - assert total increased
 *   - assert log entry visible
 */
const { test, expect } = require('@playwright/test');
const { loginAsUser } = require('../helpers/auth');

test.describe('Log water @journey @regression', () => {
  test.skip(
    !process.env.E2E_USER_EMAIL,
    'E2E_USER_EMAIL not set — see e2e/README.md',
  );

  test('user can log 250 ml and see it reflected in the daily total', async ({
    page,
  }) => {
    await loginAsUser(page);

    // Navigate to the water tracker. TODO: confirm exact link text.
    await page.getByRole('link', { name: /water/i }).first().click();
    await expect(page.getByRole('heading', { name: /water/i }).first()).toBeVisible();

    // Capture starting total. TODO: confirm the visible total format.
    const totalLocator = page.getByText(/\d+\s*(ml|l)\b/i).first();
    const before = (await totalLocator.textContent()) || '';

    // Click a +250 ml preset. TODO: confirm button label.
    await page.getByRole('button', { name: /\+?\s*250\s*ml/i }).click();

    // Wait for success toast then re-read total.
    await expect(page.getByText(/logged successfully/i)).toBeVisible({
      timeout: 10_000,
    });
    await expect(totalLocator).not.toHaveText(before, { timeout: 10_000 });
  });
});
