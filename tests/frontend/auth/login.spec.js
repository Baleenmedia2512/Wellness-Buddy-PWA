const { test, expect } = require('@playwright/test');

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

test('AUTH-020 new user is shown consent form after login', async ({ page }) => {

  // --------------------------------------------------
  // 1. Mock Send OTP
  // --------------------------------------------------

  await page.route('**/api/auth/send-otp', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
      }),
    });
  });


  // --------------------------------------------------
  // 2. Mock Verify OTP
  // --------------------------------------------------

  await page.route('**/api/auth/verify-otp', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({

        success: true,

        message: 'OTP verified successfully',

        isNewUser: true,

        user: {
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


  // --------------------------------------------------
  // 3. Open Login
  // --------------------------------------------------

  await page.goto('/');


  // --------------------------------------------------
  // 4. Enter mobile number
  // --------------------------------------------------

  await page
    .getByLabel('Mobile Number')
    .fill('7695834209');


  // --------------------------------------------------
  // 5. Request OTP
  // --------------------------------------------------

  await page
    .getByRole('button', {
      name: 'Send OTP',
    })
    .click();


  // --------------------------------------------------
  // 6. Verify OTP screen
  // --------------------------------------------------

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


  // --------------------------------------------------
  // 7. Enter OTP
  // --------------------------------------------------

  const otp = '123456';

  for (let i = 0; i < otp.length; i++) {

    await otpInputs
      .nth(i)
      .fill(otp[i]);

  }


// Consent Form is displayed
await expect(
  page.getByRole('heading', {
    name: 'User Consent Form',
  })
).toBeVisible();

// Consent information is displayed
await expect(
  page.getByText(
    'Consent to Collect and Use Personal and Health Information',
    { exact: true }
  )
).toBeVisible();

// I Agree is displayed
await expect(
  page.getByText('I Agree', {
    exact: true,
  }).last()
).toBeVisible();

// I Don't Agree is displayed
await expect(
  page.getByText("I Don't Agree", {
    exact: true,
  }).last()
).toBeVisible();

// Continue is displayed
await expect(
  page.getByRole('button', {
    name: 'Continue',
  })
).toBeVisible();
});

test('AUTH-021 existing user is shown home after login', async ({ page }) => {

  // ==================================================
  // 1. Mock Send OTP
  // ==================================================

  await page.route('**/api/auth/send-otp', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
      }),
    });
  });


  // ==================================================
  // 2. Mock Verify OTP - EXISTING USER
  // ==================================================

  await page.route('**/api/auth/verify-otp', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        message: 'OTP verified successfully',
        isNewUser: false,

        user: {
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


  // ==================================================
  // 3. IMPORTANT:
  // Mock the profile API
  //
  // This prevents Complete Your Profile from appearing.
  // ==================================================

  await page.route(
    '**/api/user/profile?email=*',
    async route => {

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

            height: 170,

            dietType: 'Non-Vegetarian',

            gender: 'Male',

            latestWeight: 70,

            latestWeightBodyFat: 20,

            bodyFat: 20,

            physicalActivityLevel: 'moderate',

            profileImage:
              'https://example.com/profile.jpg',

            profileComplete: true,

            needsName: false,

            needsCurrentWeight: false,

            needsBodyFat: false,

            profilePicSnooze: null,

            consentRequired: false,

            consentAccepted: true,
          },
        }),
      });
    }
  );


  // ==================================================
  // 4. Mock setup status
  //
  // Otherwise the application may open the
  // Coach Setup wizard after profile completion.
  // ==================================================

  await page.route(
    '**/api/user/status?email=*',
    async route => {

      await route.fulfill({
        status: 200,
        contentType: 'application/json',

        body: JSON.stringify({
          setupSkipped: true,
          setupComplete: true,
          pendingRequest: false,
        }),
      });
    }
  );


  // ==================================================
  // 5. Open Login
  // ==================================================

  await page.goto('/');


  // ==================================================
  // 6. Enter mobile number
  // ==================================================

  const mobileInput =
    page.getByLabel('Mobile Number');

  await mobileInput.fill('7695834209');

  await expect(mobileInput)
    .toHaveValue('7695834209');


  // ==================================================
  // 7. Send OTP
  // ==================================================

  const sendOtpButton =
    page.getByRole('button', {
      name: 'Send OTP',
    });

  await expect(sendOtpButton)
    .toBeEnabled();

  await sendOtpButton.click();


  // ==================================================
  // 8. Verify OTP screen
  // ==================================================

  await expect(
    page.getByText('Enter OTP', {
      exact: true,
    })
  ).toBeVisible();


  const otpInputs =
    page.locator('input[type="tel"]');

  await expect(otpInputs)
    .toHaveCount(6);


  // ==================================================
  // 9. Enter OTP
  // ==================================================

  const otp = '123456';

  for (let i = 0; i < otp.length; i++) {

    await otpInputs
      .nth(i)
      .fill(otp[i]);

  }


  // ==================================================
  // 10. Wait for authentication
  // ==================================================

  await expect
    .poll(async () => {

      return await page.evaluate(() =>
        localStorage.getItem(
          'isOtpVerified'
        )
      );

    })
    .toBe('true');


  // ==================================================
  // 11. Verify existing user
  // ==================================================

  await expect
    .poll(async () => {

      return await page.evaluate(() => {

        const raw =
          localStorage.getItem(
            'otpUser'
          );

        if (!raw) {
          return null;
        }

        return JSON.parse(raw)
          .isNewUser;

      });

    })
    .toBe(false);


  // ==================================================
  // 12. Consent must NOT appear
  // ==================================================

  await expect(
    page.getByRole('heading', {
      name: 'User Consent Form',
    })
  ).not.toBeVisible();


  // ==================================================
  // 13. Complete Profile must NOT appear
  // ==================================================

  await expect(
    page.getByText(
      'Complete Your Profile',
      {
        exact: true,
      }
    )
  ).not.toBeVisible();


  // ==================================================
  // 14. Verify Home header
  // ==================================================

  await expect(
    page.getByText(
      'Wellness Valley',
      {
        exact: true,
      }
    )
  ).toBeVisible();


  await expect(
    page.getByText(
      'Tracking Wellness with Ease',
      {
        exact: true,
      }
    )
  ).toBeVisible();


  // ==================================================
  // 15. Verify Home navigation
  // ==================================================

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


  await expect(
    page.getByText(
      'BCM',
      {
        exact: true,
      }
    )
  ).toBeVisible();


  await expect(
    page.getByText(
      'Club',
      {
        exact: true,
      }
    )
  ).toBeVisible();


  await expect(
    page.getByText(
      'Transformation',
      {
        exact: true,
      }
    )
  ).toBeVisible();


  // ==================================================
  // 16. Verify Take Photo
  // ==================================================

  await expect(
    page.getByRole('button', {
      name: 'Open camera',
    })
  ).toBeVisible();


  // ==================================================
  // 17. Verify Gallery
  // ==================================================

  await expect(
    page.getByRole('button', {
      name: 'Choose from gallery',
    })
  ).toBeVisible();


  // ==================================================
  // 18. Login button should no longer exist
  // ==================================================

  await expect(
    page.getByRole('button', {
      name: 'Send OTP',
    })
  ).not.toBeVisible();

});

test('AUTH-022 new user is returned to login after disagreeing with consent', async ({ page }) => {

  // ==================================================
  // 1. Mock Send OTP
  // ==================================================

  await page.route('**/api/auth/send-otp', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
      }),
    });
  });


  // ==================================================
  // 2. Mock Verify OTP - NEW USER
  // ==================================================

  await page.route('**/api/auth/verify-otp', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        message: 'OTP verified successfully',

        isNewUser: true,

        user: {
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


  // ==================================================
  // 3. Open Login page
  // ==================================================

  await page.goto('/');


  // ==================================================
  // 4. Enter mobile number
  // ==================================================

  await page
    .getByLabel('Mobile Number')
    .fill('7695834209');


  // ==================================================
  // 5. Send OTP
  // ==================================================

  await page
    .getByRole('button', {
      name: 'Send OTP',
    })
    .click();


  // ==================================================
  // 6. Verify OTP screen
  // ==================================================

  await expect(
    page.getByText('Enter OTP', {
      exact: true,
    })
  ).toBeVisible();


  const otpInputs =
    page.locator('input[type="tel"]');


  await expect(
    otpInputs
  ).toHaveCount(6);


  // ==================================================
  // 7. Enter OTP
  // ==================================================

  const otp = '123456';

  for (let i = 0; i < otp.length; i++) {
    await otpInputs
      .nth(i)
      .fill(otp[i]);
  }


  // ==================================================
  // 8. Verify Consent Form
  // ==================================================

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


  // ==================================================
  // 9. Verify "I Don't Agree" option
  // ==================================================

  const disagreeOption =
    page.getByText("I Don't Agree", {
      exact: true,
    }).last();

  await expect(
    disagreeOption
  ).toBeVisible();


  // ==================================================
  // 10. Select "I Don't Agree"
  // ==================================================

  await disagreeOption.click();


  // ==================================================
  // 11. Continue
  // ==================================================

  const continueButton =
    page.getByRole('button', {
      name: 'Continue',
    });

  await expect(
    continueButton
  ).toBeVisible();

  await expect(
    continueButton
  ).toBeEnabled();

  await continueButton.click();


  // ==================================================
  // 12. Consent Form should disappear
  // ==================================================

  await expect(
    page.getByRole('heading', {
      name: 'User Consent Form',
    })
  ).not.toBeVisible();


  // ==================================================
  // 13. User should return to Login page
  // ==================================================

  await expect(
    page.getByLabel('Mobile Number')
  ).toBeVisible();


  // ==================================================
  // 14. Send OTP button should be visible again
  // ==================================================

  await expect(
    page.getByRole('button', {
      name: 'Send OTP',
    })
  ).toBeVisible();


  // ==================================================
  // 15. OTP screen should no longer be visible
  // ==================================================

  await expect(
    page.getByText('Enter OTP', {
      exact: true,
    })
  ).not.toBeVisible();

});

test('AUTH-023 new user agrees to consent and is shown complete profile page', async ({ page }) => {

  // ==================================================
  // 1. Mock Send OTP
  // ==================================================

  await page.route('**/api/auth/send-otp', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
      }),
    });
  });


  // ==================================================
  // 2. Mock Verify OTP - NEW USER
  // ==================================================

  await page.route('**/api/auth/verify-otp', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        message: 'OTP verified successfully',

        isNewUser: true,

        user: {
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


  // ==================================================
  // 3. Mock Consent API
  //
  // The real application calls:
  // POST /api/user/consent
  // after clicking I Agree + Continue.
  // ==================================================

  await page.route('**/api/user/consent', async route => {

    if (route.request().method() === 'POST') {

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


  // ==================================================
  // 4. Mock Profile API
  //
  // IMPORTANT:
  // profileComplete = false
  //
  // This is what makes the application show
  // Complete Your Profile.
  // ==================================================

  await page.route(
    '**/api/user/profile?email=*',
    async route => {

      await route.fulfill({
        status: 200,
        contentType: 'application/json',

        body: JSON.stringify({
          success: true,

          data: {
            userId: 999999,

            userName: null,

            email: null,

            height: null,

            dietType: null,

            gender: null,

            profileImage: null,

            latestWeight: null,

            latestWeightBodyFat: null,

            bodyFat: null,

            profileComplete: false,

            profilePicSnooze: null,
          },
        }),
      });
    }
  );


  // ==================================================
  // 5. Open Login
  // ==================================================

  await page.goto('/');


  // ==================================================
  // 6. Enter mobile number
  // ==================================================

  await page
    .getByLabel('Mobile Number')
    .fill('7695834209');


  // ==================================================
  // 7. Send OTP
  // ==================================================

  await page
    .getByRole('button', {
      name: 'Send OTP',
    })
    .click();


  // ==================================================
  // 8. Verify OTP screen
  // ==================================================

  await expect(
    page.getByText('Enter OTP', {
      exact: true,
    })
  ).toBeVisible();


  const otpInputs =
    page.locator('input[type="tel"]');


  await expect(
    otpInputs
  ).toHaveCount(6);


  // ==================================================
  // 9. Enter OTP
  // ==================================================

  const otp = '123456';

  for (let i = 0; i < otp.length; i++) {

    await otpInputs
      .nth(i)
      .fill(otp[i]);

  }


  // ==================================================
  // 10. Consent Form should appear
  // ==================================================

  await expect(
    page.getByRole('heading', {
      name: 'User Consent Form',
    })
  ).toBeVisible();


  // ==================================================
  // 11. Verify consent information
  // ==================================================

  await expect(
    page.getByText(
      'Consent to Collect and Use Personal and Health Information',
      {
        exact: true,
      }
    )
  ).toBeVisible();


  // ==================================================
  // 12. Select "I Agree"
  // ==================================================

  const agreeOption =
    page.getByText('I Agree', {
      exact: true,
    }).last();

  await expect(
    agreeOption
  ).toBeVisible();

  await agreeOption.click();


  // ==================================================
  // 13. Verify I Agree radio is selected
  // ==================================================

  const agreeRadio =
    page.locator(
      'input[type="radio"][name="consentChoice"]'
    ).nth(1);

  await expect(
    agreeRadio
  ).toBeChecked();


  // ==================================================
  // 14. Click Continue
  // ==================================================

  const continueButton =
    page.getByRole('button', {
      name: 'Continue',
    });

  await expect(
    continueButton
  ).toBeEnabled();

  await continueButton.click();


  // ==================================================
  // 15. Consent Form should disappear
  // ==================================================

  await expect(
    page.getByRole('heading', {
      name: 'User Consent Form',
    })
  ).not.toBeVisible();


  // ==================================================
  // 16. Complete Your Profile should appear
  // ==================================================

  await expect(
    page.getByRole('heading', {
      name: 'Complete Your Profile',
    })
  ).toBeVisible();


  // ==================================================
  // 17. Verify profile page description
  // ==================================================

  await expect(
    page.getByText(
      'Name, email, gender, height, diet preference, and photo — all in one place.',
      {
        exact: true,
      }
    )
  ).toBeVisible();

  // ==================================================
  // 20. Login page should NOT be visible
  // ==================================================

  await expect(
    page.getByLabel('Mobile Number')
  ).not.toBeVisible();

});

});

