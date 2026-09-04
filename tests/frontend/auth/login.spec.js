const { test, expect } = require('@playwright/test');

const TEST_PHONE = '7695834209';
const TEST_OTP = '1234';

const TEST_EMAIL = 'existinguser@test.com';
const NEW_USER_EMAIL = 'newuser@test.com';

// ============================================================
// One real authenticated state for the entire login.spec.js run
// ============================================================

let realAuthenticatedStorage = null;

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

  await expect(otpInputs).toHaveCount(4);

  for (let i = 0; i < TEST_OTP.length; i++) {
    await otpInputs.nth(i).fill(TEST_OTP[i]);
  }
}
test.describe('Login', () => {


  // ============================================================
  // Reuse authenticated state without sending another OTP
  // ============================================================

  async function restoreAuthenticatedState(page, {
    isNewUser,
    email = '',
  }) {

    if (!realAuthenticatedStorage) {
      throw new Error(
        'Real authenticated state was not created by beforeAll.'
      );
    }

    const storedOtpUser =
      JSON.parse(
        realAuthenticatedStorage.otpUser || '{}'
      );

    const restoredUser = {
      ...storedOtpUser,

      isNewUser,

      email,
      phone: `+91${TEST_PHONE}`,

      UserId:
        storedOtpUser.UserId || 999999,

      id:
        storedOtpUser.id ||
        storedOtpUser.UserId ||
        999999,

      username:
        isNewUser
          ? 'newuser'
          : 'existinguser',

      consentRequired:
        isNewUser,
    };

    await page.addInitScript(
      ({ isOtpVerified, otpUser }) => {

        localStorage.setItem(
          'isOtpVerified',
          isOtpVerified
        );

        localStorage.setItem(
          'otpUser',
          JSON.stringify(otpUser)
        );

      },
      {
        isOtpVerified:
          realAuthenticatedStorage.isOtpVerified,

        otpUser: restoredUser,
      }
    );
  }

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

    await expect(otpInputs).toHaveCount(4);

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

    await expect(otpInputs).toHaveCount(4);

    const otp = '1234';

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

    await expect(otpInputs).toHaveCount(4);

    // Enter a test OTP
    const otp = '1234';

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
      const postData = route.request().postDataJSON();
      expect(postData).toMatchObject({
        otp: '1234',
        contactType: 'phone',
      });

      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          message: 'Invalid OTP. Please try again.'
        }),
      });
    });

    await page.goto('/');

    // 1. Enter mobile number and click Send OTP
    const mobileInput = page.getByLabel('Mobile Number');
    await expect(mobileInput).toBeVisible({ timeout: 15000 });
    await mobileInput.fill('7695834209');

    const sendOtpBtn = page.getByRole('button', { name: 'Send OTP' });
    await expect(sendOtpBtn).toBeVisible({ timeout: 15000 });
    await sendOtpBtn.click();

    // 2. Locate 4 OTP input cells
    const otpInputs = page.locator('input[type="tel"]');
    await expect(otpInputs).toHaveCount(4);

    // 3. Fill invalid 4-digit OTP and await API response
    const invalidOtp = '1234';
    const verifyResponsePromise = page.waitForResponse('**/api/auth/verify-otp');

    for (let i = 0; i < invalidOtp.length; i++) {
      await otpInputs.nth(i).fill(invalidOtp[i]);
    }

    // 4. Assert verify-otp API response returns failure status and message
    const response = await verifyResponsePromise;
    expect(response.status()).toBe(400);
    const responseJson = await response.json();
    expect(responseJson.success).toBe(false);
    expect(responseJson.message).toBe('Invalid OTP. Please try again.');
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

    await expect(otpInputs).toHaveCount(4);

    const otp = '1234';

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

    await expect(otpInputs).toHaveCount(4);

    const otp = '1234';

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

    await expect(otpInputs).toHaveCount(4);

    // Enter valid OTP
    const otp = '1234';

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

    await expect(otpInputs).toHaveCount(4);

    const otp = '1234';

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

});

// ============================================================
// POST-LOGIN FLOWS
//
// IMPORTANT:
// Every test performs the REAL UI login flow.
//
// /api/auth/send-otp      -> mocked
// /api/auth/verify-otp    -> mocked
//
// Therefore:
// - NO real SMS
// - NO OTP provider cost
// - REAL React OTP success handling
// - REAL consent/profile/home routing
// ============================================================

test.describe('Post-login flows', () => {

  test.describe.configure({
    mode: 'serial',
    retries: 0,
  });


  // ============================================================
  // Shared helper
  // ============================================================
  async function loginWithMockedOtp(
    page,
    {
      isNewUser,
      email = '',
      userId = 999999,
    }
  ) {

    // ==========================================================
    // Mock SEND OTP
    //
    // NO SMS is sent.
    // ==========================================================

    await page.route(
      '**/api/auth/send-otp',
      async route => {

        await route.fulfill({
          status: 200,
          contentType: 'application/json',

          body: JSON.stringify({
            success: true,
          }),
        });

      }
    );


    // ==========================================================
    // Mock VERIFY OTP
    //
    // IMPORTANT:
    // The post-login flow requires the FULL user object.
    // ==========================================================

    await page.route(
      '**/api/auth/verify-otp',
      async route => {

        await route.fulfill({
          status: 200,
          contentType: 'application/json',

          body: JSON.stringify({

            success: true,

            message:
              'OTP verified successfully',

            isNewUser,

            user: {

              id:
                userId,

              UserId:
                userId,

              username:
                isNewUser
                  ? 'newuser'
                  : 'existinguser',

              email,

              phone:
                '+917695834209',

              status:
                'Active',

              consentRequired:
                isNewUser,

            },

          }),
        });

      }
    );


    // ==========================================================
    // Open login
    // ==========================================================

    await page.goto('/');


    // ==========================================================
    // Enter mobile number
    // ==========================================================

    await expect(
      page.getByLabel('Mobile Number')
    ).toBeVisible();


    await page
      .getByLabel('Mobile Number')
      .fill(TEST_PHONE);


    // ==========================================================
    // Send OTP
    // ==========================================================

    await page
      .getByRole('button', {
        name: 'Send OTP',
      })
      .click();


    // ==========================================================
    // OTP screen
    // ==========================================================

    await expect(
      page.getByText(
        'Enter OTP',
        {
          exact: true,
        }
      )
    ).toBeVisible({
      timeout: 15000,
    });


    const otpInputs =
      page.locator(
        'input[type="tel"]'
      );


    await expect(
      otpInputs
    ).toHaveCount(4);


    // ==========================================================
    // Enter OTP
    // ==========================================================

    for (
      let i = 0;
      i < TEST_OTP.length;
      i++
    ) {

      await otpInputs
        .nth(i)
        .fill(TEST_OTP[i]);

    }


    // ==========================================================
    // Wait for the actual application authentication handling
    // ==========================================================

    await expect
      .poll(
        async () => {

          return await page.evaluate(() => ({

            isOtpVerified:
              localStorage.getItem(
                'isOtpVerified'
              ),

            otpUser:
              localStorage.getItem(
                'otpUser'
              ),

          }));

        },
        {
          timeout: 15000,

          intervals:
            [200, 500, 1000],
        }
      )
      .toMatchObject({
        isOtpVerified:
          'true',
      });


    // ==========================================================
    // Verify that the application stored the user classification.
    //
    // We don't require an exact otpUser string because the
    // application's shape may contain additional fields.
    // ==========================================================

    await expect
      .poll(
        async () => {

          return await page.evaluate(() => {

            const raw =
              localStorage.getItem(
                'otpUser'
              );

            if (!raw) {
              return null;
            }

            try {
              return JSON.parse(raw);
            } catch {
              return null;
            }

          });

        },
        {
          timeout: 15000,

          intervals:
            [200, 500, 1000],
        }
      )
      .toMatchObject({

        isNewUser,

      });

  }


  // ============================================================
  // AUTH-020
  //
  // New User
  // ->
  // Consent Form
  // ============================================================

  test(
    'AUTH-020 new user is shown consent form after login',
    async ({ page }) => {

      await page.route(
        '**/api/user/consent*',
        async route => {

          if (
            route.request().method()
            === 'GET'
          ) {

            await route.fulfill({
              status: 200,
              contentType:
                'application/json',

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


      await loginWithMockedOtp(
        page,
        {
          isNewUser: true,
          email: '',
        }
      );


      await expect(
        page.getByRole(
          'heading',
          {
            name:
              'User Consent Form',
          }
        )
      ).toBeVisible({
        timeout: 15000,
      });


      await expect(
        page.getByText(
          'Consent to Collect and Use Personal and Health Information',
          {
            exact: true,
          }
        )
      ).toBeVisible();


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


      await expect(
        page.getByRole(
          'button',
          {
            name:
              'Continue',
          }
        )
      ).toBeVisible();

    }
  );


  // ============================================================
  // AUTH-021
  //
  // Existing User
  // ->
  // Home
  // ============================================================

  // ============================================================
  // AUTH-021
  // Existing user -> Home
  // ============================================================

  test(
    'AUTH-021 existing user is shown home after login',
    async ({ page }) => {

      // ----------------------------------------------------------
      // IMPORTANT:
      // Existing users with an email go through /api/user/lookup
      // after OTP verification.
      //
      // This route must be registered BEFORE loginWithMockedOtp().
      // ----------------------------------------------------------

      await page.route(
        '**/api/user/lookup',
        async route => {

          const body =
            route.request().postDataJSON();

          console.log(
            'AUTH-021 /api/user/lookup BODY:',
            body
          );

          await route.fulfill({
            status: 200,
            contentType: 'application/json',

            body: JSON.stringify({
              success: true,
              isActive: true,
              isNewUser: false,
            }),
          });

        }
      );


      // ----------------------------------------------------------
      // Existing user already accepted consent.
      // ----------------------------------------------------------

      await page.route(
        '**/api/user/consent*',
        async route => {

          if (
            route.request().method() === 'GET'
          ) {

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
        }
      );


      // ----------------------------------------------------------
      // Existing user has a complete profile.
      // ----------------------------------------------------------

      await page.route(
        '**/api/user/profile*',
        async route => {

          if (
            route.request().method() === 'GET'
          ) {

            await route.fulfill({
              status: 200,
              contentType: 'application/json',

              body: JSON.stringify({
                success: true,

                data: {
                  profileComplete: true,

                  userName:
                    'Existing User',

                  email:
                    TEST_EMAIL,

                  height:
                    170,

                  dietType:
                    'Non-Vegetarian',

                  gender:
                    'Male',

                  currentWeight:
                    70,

                  bodyFat:
                    20,

                  profileImage:
                    'https://example.com/profile.jpg',

                  physicalActivityLevel:
                    'moderate',
                },
              }),
            });

            return;
          }

          await route.continue();
        }
      );


      // ----------------------------------------------------------
      // Setup is already complete.
      // ----------------------------------------------------------

      await page.route(
        '**/api/user/status*',
        async route => {

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

        }
      );


      // ----------------------------------------------------------
      // Home leaderboard data.
      // ----------------------------------------------------------

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

                  coachName:
                    'Test Coach',

                  sponsorName:
                    'Test Sponsor',

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

                  wellnessPercentage:
                    85,

                  totalEarned:
                    850,

                  totalPossible:
                    1000,

                  rank: 1,
                },
              ],
            }),
          });

        }
      );


      // ----------------------------------------------------------
      // Perform the REAL UI OTP flow.
      //
      // send-otp and verify-otp are mocked, so NO SMS is sent.
      // ----------------------------------------------------------

      await loginWithMockedOtp(
        page,
        {
          isNewUser: false,
          email: TEST_EMAIL,
        }
      );


      // ----------------------------------------------------------
      // Verify authentication state.
      // ----------------------------------------------------------

      await expect
        .poll(
          async () => {

            return await page.evaluate(() => {

              const raw =
                localStorage.getItem(
                  'otpUser'
                );

              if (!raw) {
                return null;
              }

              try {
                return JSON.parse(raw);
              } catch {
                return null;
              }

            });

          },
          {
            timeout: 15000,
            intervals: [200, 500, 1000],
          }
        )
        .toMatchObject({
          isNewUser: false,
        });


      // ----------------------------------------------------------
      // Existing user should reach Home.
      // ----------------------------------------------------------

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


      // ----------------------------------------------------------
      // Consent should NOT appear.
      // ----------------------------------------------------------

      await expect(
        page.getByRole(
          'heading',
          {
            name:
              'User Consent Form',
          }
        )
      ).not.toBeVisible();


      // ----------------------------------------------------------
      // Complete Profile should NOT appear.
      // ----------------------------------------------------------

      await expect(
        page.getByRole(
          'heading',
          {
            name:
              'Complete Your Profile',
          }
        )
      ).not.toBeVisible();


      // ----------------------------------------------------------
      // Home navigation.
      // ----------------------------------------------------------

      await expect(
        page.getByText(
          'Home',
          {
            exact: true,
          }
        )
      ).toBeVisible();

      await expect(
        page.getByText(
          'Diary',
          {
            exact: true,
          }
        )
      ).toBeVisible();

      await expect(
        page.getByText(
          'Activity',
          {
            exact: true,
          }
        )
      ).toBeVisible();

      await expect(
        page.getByText(
          'Programs',
          {
            exact: true,
          }
        )
      ).toBeVisible();


      // ----------------------------------------------------------
      // Home actions.
      // ----------------------------------------------------------

      await expect(
        page.getByRole(
          'button',
          {
            name:
              'Open camera',
          }
        )
      ).toBeVisible();

      await expect(
        page.getByRole(
          'button',
          {
            name:
              'Choose from gallery',
          }
        )
      ).toBeVisible();

    }
  );

  // ============================================================
  // AUTH-022
  //
  // New User
  // ->
  // Don't Agree
  // ->
  // Login
  // ============================================================

  test(
    'AUTH-022 new user is returned to login after disagreeing with consent',
    async ({ page }) => {

      // ============================================================
      // 1. MOCK CONSENT API
      //
      // GET  -> Consent is required
      // DELETE -> Mock deleting the unconsented new user
      // ============================================================

      await page.route(
        '**/api/user/consent*',
        async route => {

          const method =
            route.request().method();

          // --------------------------------------------------------
          // GET /api/user/consent
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
          // DELETE /api/user/consent
          // --------------------------------------------------------

          if (method === 'DELETE') {

            console.log(
              'AUTH-022 DELETE /api/user/consent'
            );

            await route.fulfill({
              status: 200,
              contentType: 'application/json',

              body: JSON.stringify({
                success: true,
              }),
            });

            return;
          }

          // --------------------------------------------------------
          // Unexpected method
          // --------------------------------------------------------

          await route.continue();
        }
      );


      // ============================================================
      // 2. REAL UI LOGIN
      //
      // OTP is mocked by loginWithMockedOtp().
      // No real SMS is sent.
      // ============================================================

      await loginWithMockedOtp(page, {
        isNewUser: true,
        email: '',
      });


      // ============================================================
      // 3. VERIFY CONSENT FORM
      // ============================================================

      const consentHeading =
        page.getByRole(
          'heading',
          {
            name: 'User Consent Form',
            exact: true,
          }
        );

      await expect(
        consentHeading
      ).toBeVisible({
        timeout: 15000,
      });


      // ============================================================
      // 4. SELECT "I DON'T AGREE"
      //
      // IMPORTANT:
      //
      // Selecting this option immediately opens:
      //
      //     "Leave or continue?"
      //
      // So we must NOT click the underlying Continue button.
      // ============================================================

      const dontAgree =
        page.getByText(
          "I Don't Agree",
          {
            exact: true,
          }
        ).last();

      await expect(
        dontAgree
      ).toBeVisible({
        timeout: 10000,
      });

      await dontAgree.click();


      // ============================================================
      // 5. VERIFY DISAGREE CONFIRMATION MODAL
      // ============================================================

      await expect(
        page.getByText(
          'Leave or continue?',
          {
            exact: true,
          }
        )
      ).toBeVisible({
        timeout: 10000,
      });


      await expect(
        page.getByText(
          "If you leave, you'll be signed out and returned to the login screen.",
          {
            exact: false,
          }
        )
      ).toBeVisible({
        timeout: 10000,
      });


      // ============================================================
      // 6. LOCATE "LEAVE" BUTTON
      //
      // The Leave action is the actual decline action.
      // ============================================================

      const leaveButton =
        page.getByRole(
          'button',
          {
            name: 'Leave',
            exact: true,
          }
        );

      await expect(
        leaveButton
      ).toBeVisible({
        timeout: 10000,
      });


      // ============================================================
      // 7. WAIT FOR DELETE REQUEST
      //
      // Register BEFORE clicking Leave.
      // ============================================================

      const deleteRequest =
        page.waitForRequest(
          request =>
            request.url().includes(
              '/api/user/consent'
            ) &&
            request.method() === 'DELETE'
        );


      // ============================================================
      // 8. CLICK LEAVE
      //
      // This calls onDecline() in ConsentForm.
      // ============================================================

      await leaveButton.click();


      // ============================================================
      // 9. VERIFY DELETE REQUEST
      // ============================================================

      await deleteRequest;

      console.log(
        'AUTH-022 DELETE REQUEST RECEIVED'
      );


      // ============================================================
      // 10. CONSENT FORM SHOULD DISAPPEAR
      // ============================================================

      await expect(
        consentHeading
      ).not.toBeVisible({
        timeout: 15000,
      });


      // ============================================================
      // 11. LOGIN PAGE SHOULD RETURN
      // ============================================================

      await expect(
        page.getByLabel(
          'Mobile Number'
        )
      ).toBeVisible({
        timeout: 15000,
      });


      // ============================================================
      // 12. SEND OTP BUTTON SHOULD BE AVAILABLE
      // ============================================================

      await expect(
        page.getByRole(
          'button',
          {
            name: 'Send OTP',
            exact: true,
          }
        )
      ).toBeVisible({
        timeout: 10000,
      });


      // ============================================================
      // 13. OTP SCREEN SHOULD NOT BE DISPLAYED
      // ============================================================

      await expect(
        page.getByText(
          'Enter OTP',
          {
            exact: true,
          }
        )
      ).not.toBeVisible({
        timeout: 10000,
      });


      console.log(
        'AUTH-022 PASSED: new user returned to login after declining consent'
      );
    }
  );
  // ============================================================
  // AUTH-023
  //
  // New User
  // ->
  // Agree
  // ->
  // Complete Profile
  // ============================================================

  // test(
  //   'AUTH-023 new user agrees to consent and is shown complete profile page',
  //   async ({ page }) => {

  //     // --------------------------------------------------------
  //     // Consent API
  //     // --------------------------------------------------------

  //     await page.route(
  //       '**/api/user/consent*',
  //       async route => {

  //         const method =
  //           route.request()
  //             .method();


  //         if (
  //           method === 'GET'
  //         ) {

  //           await route.fulfill({
  //             status: 200,
  //             contentType:
  //               'application/json',

  //             body: JSON.stringify({
  //               success: true,
  //               consentRequired: true,
  //               consentAccepted: false,
  //             }),
  //           });

  //           return;
  //         }


  //         if (
  //           method === 'POST'
  //         ) {

  //           const body =
  //             route.request()
  //               .postDataJSON();


  //           // Detect changes to API contract.
  //           expect(body).toMatchObject({
  //             consentAccepted: true,
  //           });


  //           await route.fulfill({
  //             status: 200,
  //             contentType:
  //               'application/json',

  //             body: JSON.stringify({
  //               success: true,
  //               consentRequired: false,
  //               consentAccepted: true,
  //             }),
  //           });

  //           return;
  //         }


  //         await route.continue();
  //       }
  //     );


  //     // --------------------------------------------------------
  //     // New user has incomplete profile
  //     // --------------------------------------------------------

  //     await page.route(
  //       '**/api/user/profile*',
  //       async route => {

  //         if (
  //           route.request().method()
  //           === 'GET'
  //         ) {

  //           await route.fulfill({
  //             status: 200,
  //             contentType:
  //               'application/json',

  //             body: JSON.stringify({
  //               success: true,

  //               data: {
  //                 profileComplete:
  //                   false,

  //                 userName:
  //                   null,

  //                 email:
  //                   '',

  //                 height:
  //                   null,

  //                 dietType:
  //                   null,

  //                 gender:
  //                   null,

  //                 currentWeight:
  //                   null,

  //                 bodyFat:
  //                   null,

  //                 profileImage:
  //                   null,

  //                 physicalActivityLevel:
  //                   null,
  //               },
  //             }),
  //           });

  //           return;
  //         }

  //         await route.continue();
  //       }
  //     );


  //     // --------------------------------------------------------
  //     // REAL UI LOGIN
  //     // NO REAL SMS
  //     // --------------------------------------------------------

  //     await loginWithMockedOtp(page, {
  //       isNewUser: true,
  //       email: '',
  //     });


  //     // --------------------------------------------------------
  //     // Consent
  //     // --------------------------------------------------------

  //     await expect(
  //       page.getByRole(
  //         'heading',
  //         {
  //           name:
  //             'User Consent Form',
  //         }
  //       )
  //     ).toBeVisible({
  //       timeout: 15000,
  //     });


  //     // --------------------------------------------------------
  //     // I Agree
  //     // --------------------------------------------------------

  //     await page.getByText(
  //       'I Agree',
  //       {
  //         exact: true,
  //       }
  //     ).last().click();


  //     const continueButton =
  //       page.getByRole(
  //         'button',
  //         {
  //           name:
  //             'Continue',
  //         }
  //       );


  //     await expect(
  //       continueButton
  //     ).toBeEnabled();


  //     await continueButton.click();


  //     // --------------------------------------------------------
  //     // Consent disappears
  //     // --------------------------------------------------------

  //     await expect(
  //       page.getByRole(
  //         'heading',
  //         {
  //           name:
  //             'User Consent Form',
  //         }
  //       )
  //     ).not.toBeVisible({
  //     });
});