/**
 * @smoke @regression
 *
 * Unauthenticated journey: the PWA shell loads, basic landing UI renders,
 * no console errors. Safe to run against any environment (including prod).
 *
 * Per claude.md §9.4 — assert on visible UI text, not internal testids.
 */
const { test, expect } = require('@playwright/test');

test.describe('App shell @smoke @regression', () => {
  test('home page responds, renders, and has no critical console errors', async ({
    page,
  }) => {
    const criticalErrors = [];
    page.on('pageerror', (err) => criticalErrors.push(`pageerror: ${err.message}`));
    page.on('console', (msg) => {
      if (msg.type() === 'error') criticalErrors.push(`console.error: ${msg.text()}`);
    });

    const response = await page.goto('/');
    expect(response, 'navigation should return a response').not.toBeNull();
    expect(response.status(), 'home should respond with 2xx/3xx').toBeLessThan(400);

    // The PWA always renders the <html> root; assert the document is non-empty.
    await expect(page.locator('html')).toBeVisible();

    // Page title should not be empty — a blank title usually means a build issue.
    await expect(page).toHaveTitle(/.+/);

    // No critical errors during initial paint.
    // (Service-worker registration warnings/info are not errors.)
    expect(
      criticalErrors,
      `Unexpected console.error or pageerror:\n${criticalErrors.join('\n')}`,
    ).toEqual([]);
  });

  test('static manifest is reachable (PWA installability sanity check)', async ({
    request,
    baseURL,
  }) => {
    // CRA emits /manifest.json at the site root.
    const res = await request.get(`${baseURL}/manifest.json`);
    expect(res.status(), '/manifest.json should be 200').toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty('name');
  });
});
