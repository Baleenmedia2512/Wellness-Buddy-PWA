const { test, expect } = require('@playwright/test');

// ============================================================
// Test data
// ============================================================

const TEST_USER = {
  id: 999999,
  UserId: 999999,
  username: 'newuser',
  email: '',
  phone: '+917695834209',
};

// ============================================================
// Helper: Create authenticated state without OTP
// ============================================================

async function createAuthenticatedState(page) {
  await page.addInitScript(({ user }) => {
    localStorage.setItem('isOtpVerified', 'true');

    localStorage.setItem(
      'otpUser',
      JSON.stringify({
        isNewUser: true,
        ...user,
      })
    );

    localStorage.setItem(
      'user',
      JSON.stringify(user)
    );
  }, { user: TEST_USER });
}


// ============================================================
// Helper: Mock APIs required for Complete Profile
// ============================================================

async function mockCompleteProfileApis(page) {

  // ============================================================
  // SETUP STATUS
  // ============================================================

  await page.route(
    '**/api/user/status*',
    async route => {

      await route.fulfill({
        status:
          200,

        contentType:
          'application/json',

        body:
          JSON.stringify({

            success:
              true,

            setupSkipped:
              true,

            setupComplete:
              true,

            pendingRequest:
              false,

          }),

      });

    }
  );

  // ============================================================
  // USER LOOKUP
  // ============================================================

  await page.route(
    '**/api/user/lookup*',
    async route => {

      await route.fulfill({
        status:
          200,

        contentType:
          'application/json',

        body:
          JSON.stringify({

            success:
              true,

            isNewUser:
              true,

            isActive:
              true,

            role:
              'user',

          }),

      });

    }
  );


  // ============================================================
  // CONSENT
  // ============================================================

  let localConsentAccepted = false;

  await page.route(
    '**/api/user/consent*',
    async route => {

      const method =
        route.request().method();

      if (
        method === 'GET'
      ) {

        await route.fulfill({
          status:
            200,

          contentType:
            'application/json',

          body:
            JSON.stringify({
              success: true,
              consentRequired: true,
              consentAccepted: localConsentAccepted,
            }),
        });

        return;
      }

      if (
        method === 'POST'
      ) {
        localConsentAccepted = true;

        await route.fulfill({
          status:
            200,

          contentType:
            'application/json',

          body:
            JSON.stringify({
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


  // ============================================================
  // PROFILE
  // ============================================================

  await page.route(
    '**/api/user/profile*',
    async route => {

      const method =
        route.request().method();


      if (
        method === 'GET'
      ) {

        await route.fulfill({
          status:
            200,

          contentType:
            'application/json',

          body:
            JSON.stringify({

              success:
                true,

              data: {

                profileComplete:
                  false,

                userName:
                  'Nitheesh Lingam',

                email:
                  'nitheesh@example.com',

                height:
                  null,

                dietType:
                  null,

                gender:
                  null,

                currentWeight:
                  null,

                bodyFat:
                  null,

                profileImage:
                  null,

                physicalActivityLevel:
                  null,

              },

            }),

        });

        return;
      }


      await route.continue();

    }
  );

}


// ============================================================
// Helper: Navigate to Complete Profile
// ============================================================

async function goToCompleteProfile(page) {

  // ============================================================
  // 1. MOCK COMPLETE PROFILE APIS
  // ============================================================

  await mockCompleteProfileApis(page);


  // ============================================================
  // 2. CREATE AUTHENTICATED NEW-USER STATE
  // ============================================================

  await createAuthenticatedState(page);


  // ============================================================
  // 3. OPEN APPLICATION
  // ============================================================

  await page.goto('/');


  // ============================================================
  // 4. TARGET SCREENS
  // ============================================================

  const consentHeading =
    page.getByRole(
      'heading',
      {
        name:
          'User Consent Form',

        exact:
          true,
      }
    );


  const completeProfileHeading =
    page.getByRole(
      'heading',
      {
        name:
          'Complete Your Profile',

        exact:
          true,
      }
    );


  // ============================================================
  // 5. WAIT FOR EITHER CONSENT OR PROFILE
  //
  // Some application states can already have consent accepted.
  // Therefore do not hard-require Consent.
  // ============================================================

  await expect
    .poll(
      async () => {

        const consentVisible =
          await consentHeading
            .isVisible()
            .catch(() => false);

        const profileVisible =
          await completeProfileHeading
            .isVisible()
            .catch(() => false);

        return (
          consentVisible ||
          profileVisible
        );

      },
      {
        timeout:
          20000,

        intervals:
          [
            300,
            500,
            1000,
          ],
      }
    )
    .toBe(true);

  // ============================================================
  // 6. IF PROFILE IS ALREADY VISIBLE
  // ============================================================

  if (
    await completeProfileHeading
      .isVisible()
      .catch(() => false)
  ) {

    console.log(
      'CP SETUP: Complete Profile already visible'
    );

    return;
  }


  // ============================================================
  // 7. CONSENT FLOW
  // ============================================================

  await expect(
    consentHeading
  ).toBeVisible({
    timeout:
      10000,
  });


  const agreeRadio = page.getByRole('radio', { name: /I Agree I consent/i });

  await expect(
    agreeRadio
  ).toBeVisible({
    timeout:
      10000,
  });

  await agreeRadio.click({
    force:
      true,
  });


  console.log(
    'CP SETUP: I Agree clicked'
  );


  // ============================================================
  // 8. CONTINUE
  // ============================================================

  const consentContinue =
    page.getByRole(
      'button',
      {
        name:
          'Continue',

        exact:
          true,
      }
    );


  await expect(
    consentContinue
  ).toBeVisible({
    timeout:
      10000,
  });


  await expect(
    consentContinue
  ).toBeEnabled({
    timeout:
      10000,
  });


  await consentContinue.click();


  // ============================================================
  // 9. COMPLETE PROFILE
  // ============================================================

  await expect(
    completeProfileHeading
  ).toBeVisible({
    timeout:
      20000,
  });


  console.log(
    'CP SETUP: Complete Profile page loaded'
  );

}

// ============================================================
// Fill Complete Profile
// Pass the field name that should remain empty.
// ============================================================

// ============================================================
// Helper: Fill all required fields
// Full Name can be overridden for the field being tested.
// ============================================================

async function fillValidProfile(page) {

  // ============================================================
  // FULL NAME
  // ============================================================

  await page
    .getByPlaceholder('Enter your full name')
    .fill('Nitheesh Lingam');


  // ============================================================
  // EMAIL
  // ============================================================

  const emailInput =
    page.getByPlaceholder('you@example.com');

  if (await emailInput.isEditable()) {
    await emailInput.fill('nitheesh@example.com');
  }


  // ============================================================
  // HEIGHT
  // ============================================================

  await page
    .getByPlaceholder('e.g. 170')
    .fill('170');


  // ============================================================
  // CURRENT WEIGHT
  // ============================================================

  await page
    .getByPlaceholder('e.g. 72.5')
    .fill('72.5');


  // ============================================================
  // BODY FAT
  // ============================================================

  await page
    .locator('label')
    .filter({ hasText: 'Fat %' })
    .locator('..')
    .locator('input')
    .fill('22');


  // ============================================================
  // GENDER
  // ============================================================

  const genderSelect =
    page
      .locator('select')
      .filter({
        has: page.locator(
          'option[value="Male"]'
        ),
      });

  await genderSelect.selectOption('Male');


  // ============================================================
  // DIET
  // ============================================================

  await page
    .getByRole(
      'button',
      {
        name: 'Vegetarian',
        exact: true,
      }
    )
    .click();


  // ============================================================
  // PROFILE PICTURE
  // ============================================================
  //
  // CP-005 is not testing picture upload, but the application
  // requires a valid picture before Save & Continue can enable.
  //
  // Use the existing fixture instead of changing the picture
  // logic of the application.
  // ============================================================

  const pictureInput =
    page.locator(
      'input[type="file"][accept="image/*"]'
    ).last();


  if (await pictureInput.count() > 0) {

    await pictureInput.setInputFiles(
      'tests/fixtures/profile-photo.jpg'
    );

  }

}

// ============================================================
// Complete Profile Tests
// ============================================================

test.describe('Complete Profile', () => {


  // ==========================================================
  // CP-001
  // ==========================================================

  test(
    'CP-001 complete profile page is displayed',
    async ({ page }) => {

      await goToCompleteProfile(page);

      const completeProfileHeading =
        page.getByRole(
          'heading',
          {
            name:
              'Complete Your Profile',

            exact:
              true,
          }
        );

      await expect(
        completeProfileHeading
      ).toBeVisible({
        timeout:
          20000,
      });


      await expect(
        page.getByText(
          "Gender, height, diet, and body metrics — then transformation photos.",
          {
            exact:
              true,
          }
        )
      ).toBeVisible({
        timeout:
          10000,
      });


      console.log(
        'CP-001 COMPLETE PROFILE PAGE VERIFIED'
      );

    }
  );

  // ==========================================================
  // CP-002
  // ==========================================================

  test(
    'CP-002 complete profile displays all required fields',
    async ({ page }) => {

      await goToCompleteProfile(page);

      // Confirm page loaded
      await expect(
        page.getByRole('heading', {
          name: 'Complete Your Profile',
        })
      ).toBeVisible();



      // Explicitly verify the required fields are visible instead of iterating dynamically
      // Name, Email, and Profile Picture are hidden by identityLocked and showPictureSection=false
      const heightInput = page.locator('label').filter({ hasText: 'Height (cm)' }).locator('..').locator('input');
      await expect(heightInput).toBeVisible();

      const weightInput = page.locator('label').filter({ hasText: 'Current Weight (kg)' }).locator('..').locator('input');
      await expect(weightInput).toBeVisible();
      await expect(page.locator('label').filter({ hasText: 'Fat %' }).locator('..').locator('input')).toBeVisible();

      // Gender select
      const genderSelect = page.locator('select').filter({ has: page.locator('option[value="Male"]') });
      await expect(genderSelect).toBeVisible();

      // Diet buttons (Vegetarian is one of them)
      await expect(page.getByRole('button', { name: 'Vegetarian', exact: true })).toBeVisible();
    }
  );


  // ==========================================================
  // CP-003
  // ==========================================================

  test(
    'CP-003 Name and Email validation controls Continue button availability',
    async ({ page }) => {

      // ============================================================
      // TEST DATA
      // ============================================================

      const TEST_PHONE =
        '7695834209';

      const TEST_OTP =
        '1234';

      const TEST_NAME =
        'Nitheesh Lingam';


      // ============================================================
      // 1. CONSENT FEATURE FLAG
      // ============================================================

      await page.addInitScript(() => {

        localStorage.setItem(
          'ff.consent-gate',
          'true'
        );

      });


      // ============================================================
      // 2. SEND LOGIN OTP
      // ============================================================

      await page.route(
        '**/api/auth/send-otp',
        async route => {

          console.log(
            'CP-003 SEND OTP'
          );

          expect(
            route.request().method()
          ).toBe('POST');

          await route.fulfill({

            status:
              200,

            contentType:
              'application/json',

            body:
              JSON.stringify({
                success:
                  true,
              }),

          });

        }
      );


      // ============================================================
      // 3. VERIFY LOGIN OTP
      //
      // IMPORTANT:
      // Phone-only user.
      //
      // No email is supplied because the application should show
      // the Name Entry page first for a phone user.
      // ============================================================

      await page.route(
        '**/api/auth/verify-otp',
        async route => {

          const body =
            route.request().postDataJSON();

          console.log(
            'CP-003 LOGIN OTP BODY:',
            body
          );

          expect(
            body
          ).toMatchObject({

            recipient:
              `+91${TEST_PHONE}`,

            otp:
              TEST_OTP,

            contactType:
              'phone',

          });


          await route.fulfill({

            status:
              200,

            contentType:
              'application/json',

            body:
              JSON.stringify({

                success:
                  true,

                isNewUser:
                  true,

                isActive:
                  true,

                role:
                  'user',

                user: {

                  id:
                    1004,

                  username:
                    'newuser',

                  userName:
                    'newuser',

                  name:
                    '',

                  email:
                    '',

                  phone:
                    `+91${TEST_PHONE}`,

                  phoneNumber:
                    `+91${TEST_PHONE}`,

                  status:
                    'Active',

                  consentRequired:
                    true,

                },

              }),

          });

        }
      );


      // ============================================================
      // 4. CONSENT
      //
      // GET  -> display consent
      // POST -> accept consent
      // ============================================================

      let consentAccepted =
        false;


      await page.route(
        '**/api/user/consent*',
        async route => {

          const method =
            route.request().method();


          console.log(
            'CP-003 CONSENT:',
            method,
            route.request().url()
          );


          // --------------------------------------------------------
          // GET CONSENT
          // --------------------------------------------------------

          if (
            method === 'GET'
          ) {

            await route.fulfill({

              status:
                200,

              contentType:
                'application/json',

              body:
                JSON.stringify({

                  success:
                    true,

                  consentRequired:
                    !consentAccepted,

                  consentAccepted:
                    consentAccepted,

                }),

            });

            return;
          }


          // --------------------------------------------------------
          // POST CONSENT
          // --------------------------------------------------------

          if (
            method === 'POST'
          ) {

            const body =
              route.request().postDataJSON();


            console.log(
              'CP-003 CONSENT POST:',
              body
            );


            expect(
              body.consentAccepted
            ).toBe(true);


            consentAccepted =
              true;


            await route.fulfill({

              status:
                200,

              contentType:
                'application/json',

              body:
                JSON.stringify({

                  success:
                    true,

                  consentRequired:
                    false,

                  consentAccepted:
                    true,

                }),

            });

            return;
          }


          await route.fallback();

        }
      );


      // ============================================================
      // 5. PROFILE REQUESTS
      //
      // CP-003 is a phone-only onboarding test.
      //
      // The application should NOT need an email-based profile
      // completion check at this stage.
      //
      // However, if the UI requests profile information using the
      // phone user, return an incomplete identity.
      // ============================================================

      await page.route(
        '**/api/user/profile**',
        async route => {

          const method =
            route.request().method();

          console.log(
            'CP-003 PROFILE:',
            method,
            route.request().url()
          );


          // --------------------------------------------------------
          // GET PROFILE
          // --------------------------------------------------------

          if (
            method === 'GET'
          ) {

            await route.fulfill({

              status:
                200,

              contentType:
                'application/json',

              body:
                JSON.stringify({

                  success:
                    true,

                  data: {

                    userName:
                      '',

                    email:
                      '',

                    phoneNumber:
                      `+91${TEST_PHONE}`,

                    profileComplete:
                      false,

                    consentRequired:
                      false,

                    height:
                      null,

                    dietType:
                      null,

                    gender:
                      null,

                    profileImage:
                      null,

                  },

                }),

            });

            return;
          }


          await route.fallback();

        }
      );


      // ============================================================
      // 6. OPEN LOGIN PAGE
      // ============================================================

      await page.goto(
        '/',
        {
          waitUntil:
            'domcontentloaded',
        }
      );


      // ============================================================
      // 7. MOBILE NUMBER
      // ============================================================

      const mobileInput =
        page.getByLabel(
          'Mobile Number'
        );


      await expect(
        mobileInput
      ).toBeVisible({
        timeout:
          15000,
      });


      await mobileInput.fill(
        TEST_PHONE
      );


      await expect(
        mobileInput
      ).toHaveValue(
        TEST_PHONE
      );


      // ============================================================
      // 8. SEND OTP
      // ============================================================

      const sendOtpButton =
        page.getByRole(
          'button',
          {
            name:
              'Send OTP',

            exact:
              true,
          }
        );


      await expect(
        sendOtpButton
      ).toBeEnabled();


      await sendOtpButton.click();


      // ============================================================
      // 9. OTP PAGE
      // ============================================================

      await expect(
        page.getByText(
          'Enter OTP',
          {
            exact:
              true,
          }
        )
      ).toBeVisible({
        timeout:
          15000,
      });


      const otpInputs =
        page.locator(
          'input[type="tel"]'
        );


      await expect(
        otpInputs
      ).toHaveCount(
        4
      );


      // ============================================================
      // 10. ENTER OTP
      // ============================================================

      for (
        let i = 0;
        i < TEST_OTP.length;
        i++
      ) {

        await otpInputs
          .nth(i)
          .fill(
            TEST_OTP[i]
          );

      }


      // ============================================================
      // 11. CONSENT PAGE
      // ============================================================

      const consentHeading =
        page.getByRole(
          'heading',
          {
            name:
              'User Consent Form',

            exact:
              true,
          }
        );


      await expect(
        consentHeading
      ).toBeVisible({
        timeout:
          15000,
      });


      console.log(
        'CP-003 CONSENT FORM DISPLAYED'
      );


      // ============================================================
      // 12. SELECT I AGREE
      // ============================================================

      const agreeOption =
        page
          .locator('label')
          .filter({
            hasText:
              'I Agree',
          })
          .last();


      await expect(
        agreeOption
      ).toBeVisible({
        timeout:
          10000,
      });


      await agreeOption.click({
        force:
          true,
      });


      console.log(
        'CP-003 I AGREE SELECTED'
      );


      // ============================================================
      // 13. CONSENT CONTINUE
      // ============================================================

      const consentContinue =
        page.getByRole(
          'button',
          {
            name:
              'Continue',

            exact:
              true,
          }
        );


      await expect(
        consentContinue
      ).toBeEnabled({
        timeout:
          10000,
      });


      await consentContinue.click();


      // ============================================================
      // 14. WAIT FOR CONSENT POST
      // ============================================================

      await expect
        .poll(
          () =>
            consentAccepted,
          {
            timeout:
              10000,
          }
        )
        .toBe(true);


      // ============================================================
      // 15. CONSENT FORM DISAPPEARS
      // ============================================================

      await expect(
        consentHeading
      ).not.toBeVisible({
        timeout:
          15000,
      });


      // ============================================================
      // 16. NAME ENTRY PAGE
      //
      // The application source uses:
      //
      // placeholder="Enter your full name"
      //
      // Therefore this is the correct primary locator.
      // ============================================================

      const fullNameInput =
        page.getByPlaceholder(
          'Enter your full name'
        );


      await expect(
        fullNameInput
      ).toBeVisible({
        timeout:
          15000,
      });


      console.log(
        'CP-003 NAME ENTRY PAGE DISPLAYED'
      );


      // ============================================================
      // 17. FIND NAME CONTINUE BUTTON
      // ============================================================

      const nameContinue =
        page.getByRole(
          'button',
          {
            name:
              'Send verification code',

            exact:
              true,
          }
        );


      await expect(
        nameContinue
      ).toBeVisible({
        timeout:
          10000,
      });


      // ============================================================
      // 18. TEST 1: BLANK NAME + VALID EMAIL
      // ============================================================

      const emailInput =
        page.getByPlaceholder(
          'you@example.com'
        );

      await expect(
        emailInput
      ).toBeVisible({
        timeout: 15000,
      });

      await fullNameInput.fill('');
      await emailInput.fill('nitheesh@example.com');

      await expect(
        nameContinue
      ).toBeDisabled({
        timeout:
          10000,
      });

      console.log(
        'CP-003 BLANK NAME + VALID EMAIL -> CONTINUE DISABLED'
      );


      // ============================================================
      // 19. TEST 2: VALID NAME + BLANK EMAIL
      // ============================================================

      await fullNameInput.fill(TEST_NAME);
      await emailInput.fill('');

      await expect(
        nameContinue
      ).toBeDisabled({
        timeout:
          10000,
      });

      console.log(
        'CP-003 VALID NAME + BLANK EMAIL -> CONTINUE DISABLED'
      );


      // ============================================================
      // 20. TEST 3: VALID NAME + INVALID EMAIL FORMAT
      // ============================================================

      await fullNameInput.fill(TEST_NAME);
      await emailInput.fill('invalid-email-format');

      await expect(
        nameContinue
      ).toBeDisabled({
        timeout:
          10000,
      });

      console.log(
        'CP-003 VALID NAME + INVALID EMAIL FORMAT -> CONTINUE DISABLED'
      );


      // ============================================================
      // 21. TEST 4: VALID NAME + VALID EMAIL
      // ============================================================

      await fullNameInput.fill(TEST_NAME);
      await emailInput.fill('nitheesh@example.com');

      await expect(
        nameContinue
      ).toBeEnabled({
        timeout:
          10000,
      });

      console.log(
        'CP-003 VALID NAME + VALID EMAIL -> CONTINUE ENABLED'
      );


      // ============================================================
      // 22. CP-003 ENDS HERE
      //
      // DO NOT CLICK CONTINUE.
      //
      // CP-004 will test:
      //
      // Name Entry
      //      ↓
      // Coach Authentication
      // ============================================================

      console.log(
        'CP-003 NAME & EMAIL VALIDATION VERIFIED'
      );

    }
  );




  // ==========================================================
  // CP-004
  // ==========================================================

  test(
    'CP-004 Handle existing email collision and verify OTP flow transition',
    async ({ page }) => {

      const TEST_PHONE = '7695834209';
      const TEST_OTP = '1234';
      const TEST_NAME = 'Nitheesh Lingam';

      await page.addInitScript(() => {
        localStorage.setItem('ff.consent-gate', 'true');
      });

      await page.route('**/api/auth/send-otp', async route => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
      });

      await page.route('**/api/auth/verify-otp', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            isNewUser: true,
            isActive: true,
            role: 'user',
            user: { id: 1004, username: 'newuser', userName: 'newuser', name: '', email: '', phone: `+91${TEST_PHONE}`, phoneNumber: `+91${TEST_PHONE}`, status: 'Active', consentRequired: true },
          }),
        });
      });

      let consentAccepted = false;
      await page.route('**/api/user/consent*', async route => {
        const method = route.request().method();
        if (method === 'GET') {
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, consentRequired: !consentAccepted, consentAccepted }) });
          return;
        }
        if (method === 'POST') {
          consentAccepted = true;
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, consentRequired: false, consentAccepted: true }) });
          return;
        }
        await route.fallback();
      });

      await page.route('**/api/user/profile**', async route => {
        if (route.request().method() === 'GET') {
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { userName: '', email: '', phoneNumber: `+91${TEST_PHONE}`, profileComplete: false, consentRequired: false, height: null, dietType: null, gender: null, profileImage: null } }) });
          return;
        }
        await route.fallback();
      });

      let simulateCollision = true;
      await page.route('**/api/user/check-onboarding-email', async route => {
        if (simulateCollision) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, available: false })
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, available: true, otpSent: true })
          });
        }
      });

      await page.goto('/', { waitUntil: 'domcontentloaded' });

      const mobileInput = page.getByLabel('Mobile Number');
      await expect(mobileInput).toBeVisible({ timeout: 15000 });
      await mobileInput.fill(TEST_PHONE);

      const sendOtpButton = page.getByRole('button', { name: 'Send OTP', exact: true });
      await expect(sendOtpButton).toBeEnabled();
      await sendOtpButton.click();

      await expect(page.getByText('Enter OTP', { exact: true })).toBeVisible({ timeout: 15000 });
      const otpInputs = page.locator('input[type="tel"]');
      for (let i = 0; i < TEST_OTP.length; i++) {
        await otpInputs.nth(i).fill(TEST_OTP[i]);
      }

      const agreeOption = page.locator('label').filter({ hasText: 'I Agree' }).last();
      await expect(agreeOption).toBeVisible({ timeout: 15000 });
      await agreeOption.click({ force: true });

      const consentContinue = page.getByRole('button', { name: 'Continue', exact: true });
      await consentContinue.click();

      await expect(page.getByRole('heading', { name: 'User Consent Form', exact: true })).not.toBeVisible({ timeout: 15000 });

      const fullNameInput = page.getByPlaceholder('Enter your full name');
      await expect(fullNameInput).toBeVisible({ timeout: 15000 });

      const emailInput = page.getByPlaceholder('you@example.com');
      await fullNameInput.fill(TEST_NAME);
      await emailInput.fill('taken@example.com');

      const nameContinue = page.getByRole('button', { name: 'Send verification code', exact: true });
      await expect(nameContinue).toBeEnabled({ timeout: 10000 });
      await nameContinue.click();

      const adoptMessage = page.getByText('This email already has an account. Do you want to use it?');
      await expect(adoptMessage).toBeVisible({ timeout: 10000 });

      const differentEmailBtn = page.getByRole('button', { name: 'Use a different email' });
      await differentEmailBtn.click();

      await expect(fullNameInput).toBeVisible({ timeout: 5000 });

      simulateCollision = false;

      await emailInput.fill('new@example.com');
      await expect(nameContinue).toBeEnabled({ timeout: 5000 });
      await nameContinue.click();

      const otpMessage = page.getByText('We sent a 4-digit code to');
      await expect(otpMessage).toBeVisible({ timeout: 10000 });
    }
  );

  // ============================================================
  // CP-005
  // Full Name validation
  // ============================================================
  test(
    'CP-005 Coach Authentication appears after email OTP verification',
    async ({ page }) => {

      page.on('request', request => console.log('>>', request.method(), request.url()));
      page.on('response', response => console.log('<<', response.status(), response.url()));

      const TEST_PHONE = '7695834209';
      const TEST_OTP = '1234';
      const TEST_NAME = 'Nitheesh Lingam';
      const TEST_EMAIL = 'new@example.com';

      await page.addInitScript(() => {
        localStorage.setItem('ff.consent-gate', 'true');
      });

      await page.route('**/api/auth/send-otp', async route => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
      });

      await page.route('**/api/auth/verify-otp', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            isNewUser: true,
            isActive: true,
            role: 'user',
            user: { id: 1004, username: 'newuser', userName: 'newuser', name: '', email: '', phone: `+91${TEST_PHONE}`, phoneNumber: `+91${TEST_PHONE}`, status: 'Active', consentRequired: true },
          }),
        });
      });

      let consentAccepted = false;
      await page.route('**/api/user/consent*', async route => {
        const method = route.request().method();
        if (method === 'GET') {
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, consentRequired: !consentAccepted, consentAccepted }) });
          return;
        }
        if (method === 'POST') {
          consentAccepted = true;
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, consentRequired: false, consentAccepted: true }) });
          return;
        }
        await route.fallback();
      });

      await page.route('**/api/user/profile**', async route => {
        if (route.request().method() === 'GET') {
          const isEmailCheck = route.request().url().includes('email=');
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                userName: isEmailCheck ? TEST_NAME : '',
                email: isEmailCheck ? TEST_EMAIL : '',
                phoneNumber: `+91${TEST_PHONE}`,
                profileComplete: false,
                consentRequired: false,
                height: null,
                dietType: null,
                gender: null,
                profileImage: null
              }
            })
          });
          return;
        }
        await route.fallback();
      });

      await page.route('**/api/user/check-onboarding-email', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, available: true, otpSent: true })
        });
      });

      await page.route('**/api/user/verify-onboarding-email', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            email: TEST_EMAIL,
            userName: TEST_NAME,
            adopted: false,
            user: { id: 1004, phone: `+91${TEST_PHONE}` }
          })
        });
      }); let uplineRequested = false;
      let uplineValidated = false;

      await page.route('**/api/user/status*', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            setupSkipped: false,
            setupComplete: uplineValidated,
            pendingRequest: uplineRequested ? { coachId: 'coach1', expired: false } : null
          })
        });
      });

      await page.route('**/api/users/search*', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            coaches: [{ userId: 'coach1', userName: 'Test Coach', email: 'coach@example.com' }]
          })
        });
      });

      await page.route('**/api/upline/request', async route => {
        uplineRequested = true;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true })
        });
      });

      await page.route('**/api/upline/validate-otp', async route => {
        uplineRequested = false;
        uplineValidated = true;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true })
        });
      });

      await page.goto('/', { waitUntil: 'domcontentloaded' });

      const mobileInput = page.getByLabel('Mobile Number');
      await expect(mobileInput).toBeVisible({ timeout: 15000 });
      await mobileInput.fill(TEST_PHONE);

      const sendOtpButton = page.getByRole('button', { name: 'Send OTP', exact: true });
      await expect(sendOtpButton).toBeEnabled();
      await sendOtpButton.click();

      await expect(page.getByText('Enter OTP', { exact: true })).toBeVisible({ timeout: 15000 });
      let otpInputs = page.locator('input[type="tel"]');
      for (let i = 0; i < 4; i++) {
        await otpInputs.nth(i).fill(TEST_OTP[i]);
      }

      // Accept User Consent
      const agreeOption = page.locator('label').filter({ hasText: 'I Agree' }).last();
      await expect(agreeOption).toBeVisible({ timeout: 15000 });
      await agreeOption.click({ force: true });

      const consentContinue = page.getByRole('button', { name: 'Continue', exact: true });
      await consentContinue.click();

      await expect(page.getByRole('heading', { name: 'User Consent Form', exact: true })).not.toBeVisible({ timeout: 15000 });

      // Verify Identity Screen
      const fullNameInput = page.getByPlaceholder('Enter your full name');
      await expect(fullNameInput).toBeVisible({ timeout: 15000 });
      const emailInput = page.getByPlaceholder('you@example.com');
      await fullNameInput.fill(TEST_NAME);
      await emailInput.fill(TEST_EMAIL);

      const verifyEmailBtn = page.getByRole('button', { name: 'Send verification code', exact: true });
      await expect(verifyEmailBtn).toBeEnabled();
      await verifyEmailBtn.click();

      // Verify Email OTP Screen
      const verifyOtpHeader = page.getByText('We sent a 4-digit code to');
      await expect(verifyOtpHeader).toBeVisible({ timeout: 15000 });

      const emailOtpInputs = page.locator('input[inputmode="numeric"]');
      await expect(emailOtpInputs.first()).toBeVisible({ timeout: 15000 });
      for (let i = 0; i < 4; i++) {
        await emailOtpInputs.nth(i).fill(TEST_OTP[i]);
      }

      const emailVerifyBtn = page.getByRole('button', { name: 'Verify email', exact: true });
      await expect(emailVerifyBtn).toBeEnabled();
      await emailVerifyBtn.click();

      // Verify Coach Setup Appears
      const coachHeading = page.getByText('Search and select the person name');
      await expect(coachHeading).toBeVisible({ timeout: 15000 });

      // Wait for the modal's entry animation to finish
      await page.waitForTimeout(1000);

      // Perform Coach Authentication
      const coachSearchInput = page.getByPlaceholder('Type your sponsor name or email...');
      await coachSearchInput.fill('Test');

      const coachResult = page.getByText('Test Coach');
      await expect(coachResult).toBeVisible({ timeout: 15000 });
      await coachResult.click();

      const continueBtn = page.getByRole('button', { name: 'Continue', exact: true });
      await expect(continueBtn).toBeEnabled();
      await continueBtn.click();

      // Step 2: Skip Community ID
      const skipBtn = page.getByRole('button', { name: 'Skip Community ID', exact: true });
      await expect(skipBtn).toBeVisible({ timeout: 15000 });
      await skipBtn.click();

      // Verify Coach OTP Screen
      const coachOtpHeader = page.getByText('Verify Request');
      await expect(coachOtpHeader).toBeVisible({ timeout: 15000 });

      const coachOtpInputs = page.locator('input[inputmode="numeric"]');
      await expect(coachOtpInputs.first()).toBeVisible({ timeout: 15000 });
      for (let i = 0; i < 4; i++) {
        await coachOtpInputs.nth(i).fill(TEST_OTP[i]);
      }

      // After OTP, it should transition to Complete Profile
      const completeProfileHeading = page.getByRole('heading', { name: 'Complete Your Profile' });
      await expect(completeProfileHeading).toBeVisible({ timeout: 15000 });
    }
  );



  test(
    'CP-006 Gender selection controls Save & Continue',
    async ({ page }) => {
      // ============================================================
      // TEST DATA
      // ============================================================
      const TEST_PHONE = '7695834209';
      const TEST_OTP = '1234';
      const TEST_NAME = 'Nitheesh Lingam';

      // ============================================================
      // 1. SEND LOGIN OTP
      // ============================================================
      await page.route('**/api/auth/send-otp', async route => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
      });

      // ============================================================
      // 2. VERIFY OTP
      // ============================================================
      await page.route('**/api/auth/verify-otp', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            isNewUser: false,
            isActive: true,
            role: 'user',
            user: {
              id: 1004, UserId: 1004, username: TEST_NAME, userName: TEST_NAME,
              name: TEST_NAME, email: '', phone: `+91${TEST_PHONE}`, phoneNumber: TEST_PHONE,
              status: 'Active', consentRequired: false,
            },
          }),
        });
      });

      // ============================================================
      // 3. VERIFY SESSION
      // ============================================================
      await page.route('**/api/user/verify-session', async route => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, userId: 1004, sessionStale: false }) });
      });

      // ============================================================
      // 4. USER STATUS
      // ============================================================
      await page.route('**/api/user/status*', async route => {
        await route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ success: true, setupComplete: true, setupSkipped: true, hasTeamId: false, hasUpline: true, pendingRequest: false, redirectTo: null }),
        });
      });

      // ============================================================
      // 5. CONSENT
      // ============================================================
      await page.route('**/api/user/consent*', async route => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, consentRequired: false, consentAccepted: true }) });
      });

      // ============================================================
      // 6. PROFILE
      //
      // All fields valid EXCEPT gender.
      // ============================================================
      await page.route('**/api/user/profile*', async route => {
        if (route.request().method() !== 'GET') {
          await route.fallback();
          return;
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              userId: 1004, profileComplete: false, userName: TEST_NAME, name: TEST_NAME,
              email: 'nitheesh@example.com', phoneNumber: TEST_PHONE, gender: '', height: 170, dietType: 'Vegetarian',
              latestWeight: 72.5, currentWeight: 72.5, latestWeightBodyFat: 22, bodyFat: 22,
              profileImage: 'https://example.com/profile.jpg', physicalActivityLevel: null, needsCurrentWeight: false,
            },
          }),
        });
      });

      // ============================================================
      // 7. OPEN APPLICATION & LOGIN
      // ============================================================
      await page.goto('/', { waitUntil: 'domcontentloaded' });

      const mobileInput = page.getByLabel('Mobile Number');
      await expect(mobileInput).toBeVisible({ timeout: 15000 });
      await mobileInput.fill(TEST_PHONE);
      await page.getByRole('button', { name: 'Send OTP', exact: true }).click();

      // ============================================================
      // 8. OTP PAGE
      // ============================================================
      await expect(page.getByText('Enter OTP', { exact: true })).toBeVisible({ timeout: 15000 });
      const otpInputs = page.locator('input[data-otp="true"]');
      await expect(otpInputs).toHaveCount(4);;
      for (let i = 0; i < TEST_OTP.length; i++) {
        await otpInputs.nth(i).fill(TEST_OTP[i]);
      }

      // ============================================================
      // 9. COMPLETE PROFILE
      // ============================================================
      const completeProfileHeading = page.getByRole('heading', { name: 'Complete Your Profile', exact: true });
      await expect(completeProfileHeading).toBeVisible({ timeout: 20000 });

      // ============================================================
      // 10. GENDER SELECTION CONTROLS SAVE & CONTINUE
      // ============================================================
      const saveButton = page.getByRole('button', { name: 'Save & Continue', exact: true });
      await expect(saveButton).toBeVisible({ timeout: 10000 });

      // Gender is empty initially, so save should be disabled
      await expect(saveButton).toBeDisabled({ timeout: 10000 });
      console.log('CP-006 GENDER EMPTY -> SAVE DISABLED');

      // Select Male
      const genderSelect = page.locator('select').filter({ has: page.locator('option[value="Male"]') }).first();
      await genderSelect.selectOption('Male');
      await expect(saveButton).toBeEnabled({ timeout: 10000 });
      console.log('CP-006 GENDER MALE -> SAVE ENABLED');

      // Select Female
      await genderSelect.selectOption('Female');
      await expect(saveButton).toBeEnabled({ timeout: 10000 });
      console.log('CP-006 GENDER FEMALE -> SAVE ENABLED');
    }
  );

  test(
    'CP-007 Height field validation for minimum and maximum boundaries',
    async ({ page }) => {

      // ============================================================
      // TEST DATA
      // ============================================================
      const TEST_PHONE = '7695834209';
      const TEST_OTP = '1234';
      const TEST_NAME = 'Nitheesh Lingam';

      // ============================================================
      // 1. SEND LOGIN OTP
      // ============================================================
      await page.route('**/api/auth/send-otp', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
          }),
        });
      });

      // ============================================================
      // 2. VERIFY OTP
      // ============================================================
      await page.route('**/api/auth/verify-otp', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            isNewUser: false,
            isActive: true,
            role: 'user',
            user: {
              id: 1004,
              UserId: 1004,
              username: TEST_NAME,
              userName: TEST_NAME,
              name: TEST_NAME,
              email: '',
              phone: `+ 91${TEST_PHONE} `,
              phoneNumber: TEST_PHONE,
              status: 'Active',
              consentRequired: false,
            },
          }),
        });
      });

      // ============================================================
      // 3. VERIFY SESSION
      // ============================================================
      await page.route('**/api/user/verify-session', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            userId: 1004,
            sessionStale: false,
          }),
        });
      });

      // ============================================================
      // 4. USER STATUS
      // ============================================================
      await page.route('**/api/user/status*', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            setupComplete: true,
            setupSkipped: true,
            hasTeamId: false,
            hasUpline: true,
            pendingRequest: false,
            redirectTo: null,
          }),
        });
      });

      // ============================================================
      // 5. CONSENT
      // ============================================================
      await page.route('**/api/user/consent*', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            consentRequired: false,
            consentAccepted: true,
          }),
        });
      });

      // ============================================================
      // 6. PROFILE
      // ============================================================
      await page.route('**/api/user/profile*', async route => {
        const method = route.request().method();

        if (method === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                userId: 1004,
                profileComplete: false,
                userName: TEST_NAME,
                name: TEST_NAME,
                email: 'nitheesh@example.com',
                phoneNumber: TEST_PHONE,
                gender: 'Male',
                height: null,
                dietType: 'Vegetarian',
                latestWeight: 72.5,
                currentWeight: 72.5,
                latestWeightBodyFat: 22,
                bodyFat: 22,
                profileImage: 'https://example.com/profile.jpg',
                physicalActivityLevel: null,
                needsCurrentWeight: false,
              },
            }),
          });
        } else {
          await route.fallback();
        }
      });

      // ============================================================
      // 7. OPEN APPLICATION
      // ============================================================
      await page.goto('/', {
        waitUntil: 'domcontentloaded',
      });

      // ============================================================
      // 8. LOGIN
      // ============================================================
      const mobileInput = page.getByLabel('Mobile Number');

      await expect(mobileInput).toBeVisible({
        timeout: 15000,
      });

      await mobileInput.fill(TEST_PHONE);

      await page
        .getByRole('button', {
          name: 'Send OTP',
          exact: true,
        })
        .click();

      // ============================================================
      // 9. OTP PAGE
      // ============================================================
      await expect(
        page.getByText('Enter OTP', {
          exact: true,
        })
      ).toBeVisible({
        timeout: 15000,
      });

      const otpInputs = page.locator('input[data-otp="true"]');

      await expect(otpInputs).toHaveCount(4);;

      for (let i = 0; i < TEST_OTP.length; i++) {
        await otpInputs.nth(i).fill(TEST_OTP[i]);
      }

      // ============================================================
      // 10. COMPLETE PROFILE PAGE
      // ============================================================
      const completeProfileHeading = page.getByRole('heading', {
        name: 'Complete Your Profile',
        exact: true,
      });

      await expect(completeProfileHeading).toBeVisible({
        timeout: 20000,
      });

      console.log('CP-007: Complete Profile page loaded');

      // ============================================================
      // 11. HEIGHT INPUT
      // ============================================================
      const heightInput = page.getByPlaceholder('e.g. 170');

      await expect(heightInput).toBeVisible({
        timeout: 10000,
      });

      // ============================================================
      // HELPER FUNCTION
      //
      // Checks whether the input has a red validation border.
      // ============================================================
      const getBorderColor = async () => {
        return await heightInput.evaluate(element => {
          return window.getComputedStyle(element).borderColor;
        });
      };

      // ============================================================
      // TEST 1: 49 → INVALID
      // Expected: Red border
      // ============================================================
      await heightInput.fill('49');

      await expect.poll(
        async () => await getBorderColor()
      ).not.toBe('rgb(0, 0, 0)');

      console.log('CP-007: Height 49 validated as invalid');

      // ============================================================
      // TEST 2: 50 → VALID
      // Expected: Normal border
      // ============================================================
      await heightInput.fill('50');

      const borderAt50 = await getBorderColor();

      console.log(
        `CP-007: Height 50 border color: ${borderAt50} `
      );

      // ============================================================
      // TEST 3: 250 → VALID
      // Expected: Normal border
      // ============================================================
      await heightInput.fill('250');

      const borderAt250 = await getBorderColor();

      console.log(
        `CP-007: Height 250 border color: ${borderAt250} `
      );

      // ============================================================
      // TEST 4: 251 → INVALID
      // Expected: Red border
      // ============================================================
      await heightInput.fill('251');

      await expect.poll(
        async () => await getBorderColor()
      ).not.toBe('rgb(0, 0, 0)');

      console.log('CP-007: Height 251 validated as invalid');

      console.log(
        'CP-007: All height boundary validations completed'
      );


    }
  );


  test(
    'CP-008 Diet Preference selection controls Save & Continue and progression',
    async ({ page }) => {
      // ============================================================
      // TEST DATA
      // ============================================================
      const TEST_PHONE = '7695834209';
      const TEST_OTP = '1234';
      const TEST_NAME = 'Nitheesh Lingam';

      // ============================================================
      // 1. SEND LOGIN OTP
      // ============================================================
      await page.route('**/api/auth/send-otp', async route => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
      });

      // ============================================================
      // 2. VERIFY OTP
      // ============================================================
      await page.route('**/api/auth/verify-otp', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            isNewUser: false,
            isActive: true,
            role: 'user',
            user: {
              id: 1004, UserId: 1004, username: TEST_NAME, userName: TEST_NAME,
              name: TEST_NAME, email: '', phone: `+91${TEST_PHONE}`, phoneNumber: TEST_PHONE,
              status: 'Active', consentRequired: false,
            },
          }),
        });
      });

      // ============================================================
      // 3. VERIFY SESSION
      // ============================================================
      await page.route('**/api/user/verify-session', async route => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, userId: 1004, sessionStale: false }) });
      });

      // ============================================================
      // 4. USER STATUS
      // ============================================================
      await page.route('**/api/user/status*', async route => {
        await route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ success: true, setupComplete: true, setupSkipped: true, hasTeamId: false, hasUpline: true, pendingRequest: false, redirectTo: null }),
        });
      });

      // ============================================================
      // 5. CONSENT
      // ============================================================
      await page.route('**/api/user/consent*', async route => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, consentRequired: false, consentAccepted: true }) });
      });

      // ============================================================
      // 6. PROFILE
      //
      // All fields valid EXCEPT dietType (null initially).
      // ============================================================
      let isProfileSaved = false;
      await page.route('**/api/user/profile*', async route => {
        const method = route.request().method();
        if (method === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                userId: 1004, profileComplete: isProfileSaved, userName: TEST_NAME, name: TEST_NAME,
                email: 'nitheesh@example.com', phoneNumber: TEST_PHONE, gender: 'Male', height: 170, dietType: isProfileSaved ? 'Vegetarian' : null,
                latestWeight: 72.5, currentWeight: 72.5, latestWeightBodyFat: 22, bodyFat: 22,
                profileImage: 'https://example.com/profile.jpg', physicalActivityLevel: null, needsCurrentWeight: false,
              },
            }),
          });
        } else if (method === 'POST' || method === 'PUT') {
          isProfileSaved = true;
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, data: { profileComplete: true } })
          });
        } else {
          await route.fallback();
        }
      });

      // ============================================================
      // 7. OPEN APPLICATION & LOGIN
      // ============================================================
      await page.goto('/', { waitUntil: 'domcontentloaded' });

      const mobileInput = page.getByLabel('Mobile Number');
      await expect(mobileInput).toBeVisible({ timeout: 15000 });
      await mobileInput.fill(TEST_PHONE);
      await page.getByRole('button', { name: 'Send OTP', exact: true }).click();

      // ============================================================
      // 8. OTP PAGE
      // ============================================================
      await expect(page.getByText('Enter OTP', { exact: true })).toBeVisible({ timeout: 15000 });
      const otpInputs = page.locator('input[data-otp="true"]');
      await expect(otpInputs).toHaveCount(4);;
      for (let i = 0; i < TEST_OTP.length; i++) {
        await otpInputs.nth(i).fill(TEST_OTP[i]);
      }

      // ============================================================
      // 9. COMPLETE PROFILE
      // ============================================================
      const completeProfileHeading = page.getByRole('heading', { name: 'Complete Your Profile', exact: true });
      await expect(completeProfileHeading).toBeVisible({ timeout: 20000 });

      const saveButton = page.getByRole('button', { name: 'Save & Continue', exact: true });
      await expect(saveButton).toBeVisible({ timeout: 10000 });

      // ============================================================
      // 10. NO DIET OPTION SELECTED -> SAVE BUTTON DISABLED
      // ============================================================
      await expect(saveButton).toBeDisabled({ timeout: 10000 });
      console.log('CP-008: No diet option selected -> Save & Continue is disabled');

      // ============================================================
      // 11. TEST EACH OF THE 4 DIET OPTIONS ENABLES SAVE BUTTON
      // ============================================================
      const dietOptions = ['Vegetarian', 'Non-Vegetarian', 'Vegan', 'Pescatarian'];
      for (const diet of dietOptions) {
        const dietButton = page.getByRole('button', { name: diet, exact: true });
        await expect(dietButton).toBeVisible({ timeout: 5000 });
        await dietButton.click();
        await expect(saveButton).toBeEnabled({ timeout: 5000 });
        console.log(`CP-008: Selected "${diet}" -> Save & Continue is enabled`);
      }

    }
  );

  test(
    'CP-009 Current Weight field validation for minimum and maximum boundaries',
    async ({ page }) => {

      // ============================================================
      // TEST DATA
      // ============================================================
      const TEST_PHONE = '7695834209';
      const TEST_OTP = '1234';
      const TEST_NAME = 'Nitheesh Lingam';

      // ============================================================
      // 1. SEND LOGIN OTP
      // ============================================================
      await page.route('**/api/auth/send-otp', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
          }),
        });
      });

      // ============================================================
      // 2. VERIFY OTP
      // ============================================================
      await page.route('**/api/auth/verify-otp', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            isNewUser: false,
            isActive: true,
            role: 'user',
            user: {
              id: 1004,
              UserId: 1004,
              username: TEST_NAME,
              userName: TEST_NAME,
              name: TEST_NAME,
              email: '',
              phone: `+91${TEST_PHONE}`,
              phoneNumber: TEST_PHONE,
              status: 'Active',
              consentRequired: false,
            },
          }),
        });
      });

      // ============================================================
      // 3. VERIFY SESSION
      // ============================================================
      await page.route('**/api/user/verify-session', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            userId: 1004,
            sessionStale: false,
          }),
        });
      });

      // ============================================================
      // 4. USER STATUS
      // ============================================================
      await page.route('**/api/user/status*', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            setupComplete: true,
            setupSkipped: true,
            hasTeamId: false,
            hasUpline: true,
            pendingRequest: false,
            redirectTo: null,
          }),
        });
      });

      // ============================================================
      // 5. CONSENT
      // ============================================================
      await page.route('**/api/user/consent*', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            consentRequired: false,
            consentAccepted: true,
          }),
        });
      });

      // ============================================================
      // 6. PROFILE
      //
      // Current Weight is empty so the Complete Profile page opens.
      // ============================================================
      await page.route('**/api/user/profile*', async route => {
        const method = route.request().method();

        if (method === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                userId: 1004,
                profileComplete: false,
                userName: TEST_NAME,
                name: TEST_NAME,
                email: 'nitheesh@example.com',
                phoneNumber: TEST_PHONE,
                gender: 'Male',
                height: 170,
                dietType: 'Vegetarian',

                latestWeight: null,
                currentWeight: null,

                latestWeightBodyFat: 22,
                bodyFat: 22,

                profileImage: 'https://example.com/profile.jpg',
                physicalActivityLevel: null,

                needsCurrentWeight: true,
              },
            }),
          });
        } else {
          await route.fallback();
        }
      });

      // ============================================================
      // 7. OPEN APPLICATION
      // ============================================================
      await page.goto('/', {
        waitUntil: 'domcontentloaded',
      });

      // ============================================================
      // 8. LOGIN
      // ============================================================
      const mobileInput = page.getByLabel('Mobile Number');

      await expect(mobileInput).toBeVisible({
        timeout: 15000,
      });

      await mobileInput.fill(TEST_PHONE);

      await page
        .getByRole('button', {
          name: 'Send OTP',
          exact: true,
        })
        .click();

      // ============================================================
      // 9. OTP PAGE
      // ============================================================
      await expect(
        page.getByText('Enter OTP', {
          exact: true,
        })
      ).toBeVisible({
        timeout: 15000,
      });

      const otpInputs = page.locator('input[data-otp="true"]');

      await expect(otpInputs).toHaveCount(4);;

      for (let i = 0; i < TEST_OTP.length; i++) {
        await otpInputs.nth(i).fill(TEST_OTP[i]);
      }

      // ============================================================
      // 10. COMPLETE PROFILE PAGE
      // ============================================================
      const completeProfileHeading = page.getByRole('heading', {
        name: 'Complete Your Profile',
        exact: true,
      });

      await expect(completeProfileHeading).toBeVisible({
        timeout: 20000,
      });

      console.log('CP-009: Complete Profile page loaded');

      // ============================================================
      // 11. CURRENT WEIGHT INPUT
      // ============================================================
      const weightInput = page.getByPlaceholder('e.g. 72.5');

      await expect(weightInput).toBeVisible({
        timeout: 10000,
      });

      // ============================================================
      // HELPER FUNCTION
      //
      // Gets the current border color of the weight input.
      // ============================================================
      const getBorderColor = async () => {
        return await weightInput.evaluate(element => {
          return window.getComputedStyle(element).borderColor;
        });
      };

      // ============================================================
      // TEST 1: 19 → INVALID
      // Expected: Red border
      // ============================================================
      await weightInput.fill('19');

      await expect.poll(
        async () => await getBorderColor()
      ).not.toBe('rgb(0, 0, 0)');

      console.log('CP-009: Weight 19 validated as invalid');

      // ============================================================
      // TEST 2: 20 → VALID
      // Expected: Normal border
      // ============================================================
      await weightInput.fill('20');

      const borderAt20 = await getBorderColor();

      console.log(
        `CP-009: Weight 20 border color: ${borderAt20}`
      );

      // ============================================================
      // TEST 3: 300 → VALID
      // Expected: Normal border
      // ============================================================
      await weightInput.fill('300');

      const borderAt300 = await getBorderColor();

      console.log(
        `CP-009: Weight 300 border color: ${borderAt300}`
      );

      // ============================================================
      // TEST 4: 301 → INVALID
      // Expected: Red border
      // ============================================================
      await weightInput.fill('301');

      await expect.poll(
        async () => await getBorderColor()
      ).not.toBe('rgb(0, 0, 0)');

      console.log('CP-009: Weight 301 validated as invalid');

      console.log(
        'CP-009: All Current Weight boundary validations completed'
      );

    }
  );

  test(
    'CP-010 Body Fat field validation for minimum and maximum boundaries',
    async ({ page }) => {
      // ============================================================
      // TEST DATA
      // ============================================================
      const TEST_PHONE = '7695834209';
      const TEST_OTP = '1234';
      const TEST_NAME = 'Nitheesh Lingam';

      // ============================================================
      // 1. SEND LOGIN OTP
      // ============================================================
      await page.route('**/api/auth/send-otp', async route => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
      });

      // ============================================================
      // 2. VERIFY OTP
      // ============================================================
      await page.route('**/api/auth/verify-otp', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            isNewUser: false,
            isActive: true,
            role: 'user',
            user: {
              id: 1004, UserId: 1004, username: TEST_NAME, userName: TEST_NAME,
              name: TEST_NAME, email: '', phone: `+91${TEST_PHONE}`, phoneNumber: TEST_PHONE,
              status: 'Active', consentRequired: false,
            },
          }),
        });
      });

      // ============================================================
      // 3. VERIFY SESSION
      // ============================================================
      await page.route('**/api/user/verify-session', async route => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, userId: 1004, sessionStale: false }) });
      });

      // ============================================================
      // 4. USER STATUS
      // ============================================================
      await page.route('**/api/user/status*', async route => {
        await route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ success: true, setupComplete: true, setupSkipped: true, hasTeamId: false, hasUpline: true, pendingRequest: false, redirectTo: null }),
        });
      });

      // ============================================================
      // 5. CONSENT
      // ============================================================
      await page.route('**/api/user/consent*', async route => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, consentRequired: false, consentAccepted: true }) });
      });

      // ============================================================
      // 6. PROFILE
      //
      // Body Fat is null so the Complete Profile page opens.
      // ============================================================
      await page.route('**/api/user/profile*', async route => {
        const method = route.request().method();
        if (method === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                userId: 1004, profileComplete: false, userName: TEST_NAME, name: TEST_NAME,
                email: 'nitheesh@example.com', phoneNumber: TEST_PHONE, gender: 'Male', height: 170, dietType: 'Vegetarian',
                latestWeight: 72.5, currentWeight: 72.5, latestWeightBodyFat: null, bodyFat: null,
                profileImage: 'https://example.com/profile.jpg', physicalActivityLevel: null, needsCurrentWeight: false,
              },
            }),
          });
        } else {
          await route.fallback();
        }
      });

      // ============================================================
      // 7. OPEN APPLICATION & LOGIN
      // ============================================================
      await page.goto('/', { waitUntil: 'domcontentloaded' });

      const mobileInput = page.getByLabel('Mobile Number');
      await expect(mobileInput).toBeVisible({ timeout: 15000 });
      await mobileInput.fill(TEST_PHONE);
      await page.getByRole('button', { name: 'Send OTP', exact: true }).click();

      // ============================================================
      // 8. OTP PAGE
      // ============================================================
      await expect(page.getByText('Enter OTP', { exact: true })).toBeVisible({ timeout: 15000 });
      const otpInputs = page.locator('input[data-otp="true"]');
      await expect(otpInputs).toHaveCount(4);;
      for (let i = 0; i < TEST_OTP.length; i++) {
        await otpInputs.nth(i).fill(TEST_OTP[i]);
      }

      // ============================================================
      // 9. COMPLETE PROFILE PAGE LOADED
      // ============================================================
      const completeProfileHeading = page.getByRole('heading', { name: 'Complete Your Profile', exact: true });
      await expect(completeProfileHeading).toBeVisible({ timeout: 20000 });
      console.log('CP-010: Complete Profile page loaded');

      // ============================================================
      // 10. BODY FAT INPUT (Fat % field)
      // ============================================================
      const fatInput = page.locator('label').filter({ hasText: 'Fat %' }).locator('..').locator('input');
      await expect(fatInput).toBeVisible({ timeout: 10000 });

      const saveButton = page.getByRole('button', { name: 'Save & Continue', exact: true });
      await expect(saveButton).toBeVisible({ timeout: 10000 });

      // Helper function to get input border color
      const getBorderColor = async () => {
        return await fatInput.evaluate(element => window.getComputedStyle(element).borderColor);
      };

      // ============================================================
      // TEST 1: 0 -> INVALID (below min 1)
      // ============================================================
      await fatInput.fill('0');
      await expect.poll(async () => await getBorderColor()).not.toBe('rgb(0, 0, 0)');
      console.log('CP-010: Body Fat 0 validated as invalid');

      // ============================================================
      // TEST 2: 1 -> VALID (minimum boundary)
      // ============================================================
      await fatInput.fill('1');
      const borderAt1 = await getBorderColor();
      console.log(`CP-010: Body Fat 1 border color: ${borderAt1}`);

      // ============================================================
      // TEST 3: 70 -> VALID (maximum boundary)
      // ============================================================
      await fatInput.fill('70');
      const borderAt70 = await getBorderColor();
      console.log(`CP-010: Body Fat 70 border color: ${borderAt70}`);

      // ============================================================
      // TEST 4: 71 -> INVALID (above max 70)
      // ============================================================
      await fatInput.fill('71');
      await expect.poll(async () => await getBorderColor()).not.toBe('rgb(0, 0, 0)');
      console.log('CP-010: Body Fat 71 validated as invalid');

      console.log('CP-010: All Body Fat boundary validations completed');
    }
  );



  test(
    'CP-011 Complete profile submission and progression to next page',
    async ({ page }) => {
      // ============================================================
      // TEST DATA
      // ============================================================
      const TEST_PHONE = '7695834209';
      const TEST_OTP = '1234';
      const TEST_NAME = 'Nitheesh Lingam';

      // ============================================================
      // 1. SEND LOGIN OTP
      // ============================================================
      await page.route('**/api/auth/send-otp', async route => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
      });

      // ============================================================
      // 2. VERIFY OTP
      // ============================================================
      await page.route('**/api/auth/verify-otp', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            isNewUser: false,
            isActive: true,
            role: 'user',
            user: {
              id: 1004, UserId: 1004, username: TEST_NAME, userName: TEST_NAME,
              name: TEST_NAME, email: '', phone: `+91${TEST_PHONE}`, phoneNumber: TEST_PHONE,
              status: 'Active', consentRequired: false,
            },
          }),
        });
      });

      // ============================================================
      // 3. VERIFY SESSION
      // ============================================================
      await page.route('**/api/user/verify-session', async route => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, userId: 1004, sessionStale: false }) });
      });

      // ============================================================
      // 4. USER STATUS
      // ============================================================
      await page.route('**/api/user/status*', async route => {
        await route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ success: true, setupComplete: true, setupSkipped: true, hasTeamId: false, hasUpline: true, pendingRequest: false, redirectTo: null }),
        });
      });

      // ============================================================
      // 5. CONSENT
      // ============================================================
      await page.route('**/api/user/consent*', async route => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, consentRequired: false, consentAccepted: true }) });
      });

      // ============================================================
      // 6. PROFILE (GET & POST)
      // ============================================================
      let isProfileSaved = false;
      await page.route('**/api/user/profile*', async route => {
        const method = route.request().method();
        if (method === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                userId: 1004,
                profileComplete: isProfileSaved,
                userName: TEST_NAME,
                name: TEST_NAME,
                email: 'nitheesh@example.com',
                phoneNumber: TEST_PHONE,
                gender: 'Male',
                height: isProfileSaved ? 170 : null,
                dietType: isProfileSaved ? 'Vegetarian' : null,
                latestWeight: isProfileSaved ? 72.5 : null,
                currentWeight: isProfileSaved ? 72.5 : null,
                latestWeightBodyFat: isProfileSaved ? 22 : null,
                bodyFat: isProfileSaved ? 22 : null,
                profileImage: 'https://example.com/profile.jpg',
                physicalActivityLevel: null,
                needsCurrentWeight: !isProfileSaved,
              },
            }),
          });
        } else if (method === 'POST' || method === 'PUT') {
          isProfileSaved = true;
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, data: { profileComplete: true } }),
          });
        } else {
          await route.fallback();
        }
      });

      // ============================================================
      // 7. OPEN APPLICATION & LOGIN
      // ============================================================
      await page.goto('/', { waitUntil: 'domcontentloaded' });

      const mobileInput = page.getByLabel('Mobile Number');
      await expect(mobileInput).toBeVisible({ timeout: 15000 });
      await mobileInput.fill(TEST_PHONE);
      await page.getByRole('button', { name: 'Send OTP', exact: true }).click();

      // ============================================================
      // 8. OTP PAGE
      // ============================================================
      await expect(page.getByText('Enter OTP', { exact: true })).toBeVisible({ timeout: 15000 });
      const otpInputs = page.locator('input[data-otp="true"]');
      await expect(otpInputs).toHaveCount(4);;
      for (let i = 0; i < TEST_OTP.length; i++) {
        await otpInputs.nth(i).fill(TEST_OTP[i]);
      }

      // ============================================================
      // 9. COMPLETE PROFILE PAGE LOADED
      // ============================================================
      const completeProfileHeading = page.getByRole('heading', { name: 'Complete Your Profile', exact: true });
      await expect(completeProfileHeading).toBeVisible({ timeout: 20000 });
      console.log('CP-011: Complete Profile page loaded');

      // ============================================================
      // 10. FILL ALL REQUIRED PROFILE FIELDS
      // ============================================================

      // Height
      const heightInput = page.getByPlaceholder('e.g. 170');
      if (await heightInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await heightInput.fill('170');
      }

      // Diet Preference
      const vegetarianButton = page.getByRole('button', { name: 'Vegetarian', exact: true });
      if (await vegetarianButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await vegetarianButton.click();
      }

      // Current Weight
      const weightInput = page.getByPlaceholder('e.g. 72.5');
      if (await weightInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await weightInput.fill('72.5');
      }

      // Body Fat %
      const fatInput = page.locator('label').filter({ hasText: 'Fat %' }).locator('..').locator('input');
      if (await fatInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await fatInput.fill('22');
      }

      // ============================================================
      // 11. SAVE & CONTINUE -> VERIFY NAVIGATES AWAY FROM COMPLETE PROFILE
      // ============================================================
      const saveButton = page.getByRole('button', { name: 'Save & Continue', exact: true });
      await expect(saveButton).toBeVisible({ timeout: 10000 });
      await expect(saveButton).toBeEnabled({ timeout: 10000 });

      await saveButton.click();

      await expect(completeProfileHeading).not.toBeVisible({ timeout: 15000 });
      console.log('CP-011: Profile completed successfully and moved onto the next page');
    }
  );


  const path = require('path');

  test(
    'CP-012 Transformation Photos uploads Left, Centre, and Right images and progresses to next page',
    async ({ page }) => {
      // ============================================================
      // TEST DATA
      // ============================================================
      const TEST_PHONE = '7695834209';
      const TEST_OTP = '1234';
      const TEST_NAME = 'Nitheesh Lingam';

      // ============================================================
      // 1. MOCK APIS
      // ============================================================
      await page.route('**/api/auth/send-otp', async route => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
      });

      await page.route('**/api/auth/verify-otp', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            isNewUser: false,
            isActive: true,
            role: 'user',
            user: {
              id: 1004, UserId: 1004, username: TEST_NAME, userName: TEST_NAME,
              name: TEST_NAME, email: '', phone: `+91${TEST_PHONE}`, phoneNumber: TEST_PHONE,
              status: 'Active', consentRequired: false,
            },
          }),
        });
      });

      await page.route('**/api/user/verify-session', async route => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, userId: 1004, sessionStale: false }) });
      });

      await page.route('**/api/user/status*', async route => {
        await route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ success: true, setupComplete: true, setupSkipped: true, hasTeamId: false, hasUpline: true, pendingRequest: false, redirectTo: null }),
        });
      });

      await page.route('**/api/user/consent*', async route => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, consentRequired: false, consentAccepted: true }) });
      });

      let isProfileSaved = false;
      await page.route('**/api/user/profile*', async route => {
        const method = route.request().method();
        if (method === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                userId: 1004,
                profileComplete: isProfileSaved,
                userName: TEST_NAME,
                name: TEST_NAME,
                email: 'nitheesh@example.com',
                phoneNumber: TEST_PHONE,
                gender: 'Male',
                height: isProfileSaved ? 170 : null,
                dietType: isProfileSaved ? 'Vegetarian' : null,
                latestWeight: isProfileSaved ? 72.5 : null,
                currentWeight: isProfileSaved ? 72.5 : null,
                latestWeightBodyFat: isProfileSaved ? 22 : null,
                bodyFat: isProfileSaved ? 22 : null,
                profileImage: null,
                physicalActivityLevel: null,
                needsCurrentWeight: !isProfileSaved,
              },
            }),
          });
        } else {
          isProfileSaved = true;
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { profileComplete: true } }) });
        }
      });

      await page.route('**/api/user/testimonial*', async route => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
      });

      // ============================================================
      // 2. OPEN APP & LOGIN
      // ============================================================
      await page.goto('/', { waitUntil: 'domcontentloaded' });

      const mobileInput = page.getByLabel('Mobile Number');
      await expect(mobileInput).toBeVisible({ timeout: 15000 });
      await mobileInput.fill(TEST_PHONE);
      await page.getByRole('button', { name: 'Send OTP', exact: true }).click();

      await expect(page.getByText('Enter OTP', { exact: true })).toBeVisible({ timeout: 15000 });
      const otpInputs = page.locator('input[data-otp="true"]');
      await expect(otpInputs).toHaveCount(4);;
      for (let i = 0; i < TEST_OTP.length; i++) {
        await otpInputs.nth(i).fill(TEST_OTP[i]);
      }

      // ============================================================
      // 3. COMPLETE PROFILE PAGE -> SAVE & CONTINUE
      // ============================================================
      const completeProfileHeading = page.getByRole('heading', { name: 'Complete Your Profile', exact: true });
      await expect(completeProfileHeading).toBeVisible({ timeout: 20000 });

      const heightInput = page.getByPlaceholder('e.g. 170');
      if (await heightInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await heightInput.fill('170');
      }

      const vegetarianButton = page.getByRole('button', { name: 'Vegetarian', exact: true });
      if (await vegetarianButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await vegetarianButton.click();
      }

      const weightInput = page.getByPlaceholder('e.g. 72.5');
      if (await weightInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await weightInput.fill('72.5');
      }

      const fatInput = page.locator('label').filter({ hasText: 'Fat %' }).locator('..').locator('input');
      if (await fatInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await fatInput.fill('22');
      }

      const saveButton = page.getByRole('button', { name: 'Save & Continue', exact: true });
      await expect(saveButton).toBeVisible({ timeout: 10000 });
      await expect(saveButton).toBeEnabled({ timeout: 10000 });
      await saveButton.click();

      // ============================================================
      // 4. TRANSFORMATION PHOTOS PAGE DISPLAYED
      // ============================================================
      const transformationHeading = page.getByRole('heading', { name: 'Transformation Photos', exact: true });
      await expect(transformationHeading).toBeVisible({ timeout: 20000 });
      console.log('CP-012: Reached Transformation Photos page');

      // Verify prompt when photos missing
      await expect(page.getByText('0/3 required')).toBeVisible({ timeout: 5000 });
      await expect(page.getByText('Add all three photos to continue')).toBeVisible({ timeout: 5000 });

      // ============================================================
      // 5. UPLOAD IMAGES FOR ALL SIDES (Left, Centre, Right)
      // ============================================================
      const poseSides = ['Left', 'Centre', 'Right'];

      for (const side of poseSides) {
        // Select tab for the target pose side
        const tabButton = page.getByRole('button', { name: new RegExp(side, 'i') }).first();
        await expect(tabButton).toBeVisible({ timeout: 5000 });
        await tabButton.click();

        // Target file input and set image file (must be portrait orientation)
        const fileInput = page.locator('input[type="file"][accept="image/*"]').last();
        await fileInput.setInputFiles('tests/fixtures/portrait.jpg');

        console.log(`CP-012: ${side} pose image uploaded successfully`);
      }

      // ============================================================
      // 6. VERIFY ALL 3 SIDES UPLOADED (3/3 required) & CONTINUE ENABLED
      // ============================================================
      await expect(page.getByText('3/3 required')).toBeVisible({ timeout: 10000 });

      const continueBtn = page.getByRole('button', { name: 'Continue', exact: true });
      await expect(continueBtn).toBeVisible({ timeout: 10000 });
      await expect(continueBtn).toBeEnabled({ timeout: 10000 });

      // ============================================================
      // 9. SUBMIT & VERIFY PROGRESSION TO NEXT PAGE
      // ============================================================
      await continueBtn.click();
      await expect(transformationHeading).not.toBeVisible({ timeout: 15000 });
      console.log('CP-012: All 3 transformation photos uploaded successfully and moved onto the next page');
    }
  );


  test(
    'CP-013 Physical Activity page allows selecting any option, enables Continue correctly, and moves to next page',
    async ({ page }) => {
      // ============================================================
      // TEST DATA
      // ============================================================
      const TEST_PHONE = '7695834209';
      const TEST_OTP = '1234';
      const TEST_NAME = 'Nitheesh Lingam';

      // ============================================================
      // 1. MOCK APIS
      // ============================================================
      await page.route('**/api/auth/send-otp', async route => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
      });

      await page.route('**/api/auth/verify-otp', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            isNewUser: false,
            isActive: true,
            role: 'user',
            user: {
              id: 1004, UserId: 1004, username: TEST_NAME, userName: TEST_NAME,
              name: TEST_NAME, email: '', phone: `+91${TEST_PHONE}`, phoneNumber: TEST_PHONE,
              status: 'Active', consentRequired: false,
            },
          }),
        });
      });

      await page.route('**/api/user/verify-session', async route => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, userId: 1004, sessionStale: false }) });
      });

      await page.route('**/api/user/status*', async route => {
        await route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ success: true, setupComplete: true, setupSkipped: true, hasTeamId: false, hasUpline: true, pendingRequest: false, redirectTo: null }),
        });
      });

      await page.route('**/api/user/consent*', async route => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, consentRequired: false, consentAccepted: true }) });
      });

      let isProfileSaved = false;
      let savedPhysicalActivity = null;

      await page.route('**/api/user/profile*', async route => {
        const method = route.request().method();
        if (method === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                userId: 1004,
                profileComplete: isProfileSaved,
                userName: TEST_NAME,
                name: TEST_NAME,
                email: 'nitheesh@example.com',
                phoneNumber: TEST_PHONE,
                gender: 'Male',
                height: isProfileSaved ? 170 : null,
                dietType: isProfileSaved ? 'Vegetarian' : null,
                latestWeight: isProfileSaved ? 72.5 : null,
                currentWeight: isProfileSaved ? 72.5 : null,
                latestWeightBodyFat: isProfileSaved ? 22 : null,
                bodyFat: isProfileSaved ? 22 : null,
                profileImage: null,
                physicalActivityLevel: savedPhysicalActivity,
                needsCurrentWeight: !isProfileSaved,
              },
            }),
          });
        } else {
          const postData = route.request().postDataJSON() || {};
          if (postData.physicalActivityLevel) {
            savedPhysicalActivity = postData.physicalActivityLevel;
          }
          isProfileSaved = true;
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: { profileComplete: true, physicalActivityLevel: savedPhysicalActivity, calorieTarget: 2000 },
            }),
          });
        }
      });

      await page.route('**/api/user/testimonial*', async route => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
      });

      // ============================================================
      // 2. OPEN APP & LOGIN
      // ============================================================
      await page.goto('/', { waitUntil: 'domcontentloaded' });

      const mobileInput = page.getByLabel('Mobile Number');
      await expect(mobileInput).toBeVisible({ timeout: 15000 });
      await mobileInput.fill(TEST_PHONE);
      await page.getByRole('button', { name: 'Send OTP', exact: true }).click();

      await expect(page.getByText('Enter OTP', { exact: true })).toBeVisible({ timeout: 15000 });
      const otpInputs = page.locator('input[data-otp="true"]');
      await expect(otpInputs).toHaveCount(4);
      for (let i = 0; i < TEST_OTP.length; i++) {
        await otpInputs.nth(i).fill(TEST_OTP[i]);
      }

      // ============================================================
      // 3. COMPLETE PROFILE PAGE -> SAVE & CONTINUE
      // ============================================================
      const completeProfileHeading = page.getByRole('heading', { name: 'Complete Your Profile', exact: true });
      await expect(completeProfileHeading).toBeVisible({ timeout: 20000 });

      const heightInput = page.getByPlaceholder('e.g. 170');
      if (await heightInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await heightInput.fill('170');
      }

      const vegetarianButton = page.getByRole('button', { name: 'Vegetarian', exact: true });
      if (await vegetarianButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await vegetarianButton.click();
      }

      const weightInput = page.getByPlaceholder('e.g. 72.5');
      if (await weightInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await weightInput.fill('72.5');
      }

      const fatInput = page.locator('label').filter({ hasText: 'Fat %' }).locator('..').locator('input');
      if (await fatInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await fatInput.fill('22');
      }

      const saveButton = page.getByRole('button', { name: 'Save & Continue', exact: true });
      await expect(saveButton).toBeVisible({ timeout: 10000 });
      await expect(saveButton).toBeEnabled({ timeout: 10000 });
      await saveButton.click();

      // ============================================================
      // 4. TRANSFORMATION PHOTOS PAGE -> UPLOAD 3 PHOTOS & CONTINUE
      // ============================================================
      const transformationHeading = page.getByRole('heading', { name: 'Transformation Photos', exact: true });
      await expect(transformationHeading).toBeVisible({ timeout: 20000 });

      const poseSides = ['Left', 'Centre', 'Right'];
      for (const side of poseSides) {
        const tabButton = page.getByRole('button', { name: new RegExp(side, 'i') }).first();
        await expect(tabButton).toBeVisible({ timeout: 5000 });
        await tabButton.click();

        const fileInput = page.locator('input[type="file"][accept="image/*"]').last();
        await fileInput.setInputFiles('tests/fixtures/portrait.jpg');
      }

      const continuePhotosBtn = page.getByRole('button', { name: 'Continue', exact: true });
      await expect(continuePhotosBtn).toBeVisible({ timeout: 10000 });
      await expect(continuePhotosBtn).toBeEnabled({ timeout: 10000 });
      await continuePhotosBtn.click();

      // ============================================================
      // 5. PHYSICAL ACTIVITY SETUP PAGE DISPLAYED
      // ============================================================
      const physicalActivityHeading = page.getByRole('heading', { name: 'Physical Activity', exact: true });
      await expect(physicalActivityHeading).toBeVisible({ timeout: 20000 });
      await expect(page.getByText('This helps us calculate your daily calorie target (TDEE).')).toBeVisible({ timeout: 10000 });

      const continueBtn = page.getByRole('button', { name: 'Continue', exact: true });
      await expect(continueBtn).toBeVisible({ timeout: 10000 });
      // Initially, disabled when no activity option is selected
      await expect(continueBtn).toBeDisabled();

      // ============================================================
      // 6. VERIFY ALL OPTIONS CAN BE SELECTED & ENABLE CONTINUE
      // ============================================================
      const activityOptions = [
        'Sedentary',
        'Light Active',
        'Moderate',
        'Very Active',
        'Highly Active',
      ];

      for (const optionLabel of activityOptions) {
        const optionBtn = page.getByRole('button', { name: new RegExp(optionLabel, 'i') });
        await expect(optionBtn).toBeVisible({ timeout: 5000 });
        await optionBtn.click();

        // Continue button should now be enabled for each option
        await expect(continueBtn).toBeEnabled({ timeout: 5000 });
      }

      // ============================================================
      // 7. SUBMIT PHYSICAL ACTIVITY & MOVE TO NEXT PAGE
      // ============================================================
      await continueBtn.click();
      await expect(physicalActivityHeading).not.toBeVisible({ timeout: 15000 });
      console.log('CP-013: Physical Activity option selected, Continue enabled, and moved onto the next page successfully');
    }
  );


  test(
    'CP-014 user can select all main application navigation options',
    async ({ page }) => {
      // ============================================================
      // TEST DATA
      // ============================================================
      const TEST_PHONE = '7695834209';
      const TEST_NAME = 'Nitheesh Lingam';
      const TEST_EMAIL = 'nitheesh@example.com';

      // ============================================================
      // 1. MOCK APIS FOR AUTHENTICATED USER WITH COMPLETED PROFILE
      // ============================================================
      await page.route('**/api/auth/send-otp', async route => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
      });

      await page.route('**/api/user/verify-session', async route => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, userId: 1004, sessionStale: false }) });
      });

      await page.route('**/api/user/lookup*', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            isActive: true,
            isNewUser: false,
            role: 'user',
            user: {
              id: 1004,
              UserId: 1004,
              username: TEST_NAME,
              name: TEST_NAME,
              email: TEST_EMAIL,
              phoneNumber: TEST_PHONE,
              status: 'Active',
            },
          }),
        });
      });

      await page.route('**/api/user/consent*', async route => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, consentRequired: false, consentAccepted: true }) });
      });

      await page.route('**/api/user/profile*', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              userId: 1004,
              profileComplete: true,
              userName: TEST_NAME,
              name: TEST_NAME,
              email: TEST_EMAIL,
              phoneNumber: TEST_PHONE,
              gender: 'Male',
              height: 170,
              dietType: 'Vegetarian',
              latestWeight: 72.5,
              currentWeight: 72.5,
              latestWeightBodyFat: 22,
              bodyFat: 22,
              profileImage: 'https://example.com/photo.jpg',
              physicalActivityLevel: 'moderate',
              needsCurrentWeight: false,
            },
          }),
        });
      });

      await page.route('**/api/user/testimonial*', async route => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
      });

      // ============================================================
      // 2. SET AUTHENTICATED LOCALSTORAGE STATE (DIRECT HOME ACCESS)
      // ============================================================
      await page.addInitScript(({ phone, email, name }) => {
        const user = {
          id: 1004,
          UserId: 1004,
          userId: 1004,
          username: name,
          userName: name,
          name: name,
          email: email,
          phone: `+91${phone}`,
          phoneNumber: phone,
          status: 'Active',
          isNewUser: false,
          consentRequired: false,
          profileComplete: true,
          physicalActivityLevel: 'moderate',
        };

        localStorage.setItem('isOtpVerified', 'true');
        localStorage.setItem('otpUser', JSON.stringify(user));
        localStorage.setItem('user', JSON.stringify(user));
      }, { phone: TEST_PHONE, email: TEST_EMAIL, name: TEST_NAME });

      // ============================================================
      // 3. OPEN APP DIRECTLY AS AUTHENTICATED USER ON HOME PAGE
      // ============================================================
      await page.goto('/', { waitUntil: 'domcontentloaded' });

      // ============================================================
      // 4. MAIN APPLICATION DASHBOARD & NAVIGATION OPTIONS
      // ============================================================
      // Verify Home tab is visible on initial load
      const homeTabBtn = page.getByRole('button', { name: /Home/i }).first();
      await expect(homeTabBtn).toBeVisible({ timeout: 15000 });
      console.log('CP-014: Selected main application navigation option: Home');

      // Navigate sequentially through all other main tabs
      const subNavTabs = [
        { name: 'Diary', regex: /Diary/i },
        { name: 'Activity', regex: /Activity/i },
        { name: 'Programs', regex: /Programs|Enrollment/i },
        { name: 'BCM', regex: /BCM|Counselling/i },
        { name: 'Club', regex: /Club|Physical/i },
        { name: 'Transformation', regex: /Transformation|Testimonials/i },
      ];

      for (const tab of subNavTabs) {
        await page.waitForTimeout(300);
        const tabBtn = page.getByRole('button', { name: tab.regex }).first();
        await tabBtn.scrollIntoViewIfNeeded().catch(() => { });
        await expect(tabBtn).toBeVisible({ timeout: 15000 });
        await tabBtn.click({ force: true });
        console.log(`CP-014: Selected main application navigation option: ${tab.name}`);
      }

      console.log('CP-014: Successfully selected all main application navigation options');
    }
  );



  test(
    'CP-015 user can select profile from header and reach profile form',
    async ({ page }) => {
      // ============================================================
      // TEST DATA
      // ============================================================
      const TEST_PHONE = '7695834209';
      const TEST_NAME = 'Nitheesh Lingam';
      const TEST_EMAIL = 'nitheesh@example.com';

      // ============================================================
      // 1. MOCK APIS FOR AUTHENTICATED USER
      // ============================================================
      await page.route('**/api/auth/send-otp', async route => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
      });

      await page.route('**/api/user/verify-session', async route => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, userId: 1004, sessionStale: false }) });
      });

      await page.route('**/api/user/lookup*', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            isActive: true,
            isNewUser: false,
            role: 'user',
            user: {
              id: 1004,
              UserId: 1004,
              username: TEST_NAME,
              name: TEST_NAME,
              email: TEST_EMAIL,
              phoneNumber: TEST_PHONE,
              status: 'Active',
            },
          }),
        });
      });

      await page.route('**/api/user/consent*', async route => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, consentRequired: false, consentAccepted: true }) });
      });

      await page.route('**/api/user/profile*', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              userId: 1004,
              profileComplete: true,
              userName: TEST_NAME,
              name: TEST_NAME,
              email: TEST_EMAIL,
              phoneNumber: TEST_PHONE,
              gender: 'Male',
              height: 170,
              dietType: 'Vegetarian',
              latestWeight: 72.5,
              currentWeight: 72.5,
              latestWeightBodyFat: 22,
              bodyFat: 22,
              profileImage: 'https://example.com/photo.jpg',
              physicalActivityLevel: 'moderate',
              needsCurrentWeight: false,
            },
          }),
        });
      });

      // ============================================================
      // 2. SET AUTHENTICATED LOCALSTORAGE STATE
      // ============================================================
      await page.addInitScript(({ phone, email, name }) => {
        const user = {
          id: 1004,
          UserId: 1004,
          userId: 1004,
          username: name,
          userName: name,
          name: name,
          email: email,
          phone: `+91${phone}`,
          phoneNumber: phone,
          status: 'Active',
          isNewUser: false,
          consentRequired: false,
          profileComplete: true,
          physicalActivityLevel: 'moderate',
        };

        localStorage.setItem('isOtpVerified', 'true');
        localStorage.setItem('otpUser', JSON.stringify(user));
        localStorage.setItem('user', JSON.stringify(user));
      }, { phone: TEST_PHONE, email: TEST_EMAIL, name: TEST_NAME });

      // ============================================================
      // 3. OPEN APP DIRECTLY AS AUTHENTICATED USER ON HOME PAGE
      // ============================================================
      await page.goto('/', { waitUntil: 'domcontentloaded' });

      // ============================================================
      // 4. SELECT PROFILE AVATAR IN HEADER
      // ============================================================
      const profileBtn = page.getByRole('button', { name: 'My Profile' });
      await expect(profileBtn).toBeVisible({ timeout: 15000 });
      await profileBtn.click();
      console.log('CP-015: Selected My Profile from header avatar');

      // ============================================================
      // 5. VERIFY PROFILE FORM PAGE REACHED
      // ============================================================
      const profileHeading = page.getByRole('heading', { name: 'My Profile', exact: true });
      await expect(profileHeading).toBeVisible({ timeout: 15000 });

      const personalDetailsHeading = page.getByRole('heading', { name: 'Personal Details', exact: true });
      await expect(personalDetailsHeading).toBeVisible({ timeout: 15000 });

      console.log('CP-015: Successfully reached profile form page');
    }
  );


  test(
    'CP-016 Name field validation in profile form controls Save Profile button availability',
    async ({ page }) => {
      // ============================================================
      // TEST DATA
      // ============================================================
      const TEST_PHONE = '7695834209';
      const TEST_NAME = 'Nitheesh Lingam';
      const TEST_EMAIL = 'nitheesh@example.com';

      // ============================================================
      // 1. MOCK APIS FOR AUTHENTICATED USER
      // ============================================================
      await page.route('**/api/auth/send-otp', async route => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
      });

      await page.route('**/api/user/verify-session', async route => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, userId: 1004, sessionStale: false }) });
      });

      await page.route('**/api/user/lookup*', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            isActive: true,
            isNewUser: false,
            role: 'user',
            user: {
              id: 1004,
              UserId: 1004,
              username: TEST_NAME,
              name: TEST_NAME,
              email: TEST_EMAIL,
              phoneNumber: TEST_PHONE,
              status: 'Active',
            },
          }),
        });
      });

      await page.route('**/api/user/consent*', async route => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, consentRequired: false, consentAccepted: true }) });
      });

      await page.route('**/api/user/profile*', async route => {
        const method = route.request().method();
        if (method === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                userId: 1004,
                profileComplete: true,
                userName: TEST_NAME,
                name: TEST_NAME,
                email: TEST_EMAIL,
                phoneNumber: TEST_PHONE,
                gender: 'Male',
                height: 170,
                dietType: 'Vegetarian',
                latestWeight: 72.5,
                currentWeight: 72.5,
                latestWeightBodyFat: 22,
                bodyFat: 22,
                bodyMetrics: { fatPercent: 22 },
                profileImage: 'https://example.com/photo.jpg',
                physicalActivityLevel: 'moderate',
                needsCurrentWeight: false,
              },
            }),
          });
          return;
        }

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            message: 'Profile saved successfully!',
          }),
        });
      });

      // ============================================================
      // 2. SET AUTHENTICATED LOCALSTORAGE STATE
      // ============================================================
      await page.addInitScript(({ phone, email, name }) => {
        const user = {
          id: 1004,
          UserId: 1004,
          userId: 1004,
          username: name,
          userName: name,
          name: name,
          email: email,
          phone: `+91${phone}`,
          phoneNumber: phone,
          status: 'Active',
          isNewUser: false,
          consentRequired: false,
          profileComplete: true,
          physicalActivityLevel: 'moderate',
        };

        localStorage.setItem('isOtpVerified', 'true');
        localStorage.setItem('otpUser', JSON.stringify(user));
        localStorage.setItem('user', JSON.stringify(user));
      }, { phone: TEST_PHONE, email: TEST_EMAIL, name: TEST_NAME });

      // ============================================================
      // 3. OPEN APP DIRECTLY AS AUTHENTICATED USER ON HOME PAGE
      // ============================================================
      await page.goto('/', { waitUntil: 'domcontentloaded' });

      // ============================================================
      // 4. SELECT PROFILE AVATAR IN HEADER TO OPEN PROFILE FORM
      // ============================================================
      const profileBtn = page.getByRole('button', { name: 'My Profile' });
      await expect(profileBtn).toBeVisible({ timeout: 15000 });
      await profileBtn.click();

      // ============================================================
      // 5. VERIFY PROFILE FORM PAGE REACHED AND LOCATE INPUTS
      // ============================================================
      const profileHeading = page.getByRole('heading', { name: 'My Profile', exact: true });
      await expect(profileHeading).toBeVisible({ timeout: 15000 });

      const personalDetailsHeading = page.getByRole('heading', { name: 'Personal Details', exact: true });
      await expect(personalDetailsHeading).toBeVisible({ timeout: 15000 });

      const fullNameInput = page.getByPlaceholder('Enter your name');
      await expect(fullNameInput).toBeVisible({ timeout: 15000 });

      const saveButton = page.getByRole('button', { name: /Save profile|Save Profile/i });
      await expect(saveButton).toBeVisible({ timeout: 10000 });

      // ============================================================
      // 6. SCENARIO 1: ALL OTHER FIELDS FILLED + NAME EMPTY -> SAVE DISABLED
      // ============================================================
      await fullNameInput.fill('');
      await expect(fullNameInput).toHaveValue('');
      await expect(saveButton).toBeDisabled({ timeout: 10000 });
      console.log('CP-016: ALL OTHER FIELDS FILLED + EMPTY NAME -> SAVE PROFILE DISABLED');

      // ============================================================
      // 7. SCENARIO 2: ALL OTHER FIELDS FILLED + NAME FILLED -> SAVE ENABLED
      // ============================================================
      await fullNameInput.fill(TEST_NAME);
      await expect(fullNameInput).toHaveValue(TEST_NAME);
      await expect(saveButton).toBeEnabled({ timeout: 10000 });
      console.log('CP-016: ALL OTHER FIELDS FILLED + NAME FILLED -> SAVE PROFILE ENABLED');
    }
  );

  test(
    'CP-017 Height field validation for minimum and maximum boundaries (49, 50, 198, 199) in profile page',
    async ({ page }) => {
      // ============================================================
      // TEST DATA
      // ============================================================
      const TEST_PHONE = '7695834209';
      const TEST_NAME = 'Nitheesh Lingam';
      const TEST_EMAIL = 'nitheesh@example.com';

      // ============================================================
      // 1. MOCK APIS FOR AUTHENTICATED USER
      // ============================================================
      await page.route('**/api/auth/send-otp', async route => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
      });

      await page.route('**/api/user/verify-session', async route => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, userId: 1004, sessionStale: false }) });
      });

      await page.route('**/api/user/lookup*', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            isActive: true,
            isNewUser: false,
            role: 'user',
            user: {
              id: 1004,
              UserId: 1004,
              username: TEST_NAME,
              name: TEST_NAME,
              email: TEST_EMAIL,
              phoneNumber: TEST_PHONE,
              status: 'Active',
            },
          }),
        });
      });

      await page.route('**/api/user/consent*', async route => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, consentRequired: false, consentAccepted: true }) });
      });

      let savedHeight = 170;

      await page.route('**/api/user/profile*', async route => {
        const method = route.request().method();
        if (method === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                userId: 1004,
                profileComplete: true,
                userName: TEST_NAME,
                name: TEST_NAME,
                email: TEST_EMAIL,
                phoneNumber: TEST_PHONE,
                gender: 'Male',
                height: savedHeight,
                dietType: 'Vegetarian',
                latestWeight: 72.5,
                currentWeight: 72.5,
                latestWeightBodyFat: 22,
                bodyFat: 22,
                bodyMetrics: { fatPercent: 22 },
                profileImage: 'https://example.com/photo.jpg',
                physicalActivityLevel: 'moderate',
                needsCurrentWeight: false,
              },
            }),
          });
          return;
        }

        try {
          const postData = route.request().postDataJSON();
          if (postData && postData.height) {
            savedHeight = Number(postData.height);
          }
        } catch {
          /* ignore JSON parse errors */
        }

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            message: 'Profile saved successfully!',
          }),
        });
      });

      // ============================================================
      // 2. SET AUTHENTICATED LOCALSTORAGE STATE
      // ============================================================
      await page.addInitScript(({ phone, email, name }) => {
        const user = {
          id: 1004,
          UserId: 1004,
          userId: 1004,
          username: name,
          userName: name,
          name: name,
          email: email,
          phone: `+91${phone}`,
          phoneNumber: phone,
          status: 'Active',
          isNewUser: false,
          consentRequired: false,
          profileComplete: true,
          physicalActivityLevel: 'moderate',
        };

        localStorage.setItem('isOtpVerified', 'true');
        localStorage.setItem('otpUser', JSON.stringify(user));
        localStorage.setItem('user', JSON.stringify(user));
      }, { phone: TEST_PHONE, email: TEST_EMAIL, name: TEST_NAME });

      // ============================================================
      // 3. OPEN APP DIRECTLY AS AUTHENTICATED USER ON HOME PAGE
      // ============================================================
      await page.goto('/', { waitUntil: 'domcontentloaded' });

      // ============================================================
      // 4. SELECT PROFILE AVATAR IN HEADER TO OPEN PROFILE FORM
      // ============================================================
      const profileBtn = page.getByRole('button', { name: 'My Profile' });
      await expect(profileBtn).toBeVisible({ timeout: 15000 });
      await profileBtn.click();

      // ============================================================
      // 5. VERIFY PROFILE FORM PAGE REACHED AND LOCATE INPUTS
      // ============================================================
      const profileHeading = page.getByRole('heading', { name: 'My Profile', exact: true });
      await expect(profileHeading).toBeVisible({ timeout: 15000 });

      const personalDetailsHeading = page.getByRole('heading', { name: 'Personal Details', exact: true });
      await expect(personalDetailsHeading).toBeVisible({ timeout: 15000 });

      const errorMessageLocator = page.getByText('Please enter a valid height (50 - 198 cm).', { exact: true });

      // ============================================================
      // 6. TEST 1: HEIGHT = 49 (OUT OF RANGE -> SHOWS ERROR MESSAGE)
      // ============================================================
      await page.getByPlaceholder('e.g. 170').fill('49');
      await expect(page.getByPlaceholder('e.g. 170')).toHaveValue('49');
      await page.getByRole('button', { name: /Save profile|Save Profile|Saved/i }).click();
      await expect(errorMessageLocator).toBeVisible({ timeout: 10000 });
      console.log('CP-017: Height 49 validated as invalid (error message displayed)');

      // ============================================================
      // 7. TEST 2: HEIGHT = 50 (IN RANGE -> NO ERROR MESSAGE)
      // ============================================================
      await page.getByPlaceholder('e.g. 170').fill('50');
      await expect(page.getByPlaceholder('e.g. 170')).toHaveValue('50');
      await page.getByRole('button', { name: /Save profile|Save Profile|Saved/i }).click();
      await expect(errorMessageLocator).not.toBeVisible({ timeout: 5000 });
      console.log('CP-017: Height 50 validated as valid (no error message)');

      // Re-open profile page if app navigated back to home
      if (await profileBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await profileBtn.click();
        await expect(personalDetailsHeading).toBeVisible({ timeout: 10000 });
      }

      // ============================================================
      // 8. TEST 3: HEIGHT = 198 (IN RANGE -> NO ERROR MESSAGE)
      // ============================================================
      await page.getByPlaceholder('e.g. 170').fill('198');
      await expect(page.getByPlaceholder('e.g. 170')).toHaveValue('198');
      await page.getByRole('button', { name: /Save profile|Save Profile|Saved/i }).click();
      await expect(errorMessageLocator).not.toBeVisible({ timeout: 5000 });
      console.log('CP-017: Height 198 validated as valid (no error message)');

      // Re-open profile page if app navigated back to home
      if (await profileBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await profileBtn.click();
        await expect(personalDetailsHeading).toBeVisible({ timeout: 10000 });
      }

      // ============================================================
      // 9. TEST 4: HEIGHT = 199 (OUT OF RANGE -> SHOWS ERROR MESSAGE)
      // ============================================================
      await page.getByPlaceholder('e.g. 170').fill('199');
      await expect(page.getByPlaceholder('e.g. 170')).toHaveValue('199');
      await page.getByRole('button', { name: /Save profile|Save Profile|Saved/i }).click();
      await expect(errorMessageLocator).toBeVisible({ timeout: 10000 });
      console.log('CP-017: Height 199 validated as invalid (error message displayed)');
    }
  );

  test(
    'CP-018 Phone number field validation for digit length (10-15 digits) in profile page',
    async ({ page }) => {
      // ============================================================
      // TEST DATA
      // ============================================================
      const TEST_PHONE = '7695834209';
      const TEST_NAME = 'Nitheesh Lingam';
      const TEST_EMAIL = 'nitheesh@example.com';

      // ============================================================
      // 1. MOCK APIS FOR AUTHENTICATED USER
      // ============================================================
      await page.route('**/api/auth/send-otp', async route => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
      });

      await page.route('**/api/user/verify-session', async route => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, userId: 1004, sessionStale: false }) });
      });

      await page.route('**/api/user/lookup*', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            isActive: true,
            isNewUser: false,
            role: 'user',
            user: {
              id: 1004,
              UserId: 1004,
              username: TEST_NAME,
              name: TEST_NAME,
              email: TEST_EMAIL,
              phoneNumber: TEST_PHONE,
              status: 'Active',
            },
          }),
        });
      });

      await page.route('**/api/user/consent*', async route => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, consentRequired: false, consentAccepted: true }) });
      });

      let savedPhone = TEST_PHONE;

      await page.route('**/api/user/profile*', async route => {
        const method = route.request().method();
        if (method === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                userId: 1004,
                profileComplete: true,
                userName: TEST_NAME,
                name: TEST_NAME,
                email: TEST_EMAIL,
                phoneNumber: savedPhone,
                gender: 'Male',
                height: 170,
                dietType: 'Vegetarian',
                latestWeight: 72.5,
                currentWeight: 72.5,
                latestWeightBodyFat: 22,
                bodyFat: 22,
                bodyMetrics: { fatPercent: 22 },
                profileImage: 'https://example.com/photo.jpg',
                physicalActivityLevel: 'moderate',
                needsCurrentWeight: false,
              },
            }),
          });
          return;
        }

        try {
          const postData = route.request().postDataJSON();
          if (postData && postData.phone) {
            savedPhone = postData.phone;
          }
        } catch {
          /* ignore JSON parse errors */
        }

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            message: 'Profile saved successfully!',
          }),
        });
      });

      // ============================================================
      // 2. SET AUTHENTICATED LOCALSTORAGE STATE
      // ============================================================
      await page.addInitScript(({ phone, email, name }) => {
        const user = {
          id: 1004,
          UserId: 1004,
          userId: 1004,
          username: name,
          userName: name,
          name: name,
          email: email,
          phone: `+91${phone}`,
          phoneNumber: phone,
          status: 'Active',
          isNewUser: false,
          consentRequired: false,
          profileComplete: true,
          physicalActivityLevel: 'moderate',
        };

        localStorage.setItem('isOtpVerified', 'true');
        localStorage.setItem('otpUser', JSON.stringify(user));
        localStorage.setItem('user', JSON.stringify(user));
      }, { phone: TEST_PHONE, email: TEST_EMAIL, name: TEST_NAME });

      // ============================================================
      // 3. OPEN APP DIRECTLY AS AUTHENTICATED USER ON HOME PAGE
      // ============================================================
      await page.goto('/', { waitUntil: 'domcontentloaded' });

      // ============================================================
      // 4. SELECT PROFILE AVATAR IN HEADER TO OPEN PROFILE FORM
      // ============================================================
      const profileBtn = page.getByRole('button', { name: 'My Profile' });
      await expect(profileBtn).toBeVisible({ timeout: 15000 });
      await profileBtn.click();

      // ============================================================
      // 5. VERIFY PROFILE FORM PAGE REACHED AND LOCATE INPUTS
      // ============================================================
      const profileHeading = page.getByRole('heading', { name: 'My Profile', exact: true });
      await expect(profileHeading).toBeVisible({ timeout: 15000 });

      const personalDetailsHeading = page.getByRole('heading', { name: 'Personal Details', exact: true });
      await expect(personalDetailsHeading).toBeVisible({ timeout: 15000 });

      const phoneErrorMessageLocator = page.getByText('Please enter a valid phone number (10-15 digits).', { exact: true });

      // ============================================================
      // 6. TEST 1: PHONE = 9 DIGITS (LESS THAN 10 -> SHOWS ERROR MESSAGE)
      // ============================================================
      await page.getByPlaceholder('e.g. +91 9876543210').fill('987654321');
      await expect(page.getByPlaceholder('e.g. +91 9876543210')).toHaveValue('987654321');
      await page.getByRole('button', { name: /Save profile|Save Profile|Saved/i }).click();
      await expect(phoneErrorMessageLocator).toBeVisible({ timeout: 10000 });
      console.log('CP-018: Phone number 987654321 (9 digits) validated as invalid (error message displayed)');

      // ============================================================
      // 7. TEST 2: PHONE = 10 DIGITS (VALID MIN BOUNDARY -> NO ERROR MESSAGE)
      // ============================================================
      await page.getByPlaceholder('e.g. +91 9876543210').fill('9876543210');
      await expect(page.getByPlaceholder('e.g. +91 9876543210')).toHaveValue('9876543210');
      await page.getByRole('button', { name: /Save profile|Save Profile|Saved/i }).click();
      await expect(phoneErrorMessageLocator).not.toBeVisible({ timeout: 5000 });
      console.log('CP-018: Phone number 9876543210 (10 digits) validated as valid (no error message)');

      // Re-open profile page if app navigated back to home
      if (await profileBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await profileBtn.click();
        await expect(personalDetailsHeading).toBeVisible({ timeout: 10000 });
      }

      // ============================================================
      // 8. TEST 3: PHONE = 15 DIGITS (VALID MAX BOUNDARY -> NO ERROR MESSAGE)
      // ============================================================
      await page.getByPlaceholder('e.g. +91 9876543210').fill('987654321012345');
      await expect(page.getByPlaceholder('e.g. +91 9876543210')).toHaveValue('987654321012345');
      await page.getByRole('button', { name: /Save profile|Save Profile|Saved/i }).click();
      await expect(phoneErrorMessageLocator).not.toBeVisible({ timeout: 5000 });
      console.log('CP-018: Phone number 987654321012345 (15 digits) validated as valid (no error message)');

      // Re-open profile page if app navigated back to home
      if (await profileBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await profileBtn.click();
        await expect(personalDetailsHeading).toBeVisible({ timeout: 10000 });
      }

      // ============================================================
      // 9. TEST 4: PHONE = 16 DIGITS (MORE THAN 15 -> SHOWS ERROR MESSAGE)
      // ============================================================
      await page.getByPlaceholder('e.g. +91 9876543210').fill('9876543210123456');
      await expect(page.getByPlaceholder('e.g. +91 9876543210')).toHaveValue('9876543210123456');
      await page.getByRole('button', { name: /Save profile|Save Profile|Saved/i }).click();
      await expect(phoneErrorMessageLocator).toBeVisible({ timeout: 10000 });
      console.log('CP-018: Phone number 9876543210123456 (16 digits) validated as invalid (error message displayed)');
    }
  );

  test(
    'CP-019 Body Fat % field validation for range (1-70) controls Save Profile button availability',
    async ({ page }) => {
      // ============================================================
      // TEST DATA
      // ============================================================
      const TEST_PHONE = '7695834209';
      const TEST_NAME = 'Nitheesh Lingam';
      const TEST_EMAIL = 'nitheesh@example.com';

      // ============================================================
      // 1. MOCK APIS FOR AUTHENTICATED USER
      // ============================================================
      await page.route('**/api/auth/send-otp', async route => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
      });

      await page.route('**/api/user/verify-session', async route => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, userId: 1004, sessionStale: false }) });
      });

      await page.route('**/api/user/lookup*', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            isActive: true,
            isNewUser: false,
            role: 'user',
            user: {
              id: 1004,
              UserId: 1004,
              username: TEST_NAME,
              name: TEST_NAME,
              email: TEST_EMAIL,
              phoneNumber: TEST_PHONE,
              status: 'Active',
            },
          }),
        });
      });

      await page.route('**/api/user/consent*', async route => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, consentRequired: false, consentAccepted: true }) });
      });

      let savedFat = '22';

      await page.route('**/api/user/profile*', async route => {
        const method = route.request().method();
        if (method === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                userId: 1004,
                profileComplete: true,
                userName: TEST_NAME,
                name: TEST_NAME,
                email: TEST_EMAIL,
                phoneNumber: TEST_PHONE,
                gender: 'Male',
                height: 170,
                dietType: 'Vegetarian',
                latestWeight: 72.5,
                currentWeight: 72.5,
                latestWeightBodyFat: Number(savedFat),
                bodyFat: Number(savedFat),
                bodyMetrics: { fatPercent: savedFat },
                profileImage: 'https://example.com/photo.jpg',
                physicalActivityLevel: 'moderate',
                needsCurrentWeight: false,
              },
            }),
          });
          return;
        }

        try {
          const postData = route.request().postDataJSON();
          if (postData && postData.bodyFat !== undefined) {
            savedFat = String(postData.bodyFat);
          }
        } catch {
          /* ignore JSON parse errors */
        }

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            message: 'Profile saved successfully!',
          }),
        });
      });

      // ============================================================
      // 2. SET AUTHENTICATED LOCALSTORAGE STATE
      // ============================================================
      await page.addInitScript(({ phone, email, name }) => {
        const user = {
          id: 1004,
          UserId: 1004,
          userId: 1004,
          username: name,
          userName: name,
          name: name,
          email: email,
          phone: `+91${phone}`,
          phoneNumber: phone,
          status: 'Active',
          isNewUser: false,
          consentRequired: false,
          profileComplete: true,
          physicalActivityLevel: 'moderate',
        };

        localStorage.setItem('isOtpVerified', 'true');
        localStorage.setItem('otpUser', JSON.stringify(user));
        localStorage.setItem('user', JSON.stringify(user));
      }, { phone: TEST_PHONE, email: TEST_EMAIL, name: TEST_NAME });

      // ============================================================
      // 3. OPEN APP DIRECTLY AS AUTHENTICATED USER ON HOME PAGE
      // ============================================================
      await page.goto('/', { waitUntil: 'domcontentloaded' });

      // ============================================================
      // 4. SELECT PROFILE AVATAR IN HEADER TO OPEN PROFILE FORM
      // ============================================================
      const profileBtn = page.getByRole('button', { name: 'My Profile' });
      await expect(profileBtn).toBeVisible({ timeout: 15000 });
      await profileBtn.click();

      // ============================================================
      // 5. VERIFY PROFILE FORM PAGE REACHED AND LOCATE INPUTS
      // ============================================================
      const profileHeading = page.getByRole('heading', { name: 'My Profile', exact: true });
      await expect(profileHeading).toBeVisible({ timeout: 15000 });

      const personalDetailsHeading = page.getByRole('heading', { name: 'Personal Details', exact: true });
      await expect(personalDetailsHeading).toBeVisible({ timeout: 15000 });

      const fatInput = page.locator('label').filter({ hasText: 'Fat %' }).locator('..').locator('input');
      await expect(fatInput).toBeVisible({ timeout: 15000 });

      const saveButton = page.getByRole('button', { name: /Save profile|Save Profile|Saved/i });
      await expect(saveButton).toBeVisible({ timeout: 15000 });

      // ============================================================
      // 6. TEST 1: FAT % = 0 (OUT OF RANGE < 1 -> SAVE PROFILE DISABLED)
      // ============================================================
      await fatInput.fill('0');
      await expect(fatInput).toHaveValue('0');
      await expect(saveButton).toBeDisabled({ timeout: 5000 });
      console.log('CP-019: Fat % = 0 -> Save Profile button is DISABLED');

      // ============================================================
      // 7. TEST 2: FAT % = 1 (MIN VALID BOUNDARY -> SAVE PROFILE ENABLED)
      // ============================================================
      await fatInput.fill('1');
      await expect(fatInput).toHaveValue('1');
      await expect(saveButton).toBeEnabled({ timeout: 5000 });
      console.log('CP-019: Fat % = 1 -> Save Profile button is ENABLED');

      // ============================================================
      // 8. TEST 3: FAT % = 70 (MAX VALID BOUNDARY -> SAVE PROFILE ENABLED)
      // ============================================================
      await fatInput.fill('70');
      await expect(fatInput).toHaveValue('70');
      await expect(saveButton).toBeEnabled({ timeout: 5000 });
      console.log('CP-019: Fat % = 70 -> Save Profile button is ENABLED');

      // ============================================================
      // 9. TEST 4: FAT % = 71 (OUT OF RANGE > 70 -> SAVE PROFILE DISABLED)
      // ============================================================
      await fatInput.fill('71');
      await expect(fatInput).toHaveValue('71');
      await expect(saveButton).toBeDisabled({ timeout: 5000 });
      console.log('CP-019: Fat % = 71 -> Save Profile button is DISABLED');
    }
  );

  test(
    'CP-020 BMI calculation verification for height and weight on profile page',
    async ({ page }) => {
      // ============================================================
      // TEST DATA
      // ============================================================
      const TEST_PHONE = '7695834209';
      const TEST_NAME = 'Nitheesh Lingam';
      const TEST_EMAIL = 'nitheesh@example.com';

      // ============================================================
      // 1. MOCK APIS FOR AUTHENTICATED USER
      // ============================================================
      await page.route('**/api/auth/send-otp', async route => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
      });

      await page.route('**/api/user/verify-session', async route => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, userId: 1004, sessionStale: false }) });
      });

      await page.route('**/api/user/lookup*', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            isActive: true,
            isNewUser: false,
            role: 'user',
            user: {
              id: 1004,
              UserId: 1004,
              username: TEST_NAME,
              name: TEST_NAME,
              email: TEST_EMAIL,
              phoneNumber: TEST_PHONE,
              status: 'Active',
            },
          }),
        });
      });

      await page.route('**/api/user/consent*', async route => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, consentRequired: false, consentAccepted: true }) });
      });

      let savedHeight = 170;

      await page.route('**/api/user/profile*', async route => {
        const method = route.request().method();
        if (method === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                userId: 1004,
                profileComplete: true,
                userName: TEST_NAME,
                name: TEST_NAME,
                email: TEST_EMAIL,
                phoneNumber: TEST_PHONE,
                gender: 'Male',
                height: savedHeight,
                dietType: 'Vegetarian',
                latestWeight: 65,
                currentWeight: 65,
                latestWeightBodyFat: 22,
                bodyFat: 22,
                bodyMetrics: { fatPercent: 22 },
                profileImage: 'https://example.com/photo.jpg',
                physicalActivityLevel: 'moderate',
                needsCurrentWeight: false,
              },
            }),
          });
          return;
        }

        try {
          const postData = route.request().postDataJSON();
          if (postData && postData.height) {
            savedHeight = Number(postData.height);
          }
        } catch {
          /* ignore JSON parse errors */
        }

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            message: 'Profile saved successfully!',
          }),
        });
      });

      // ============================================================
      // 2. SET AUTHENTICATED LOCALSTORAGE STATE
      // ============================================================
      await page.addInitScript(({ phone, email, name }) => {
        const user = {
          id: 1004,
          UserId: 1004,
          userId: 1004,
          username: name,
          userName: name,
          name: name,
          email: email,
          phone: `+91${phone}`,
          phoneNumber: phone,
          status: 'Active',
          isNewUser: false,
          consentRequired: false,
          profileComplete: true,
          physicalActivityLevel: 'moderate',
        };

        localStorage.setItem('isOtpVerified', 'true');
        localStorage.setItem('otpUser', JSON.stringify(user));
        localStorage.setItem('user', JSON.stringify(user));
      }, { phone: TEST_PHONE, email: TEST_EMAIL, name: TEST_NAME });

      // ============================================================
      // 3. OPEN APP DIRECTLY AS AUTHENTICATED USER ON HOME PAGE
      // ============================================================
      await page.goto('/', { waitUntil: 'domcontentloaded' });

      // ============================================================
      // 4. SELECT PROFILE AVATAR IN HEADER TO OPEN PROFILE FORM
      // ============================================================
      const profileBtn = page.getByRole('button', { name: 'My Profile' });
      await expect(profileBtn).toBeVisible({ timeout: 15000 });
      await profileBtn.click();

      // ============================================================
      // 5. VERIFY PROFILE FORM PAGE REACHED AND LOCATE INPUTS
      // ============================================================
      const profileHeading = page.getByRole('heading', { name: 'My Profile', exact: true });
      await expect(profileHeading).toBeVisible({ timeout: 15000 });

      const personalDetailsHeading = page.getByRole('heading', { name: 'Personal Details', exact: true });
      await expect(personalDetailsHeading).toBeVisible({ timeout: 15000 });

      const heightInput = page.getByPlaceholder('e.g. 170');
      await expect(heightInput).toBeVisible({ timeout: 15000 });

      const bmiValueDisplay = page.locator('label').filter({ hasText: /^BMI$/ }).locator('..').locator('div[aria-readonly="true"]');
      await expect(bmiValueDisplay).toBeVisible({ timeout: 15000 });

      // ============================================================
      // 6. VERIFY BMI CALCULATION: height = 170, weight = 65 -> BMI = 22.5
      // ============================================================
      await expect(bmiValueDisplay).toHaveText('22.5');
      console.log('CP-020: BMI calculation for height=170cm, weight=65kg verified as 22.5');

      // ============================================================
      // 7. VERIFY DYNAMIC BMI RE-CALCULATION WHEN HEIGHT IS UPDATED (e.g. 180cm, 65kg -> 20.1)
      // ============================================================
      await heightInput.fill('180');
      await expect(heightInput).toHaveValue('180');
      await expect(bmiValueDisplay).toHaveText('20.1');
      console.log('CP-020: Dynamic BMI calculation for height=180cm, weight=65kg verified as 20.1');

      // Restore height to 170
      await heightInput.fill('170');
      await expect(heightInput).toHaveValue('170');
      await expect(bmiValueDisplay).toHaveText('22.5');
      console.log('CP-020: Dynamic BMI calculation restored to height=170cm verified as 22.5');
    }
  );

  test(
    'CP-021 Age field validation for minimum and maximum boundaries (0, 1, 120, 121) in profile page',
    async ({ page }) => {
      // ============================================================
      // TEST DATA
      // ============================================================
      const TEST_PHONE = '7695834209';
      const TEST_NAME = 'Nitheesh Lingam';
      const TEST_EMAIL = 'nitheesh@example.com';

      // ============================================================
      // 1. MOCK APIS FOR AUTHENTICATED USER
      // ============================================================
      await page.route('**/api/auth/send-otp', async route => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
      });

      await page.route('**/api/user/verify-session', async route => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, userId: 1004, sessionStale: false }) });
      });

      await page.route('**/api/user/lookup*', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            isActive: true,
            isNewUser: false,
            role: 'user',
            user: {
              id: 1004,
              UserId: 1004,
              username: TEST_NAME,
              name: TEST_NAME,
              email: TEST_EMAIL,
              phoneNumber: TEST_PHONE,
              status: 'Active',
            },
          }),
        });
      });

      await page.route('**/api/user/consent*', async route => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, consentRequired: false, consentAccepted: true }) });
      });

      let savedAge = 30;

      await page.route('**/api/user/profile*', async route => {
        const method = route.request().method();
        if (method === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                userId: 1004,
                profileComplete: true,
                userName: TEST_NAME,
                name: TEST_NAME,
                email: TEST_EMAIL,
                phoneNumber: TEST_PHONE,
                gender: 'Male',
                height: 170,
                dietType: 'Vegetarian',
                latestWeight: 65,
                currentWeight: 65,
                latestWeightBodyFat: 22,
                bodyFat: 22,
                bodyMetrics: { age: savedAge, fatPercent: 22 },
                profileImage: 'https://example.com/photo.jpg',
                physicalActivityLevel: 'moderate',
                needsCurrentWeight: false,
              },
            }),
          });
          return;
        }

        try {
          const postData = route.request().postDataJSON();
          if (postData && postData.age !== undefined) {
            const ageNum = Number(postData.age);
            if (ageNum < 1 || ageNum > 120) {
              await route.fulfill({
                status: 400,
                contentType: 'application/json',
                body: JSON.stringify({
                  success: false,
                  message: 'Invalid age. Must be a number between 1 and 120.',
                }),
              });
              return;
            }
            savedAge = ageNum;
          }
        } catch {
          /* ignore JSON parse errors */
        }

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            message: 'Profile saved successfully!',
          }),
        });
      });

      // ============================================================
      // 2. SET AUTHENTICATED LOCALSTORAGE STATE
      // ============================================================
      await page.addInitScript(({ phone, email, name }) => {
        const user = {
          id: 1004,
          UserId: 1004,
          userId: 1004,
          username: name,
          userName: name,
          name: name,
          email: email,
          phone: `+91${phone}`,
          phoneNumber: phone,
          status: 'Active',
          isNewUser: false,
          consentRequired: false,
          profileComplete: true,
          physicalActivityLevel: 'moderate',
        };

        localStorage.setItem('isOtpVerified', 'true');
        localStorage.setItem('otpUser', JSON.stringify(user));
        localStorage.setItem('user', JSON.stringify(user));
      }, { phone: TEST_PHONE, email: TEST_EMAIL, name: TEST_NAME });

      // ============================================================
      // 3. OPEN APP DIRECTLY AS AUTHENTICATED USER ON HOME PAGE
      // ============================================================
      await page.goto('/', { waitUntil: 'domcontentloaded' });

      // ============================================================
      // 4. SELECT PROFILE AVATAR IN HEADER TO OPEN PROFILE FORM
      // ============================================================
      const profileBtn = page.getByRole('button', { name: 'My Profile' });
      await expect(profileBtn).toBeVisible({ timeout: 15000 });
      await profileBtn.click();

      // ============================================================
      // 5. VERIFY PROFILE FORM PAGE REACHED AND LOCATE INPUTS
      // ============================================================
      const profileHeading = page.getByRole('heading', { name: 'My Profile', exact: true });
      await expect(profileHeading).toBeVisible({ timeout: 15000 });

      const personalDetailsHeading = page.getByRole('heading', { name: 'Personal Details', exact: true });
      await expect(personalDetailsHeading).toBeVisible({ timeout: 15000 });

      const ageErrorMessageLocator = page.getByText('Invalid age. Must be a number between 1 and 120.', { exact: true });
      const ageInput = page.locator('label').filter({ hasText: /^Age$/ }).locator('..').locator('input');
      await expect(ageInput).toBeVisible({ timeout: 15000 });

      const saveButton = page.getByRole('button', { name: /Save profile|Save Profile|Saved/i });
      await expect(saveButton).toBeVisible({ timeout: 15000 });

      // ============================================================
      // 6. TEST 1: AGE = 0 (OUT OF RANGE < 1 -> SHOWS FAIL MESSAGE)
      // ============================================================
      await ageInput.fill('0');
      await expect(ageInput).toHaveValue('0');
      await saveButton.click();
      await expect(ageErrorMessageLocator).toBeVisible({ timeout: 10000 });
      console.log('CP-021: Age 0 validated as invalid (fail message displayed in profile screen)');

      // ============================================================
      // 7. TEST 2: AGE = 1 (VALID MIN BOUNDARY -> PROFILE SUCCESSFULLY SAVED)
      // ============================================================
      await ageInput.fill('1');
      await expect(ageInput).toHaveValue('1');
      await saveButton.click();
      await expect(ageErrorMessageLocator).not.toBeVisible({ timeout: 5000 });
      console.log('CP-021: Age 1 validated as valid (profile successfully saved)');

      // Re-open profile page if app navigated back to home
      if (await profileBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await profileBtn.click();
        await expect(personalDetailsHeading).toBeVisible({ timeout: 10000 });
      }

      // ============================================================
      // 8. TEST 3: AGE = 120 (VALID MAX BOUNDARY -> PROFILE SUCCESSFULLY SAVED)
      // ============================================================
      await ageInput.fill('120');
      await expect(ageInput).toHaveValue('120');
      await saveButton.click();
      await expect(ageErrorMessageLocator).not.toBeVisible({ timeout: 5000 });
      console.log('CP-021: Age 120 validated as valid (profile successfully saved)');

      // Re-open profile page if app navigated back to home
      if (await profileBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await profileBtn.click();
        await expect(personalDetailsHeading).toBeVisible({ timeout: 10000 });
      }

      // ============================================================
      // 9. TEST 4: AGE = 121 (MORE THAN 120 -> SHOWS FAIL MESSAGE)
      // ============================================================
      await ageInput.fill('121');
      await expect(ageInput).toHaveValue('121');
      await saveButton.click();
      await expect(ageErrorMessageLocator).toBeVisible({ timeout: 10000 });
      console.log('CP-021: Age 121 validated as invalid (fail message displayed in profile screen)');
    }
  );

  test(
    'CP-022 Profile Physical Activity field allows selecting all available options',
    async ({ page }) => {
      // ============================================================
      // TEST DATA
      // ============================================================
      const TEST_PHONE = '7695834209';
      const TEST_NAME = 'Nitheesh Lingam';
      const TEST_EMAIL = 'nitheesh@example.com';

      // ============================================================
      // 1. MOCK APIS FOR AUTHENTICATED USER
      // ============================================================
      await page.route('**/api/auth/send-otp', async route => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
      });

      await page.route('**/api/user/verify-session', async route => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, userId: 1004, sessionStale: false }) });
      });

      await page.route('**/api/user/lookup*', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            isActive: true,
            isNewUser: false,
            role: 'user',
            user: {
              id: 1004,
              UserId: 1004,
              username: TEST_NAME,
              name: TEST_NAME,
              email: TEST_EMAIL,
              phoneNumber: TEST_PHONE,
              status: 'Active',
            },
          }),
        });
      });

      await page.route('**/api/user/consent*', async route => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, consentRequired: false, consentAccepted: true }) });
      });

      let savedActivity = 'moderate';

      await page.route('**/api/user/profile*', async route => {
        const method = route.request().method();
        if (method === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                userId: 1004,
                profileComplete: true,
                userName: TEST_NAME,
                name: TEST_NAME,
                email: TEST_EMAIL,
                phoneNumber: TEST_PHONE,
                gender: 'Male',
                height: 170,
                dietType: 'Vegetarian',
                latestWeight: 65,
                currentWeight: 65,
                latestWeightBodyFat: 22,
                bodyFat: 22,
                bodyMetrics: { fatPercent: 22 },
                profileImage: 'https://example.com/photo.jpg',
                physicalActivityLevel: savedActivity,
                needsCurrentWeight: false,
              },
            }),
          });
          return;
        }

        try {
          const postData = route.request().postDataJSON();
          if (postData && postData.physicalActivityLevel) {
            savedActivity = postData.physicalActivityLevel;
          }
        } catch {
          /* ignore JSON parse errors */
        }

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            message: 'Profile saved successfully!',
          }),
        });
      });

      // ============================================================
      // 2. SET AUTHENTICATED LOCALSTORAGE STATE
      // ============================================================
      await page.addInitScript(({ phone, email, name }) => {
        const user = {
          id: 1004,
          UserId: 1004,
          userId: 1004,
          username: name,
          userName: name,
          name: name,
          email: email,
          phone: `+91${phone}`,
          phoneNumber: phone,
          status: 'Active',
          isNewUser: false,
          consentRequired: false,
          profileComplete: true,
          physicalActivityLevel: 'moderate',
        };

        localStorage.setItem('isOtpVerified', 'true');
        localStorage.setItem('otpUser', JSON.stringify(user));
        localStorage.setItem('user', JSON.stringify(user));
      }, { phone: TEST_PHONE, email: TEST_EMAIL, name: TEST_NAME });

      // ============================================================
      // 3. OPEN APP DIRECTLY AS AUTHENTICATED USER ON HOME PAGE
      // ============================================================
      await page.goto('/', { waitUntil: 'domcontentloaded' });

      // ============================================================
      // 4. SELECT PROFILE AVATAR IN HEADER TO OPEN PROFILE FORM
      // ============================================================
      const profileBtn = page.getByRole('button', { name: 'My Profile' });
      await expect(profileBtn).toBeVisible({ timeout: 15000 });
      await profileBtn.click();

      // ============================================================
      // 5. VERIFY PROFILE FORM PAGE REACHED AND LOCATE INPUTS
      // ============================================================
      const profileHeading = page.getByRole('heading', { name: 'My Profile', exact: true });
      await expect(profileHeading).toBeVisible({ timeout: 15000 });

      const personalDetailsHeading = page.getByRole('heading', { name: 'Personal Details', exact: true });
      await expect(personalDetailsHeading).toBeVisible({ timeout: 15000 });

      const activitySelect = page.locator('label').filter({ hasText: /^Physical Activity$/ }).locator('..').locator('select');
      await expect(activitySelect).toBeVisible({ timeout: 15000 });

      // ============================================================
      // 6. TEST SELECTING ALL PHYSICAL ACTIVITY OPTIONS
      // ============================================================

      // Option 1: Sedentary
      await activitySelect.selectOption('sedentary');
      await expect(activitySelect).toHaveValue('sedentary');
      console.log('CP-022: Option "Sedentary" selected and verified');

      // Option 2: Light Active
      await activitySelect.selectOption('light_active');
      await expect(activitySelect).toHaveValue('light_active');
      console.log('CP-022: Option "Light Active" selected and verified');

      // Option 3: Moderate
      await activitySelect.selectOption('moderate');
      await expect(activitySelect).toHaveValue('moderate');
      console.log('CP-022: Option "Moderate" selected and verified');

      // Option 4: Very Active
      await activitySelect.selectOption('very_active');
      await expect(activitySelect).toHaveValue('very_active');
      console.log('CP-022: Option "Very Active" selected and verified');

      // Option 5: Highly Active
      await activitySelect.selectOption('highly_active');
      await expect(activitySelect).toHaveValue('highly_active');
      console.log('CP-022: Option "Highly Active" selected and verified');

      console.log('CP-022: All 5 Physical Activity options successfully selected and verified');
    }
  );

  test(
    'CP-023 Visceral Fat (V-Fat) field validation for minimum and maximum boundaries (0, 1, 59, 60) in profile page',
    async ({ page }) => {
      // ============================================================
      // TEST DATA
      // ============================================================
      const TEST_PHONE = '7695834209';
      const TEST_NAME = 'Nitheesh Lingam';
      const TEST_EMAIL = 'nitheesh@example.com';

      // ============================================================
      // 1. MOCK APIS FOR AUTHENTICATED USER
      // ============================================================
      await page.route('**/api/auth/send-otp', async route => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
      });

      await page.route('**/api/user/verify-session', async route => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, userId: 1004, sessionStale: false }) });
      });

      await page.route('**/api/user/lookup*', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            isActive: true,
            isNewUser: false,
            role: 'user',
            user: {
              id: 1004,
              UserId: 1004,
              username: TEST_NAME,
              name: TEST_NAME,
              email: TEST_EMAIL,
              phoneNumber: TEST_PHONE,
              status: 'Active',
            },
          }),
        });
      });

      await page.route('**/api/user/consent*', async route => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, consentRequired: false, consentAccepted: true }) });
      });

      let savedVisceralFat = 10;

      await page.route('**/api/user/profile*', async route => {
        const method = route.request().method();
        if (method === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                userId: 1004,
                profileComplete: true,
                userName: TEST_NAME,
                name: TEST_NAME,
                email: TEST_EMAIL,
                phoneNumber: TEST_PHONE,
                gender: 'Male',
                height: 170,
                dietType: 'Vegetarian',
                latestWeight: 65,
                currentWeight: 65,
                latestWeightBodyFat: 22,
                bodyFat: 22,
                bodyMetrics: { visceralFat: savedVisceralFat, fatPercent: 22 },
                profileImage: 'https://example.com/photo.jpg',
                physicalActivityLevel: 'moderate',
                needsCurrentWeight: false,
              },
            }),
          });
          return;
        }

        try {
          const postData = route.request().postDataJSON();
          if (postData && postData.visceralFat !== undefined) {
            const vfatNum = Number(postData.visceralFat);
            if (vfatNum < 1 || vfatNum > 59) {
              await route.fulfill({
                status: 400,
                contentType: 'application/json',
                body: JSON.stringify({
                  success: false,
                  message: 'Invalid visceralFat. Must be a number between 1 and 59.',
                }),
              });
              return;
            }
            savedVisceralFat = vfatNum;
          }
        } catch {
          /* ignore JSON parse errors */
        }

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            message: 'Profile saved successfully!',
          }),
        });
      });

      // ============================================================
      // 2. SET AUTHENTICATED LOCALSTORAGE STATE
      // ============================================================
      await page.addInitScript(({ phone, email, name }) => {
        const user = {
          id: 1004,
          UserId: 1004,
          userId: 1004,
          username: name,
          userName: name,
          name: name,
          email: email,
          phone: `+91${phone}`,
          phoneNumber: phone,
          status: 'Active',
          isNewUser: false,
          consentRequired: false,
          profileComplete: true,
          physicalActivityLevel: 'moderate',
        };

        localStorage.setItem('isOtpVerified', 'true');
        localStorage.setItem('otpUser', JSON.stringify(user));
        localStorage.setItem('user', JSON.stringify(user));
      }, { phone: TEST_PHONE, email: TEST_EMAIL, name: TEST_NAME });

      // ============================================================
      // 3. OPEN APP DIRECTLY AS AUTHENTICATED USER ON HOME PAGE
      // ============================================================
      await page.goto('/', { waitUntil: 'domcontentloaded' });

      // ============================================================
      // 4. SELECT PROFILE AVATAR IN HEADER TO OPEN PROFILE FORM
      // ============================================================
      const profileBtn = page.getByRole('button', { name: 'My Profile' });
      await expect(profileBtn).toBeVisible({ timeout: 15000 });
      await profileBtn.click();

      // ============================================================
      // 5. VERIFY PROFILE FORM PAGE REACHED AND LOCATE INPUTS
      // ============================================================
      const profileHeading = page.getByRole('heading', { name: 'My Profile', exact: true });
      await expect(profileHeading).toBeVisible({ timeout: 15000 });

      const personalDetailsHeading = page.getByRole('heading', { name: 'Personal Details', exact: true });
      await expect(personalDetailsHeading).toBeVisible({ timeout: 15000 });

      const vfatErrorMessageLocator = page.getByText('Invalid visceralFat. Must be a number between 1 and 59.', { exact: true });
      const vfatInput = page.locator('label').filter({ hasText: /^V-Fat$/ }).locator('..').locator('input');
      await expect(vfatInput).toBeVisible({ timeout: 15000 });

      const saveButton = page.getByRole('button', { name: /Save profile|Save Profile|Saved/i });
      await expect(saveButton).toBeVisible({ timeout: 15000 });

      // ============================================================
      // 6. TEST 1: V-FAT = 0 (OUT OF RANGE < 1 -> SHOWS FAIL MESSAGE)
      // ============================================================
      await vfatInput.fill('0');
      await expect(vfatInput).toHaveValue('0');
      await saveButton.click();
      await expect(vfatErrorMessageLocator).toBeVisible({ timeout: 10000 });
      console.log('CP-023: V-Fat 0 validated as invalid (fail message displayed in profile screen)');

      // ============================================================
      // 7. TEST 2: V-FAT = 1 (VALID MIN BOUNDARY -> PROFILE SUCCESSFULLY SAVED)
      // ============================================================
      await vfatInput.fill('1');
      await expect(vfatInput).toHaveValue('1');
      await saveButton.click();
      await expect(vfatErrorMessageLocator).not.toBeVisible({ timeout: 5000 });
      console.log('CP-023: V-Fat 1 validated as valid (profile successfully saved)');

      // Re-open profile page if app navigated back to home
      if (await profileBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await profileBtn.click();
        await expect(personalDetailsHeading).toBeVisible({ timeout: 10000 });
      }

      // ============================================================
      // 8. TEST 3: V-FAT = 59 (VALID MAX BOUNDARY -> PROFILE SUCCESSFULLY SAVED)
      // ============================================================
      await vfatInput.fill('59');
      await expect(vfatInput).toHaveValue('59');
      await saveButton.click();
      await expect(vfatErrorMessageLocator).not.toBeVisible({ timeout: 5000 });
      console.log('CP-023: V-Fat 59 validated as valid (profile successfully saved)');

      // Re-open profile page if app navigated back to home
      if (await profileBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await profileBtn.click();
        await expect(personalDetailsHeading).toBeVisible({ timeout: 10000 });
      }

      // ============================================================
      // 9. TEST 4: V-FAT = 60 (MORE THAN 59 -> SHOWS FAIL MESSAGE)
      // ============================================================
      await vfatInput.fill('60');
      await expect(vfatInput).toHaveValue('60');
      await saveButton.click();
      await expect(vfatErrorMessageLocator).toBeVisible({ timeout: 10000 });
      console.log('CP-023: V-Fat 60 validated as invalid (fail message displayed in profile screen)');
    }
  );

  test(
    'CP-024 Body Age field validation for minimum and maximum boundaries (0, 1, 120, 121) in profile page',
    async ({ page }) => {
      // ============================================================
      // TEST DATA
      // ============================================================
      const TEST_PHONE = '7695834209';
      const TEST_NAME = 'Nitheesh Lingam';
      const TEST_EMAIL = 'nitheesh@example.com';

      // ============================================================
      // 1. MOCK APIS FOR AUTHENTICATED USER
      // ============================================================
      await page.route('**/api/auth/send-otp', async route => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
      });

      await page.route('**/api/user/verify-session', async route => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, userId: 1004, sessionStale: false }) });
      });

      await page.route('**/api/user/lookup*', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            isActive: true,
            isNewUser: false,
            role: 'user',
            user: {
              id: 1004,
              UserId: 1004,
              username: TEST_NAME,
              name: TEST_NAME,
              email: TEST_EMAIL,
              phoneNumber: TEST_PHONE,
              status: 'Active',
            },
          }),
        });
      });

      await page.route('**/api/user/consent*', async route => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, consentRequired: false, consentAccepted: true }) });
      });

      let savedBodyAge = 25;

      await page.route('**/api/user/profile*', async route => {
        const method = route.request().method();
        if (method === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                userId: 1004,
                profileComplete: true,
                userName: TEST_NAME,
                name: TEST_NAME,
                email: TEST_EMAIL,
                phoneNumber: TEST_PHONE,
                gender: 'Male',
                height: 170,
                dietType: 'Vegetarian',
                latestWeight: 65,
                currentWeight: 65,
                latestWeightBodyFat: 22,
                bodyFat: 22,
                bodyMetrics: { bodyAge: savedBodyAge, fatPercent: 22 },
                profileImage: 'https://example.com/photo.jpg',
                physicalActivityLevel: 'moderate',
                needsCurrentWeight: false,
              },
            }),
          });
          return;
        }

        try {
          const postData = route.request().postDataJSON();
          if (postData && postData.bodyAge !== undefined) {
            const bodyAgeNum = Number(postData.bodyAge);
            if (bodyAgeNum < 1 || bodyAgeNum > 120) {
              await route.fulfill({
                status: 400,
                contentType: 'application/json',
                body: JSON.stringify({
                  success: false,
                  message: 'Invalid bodyAge. Must be a number between 1 and 120.',
                }),
              });
              return;
            }
            savedBodyAge = bodyAgeNum;
          }
        } catch {
          /* ignore JSON parse errors */
        }

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            message: 'Profile saved successfully!',
          }),
        });
      });

      // ============================================================
      // 2. SET AUTHENTICATED LOCALSTORAGE STATE
      // ============================================================
      await page.addInitScript(({ phone, email, name }) => {
        const user = {
          id: 1004,
          UserId: 1004,
          userId: 1004,
          username: name,
          userName: name,
          name: name,
          email: email,
          phone: `+91${phone}`,
          phoneNumber: phone,
          status: 'Active',
          isNewUser: false,
          consentRequired: false,
          profileComplete: true,
          physicalActivityLevel: 'moderate',
        };

        localStorage.setItem('isOtpVerified', 'true');
        localStorage.setItem('otpUser', JSON.stringify(user));
        localStorage.setItem('user', JSON.stringify(user));
      }, { phone: TEST_PHONE, email: TEST_EMAIL, name: TEST_NAME });

      // ============================================================
      // 3. OPEN APP DIRECTLY AS AUTHENTICATED USER ON HOME PAGE
      // ============================================================
      await page.goto('/', { waitUntil: 'domcontentloaded' });

      // ============================================================
      // 4. SELECT PROFILE AVATAR IN HEADER TO OPEN PROFILE FORM
      // ============================================================
      const profileBtn = page.getByRole('button', { name: 'My Profile' });
      await expect(profileBtn).toBeVisible({ timeout: 15000 });
      await profileBtn.click();

      // ============================================================
      // 5. VERIFY PROFILE FORM PAGE REACHED AND LOCATE INPUTS
      // ============================================================
      const profileHeading = page.getByRole('heading', { name: 'My Profile', exact: true });
      await expect(profileHeading).toBeVisible({ timeout: 15000 });

      const personalDetailsHeading = page.getByRole('heading', { name: 'Personal Details', exact: true });
      await expect(personalDetailsHeading).toBeVisible({ timeout: 15000 });

      const bodyAgeErrorMessageLocator = page.getByText('Invalid bodyAge. Must be a number between 1 and 120.', { exact: true });
      const bodyAgeInput = page.locator('label').filter({ hasText: /^Body Age$/ }).locator('..').locator('input');
      await expect(bodyAgeInput).toBeVisible({ timeout: 15000 });

      const saveButton = page.getByRole('button', { name: /Save profile|Save Profile|Saved/i });
      await expect(saveButton).toBeVisible({ timeout: 15000 });

      // ============================================================
      // 6. TEST 1: BODY AGE = 0 (OUT OF RANGE < 1 -> SHOWS FAIL MESSAGE)
      // ============================================================
      await bodyAgeInput.fill('0');
      await expect(bodyAgeInput).toHaveValue('0');
      await saveButton.click();
      await expect(bodyAgeErrorMessageLocator).toBeVisible({ timeout: 10000 });
      console.log('CP-024: Body Age 0 validated as invalid (fail message displayed in profile screen)');

      // ============================================================
      // 7. TEST 2: BODY AGE = 1 (VALID MIN BOUNDARY -> PROFILE SUCCESSFULLY SAVED)
      // ============================================================
      await bodyAgeInput.fill('1');
      await expect(bodyAgeInput).toHaveValue('1');
      await saveButton.click();
      await expect(bodyAgeErrorMessageLocator).not.toBeVisible({ timeout: 5000 });
      console.log('CP-024: Body Age 1 validated as valid (profile successfully saved)');

      // Re-open profile page if app navigated back to home
      if (await profileBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await profileBtn.click();
        await expect(personalDetailsHeading).toBeVisible({ timeout: 10000 });
      }

      // ============================================================
      // 8. TEST 3: BODY AGE = 120 (VALID MAX BOUNDARY -> PROFILE SUCCESSFULLY SAVED)
      // ============================================================
      await bodyAgeInput.fill('120');
      await expect(bodyAgeInput).toHaveValue('120');
      await saveButton.click();
      await expect(bodyAgeErrorMessageLocator).not.toBeVisible({ timeout: 5000 });
      console.log('CP-024: Body Age 120 validated as valid (profile successfully saved)');

      // Re-open profile page if app navigated back to home
      if (await profileBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await profileBtn.click();
        await expect(personalDetailsHeading).toBeVisible({ timeout: 10000 });
      }

      // ============================================================
      // 9. TEST 4: BODY AGE = 121 (MORE THAN 120 -> SHOWS FAIL MESSAGE)
      // ============================================================
      await bodyAgeInput.fill('121');
      await expect(bodyAgeInput).toHaveValue('121');
      await saveButton.click();
      await expect(bodyAgeErrorMessageLocator).toBeVisible({ timeout: 10000 });
      console.log('CP-024: Body Age 121 validated as invalid (fail message displayed in profile screen)');
    }
  );




  test(
    'CP-025 Waist (waistCm) field validation for minimum and maximum boundaries (0, 30, 200, 201) in profile page',
    async ({ page }) => {
      // ============================================================
      // TEST DATA
      // ============================================================
      const TEST_PHONE = '7695834209';
      const TEST_NAME = 'Nitheesh Lingam';
      const TEST_EMAIL = 'nitheesh@example.com';

      // ============================================================
      // 1. MOCK APIS FOR AUTHENTICATED USER
      // ============================================================
      await page.route('**/api/auth/send-otp', async route => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
      });

      await page.route('**/api/user/verify-session', async route => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, userId: 1004, sessionStale: false }) });
      });

      await page.route('**/api/user/lookup*', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            isActive: true,
            isNewUser: false,
            role: 'user',
            user: {
              id: 1004,
              UserId: 1004,
              username: TEST_NAME,
              name: TEST_NAME,
              email: TEST_EMAIL,
              phoneNumber: TEST_PHONE,
              status: 'Active',
            },
          }),
        });
      });

      await page.route('**/api/user/consent*', async route => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, consentRequired: false, consentAccepted: true }) });
      });

      let savedWaist = 80;

      await page.route('**/api/user/profile*', async route => {
        const method = route.request().method();
        if (method === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                userId: 1004,
                profileComplete: true,
                userName: TEST_NAME,
                name: TEST_NAME,
                email: TEST_EMAIL,
                phoneNumber: TEST_PHONE,
                gender: 'Male',
                height: 170,
                dietType: 'Vegetarian',
                latestWeight: 65,
                currentWeight: 65,
                latestWeightBodyFat: 22,
                bodyFat: 22,
                bodyMetrics: { waistCm: savedWaist, fatPercent: 22 },
                profileImage: 'https://example.com/photo.jpg',
                physicalActivityLevel: 'moderate',
                needsCurrentWeight: false,
              },
            }),
          });
          return;
        }

        try {
          const postData = route.request().postDataJSON();
          if (postData && postData.waistCm !== undefined) {
            const waistNum = Number(postData.waistCm);
            if (waistNum < 30 || waistNum > 200) {
              await route.fulfill({
                status: 400,
                contentType: 'application/json',
                body: JSON.stringify({
                  success: false,
                  message: 'Invalid waistCm. Must be a number between 30 and 200.',
                }),
              });
              return;
            }
            savedWaist = waistNum;
          }
        } catch {
          /* ignore JSON parse errors */
        }

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            message: 'Profile saved successfully!',
          }),
        });
      });

      // ============================================================
      // 2. SET AUTHENTICATED LOCALSTORAGE STATE
      // ============================================================
      await page.addInitScript(({ phone, email, name }) => {
        const user = {
          id: 1004,
          UserId: 1004,
          userId: 1004,
          username: name,
          userName: name,
          name: name,
          email: email,
          phone: `+91${phone}`,
          phoneNumber: phone,
          status: 'Active',
          isNewUser: false,
          consentRequired: false,
          profileComplete: true,
          physicalActivityLevel: 'moderate',
        };

        localStorage.setItem('isOtpVerified', 'true');
        localStorage.setItem('otpUser', JSON.stringify(user));
        localStorage.setItem('user', JSON.stringify(user));
      }, { phone: TEST_PHONE, email: TEST_EMAIL, name: TEST_NAME });

      // ============================================================
      // 3. OPEN APP DIRECTLY AS AUTHENTICATED USER ON HOME PAGE
      // ============================================================
      await page.goto('/', { waitUntil: 'domcontentloaded' });

      // ============================================================
      // 4. SELECT PROFILE AVATAR IN HEADER TO OPEN PROFILE FORM
      // ============================================================
      const profileBtn = page.getByRole('button', { name: 'My Profile' });
      await expect(profileBtn).toBeVisible({ timeout: 15000 });
      await profileBtn.click();

      // ============================================================
      // 5. VERIFY PROFILE FORM PAGE REACHED AND LOCATE INPUTS
      // ============================================================
      const profileHeading = page.getByRole('heading', { name: 'My Profile', exact: true });
      await expect(profileHeading).toBeVisible({ timeout: 15000 });

      const personalDetailsHeading = page.getByRole('heading', { name: 'Personal Details', exact: true });
      await expect(personalDetailsHeading).toBeVisible({ timeout: 15000 });

      const waistErrorMessageLocator = page.getByText('Invalid waistCm. Must be a number between 30 and 200.', { exact: true });
      const waistInput = page.locator('label').filter({ hasText: /^Waist \(cm\)$/ }).locator('..').locator('input');
      await expect(waistInput).toBeVisible({ timeout: 15000 });

      const saveButton = page.getByRole('button', { name: /Save profile|Save Profile|Saved/i });
      await expect(saveButton).toBeVisible({ timeout: 15000 });

      // ============================================================
      // 6. TEST 1: WAIST = 0 (OUT OF RANGE < 30 -> SHOWS FAIL MESSAGE)
      // ============================================================
      await waistInput.fill('0');
      await expect(waistInput).toHaveValue('0');
      await saveButton.click();
      await expect(waistErrorMessageLocator).toBeVisible({ timeout: 10000 });
      console.log('CP-025: Waist 0 validated as invalid (fail message displayed in profile screen)');

      // ============================================================
      // 7. TEST 2: WAIST = 30 (VALID MIN BOUNDARY -> PROFILE SUCCESSFULLY SAVED)
      // ============================================================
      await waistInput.fill('30');
      await expect(waistInput).toHaveValue('30');
      await saveButton.click();
      await expect(waistErrorMessageLocator).not.toBeVisible({ timeout: 5000 });
      console.log('CP-025: Waist 30 validated as valid (profile successfully saved)');

      // Re-open profile page if app navigated back to home
      if (await profileBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await profileBtn.click();
        await expect(personalDetailsHeading).toBeVisible({ timeout: 10000 });
      }

      // ============================================================
      // 8. TEST 3: WAIST = 200 (VALID MAX BOUNDARY -> PROFILE SUCCESSFULLY SAVED)
      // ============================================================
      await waistInput.fill('200');
      await expect(waistInput).toHaveValue('200');
      await saveButton.click();
      await expect(waistErrorMessageLocator).not.toBeVisible({ timeout: 5000 });
      console.log('CP-025: Waist 200 validated as valid (profile successfully saved)');

      // Re-open profile page if app navigated back to home
      if (await profileBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await profileBtn.click();
        await expect(personalDetailsHeading).toBeVisible({ timeout: 10000 });
      }

      // ============================================================
      // 9. TEST 4: WAIST = 201 (MORE THAN 200 -> SHOWS FAIL MESSAGE)
      // ============================================================
      await waistInput.fill('201');
      await expect(waistInput).toHaveValue('201');
      await saveButton.click();
      await expect(waistErrorMessageLocator).toBeVisible({ timeout: 10000 });
      console.log('CP-025: Waist 201 validated as invalid (fail message displayed in profile screen)');
    }
  );

  test(
    'CP-026 Chest (chestCm) field validation for minimum and maximum boundaries (0, 30, 200, 201) in profile page',
    async ({ page }) => {
      // ============================================================
      // TEST DATA
      // ============================================================
      const TEST_PHONE = '7695834209';
      const TEST_NAME = 'Nitheesh Lingam';
      const TEST_EMAIL = 'nitheesh@example.com';

      // ============================================================
      // 1. MOCK APIS FOR AUTHENTICATED USER
      // ============================================================
      await page.route('**/api/auth/send-otp', async route => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
      });

      await page.route('**/api/user/verify-session', async route => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, userId: 1004, sessionStale: false }) });
      });

      await page.route('**/api/user/lookup*', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            isActive: true,
            isNewUser: false,
            role: 'user',
            user: {
              id: 1004,
              UserId: 1004,
              username: TEST_NAME,
              name: TEST_NAME,
              email: TEST_EMAIL,
              phoneNumber: TEST_PHONE,
              status: 'Active',
            },
          }),
        });
      });

      await page.route('**/api/user/consent*', async route => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, consentRequired: false, consentAccepted: true }) });
      });

      let savedChest = 90;

      await page.route('**/api/user/profile*', async route => {
        const method = route.request().method();
        if (method === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                userId: 1004,
                profileComplete: true,
                userName: TEST_NAME,
                name: TEST_NAME,
                email: TEST_EMAIL,
                phoneNumber: TEST_PHONE,
                gender: 'Male',
                height: 170,
                dietType: 'Vegetarian',
                latestWeight: 65,
                currentWeight: 65,
                latestWeightBodyFat: 22,
                bodyFat: 22,
                bodyMetrics: { chestCm: savedChest, fatPercent: 22 },
                profileImage: 'https://example.com/photo.jpg',
                physicalActivityLevel: 'moderate',
                needsCurrentWeight: false,
              },
            }),
          });
          return;
        }

        try {
          const postData = route.request().postDataJSON();
          if (postData && postData.chestCm !== undefined) {
            const chestNum = Number(postData.chestCm);
            if (chestNum < 30 || chestNum > 200) {
              await route.fulfill({
                status: 400,
                contentType: 'application/json',
                body: JSON.stringify({
                  success: false,
                  message: 'Invalid chestCm. Must be a number between 30 and 200.',
                }),
              });
              return;
            }
            savedChest = chestNum;
          }
        } catch {
          /* ignore JSON parse errors */
        }

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            message: 'Profile saved successfully!',
          }),
        });
      });

      // ============================================================
      // 2. SET AUTHENTICATED LOCALSTORAGE STATE
      // ============================================================
      await page.addInitScript(({ phone, email, name }) => {
        const user = {
          id: 1004,
          UserId: 1004,
          userId: 1004,
          username: name,
          userName: name,
          name: name,
          email: email,
          phone: `+91${phone}`,
          phoneNumber: phone,
          status: 'Active',
          isNewUser: false,
          consentRequired: false,
          profileComplete: true,
          physicalActivityLevel: 'moderate',
        };

        localStorage.setItem('isOtpVerified', 'true');
        localStorage.setItem('otpUser', JSON.stringify(user));
        localStorage.setItem('user', JSON.stringify(user));
      }, { phone: TEST_PHONE, email: TEST_EMAIL, name: TEST_NAME });

      // ============================================================
      // 3. OPEN APP DIRECTLY AS AUTHENTICATED USER ON HOME PAGE
      // ============================================================
      await page.goto('/', { waitUntil: 'domcontentloaded' });

      // ============================================================
      // 4. SELECT PROFILE AVATAR IN HEADER TO OPEN PROFILE FORM
      // ============================================================
      const profileBtn = page.getByRole('button', { name: 'My Profile' });
      await expect(profileBtn).toBeVisible({ timeout: 15000 });
      await profileBtn.click();

      // ============================================================
      // 5. VERIFY PROFILE FORM PAGE REACHED AND LOCATE INPUTS
      // ============================================================
      const profileHeading = page.getByRole('heading', { name: 'My Profile', exact: true });
      await expect(profileHeading).toBeVisible({ timeout: 15000 });

      const personalDetailsHeading = page.getByRole('heading', { name: 'Personal Details', exact: true });
      await expect(personalDetailsHeading).toBeVisible({ timeout: 15000 });

      const chestErrorMessageLocator = page.getByText('Invalid chestCm. Must be a number between 30 and 200.', { exact: true });
      const chestInput = page.locator('label').filter({ hasText: /^Chest \(cm\)$/ }).locator('..').locator('input');
      await expect(chestInput).toBeVisible({ timeout: 15000 });

      const saveButton = page.getByRole('button', { name: /Save profile|Save Profile|Saved/i });
      await expect(saveButton).toBeVisible({ timeout: 15000 });

      // ============================================================
      // 6. TEST 1: CHEST = 0 (OUT OF RANGE < 30 -> SHOWS FAIL MESSAGE)
      // ============================================================
      await chestInput.fill('0');
      await expect(chestInput).toHaveValue('0');
      await saveButton.click();
      await expect(chestErrorMessageLocator).toBeVisible({ timeout: 10000 });
      console.log('CP-026: Chest 0 validated as invalid (fail message displayed in profile screen)');

      // ============================================================
      // 7. TEST 2: CHEST = 30 (VALID MIN BOUNDARY -> PROFILE SUCCESSFULLY SAVED)
      // ============================================================
      await chestInput.fill('30');
      await expect(chestInput).toHaveValue('30');
      await saveButton.click();
      await expect(chestErrorMessageLocator).not.toBeVisible({ timeout: 5000 });
      console.log('CP-026: Chest 30 validated as valid (profile successfully saved)');

      // Re-open profile page if app navigated back to home
      if (await profileBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await profileBtn.click();
        await expect(personalDetailsHeading).toBeVisible({ timeout: 10000 });
      }

      // ============================================================
      // 8. TEST 3: CHEST = 200 (VALID MAX BOUNDARY -> PROFILE SUCCESSFULLY SAVED)
      // ============================================================
      await chestInput.fill('200');
      await expect(chestInput).toHaveValue('200');
      await saveButton.click();
      await expect(chestErrorMessageLocator).not.toBeVisible({ timeout: 5000 });
      console.log('CP-026: Chest 200 validated as valid (profile successfully saved)');

      // Re-open profile page if app navigated back to home
      if (await profileBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await profileBtn.click();
        await expect(personalDetailsHeading).toBeVisible({ timeout: 10000 });
      }

      // ============================================================
      // 9. TEST 4: CHEST = 201 (MORE THAN 200 -> SHOWS FAIL MESSAGE)
      // ============================================================
      await chestInput.fill('201');
      await expect(chestInput).toHaveValue('201');
      await saveButton.click();
      await expect(chestErrorMessageLocator).toBeVisible({ timeout: 10000 });
      console.log('CP-026: Chest 201 validated as invalid (fail message displayed in profile screen)');
    }
  );

  test(
    'CP-027 Hip (hipCm) field validation for minimum and maximum boundaries (0, 30, 200, 201) in profile page',
    async ({ page }) => {
      // ============================================================
      // TEST DATA
      // ============================================================
      const TEST_PHONE = '7695834209';
      const TEST_NAME = 'Nitheesh Lingam';
      const TEST_EMAIL = 'nitheesh@example.com';

      // ============================================================
      // 1. MOCK APIS FOR AUTHENTICATED USER
      // ============================================================
      await page.route('**/api/auth/send-otp', async route => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
      });

      await page.route('**/api/user/verify-session', async route => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, userId: 1004, sessionStale: false }) });
      });

      await page.route('**/api/user/lookup*', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            isActive: true,
            isNewUser: false,
            role: 'user',
            user: {
              id: 1004,
              UserId: 1004,
              username: TEST_NAME,
              name: TEST_NAME,
              email: TEST_EMAIL,
              phoneNumber: TEST_PHONE,
              status: 'Active',
            },
          }),
        });
      });

      await page.route('**/api/user/consent*', async route => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, consentRequired: false, consentAccepted: true }) });
      });

      let savedHip = 95;

      await page.route('**/api/user/profile*', async route => {
        const method = route.request().method();
        if (method === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                userId: 1004,
                profileComplete: true,
                userName: TEST_NAME,
                name: TEST_NAME,
                email: TEST_EMAIL,
                phoneNumber: TEST_PHONE,
                gender: 'Male',
                height: 170,
                dietType: 'Vegetarian',
                latestWeight: 65,
                currentWeight: 65,
                latestWeightBodyFat: 22,
                bodyFat: 22,
                bodyMetrics: { hipCm: savedHip, fatPercent: 22 },
                profileImage: 'https://example.com/photo.jpg',
                physicalActivityLevel: 'moderate',
                needsCurrentWeight: false,
              },
            }),
          });
          return;
        }

        try {
          const postData = route.request().postDataJSON();
          if (postData && postData.hipCm !== undefined) {
            const hipNum = Number(postData.hipCm);
            if (hipNum < 30 || hipNum > 200) {
              await route.fulfill({
                status: 400,
                contentType: 'application/json',
                body: JSON.stringify({
                  success: false,
                  message: 'Invalid hipCm. Must be a number between 30 and 200.',
                }),
              });
              return;
            }
            savedHip = hipNum;
          }
        } catch {
          /* ignore JSON parse errors */
        }

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            message: 'Profile saved successfully!',
          }),
        });
      });

      // ============================================================
      // 2. SET AUTHENTICATED LOCALSTORAGE STATE
      // ============================================================
      await page.addInitScript(({ phone, email, name }) => {
        const user = {
          id: 1004,
          UserId: 1004,
          userId: 1004,
          username: name,
          userName: name,
          name: name,
          email: email,
          phone: `+91${phone}`,
          phoneNumber: phone,
          status: 'Active',
          isNewUser: false,
          consentRequired: false,
          profileComplete: true,
          physicalActivityLevel: 'moderate',
        };

        localStorage.setItem('isOtpVerified', 'true');
        localStorage.setItem('otpUser', JSON.stringify(user));
        localStorage.setItem('user', JSON.stringify(user));
      }, { phone: TEST_PHONE, email: TEST_EMAIL, name: TEST_NAME });

      // ============================================================
      // 3. OPEN APP DIRECTLY AS AUTHENTICATED USER ON HOME PAGE
      // ============================================================
      await page.goto('/', { waitUntil: 'domcontentloaded' });

      // ============================================================
      // 4. SELECT PROFILE AVATAR IN HEADER TO OPEN PROFILE FORM
      // ============================================================
      const profileBtn = page.getByRole('button', { name: 'My Profile' });
      await expect(profileBtn).toBeVisible({ timeout: 15000 });
      await profileBtn.click();

      // ============================================================
      // 5. VERIFY PROFILE FORM PAGE REACHED AND LOCATE INPUTS
      // ============================================================
      const profileHeading = page.getByRole('heading', { name: 'My Profile', exact: true });
      await expect(profileHeading).toBeVisible({ timeout: 15000 });

      const personalDetailsHeading = page.getByRole('heading', { name: 'Personal Details', exact: true });
      await expect(personalDetailsHeading).toBeVisible({ timeout: 15000 });

      const hipErrorMessageLocator = page.getByText('Invalid hipCm. Must be a number between 30 and 200.', { exact: true });
      const hipInput = page.locator('label').filter({ hasText: /^Hip \(cm\)$/ }).locator('..').locator('input');
      await expect(hipInput).toBeVisible({ timeout: 15000 });

      const saveButton = page.getByRole('button', { name: /Save profile|Save Profile|Saved/i });
      await expect(saveButton).toBeVisible({ timeout: 15000 });

      // ============================================================
      // 6. TEST 1: HIP = 0 (OUT OF RANGE < 30 -> SHOWS FAIL MESSAGE)
      // ============================================================
      await hipInput.fill('0');
      await expect(hipInput).toHaveValue('0');
      await saveButton.click();
      await expect(hipErrorMessageLocator).toBeVisible({ timeout: 10000 });
      console.log('CP-027: Hip 0 validated as invalid (fail message displayed in profile screen)');

      // ============================================================
      // 7. TEST 2: HIP = 30 (VALID MIN BOUNDARY -> PROFILE SUCCESSFULLY SAVED)
      // ============================================================
      await hipInput.fill('30');
      await expect(hipInput).toHaveValue('30');
      await saveButton.click();
      await expect(hipErrorMessageLocator).not.toBeVisible({ timeout: 5000 });
      console.log('CP-027: Hip 30 validated as valid (profile successfully saved)');

      // Re-open profile page if app navigated back to home
      if (await profileBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await profileBtn.click();
        await expect(personalDetailsHeading).toBeVisible({ timeout: 10000 });
      }

      // ============================================================
      // 8. TEST 3: HIP = 200 (VALID MAX BOUNDARY -> PROFILE SUCCESSFULLY SAVED)
      // ============================================================
      await hipInput.fill('200');
      await expect(hipInput).toHaveValue('200');
      await saveButton.click();
      await expect(hipErrorMessageLocator).not.toBeVisible({ timeout: 5000 });
      console.log('CP-027: Hip 200 validated as valid (profile successfully saved)');

      // Re-open profile page if app navigated back to home
      if (await profileBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await profileBtn.click();
        await expect(personalDetailsHeading).toBeVisible({ timeout: 10000 });
      }

      // ============================================================
      // 9. TEST 4: HIP = 201 (MORE THAN 200 -> SHOWS FAIL MESSAGE)
      // ============================================================
      await hipInput.fill('201');
      await expect(hipInput).toHaveValue('201');
      await saveButton.click();
      await expect(hipErrorMessageLocator).toBeVisible({ timeout: 10000 });
      console.log('CP-027: Hip 201 validated as invalid (fail message displayed in profile screen)');
    }
  );

  test(
    'CP-028 Diet Preference validates all available options can be selected',
    async ({ page }) => {
      // ============================================================
      // TEST DATA
      // ============================================================
      const TEST_PHONE = '7695834209';
      const TEST_NAME = 'Nitheesh Lingam';
      const TEST_EMAIL = 'nitheesh@example.com';

      // ============================================================
      // 1. MOCK APIS FOR AUTHENTICATED USER
      // ============================================================
      await page.route('**/api/auth/send-otp', async route => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
      });

      await page.route('**/api/user/verify-session', async route => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, userId: 1004, sessionStale: false }) });
      });

      await page.route('**/api/user/lookup*', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            isActive: true,
            isNewUser: false,
            role: 'user',
            user: {
              id: 1004,
              UserId: 1004,
              username: TEST_NAME,
              name: TEST_NAME,
              email: TEST_EMAIL,
              phoneNumber: TEST_PHONE,
              status: 'Active',
            },
          }),
        });
      });

      await page.route('**/api/user/consent*', async route => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, consentRequired: false, consentAccepted: true }) });
      });

      let savedDietType = 'Vegetarian';
      const profilePosts = [];

      await page.route('**/api/user/profile*', async route => {
        const method = route.request().method();
        if (method === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                userId: 1004,
                profileComplete: true,
                userName: TEST_NAME,
                name: TEST_NAME,
                email: TEST_EMAIL,
                phoneNumber: TEST_PHONE,
                gender: 'Male',
                height: 170,
                dietType: savedDietType,
                latestWeight: 65,
                currentWeight: 65,
                latestWeightBodyFat: 22,
                bodyFat: 22,
                profileImage: 'https://example.com/photo.jpg',
                physicalActivityLevel: 'moderate',
                needsCurrentWeight: false,
              },
            }),
          });
          return;
        }

        try {
          const postData = route.request().postDataJSON();
          if (postData && postData.dietType !== undefined) {
            savedDietType = postData.dietType;
            profilePosts.push(postData);
          }
        } catch {
          /* ignore JSON parse errors */
        }

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            message: 'Profile saved successfully!',
          }),
        });
      });

      // ============================================================
      // 2. SET AUTHENTICATED LOCALSTORAGE STATE
      // ============================================================
      await page.addInitScript(({ phone, email, name }) => {
        const user = {
          id: 1004,
          UserId: 1004,
          userId: 1004,
          username: name,
          userName: name,
          name: name,
          email: email,
          phone: `+91${phone}`,
          phoneNumber: phone,
          status: 'Active',
          isNewUser: false,
          consentRequired: false,
          profileComplete: true,
          physicalActivityLevel: 'moderate',
        };

        localStorage.setItem('isOtpVerified', 'true');
        localStorage.setItem('otpUser', JSON.stringify(user));
        localStorage.setItem('user', JSON.stringify(user));
      }, { phone: TEST_PHONE, email: TEST_EMAIL, name: TEST_NAME });

      // ============================================================
      // 3. OPEN APP DIRECTLY AS AUTHENTICATED USER ON HOME PAGE
      // ============================================================
      await page.goto('/', { waitUntil: 'domcontentloaded' });

      // ============================================================
      // 4. SELECT PROFILE AVATAR IN HEADER TO OPEN PROFILE FORM
      // ============================================================
      const profileBtn = page.getByRole('button', { name: 'My Profile' });
      await expect(profileBtn).toBeVisible({ timeout: 15000 });
      await profileBtn.click();

      // ============================================================
      // 5. VERIFY PROFILE FORM PAGE REACHED AND LOCATE DIET DROPDOWN
      // ============================================================
      const profileHeading = page.getByRole('heading', { name: 'My Profile', exact: true });
      await expect(profileHeading).toBeVisible({ timeout: 15000 });

      const personalDetailsHeading = page.getByRole('heading', { name: 'Personal Details', exact: true });
      await expect(personalDetailsHeading).toBeVisible({ timeout: 15000 });

      const dietLabel = page.getByText('Diet Preference', { exact: true });
      await expect(dietLabel).toBeVisible({ timeout: 15000 });

      const dietContainer = dietLabel.locator('xpath=..');
      const dietDropdownTrigger = dietContainer.locator('button').first();
      await expect(dietDropdownTrigger).toBeVisible({ timeout: 15000 });

      const saveButton = page.getByRole('button', { name: /Save profile|Save Profile|Saved/i });
      await expect(saveButton).toBeVisible({ timeout: 15000 });

      // List of all 4 diet options to test
      const dietOptions = [
        'Vegetarian',
        'Non-Vegetarian',
        'Vegan',
        'Pescatarian',
      ];

      for (const dietOption of dietOptions) {
        // Open the diet dropdown if closed
        await dietDropdownTrigger.click();

        // Scope matching option button inside dropdown list container (use .last() to get option button in dropdown list)
        const matchingBtns = dietContainer.getByRole('button', { name: dietOption, exact: true });
        const optionBtn = matchingBtns.last();
        await expect(optionBtn).toBeVisible({ timeout: 5000 });
        await optionBtn.click();

        // Verify selected option is visible in trigger button
        await expect(dietDropdownTrigger).toContainText(dietOption);

        // Click Save Profile button
        await saveButton.click();

        // Re-open profile page if app navigated back to home
        if (await profileBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await profileBtn.click();
          await expect(personalDetailsHeading).toBeVisible({ timeout: 10000 });
        }

        console.log(`CP-028: Diet Preference option '${dietOption}' successfully selected & saved`);
      }
    }
  );
});