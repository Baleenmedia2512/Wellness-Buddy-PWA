/**
 * @journey @regression — Log weight.
 *
 * Status: SCAFFOLD ONLY. Skipped until credentials + real selectors confirmed.
 */
const { test, expect } = require('@playwright/test');
const { loginAsUser } = require('../helpers/auth');

test.describe('Log weight @journey @regression', () => {
  test.skip(
    !process.env.E2E_USER_EMAIL,
    'E2E_USER_EMAIL not set — see e2e/README.md',
  );

  test('user can log a new weight reading and see it on the history', async ({
    page,
  }) => {
    await loginAsUser(page);

    await page.getByRole('link', { name: /weight/i }).first().click();
    await expect(page.getByRole('heading', { name: /weight/i }).first()).toBeVisible();

    // Open the add-weight form. TODO: confirm exact button label.
    await page.getByRole('button', { name: /add weight|log weight|new entry/i }).click();

    // Pick a value unlikely to clash with prior test data.
    const value = (60 + Math.random() * 30).toFixed(1);
    await page.getByLabel(/weight|kg/i).first().fill(value);
    await page.getByRole('button', { name: /save|submit|log/i }).click();

    // The new value should appear in the history list.
    await expect(page.getByText(value, { exact: false })).toBeVisible({
      timeout: 10_000,
    });
  });
});
