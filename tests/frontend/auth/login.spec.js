const { test, expect } = require('@playwright/test');

const TEST_PHONE = '7695834209';
const TEST_OTP = '123456';
const TEST_EMAIL = 'existinguser@test.com';
const NEW_USER_EMAIL = 'newuser@test.com';

/**
 * Common OTP mocks.
 */
async function mockSendOtp(page) {
  await page.route('**/api/auth/send-otp', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
      }),
    });
  });
}

/**
 * User lookup is called by App.js after OTP verification
 * when the mocked user contains an email.
 */
async function mockActiveUserLookup(page) {
  await page.route('**/api/user/lookup', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        isActive: true,
        isNewUser: false,
      }),
    });
  });
}

/**
 * Complete profile API.
 */
async function mockCompleteProfile(page) {
  await page.route('**/api/user/profile*', async route => {
    const url = route.request().url();

    // This is the profile read used by App.js/profile-completion.
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            profileComplete: true,
            userName: 'Existing User',
            email: TEST_EMAIL,
            height: 170,
            dietType: 'Non-Vegetarian',
            gender: 'Male',
            currentWeight: 70,
            bodyFat: 20,
            profileImage: 'https://example.com/profile.jpg',
            physicalActivityLevel: 'moderate',
          },
        }),
      });
      return;
    }

    await route.continue();
  });
}

/**
 * Incomplete profile API.
 * Used for AUTH-023 after consent is accepted.
 */
async function mockIncompleteProfile(page) {
  await page.route('**/api/user/profile*', async route => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            profileComplete: false,
            userName: null,
            email: NEW_USER_EMAIL,
            height: null,
            dietType: null,
            gender: null,
            currentWeight: null,
            bodyFat: null,
            profileImage: null,
            physicalActivityLevel: null,
          },
        }),
      });
      return;
    }

    await route.continue();
  });
}

/**
 * Setup status is checked after profile completion.
 * "skipped" prevents the coach setup wizard from becoming
 * another gate in AUTH-021.
 */
async function mockSetupSkipped(page) {
  await page.route('**/api/user/status**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        setupSkipped: true,
        setupComplete: true,
        pendingRequest: false,
      }),
    });
  });
}

/**
 * Existing user has already accepted consent.
 */
async function mockConsentAlreadyAccepted(page) {
  await page.route('**/api/user/consent**', async route => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          consentRequired: false,
          consentAccepted: true,
        }),
      });
      return;
    }

    await route.continue();
  });
}

/**
 * New user still requires consent.
 * Also mocks POST/DELETE because AUTH-022/023 use them.
 */
async function mockConsentRequired(page) {
  await page.route('**/api/user/consent**', async route => {
    const method = route.request().method();

    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          consentRequired: true,
          consentAccepted: false,
        }),
      });
      return;
    }

    if (method === 'POST') {
      console.log('AUTH: POST /api/user/consent');

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          consentRequired: false,
          consentAccepted: true,
        }),
      });
      return;
    }

    if (method === 'DELETE') {
      console.log('AUTH: DELETE /api/user/consent');

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
        }),
      });
      return;
    }

    await route.continue();
  });
}

/**
 * Home leaderboards.
 * The ZIP shows that "Top 10 Score" is rendered only when
 * the wellness-score leaderboard receives non-empty data.
 */
async function mockHomeLeaderboards(page) {

  await page.route(
    '**/api/leaderboard/get-global-leaderboard**',
    async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              userId: 1,
              userName: 'Test User',
              email: TEST_EMAIL,
              coachName: 'Test Coach',
              sponsorName: 'Test Sponsor',
              weightLoss: 0.5,
              rank: 1,
            },
          ],
        }),
      });
    }
  );

  await page.route(
    '**/api/leaderboard/get-wellness-score-leaderboard**',
    async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              userId: 1,
              userName: 'Test User',
              email: TEST_EMAIL,
              wellnessPercentage: 85,
              totalEarned: 850,
              totalPossible: 1000,
              rank: 1,
            },
          ],
        }),
      });
    }
  );
}

/**
 * Verify that React has processed the OTP response.
 */
async function waitForOtpAuthentication(page, expectedNewUser) {

  await expect
    .poll(
      async () => {
        return await page.evaluate(() => ({
          isOtpVerified: localStorage.getItem('isOtpVerified'),
          otpUser: localStorage.getItem('otpUser'),
        }));
      },
      {
        timeout: 15000,
        intervals: [200, 500, 1000],
      }
    )
    .toMatchObject({
      isOtpVerified: 'true',
    });

  const storedUser = await page.evaluate(() => {
    const raw = localStorage.getItem('otpUser');
    return raw ? JSON.parse(raw) : null;
  });

  expect(storedUser?.isNewUser).toBe(expectedNewUser);

  console.log('OTP AUTH STATE:', {
    isOtpVerified: await page.evaluate(() =>
      localStorage.getItem('isOtpVerified')
    ),
    otpUser: storedUser,
  });
}

/**
 * Login through the actual UI.
 *
 * The ZIP confirms:
 * - Mobile Number is an accessible label
 * - OTP consists of six input[type=tel] fields
 * - OTP auto-verifies when all digits are filled
 */
async function performOtpLogin(page, phone = TEST_PHONE) {

  await page.goto('/');

  await expect(
    page.getByLabel('Mobile Number')
  ).toBeVisible();

  await page
    .getByLabel('Mobile Number')
    .fill(phone);

  await page
    .getByRole('button', {
      name: 'Send OTP',
    })
    .click();

  await expect(
    page.getByText('Enter OTP', {
      exact: true,
    })
  ).toBeVisible({
    timeout: 15000,
  });

  const otpInputs = page.locator('input[type="tel"]');

  await expect(otpInputs).toHaveCount(6);

  for (let i = 0; i < TEST_OTP.length; i++) {
    await otpInputs.nth(i).fill(TEST_OTP[i]);
  }
}
test.describe('Login', () => {

  test('AUTH-001 login page is displayed', async ({ page }) => {

    await page.goto('/');

    await expect(page).toHaveTitle(/Wellness/i);

    await expect(
      page.getByLabel('Mobile Number')
    ).toBeVisible();

  });

  test('AUTH-002 user can enter mobile number', async ({ page }) => {

    await page.goto('/');

    const mobileInput = page.getByLabel('Mobile Number');

    await mobileInput.fill('7695834209');

    await expect(mobileInput).toHaveValue('7695834209');

  });

test('AUTH-003 empty mobile number is rejected', async ({ page }) => {

  await page.goto('/');

  const mobileInput = page.getByLabel('Mobile Number');

  const sendOtpButton = page.getByRole('button', {
    name: 'Send OTP'
  });

  await expect(mobileInput).toBeVisible();

  await expect(sendOtpButton).toBeDisabled();

});

test('AUTH-004 valid mobile number enables Send OTP', async ({ page }) => {

  await page.goto('/');

  const mobileInput = page.getByLabel('Mobile Number');

  const sendOtpButton = page.getByRole('button', {
    name: 'Send OTP'
  });

  await mobileInput.fill('7695834209');

  await expect(mobileInput).toHaveValue('7695834209');

  await expect(sendOtpButton).toBeEnabled();

});

test('AUTH-005 non-numeric characters are removed from mobile number', async ({ page }) => {

  await page.goto('/');

  const mobileInput = page.getByLabel('Mobile Number');

  await mobileInput.fill('769abc,@583xyz4209');

  await expect(mobileInput).toHaveValue('7695834209');

});

test('AUTH-006 country code selector is available', async ({ page }) => {

  await page.goto('/');

  const countryCode = page.getByLabel('Country code');

  await expect(countryCode).toBeVisible();

  await expect(countryCode).toHaveValue('+91');

});

test('AUTH-007 user can change country code', async ({ page }) => {

  await page.goto('/');

  const countryCode = page.getByLabel('Country code');

  await countryCode.selectOption('+1');

  await expect(countryCode).toHaveValue('+1');

});

test('AUTH-008 user can request OTP', async ({ page }) => {

  await page.route('**/api/auth/send-otp', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true
      }),
    });
  });

  await page.goto('/');

  const mobileInput = page.getByLabel('Mobile Number');

  await mobileInput.fill('7695834209');

  const sendOtpButton = page.getByRole('button', {
    name: 'Send OTP'
  });

  await expect(sendOtpButton).toBeEnabled();

  await sendOtpButton.click();

  await expect(
    page.getByText('Enter OTP', { exact: true })
  ).toBeVisible();

});

test('AUTH-009 OTP screen displays six input fields', async ({ page }) => {

  await page.route('**/api/auth/send-otp', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true
      }),
    });
  });

  await page.goto('/');

  await page.getByLabel('Mobile Number').fill('7695834209');

  await page.getByRole('button', {
    name: 'Send OTP'
  }).click();

  await expect(
    page.getByText('Enter OTP', { exact: true })
  ).toBeVisible();

  const otpInputs = page.locator('input[type="tel"]');

  await expect(otpInputs).toHaveCount(6);

});

test('AUTH-010 user can enter OTP', async ({ page }) => {

  await page.route('**/api/auth/send-otp', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true
      }),
    });
  });

  await page.goto('/');

  await page.getByLabel('Mobile Number').fill('7695834209');

  await page.getByRole('button', {
    name: 'Send OTP'
  }).click();

  const otpInputs = page.locator('input[type="tel"]');

  await expect(otpInputs).toHaveCount(6);

  const otp = '123456';

  for (let i = 0; i < otp.length; i++) {
    await otpInputs.nth(i).fill(otp[i]);
  }

  for (let i = 0; i < otp.length; i++) {
    await expect(
      otpInputs.nth(i)
    ).toHaveValue(otp[i]);
  }

});

test('AUTH-011 each OTP field accepts one digit', async ({ page }) => {

  await page.route('**/api/auth/send-otp', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true
      }),
    });
  });

  await page.goto('/');

  await page.getByLabel('Mobile Number').fill('7695834209');

  await page.getByRole('button', {
    name: 'Send OTP'
  }).click();

  const otpInputs = page.locator('input[type="tel"]');

  await otpInputs.nth(0).fill('1');

  await expect(
    otpInputs.nth(0)
  ).toHaveValue('1');

});

test('AUTH-012 user can return to mobile number screen', async ({ page }) => {

  await page.route('**/api/auth/send-otp', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true
      }),
    });
  });

  await page.goto('/');

  await page.getByLabel('Mobile Number').fill('7695834209');

  await page.getByRole('button', {
    name: 'Send OTP'
  }).click();

  await expect(
    page.getByText('Enter OTP', { exact: true })
  ).toBeVisible();

  await page.getByRole('button', {
    name: /Back/i
  }).click();

  await expect(
    page.getByLabel('Mobile Number')
  ).toBeVisible();

});

test('AUTH-013 discover OTP verification request', async ({ page }) => {

  // Mock sending OTP
  await page.route('**/api/auth/send-otp', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true
      }),
    });
  });

  // Log API requests
  page.on('request', request => {
    if (request.url().includes('/api/')) {
      console.log('API REQUEST:', request.method(), request.url());
      console.log('REQUEST BODY:', request.postData());
    }
  });

  // Log API responses
  page.on('response', async response => {
    if (response.url().includes('/api/')) {
      console.log(
        'API RESPONSE:',
        response.status(),
        response.url()
      );
    }
  });

  await page.goto('/');

  await page.getByLabel('Mobile Number').fill('7695834209');

  await page.getByRole('button', {
    name: 'Send OTP'
  }).click();

  const otpInputs = page.locator('input[type="tel"]');

  await expect(otpInputs).toHaveCount(6);

  // Enter a test OTP
  const otp = '123456';

  for (let i = 0; i < otp.length; i++) {
    await otpInputs.nth(i).fill(otp[i]);
  }

  // Give the verification request time to happen
  await page.waitForTimeout(2000);

});

test('AUTH-014 invalid OTP displays error', async ({ page }) => {

  // Mock Send OTP
  await page.route('**/api/auth/send-otp', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true
      }),
    });
  });

  // Mock Verify OTP with invalid OTP response
  await page.route('**/api/auth/verify-otp', async route => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({
        success: false,
        message: 'Invalid OTP'
      }),
    });
  });

  await page.goto('/');

  await page.getByLabel('Mobile Number').fill('7695834209');

  await page.getByRole('button', {
    name: 'Send OTP'
  }).click();

  const otpInputs = page.locator('input[type="tel"]');

  await expect(otpInputs).toHaveCount(6);

  const invalidOtp = '123456';

  for (let i = 0; i < invalidOtp.length; i++) {
    await otpInputs.nth(i).fill(invalidOtp[i]);
  }

  await expect(
    page.getByText(/invalid otp/i)
  ).toBeVisible();

});

test('AUTH-015 discover successful OTP response', async ({ page }) => {

  await page.route('**/api/auth/send-otp', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true
      }),
    });
  });

  await page.route('**/api/auth/verify-otp', async route => {
    console.log('VERIFY OTP REQUEST BODY:');
    console.log(route.request().postData());

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true
      }),
    });
  });

  await page.goto('/');

  await page.getByLabel('Mobile Number').fill('7695834209');

  await page.getByRole('button', {
    name: 'Send OTP'
  }).click();

  const otpInputs = page.locator('input[type="tel"]');

  await expect(otpInputs).toHaveCount(6);

  const otp = '123456';

  for (let i = 0; i < otp.length; i++) {
    await otpInputs.nth(i).fill(otp[i]);
  }

  await page.waitForTimeout(2000);

  console.log('CURRENT URL:');
  console.log(page.url());

  console.log('PAGE TEXT:');
  console.log(await page.locator('body').innerText());

});

test('AUTH-016 discover post-verification flow', async ({ page }) => {

  await page.route('**/api/auth/send-otp', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
      }),
    });
  });

  await page.route('**/api/auth/verify-otp', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
      }),
    });
  });

  page.on('request', request => {
    if (request.url().includes('/api/')) {
      console.log(
        'API REQUEST:',
        request.method(),
        request.url()
      );

      console.log(
        'REQUEST BODY:',
        request.postData()
      );
    }
  });

  page.on('response', response => {
    if (response.url().includes('/api/')) {
      console.log(
        'API RESPONSE:',
        response.status(),
        response.url()
      );
    }
  });

  await page.goto('/');

  await page.getByLabel('Mobile Number').fill('7695834209');

  await page.getByRole('button', {
    name: 'Send OTP',
  }).click();

  const otpInputs = page.locator('input[type="tel"]');

  await expect(otpInputs).toHaveCount(6);

  const otp = '123456';

  for (let i = 0; i < otp.length; i++) {
    await otpInputs.nth(i).fill(otp[i]);
  }

  await page.waitForTimeout(5000);

  console.log('CURRENT URL:', page.url());

  console.log('COOKIES:');
  console.log(await page.context().cookies());

  console.log('LOCAL STORAGE:');
  console.log(
    await page.evaluate(() => ({ ...localStorage }))
  );

});

test('AUTH-017 user can login with valid OTP', async ({ page }) => {

  // Mock Send OTP
  await page.route('**/api/auth/send-otp', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
      }),
    });
  });

  // Mock successful OTP verification
  await page.route('**/api/auth/verify-otp', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        isNewUser: false,
      }),
    });
  });

  await page.goto('/');

  // Enter mobile number
  await page.getByLabel('Mobile Number').fill('7695834209');

  // Send OTP
  await page.getByRole('button', {
    name: 'Send OTP',
  }).click();

  // Verify OTP screen
  const otpInputs = page.locator('input[type="tel"]');

  await expect(otpInputs).toHaveCount(6);

  // Enter valid OTP
  const otp = '123456';

  for (let i = 0; i < otp.length; i++) {
    await otpInputs.nth(i).fill(otp[i]);
  }

  // Wait for authentication to complete
  await expect
    .poll(async () => {
      return await page.evaluate(() =>
        localStorage.getItem('isOtpVerified')
      );
    })
    .toBe('true');

});

test('AUTH-018 successful login stores authenticated user state', async ({ page }) => {

  await page.route('**/api/auth/send-otp', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
      }),
    });
  });

  await page.route('**/api/auth/verify-otp', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        isNewUser: false,
      }),
    });
  });

  await page.goto('/');

  await page.getByLabel('Mobile Number').fill('7695834209');

  await page.getByRole('button', {
    name: 'Send OTP',
  }).click();

  const otpInputs = page.locator('input[type="tel"]');

  await expect(otpInputs).toHaveCount(6);

  const otp = '123456';

  for (let i = 0; i < otp.length; i++) {
    await otpInputs.nth(i).fill(otp[i]);
  }

  await expect
    .poll(async () => {
      return await page.evaluate(() => ({
        isOtpVerified: localStorage.getItem('isOtpVerified'),
        otpUser: localStorage.getItem('otpUser'),
      }));
    })
    .toEqual({
      isOtpVerified: 'true',
      otpUser: '{"isNewUser":false}',
    });

});

async function mockSendOtp(page) {
  await page.route('**/api/auth/send-otp', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
      }),
    });
  });
}

async function enterOtp(page) {
  await expect(
    page.getByText('Enter OTP', { exact: true })
  ).toBeVisible({
    timeout: 15000,
  });

  const otpInputs = page.locator('input[type="tel"]');

  await expect(otpInputs).toHaveCount(6, {
    timeout: 15000,
  });

  const otp = '123456';

  for (let i = 0; i < otp.length; i++) {
    await otpInputs.nth(i).fill(otp[i]);
  }

  await expect
    .poll(
      async () =>
        await page.evaluate(() =>
          localStorage.getItem('isOtpVerified')
        ),
      {
        timeout: 15000,
      }
    )
    .toBe('true');
}

// ============================================================
// Shared helper for AUTH-020 through AUTH-023
// ============================================================

async function completeOtpLogin(page, {
  isNewUser,
  consentRequired,
  userId = 999999,
  email = '',
}) {

  // ----------------------------------------------------------
  // Send OTP is intentionally NOT mocked.
  //
  // We want to exercise the real /api/auth/send-otp endpoint.
  // ----------------------------------------------------------

  // ----------------------------------------------------------
  // Only verify-otp is controlled so this test can explicitly
  // represent an existing user or a new user.
  // ----------------------------------------------------------

  await page.route('**/api/auth/verify-otp', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        message: 'OTP verified successfully',
        isNewUser,

        user: {
          id: userId,
          UserId: userId,
          username: isNewUser ? 'newuser' : 'existinguser',
          email,
          phone: '+917695834209',
          status: 'Active',
          consentRequired,
        },
      }),
    });
  });

  // ----------------------------------------------------------
  // Open login
  // ----------------------------------------------------------

  await page.goto('/');

  // ----------------------------------------------------------
  // Enter phone number
  // ----------------------------------------------------------

  await page
    .getByLabel('Mobile Number')
    .fill('7695834209');

  // ----------------------------------------------------------
  // Send OTP using the REAL backend
  // ----------------------------------------------------------

  await page
    .getByRole('button', {
      name: 'Send OTP',
    })
    .click();

  // ----------------------------------------------------------
  // OTP screen
  // ----------------------------------------------------------

  await expect(
    page.getByText('Enter OTP', {
      exact: true,
    })
  ).toBeVisible();

  const otpInputs = page.locator(
    'input[type="tel"]'
  );

  await expect(
    otpInputs
  ).toHaveCount(6);

  // ----------------------------------------------------------
  // Enter OTP
  // ----------------------------------------------------------

  const otp = '123456';

  for (let i = 0; i < otp.length; i++) {
    await otpInputs
      .nth(i)
      .fill(otp[i]);
  }

  // ----------------------------------------------------------
  // Wait for the application's success message.
  //
  // This is a better synchronization point than simply
  // waiting for localStorage.
  // ----------------------------------------------------------

  await expect(
    page.getByText(
      'OTP verified successfully!',
      {
        exact: true,
      }
    )
  ).toBeVisible();

  // ----------------------------------------------------------
  // Confirm the application stored authentication state.
  // ----------------------------------------------------------

  await expect
    .poll(async () => {
      return await page.evaluate(() => {
        const raw = localStorage.getItem('otpUser');

        if (!raw) {
          return null;
        }

        try {
          return JSON.parse(raw);
        } catch {
          return null;
        }
      });
    })
    .toMatchObject({
      isNewUser,
    });

  await expect
    .poll(async () => {
      return await page.evaluate(() =>
        localStorage.getItem('isOtpVerified')
      );
    })
    .toBe('true');
}


// ============================================================
// AUTH-020
// New user -> Consent Form
// ============================================================
// ============================================================
// Shared helper for AUTH-020 through AUTH-023
// ============================================================

async function completeOtpLogin(page, {
  isNewUser,
  consentRequired,
  userId = 999999,
  email = '',
}) {

  // ----------------------------------------------------------
  // Send OTP is intentionally NOT mocked.
  //
  // We want to exercise the real /api/auth/send-otp endpoint.
  // ----------------------------------------------------------

  // ----------------------------------------------------------
  // Only verify-otp is controlled so this test can explicitly
  // represent an existing user or a new user.
  // ----------------------------------------------------------

  await page.route('**/api/auth/verify-otp', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        message: 'OTP verified successfully',
        isNewUser,

        user: {
          id: userId,
          UserId: userId,
          username: isNewUser ? 'newuser' : 'existinguser',
          email,
          phone: '+917695834209',
          status: 'Active',
          consentRequired,
        },
      }),
    });
  });

  // ----------------------------------------------------------
  // Open login
  // ----------------------------------------------------------

  await page.goto('/');

  // ----------------------------------------------------------
  // Enter phone number
  // ----------------------------------------------------------

  await page
    .getByLabel('Mobile Number')
    .fill('7695834209');

  // ----------------------------------------------------------
  // Send OTP using the REAL backend
  // ----------------------------------------------------------

  await page
    .getByRole('button', {
      name: 'Send OTP',
    })
    .click();

  // ----------------------------------------------------------
  // OTP screen
  // ----------------------------------------------------------

  await expect(
    page.getByText('Enter OTP', {
      exact: true,
    })
  ).toBeVisible();

  const otpInputs = page.locator(
    'input[type="tel"]'
  );

  await expect(
    otpInputs
  ).toHaveCount(6);

  // ----------------------------------------------------------
  // Enter OTP
  // ----------------------------------------------------------

  const otp = '123456';

  for (let i = 0; i < otp.length; i++) {
    await otpInputs
      .nth(i)
      .fill(otp[i]);
  }

  // ----------------------------------------------------------
  // Wait for the application's success message.
  //
  // This is a better synchronization point than simply
  // waiting for localStorage.
  // ----------------------------------------------------------

  await expect(
    page.getByText(
      'OTP verified successfully!',
      {
        exact: true,
      }
    )
  ).toBeVisible();

  // ----------------------------------------------------------
  // Confirm the application stored authentication state.
  // ----------------------------------------------------------

  await expect
    .poll(async () => {
      return await page.evaluate(() => {
        const raw = localStorage.getItem('otpUser');

        if (!raw) {
          return null;
        }

        try {
          return JSON.parse(raw);
        } catch {
          return null;
        }
      });
    })
    .toMatchObject({
      isNewUser,
    });

  await expect
    .poll(async () => {
      return await page.evaluate(() =>
        localStorage.getItem('isOtpVerified')
      );
    })
    .toBe('true');
}


// ============================================================
// AUTH-020
// New user -> Consent Form
// ============================================================

test('AUTH-020 new user is shown consent form after login', async ({ page }) => {

  // ----------------------------------------------------------
  // A new user must still be considered as requiring consent.
  //
  // The application also performs a real GET /api/user/consent
  // after OTP. We control only that state.
  // ----------------------------------------------------------

  await page.route(
    '**/api/user/consent*',
    async route => {

      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            consentRequired: true,
            consentAccepted: false,
          }),
        });

        return;
      }

      await route.continue();
    }
  );

  await completeOtpLogin(page, {
    isNewUser: true,
    consentRequired: true,
    email: '',
  });

  // ----------------------------------------------------------
  // Verify actual Consent Form
  // ----------------------------------------------------------

  await expect(
    page.getByRole('heading', {
      name: 'User Consent Form',
    })
  ).toBeVisible();

  await expect(
    page.getByText(
      'Consent to Collect and Use Personal and Health Information',
      {
        exact: true,
      }
    )
  ).toBeVisible();

  await expect(
    page.getByText('I Agree', {
      exact: true,
    }).last()
  ).toBeVisible();

  await expect(
    page.getByText("I Don't Agree", {
      exact: true,
    }).last()
  ).toBeVisible();

  await expect(
    page.getByRole('button', {
      name: 'Continue',
    })
  ).toBeVisible();

  // ----------------------------------------------------------
  // Login page must no longer be displayed
  // ----------------------------------------------------------

  await expect(
    page.getByLabel('Mobile Number')
  ).not.toBeVisible();
});


// ============================================================
// AUTH-021
// Existing user -> Home
// ============================================================

test('AUTH-021 existing user is shown home after login', async ({ page }) => {

  // ==========================================================
  // 1. Verify OTP as EXISTING USER
  // ==========================================================

  await page.route('**/api/auth/verify-otp', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        isNewUser: false,

        user: {
          id: 999999,
          UserId: 999999,
          username: 'existinguser',
          email: 'existinguser@test.com',
          phone: '+917695834209',
          status: 'Active',
          consentRequired: false,
        },
      }),
    });
  });


  // ==========================================================
  // 2. REAL application flow checks /api/user/lookup
  //    Return an ACTIVE existing user.
  // ==========================================================

  await page.route('**/api/user/lookup', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        isNewUser: false,
        isActive: true,
        role: 'user',
      }),
    });
  });


  // ==========================================================
  // 3. Existing user already accepted consent
  // ==========================================================

  await page.route('**/api/user/consent*', async route => {

    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          consentRequired: false,
          consentAccepted: true,
        }),
      });

      return;
    }

    await route.continue();
  });


  // ==========================================================
  // 4. Existing user's profile is complete
  // ==========================================================

  await page.route('**/api/user/profile*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,

        data: {
          userId: 999999,

          userName: 'Existing User',
          email: 'existinguser@test.com',
          phoneNumber: '+917695834209',

          gender: 'Male',
          height: 170,
          dietType: 'Non-Vegetarian',

          latestWeight: 70,
          latestWeightBodyFat: 20,
          bodyFat: 20,

          physicalActivityLevel: 'moderate',

          profileImage: 'https://example.com/profile.jpg',

          profileComplete: true,

          profilePicSnooze: null,
        },
      }),
    });
  });


  // ==========================================================
  // 5. Setup is already complete
  //
  // This prevents the application from opening the coach/setup
  // wizard after the profile gate is cleared.
  // ==========================================================

  await page.route('**/api/user/status?email=*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,

        setupComplete: true,
        hasTeamId: true,
        hasUpline: true,
        setupSkipped: true,

        teamId: 1,
        uplineCoachId: 1,
        role: 'user',

        pendingRequest: null,
        redirectTo: '/dashboard',
      }),
    });
  });


  // ==========================================================
  // 6. Open login
  // ==========================================================

  await page.goto('/');


  // ==========================================================
  // 7. Enter mobile number
  // ==========================================================

  await page
    .getByLabel('Mobile Number')
    .fill('7695834209');


  // ==========================================================
  // 8. Send OTP
  //
  // NOT mocked.
  // This keeps the test connected to the real send-otp flow.
  // ==========================================================

  await page
    .getByRole('button', {
      name: 'Send OTP',
    })
    .click();


  // ==========================================================
  // 9. OTP screen
  // ==========================================================

  const otpInputs =
    page.locator('input[type="tel"]');

  await expect(
    otpInputs
  ).toHaveCount(6);


  // ==========================================================
  // 10. Enter OTP
  // ==========================================================

  const otp = '123456';

  for (let i = 0; i < otp.length; i++) {
    await otpInputs
      .nth(i)
      .fill(otp[i]);
  }


  // ==========================================================
  // 11. Wait for OTP success
  // ==========================================================

  await expect(
    page.getByText(
      'OTP verified successfully!',
      {
        exact: true,
      }
    )
  ).toBeVisible();


  // ==========================================================
  // 12. Wait for the ACTUAL Home screen
  // ==========================================================

  await expect(
    page.getByText(
      'Tracking Wellness with Ease',
      {
        exact: true,
      }
    )
  ).toBeVisible({
    timeout: 20000,
  });


  // ==========================================================
  // 13. Consent must NOT be displayed
  // ==========================================================

  await expect(
    page.getByRole('heading', {
      name: 'User Consent Form',
    })
  ).not.toBeVisible();


  // ==========================================================
  // 14. Complete Profile must NOT be displayed
  // ==========================================================

  await expect(
    page.getByRole('heading', {
      name: 'Complete Your Profile',
    })
  ).not.toBeVisible();


  // ==========================================================
  // 15. Verify Home navigation
  // ==========================================================

  await expect(
    page.getByText('Home', {
      exact: true,
    })
  ).toBeVisible();

  await expect(
    page.getByText('Diary', {
      exact: true,
    })
  ).toBeVisible();

  await expect(
    page.getByText('Activity', {
      exact: true,
    })
  ).toBeVisible();

  await expect(
    page.getByText('Programs', {
      exact: true,
    })
  ).toBeVisible();


  // ==========================================================
  // 16. Verify Home actions
  // ==========================================================

  await expect(
    page.getByRole('button', {
      name: 'Open camera',
    })
  ).toBeVisible();

  await expect(
    page.getByRole('button', {
      name: 'Choose from gallery',
    })
  ).toBeVisible();

});

// ============================================================
// AUTH-022
// New user -> Disagree -> Login
// ============================================================

test('AUTH-022 new user is returned to login after disagreeing with consent', async ({ page }) => {

  // ----------------------------------------------------------
  // New user must have consent pending.
  // ----------------------------------------------------------

  await page.route(
    '**/api/user/consent*',
    async route => {

      const method = route.request().method();

      // Initial consent-status check
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            consentRequired: true,
            consentAccepted: false,
          }),
        });

        return;
      }

      // IMPORTANT:
      // Do not mock DELETE.
      //
      // The test should detect if the application stops making
      // the discard request in the future.
      //
      await route.continue();
    }
  );

  // ----------------------------------------------------------
  // Login as new user.
  // ----------------------------------------------------------

  await completeOtpLogin(page, {
    isNewUser: true,
    consentRequired: true,
    userId: 999999,
    email: '',
  });

  // ----------------------------------------------------------
  // Consent form
  // ----------------------------------------------------------

  await expect(
    page.getByRole('heading', {
      name: 'User Consent Form',
    })
  ).toBeVisible();

  // ----------------------------------------------------------
  // Select "I Don't Agree"
  // ----------------------------------------------------------

  await page.getByText(
    "I Don't Agree",
    {
      exact: true,
    }
  ).last().click();

  // ----------------------------------------------------------
  // Continue should now be enabled.
  // ----------------------------------------------------------

  const continueButton =
    page.getByRole('button', {
      name: 'Continue',
    });

  await expect(
    continueButton
  ).toBeEnabled();

  // ----------------------------------------------------------
  // Wait for the REAL DELETE request.
  //
  // We are not mocking the DELETE.
  // ----------------------------------------------------------

  const deleteConsentRequest =
    page.waitForRequest(request =>
      request.url().includes('/api/user/consent') &&
      request.method() === 'DELETE'
    );

  await continueButton.click();

  await deleteConsentRequest;

  // ----------------------------------------------------------
  // Consent form must disappear.
  // ----------------------------------------------------------

  await expect(
    page.getByRole('heading', {
      name: 'User Consent Form',
    })
  ).not.toBeVisible();

  // ----------------------------------------------------------
  // Login page should return.
  // ----------------------------------------------------------

  await expect(
    page.getByLabel('Mobile Number')
  ).toBeVisible();

  await expect(
    page.getByRole('button', {
      name: 'Send OTP',
    })
  ).toBeVisible();

  // ----------------------------------------------------------
  // OTP screen should be gone.
  // ----------------------------------------------------------

  await expect(
    page.getByText('Enter OTP', {
      exact: true,
    })
  ).not.toBeVisible();
});


// ============================================================
// AUTH-023
// New user -> Agree -> Complete Profile
// ============================================================

test('AUTH-023 new user agrees to consent and is shown complete profile page', async ({ page }) => {

  // ==========================================================
  // 1. Verify OTP as NEW PHONE USER
  //
  // IMPORTANT:
  // email is intentionally EMPTY.
  //
  // Your actual application uses this state to open the
  // Complete Your Profile page for a phone-only new user.
  // ==========================================================

  await page.route('**/api/auth/verify-otp', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        isNewUser: true,

        user: {
          id: 999999,
          UserId: 999999,

          username: 'newuser',

          email: '',

          phone: '+917695834209',

          status: 'Active',

          consentRequired: true,
        },
      }),
    });
  });


  // ==========================================================
  // 2. New user is active
  // ==========================================================

  await page.route('**/api/user/lookup', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        isNewUser: true,
        isActive: true,
        role: 'user',
      }),
    });
  });


  // ==========================================================
  // 3. Consent is required
  // ==========================================================

  await page.route('**/api/user/consent*', async route => {

    const method =
      route.request().method();


    // --------------------------------------------------------
    // Initial consent check
    // --------------------------------------------------------

    if (method === 'GET') {

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          consentRequired: true,
          consentAccepted: false,
        }),
      });

      return;
    }


    // --------------------------------------------------------
    // Accept consent
    // --------------------------------------------------------

    if (method === 'POST') {

      const body =
        route.request().postDataJSON();

      // Verify the application really sends consentAccepted=true
      expect(body).toMatchObject({
        consentAccepted: true,
      });

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          consentAccepted: true,
        }),
      });

      return;
    }


    await route.continue();
  });


  // ==========================================================
  // 4. Open login
  // ==========================================================

  await page.goto('/');


  // ==========================================================
  // 5. Enter mobile number
  // ==========================================================

  await page
    .getByLabel('Mobile Number')
    .fill('7695834209');


  // ==========================================================
  // 6. Send OTP
  // ==========================================================

  await page
    .getByRole('button', {
      name: 'Send OTP',
    })
    .click();


  // ==========================================================
  // 7. OTP screen
  // ==========================================================

  const otpInputs =
    page.locator('input[type="tel"]');

  await expect(
    otpInputs
  ).toHaveCount(6);


  // ==========================================================
  // 8. Enter OTP
  // ==========================================================

  const otp = '123456';

  for (let i = 0; i < otp.length; i++) {
    await otpInputs
      .nth(i)
      .fill(otp[i]);
  }


  // ==========================================================
  // 9. OTP successfully verified
  // ==========================================================

  await expect(
    page.getByText(
      'OTP verified successfully!',
      {
        exact: true,
      }
    )
  ).toBeVisible();


  // ==========================================================
  // 10. Consent Form should appear
  // ==========================================================

  await expect(
    page.getByRole('heading', {
      name: 'User Consent Form',
    })
  ).toBeVisible({
    timeout: 15000,
  });


  // ==========================================================
  // 11. Verify consent choices
  // ==========================================================

  await expect(
    page.getByText(
      'I Agree',
      {
        exact: true,
      }
    ).last()
  ).toBeVisible();

  await expect(
    page.getByText(
      "I Don't Agree",
      {
        exact: true,
      }
    ).last()
  ).toBeVisible();


  // ==========================================================
  // 12. Select I Agree
  // ==========================================================

  await page.getByText(
    'I Agree',
    {
      exact: true,
    }
  ).last().click();


  // ==========================================================
  // 13. Continue
  // ==========================================================

  const continueButton =
    page.getByRole('button', {
      name: 'Continue',
    });

  await expect(
    continueButton
  ).toBeEnabled();

  await continueButton.click();


  // ==========================================================
  // 14. Consent form disappears
  // ==========================================================

  await expect(
    page.getByRole('heading', {
      name: 'User Consent Form',
    })
  ).not.toBeVisible({
    timeout: 10000,
  });


  // ==========================================================
  // 15. Complete Profile must appear
  //
  // This is now driven by the application's actual
  // phone-only new-user logic.
  // ==========================================================

  await expect(
    page.getByRole('heading', {
      name: 'Complete Your Profile',
    })
  ).toBeVisible({
    timeout: 15000,
  });


  // ==========================================================
  // 16. Verify Complete Profile content
  // ==========================================================

  await expect(
    page.getByText(
      'Name, email, gender, height, diet preference, and photo — all in one place.',
      {
        exact: true,
      }
    )
  ).toBeVisible();



});

});

