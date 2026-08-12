const { test, expect } = require('@playwright/test');

test.describe('Authenticated User', () => {

  test('AUTH-019 authenticated state is restored', async ({ page }) => {

    await page.goto('/');

    const isOtpVerified = await page.evaluate(() => {
      return localStorage.getItem('isOtpVerified');
    });

    const otpUser = await page.evaluate(() => {
      return localStorage.getItem('otpUser');
    });

    console.log('isOtpVerified:', isOtpVerified);
    console.log('otpUser:', otpUser);

    expect(isOtpVerified).toBe('true');
    expect(otpUser).toBe('{"isNewUser":false}');
  });

});