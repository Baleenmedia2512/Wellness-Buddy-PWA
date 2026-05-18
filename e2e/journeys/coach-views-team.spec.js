/**
 * @journey @regression — Coach views team.
 *
 * Status: SCAFFOLD ONLY. Skipped until coach credentials + selectors confirmed.
 *
 * Covers permission-boundary scenario per claude.md §9.4 (a coach sees their
 * team list and at least one member's summary).
 */
const { test, expect } = require('@playwright/test');
const { loginAsCoach } = require('../helpers/auth');

test.describe('Coach views team @journey @regression', () => {
  test.skip(
    !process.env.E2E_COACH_EMAIL,
    'E2E_COACH_EMAIL not set — see e2e/README.md',
  );

  test('coach can open team view and see ≥1 member', async ({ page }) => {
    await loginAsCoach(page);

    // Navigate to team / coach view. TODO: confirm exact nav label.
    await page.getByRole('link', { name: /team|members|coach/i }).first().click();
    await expect(page.getByRole('heading', { name: /team|members/i }).first()).toBeVisible();

    // At least one member row should render.
    const memberRows = page.getByRole('listitem').or(page.getByRole('row'));
    await expect(memberRows.first()).toBeVisible({ timeout: 15_000 });
    expect(await memberRows.count()).toBeGreaterThanOrEqual(1);
  });
});
