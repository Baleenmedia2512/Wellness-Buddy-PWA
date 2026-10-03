const { test, expect } = require('@playwright/test');

test('Satellite test', async ({ page }) => {
  await page.goto('/');
  const clubTab = page.getByRole('button', { name: 'Physical Club' });
  await clubTab.evaluate((element) => element.dispatchEvent(new Event('click', { bubbles: true })));
  
  await page.waitForTimeout(2000);
  
  const satelliteBtn = page.getByRole('button', { name: 'Satellite' });
  if (await satelliteBtn.isVisible()) {
      await satelliteBtn.click({ force: true });
  } else {
      console.log('Satellite button not visible');
  }
  
  await page.waitForTimeout(1000);
  
  const labelsCheckbox = page.getByRole('checkbox', { name: 'Labels' });
  if (await labelsCheckbox.isVisible()) {
      await labelsCheckbox.uncheck({ force: true });
  } else {
      console.log('Labels checkbox not visible');
  }
});
