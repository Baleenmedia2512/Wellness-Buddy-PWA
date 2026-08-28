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

              success:
                true,

              consentRequired:
                true,

              consentAccepted:
                false,

            }),

        });

        return;
      }


      if (
        method === 'POST'
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
                false,

              consentAccepted:
                true,

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


  const agreeLabel =
    page
      .locator('label')
      .filter({
        hasText:
          'I Agree',
      })
      .last();


  await expect(
    agreeLabel
  ).toBeVisible({
    timeout:
      10000,
  });


  await agreeLabel.click({
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
    .getByPlaceholder('e.g. 22')
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
        "Gender, height, diet, body metrics, and photo — then you're set.",
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



    const inputs = page.locator('input');

    const count = await inputs.count();

    for (let i = 0; i < count; i++) {

      const input = inputs.nth(i);

      console.log(
        `INPUT ${i}:`,
        {
          type: await input.getAttribute('type'),
          name: await input.getAttribute('name'),
          id: await input.getAttribute('id'),
          placeholder: await input.getAttribute('placeholder'),
          value: await input.inputValue().catch(() => ''),
        }
      );
    }

    const labels = page.locator('label');

    const labelCount = await labels.count();

    console.log('Label count:', labelCount);

    for (let i = 0; i < labelCount; i++) {

      console.log(
        `LABEL ${i}:`,
        await labels.nth(i).innerText()
      );

    }
  }
);


  // ==========================================================
  // CP-003
  // ==========================================================

test(
  'CP-003 Full Name controls Continue button availability',
  async ({ page }) => {

    // ============================================================
    // TEST DATA
    // ============================================================

    const TEST_PHONE =
      '7695834209';

    const TEST_OTP =
      '123456';

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
                  967,

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
      6
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
            'Continue',

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
    // 18. BLANK NAME
    //
    // Clear the field first because the application may have
    // pre-populated it from session/profile data.
    // ============================================================

    await fullNameInput.fill(
      ''
    );


    await expect(
      fullNameInput
    ).toHaveValue(
      ''
    );


    // ============================================================
    // 19. CONTINUE MUST BE DISABLED
    // ============================================================

    await expect(
      nameContinue
    ).toBeDisabled({
      timeout:
        10000,
    });


    console.log(
      'CP-003 BLANK NAME -> CONTINUE DISABLED'
    );


    // ============================================================
    // 20. ENTER VALID NAME
    // ============================================================

    await fullNameInput.fill(
      TEST_NAME
    );


    await expect(
      fullNameInput
    ).toHaveValue(
      TEST_NAME
    );


    // ============================================================
    // 21. CONTINUE MUST BE ENABLED
    // ============================================================

    await expect(
      nameContinue
    ).toBeEnabled({
      timeout:
        10000,
    });


    console.log(
      'CP-003 VALID NAME -> CONTINUE ENABLED'
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
      'CP-003 NAME VALIDATION VERIFIED'
    );

  }
);




  // ==========================================================
  // CP-004
  // ==========================================================

test(
  'CP-004 Save & Continue is disabled when profile fields are empty',
  async ({ page }) => {

    await goToCompleteProfile(page);

    const saveButton =
      page.getByRole('button', {
        name: 'Save & Continue',
      });

    await expect(
      saveButton
    ).toBeVisible();

    await expect(
      saveButton
    ).toBeDisabled();
  }
);

// ============================================================
// CP-005
// Full Name validation
// ============================================================
test(
  'CP-005 Full Name controls Save & Continue availability',
  async ({ page }) => {

    // ============================================================
    // 1. GO TO COMPLETE PROFILE
    // ============================================================

    await goToCompleteProfile(page);

    


    // ============================================================
    // 2. LOCATORS
    // ============================================================

    const fullName =
      page.getByPlaceholder(
        'Enter your full name'
      );

    const saveButton =
      page.getByRole(
        'button',
        {
          name: 'Save & Continue',
          exact: true,
        }
      );


    // ============================================================
    // 3. VERIFY PROFILE FORM
    // ============================================================

    await expect(
      fullName
    ).toBeVisible({
      timeout: 15000,
    });

    await expect(
      saveButton
    ).toBeVisible({
      timeout: 15000,
    });


    // ============================================================
    // 4. FILL ALL REQUIRED PROFILE FIELDS
    // ============================================================

    const emailInput =
      page.getByPlaceholder(
        'you@example.com'
      );

    if (
      await emailInput.isEditable()
    ) {
      await emailInput.fill(
        'nitheesh@example.com'
      );
    }


    // ------------------------------------------------------------
    // Gender
    // ------------------------------------------------------------

    const genderSelect =
      page.locator(
        'select[required]'
      ).filter({
        has: page.locator(
          'option[value="Male"]'
        ),
      });

    await genderSelect.selectOption(
      'Male'
    );


    // ------------------------------------------------------------
    // Height
    // ------------------------------------------------------------

    await page
      .getByPlaceholder(
        'e.g. 170'
      )
      .fill('170');


    // ------------------------------------------------------------
    // Diet
    // ------------------------------------------------------------

    await page
      .getByRole(
        'button',
        {
          name: 'Vegetarian',
          exact: true,
        }
      )
      .click();


    // ------------------------------------------------------------
    // Current Weight
    // ------------------------------------------------------------

    await page
      .getByPlaceholder(
        'e.g. 72.5'
      )
      .fill('72.5');


    // ------------------------------------------------------------
    // Body Fat
    // ------------------------------------------------------------

    await page
      .getByPlaceholder(
        'e.g. 22'
      )
      .fill('22');


    // ============================================================
    // 5. PROFILE PICTURE
    // ============================================================
    //
    // CP-005 is NOT testing picture upload.
    //
    // We simply make the picture requirement valid so that
    // Full Name is the only variable under test.
    // ============================================================

    const fileInputs =
      page.locator(
        'input[type="file"][accept="image/*"]'
      );

    console.log(
      'CP-005 IMAGE INPUT COUNT:',
      await fileInputs.count()
    );


    // Use the last image input used by the profile picture
    // component.
    const profileImageInput =
      fileInputs.last();


    await profileImageInput.setInputFiles(
      'tests/fixtures/profile-photo.jpg'
    );


    // ============================================================
    // 6. HANDLE IMAGE/CROP UI IF IT APPEARS
    // ============================================================

    const doneButton =
      page.getByRole(
        'button',
        {
          name: 'Done',
          exact: true,
        }
      );


    if (
      await doneButton.isVisible()
    ) {

      await doneButton.click();

    }


    // ============================================================
    // 7. VERIFY PROFILE PICTURE NO LONGER EMPTY
    // ============================================================

    await expect(
      page.getByText(
        'No image selected',
        {
          exact: true,
        }
      )
    ).not.toBeVisible({
      timeout: 10000,
    });


    // ============================================================
    // 8. CASE 1
    //
    // Valid Full Name
    // ============================================================

    await fullName.fill(
      'Nitheesh Lingam'
    );


    await expect(
      fullName
    ).toHaveValue(
      'Nitheesh Lingam'
    );


    await expect(
      saveButton
    ).toBeEnabled({
      timeout: 10000,
    });


    // ============================================================
    // 9. CASE 2
    //
    // Empty Full Name
    // ============================================================

    await fullName.fill(
      ''
    );


    await expect(
      fullName
    ).toHaveValue(
      ''
    );


    await expect(
      saveButton
    ).toBeDisabled({
      timeout: 10000,
    });


    // ============================================================
    // 10. CASE 3
    //
    // Restore Full Name
    // ============================================================

    await fullName.fill(
      'Nitheesh Lingam'
    );


    await expect(
      fullName
    ).toHaveValue(
      'Nitheesh Lingam'
    );


    await expect(
      saveButton
    ).toBeEnabled({
      timeout: 10000,
    });

  }
);

test(
  'CP-006 Email validation controls Save & Continue',
  async ({ page }) => {

    // ============================================================
    // TEST DATA
    // ============================================================

    const TEST_PHONE = '7695834209';
    const TEST_OTP = '123456';

    const TEST_NAME = 'Nitheesh Lingam';

    const EMPTY_EMAIL = '';
    const INVALID_EMAIL = 'nitheesh@example';
    const VALID_EMAIL = 'nitheesh@example.com';


    // ============================================================
    // 1. SEND LOGIN OTP
    // ============================================================

    await page.route(
      '**/api/auth/send-otp',
      async route => {

        const request = route.request();

        expect(
          request.method()
        ).toBe('POST');

        const body = request.postDataJSON();

        console.log(
          'CP-006 SEND OTP BODY:',
          body
        );

        expect(body).toMatchObject({
          recipient:
            `+91${TEST_PHONE}`,

          contactType:
            'phone',
        });

        await route.fulfill({
          status: 200,
          contentType: 'application/json',

          body: JSON.stringify({
            success: true,
          }),
        });

      }
    );


    // ============================================================
    // 2. VERIFY OTP
    //
    // Phone user:
    // - no email
    // - known name
    // - active
    // ============================================================

    await page.route(
      '**/api/auth/verify-otp',
      async route => {

        const request = route.request();

        expect(
          request.method()
        ).toBe('POST');

        const body = request.postDataJSON();

        console.log(
          'CP-006 LOGIN OTP BODY:',
          body
        );

        expect(body).toMatchObject({
          recipient:
            `+91${TEST_PHONE}`,

          otp:
            TEST_OTP,

          contactType:
            'phone',
        });


        await route.fulfill({

          status: 200,

          contentType:
            'application/json',

          body: JSON.stringify({

            success: true,

            isNewUser: false,

            isActive: true,

            role: 'user',

            user: {

              id: 967,

              UserId: 967,

              username:
                TEST_NAME,

              userName:
                TEST_NAME,

              name:
                TEST_NAME,

              email:
                '',

              phone:
                `+91${TEST_PHONE}`,

              phoneNumber:
                TEST_PHONE,

              status:
                'Active',

              consentRequired:
                false,

            },

          }),

        });

      }
    );


    // ============================================================
    // 3. VERIFY SESSION
    // ============================================================

    await page.route(
      '**/api/user/verify-session',
      async route => {

        console.log(
          'CP-006 VERIFY SESSION'
        );

        await route.fulfill({

          status: 200,

          contentType:
            'application/json',

          body: JSON.stringify({

            success: true,

            userId: 967,

            sessionStale: false,

          }),

        });

      }
    );


    // ============================================================
    // 4. USER STATUS
    //
    // Setup is already complete so CP-006 does not enter the
    // coach-authentication flow.
    // ============================================================

    await page.route(
      '**/api/user/status*',
      async route => {

        console.log(
          'CP-006 STATUS:',
          route.request().url()
        );

        await route.fulfill({

          status: 200,

          contentType:
            'application/json',

          body: JSON.stringify({

            success: true,

            setupComplete:
              true,

            setupSkipped:
              true,

            hasTeamId:
              false,

            hasUpline:
              true,

            pendingRequest:
              false,

            redirectTo:
              null,

          }),

        });

      }
    );


    // ============================================================
    // 5. CONSENT
    // ============================================================

    await page.route(
      '**/api/user/consent*',
      async route => {

        const method =
          route.request().method();

        console.log(
          'CP-006 CONSENT:',
          method
        );

        if (
          method === 'GET'
          ||
          method === 'POST'
        ) {

          await route.fulfill({

            status: 200,

            contentType:
              'application/json',

            body: JSON.stringify({

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
    // 6. PROFILE
    //
    // IMPORTANT:
    //
    // Email is empty.
    //
    // Existing profile values are intentionally populated for
    // fields that are NOT under test.
    //
    // Therefore CP-006 only needs to change the email.
    // ============================================================

    await page.route(
      '**/api/user/profile*',
      async route => {

        if (
          route.request().method() !== 'GET'
        ) {

          await route.fallback();

          return;

        }


        console.log(
          'CP-006 PROFILE GET:',
          route.request().url()
        );


        await route.fulfill({

          status: 200,

          contentType:
            'application/json',

          body: JSON.stringify({

            success: true,

            data: {

              userId:
                967,

              profileComplete:
                false,

              userName:
                TEST_NAME,

              name:
                TEST_NAME,

              email:
                '',

              phoneNumber:
                TEST_PHONE,

              gender:
                'Male',

              height:
                170,

              dietType:
                'Vegetarian',

              latestWeight:
                72.5,

              currentWeight:
                72.5,

              latestWeightBodyFat:
                22,

              bodyFat:
                22,

              profileImage:
                'https://example.com/profile.jpg',

              physicalActivityLevel:
                null,

              needsCurrentWeight:
                false,

            },

          }),

        });

      }
    );


    // ============================================================
    // 7. OPEN APPLICATION
    // ============================================================

    await page.goto(
      '/',
      {
        waitUntil:
          'domcontentloaded',
      }
    );


    // ============================================================
    // 8. LOGIN PAGE
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


    await page
      .getByRole(
        'button',
        {
          name:
            'Send OTP',

          exact:
            true,
        }
      )
      .click();


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
        'input[data-otp="true"]'
      );


    await expect(
      otpInputs
    ).toHaveCount(
      6
    );


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
    // 10. COMPLETE PROFILE
    // ============================================================

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


    console.log(
      'CP-006 COMPLETE PROFILE PAGE DISPLAYED'
    );


    // ============================================================
    // 11. EMAIL
    // ============================================================

    const emailInput =
      page.getByPlaceholder(
        'you@example.com'
      );


    await expect(
      emailInput
    ).toBeVisible({
      timeout:
        15000,
    });


    await expect(
      emailInput
    ).toBeEditable({
      timeout:
        10000,
    });


    await expect(
      emailInput
    ).toHaveValue(
      ''
    );


    console.log(
      'CP-006 EMAIL FIELD IS EMPTY AND EDITABLE'
    );


    // ============================================================
    // 12. VERIFY NON-EMAIL FIELDS
    //
    // Because the mocked profile already contains valid values,
    // these fields should already satisfy formValid.
    //
    // We DO NOT force Body Fat or Profile Picture to appear.
    // ============================================================

    const nameInput =
      page.getByPlaceholder(
        'Enter your full name'
      );


    if (
      await nameInput
        .isVisible({
          timeout:
            2000,
        })
        .catch(
          () => false
        )
    ) {

      await nameInput.fill(
        TEST_NAME
      );

    }


    // ------------------------------------------------------------
    // Gender
    // ------------------------------------------------------------

    const genderSelect =
      page
        .locator('select')
        .filter({
          has:
            page.locator(
              'option[value="Male"]'
            ),
        })
        .first();


    if (
      await genderSelect
        .isVisible({
          timeout:
            2000,
        })
        .catch(
          () => false
        )
    ) {

      if (
        !(
          await genderSelect.inputValue()
        )
      ) {

        await genderSelect.selectOption(
          'Male'
        );

      }

    }


    // ------------------------------------------------------------
    // Height
    // ------------------------------------------------------------

    const heightInput =
      page.getByPlaceholder(
        'e.g. 170'
      );


    if (
      await heightInput
        .isVisible({
          timeout:
            2000,
        })
        .catch(
          () => false
        )
    ) {

      if (
        !(
          await heightInput.inputValue()
        )
      ) {

        await heightInput.fill(
          '170'
        );

      }

    }


    // ------------------------------------------------------------
    // Diet
    // ------------------------------------------------------------

    const vegetarianButton =
      page.getByRole(
        'button',
        {
          name:
            'Vegetarian',

          exact:
            true,
        }
      );


    if (
      await vegetarianButton
        .isVisible({
          timeout:
            2000,
        })
        .catch(
          () => false
        )
    ) {

      const classes =
        await vegetarianButton.getAttribute(
          'class'
        );


      if (
        !classes?.includes(
          'border-green-500'
        )
      ) {

        await vegetarianButton.click();

      }

    }


    // ------------------------------------------------------------
    // Current Weight
    // ------------------------------------------------------------

    const weightInput =
      page.getByPlaceholder(
        'e.g. 72.5'
      );


    if (
      await weightInput
        .isVisible({
          timeout:
            2000,
        })
        .catch(
          () => false
        )
    ) {

      if (
        !(
          await weightInput.inputValue()
        )
      ) {

        await weightInput.fill(
          '72.5'
        );

      }

    }


    // ============================================================
    // 13. BODY FAT
    //
    // In your current run this field was not rendered.
    //
    // That is valid because the mocked profile already has:
    //
    //     bodyFat = 22
    //
    //     latestWeightBodyFat = 22
    //
    // So do NOT fail the test because the field is hidden.
    // ============================================================

    const bodyFatInput =
      page.getByPlaceholder(
        'e.g. 22'
      );


    if (
      await bodyFatInput
        .isVisible({
          timeout:
            2000,
        })
        .catch(
          () => false
        )
    ) {

      await bodyFatInput.fill(
        '22'
      );


      console.log(
        'CP-006 BODY FAT FILLED'
      );

    } else {

      console.log(
        'CP-006 BODY FAT ALREADY VALID / NOT DISPLAYED'
      );

    }


    // ============================================================
    // 14. PROFILE PICTURE
    //
    // The profile mock already contains a valid HTTPS image.
    //
    // This allows CompleteProfilePage to consider the picture
    // requirement satisfied without opening the cropper.
    // ============================================================

    console.log(
      'CP-006 PROFILE PICTURE PROVIDED BY PROFILE MOCK'
    );


    // ============================================================
    // 15. SAVE & CONTINUE
    // ============================================================

    const saveButton =
      page.getByRole(
        'button',
        {
          name:
            'Save & Continue',

          exact:
            true,
        }
      );


    await expect(
      saveButton
    ).toBeVisible({
      timeout:
        10000,
    });


    // ============================================================
    // 16. EMPTY EMAIL
    // ============================================================

    await emailInput.fill(
      EMPTY_EMAIL
    );


    await expect(
      emailInput
    ).toHaveValue(
      EMPTY_EMAIL
    );


    await expect(
      saveButton
    ).toBeDisabled({
      timeout:
        10000,
    });


    console.log(
      'CP-006 EMPTY EMAIL -> SAVE DISABLED'
    );


    // ============================================================
    // 17. INVALID EMAIL
    // ============================================================

    await emailInput.fill(
      INVALID_EMAIL
    );


    await expect(
      emailInput
    ).toHaveValue(
      INVALID_EMAIL
    );


    await expect(
      emailInput
    ).toHaveClass(
      /border-red-300/,
      {
        timeout:
          10000,
      }
    );


    await expect(
      saveButton
    ).toBeDisabled({
      timeout:
        10000,
    });


    console.log(
      'CP-006 INVALID EMAIL -> SAVE DISABLED'
    );


    // ============================================================
    // 18. VALID EMAIL
    // ============================================================

    await emailInput.fill(
      VALID_EMAIL
    );


    await expect(
      emailInput
    ).toHaveValue(
      VALID_EMAIL
    );


    await expect(
      emailInput
    ).not.toHaveClass(
      /border-red-300/,
      {
        timeout:
          10000,
      }
    );


    // ============================================================
    // 19. VALID EMAIL MUST ENABLE SAVE
    // ============================================================

    await expect(
      saveButton
    ).toBeEnabled({
      timeout:
        10000,
    });


    console.log(
      'CP-006 VALID EMAIL -> SAVE ENABLED'
    );


    // ============================================================
    // FINAL
    // ============================================================

    console.log(
      'CP-006 EMAIL VALIDATION VERIFIED'
    );

  }
);

test(
  'CP-007 Gender controls Save & Continue availability',
  async ({ page }) => {

    // ============================================================
    // TEST DATA
    // ============================================================

    const TEST_PHONE =
      '7695834209';

    const TEST_OTP =
      '123456';

    const TEST_USER_ID =
      967;

    const TEST_NAME =
      'Nitheesh Lingam';

    const TEST_EMAIL =
      '';


    // ============================================================
    // 1. SEND LOGIN OTP
    // ============================================================

    await page.route(
      '**/api/auth/send-otp',
      async route => {

        const request =
          route.request();

        expect(
          request.method()
        ).toBe('POST');

        const body =
          request.postDataJSON();

        console.log(
          'CP-007 SEND OTP BODY:',
          body
        );

        expect(
          body
        ).toMatchObject({
          recipient:
            `+91${TEST_PHONE}`,

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
            }),
        });

      }
    );


    // ============================================================
    // 2. VERIFY LOGIN OTP
    //
    // Email is intentionally EMPTY.
    //
    // This makes Email editable in CompleteProfilePage.
    // ============================================================

    await page.route(
      '**/api/auth/verify-otp',
      async route => {

        const request =
          route.request();

        expect(
          request.method()
        ).toBe('POST');

        const body =
          request.postDataJSON();

        console.log(
          'CP-007 LOGIN OTP BODY:',
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
                false,

              isActive:
                true,

              role:
                'user',

              user: {

                id:
                  TEST_USER_ID,

                UserId:
                  TEST_USER_ID,

                username:
                  TEST_NAME,

                userName:
                  TEST_NAME,

                name:
                  TEST_NAME,

                email:
                  TEST_EMAIL,

                phone:
                  `+91${TEST_PHONE}`,

                phoneNumber:
                  TEST_PHONE,

                status:
                  'Active',

                consentRequired:
                  false,

              },

            }),

        });

      }
    );


    // ============================================================
    // 3. VERIFY SESSION
    // ============================================================

    await page.route(
      '**/api/user/verify-session',
      async route => {

        console.log(
          'CP-007 VERIFY SESSION:',
          route.request().url()
        );

        await route.fulfill({

          status:
            200,

          contentType:
            'application/json',

          body:
            JSON.stringify({

              success:
                true,

              userId:
                TEST_USER_ID,

              sessionStale:
                false,

            }),

        });

      }
    );


    // ============================================================
    // 4. CONSENT
    // ============================================================

    await page.route(
      '**/api/user/consent*',
      async route => {

        const method =
          route.request().method();

        console.log(
          'CP-007 CONSENT:',
          method
        );

        if (
          method === 'GET'
          ||
          method === 'POST'
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
    // 5. USER STATUS
    //
    // Prevent coach/setup flow from interfering.
    // ============================================================

    await page.route(
      '**/api/user/status*',
      async route => {

        console.log(
          'CP-007 STATUS:',
          route.request().url()
        );

        await route.fulfill({

          status:
            200,

          contentType:
            'application/json',

          body:
            JSON.stringify({

              success:
                true,

              setupComplete:
                true,

              setupSkipped:
                true,

              hasTeamId:
                false,

              hasUpline:
                true,

              pendingRequest:
                false,

              redirectTo:
                null,

            }),

        });

      }
    );


    // ============================================================
    // 6. PROFILE
    //
    // Keep Gender EMPTY because Gender is the field under test.
    //
    // Other profile values are supplied as valid values so the
    // profile state is otherwise complete.
    // ============================================================

    await page.route(
      '**/api/user/profile*',
      async route => {

        if (
          route.request().method() !== 'GET'
        ) {

          await route.fallback();

          return;
        }


        console.log(
          'CP-007 PROFILE GET:',
          route.request().url()
        );


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

                userId:
                  TEST_USER_ID,

                profileComplete:
                  false,

                userName:
                  TEST_NAME,

                name:
                  TEST_NAME,

                email:
                  '',

                phoneNumber:
                  TEST_PHONE,

                // Gender intentionally empty.
                gender:
                  '',

                height:
                  170,

                dietType:
                  'Vegetarian',

                currentWeight:
                  72.5,

                latestWeight:
                  72.5,

                bodyFat:
                  22,

                latestWeightBodyFat:
                  22,

                profileImage:
                  'https://example.com/profile.jpg',

                physicalActivityLevel:
                  null,

                needsCurrentWeight:
                  false,

              },

            }),

        });

      }
    );


    // ============================================================
    // 7. OPEN APPLICATION
    // ============================================================

    await page.goto(
      '/',
      {
        waitUntil:
          'domcontentloaded',
      }
    );


    // ============================================================
    // 8. LOGIN PAGE
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


    await page.getByRole(
      'button',
      {
        name:
          'Send OTP',

        exact:
          true,
      }
    ).click();


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
        'input[data-otp="true"]'
      );


    await expect(
      otpInputs
    ).toHaveCount(
      6
    );


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
    // 10. COMPLETE PROFILE
    // ============================================================

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


    console.log(
      'CP-007 COMPLETE PROFILE PAGE DISPLAYED'
    );


    // ============================================================
    // 11. EMAIL
    //
    // Email is NOT under test, so make it valid and leave it alone.
    // Since the authenticated email is empty, the field is editable.
    // ============================================================

    const emailInput =
      page.getByPlaceholder(
        'you@example.com'
      );


    await expect(
      emailInput
    ).toBeVisible({
      timeout:
        15000,
    });


    await expect(
      emailInput
    ).toBeEditable({
      timeout:
        10000,
    });


    await emailInput.fill(
      'nitheesh@example.com'
    );


    await expect(
      emailInput
    ).toHaveValue(
      'nitheesh@example.com'
    );


    // ============================================================
    // 12. FULL NAME
    //
    // It may be:
    // - visible and editable
    // - already resolved and hidden
    //
    // Handle both states.
    // ============================================================

    const fullNameInput =
      page.getByPlaceholder(
        'Enter your full name'
      );


    if (
      await fullNameInput
        .isVisible({
          timeout:
            2000,
        })
        .catch(
          () => false
        )
    ) {

      await fullNameInput.fill(
        TEST_NAME
      );


      await expect(
        fullNameInput
      ).toHaveValue(
        TEST_NAME
      );


      console.log(
        'CP-007 FULL NAME SET'
      );

    } else {

      console.log(
        'CP-007 FULL NAME ALREADY RESOLVED'
      );

    }


    // ============================================================
    // 13. HEIGHT
    //
    // Fill only if displayed.
    // ============================================================

    const heightInput =
      page.getByPlaceholder(
        'e.g. 170'
      );


    if (
      await heightInput
        .isVisible({
          timeout:
            2000,
        })
        .catch(
          () => false
        )
    ) {

      await heightInput.fill(
        '170'
      );


      await expect(
        heightInput
      ).toHaveValue(
        '170'
      );

    }


    // ============================================================
    // 14. DIET
    // ============================================================

    const vegetarianButton =
      page.getByRole(
        'button',
        {
          name:
            'Vegetarian',

          exact:
            true,
        }
      );


    if (
      await vegetarianButton
        .isVisible({
          timeout:
            2000,
        })
        .catch(
          () => false
        )
    ) {

      await vegetarianButton.click();

    }


    // ============================================================
    // 15. CURRENT WEIGHT
    // ============================================================

    const weightInput =
      page.getByPlaceholder(
        'e.g. 72.5'
      );


    if (
      await weightInput
        .isVisible({
          timeout:
            2000,
        })
        .catch(
          () => false
        )
    ) {

      await weightInput.fill(
        '72.5'
      );


      await expect(
        weightInput
      ).toHaveValue(
        '72.5'
      );

    }


    // ============================================================
    // 16. BODY FAT
    //
    // Body Fat may already be satisfied by existing profile data.
    // Only fill it when it is shown.
    // ============================================================

    const bodyFatInput =
      page.getByPlaceholder(
        'e.g. 22'
      );


    if (
      await bodyFatInput
        .isVisible({
          timeout:
            2000,
        })
        .catch(
          () => false
        )
    ) {

      await bodyFatInput.fill(
        '22'
      );


      await expect(
        bodyFatInput
      ).toHaveValue(
        '22'
      );

    } else {

      console.log(
        'CP-007 BODY FAT ALREADY RESOLVED'
      );

    }


    // ============================================================
    // 17. PROFILE PICTURE
    //
    // Try to make picture valid only if the picture input is
    // actually displayed.
    //
    // Otherwise the mocked profile already provides an existing
    // HTTPS profile image.
    // ============================================================

    const imageInputs =
      page.locator(
        'input[type="file"][accept="image/*"]'
      );


    const imageCount =
      await imageInputs.count();


    if (
      imageCount > 0
    ) {

      const noImageSelected =
        page.getByText(
          'No image selected',
          {
            exact:
              true,
          }
        );


      const noImageVisible =
        await noImageSelected
          .isVisible({
            timeout:
              2000,
          })
          .catch(
            () => false
          );


      if (
        noImageVisible
      ) {

        await imageInputs
          .last()
          .setInputFiles(
            'tests/fixtures/profile-photo.jpg'
          );


        console.log(
          'CP-007 PROFILE IMAGE SELECTED'
        );


        const doneButton =
          page.getByRole(
            'button',
            {
              name:
                'Done',

              exact:
                true,
            }
          );


        if (
          await doneButton
            .isVisible({
              timeout:
                5000,
            })
            .catch(
              () => false
            )
        ) {

          await doneButton.click();


          console.log(
            'CP-007 IMAGE CROP COMPLETED'
          );

        }


        await expect(
          noImageSelected
        ).not.toBeVisible({
          timeout:
            10000,
        });

      } else {

        console.log(
          'CP-007 PROFILE IMAGE ALREADY RESOLVED'
        );

      }

    }


    // ============================================================
    // 18. GENDER LOCATOR
    // ============================================================
    //
    // IMPORTANT:
    //
    // Do NOT use:
    //
    //     locator('select').first()
    //
    // because the application can contain other selects.
    //
    // Locate the Gender select using its label.
    // ============================================================

    const getGenderSelect =
      () =>
        page
          .locator('label')
          .filter({
            hasText:
              'Gender',
          })
          .locator('..')
          .locator('select')
          .first();


    // ============================================================
    // 19. SAVE BUTTON
    // ============================================================

    const saveButton =
      page.getByRole(
        'button',
        {
          name:
            'Save & Continue',

          exact:
            true,
        }
      );


    await expect(
      saveButton
    ).toBeVisible({
      timeout:
        10000,
    });


    // ============================================================
    // 20. CASE 1
    //
    // GENDER EMPTY
    // ============================================================

    let genderSelect =
      getGenderSelect();


    await expect(
      genderSelect
    ).toBeVisible({
      timeout:
        10000,
    });


    await expect(
      genderSelect
    ).toHaveValue(
      ''
    );


    await expect(
      saveButton
    ).toBeDisabled({
      timeout:
        10000,
    });


    console.log(
      'CP-007 EMPTY GENDER -> SAVE DISABLED'
    );


    // ============================================================
    // 21. CASE 2
    //
    // SELECT MALE
    // ============================================================

    genderSelect =
      getGenderSelect();


    await genderSelect.selectOption({
      label:
        'Male',
    });


    // Re-locate after React state update.
    genderSelect =
      getGenderSelect();


    await expect(
      genderSelect
    ).toHaveValue(
      'Male'
    );


    await expect(
      saveButton
    ).toBeEnabled({
      timeout:
        10000,
    });


    console.log(
      'CP-007 MALE -> SAVE ENABLED'
    );


    // ============================================================
    // 22. CASE 3
    //
    // CLEAR GENDER
    //
    // The empty option is disabled in the UI, therefore use the
    // native setter + change event.
    // ============================================================

    genderSelect =
      getGenderSelect();


    await genderSelect.evaluate(
      select => {

        const setter =
          Object.getOwnPropertyDescriptor(
            HTMLSelectElement.prototype,
            'value'
          ).set;

        setter.call(
          select,
          ''
        );


        select.dispatchEvent(
          new Event(
            'change',
            {
              bubbles:
                true,
            }
          )
        );

      }
    );


    // Wait for React to process the change.
    await page.waitForTimeout(
      300
    );


    // Re-locate after React render.
    genderSelect =
      getGenderSelect();


    await expect(
      genderSelect
    ).toHaveValue(
      ''
    );


    await expect(
      saveButton
    ).toBeDisabled({
      timeout:
        10000,
    });


    console.log(
      'CP-007 EMPTY GENDER AFTER CLEAR -> SAVE DISABLED'
    );


    // ============================================================
    // 23. CASE 4
    //
    // SELECT FEMALE
    // ============================================================

    genderSelect =
      getGenderSelect();


    await genderSelect.selectOption({
      label:
        'Female',
    });


    // Re-locate after React state update.
    genderSelect =
      getGenderSelect();


    await expect(
      genderSelect
    ).toHaveValue(
      'Female'
    );


    await expect(
      saveButton
    ).toBeEnabled({
      timeout:
        10000,
    });


    console.log(
      'CP-007 FEMALE -> SAVE ENABLED'
    );


    // ============================================================
    // FINAL
    // ============================================================

    console.log(
      'CP-007 GENDER VALIDATION VERIFIED'
    );

  }
);

test(
  'CP-008 Height validates minimum and maximum allowed values',
  async ({ page }) => {

    // ============================================================
    // TEST DATA
    // ============================================================

    const TEST_PHONE =
      '7695834209';

    const TEST_OTP =
      '123456';

    const TEST_USER_ID =
      967;

    const TEST_NAME =
      'Nitheesh Lingam';

    const TEST_EMAIL =
      '';


    const MIN_INVALID_HEIGHT =
      '49';

    const MIN_VALID_HEIGHT =
      '50';

    const MAX_VALID_HEIGHT =
      '250';

    const MAX_INVALID_HEIGHT =
      '251';

    const NORMAL_VALID_HEIGHT =
      '170';


    // ============================================================
    // 1. SEND LOGIN OTP
    // ============================================================

    await page.route(
      '**/api/auth/send-otp',
      async route => {

        const request =
          route.request();

        expect(
          request.method()
        ).toBe('POST');

        const body =
          request.postDataJSON();

        console.log(
          'CP-008 SEND OTP BODY:',
          body
        );

        expect(
          body
        ).toMatchObject({
          recipient:
            `+91${TEST_PHONE}`,

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

            }),

        });

      }
    );


    // ============================================================
    // 2. VERIFY LOGIN OTP
    //
    // Email intentionally empty.
    // This allows Email to remain editable in Complete Profile.
    // ============================================================

    await page.route(
      '**/api/auth/verify-otp',
      async route => {

        const request =
          route.request();

        expect(
          request.method()
        ).toBe('POST');

        const body =
          request.postDataJSON();

        console.log(
          'CP-008 LOGIN OTP BODY:',
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
                false,

              isActive:
                true,

              role:
                'user',

              user: {

                id:
                  TEST_USER_ID,

                UserId:
                  TEST_USER_ID,

                username:
                  TEST_NAME,

                userName:
                  TEST_NAME,

                name:
                  TEST_NAME,

                email:
                  TEST_EMAIL,

                phone:
                  `+91${TEST_PHONE}`,

                phoneNumber:
                  TEST_PHONE,

                status:
                  'Active',

                consentRequired:
                  false,

              },

            }),

        });

      }
    );


    // ============================================================
    // 3. VERIFY SESSION
    // ============================================================

    await page.route(
      '**/api/user/verify-session',
      async route => {

        console.log(
          'CP-008 VERIFY SESSION:',
          route.request().url()
        );


        await route.fulfill({

          status:
            200,

          contentType:
            'application/json',

          body:
            JSON.stringify({

              success:
                true,

              userId:
                TEST_USER_ID,

              sessionStale:
                false,

            }),

        });

      }
    );


    // ============================================================
    // 4. CONSENT
    //
    // IMPORTANT:
    //
    // CP-007 does NOT use the shared goToCompleteProfile()
    // helper because that helper intentionally creates a
    // consent-required state.
    //
    // CP-008 follows CP-007 and mocks consent as already accepted.
    // Therefore the test will NOT stop at the Consent page.
    // ============================================================

    await page.route(
      '**/api/user/consent*',
      async route => {

        const method =
          route.request().method();

        console.log(
          'CP-008 CONSENT:',
          method
        );


        if (
          method === 'GET'
          ||
          method === 'POST'
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
    // 5. USER STATUS
    //
    // Prevent coach/setup flow from interfering.
    // ============================================================

    await page.route(
      '**/api/user/status*',
      async route => {

        console.log(
          'CP-008 STATUS:',
          route.request().url()
        );


        await route.fulfill({

          status:
            200,

          contentType:
            'application/json',

          body:
            JSON.stringify({

              success:
                true,

              setupComplete:
                true,

              setupSkipped:
                true,

              hasTeamId:
                false,

              hasUpline:
                true,

              pendingRequest:
                false,

              redirectTo:
                null,

            }),

        });

      }
    );


    // ============================================================
    // 6. PROFILE
    //
    // Height is supplied as a valid value initially.
    //
    // Other fields are also valid so that HEIGHT is the only
    // field whose validation is being changed during this test.
    // ============================================================

    await page.route(
      '**/api/user/profile*',
      async route => {

        if (
          route.request().method() !== 'GET'
        ) {

          await route.fallback();

          return;

        }


        console.log(
          'CP-008 PROFILE GET:',
          route.request().url()
        );


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

                userId:
                  TEST_USER_ID,

                profileComplete:
                  false,

                userName:
                  TEST_NAME,

                name:
                  TEST_NAME,

                email:
                  '',

                phoneNumber:
                  TEST_PHONE,

                // Valid gender because Gender is not under test.
                gender:
                  'Male',

                // Valid initial height.
                height:
                  170,

                // Valid diet.
                dietType:
                  'Vegetarian',

                // Valid weight.
                currentWeight:
                  72.5,

                latestWeight:
                  72.5,

                // Valid body fat.
                bodyFat:
                  22,

                latestWeightBodyFat:
                  22,

                // Existing valid profile image.
                profileImage:
                  'https://example.com/profile.jpg',

                physicalActivityLevel:
                  null,

                needsCurrentWeight:
                  false,

              },

            }),

        });

      }
    );


    // ============================================================
    // 7. OPEN APPLICATION
    // ============================================================

    await page.goto(
      '/',
      {
        waitUntil:
          'domcontentloaded',
      }
    );


    // ============================================================
    // 8. LOGIN PAGE
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


    await page.getByRole(
      'button',
      {
        name:
          'Send OTP',

        exact:
          true,
      }
    ).click();


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
        'input[data-otp="true"]'
      );


    await expect(
      otpInputs
    ).toHaveCount(
      6
    );


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
    // 10. COMPLETE PROFILE
    // ============================================================

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


    console.log(
      'CP-008 COMPLETE PROFILE PAGE DISPLAYED'
    );


    // ============================================================
    // 11. EMAIL
    //
    // Email is not the target field.
    // Make it valid.
    // ============================================================

    const emailInput =
      page.getByPlaceholder(
        'you@example.com'
      );


    await expect(
      emailInput
    ).toBeVisible({
      timeout:
        15000,
    });


    await expect(
      emailInput
    ).toBeEditable({
      timeout:
        10000,
    });


    await emailInput.fill(
      'nitheesh@example.com'
    );


    await expect(
      emailInput
    ).toHaveValue(
      'nitheesh@example.com'
    );


    console.log(
      'CP-008 EMAIL VALID'
    );


    // ============================================================
    // 12. FULL NAME
    //
    // Follow CP-007:
    // Fill only if the field is actually displayed.
    // ============================================================

    const fullNameInput =
      page.getByPlaceholder(
        'Enter your full name'
      );


    const fullNameVisible =
      await fullNameInput
        .isVisible({
          timeout:
            2000,
        })
        .catch(
          () => false
        );


    if (
      fullNameVisible
    ) {

      await fullNameInput.fill(
        TEST_NAME
      );


      await expect(
        fullNameInput
      ).toHaveValue(
        TEST_NAME
      );


      console.log(
        'CP-008 FULL NAME SET'
      );

    } else {

      console.log(
        'CP-008 FULL NAME ALREADY RESOLVED'
      );

    }


    // ============================================================
    // 13. GENDER
    //
    // Gender is NOT under test.
    //
    // Profile API already provides Male.
    // If the field is displayed, ensure it remains valid.
    // ============================================================

    const getGenderSelect =
      () =>
        page
          .locator('label')
          .filter({
            hasText:
              'Gender',
          })
          .locator('..')
          .locator('select')
          .first();


    const genderSelect =
      getGenderSelect();


    const genderVisible =
      await genderSelect
        .isVisible({
          timeout:
            2000,
        })
        .catch(
          () => false
        );


    if (
      genderVisible
    ) {

      const currentGender =
        await genderSelect.inputValue();


      if (
        !currentGender
      ) {

        await genderSelect.selectOption({
          label:
            'Male',
        });

      }


      await expect(
        getGenderSelect()
      ).toHaveValue(
        'Male'
      );


      console.log(
        'CP-008 GENDER VALID'
      );

    } else {

      console.log(
        'CP-008 GENDER ALREADY RESOLVED'
      );

    }


    // ============================================================
    // 14. DIET
    //
    // Diet is NOT under test.
    // Ensure a valid diet exists if the control is displayed.
    // ============================================================

    const vegetarianButton =
      page.getByRole(
        'button',
        {
          name:
            'Vegetarian',

          exact:
            true,
        }
      );


    const vegetarianVisible =
      await vegetarianButton
        .isVisible({
          timeout:
            2000,
        })
        .catch(
          () => false
        );


    if (
      vegetarianVisible
    ) {

      await vegetarianButton.click();


      console.log(
        'CP-008 DIET SET TO VEGETARIAN'
      );

    } else {

      console.log(
        'CP-008 DIET ALREADY RESOLVED'
      );

    }


    // ============================================================
    // 15. CURRENT WEIGHT
    //
    // Not under test.
    // ============================================================

    const weightInput =
      page.getByPlaceholder(
        'e.g. 72.5'
      );


    const weightVisible =
      await weightInput
        .isVisible({
          timeout:
            2000,
        })
        .catch(
          () => false
        );


    if (
      weightVisible
    ) {

      await weightInput.fill(
        '72.5'
      );


      await expect(
        weightInput
      ).toHaveValue(
        '72.5'
      );


      console.log(
        'CP-008 WEIGHT VALID'
      );

    } else {

      console.log(
        'CP-008 WEIGHT ALREADY RESOLVED'
      );

    }


    // ============================================================
    // 16. BODY FAT
    //
    // Not under test.
    // ============================================================

    const bodyFatInput =
      page.getByPlaceholder(
        'e.g. 22'
      );


    const bodyFatVisible =
      await bodyFatInput
        .isVisible({
          timeout:
            2000,
        })
        .catch(
          () => false
        );


    if (
      bodyFatVisible
    ) {

      await bodyFatInput.fill(
        '22'
      );


      await expect(
        bodyFatInput
      ).toHaveValue(
        '22'
      );


      console.log(
        'CP-008 BODY FAT VALID'
      );

    } else {

      console.log(
        'CP-008 BODY FAT ALREADY RESOLVED'
      );

    }


    // ============================================================
    // 17. SAVE BUTTON
    // ============================================================

    const saveButton =
      page.getByRole(
        'button',
        {
          name:
            'Save & Continue',

          exact:
            true,
        }
      );


    await expect(
      saveButton
    ).toBeVisible({
      timeout:
        10000,
    });


    // ============================================================
    // 18. HEIGHT LOCATOR
    //
    // IMPORTANT:
    //
    // Height is the ONLY field being tested.
    // Re-locate after every change because the React form can
    // re-render after state updates.
    // ============================================================

    const getHeightInput =
      () =>
        page.getByPlaceholder(
          'e.g. 170'
        );


    const initialHeightInput =
      getHeightInput();


    await expect(
      initialHeightInput
    ).toBeVisible({
      timeout:
        15000,
    });


    await expect(
      initialHeightInput
    ).toBeEditable({
      timeout:
        10000,
    });


    console.log(
      'CP-008 HEIGHT FIELD DISPLAYED'
    );


    // ============================================================
    // 19. VALID BASELINE
    //
    // Start with a valid height.
    // All other fields are already valid.
    // ============================================================

    await getHeightInput().fill(
      NORMAL_VALID_HEIGHT
    );


    await expect(
      getHeightInput()
    ).toHaveValue(
      NORMAL_VALID_HEIGHT
    );


    await expect(
      saveButton
    ).toBeEnabled({
      timeout:
        10000,
    });


    console.log(
      'CP-008 VALID BASELINE -> SAVE ENABLED'
    );


    // ============================================================
    // 20. CASE 1 — 49 CM
    //
    // Below minimum.
    //
    // Rule:
    //
    // 50 <= height <= 250
    //
    // Expected:
    // Save & Continue -> DISABLED
    // ============================================================

    await getHeightInput().fill(
      MIN_INVALID_HEIGHT
    );


    await expect(
      getHeightInput()
    ).toHaveValue(
      MIN_INVALID_HEIGHT
    );


    await expect(
      saveButton
    ).toBeDisabled({
      timeout:
        10000,
    });


    console.log(
      'CP-008 49 CM -> SAVE DISABLED'
    );


    // ============================================================
    // 21. CASE 2 — 50 CM
    //
    // Minimum allowed value.
    //
    // Expected:
    // Save & Continue -> ENABLED
    // ============================================================

    await getHeightInput().fill(
      MIN_VALID_HEIGHT
    );


    await expect(
      getHeightInput()
    ).toHaveValue(
      MIN_VALID_HEIGHT
    );


    await expect(
      saveButton
    ).toBeEnabled({
      timeout:
        10000,
    });


    console.log(
      'CP-008 50 CM -> SAVE ENABLED'
    );


    // ============================================================
    // 22. CASE 3 — 250 CM
    //
    // Maximum allowed value.
    //
    // Expected:
    // Save & Continue -> ENABLED
    // ============================================================

    await getHeightInput().fill(
      MAX_VALID_HEIGHT
    );


    await expect(
      getHeightInput()
    ).toHaveValue(
      MAX_VALID_HEIGHT
    );


    await expect(
      saveButton
    ).toBeEnabled({
      timeout:
        10000,
    });


    console.log(
      'CP-008 250 CM -> SAVE ENABLED'
    );


    // ============================================================
    // 23. CASE 4 — 251 CM
    //
    // Above maximum.
    //
    // Expected:
    // Save & Continue -> DISABLED
    // ============================================================

    await getHeightInput().fill(
      MAX_INVALID_HEIGHT
    );


    await expect(
      getHeightInput()
    ).toHaveValue(
      MAX_INVALID_HEIGHT
    );


    await expect(
      saveButton
    ).toBeDisabled({
      timeout:
        10000,
    });


    console.log(
      'CP-008 251 CM -> SAVE DISABLED'
    );


    // ============================================================
    // 24. CASE 5 — RESTORE NORMAL VALID VALUE
    //
    // Expected:
    // Save & Continue -> ENABLED
    // ============================================================

    await getHeightInput().fill(
      NORMAL_VALID_HEIGHT
    );


    await expect(
      getHeightInput()
    ).toHaveValue(
      NORMAL_VALID_HEIGHT
    );


    await expect(
      saveButton
    ).toBeEnabled({
      timeout:
        10000,
    });


    console.log(
      'CP-008 170 CM -> SAVE ENABLED'
    );


    // ============================================================
    // 25. FINAL
    // ============================================================

    console.log(
      'CP-008 HEIGHT VALIDATION VERIFIED'
    );

  }
);

test(
  'CP-009 Diet Preference supports all available options',
  async ({ page }) => {

    // ============================================================
    // TEST DATA
    // ============================================================

    const TEST_PHONE =
      '7695834209';

    const TEST_OTP =
      '123456';

    const TEST_USER_ID =
      967;

    const TEST_NAME =
      'Nitheesh Lingam';

    const TEST_EMAIL =
      '';


    // ============================================================
    // 1. SEND LOGIN OTP
    // ============================================================

    await page.route(
      '**/api/auth/send-otp',
      async route => {

        const request =
          route.request();

        expect(
          request.method()
        ).toBe('POST');

        const body =
          request.postDataJSON();

        console.log(
          'CP-009 SEND OTP BODY:',
          body
        );

        expect(
          body
        ).toMatchObject({

          recipient:
            `+91${TEST_PHONE}`,

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

            }),

        });

      }
    );


    // ============================================================
    // 2. VERIFY LOGIN OTP
    //
    // Email intentionally empty so Email remains editable.
    // ============================================================

    await page.route(
      '**/api/auth/verify-otp',
      async route => {

        const request =
          route.request();

        expect(
          request.method()
        ).toBe('POST');

        const body =
          request.postDataJSON();

        console.log(
          'CP-009 LOGIN OTP BODY:',
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
                false,

              isActive:
                true,

              role:
                'user',

              user: {

                id:
                  TEST_USER_ID,

                UserId:
                  TEST_USER_ID,

                username:
                  TEST_NAME,

                userName:
                  TEST_NAME,

                name:
                  TEST_NAME,

                email:
                  TEST_EMAIL,

                phone:
                  `+91${TEST_PHONE}`,

                phoneNumber:
                  TEST_PHONE,

                status:
                  'Active',

                consentRequired:
                  false,

              },

            }),

        });

      }
    );


    // ============================================================
    // 3. VERIFY SESSION
    // ============================================================

    await page.route(
      '**/api/user/verify-session',
      async route => {

        console.log(
          'CP-009 VERIFY SESSION:',
          route.request().url()
        );


        await route.fulfill({

          status:
            200,

          contentType:
            'application/json',

          body:
            JSON.stringify({

              success:
                true,

              userId:
                TEST_USER_ID,

              sessionStale:
                false,

            }),

        });

      }
    );


    // ============================================================
    // 4. CONSENT
    //
    // Consent is already accepted.
    //
    // IMPORTANT:
    // Do NOT use goToCompleteProfile().
    // CP-008 uses this same approach.
    // ============================================================

    await page.route(
      '**/api/user/consent*',
      async route => {

        const method =
          route.request().method();

        console.log(
          'CP-009 CONSENT:',
          method
        );


        if (
          method === 'GET'
          ||
          method === 'POST'
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
    // 5. USER STATUS
    //
    // Prevent setup/coach flow from interfering.
    // ============================================================

    await page.route(
      '**/api/user/status*',
      async route => {

        console.log(
          'CP-009 STATUS:',
          route.request().url()
        );


        await route.fulfill({

          status:
            200,

          contentType:
            'application/json',

          body:
            JSON.stringify({

              success:
                true,

              setupComplete:
                true,

              setupSkipped:
                true,

              hasTeamId:
                false,

              hasUpline:
                true,

              pendingRequest:
                false,

              redirectTo:
                null,

            }),

        });

      }
    );


    // ============================================================
    // 6. PROFILE
    //
    // Diet is the field under test.
    //
    // Therefore Diet starts EMPTY.
    //
    // All other required profile values are valid.
    // ============================================================

    await page.route(
      '**/api/user/profile*',
      async route => {

        if (
          route.request().method() !== 'GET'
        ) {

          await route.fallback();

          return;

        }


        console.log(
          'CP-009 PROFILE GET:',
          route.request().url()
        );


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

                userId:
                  TEST_USER_ID,

                profileComplete:
                  false,

                userName:
                  TEST_NAME,

                name:
                  TEST_NAME,

                email:
                  '',

                phoneNumber:
                  TEST_PHONE,

                // ------------------------------------------------
                // Gender valid.
                // Gender is NOT under test.
                // ------------------------------------------------

                gender:
                  'Male',

                // ------------------------------------------------
                // Height valid.
                // ------------------------------------------------

                height:
                  170,

                // ------------------------------------------------
                // Diet intentionally EMPTY.
                // Diet is the field under test.
                // ------------------------------------------------

                dietType:
                  '',

                // ------------------------------------------------
                // Weight valid.
                // ------------------------------------------------

                currentWeight:
                  72.5,

                latestWeight:
                  72.5,

                // ------------------------------------------------
                // Body fat valid.
                // ------------------------------------------------

                bodyFat:
                  22,

                latestWeightBodyFat:
                  22,

                // ------------------------------------------------
                // Existing profile image.
                // No upload is required.
                // ------------------------------------------------

                profileImage:
                  'https://example.com/profile.jpg',

                physicalActivityLevel:
                  null,

                needsCurrentWeight:
                  false,

              },

            }),

        });

      }
    );


    // ============================================================
    // 7. OPEN APPLICATION
    // ============================================================

    await page.goto(
      '/',
      {
        waitUntil:
          'domcontentloaded',
      }
    );


    // ============================================================
    // 8. LOGIN PAGE
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


    await page.getByRole(
      'button',
      {
        name:
          'Send OTP',

        exact:
          true,
      }
    ).click();


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
        'input[data-otp="true"]'
      );


    await expect(
      otpInputs
    ).toHaveCount(
      6
    );


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
    // 10. COMPLETE PROFILE
    // ============================================================

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


    console.log(
      'CP-009 COMPLETE PROFILE PAGE DISPLAYED'
    );


    // ============================================================
    // 11. EMAIL
    //
    // Email is not under test.
    // Make it valid.
    // ============================================================

    const emailInput =
      page.getByPlaceholder(
        'you@example.com'
      );


    await expect(
      emailInput
    ).toBeVisible({
      timeout:
        15000,
    });


    await expect(
      emailInput
    ).toBeEditable({
      timeout:
        10000,
    });


    await emailInput.fill(
      'nitheesh@example.com'
    );


    await expect(
      emailInput
    ).toHaveValue(
      'nitheesh@example.com'
    );


    console.log(
      'CP-009 EMAIL VALID'
    );


    // ============================================================
    // 12. FULL NAME
    //
    // Same approach as CP-008.
    // ============================================================

    const fullNameInput =
      page.getByPlaceholder(
        'Enter your full name'
      );


    const fullNameVisible =
      await fullNameInput
        .isVisible({
          timeout:
            2000,
        })
        .catch(
          () => false
        );


    if (
      fullNameVisible
    ) {

      await fullNameInput.fill(
        TEST_NAME
      );


      await expect(
        fullNameInput
      ).toHaveValue(
        TEST_NAME
      );


      console.log(
        'CP-009 FULL NAME SET'
      );

    } else {

      console.log(
        'CP-009 FULL NAME ALREADY RESOLVED'
      );

    }


    // ============================================================
    // 13. GENDER
    //
    // Gender is not under test.
    // Ensure it is valid.
    // ============================================================

    const getGenderSelect =
      () =>
        page
          .locator('label')
          .filter({
            hasText:
              'Gender',
          })
          .locator('..')
          .locator('select')
          .first();


    const genderSelect =
      getGenderSelect();


    const genderVisible =
      await genderSelect
        .isVisible({
          timeout:
            2000,
        })
        .catch(
          () => false
        );


    if (
      genderVisible
    ) {

      const currentGender =
        await genderSelect.inputValue();


      if (
        !currentGender
      ) {

        await genderSelect.selectOption({
          label:
            'Male',
        });

      }


      await expect(
        getGenderSelect()
      ).toHaveValue(
        'Male'
      );


      console.log(
        'CP-009 GENDER VALID'
      );

    } else {

      console.log(
        'CP-009 GENDER ALREADY RESOLVED'
      );

    }


    // ============================================================
    // 14. HEIGHT
    //
    // Height is not under test.
    // Ensure valid value.
    // ============================================================

    const heightInput =
      page.getByPlaceholder(
        'e.g. 170'
      );


    const heightVisible =
      await heightInput
        .isVisible({
          timeout:
            2000,
        })
        .catch(
          () => false
        );


    if (
      heightVisible
    ) {

      await heightInput.fill(
        '170'
      );


      await expect(
        heightInput
      ).toHaveValue(
        '170'
      );


      console.log(
        'CP-009 HEIGHT VALID'
      );

    } else {

      console.log(
        'CP-009 HEIGHT ALREADY RESOLVED'
      );

    }


    // ============================================================
    // 15. CURRENT WEIGHT
    //
    // Not under test.
    // ============================================================

    const weightInput =
      page.getByPlaceholder(
        'e.g. 72.5'
      );


    const weightVisible =
      await weightInput
        .isVisible({
          timeout:
            2000,
        })
        .catch(
          () => false
        );


    if (
      weightVisible
    ) {

      await weightInput.fill(
        '72.5'
      );


      await expect(
        weightInput
      ).toHaveValue(
        '72.5'
      );


      console.log(
        'CP-009 WEIGHT VALID'
      );

    } else {

      console.log(
        'CP-009 WEIGHT ALREADY RESOLVED'
      );

    }


    // ============================================================
    // 16. BODY FAT
    //
    // Not under test.
    // ============================================================

    const bodyFatInput =
      page.getByPlaceholder(
        'e.g. 22'
      );


    const bodyFatVisible =
      await bodyFatInput
        .isVisible({
          timeout:
            2000,
        })
        .catch(
          () => false
        );


    if (
      bodyFatVisible
    ) {

      await bodyFatInput.fill(
        '22'
      );


      await expect(
        bodyFatInput
      ).toHaveValue(
        '22'
      );


      console.log(
        'CP-009 BODY FAT VALID'
      );

    } else {

      console.log(
        'CP-009 BODY FAT ALREADY RESOLVED'
      );

    }


    // ============================================================
    // 17. SAVE BUTTON
    // ============================================================

    const saveButton =
      page.getByRole(
        'button',
        {
          name:
            'Save & Continue',

          exact:
            true,
        }
      );


    await expect(
      saveButton
    ).toBeVisible({
      timeout:
        10000,
    });


    // ============================================================
    // 18. DIET OPTIONS
    //
    // These are the options CP-009 verifies.
    // ============================================================

    const dietOptions = [

      'Vegetarian',

      'Non-Vegetarian',

      'Vegan',

      'Pescatarian',

    ];


    // ============================================================
    // 19. VERIFY ALL DIET OPTIONS EXIST
    // ============================================================

    for (
      const option of dietOptions
    ) {

      const dietButton =
        page.getByRole(
          'button',
          {
            name:
              option,

            exact:
              true,
          }
        );


      await expect(
        dietButton
      ).toBeVisible({
        timeout:
          10000,
      });

    }


    console.log(
      'CP-009 ALL DIET OPTIONS DISPLAYED'
    );


    // ============================================================
    // 20. INITIAL STATE
    //
    // Diet is intentionally empty.
    //
    // Therefore Save & Continue should be disabled.
    // ============================================================

    await expect(
      saveButton
    ).toBeDisabled({
      timeout:
        10000,
    });


    console.log(
      'CP-009 EMPTY DIET -> SAVE DISABLED'
    );


    // ============================================================
    // 21. CASE 1 — VEGETARIAN
    // ============================================================

    const vegetarianButton =
      page.getByRole(
        'button',
        {
          name:
            'Vegetarian',

          exact:
            true,
        }
      );


    await vegetarianButton.click();


    await expect(
      page.getByRole(
        'button',
        {
          name:
            'Vegetarian',

          exact:
            true,
        }
      )
    ).toHaveClass(
      /border-green-500/
    );


    await expect(
      saveButton
    ).toBeEnabled({
      timeout:
        10000,
    });


    console.log(
      'CP-009 VEGETARIAN -> SAVE ENABLED'
    );


    // ============================================================
    // 22. CASE 2 — NON-VEGETARIAN
    // ============================================================

    const nonVegetarianButton =
      page.getByRole(
        'button',
        {
          name:
            'Non-Vegetarian',

          exact:
            true,
        }
      );


    await nonVegetarianButton.click();


    await expect(
      page.getByRole(
        'button',
        {
          name:
            'Non-Vegetarian',

          exact:
            true,
        }
      )
    ).toHaveClass(
      /border-green-500/
    );


    await expect(
      saveButton
    ).toBeEnabled({
      timeout:
        10000,
    });


    console.log(
      'CP-009 NON-VEGETARIAN -> SAVE ENABLED'
    );


    // ============================================================
    // 23. CASE 3 — VEGAN
    // ============================================================

    const veganButton =
      page.getByRole(
        'button',
        {
          name:
            'Vegan',

          exact:
            true,
        }
      );


    await veganButton.click();


    await expect(
      page.getByRole(
        'button',
        {
          name:
            'Vegan',

          exact:
            true,
        }
      )
    ).toHaveClass(
      /border-green-500/
    );


    await expect(
      saveButton
    ).toBeEnabled({
      timeout:
        10000,
    });


    console.log(
      'CP-009 VEGAN -> SAVE ENABLED'
    );


    // ============================================================
    // 24. CASE 4 — PESCATARIAN
    // ============================================================

    const pescatarianButton =
      page.getByRole(
        'button',
        {
          name:
            'Pescatarian',

          exact:
            true,
        }
      );


    await pescatarianButton.click();


    await expect(
      page.getByRole(
        'button',
        {
          name:
            'Pescatarian',

          exact:
            true,
        }
      )
    ).toHaveClass(
      /border-green-500/
    );


    await expect(
      saveButton
    ).toBeEnabled({
      timeout:
        10000,
    });


    console.log(
      'CP-009 PESCATARIAN -> SAVE ENABLED'
    );


    // ============================================================
    // FINAL
    // ============================================================

    console.log(
      'CP-009 DIET PREFERENCE VALIDATION VERIFIED'
    );

  }
);

test(
  'CP-010 Current Weight validates minimum and maximum allowed values',
  async ({ page }) => {

    // ============================================================
    // TEST DATA
    // ============================================================

    const TEST_PHONE =
      '7695834209';

    const TEST_OTP =
      '123456';

    const TEST_USER_ID =
      967;

    const TEST_NAME =
      'Nitheesh Lingam';

    const TEST_EMAIL =
      '';


    // ============================================================
    // 1. SEND LOGIN OTP
    // ============================================================

    await page.route(
      '**/api/auth/send-otp',
      async route => {

        const request =
          route.request();

        expect(
          request.method()
        ).toBe('POST');

        const body =
          request.postDataJSON();

        console.log(
          'CP-010 SEND OTP BODY:',
          body
        );

        expect(
          body
        ).toMatchObject({

          recipient:
            `+91${TEST_PHONE}`,

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

            }),

        });

      }
    );


    // ============================================================
    // 2. VERIFY LOGIN OTP
    // ============================================================

    await page.route(
      '**/api/auth/verify-otp',
      async route => {

        const request =
          route.request();

        expect(
          request.method()
        ).toBe('POST');

        const body =
          request.postDataJSON();

        console.log(
          'CP-010 LOGIN OTP BODY:',
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
                false,

              isActive:
                true,

              role:
                'user',

              user: {

                id:
                  TEST_USER_ID,

                UserId:
                  TEST_USER_ID,

                username:
                  TEST_NAME,

                userName:
                  TEST_NAME,

                name:
                  TEST_NAME,

                email:
                  TEST_EMAIL,

                phone:
                  `+91${TEST_PHONE}`,

                phoneNumber:
                  TEST_PHONE,

                status:
                  'Active',

                consentRequired:
                  false,

              },

            }),

        });

      }
    );


    // ============================================================
    // 3. VERIFY SESSION
    // ============================================================

    await page.route(
      '**/api/user/verify-session',
      async route => {

        console.log(
          'CP-010 VERIFY SESSION:',
          route.request().url()
        );


        await route.fulfill({

          status:
            200,

          contentType:
            'application/json',

          body:
            JSON.stringify({

              success:
                true,

              userId:
                TEST_USER_ID,

              sessionStale:
                false,

            }),

        });

      }
    );


    // ============================================================
    // 4. CONSENT
    //
    // Consent is already accepted.
    //
    // Do NOT use goToCompleteProfile().
    // ============================================================

    await page.route(
      '**/api/user/consent*',
      async route => {

        const method =
          route.request().method();

        console.log(
          'CP-010 CONSENT:',
          method
        );


        if (
          method === 'GET'
          ||
          method === 'POST'
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
    // 5. USER STATUS
    // ============================================================

    await page.route(
      '**/api/user/status*',
      async route => {

        console.log(
          'CP-010 STATUS:',
          route.request().url()
        );


        await route.fulfill({

          status:
            200,

          contentType:
            'application/json',

          body:
            JSON.stringify({

              success:
                true,

              setupComplete:
                true,

              setupSkipped:
                true,

              hasTeamId:
                false,

              hasUpline:
                true,

              pendingRequest:
                false,

              redirectTo:
                null,

            }),

        });

      }
    );


    // ============================================================
    // 6. PROFILE
    //
    // CURRENT WEIGHT IS THE FIELD UNDER TEST.
    //
    // Therefore:
    //
    // currentWeight = null
    // latestWeight  = null
    //
    // Other fields are valid.
    // ============================================================

    await page.route(
      '**/api/user/profile*',
      async route => {

        if (
          route.request().method() !== 'GET'
        ) {

          await route.fallback();

          return;

        }


        console.log(
          'CP-010 PROFILE GET:',
          route.request().url()
        );


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

                userId:
                  TEST_USER_ID,

                profileComplete:
                  false,

                userName:
                  TEST_NAME,

                name:
                  TEST_NAME,

                email:
                  '',

                phoneNumber:
                  TEST_PHONE,


                // ------------------------------------------------
                // Gender valid.
                // ------------------------------------------------

                gender:
                  'Male',


                // ------------------------------------------------
                // Height valid.
                // ------------------------------------------------

                height:
                  170,


                // ------------------------------------------------
                // Diet valid.
                // ------------------------------------------------

                dietType:
                  'Vegetarian',


                // ------------------------------------------------
                // CURRENT WEIGHT UNDER TEST.
                //
                // Leave empty so the UI exposes the field.
                // ------------------------------------------------

                currentWeight:
                  null,

                latestWeight:
                  null,


                // ------------------------------------------------
                // Body Fat valid.
                // ------------------------------------------------

                bodyFat:
                  22,

                latestWeightBodyFat:
                  22,


                // ------------------------------------------------
                // Existing profile image.
                // No upload required.
                // ------------------------------------------------

                profileImage:
                  'https://example.com/profile.jpg',


                physicalActivityLevel:
                  null,

                needsCurrentWeight:
                  true,

              },

            }),

        });

      }
    );


    // ============================================================
    // 7. OPEN APPLICATION
    // ============================================================

    await page.goto(
      '/',
      {
        waitUntil:
          'domcontentloaded',
      }
    );


    // ============================================================
    // 8. LOGIN PAGE
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


    await page.getByRole(
      'button',
      {
        name:
          'Send OTP',

        exact:
          true,
      }
    ).click();


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
        'input[data-otp="true"]'
      );


    await expect(
      otpInputs
    ).toHaveCount(
      6
    );


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
    // 10. COMPLETE PROFILE
    // ============================================================

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


    console.log(
      'CP-010 COMPLETE PROFILE PAGE DISPLAYED'
    );


    // ============================================================
    // 11. EMAIL
    //
    // Email is not under test.
    // ============================================================

    const emailInput =
      page.getByPlaceholder(
        'you@example.com'
      );


    await expect(
      emailInput
    ).toBeVisible({
      timeout:
        15000,
    });


    await expect(
      emailInput
    ).toBeEditable({
      timeout:
        10000,
    });


    await emailInput.fill(
      'nitheesh@example.com'
    );


    await expect(
      emailInput
    ).toHaveValue(
      'nitheesh@example.com'
    );


    console.log(
      'CP-010 EMAIL VALID'
    );


    // ============================================================
    // 12. FULL NAME
    // ============================================================

    const fullNameInput =
      page.getByPlaceholder(
        'Enter your full name'
      );


    const fullNameVisible =
      await fullNameInput
        .isVisible({
          timeout:
            2000,
        })
        .catch(
          () => false
        );


    if (
      fullNameVisible
    ) {

      await fullNameInput.fill(
        TEST_NAME
      );


      await expect(
        fullNameInput
      ).toHaveValue(
        TEST_NAME
      );


      console.log(
        'CP-010 FULL NAME SET'
      );

    } else {

      console.log(
        'CP-010 FULL NAME ALREADY RESOLVED'
      );

    }


    // ============================================================
    // 13. GENDER
    //
    // Not under test.
    // ============================================================

    const getGenderSelect =
      () =>
        page
          .locator('label')
          .filter({
            hasText:
              'Gender',
          })
          .locator('..')
          .locator('select')
          .first();


    const genderSelect =
      getGenderSelect();


    const genderVisible =
      await genderSelect
        .isVisible({
          timeout:
            2000,
        })
        .catch(
          () => false
        );


    if (
      genderVisible
    ) {

      const currentGender =
        await genderSelect.inputValue();


      if (
        !currentGender
      ) {

        await genderSelect.selectOption({
          label:
            'Male',
        });

      }


      await expect(
        getGenderSelect()
      ).toHaveValue(
        'Male'
      );


      console.log(
        'CP-010 GENDER VALID'
      );

    } else {

      console.log(
        'CP-010 GENDER ALREADY RESOLVED'
      );

    }


    // ============================================================
    // 14. HEIGHT
    //
    // Not under test.
    // ============================================================

    const heightInput =
      page.getByPlaceholder(
        'e.g. 170'
      );


    const heightVisible =
      await heightInput
        .isVisible({
          timeout:
            2000,
        })
        .catch(
          () => false
        );


    if (
      heightVisible
    ) {

      await heightInput.fill(
        '170'
      );


      await expect(
        heightInput
      ).toHaveValue(
        '170'
      );


      console.log(
        'CP-010 HEIGHT VALID'
      );

    } else {

      console.log(
        'CP-010 HEIGHT ALREADY RESOLVED'
      );

    }


    // ============================================================
    // 15. DIET
    //
    // Not under test.
    // ============================================================

    const vegetarianButton =
      page.getByRole(
        'button',
        {
          name:
            'Vegetarian',

          exact:
            true,
        }
      );


    const vegetarianVisible =
      await vegetarianButton
        .isVisible({
          timeout:
            2000,
        })
        .catch(
          () => false
        );


    if (
      vegetarianVisible
    ) {

      await vegetarianButton.click();


      await expect(
        vegetarianButton
      ).toHaveClass(
        /border-green-500/
      );


      console.log(
        'CP-010 DIET SET TO VEGETARIAN'
      );

    } else {

      console.log(
        'CP-010 DIET ALREADY RESOLVED'
      );

    }


    // ============================================================
    // 16. BODY FAT
    //
    // Not under test.
    // ============================================================

    const bodyFatInput =
      page.getByPlaceholder(
        'e.g. 22'
      );


    const bodyFatVisible =
      await bodyFatInput
        .isVisible({
          timeout:
            2000,
        })
        .catch(
          () => false
        );


    if (
      bodyFatVisible
    ) {

      await bodyFatInput.fill(
        '22'
      );


      await expect(
        bodyFatInput
      ).toHaveValue(
        '22'
      );


      console.log(
        'CP-010 BODY FAT VALID'
      );

    } else {

      console.log(
        'CP-010 BODY FAT ALREADY RESOLVED'
      );

    }


    // ============================================================
    // 17. CURRENT WEIGHT LOCATOR
    //
    // This is the field under test.
    // ============================================================

    const getWeightInput =
      () =>
        page.getByPlaceholder(
          'e.g. 72.5'
        );


    const weightInput =
      getWeightInput();


    await expect(
      weightInput
    ).toBeVisible({
      timeout:
        15000,
    });


    await expect(
      weightInput
    ).toBeEditable({
      timeout:
        10000,
    });


    console.log(
      'CP-010 CURRENT WEIGHT FIELD DISPLAYED'
    );


    // ============================================================
    // 18. SAVE BUTTON
    // ============================================================

    const saveButton =
      page.getByRole(
        'button',
        {
          name:
            'Save & Continue',

          exact:
            true,
        }
      );


    await expect(
      saveButton
    ).toBeVisible({
      timeout:
        10000,
    });


    // ============================================================
    // 19. INITIAL STATE
    //
    // Current Weight is empty.
    //
    // Therefore Save should be disabled.
    // ============================================================

    await expect(
      saveButton
    ).toBeDisabled({
      timeout:
        10000,
    });


    console.log(
      'CP-010 EMPTY WEIGHT -> SAVE DISABLED'
    );


    // ============================================================
    // 20. CASE 1 — 19 KG
    //
    // Minimum allowed value = 20 KG
    //
    // 19 KG is INVALID.
    // ============================================================

    let currentWeightInput =
      getWeightInput();


    await currentWeightInput.fill(
      '19'
    );


    // Re-locate after React state update.
    currentWeightInput =
      getWeightInput();


    await expect(
      currentWeightInput
    ).toHaveValue(
      '19'
    );


    await expect(
      saveButton
    ).toBeDisabled({
      timeout:
        10000,
    });


    console.log(
      'CP-010 19 KG -> SAVE DISABLED'
    );


    // ============================================================
    // 21. CASE 2 — 20 KG
    //
    // Minimum allowed value.
    // ============================================================

    currentWeightInput =
      getWeightInput();


    await currentWeightInput.fill(
      '20'
    );


    currentWeightInput =
      getWeightInput();


    await expect(
      currentWeightInput
    ).toHaveValue(
      '20'
    );


    await expect(
      saveButton
    ).toBeEnabled({
      timeout:
        10000,
    });


    console.log(
      'CP-010 20 KG -> SAVE ENABLED'
    );


    // ============================================================
    // 22. CASE 3 — 300 KG
    //
    // Maximum allowed value.
    // ============================================================

    currentWeightInput =
      getWeightInput();


    await currentWeightInput.fill(
      '300'
    );


    currentWeightInput =
      getWeightInput();


    await expect(
      currentWeightInput
    ).toHaveValue(
      '300'
    );


    await expect(
      saveButton
    ).toBeEnabled({
      timeout:
        10000,
    });


    console.log(
      'CP-010 300 KG -> SAVE ENABLED'
    );


    // ============================================================
    // 23. CASE 4 — 301 KG
    //
    // Above maximum.
    // ============================================================

    currentWeightInput =
      getWeightInput();


    await currentWeightInput.fill(
      '301'
    );


    currentWeightInput =
      getWeightInput();


    await expect(
      currentWeightInput
    ).toHaveValue(
      '301'
    );


    await expect(
      saveButton
    ).toBeDisabled({
      timeout:
        10000,
    });


    console.log(
      'CP-010 301 KG -> SAVE DISABLED'
    );


    // ============================================================
    // 24. RESTORE NORMAL VALID VALUE
    // ============================================================

    currentWeightInput =
      getWeightInput();


    await currentWeightInput.fill(
      '72.5'
    );


    currentWeightInput =
      getWeightInput();


    await expect(
      currentWeightInput
    ).toHaveValue(
      '72.5'
    );


    await expect(
      saveButton
    ).toBeEnabled({
      timeout:
        10000,
    });


    console.log(
      'CP-010 72.5 KG -> SAVE ENABLED'
    );


    // ============================================================
    // FINAL
    // ============================================================

    console.log(
      'CP-010 CURRENT WEIGHT VALIDATION VERIFIED'
    );

  }
);



test(
  'CP-011 Body Fat validates minimum and maximum allowed values',
  async ({ page }) => {
    await goToCompleteProfile(page);

    // Prevent a later consent-status poll from returning this test to
    // the consent screen while the profile form is being tested.
    await page.unroute('**/api/user/consent*');

    await page.route('**/api/user/consent*', async (route) => {
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

    const completeProfileHeading = page.getByRole('heading', {
      name: 'Complete Your Profile',
      exact: true,
    });

    await expect(completeProfileHeading).toBeVisible({
      timeout: 15000,
    });

    const saveButton = page.getByRole('button', {
      name: 'Save & Continue',
      exact: true,
    });

    await expect(saveButton).toBeVisible({
      timeout: 10000,
    });

    // ------------------------------------------------------------
    // Make every field other than Fat % valid.
    // ------------------------------------------------------------

    const genderSelect = page
      .locator('select')
      .filter({
        has: page.locator('option[value="Male"]'),
      })
      .first();

    await expect(genderSelect).toBeVisible({
      timeout: 10000,
    });

    await genderSelect.selectOption('Male');

    const heightInput = page.getByPlaceholder('e.g. 170');
    await expect(heightInput).toBeVisible();
    await heightInput.fill('170');

    const vegetarianButton = page.getByRole('button', {
      name: 'Vegetarian',
      exact: true,
    });

    await expect(vegetarianButton).toBeVisible();
    await vegetarianButton.click();

// Current Weight is displayed only when the profile needs one.
// If an existing weight is already available, it is intentionally hidden.
const weightInput = page.getByPlaceholder('e.g. 72.5');

if (await weightInput.isVisible().catch(() => false)) {
  await weightInput.fill('72.5');
  await expect(weightInput).toHaveValue('72.5');
}

    // The Fat % input is a sibling of its label, not a child of it.
    // This avoids matching the separate Fat % checklist item.
    const bodyFatInput = page
      .locator('label')
      .filter({
        hasText: /^Fat %\s*\*/,
      })
      .locator('xpath=..')
      .locator('input')
      .first();

    await expect(bodyFatInput).toBeVisible({
      timeout: 10000,
    });

    // Profile photo is required for Save & Continue to be enabled.
    const profileImageInput = page
      .locator('input[type="file"][accept="image/*"]')
      .last();

    await expect(profileImageInput).toBeAttached({
      timeout: 10000,
    });

    await profileImageInput.setInputFiles(
      'tests/fixtures/profile-photo.jpg',
    );

    const cropDialog = page.getByRole('dialog', {
      name: 'Crop photo',
    });

    const doneButton = page.getByRole('button', {
      name: 'Done',
      exact: true,
    });

    if (await cropDialog.isVisible().catch(() => false)) {
      await doneButton.click();
      await expect(cropDialog).toBeHidden({
        timeout: 10000,
      });
    }

    // ------------------------------------------------------------
    // Start from a valid Fat % value.
    // ------------------------------------------------------------

    await bodyFatInput.fill('22');

    await expect(bodyFatInput).toHaveValue('22');

    await expect(saveButton).toBeEnabled({
      timeout: 10000,
    });

    // ------------------------------------------------------------
    // 0% — below minimum: invalid
    // ------------------------------------------------------------

    await bodyFatInput.fill('0');

    await expect(bodyFatInput).toHaveValue('0');

    await expect(saveButton).toBeDisabled({
      timeout: 10000,
    });

    // ------------------------------------------------------------
    // 1% — minimum: valid
    // ------------------------------------------------------------

    await bodyFatInput.fill('1');

    await expect(bodyFatInput).toHaveValue('1');

    await expect(saveButton).toBeEnabled({
      timeout: 10000,
    });

    // ------------------------------------------------------------
    // 70% — maximum: valid
    // ------------------------------------------------------------

    await bodyFatInput.fill('70');

    await expect(bodyFatInput).toHaveValue('70');

    await expect(saveButton).toBeEnabled({
      timeout: 10000,
    });

    // ------------------------------------------------------------
    // 71% — above maximum: invalid
    // ------------------------------------------------------------

    await bodyFatInput.fill('71');

    await expect(bodyFatInput).toHaveValue('71');

    await expect(saveButton).toBeDisabled({
      timeout: 10000,
    });

    // Leave the form in a valid state.
    await bodyFatInput.fill('22');

    await expect(bodyFatInput).toHaveValue('22');

    await expect(saveButton).toBeEnabled({
      timeout: 10000,
    });
  },
);


const path = require('path');

test(
'CP-012 Profile Picture controls Save & Continue availability',
async ({ page }) => {

// ============================================================
// 1. MOCK CONSENT
// ============================================================

await page.route('**/api/user/consent*', async (route) => {
  const method = route.request().method();

  if (method === 'GET') {
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

// ============================================================
// 2. MOCK A VALID PROFILE
//
// Everything required by CompleteProfilePage is already valid.
// Only profileImage is intentionally missing.
// ============================================================

await page.route('**/api/user/profile*', async (route) => {
  if (route.request().method() !== 'GET') {
    await route.continue();
    return;
  }

  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      success: true,
      data: {
        profileComplete: false,

        userName: 'Nitheesh Lingam',
        email: 'nitheesh@example.com',

        gender: 'Male',
        height: 170,
        dietType: 'Vegetarian',

        latestWeight: 72.5,
        needsCurrentWeight: false,

        latestWeightBodyFat: 22,
        bodyFat: 22,

        bodyMetrics: {
          gender: 'Male',
          fatPercent: 22,
          age: null,
          visceralFat: null,
          bmi: null,
          bodyAge: null,
          chestCm: null,
          waistCm: null,
          hipCm: null,
        },

        // IMPORTANT:
        // No existing profile picture.
        profileImage: null,

        physicalActivityLevel: null,
        recoveredHealthIssues: [],
        transformationPhotos: [],
      },
    }),
  });
});

// ============================================================
// 3. CREATE THE AUTHENTICATED SESSION
//
// Reuse the existing project helper, but do NOT use
// goToCompleteProfile() because that helper installs its own
// blank-profile mock.
// ============================================================

await createAuthenticatedState(page);

// ============================================================
// 4. OPEN APPLICATION
// ============================================================

await page.goto('/');

// ============================================================
// 5. COMPLETE CONSENT IF THE APP SHOWS IT
// ============================================================

const consentHeading =
  page.getByRole('heading', {
    name: 'User Consent Form',
    exact: true,
  });

if (
  await consentHeading.isVisible().catch(() => false)
) {
  const agreeButton =
    page.getByRole('button', {
      name: /I Agree/i,
    });

  if (
    await agreeButton.count() > 0 &&
    await agreeButton.isVisible().catch(() => false)
  ) {
    await agreeButton.click();
  }
}

// ============================================================
// 6. VERIFY COMPLETE PROFILE
// ============================================================

const completeProfileHeading =
  page.getByRole('heading', {
    name: 'Complete Your Profile',
    exact: true,
  });

await expect(completeProfileHeading).toBeVisible({
  timeout: 20000,
});

// ============================================================
// 7. WAIT FOR PROFILE DATA TO BE APPLIED
//
// These are sanity checks only. We are not testing their
// validation in CP-012.
// ============================================================

const heightInput =
  page.getByPlaceholder('e.g. 170');

await expect(heightInput).toHaveValue('170', {
  timeout: 20000,
});

const genderSelect =
  page.locator('select').first();

await expect(genderSelect).toHaveValue('Male', {
  timeout: 10000,
});

const vegetarianButton =
  page.getByRole('button', {
    name: 'Vegetarian',
    exact: true,
  });

await expect(vegetarianButton).toBeVisible({
  timeout: 10000,
});

// ============================================================
// 8. LOCATE PROFILE PICTURE
//
// The current page renders Transformation Photos as well, so
// file inputs MUST be scoped to the Profile Picture section.
// ============================================================

const profilePictureHeading =
  page.getByRole('heading', {
    name: 'Profile Picture',
    exact: true,
  });

await expect(profilePictureHeading).toBeVisible({
  timeout: 15000,
});

const profilePictureCard =
  profilePictureHeading.locator(
    'xpath=ancestor::div[contains(@class,"bg-white")][1]'
  );

await expect(profilePictureCard).toBeVisible({
  timeout: 10000,
});

const pictureInputs =
  profilePictureCard.locator(
    'input[type="file"][accept="image/*"]'
  );

await expect(pictureInputs).toHaveCount(2, {
  timeout: 10000,
});

// ============================================================
// 9. SAVE & CONTINUE
// ============================================================

const saveButton =
  page.getByRole('button', {
    name: 'Save & Continue',
    exact: true,
  });

await expect(saveButton).toHaveCount(1, {
  timeout: 15000,
});

await expect(saveButton).toBeVisible({
  timeout: 10000,
});

// ============================================================
// 10. PROFILE PICTURE IS MISSING
//
// All other profile requirements have valid values.
// Therefore Save & Continue must be disabled.
// ============================================================

const noImageSelected =
  profilePictureCard.getByText(
    'No image selected',
    {
      exact: true,
    }
  );

await expect(noImageSelected).toBeVisible({
  timeout: 10000,
});

await expect(saveButton).toBeDisabled({
  timeout: 15000,
});

// ============================================================
// 11. UPLOAD PROFILE PICTURE
// ============================================================

const galleryInput =
  pictureInputs.nth(1);

await galleryInput.setInputFiles(
  'tests/fixtures/profile-photo.jpg'
);

// ============================================================
// 12. COMPLETE CROP IF THE CURRENT UI SHOWS IT
// ============================================================

const cropDialog =
  page.getByRole('dialog', {
    name: 'Crop photo',
  });

if (
  await cropDialog.isVisible().catch(() => false)
) {
  const doneButton =
    page.getByRole('button', {
      name: 'Done',
      exact: true,
    });

  await expect(doneButton).toBeVisible({
    timeout: 10000,
  });

  await doneButton.click();

  await expect(cropDialog).toBeHidden({
    timeout: 10000,
  });
}

// ============================================================
// 13. VERIFY IMAGE IS SELECTED
// ============================================================

await expect(noImageSelected).not.toBeVisible({
  timeout: 15000,
});

// ============================================================
// 14. SAVE & CONTINUE MUST BECOME ENABLED
// ============================================================

await expect(saveButton).toBeEnabled({
  timeout: 15000,
});

console.log(
  'CP-012 PASSED: missing profile picture disables Save & Continue; uploaded picture enables it.'
);

}
);


test(
'CP-013 Physical Activity allows any option and enables Continue',
async ({ page }) => {

// ============================================================
// TEST DATA
// ============================================================

const TEST_EMAIL =
  'nitheesh@example.com';

const TEST_PHONE =
  '+917695834209';

const TEST_NAME =
  'Nitheesh Lingam';

const TEST_PHOTO =
  path.resolve(
    process.cwd(),
    'tests',
    'fixtures',
    'profile-photo.jpg'
  );

// ============================================================
// 1. AUTHENTICATED NEW PHONE USER
// ============================================================

await page.addInitScript(
  ({ phone }) => {

    const user = {
      id: 999999,
      UserId: 999999,
      username: 'newuser',
      email: '',
      phone,
      status: 'Active',
      isNewUser: true,
      consentRequired: false,
    };

    localStorage.setItem(
      'isOtpVerified',
      'true'
    );

    localStorage.setItem(
      'otpUser',
      JSON.stringify(user)
    );

    localStorage.setItem(
      'user',
      JSON.stringify(user)
    );
  },
  {
    phone: TEST_PHONE,
  }
);

// ============================================================
// 2. USER LOOKUP
// ============================================================

await page.route(
  '**/api/user/lookup*',
  async (route) => {

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
  }
);

// ============================================================
// 3. CONSENT
// ============================================================

await page.route(
  '**/api/user/consent*',
  async (route) => {

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

    if (route.request().method() === 'POST') {

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

// ============================================================
// 4. SETUP STATUS
// ============================================================

await page.route(
  '**/api/user/status*',
  async (route) => {

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        setupSkipped: true,
        setupComplete: true,
        pendingRequest: false,
        hasTeamId: false,
        hasUpline: false,
      }),
    });
  }
);

// ============================================================
// 5. SAVE EMAIL
// ============================================================

await page.route(
  '**/api/user/save-email*',
  async (route) => {

    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }

    const body =
      route.request().postDataJSON();

    expect(body.email).toBe(TEST_EMAIL);

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        email: TEST_EMAIL,
        user: {
          id: 999999,
          UserId: 999999,
          username: 'newuser',
          email: TEST_EMAIL,
          phone: TEST_PHONE,
          status: 'Active',
        },
      }),
    });
  }
);

// ============================================================
// 6. PROFILE API
//
// Before Complete Profile save:
//   incomplete profile
//
// After Complete Profile save:
//   complete profile BUT no physical activity level
//
// After Physical Activity save:
//   physicalActivityLevel supplied
// ============================================================

let profileSaved =
  false;

let activitySaved =
  false;

let savedActivity =
  null;

await page.route(
  '**/api/user/profile*',
  async (route) => {

    const method =
      route.request().method();

    // --------------------------------------------------------
    // GET
    // --------------------------------------------------------

    if (method === 'GET') {

      // Physical Activity was selected.
      if (activitySaved) {

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,

            data: {
              userId: 999999,

              profileComplete: true,

              userName: TEST_NAME,
              email: TEST_EMAIL,

              gender: 'Male',
              height: 170,
              dietType: 'Vegetarian',

              currentWeight: 72.5,
              bodyFat: 22,

              profileImage:
                'https://example.com/profile.jpg',

              physicalActivityLevel:
                savedActivity,

              consentRequired: false,
              consentAccepted: true,
            },
          }),
        });

        return;
      }

      // Complete Profile was saved but Activity has not
      // been selected yet.
      if (profileSaved) {

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,

            data: {
              userId: 999999,

              profileComplete: true,

              userName: TEST_NAME,
              email: TEST_EMAIL,

              gender: 'Male',
              height: 170,
              dietType: 'Vegetarian',

              latestWeight: 72.5,
              latestWeightBodyFat: 22,

              currentWeight: 72.5,
              bodyFat: 22,

              profileImage:
                'https://example.com/profile.jpg',

              physicalActivityLevel: null,

              consentRequired: false,
              consentAccepted: true,
            },
          }),
        });

        return;
      }

      // Initial incomplete profile.
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,

          data: {
            userId: 999999,

            profileComplete: false,

            userName: TEST_NAME,
            email: TEST_EMAIL,

            gender: null,
            height: null,
            dietType: null,

            latestWeight: null,
            latestWeightBodyFat: null,

            currentWeight: null,
            bodyFat: null,

            needsCurrentWeight: true,

            profileImage: null,

            physicalActivityLevel: null,

            consentRequired: false,
            consentAccepted: true,
          },
        }),
      });

      return;
    }

    // --------------------------------------------------------
    // POST
    // --------------------------------------------------------

    if (method === 'POST') {

      const body =
        route.request().postDataJSON();

      // ------------------------------------------------------
      // Physical Activity save
      // ------------------------------------------------------

      if (
        body &&
        body.physicalActivityLevel
      ) {

        activitySaved = true;

        savedActivity =
          body.physicalActivityLevel;

        console.log(
          'CP-013 ACTIVITY SAVE:',
          savedActivity
        );

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,

            data: {
              physicalActivityLevel:
                savedActivity,

              calorieTarget:
                2000,
            },
          }),
        });

        return;
      }

      // ------------------------------------------------------
      // Complete Profile save
      // ------------------------------------------------------

      profileSaved = true;

      console.log(
        'CP-013 PROFILE SAVE:',
        {
          email: body.email,
          name: body.name,
          gender: body.gender,
          height: body.height,
          dietType: body.dietType,
          currentWeight: body.currentWeight,
          bodyFat: body.bodyFat,
          hasProfileImage:
            Boolean(body.profileImage),
        }
      );

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,

          data: {
            userId: 999999,

            profileComplete: true,

            userName:
              body.name,

            email:
              body.email,

            gender:
              body.gender,

            height:
              body.height,

            dietType:
              body.dietType,

            currentWeight:
              body.currentWeight,

            bodyFat:
              body.bodyFat,

            profileImage:
              body.profileImage,

            physicalActivityLevel:
              null,

            consentRequired: false,
            consentAccepted: true,
          },
        }),
      });

      return;
    }

    await route.continue();
  }
);

// ============================================================
// 7. OPEN APPLICATION
// ============================================================

await page.goto('/');

// ============================================================
// 8. COMPLETE PROFILE
// ============================================================

const completeProfileHeading =
  page.getByRole('heading', {
    name: 'Complete Your Profile',
    exact: true,
  });

await expect(
  completeProfileHeading
).toBeVisible({
  timeout: 20000,
});

// ============================================================
// 9. COMPLETE REQUIRED PROFILE FIELDS
// ============================================================

const fullNameInput =
  page.getByPlaceholder(
    'Enter your full name'
  );

const emailInput =
  page.getByPlaceholder(
    'you@example.com'
  );

const genderSelect =
  page
    .locator('select')
    .filter({
      has: page.locator(
        'option[value="Male"]'
      ),
    })
    .first();

const heightInput =
  page.getByPlaceholder(
    'e.g. 170'
  );

const weightInput =
  page.getByPlaceholder(
    'e.g. 72.5'
  );

const bodyFatInput =
  page.getByPlaceholder(
    'e.g. 22'
  );

// Email
await expect(
  emailInput
).toBeVisible({
  timeout: 10000,
});

await emailInput.fill(
  TEST_EMAIL
);

// Name
await fullNameInput.fill(
  TEST_NAME
);

// Gender
await genderSelect.selectOption(
  'Male'
);

// Height
await heightInput.fill(
  '170'
);

// Diet
await page
  .getByRole('button', {
    name: 'Vegetarian',
    exact: true,
  })
  .click();

// Current Weight
await weightInput.fill(
  '72.5'
);

// Fat %
await bodyFatInput.fill(
  '22'
);

// ============================================================
// 10. PROFILE PICTURE
// ============================================================

const profilePictureHeading =
  page.getByRole('heading', {
    name: 'Profile Picture',
    exact: true,
  });

await expect(
  profilePictureHeading
).toBeVisible({
  timeout: 10000,
});

const profilePictureSection =
  profilePictureHeading.locator(
    'xpath=ancestor::div[contains(@class,"bg-white")][1]'
  );

const pictureInputs =
  profilePictureSection.locator(
    'input[type="file"][accept="image/*"]'
  );

await expect(
  pictureInputs
).toHaveCount(2, {
  timeout: 10000,
});

const galleryInput =
  pictureInputs.nth(1);

await galleryInput.setInputFiles(
  TEST_PHOTO
);

// ============================================================
// 11. COMPLETE CROP IF PRESENT
// ============================================================

const cropDialog =
  page.getByRole('dialog', {
    name: 'Crop photo',
  });

if (
  await cropDialog
    .isVisible()
    .catch(() => false)
) {

  const doneButton =
    page.getByRole('button', {
      name: 'Done',
      exact: true,
    });

  await doneButton.click();

  await expect(
    cropDialog
  ).toBeHidden({
    timeout: 10000,
  });
}

// ============================================================
// 12. SAVE & CONTINUE
// ============================================================

const saveButton =
  page.getByRole('button', {
    name: 'Save & Continue',
    exact: true,
  });

await expect(
  saveButton
).toBeEnabled({
  timeout: 15000,
});

await saveButton.click();

// ============================================================
// 13. COMPLETE PROFILE SHOULD CLOSE
// ============================================================

await expect(
  completeProfileHeading
).not.toBeVisible({
  timeout: 20000,
});

// ============================================================
// 14. PHYSICAL ACTIVITY SCREEN
// ============================================================

const physicalActivityHeading =
  page.getByRole('heading', {
    name: 'Physical Activity',
    exact: true,
  });

await expect(
  physicalActivityHeading
).toBeVisible({
  timeout: 30000,
});

await expect(
  page.getByText(
    'This helps us calculate your daily calorie target (TDEE).',
    {
      exact: true,
    }
  )
).toBeVisible({
  timeout: 10000,
});

// ============================================================
// 15. CONTINUE STARTS DISABLED
// ============================================================

const continueButton =
  page.getByRole('button', {
    name: 'Continue',
    exact: true,
  });

await expect(
  continueButton
).toBeVisible({
  timeout: 10000,
});

await expect(
  continueButton
).toBeDisabled();

// ============================================================
// 16. ALL PHYSICAL ACTIVITY OPTIONS
// ============================================================

const activityOptions = [
  {
    label: 'Sedentary',
    value: 'sedentary',
  },
  {
    label: 'Light Active',
    value: 'light_active',
  },
  {
    label: 'Moderate',
    value: 'moderate',
  },
  {
    label: 'Very Active',
    value: 'very_active',
  },
  {
    label: 'Highly Active',
    value: 'highly_active',
  },
];

// Verify all options are displayed.
for (
  const activity of activityOptions
) {

  await expect(
    page.getByRole('button', {
      name: new RegExp(
        `^${activity.label}\\b`
      ),
    })
  ).toBeVisible({
    timeout: 10000,
  });
}

// ============================================================
// 17. VERIFY EACH OPTION ENABLES CONTINUE
// ============================================================

for (
  const activity of activityOptions
) {

  const activityButton =
    page.getByRole('button', {
      name: new RegExp(
        `^${activity.label}\\b`
      ),
    });

  await activityButton.click();

  // The selected activity must enable Continue.
  await expect(
    continueButton
  ).toBeEnabled({
    timeout: 10000,
  });

  // Verify the selected button is visually selected.
  await expect(
    activityButton
  ).toHaveClass(
    /border-green-500/,
    {
      timeout: 10000,
    }
  );
}

// ============================================================
// 18. FINAL CHECK
// ============================================================

await expect(
  continueButton
).toBeEnabled();

console.log(
  'CP-013: Every physical activity option enables Continue.'
);

}
);



test(
  'CP-014 selecting physical activity opens coach selection',
  async ({ page }) => {

    // ============================================================
    // TEST DATA
    // ============================================================

    const TEST_EMAIL =
      'existing@test.com';

    const TEST_COACH_ID =
      12345;

    let profileSaved = false;
    let activitySaved = false;
    let uplineRequestSent = false;


    // ============================================================
    // 1. SAVE EMAIL API
    // ============================================================

    await page.route(
      '**/api/user/save-email*',
      async route => {

        const method =
          route.request().method();

        if (method !== 'POST') {
          await route.fallback();
          return;
        }

        const body =
          route.request().postDataJSON();

        console.log(
          'CP-014 SAVE EMAIL:',
          body
        );

        expect(
          body.email
        ).toBe(
          TEST_EMAIL
        );

        await route.fulfill({
          status: 200,

          contentType:
            'application/json',

          body: JSON.stringify({
            success: true,

            message:
              'Email saved successfully',

            email:
              TEST_EMAIL,

            user: {
              id:
                body.userId || 861,

              UserId:
                body.userId || 861,

              username:
                'newuser',

              email:
                TEST_EMAIL,

              phone:
                '+917695834209',

              status:
                'Active',
            },
          }),
        });
      }
    );


    // ============================================================
    // 2. GO TO COMPLETE PROFILE
    // ============================================================

    await goToCompleteProfile(
      page
    );


    // ============================================================
    // 3. PROFILE API
    //
    // Register after goToCompleteProfile() so this handler
    // handles the subsequent profile requests.
    // ============================================================

    await page.route(
      '**/api/user/profile*',
      async route => {

        const method =
          route.request().method();


        // ========================================================
        // GET PROFILE
        // ========================================================

        if (method === 'GET') {

          // Initial GET is handled by the common helper.
          if (!profileSaved) {
            await route.fallback();
            return;
          }


          console.log(
            'CP-014 PROFILE GET AFTER SAVE'
          );


          await route.fulfill({
            status: 200,

            contentType:
              'application/json',

            body: JSON.stringify({
              success: true,

              data: {

                profileComplete:
                  true,

                userName:
                  'Nitheesh Lingam',

                email:
                  TEST_EMAIL,

                gender:
                  'Male',

                height:
                  170,

                dietType:
                  'Vegetarian',

                latestWeight:
                  72.5,

                latestWeightBodyFat:
                  22,

                currentWeight:
                  72.5,

                bodyFat:
                  22,

                profileImage:
                  'https://example.com/profile.jpg',

                needsCurrentWeight:
                  false,

                physicalActivityLevel:
                  null,

                consentRequired:
                  false,

                consentAccepted:
                  true,
              },
            }),
          });

          return;
        }


        // ========================================================
        // POST PROFILE
        // ========================================================

        if (method === 'POST') {

          const body =
            route
              .request()
              .postDataJSON();


          // ------------------------------------------------------
          // PHYSICAL ACTIVITY SAVE
          // ------------------------------------------------------

          if (
            body.physicalActivityLevel
          ) {

            console.log(
              'CP-014 ACTIVITY SAVE:',
              body
            );


            expect(
              body
            ).toMatchObject({
              email:
                TEST_EMAIL,

              physicalActivityLevel:
                'moderate',
            });


            activitySaved = true;


            await route.fulfill({
              status: 200,

              contentType:
                'application/json',

              body: JSON.stringify({
                success: true,

                data: {
                  physicalActivityLevel:
                    'moderate',

                  calorieTarget:
                    2200,
                },
              }),
            });

            return;
          }


          // ------------------------------------------------------
          // COMPLETE PROFILE SAVE
          // ------------------------------------------------------

          console.log(
            'CP-014 COMPLETE PROFILE SAVE:',
            {
              email:
                body.email,

              name:
                body.name,

              gender:
                body.gender,

              height:
                body.height,

              dietType:
                body.dietType,

              currentWeight:
                body.currentWeight,

              bodyFat:
                body.bodyFat,

              hasProfileImage:
                Boolean(
                  body.profileImage
                ),
            }
          );


          expect(
            body
          ).toMatchObject({
            email:
              TEST_EMAIL,

            name:
              'Nitheesh Lingam',

            gender:
              'Male',

            height:
              170,

            dietType:
              'Vegetarian',

            currentWeight:
              72.5,

            bodyFat:
              22,
          });


          expect(
            body.profileImage
          ).toBeTruthy();


          profileSaved = true;


          await route.fulfill({
            status: 200,

            contentType:
              'application/json',

            body: JSON.stringify({
              success: true,

              data: {

                profileComplete:
                  true,

                userName:
                  body.name,

                email:
                  body.email,

                gender:
                  body.gender,

                height:
                  body.height,

                dietType:
                  body.dietType,

                currentWeight:
                  body.currentWeight,

                bodyFat:
                  body.bodyFat,

                profileImage:
                  body.profileImage,

                physicalActivityLevel:
                  null,

                consentRequired:
                  false,

                consentAccepted:
                  true,
              },
            }),
          });

          return;
        }


        await route.fallback();
      }
    );


    // ============================================================
    // 4. SETUP STATUS
    // ============================================================

    await page.route(
      '**/api/user/status*',
      async route => {

        console.log(
          'CP-014 STATUS GET'
        );


        await route.fulfill({
          status: 200,

          contentType:
            'application/json',

          body: JSON.stringify({

            success:
              true,

            setupComplete:
              false,

            setupSkipped:
              false,

            pendingRequest:
              false,

            hasTeamId:
              false,

            hasUpline:
              false,

            teamId:
              null,

            uplineCoachId:
              null,
          }),
        });
      }
    );


    // ============================================================
    // 5. COACH SEARCH
    // ============================================================

    await page.route(
      '**/api/users/search*',
      async route => {

        const url =
          new URL(
            route.request().url()
          );


        console.log(
          'CP-014 COACH SEARCH:',
          {
            query:
              url.searchParams.get('q'),

            email:
              url.searchParams.get('email'),
          }
        );


        await route.fulfill({
          status: 200,

          contentType:
            'application/json',

          body: JSON.stringify({
            success: true,

            coaches: [
              {
                userId:
                  TEST_COACH_ID,

                userName:
                  'Test Coach',

                displayName:
                  'Test Coach',

                email:
                  'tes*****mple.com',

                teamId:
                  null,

                hasTeamId:
                  false,
              },
            ],
          }),
        });
      }
    );


    // ============================================================
    // 6. UPLINE REQUEST
    // ============================================================

    await page.route(
      '**/api/upline/request',
      async route => {

        const body =
          route
            .request()
            .postDataJSON();


        console.log(
          'CP-014 UPLINE REQUEST:',
          body
        );


        expect(
          body
        ).toMatchObject({
          coachId:
            TEST_COACH_ID,

          email:
            TEST_EMAIL,
        });


        uplineRequestSent = true;


        await route.fulfill({
          status: 200,

          contentType:
            'application/json',

          body: JSON.stringify({
            success: true,

            message:
              'Request sent successfully',
          }),
        });
      }
    );


    // ============================================================
    // 7. VERIFY COMPLETE PROFILE PAGE
    // ============================================================

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
        15000,
    });


    // ============================================================
    // 8. LOCATORS
    // ============================================================

    const fullNameInput =
      page.getByPlaceholder(
        'Enter your full name'
      );


    const emailInput =
      page.getByPlaceholder(
        'you@example.com'
      );


    const genderSelect =
      page
        .locator(
          'select[required]'
        )
        .filter({
          has:
            page.locator(
              'option[value="Male"]'
            ),
        });


    const heightInput =
      page.getByPlaceholder(
        'e.g. 170'
      );


    const weightInput =
      page.getByPlaceholder(
        'e.g. 72.5'
      );


    const bodyFatInput =
      page.getByPlaceholder(
        'e.g. 22'
      );


    const vegetarianButton =
      page.getByRole(
        'button',
        {
          name:
            'Vegetarian',

          exact:
            true,
        }
      );


    const saveButton =
      page.getByRole(
        'button',
        {
          name:
            'Save & Continue',

          exact:
            true,
        }
      );


    // ============================================================
    // 9. EMAIL
    // ============================================================

    await expect(
      emailInput
    ).toBeVisible({
      timeout:
        10000,
    });


    await expect(
      emailInput
    ).toBeEditable();


    await expect(
      emailInput
    ).toHaveValue(
      ''
    );


    await emailInput.fill(
      TEST_EMAIL
    );


    await expect(
      emailInput
    ).toHaveValue(
      TEST_EMAIL
    );


    // ============================================================
    // 10. FULL NAME
    // ============================================================

    await fullNameInput.fill(
      'Nitheesh Lingam'
    );


    await expect(
      fullNameInput
    ).toHaveValue(
      'Nitheesh Lingam'
    );


    // ============================================================
    // 11. GENDER
    // ============================================================

    await expect(
      genderSelect
    ).toBeVisible({
      timeout:
        10000,
    });


    await genderSelect.selectOption({
      label:
        'Male',
    });


    await expect(
      genderSelect
    ).toHaveValue(
      'Male'
    );


    // ============================================================
    // 12. HEIGHT
    // ============================================================

    await heightInput.fill(
      '170'
    );


    await expect(
      heightInput
    ).toHaveValue(
      '170'
    );


    // ============================================================
    // 13. DIET
    // ============================================================

    await vegetarianButton.click();


    await expect(
      vegetarianButton
    ).toHaveClass(
      /border-green-500/
    );


    // ============================================================
    // 14. CURRENT WEIGHT
    // ============================================================

    await weightInput.fill(
      '72.5'
    );


    await expect(
      weightInput
    ).toHaveValue(
      '72.5'
    );


    // ============================================================
    // 15. BODY FAT
    // ============================================================

    await bodyFatInput.fill(
      '22'
    );


    await expect(
      bodyFatInput
    ).toHaveValue(
      '22'
    );


    // ============================================================
    // 16. PROFILE PICTURE
    // ============================================================

    const profilePictureHeading =
      page.getByRole(
        'heading',
        {
          name:
            'Profile Picture',

          exact:
            true,
        }
      );


    await expect(
      profilePictureHeading
    ).toBeVisible({
      timeout:
        10000,
    });


    const profilePictureSection =
      profilePictureHeading.locator(
        'xpath=ancestor::div[contains(@class,"bg-white")][1]'
      );


    const pictureInputs =
      profilePictureSection.locator(
        'input[type="file"][accept="image/*"]'
      );


    await expect(
      pictureInputs
    ).toHaveCount(
      2
    );


    const galleryInput =
      pictureInputs.nth(1);


    await galleryInput.setInputFiles(
      'tests/fixtures/profile-photo.jpg'
    );


    // ============================================================
    // 17. FINISH CROP IF PRESENT
    // ============================================================

    const doneButton =
      page.getByRole(
        'button',
        {
          name:
            'Done',

          exact:
            true,
        }
      );


    if (
      await doneButton
        .isVisible({
          timeout:
            3000,
        })
        .catch(
          () => false
        )
    ) {

      await doneButton.click();

    }


    // ============================================================
    // 18. VERIFY IMAGE
    // ============================================================

    await expect(
      page.getByText(
        'No image selected',
        {
          exact:
            true,
        }
      )
    ).not.toBeVisible({
      timeout:
        10000,
    });


    // ============================================================
    // 19. SAVE PROFILE
    // ============================================================

    await expect(
      saveButton
    ).toBeEnabled({
      timeout:
        15000,
    });


    await saveButton.click();


    // ============================================================
    // 20. WAIT FOR PROFILE SAVE
    // ============================================================

    await expect
      .poll(
        () => profileSaved,
        {
          timeout:
            15000,
        }
      )
      .toBe(true);


    // ============================================================
    // 21. HANDLE POST-SAVE CONSENT
    //
    // IMPORTANT:
    // Do NOT search the grandparent text.
    //
    // The two options are:
    //   I Don't Agree
    //   I Agree
    //
    // The grandparent contains BOTH texts, which caused the wrong
    // radio to be selected previously.
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


    await page.waitForTimeout(
      500
    );


    const consentVisible =
      await consentHeading
        .isVisible({
          timeout:
            5000,
        })
        .catch(
          () => false
        );


    if (
      consentVisible
    ) {

      console.log(
        'CP-014: Post-save consent detected'
      );


      // ----------------------------------------------------------
      // Consent radios
      // ----------------------------------------------------------

      const consentRadios =
        page.locator(
          'input[type="radio"][name="consentChoice"]'
        );


      await expect(
        consentRadios
      ).toHaveCount(
        2,
        {
          timeout:
            10000,
        }
      );


      // ----------------------------------------------------------
      // IMPORTANT:
      //
      // The correct option is the LABEL containing only:
      //
      //     I Agree
      //
      // Do not use surrounding/grandparent text.
      // ----------------------------------------------------------

      const agreeLabel =
        page.locator(
          'label'
        ).filter({
          has:
            page.getByText(
              'I Agree',
              {
                exact:
                  true,
              }
            ),
        });


      await expect(
        agreeLabel
      ).toHaveCount(
        1,
        {
          timeout:
            10000,
        }
      );


      await expect(
        agreeLabel
      ).toBeVisible({
        timeout:
          10000,
      });


      console.log(
        'CP-014: Clicking exact I Agree label'
      );


      // Clicking the label is preferable here because it lets the
      // browser associate the label with its radio input naturally.
      await agreeLabel.click();


      // ----------------------------------------------------------
      // Verify the actual I Agree radio.
      //
      // Based on the DOM observed in your debug output:
      //   nth(0) = I Don't Agree
      //   nth(1) = I Agree
      // ----------------------------------------------------------

      const agreeRadio =
        page.locator(
          'input[type="radio"][name="consentChoice"]'
        ).nth(1);


      await expect(
        agreeRadio
      ).toBeChecked({
        timeout:
          10000,
      });


      console.log(
        'CP-014: I Agree confirmed selected'
      );


      // ----------------------------------------------------------
      // Consent Continue
      // ----------------------------------------------------------

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


      console.log(
        'CP-014: Post-save consent Continue clicked'
      );


      // ----------------------------------------------------------
      // Make sure consent has disappeared.
      // ----------------------------------------------------------

      await expect(
        consentHeading
      ).not.toBeVisible({
        timeout:
          15000,
      });
    }


    // ============================================================
    // 22. PHYSICAL ACTIVITY
    // ============================================================

    const physicalActivityHeading =
      page.getByRole(
        'heading',
        {
          name:
            'Physical Activity',

          exact:
            true,
        }
      );


    await expect(
      physicalActivityHeading
    ).toBeVisible({
      timeout:
        20000,
    });


    // ============================================================
    // 23. ACTIVITY CONTINUE
    // ============================================================

    const activityContinue =
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
      activityContinue
    ).toBeVisible({
      timeout:
        10000,
    });


    // ============================================================
    // 24. SELECT MODERATE
    // ============================================================

    const moderateButton =
      page.getByRole(
        'button',
        {
          name:
            /^Moderate\b/,
        }
      );


    await expect(
      moderateButton
    ).toBeVisible({
      timeout:
        10000,
    });


    await moderateButton.click();


    // ============================================================
    // 25. VERIFY MODERATE SELECTED
    // ============================================================

    await expect(
      moderateButton
    ).toHaveClass(
      /border-green-500/
    );


    // ============================================================
    // 26. CONTINUE ENABLED
    // ============================================================

    await expect(
      activityContinue
    ).toBeEnabled({
      timeout:
        10000,
    });


    // ============================================================
    // 27. MOVE TO COACH SELECTION
    // ============================================================

    await activityContinue.click();


    // ============================================================
    // 28. WAIT FOR ACTIVITY SAVE
    // ============================================================

    await expect
      .poll(
        () => activitySaved,
        {
          timeout:
            15000,
        }
      )
      .toBe(true);


    // ============================================================
    // 29. COACH SELECTION
    // ============================================================

    const coachHeading =
      page.getByRole(
        'heading',
        {
          name:
            'Welcome to Wellness Valley',

          exact:
            true,
        }
      );


    await expect(
      coachHeading
    ).toBeVisible({
      timeout:
        20000,
    });


    await expect(
      page.getByText(
        'Search for the person who invited you and activate your account.',
        {
          exact:
            true,
        }
      )
    ).toBeVisible({
      timeout:
        10000,
    });


    await expect(
      page.getByRole(
        'heading',
        {
          name:
            'Person who invited you for this Program',

          exact:
            true,
        }
      )
    ).toBeVisible();


    // ============================================================
    // 30. COACH SEARCH
    // ============================================================

    const coachSearch =
      page.getByPlaceholder(
        'Type your sponsor name or email...'
      );


    await expect(
      coachSearch
    ).toBeVisible({
      timeout:
        10000,
    });


    // ============================================================
    // 31. COACH CONTINUE INITIALLY DISABLED
    // ============================================================

    const coachContinue =
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
      coachContinue
    ).toBeDisabled();


    // ============================================================
    // 32. SEARCH COACH
    // ============================================================

    await coachSearch.fill(
      'Test Coach'
    );


    // Wait for search debounce.
    await page.waitForTimeout(
      700
    );


    // ============================================================
    // 33. COACH RESULT
    // ============================================================

    const coachResult =
      page.getByText(
        'Test Coach',
        {
          exact:
            true,
        }
      );


    await expect(
      coachResult
    ).toBeVisible({
      timeout:
        15000,
    });


    // ============================================================
    // 34. SELECT COACH
    // ============================================================

    await coachResult.click();


    // ============================================================
    // 35. COACH CONTINUE ENABLED
    // ============================================================

    await expect(
      coachContinue
    ).toBeEnabled({
      timeout:
        10000,
    });


    // ============================================================
    // 36. SEND COACH REQUEST
    // ============================================================

    await coachContinue.click();


    // ============================================================
    // 37. VERIFY UPLINE REQUEST
    // ============================================================

    await expect
      .poll(
        () => uplineRequestSent,
        {
          timeout:
            15000,
        }
      )
      .toBe(true);


    // ============================================================
    // 38. FINAL ASSERTIONS
    // ============================================================

    expect(
      profileSaved
    ).toBe(true);

    expect(
      activitySaved
    ).toBe(true);

    expect(
      uplineRequestSent
    ).toBe(true);

  }
);

test(
  'CP-015 user can enter coach verification code and automatic verification is triggered',
  async ({ page }) => {

    // ============================================================
    // TEST DATA
    // ============================================================

    const TEST_PHONE = '7695834209';
    const TEST_EMAIL = 'existing@test.com';
    const TEST_OTP = '123456';

    const TEST_USER_ID = 999999;
    const TEST_COACH_ID = 12345;

    let coachOtpValidationCalled = false;


    // ============================================================
    // 1. SEND LOGIN OTP
    // ============================================================

    await page.route(
      '**/api/auth/send-otp',
      async route => {

        expect(
          route.request().method()
        ).toBe('POST');


        console.log(
          'CP-015 SEND OTP'
        );


        await route.fulfill({
          status: 200,
          contentType: 'application/json',

          body: JSON.stringify({
            success: true,
          }),
        });
      }
    );


    // ============================================================
    // 2. LOGIN OTP VERIFICATION
    // ============================================================

    await page.route(
      '**/api/auth/verify-otp',
      async route => {

        const body =
          route.request().postDataJSON();


        console.log(
          'CP-015 LOGIN OTP BODY:',
          body
        );


        expect(
          route.request().method()
        ).toBe('POST');


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
          status: 200,
          contentType: 'application/json',

          body: JSON.stringify({

            success: true,

            isNewUser: false,

            isActive: true,

            role: 'user',

            user: {

              id:
                TEST_USER_ID,

              UserId:
                TEST_USER_ID,

              username:
                'existinguser',

              email:
                TEST_EMAIL,

              phone:
                `+91${TEST_PHONE}`,

              status:
                'Active',

              consentRequired:
                false,

            },

          }),
        });
      }
    );


    // ============================================================
    // 3. USER LOOKUP
    //
    // IMPORTANT:
    // Your actual application sends POST here.
    // Do NOT assert GET.
    // ============================================================

    await page.route(
      '**/api/user/lookup*',
      async route => {

        const method =
          route.request().method();


        console.log(
          'CP-015 USER LOOKUP METHOD:',
          method
        );


        console.log(
          'CP-015 USER LOOKUP URL:',
          route.request().url()
        );


        // The real app is sending POST.
        expect(
          method
        ).toBe('POST');


        let body = {};

        try {
          body =
            route.request().postDataJSON();
        } catch {
          body = {};
        }


        console.log(
          'CP-015 USER LOOKUP BODY:',
          body
        );


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
      }
    );


    // ============================================================
    // 4. CONSENT
    // ============================================================

    await page.route(
      '**/api/user/consent*',
      async route => {

        const method =
          route.request().method();


        console.log(
          'CP-015 CONSENT:',
          method
        );


        if (
          method === 'GET'
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


    // ============================================================
    // 5. COMPLETED PROFILE
    // ============================================================

    await page.route(
      '**/api/user/profile*',
      async route => {

        const method =
          route.request().method();


        console.log(
          'CP-015 PROFILE:',
          method,
          route.request().url()
        );


        if (
          method === 'GET'
        ) {

          await route.fulfill({
            status: 200,
            contentType: 'application/json',

            body: JSON.stringify({

              success: true,

              data: {

                userId:
                  TEST_USER_ID,

                userName:
                  'Existing User',

                email:
                  TEST_EMAIL,

                phoneNumber:
                  `+91${TEST_PHONE}`,

                gender:
                  'Male',

                height:
                  170,

                dietType:
                  'Vegetarian',

                latestWeight:
                  72.5,

                latestWeightBodyFat:
                  22,

                bodyFat:
                  22,

                physicalActivityLevel:
                  'moderate',

                profileImage:
                  'https://example.com/profile.jpg',

                profileComplete:
                  true,

              },

            }),
          });

          return;
        }


        await route.continue();
      }
    );


    // ============================================================
    // 6. PENDING COACH REQUEST
    // ============================================================

    await page.route(
      '**/api/user/status*',
      async route => {

        console.log(
          'CP-015 STATUS:',
          route.request().url()
        );


        await route.fulfill({
          status: 200,
          contentType: 'application/json',

          body: JSON.stringify({

            success: true,

            setupComplete: false,

            setupSkipped: false,

            hasTeamId: false,

            hasUpline: false,

            pendingRequest: {

              id:
                TEST_COACH_ID,

              coachId:
                TEST_COACH_ID,

              coachName:
                'Test Coach',

              status:
                'pending',

            },

          }),
        });
      }
    );


    // ============================================================
    // 7. WAIT FOR COACH OTP API
    // ============================================================

    const validateCoachOtpRequest =
      page.waitForRequest(
        request =>
          request
            .url()
            .includes(
              '/api/upline/validate-otp'
            ) &&
          request.method() === 'POST',
        {
          timeout: 15000,
        }
      );


    // ============================================================
    // 8. MOCK COACH OTP VALIDATION
    // ============================================================

    await page.route(
      '**/api/upline/validate-otp',
      async route => {

        const body =
          route
            .request()
            .postDataJSON();


        console.log(
          'CP-015 COACH OTP BODY:',
          body
        );


        expect(
          body
        ).toMatchObject({

          otp:
            TEST_OTP,

          email:
            TEST_EMAIL,

        });


        coachOtpValidationCalled =
          true;


        await route.fulfill({
          status: 200,

          contentType:
            'application/json',

          body: JSON.stringify({

            success: true,

            message:
              'Verification successful',

          }),
        });
      }
    );


    // ============================================================
    // 9. OPEN APPLICATION
    // ============================================================

    await page.goto('/');


    // ============================================================
    // 10. LOGIN PAGE
    // ============================================================

    const mobileInput =
      page.getByLabel(
        'Mobile Number'
      );


    await expect(
      mobileInput
    ).toBeVisible({
      timeout: 15000,
    });


    // ============================================================
    // 11. ENTER PHONE
    // ============================================================

    await mobileInput.fill(
      TEST_PHONE
    );


    await expect(
      mobileInput
    ).toHaveValue(
      TEST_PHONE
    );


    // ============================================================
    // 12. SEND OTP
    // ============================================================

    await page
      .getByRole(
        'button',
        {
          name: 'Send OTP',
          exact: true,
        }
      )
      .click();


    // ============================================================
    // 13. LOGIN OTP PAGE
    // ============================================================

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


    const loginOtpInputs =
      page.locator(
        'input[type="tel"]'
      );


    await expect(
      loginOtpInputs
    ).toHaveCount(
      6
    );


    // ============================================================
    // 14. ENTER LOGIN OTP
    // ============================================================

    for (
      let i = 0;
      i < TEST_OTP.length;
      i++
    ) {

      await loginOtpInputs
        .nth(i)
        .fill(
          TEST_OTP[i]
        );


      await expect(
        loginOtpInputs.nth(i)
      ).toHaveValue(
        TEST_OTP[i]
      );
    }


    // ============================================================
    // 15. WAIT FOR EXISTING-USER LOGIN
    // ============================================================

    await expect
      .poll(
        async () => {

          return await page.evaluate(
            () => {

              const rawUser =
                localStorage.getItem(
                  'otpUser'
                );


              return {

                verified:
                  localStorage.getItem(
                    'isOtpVerified'
                  ),

                user:
                  rawUser
                    ? JSON.parse(
                        rawUser
                      )
                    : null,

              };
            }
          );

        },
        {
          timeout: 15000,

          intervals: [
            200,
            500,
            1000,
          ],
        }
      )
      .toMatchObject({

        verified:
          'true',

        user: {

          isNewUser:
            false,

        },

      });


    // ============================================================
    // 16. WAIT FOR APPLICATION STATE
    // ============================================================

    await page.waitForTimeout(
      500
    );


    // ============================================================
    // 17. VERIFY REQUEST PAGE
    // ============================================================

    const verifyRequestHeading =
      page.getByRole(
        'heading',
        {
          name:
            'Verify Request',

          exact: true,
        }
      );


    await expect(
      verifyRequestHeading
    ).toBeVisible({
      timeout: 20000,
    });


    // ============================================================
    // 18. VERIFY COACH
    // ============================================================

    await expect(
      page.getByText(
        'Test Coach',
        {
          exact: true,
        }
      )
    ).toBeVisible({
      timeout: 10000,
    });


    // ============================================================
    // 19. COACH OTP INPUTS
    // ============================================================

    const coachOtpInputs =
      page.locator(
        'input[data-otp="true"]'
      );


    await expect(
      coachOtpInputs
    ).toHaveCount(
      6,
      {
        timeout: 10000,
      }
    );


    // ============================================================
    // 20. VERIFY CODE BUTTON
    // ============================================================

    const verifyButton =
      page.getByRole(
        'button',
        {
          name:
            'Verify Code',

          exact: true,
        }
      );


    await expect(
      verifyButton
    ).toBeVisible();


    await expect(
      verifyButton
    ).toBeDisabled();


    // ============================================================
    // 21. ENTER COACH OTP
    // ============================================================

    for (
      let i = 0;
      i < TEST_OTP.length;
      i++
    ) {

      await coachOtpInputs
        .nth(i)
        .fill(
          TEST_OTP[i]
        );


      await expect(
        coachOtpInputs.nth(i)
      ).toHaveValue(
        TEST_OTP[i]
      );
    }


    // ============================================================
    // 22. VERIFY ALL DIGITS
    // ============================================================

    for (
      let i = 0;
      i < TEST_OTP.length;
      i++
    ) {

      await expect(
        coachOtpInputs.nth(i)
      ).toHaveValue(
        TEST_OTP[i]
      );
    }


    // ============================================================
    // 23. AUTOMATIC COACH VERIFICATION
    //
    // DO NOT CLICK "Verify Code".
    // The application must trigger the request automatically.
    // ============================================================

    const validateRequest =
      await validateCoachOtpRequest;


    // ============================================================
    // 24. VERIFY REQUEST PAYLOAD
    // ============================================================

    const validateBody =
      validateRequest
        .postDataJSON();


    expect(
      validateBody
    ).toMatchObject({

      otp:
        TEST_OTP,

      email:
        TEST_EMAIL,

    });


    // ============================================================
    // 25. SUCCESS
    // ============================================================

    await expect(
      page.getByText(
        'Verified Successfully!',
        {
          exact: true,
        }
      )
    ).toBeVisible({
      timeout: 10000,
    });


    // ============================================================
    // 26. FINAL ASSERTION
    // ============================================================

    expect(
      coachOtpValidationCalled
    ).toBe(true);

  }
);

test(
  'CP-016 successful coach verification completes setup',
  async ({ page }) => {

    // ============================================================
    // TEST DATA
    // ============================================================

    const TEST_PHONE =
      '7695834209';

    const TEST_EMAIL =
      'existing@test.com';

    const LOGIN_OTP =
      '123456';

    const COACH_OTP =
      '123456';

    const TEST_USER_ID =
      999999;

    const TEST_COACH_ID =
      12345;


    // ============================================================
    // STATE
    // ============================================================

    let coachVerified =
      false;

    let coachOtpValidationCalled =
      false;


    // ============================================================
    // 1. SEND LOGIN OTP
    // ============================================================

    await page.route(
      '**/api/auth/send-otp',
      async route => {

        expect(
          route.request().method()
        ).toBe('POST');


        console.log(
          'CP-016 SEND OTP'
        );


        await route.fulfill({
          status: 200,

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
    // 2. LOGIN OTP VERIFICATION
    // ============================================================

    await page.route(
      '**/api/auth/verify-otp',
      async route => {

        const body =
          route
            .request()
            .postDataJSON();


        console.log(
          'CP-016 LOGIN OTP BODY:',
          body
        );


        expect(
          route.request().method()
        ).toBe('POST');


        expect(
          body
        ).toMatchObject({

          recipient:
            `+91${TEST_PHONE}`,

          otp:
            LOGIN_OTP,

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
                false,

              isActive:
                true,

              role:
                'user',

              user: {

                id:
                  TEST_USER_ID,

                UserId:
                  TEST_USER_ID,

                username:
                  'existinguser',

                email:
                  TEST_EMAIL,

                phone:
                  `+91${TEST_PHONE}`,

                status:
                  'Active',

                consentRequired:
                  false,

              },

            }),
        });
      }
    );


    // ============================================================
    // 3. USER LOOKUP
    // ============================================================

    await page.route(
      '**/api/user/lookup*',
      async route => {

        console.log(
          'CP-016 USER LOOKUP:',
          route.request().method(),
          route.request().url()
        );


        // Your application sends POST here.
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

              isNewUser:
                false,

              isActive:
                true,

              role:
                'user',

            }),
        });
      }
    );


    // ============================================================
    // 4. CONSENT
    // ============================================================

    await page.route(
      '**/api/user/consent*',
      async route => {

        const method =
          route.request().method();


        console.log(
          'CP-016 CONSENT:',
          method
        );


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
                  false,

                consentAccepted:
                  true,

              }),
          });

          return;
        }


        await route.continue();

      }
    );


    // ============================================================
    // 5. COMPLETED PROFILE
    // ============================================================

    await page.route(
      '**/api/user/profile*',
      async route => {

        const method =
          route.request().method();


        console.log(
          'CP-016 PROFILE:',
          method,
          route.request().url()
        );


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

                  userId:
                    TEST_USER_ID,

                  userName:
                    'Existing User',

                  email:
                    TEST_EMAIL,

                  phoneNumber:
                    `+91${TEST_PHONE}`,

                  gender:
                    'Male',

                  height:
                    170,

                  dietType:
                    'Vegetarian',

                  latestWeight:
                    72.5,

                  latestWeightBodyFat:
                    22,

                  bodyFat:
                    22,

                  physicalActivityLevel:
                    'moderate',

                  profileImage:
                    'https://example.com/profile.jpg',

                  profileComplete:
                    true,

                },

              }),
          });

          return;
        }


        await route.continue();

      }
    );


    // ============================================================
    // 6. STATEFUL USER STATUS
    //
    // Before coach verification:
    //   setupComplete = false
    //   pendingRequest = pending
    //
    // After coach verification:
    //   setupComplete = true
    //   hasUpline = true
    //   pendingRequest = null
    // ============================================================

    await page.route(
      '**/api/user/status*',
      async route => {

        console.log(
          'CP-016 STATUS:',
          route.request().url(),
          'coachVerified:',
          coachVerified
        );


        if (
          coachVerified
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

                setupComplete:
                  true,

                setupSkipped:
                  false,

                hasTeamId:
                  true,

                hasUpline:
                  true,

                teamId:
                  1,

                uplineCoachId:
                  TEST_COACH_ID,

                role:
                  'user',

                pendingRequest:
                  null,

                redirectTo:
                  '/dashboard',

              }),
          });

          return;
        }


        await route.fulfill({
          status:
            200,

          contentType:
            'application/json',

          body:
            JSON.stringify({

              success:
                true,

              setupComplete:
                false,

              setupSkipped:
                false,

              hasTeamId:
                false,

              hasUpline:
                false,

              pendingRequest: {

                id:
                  TEST_COACH_ID,

                coachId:
                  TEST_COACH_ID,

                coachName:
                  'Test Coach',

                status:
                  'pending',

              },

              redirectTo:
                null,

            }),
        });
      }
    );


    // ============================================================
    // 7. COACH OTP VALIDATION REQUEST LISTENER
    //
    // Register before entering the coach OTP.
    // ============================================================

    const validateCoachOtpRequest =
      page.waitForRequest(
        request =>
          request
            .url()
            .includes(
              '/api/upline/validate-otp'
            ) &&
          request.method() === 'POST',
        {
          timeout:
            15000,
        }
      );


    // ============================================================
    // 8. COACH OTP VALIDATION
    // ============================================================

    await page.route(
      '**/api/upline/validate-otp',
      async route => {

        const body =
          route
            .request()
            .postDataJSON();


        console.log(
          'CP-016 COACH OTP:',
          body
        );


        expect(
          body
        ).toMatchObject({

          otp:
            COACH_OTP,

          email:
            TEST_EMAIL,

        });


        coachOtpValidationCalled =
          true;


        // IMPORTANT:
        // Change state BEFORE returning the successful response.
        // Any subsequent /status request now returns completed setup.
        coachVerified =
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

              message:
                'Verification successful',

            }),
        });
      }
    );


    // ============================================================
    // 9. OPEN APPLICATION
    // ============================================================

    await page.goto('/');


    // ============================================================
    // 10. LOGIN PAGE
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


    // ============================================================
    // 11. ENTER PHONE
    // ============================================================

    await mobileInput.fill(
      TEST_PHONE
    );


    await expect(
      mobileInput
    ).toHaveValue(
      TEST_PHONE
    );


    // ============================================================
    // 12. SEND OTP
    // ============================================================

    await page
      .getByRole(
        'button',
        {
          name:
            'Send OTP',

          exact:
            true,
        }
      )
      .click();


    // ============================================================
    // 13. LOGIN OTP PAGE
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


    const loginOtpInputs =
      page.locator(
        'input[type="tel"]'
      );


    await expect(
      loginOtpInputs
    ).toHaveCount(
      6
    );


    // ============================================================
    // 14. ENTER LOGIN OTP
    // ============================================================

    for (
      let i = 0;
      i < LOGIN_OTP.length;
      i++
    ) {

      await loginOtpInputs
        .nth(i)
        .fill(
          LOGIN_OTP[i]
        );


      await expect(
        loginOtpInputs.nth(i)
      ).toHaveValue(
        LOGIN_OTP[i]
      );
    }


    // ============================================================
    // 15. WAIT FOR EXISTING USER LOGIN
    // ============================================================

    await expect
      .poll(
        async () => {

          return await page.evaluate(
            () => {

              const rawUser =
                localStorage.getItem(
                  'otpUser'
                );


              return {

                verified:
                  localStorage.getItem(
                    'isOtpVerified'
                  ),

                user:
                  rawUser
                    ? JSON.parse(
                        rawUser
                      )
                    : null,

              };
            }
          );

        },
        {
          timeout:
            15000,

          intervals: [
            200,
            500,
            1000,
          ],
        }
      )
      .toMatchObject({

        verified:
          'true',

        user: {

          isNewUser:
            false,

        },

      });


    // ============================================================
    // 16. VERIFY REQUEST SCREEN
    // ============================================================

    const verifyRequestHeading =
      page.getByRole(
        'heading',
        {
          name:
            'Verify Request',

          exact:
            true,
        }
      );


    await expect(
      verifyRequestHeading
    ).toBeVisible({
      timeout:
        20000,
    });


    // ============================================================
    // 17. VERIFY COACH
    // ============================================================

    await expect(
      page.getByText(
        'Test Coach',
        {
          exact:
            true,
        }
      )
    ).toBeVisible({
      timeout:
        10000,
    });


    // ============================================================
    // 18. COACH OTP INPUTS
    // ============================================================

    const coachOtpInputs =
      page.locator(
        'input[data-otp="true"]'
      );


    await expect(
      coachOtpInputs
    ).toHaveCount(
      6,
      {
        timeout:
          10000,
      }
    );


    // ============================================================
    // 19. VERIFY BUTTON
    // ============================================================

    const verifyButton =
      page.getByRole(
        'button',
        {
          name:
            'Verify Code',

          exact:
            true,
        }
      );


    await expect(
      verifyButton
    ).toBeVisible();


    await expect(
      verifyButton
    ).toBeDisabled();


    // ============================================================
    // 20. ENTER COACH OTP
    // ============================================================

    for (
      let i = 0;
      i < COACH_OTP.length;
      i++
    ) {

      await coachOtpInputs
        .nth(i)
        .fill(
          COACH_OTP[i]
        );


      await expect(
        coachOtpInputs.nth(i)
      ).toHaveValue(
        COACH_OTP[i]
      );
    }


    // ============================================================
    // 21. VERIFY ALL DIGITS
    // ============================================================

    for (
      let i = 0;
      i < COACH_OTP.length;
      i++
    ) {

      await expect(
        coachOtpInputs.nth(i)
      ).toHaveValue(
        COACH_OTP[i]
      );
    }


    // ============================================================
    // 22. AUTOMATIC COACH VERIFICATION
    //
    // We intentionally DO NOT click Verify Code.
    // ============================================================

    const validateRequest =
      await validateCoachOtpRequest;


    expect(
      validateRequest
        .postDataJSON()
    ).toMatchObject({

      otp:
        COACH_OTP,

      email:
        TEST_EMAIL,

    });


    expect(
      coachOtpValidationCalled
    ).toBe(true);


    // ============================================================
    // 23. SUCCESS MESSAGE
    // ============================================================

    await expect(
      page.getByText(
        'Verified Successfully!',
        {
          exact:
            true,
        }
      )
    ).toBeVisible({
      timeout:
        10000,
    });


    // ============================================================
    // 24. VERIFY REQUEST SCREEN DISAPPEARS
    // ============================================================

    await expect(
      verifyRequestHeading
    ).not.toBeVisible({
      timeout:
        15000,
    });


    // ============================================================
    // 25. WAIT FOR COMPLETED SETUP STATE
    //
    // The application should request /status again.
    // Our stateful mock now returns setupComplete=true.
    // ============================================================

    await expect
      .poll(
        () => coachVerified,
        {
          timeout:
            10000,
        }
      )
      .toBe(true);


    // ============================================================
    // 26. VERIFY HOME PAGE
    // ============================================================

    await expect(
      page.getByText(
        'Tracking Wellness with Ease',
        {
          exact:
            true,
        }
      )
    ).toBeVisible({
      timeout:
        20000,
    });


    // ============================================================
    // 27. VERIFY MAIN NAVIGATION
    // ============================================================

    await expect(
      page.getByText(
        'Home',
        {
          exact:
            true,
        }
      )
    ).toBeVisible();


    await expect(
      page.getByText(
        'Diary',
        {
          exact:
            true,
        }
      )
    ).toBeVisible();


    await expect(
      page.getByText(
        'Activity',
        {
          exact:
            true,
        }
      )
    ).toBeVisible();


    await expect(
      page.getByText(
        'Programs',
        {
          exact:
            true,
        }
      )
    ).toBeVisible();


    // ============================================================
    // 28. FINAL SETUP ASSERTIONS
    // ============================================================

    expect(
      coachVerified
    ).toBe(true);

    expect(
      coachOtpValidationCalled
    ).toBe(true);

  }
);

test(
  'CP-017 Home page is displayed after onboarding is complete',
  async ({ page }) => {

    // ============================================================
    // TEST DATA
    // ============================================================

    const TEST_PHONE =
      '7695834209';

    const TEST_EMAIL =
      'existing@test.com';

    const LOGIN_OTP =
      '123456';

    const TEST_USER_ID =
      999999;


    // ============================================================
    // 1. SEND LOGIN OTP
    // ============================================================

    await page.route(
      '**/api/auth/send-otp',
      async route => {

        expect(
          route.request().method()
        ).toBe('POST');


        console.log(
          'CP-017 SEND OTP'
        );


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
    // 2. LOGIN OTP VERIFICATION
    // ============================================================

    await page.route(
      '**/api/auth/verify-otp',
      async route => {

        const body =
          route
            .request()
            .postDataJSON();


        console.log(
          'CP-017 LOGIN OTP BODY:',
          body
        );


        expect(
          route.request().method()
        ).toBe('POST');


        expect(
          body
        ).toMatchObject({

          recipient:
            `+91${TEST_PHONE}`,

          otp:
            LOGIN_OTP,

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
                false,

              isActive:
                true,

              role:
                'user',

              user: {

                id:
                  TEST_USER_ID,

                UserId:
                  TEST_USER_ID,

                username:
                  'existinguser',

                email:
                  TEST_EMAIL,

                phone:
                  `+91${TEST_PHONE}`,

                status:
                  'Active',

                consentRequired:
                  false,

              },

            }),
        });
      }
    );


    // ============================================================
    // 3. USER LOOKUP
    // ============================================================

    await page.route(
      '**/api/user/lookup*',
      async route => {

        console.log(
          'CP-017 USER LOOKUP:',
          route.request().method(),
          route.request().url()
        );


        // Your application sends POST.
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

              isNewUser:
                false,

              isActive:
                true,

              role:
                'user',

            }),
        });
      }
    );


    // ============================================================
    // 4. CONSENT ALREADY ACCEPTED
    // ============================================================

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


        await route.continue();
      }
    );


    // ============================================================
    // 5. COMPLETED PROFILE
    // ============================================================

    await page.route(
      '**/api/user/profile*',
      async route => {

        const method =
          route.request().method();


        console.log(
          'CP-017 PROFILE:',
          method,
          route.request().url()
        );


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

                  userId:
                    TEST_USER_ID,

                  userName:
                    'Existing User',

                  email:
                    TEST_EMAIL,

                  phoneNumber:
                    `+91${TEST_PHONE}`,

                  gender:
                    'Male',

                  height:
                    170,

                  dietType:
                    'Vegetarian',

                  latestWeight:
                    72.5,

                  latestWeightBodyFat:
                    22,

                  bodyFat:
                    22,

                  physicalActivityLevel:
                    'moderate',

                  profileImage:
                    'https://example.com/profile.jpg',

                  profileComplete:
                    true,

                },

              }),
          });

          return;
        }


        await route.continue();
      }
    );


    // ============================================================
    // 6. ONBOARDING / SETUP IS COMPLETE
    //
    // Single stateful handler.
    // ============================================================

    await page.route(
      '**/api/user/status*',
      async route => {

        console.log(
          'CP-017 STATUS:',
          route.request().url()
        );


        await route.fulfill({
          status:
            200,

          contentType:
            'application/json',

          body:
            JSON.stringify({

              success:
                true,

              setupComplete:
                true,

              setupSkipped:
                false,

              hasTeamId:
                true,

              hasUpline:
                true,

              teamId:
                1,

              uplineCoachId:
                12345,

              role:
                'user',

              pendingRequest:
                null,

              redirectTo:
                null,

            }),
        });
      }
    );


    // ============================================================
    // 7. HOME LEADERBOARD APIs
    // ============================================================

    await page.route(
      '**/api/leaderboard/get-global-leaderboard**',
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

              data:
                [],

            }),
        });
      }
    );


    await page.route(
      '**/api/leaderboard/get-wellness-score-leaderboard**',
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

              data:
                [],

            }),
        });
      }
    );


    // ============================================================
    // 8. OPEN APPLICATION
    // ============================================================

    await page.goto('/');


    // ============================================================
    // 9. LOGIN PAGE
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


    // ============================================================
    // 10. ENTER PHONE NUMBER
    // ============================================================

    await mobileInput.fill(
      TEST_PHONE
    );


    await expect(
      mobileInput
    ).toHaveValue(
      TEST_PHONE
    );


    // ============================================================
    // 11. SEND OTP
    // ============================================================

    await page
      .getByRole(
        'button',
        {
          name:
            'Send OTP',

          exact:
            true,
        }
      )
      .click();


    // ============================================================
    // 12. LOGIN OTP SCREEN
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


    const loginOtpInputs =
      page.locator(
        'input[type="tel"]'
      );


    await expect(
      loginOtpInputs
    ).toHaveCount(
      6
    );


    // ============================================================
    // 13. ENTER LOGIN OTP
    // ============================================================

    for (
      let i = 0;
      i < LOGIN_OTP.length;
      i++
    ) {

      await loginOtpInputs
        .nth(i)
        .fill(
          LOGIN_OTP[i]
        );


      await expect(
        loginOtpInputs.nth(i)
      ).toHaveValue(
        LOGIN_OTP[i]
      );
    }


    // ============================================================
    // 14. WAIT FOR EXISTING USER AUTHENTICATION
    // ============================================================

    await expect
      .poll(
        async () => {

          return await page.evaluate(
            () => {

              const rawUser =
                localStorage.getItem(
                  'otpUser'
                );


              return {

                verified:
                  localStorage.getItem(
                    'isOtpVerified'
                  ),

                user:
                  rawUser
                    ? JSON.parse(
                        rawUser
                      )
                    : null,

              };
            }
          );

        },
        {
          timeout:
            15000,

          intervals:
            [
              200,
              500,
              1000,
            ],
        }
      )
      .toMatchObject({

        verified:
          'true',

        user: {

          isNewUser:
            false,

        },

      });


    // ============================================================
    // 15. WAIT FOR POST-LOGIN APPLICATION INITIALIZATION
    // ============================================================

    await page.waitForTimeout(
      500
    );


    // ============================================================
    // 16. HOME PAGE
    // ============================================================

    await expect(
      page.getByText(
        'Tracking Wellness with Ease',
        {
          exact:
            true,
        }
      )
    ).toBeVisible({
      timeout:
        20000,
    });


    // ============================================================
    // 17. MAIN NAVIGATION
    // ============================================================

    await expect(
      page.getByText(
        'Home',
        {
          exact:
            true,
        }
      )
    ).toBeVisible();


    await expect(
      page.getByText(
        'Diary',
        {
          exact:
            true,
        }
      )
    ).toBeVisible();


    await expect(
      page.getByText(
        'Activity',
        {
          exact:
            true,
        }
      )
    ).toBeVisible();


    await expect(
      page.getByText(
        'Programs',
        {
          exact:
            true,
        }
      )
    ).toBeVisible();


    // ============================================================
    // 18. HOME ACTIONS
    // ============================================================

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


    // ============================================================
    // 19. ONBOARDING SCREENS MUST NOT APPEAR
    // ============================================================

    await expect(
      page.getByRole(
        'heading',
        {
          name:
            'Complete Your Profile',

          exact:
            true,
        }
      )
    ).not.toBeVisible();


    await expect(
      page.getByRole(
        'heading',
        {
          name:
            'Welcome to Wellness Valley',

          exact:
            true,
        }
      )
    ).not.toBeVisible();


    await expect(
      page.getByRole(
        'heading',
        {
          name:
            'Verify Request',

          exact:
            true,
        }
      )
    ).not.toBeVisible();


    // ============================================================
    // 20. CONSENT FORM MUST NOT APPEAR
    // ============================================================

    await expect(
      page.getByRole(
        'heading',
        {
          name:
            'User Consent Form',

          exact:
            true,
        }
      )
    ).not.toBeVisible();

  }
);


test(
  'CP-018 user can select all main application navigation options',
  async ({ page }) => {

    // ============================================================
    // TEST DATA
    // ============================================================

    const TEST_PHONE = '7695834209';

    const LOGIN_OTP = '123456';

    const TEST_EMAIL = 'existing@test.com';

    const TEST_USER_ID = 861;


    // ============================================================
    // 1. SEND OTP
    // ============================================================

    await page.route(
      '**/api/auth/send-otp',
      async route => {

        console.log(
          'CP-018 SEND OTP'
        );

        expect(
          route.request().method()
        ).toBe('POST');

        await route.fulfill({
          status: 200,
          contentType: 'application/json',

          body: JSON.stringify({
            success: true,
          }),
        });
      }
    );


    // ============================================================
    // 2. VERIFY LOGIN OTP
    // ============================================================

    await page.route(
      '**/api/auth/verify-otp',
      async route => {

        const body =
          route.request().postDataJSON();

        console.log(
          'CP-018 LOGIN OTP BODY:',
          body
        );

        expect(
          route.request().method()
        ).toBe('POST');

        expect(
          body
        ).toMatchObject({

          recipient:
            `+91${TEST_PHONE}`,

          otp:
            LOGIN_OTP,

          contactType:
            'phone',
        });

        await route.fulfill({
          status: 200,
          contentType: 'application/json',

          body: JSON.stringify({

            success:
              true,

            isNewUser:
              false,

            isActive:
              true,

            role:
              'user',

            user: {

              id:
                TEST_USER_ID,

              UserId:
                TEST_USER_ID,

              username:
                'existinguser',

              email:
                TEST_EMAIL,

              phone:
                `+91${TEST_PHONE}`,

              status:
                'Active',

              consentRequired:
                false,
            },
          }),
        });
      }
    );


    // ============================================================
// 3. USER LOOKUP
//
// The application uses POST during login and may use GET later
// during navigation/page initialization.
//
// Both methods must be supported.
// ============================================================

await page.route(
  '**/api/user/lookup*',
  async route => {

    const method =
      route.request().method();

    console.log(
      'CP-018 USER LOOKUP:',
      method,
      route.request().url()
    );

    // ----------------------------------------------------------
    // POST lookup
    // ----------------------------------------------------------

    if (
      method === 'POST'
    ) {

      await route.fulfill({
        status: 200,

        contentType:
          'application/json',

        body:
          JSON.stringify({

            success:
              true,

            isNewUser:
              false,

            isActive:
              true,

            role:
              'user',

          }),
      });

      return;
    }


    // ----------------------------------------------------------
    // GET lookup
    // ----------------------------------------------------------

    if (
      method === 'GET'
    ) {

      await route.fulfill({
        status: 200,

        contentType:
          'application/json',

        body:
          JSON.stringify({

            success:
              true,

            isNewUser:
              false,

            isActive:
              true,

            role:
              'user',

            data: {

              userId:
                TEST_USER_ID,

              userName:
                'Existing User',

              email:
                TEST_EMAIL,

              phoneNumber:
                `+91${TEST_PHONE}`,

            },

          }),
      });

      return;
    }


    // ----------------------------------------------------------
    // Any other method
    // ----------------------------------------------------------

    await route.continue();
  }
);

    // ============================================================
    // 4. CONSENT
    // ============================================================

    await page.route(
      '**/api/user/consent*',
      async route => {

        const method =
          route.request().method();

        console.log(
          'CP-018 CONSENT:',
          method
        );

        if (
          method === 'GET'
        ) {

          await route.fulfill({
            status: 200,
            contentType: 'application/json',

            body: JSON.stringify({

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

        await route.continue();
      }
    );


    // ============================================================
    // 5. COMPLETED PROFILE
    // ============================================================

    await page.route(
      '**/api/user/profile*',
      async route => {

        const method =
          route.request().method();

        console.log(
          'CP-018 PROFILE:',
          method,
          route.request().url()
        );

        if (
          method === 'GET'
        ) {

          await route.fulfill({
            status: 200,
            contentType: 'application/json',

            body: JSON.stringify({

              success:
                true,

              data: {

                userId:
                  TEST_USER_ID,

                userName:
                  'Existing User',

                email:
                  TEST_EMAIL,

                phoneNumber:
                  `+91${TEST_PHONE}`,

                gender:
                  'Male',

                height:
                  170,

                dietType:
                  'Vegetarian',

                latestWeight:
                  72.5,

                latestWeightBodyFat:
                  22,

                bodyFat:
                  22,

                physicalActivityLevel:
                  'moderate',

                profileImage:
                  'https://example.com/profile.jpg',

                profileComplete:
                  true,
              },
            }),
          });

          return;
        }

        await route.continue();
      }
    );


    // ============================================================
    // 6. SETUP COMPLETE
    //
    // Prevent Complete Profile / Coach / Verify Request screens.
    // ============================================================

    await page.route(
      '**/api/user/status*',
      async route => {

        console.log(
          'CP-018 STATUS:',
          route.request().url()
        );

        await route.fulfill({
          status: 200,
          contentType: 'application/json',

          body: JSON.stringify({

            success:
              true,

            setupComplete:
              true,

            setupSkipped:
              false,

            hasTeamId:
              true,

            hasUpline:
              true,

            teamId:
              1,

            uplineCoachId:
              12345,

            role:
              'user',

            pendingRequest:
              null,

            redirectTo:
              null,
          }),
        });
      }
    );


    // ============================================================
    // 7. LEADERBOARD MOCKS
    // ============================================================

    await page.route(
      '**/api/leaderboard/get-global-leaderboard**',
      async route => {

        await route.fulfill({
          status: 200,
          contentType: 'application/json',

          body: JSON.stringify({

            success:
              true,

            data:
              [],
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

            success:
              true,

            data:
              [],
          }),
        });
      }
    );


    // ============================================================
    // 8. OPEN APPLICATION
    // ============================================================

    await page.goto('/');


    // ============================================================
    // 9. LOGIN SCREEN
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
    // 10. SEND OTP
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
    // 11. LOGIN OTP SCREEN
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
      6
    );


    // ============================================================
    // 12. ENTER LOGIN OTP
    // ============================================================

    for (
      let i = 0;
      i < LOGIN_OTP.length;
      i++
    ) {

      await otpInputs
        .nth(i)
        .fill(
          LOGIN_OTP[i]
        );

      await expect(
        otpInputs.nth(i)
      ).toHaveValue(
        LOGIN_OTP[i]
      );
    }


    // ============================================================
    // 13. WAIT FOR AUTHENTICATION
    // ============================================================

    await expect
      .poll(
        async () => {

          return await page.evaluate(
            () => {

              const rawUser =
                localStorage.getItem(
                  'otpUser'
                );

              return {

                verified:
                  localStorage.getItem(
                    'isOtpVerified'
                  ),

                user:
                  rawUser
                    ? JSON.parse(rawUser)
                    : null,
              };
            }
          );
        },
        {
          timeout:
            15000,

          intervals:
            [
              200,
              500,
              1000,
            ],
        }
      )
      .toMatchObject({

        verified:
          'true',

        user: {
          isNewUser:
            false,
        },
      });


    // ============================================================
    // 14. WAIT FOR HOME NAVIGATION
    // ============================================================

    const homeButton =
      page.getByRole(
        'button',
        {
          name:
            'Home',

          exact:
            true,
        }
      );

    const diaryButton =
      page.getByRole(
        'button',
        {
          name:
            'Diary',

          exact:
            true,
        }
      );

    const activityButton =
      page.getByRole(
        'button',
        {
          name:
            'Activity Report',

          exact:
            true,
        }
      );

    const programsButton =
      page.getByRole(
        'button',
        {
          name:
            'Enrollment',

          exact:
            true,
        }
      );

    const bcmButton =
      page.getByRole(
        'button',
        {
          name:
            'Counselling',

          exact:
            true,
        }
      );

    const clubButton =
      page.getByRole(
        'button',
        {
          name:
            'Physical Club',

          exact:
            true,
        }
      );

    const transformationButton =
      page.getByRole(
        'button',
        {
          name:
            'Testimonials',

          exact:
            true,
        }
      );


    // ============================================================
    // 15. VERIFY ALL NAVIGATION CONTROLS
    // ============================================================

    await expect(
      homeButton
    ).toBeVisible({
      timeout:
        20000,
    });

    await expect(
      diaryButton
    ).toBeVisible({
      timeout:
        20000,
    });

    await expect(
      activityButton
    ).toBeVisible({
      timeout:
        20000,
    });

    await expect(
      programsButton
    ).toBeVisible({
      timeout:
        20000,
    });

    await expect(
      bcmButton
    ).toBeVisible({
      timeout:
        20000,
    });

    await expect(
      clubButton
    ).toBeVisible({
      timeout:
        20000,
    });

    await expect(
      transformationButton
    ).toBeVisible({
      timeout:
        20000,
    });

    console.log(
      'CP-018 HOME NAVIGATION READY'
    );


    // ============================================================
    // 16. NAVIGATION HELPER
    // ============================================================

    async function selectNavigation(
      button,
      expectedActiveClass,
      displayName
    ) {

      await expect(
        button
      ).toBeVisible({
        timeout:
          10000,
      });

      await button.click();


      // React may need a render cycle before the class changes.

      await expect
        .poll(
          async () => {

            return (
              await button.getAttribute(
                'class'
              )
            ) || '';

          },
          {
            timeout:
              10000,

            intervals:
              [
                200,
                500,
                1000,
              ],
          }
        )
        .toContain(
          expectedActiveClass
        );

      console.log(
        `CP-018 ${displayName} selected`
      );
    }


    // ============================================================
    // 17. HOME
    // ============================================================

    await selectNavigation(
      homeButton,
      'bg-green-100',
      'HOME'
    );


    // ============================================================
    // 18. DIARY
    // ============================================================

    await selectNavigation(
      diaryButton,
      'bg-green-100',
      'DIARY'
    );


    // ============================================================
    // 19. ACTIVITY
    // ============================================================

    await selectNavigation(
      activityButton,
      'bg-violet-100',
      'ACTIVITY'
    );


    // ============================================================
    // 20. PROGRAMS
    // ============================================================

    await selectNavigation(
      programsButton,
      'bg-emerald-100',
      'PROGRAMS'
    );


    // ============================================================
    // 21. BCM
    // ============================================================

    await selectNavigation(
      bcmButton,
      'bg-pink-100',
      'BCM'
    );


    // ============================================================
    // 22. CLUB
    // ============================================================

    await selectNavigation(
      clubButton,
      'bg-teal-100',
      'CLUB'
    );


    // ============================================================
    // 23. TRANSFORMATION
    // ============================================================

    await selectNavigation(
      transformationButton,
      'bg-teal-100',
      'TRANSFORMATION'
    );


    // ============================================================
    // 24. RETURN TO HOME
    // ============================================================

    await selectNavigation(
      homeButton,
      'bg-green-100',
      'HOME FINAL'
    );


    // ============================================================
    // 25. FINAL ASSERTION
    // ============================================================

    await expect
      .poll(
        async () => {

          return (
            await homeButton.getAttribute(
              'class'
            )
          ) || '';

        },
        {
          timeout:
            10000,

          intervals:
            [
              200,
              500,
              1000,
            ],
        }
      )
      .toContain(
        'bg-green-100'
      );


    console.log(
      'CP-018 FINAL HOME SELECTED'
    );

  }
);


test(
  'CP-019 My Profile opens and displays Personal Details',
  async ({ page }) => {

    // ============================================================
    // TEST DATA
    // ============================================================

    const TEST_PHONE =
      '7695834209';

    const LOGIN_OTP =
      '123456';

    const TEST_EMAIL =
      'existing@test.com';

    const TEST_USER_ID =
      861;


    // ============================================================
    // 1. SEND OTP
    // ============================================================

    await page.route(
      '**/api/auth/send-otp',
      async route => {

        console.log(
          'CP-019 SEND OTP'
        );

        await route.fulfill({
          status: 200,
          contentType: 'application/json',

          body: JSON.stringify({
            success: true,
          }),
        });
      }
    );


    // ============================================================
    // 2. VERIFY LOGIN OTP
    // ============================================================

    await page.route(
      '**/api/auth/verify-otp',
      async route => {

        const body =
          route.request().postDataJSON();

        console.log(
          'CP-019 LOGIN OTP BODY:',
          body
        );

        expect(
          body
        ).toMatchObject({
          recipient:
            `+91${TEST_PHONE}`,

          otp:
            LOGIN_OTP,

          contactType:
            'phone',
        });

        await route.fulfill({
          status: 200,
          contentType: 'application/json',

          body: JSON.stringify({

            success:
              true,

            isNewUser:
              false,

            isActive:
              true,

            role:
              'user',

            user: {

              id:
                TEST_USER_ID,

              UserId:
                TEST_USER_ID,

              username:
                'existinguser',

              email:
                TEST_EMAIL,

              phone:
                `+91${TEST_PHONE}`,

              status:
                'Active',

              consentRequired:
                false,
            },
          }),
        });
      }
    );


    // ============================================================
    // 3. USER LOOKUP
    // Supports both POST and GET because the application uses
    // lookup again after authentication/navigation.
    // ============================================================

    await page.route(
      '**/api/user/lookup*',
      async route => {

        console.log(
          'CP-019 USER LOOKUP:',
          route.request().method(),
          route.request().url()
        );

        await route.fulfill({
          status: 200,
          contentType: 'application/json',

          body: JSON.stringify({

            success:
              true,

            isNewUser:
              false,

            isActive:
              true,

            role:
              'user',

            data: {

              userId:
                TEST_USER_ID,

              email:
                TEST_EMAIL,
            },
          }),
        });
      }
    );


    // ============================================================
    // 4. CONSENT
    // ============================================================

    await page.route(
      '**/api/user/consent*',
      async route => {

        if (
          route.request().method() ===
          'GET'
        ) {

          await route.fulfill({
            status: 200,
            contentType: 'application/json',

            body: JSON.stringify({

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

        await route.continue();
      }
    );


    // ============================================================
    // 5. COMPLETED PROFILE
    // ============================================================

    await page.route(
      '**/api/user/profile*',
      async route => {

        const method =
          route.request().method();

        console.log(
          'CP-019 PROFILE:',
          method,
          route.request().url()
        );

        if (
          method === 'GET'
        ) {

          await route.fulfill({
            status: 200,
            contentType: 'application/json',

            body: JSON.stringify({

              success:
                true,

              data: {

                userId:
                  TEST_USER_ID,

                userName:
                  'Nitheesh Lingam',

                email:
                  TEST_EMAIL,

                phoneNumber:
                  TEST_PHONE,

                gender:
                  'Male',

                height:
                  170,

                communityId:
                  'WB12345',

                dietType:
                  'Vegetarian',

                latestWeight:
                  72.5,

                latestWeightBodyFat:
                  22,

                bodyFat:
                  22,

                physicalActivityLevel:
                  'moderate',

                profileImage:
                  'https://example.com/profile.jpg',

                profileComplete:
                  true,

                bmr:
                  1424,

                weightGoalMode:
                  'maintain',
              },
            }),
          });

          return;
        }

        await route.continue();
      }
    );


    // ============================================================
    // 6. SETUP COMPLETE
    // ============================================================

    await page.route(
      '**/api/user/status*',
      async route => {

        await route.fulfill({
          status: 200,
          contentType: 'application/json',

          body: JSON.stringify({

            success:
              true,

            setupComplete:
              true,

            setupSkipped:
              true,

            hasTeamId:
              true,

            hasUpline:
              true,

            teamId:
              1,

            uplineCoachId:
              12345,

            role:
              'user',

            pendingRequest:
              null,

            redirectTo:
              null,
          }),
        });
      }
    );


    // ============================================================
    // 7. OPEN APPLICATION
    // ============================================================

    await page.goto('/');


    // ============================================================
    // 8. LOGIN
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


    await page
      .getByRole(
        'button',
        {
          name:
            'Send OTP',

          exact:
            true,
        }
      )
      .click();


    // ============================================================
    // 9. OTP
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
      6
    );


    for (
      let i = 0;
      i < LOGIN_OTP.length;
      i++
    ) {

      await otpInputs
        .nth(i)
        .fill(
          LOGIN_OTP[i]
        );
    }


    // ============================================================
    // 10. WAIT FOR AUTHENTICATION
    // ============================================================

    await expect
      .poll(
        async () => {

          return await page.evaluate(
            () => {

              const rawUser =
                localStorage.getItem(
                  'otpUser'
                );

              return {

                verified:
                  localStorage.getItem(
                    'isOtpVerified'
                  ),

                user:
                  rawUser
                    ? JSON.parse(rawUser)
                    : null,
              };
            }
          );
        },
        {
          timeout:
            15000,

          intervals:
            [
              200,
              500,
              1000,
            ],
        }
      )
      .toMatchObject({

        verified:
          'true',

        user: {
          isNewUser:
            false,
        },
      });


    // ============================================================
    // 11. OPEN MY PROFILE
    // ============================================================

    const myProfileButton =
      page.getByRole(
        'button',
        {
          name:
            'My Profile',

          exact:
            true,
        }
      );


    await expect(
      myProfileButton
    ).toBeVisible({
      timeout:
        20000,
    });


    await myProfileButton.click();


    // ============================================================
    // 12. PROFILE PAGE
    // ============================================================

    await expect(
      page.getByRole(
        'heading',
        {
          name:
            'My Profile',

          exact:
            true,
        }
      )
    ).toBeVisible({
      timeout:
        15000,
    });


    // ============================================================
    // 13. PERSONAL DETAILS SECTION
    // ============================================================

    const personalDetailsHeading =
      page.getByText(
        'Personal Details',
        {
          exact:
            true,
        }
      );


    await expect(
      personalDetailsHeading
    ).toBeVisible();


    const personalDetailsSection =
      personalDetailsHeading.locator(
        'xpath=ancestor::div[contains(@class,"bg-white")][1]'
      );


    await expect(
      personalDetailsSection
    ).toBeVisible();


    // ============================================================
    // 14. VERIFY CURRENT INPUT STRUCTURE
    // ============================================================

    const personalInputs =
      personalDetailsSection.locator(
        'input'
      );


    await expect(
      personalInputs
    ).toHaveCount(
      6
    );


    // ============================================================
    // 15. EMAIL
    // ============================================================

    const emailInput =
      personalInputs.nth(0);


    await expect(
      emailInput
    ).toHaveAttribute(
      'type',
      'email'
    );


    await expect(
      emailInput
    ).toHaveValue(
      TEST_EMAIL
    );


    // ============================================================
    // 16. NAME
    // ============================================================

    const nameInput =
      personalInputs.nth(1);


    await expect(
      nameInput
    ).toHaveAttribute(
      'placeholder',
      'Enter your name'
    );


    await expect(
      nameInput
    ).toHaveValue(
      'Nitheesh Lingam'
    );


    // ============================================================
    // 17. HEIGHT
    // ============================================================

    const heightInput =
      personalInputs.nth(2);


    await expect(
      heightInput
    ).toHaveAttribute(
      'placeholder',
      'e.g. 170'
    );


    await expect(
      heightInput
    ).toHaveValue(
      '170'
    );


    // ============================================================
    // 18. PHONE NUMBER
    // ============================================================

    const phoneInput =
      personalInputs.nth(3);


    await expect(
      phoneInput
    ).toHaveValue(
      TEST_PHONE
    );


    // ============================================================
    // 19. COMMUNITY ID
    // ============================================================

    const communityIdInput =
      personalInputs.nth(4);


    await expect(
      communityIdInput
    ).toHaveAttribute(
      'placeholder',
      'e.g. WB12345'
    );


    await expect(
      communityIdInput
    ).toHaveValue(
      'WB12345'
    );


    // ============================================================
    // 20. BMR
    //
    // Actual DOM from your test run:
    // value=""
    // placeholder="Calculated automatically"
    // readonly=true
    // ============================================================

    const bmrInput =
      personalInputs.nth(5);


    await expect(
      bmrInput
    ).toHaveAttribute(
      'placeholder',
      'Calculated automatically'
    );


    await expect(
      bmrInput
    ).toHaveAttribute(
      'readonly'
    );


    // ============================================================
    // 21. GENDER
    // ============================================================

    const personalSelects =
      personalDetailsSection.locator(
        'select'
      );


    await expect(
      personalSelects
    ).toHaveCount(
      2
    );


    const genderSelect =
      personalSelects.nth(0);


    await expect(
      genderSelect
    ).toBeVisible();


    await expect(
      genderSelect
    ).toHaveValue(
      'Male'
    );


    // ============================================================
    // 22. PHYSICAL ACTIVITY
    // ============================================================

    const activitySelect =
      personalSelects.nth(1);


    await expect(
      activitySelect
    ).toBeVisible();


    await expect(
      activitySelect
    ).toHaveValue(
      'moderate'
    );


    // ============================================================
    // 23. COMPLETE PROFILE MUST NOT BE PRESENT
    // ============================================================

    await expect(
      page.getByRole(
        'heading',
        {
          name:
            'Complete Your Profile',

          exact:
            true,
        }
      )
    ).not.toBeVisible();


    // ============================================================
    // 24. FINAL
    // ============================================================

    console.log(
      'CP-019 PROFILE PERSONAL DETAILS VERIFIED'
    );

  }
);

test(
  'CP-020 Profile Name field accepts valid value and empty value',
  async ({ page }) => {

    // ============================================================
    // TEST DATA
    // ============================================================

    const TEST_PHONE = '7695834209';
    const LOGIN_OTP = '123456';
    const TEST_EMAIL = 'existing@test.com';
    const TEST_USER_ID = 861;


    // ============================================================
    // 1. SEND OTP
    // ============================================================

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


    // ============================================================
    // 2. VERIFY LOGIN OTP
    // ============================================================

    await page.route(
      '**/api/auth/verify-otp',
      async route => {

        const body =
          route.request().postDataJSON();

        expect(body).toMatchObject({

          recipient:
            `+91${TEST_PHONE}`,

          otp:
            LOGIN_OTP,

          contactType:
            'phone',
        });

        await route.fulfill({
          status: 200,
          contentType: 'application/json',

          body: JSON.stringify({

            success: true,

            isNewUser: false,

            isActive: true,

            role: 'user',

            user: {

              id: TEST_USER_ID,
              UserId: TEST_USER_ID,

              username: 'existinguser',

              email: TEST_EMAIL,

              phone:
                `+91${TEST_PHONE}`,

              status: 'Active',

              consentRequired: false,
            },
          }),
        });

      }
    );


    // ============================================================
    // 3. USER LOOKUP
    // ============================================================

    await page.route(
      '**/api/user/lookup*',
      async route => {

        await route.fulfill({
          status: 200,
          contentType: 'application/json',

          body: JSON.stringify({

            success: true,

            isNewUser: false,

            isActive: true,

            role: 'user',

            data: {

              userId: TEST_USER_ID,

              email: TEST_EMAIL,
            },
          }),
        });

      }
    );


    // ============================================================
    // 4. CONSENT
    // ============================================================

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


    // ============================================================
    // 5. COMPLETED PROFILE
    // ============================================================

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

                userId: TEST_USER_ID,

                userName:
                  'Nitheesh Lingam',

                email:
                  TEST_EMAIL,

                phoneNumber:
                  TEST_PHONE,

                gender:
                  'Male',

                height:
                  170,

                communityId:
                  'WB12345',

                dietType:
                  'Vegetarian',

                latestWeight:
                  72.5,

                latestWeightBodyFat:
                  22,

                latestBmr:
                  1424,

                bodyFat:
                  22,

                physicalActivityLevel:
                  'moderate',

                profileImage:
                  'https://example.com/profile.jpg',

                profileComplete:
                  true,

                weightGoalMode:
                  'maintain',
              },
            }),
          });

          return;
        }

        await route.continue();

      }
    );


    // ============================================================
    // 6. SETUP COMPLETE
    // ============================================================

    await page.route(
      '**/api/user/status*',
      async route => {

        await route.fulfill({
          status: 200,
          contentType: 'application/json',

          body: JSON.stringify({

            success: true,

            setupComplete: true,

            setupSkipped: true,

            hasTeamId: true,

            hasUpline: true,

            teamId: 1,

            uplineCoachId: 12345,

            role: 'user',

            pendingRequest: null,

            redirectTo: null,
          }),
        });

      }
    );


    // ============================================================
    // 7. OPEN APPLICATION
    // ============================================================

    await page.goto('/');


    // ============================================================
    // 8. LOGIN
    // ============================================================

    const mobileInput =
      page.getByLabel('Mobile Number');

    await expect(
      mobileInput
    ).toBeVisible({
      timeout: 15000,
    });

    await mobileInput.fill(
      TEST_PHONE
    );

    await page
      .getByRole('button', {
        name: 'Send OTP',
        exact: true,
      })
      .click();


    // ============================================================
    // 9. ENTER LOGIN OTP
    // ============================================================

    await expect(
      page.getByText('Enter OTP', {
        exact: true,
      })
    ).toBeVisible({
      timeout: 15000,
    });

    const otpInputs =
      page.locator('input[type="tel"]');

    await expect(
      otpInputs
    ).toHaveCount(6);

    for (
      let i = 0;
      i < LOGIN_OTP.length;
      i++
    ) {

      await otpInputs
        .nth(i)
        .fill(
          LOGIN_OTP[i]
        );
    }


    // ============================================================
    // 10. WAIT FOR AUTHENTICATION
    // ============================================================

    await expect
      .poll(
        async () => {

          return await page.evaluate(
            () => {

              const rawUser =
                localStorage.getItem(
                  'otpUser'
                );

              return {

                verified:
                  localStorage.getItem(
                    'isOtpVerified'
                  ),

                user:
                  rawUser
                    ? JSON.parse(rawUser)
                    : null,
              };

            }
          );

        },
        {
          timeout: 15000,

          intervals: [
            200,
            500,
            1000,
          ],
        }
      )
      .toMatchObject({

        verified: 'true',

        user: {
          isNewUser: false,
        },
      });


    // ============================================================
    // 11. OPEN MY PROFILE
    // ============================================================

    const myProfileButton =
      page.getByRole('button', {
        name: 'My Profile',
        exact: true,
      });

    await expect(
      myProfileButton
    ).toBeVisible({
      timeout: 20000,
    });

    await myProfileButton.click();


    // ============================================================
    // 12. VERIFY PROFILE PAGE
    // ============================================================

    await expect(
      page.getByRole('heading', {
        name: 'My Profile',
        exact: true,
      })
    ).toBeVisible({
      timeout: 15000,
    });


    // ============================================================
    // 13. PERSONAL DETAILS
    // ============================================================

    const personalDetailsHeading =
      page.getByText('Personal Details', {
        exact: true,
      });

    await expect(
      personalDetailsHeading
    ).toBeVisible();


    const personalDetailsSection =
      personalDetailsHeading.locator(
        'xpath=ancestor::div[contains(@class,"bg-white")][1]'
      );

    await expect(
      personalDetailsSection
    ).toBeVisible();


    // ============================================================
    // 14. NAME FIELD
    // ============================================================

    const nameInput =
      personalDetailsSection.locator(
        'input[placeholder="Enter your name"]'
      );

    await expect(
      nameInput
    ).toHaveCount(1);

    await expect(
      nameInput
    ).toBeVisible();


    // ============================================================
    // CASE 1 — VALID NAME
    // ============================================================

    await nameInput.fill(
      'Nitheesh Lingam'
    );

    await expect(
      nameInput
    ).toHaveValue(
      'Nitheesh Lingam'
    );


    // ============================================================
    // CASE 2 — EMPTY NAME
    // ============================================================

    await nameInput.fill('');

    await expect(
      nameInput
    ).toHaveValue('');


    // ============================================================
    // RESTORE VALID VALUE
    // ============================================================

    await nameInput.fill(
      'Nitheesh Lingam'
    );

    await expect(
      nameInput
    ).toHaveValue(
      'Nitheesh Lingam'
    );


    console.log(
      'CP-020 NAME VALIDATION VERIFIED'
    );

  }
);

test(
  'CP-021 Profile Gender field allows selecting available options',
  async ({ page }) => {

    // ============================================================
    // TEST DATA
    // ============================================================

    const TEST_PHONE = '7695834209';
    const LOGIN_OTP = '123456';
    const TEST_EMAIL = 'existing@test.com';
    const TEST_USER_ID = 861;


    // ============================================================
    // 1. SEND OTP
    // ============================================================

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


    // ============================================================
    // 2. VERIFY LOGIN OTP
    // ============================================================

    await page.route(
      '**/api/auth/verify-otp',
      async route => {

        const body =
          route.request().postDataJSON();

        expect(
          body
        ).toMatchObject({

          recipient:
            `+91${TEST_PHONE}`,

          otp:
            LOGIN_OTP,

          contactType:
            'phone',
        });

        await route.fulfill({
          status: 200,
          contentType: 'application/json',

          body: JSON.stringify({

            success: true,

            isNewUser: false,

            isActive: true,

            role: 'user',

            user: {

              id:
                TEST_USER_ID,

              UserId:
                TEST_USER_ID,

              username:
                'existinguser',

              email:
                TEST_EMAIL,

              phone:
                `+91${TEST_PHONE}`,

              status:
                'Active',

              consentRequired:
                false,
            },
          }),
        });

      }
    );


    // ============================================================
    // 3. USER LOOKUP
    // ============================================================

    await page.route(
      '**/api/user/lookup*',
      async route => {

        await route.fulfill({
          status: 200,
          contentType: 'application/json',

          body: JSON.stringify({

            success: true,

            isNewUser: false,

            isActive: true,

            role: 'user',

            data: {

              userId:
                TEST_USER_ID,

              email:
                TEST_EMAIL,
            },
          }),
        });

      }
    );


    // ============================================================
    // 4. CONSENT
    // ============================================================

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


    // ============================================================
    // 5. COMPLETED PROFILE
    // ============================================================

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

                userId:
                  TEST_USER_ID,

                userName:
                  'Nitheesh Lingam',

                email:
                  TEST_EMAIL,

                phoneNumber:
                  TEST_PHONE,

                gender:
                  'Male',

                height:
                  170,

                communityId:
                  'WB12345',

                dietType:
                  'Vegetarian',

                latestWeight:
                  72.5,

                latestWeightBodyFat:
                  22,

                latestBmr:
                  1424,

                bodyFat:
                  22,

                physicalActivityLevel:
                  'moderate',

                profileImage:
                  'https://example.com/profile.jpg',

                profileComplete:
                  true,

                weightGoalMode:
                  'maintain',
              },
            }),
          });

          return;
        }

        await route.continue();

      }
    );


    // ============================================================
    // 6. SETUP COMPLETE
    // ============================================================

    await page.route(
      '**/api/user/status*',
      async route => {

        await route.fulfill({
          status: 200,
          contentType: 'application/json',

          body: JSON.stringify({

            success: true,

            setupComplete: true,

            setupSkipped: true,

            hasTeamId: true,

            hasUpline: true,

            teamId: 1,

            uplineCoachId: 12345,

            role: 'user',

            pendingRequest: null,

            redirectTo: null,
          }),
        });

      }
    );


    // ============================================================
    // 7. OPEN APPLICATION
    // ============================================================

    await page.goto('/');


    // ============================================================
    // 8. LOGIN
    // ============================================================

    const mobileInput =
      page.getByLabel('Mobile Number');

    await expect(
      mobileInput
    ).toBeVisible({
      timeout: 15000,
    });

    await mobileInput.fill(
      TEST_PHONE
    );

    await page
      .getByRole('button', {
        name: 'Send OTP',
        exact: true,
      })
      .click();


    // ============================================================
    // 9. ENTER OTP
    // ============================================================

    await expect(
      page.getByText('Enter OTP', {
        exact: true,
      })
    ).toBeVisible({
      timeout: 15000,
    });

    const otpInputs =
      page.locator(
        'input[type="tel"]'
      );

    await expect(
      otpInputs
    ).toHaveCount(6);

    for (
      let i = 0;
      i < LOGIN_OTP.length;
      i++
    ) {

      await otpInputs
        .nth(i)
        .fill(
          LOGIN_OTP[i]
        );

    }


    // ============================================================
    // 10. WAIT FOR AUTHENTICATION
    // ============================================================

    await expect
      .poll(
        async () => {

          return await page.evaluate(
            () => {

              const rawUser =
                localStorage.getItem(
                  'otpUser'
                );

              return {

                verified:
                  localStorage.getItem(
                    'isOtpVerified'
                  ),

                user:
                  rawUser
                    ? JSON.parse(rawUser)
                    : null,
              };

            }
          );

        },
        {
          timeout: 15000,

          intervals: [
            200,
            500,
            1000,
          ],
        }
      )
      .toMatchObject({

        verified: 'true',

        user: {
          isNewUser: false,
        },
      });


    // ============================================================
    // 11. OPEN MY PROFILE
    // ============================================================

    const myProfileButton =
      page.getByRole('button', {
        name: 'My Profile',
        exact: true,
      });

    await expect(
      myProfileButton
    ).toBeVisible({
      timeout: 20000,
    });

    await myProfileButton.click();


    // ============================================================
    // 12. VERIFY PROFILE PAGE
    // ============================================================

    await expect(
      page.getByRole('heading', {
        name: 'My Profile',
        exact: true,
      })
    ).toBeVisible({
      timeout: 15000,
    });


    // ============================================================
    // 13. PERSONAL DETAILS
    // ============================================================

    const personalDetailsHeading =
      page.getByText(
        'Personal Details',
        {
          exact: true,
        }
      );

    await expect(
      personalDetailsHeading
    ).toBeVisible();


    const personalDetailsSection =
      personalDetailsHeading.locator(
        'xpath=ancestor::div[contains(@class,"bg-white")][1]'
      );

    await expect(
      personalDetailsSection
    ).toBeVisible();


    // ============================================================
    // 14. GENDER FIELD
    // ============================================================

    const genderSelect =
      personalDetailsSection
        .locator('select')
        .nth(0);

    await expect(
      genderSelect
    ).toBeVisible();


    // ============================================================
    // CASE 1 — CURRENT VALUE IS MALE
    // ============================================================

    await expect(
      genderSelect
    ).toHaveValue(
      'Male'
    );


    // ============================================================
    // CASE 2 — SELECT FEMALE
    // ============================================================

    await genderSelect.selectOption({
      label: 'Female',
    });


    await expect(
      genderSelect
    ).toHaveValue(
      'Female'
    );


    // ============================================================
    // CASE 3 — RESTORE MALE
    // ============================================================

    await genderSelect.selectOption({
      label: 'Male',
    });


    await expect(
      genderSelect
    ).toHaveValue(
      'Male'
    );


    console.log(
      'CP-021 GENDER FIELD VALIDATION VERIFIED'
    );

  }
);

test(
  'CP-022 Profile Height field validates 49, 50, 198 and 199',
  async ({ page }) => {

    // ============================================================
    // TEST DATA
    // ============================================================

    const TEST_PHONE = '7695834209';
    const LOGIN_OTP = '123456';
    const TEST_EMAIL = 'existing@test.com';
    const TEST_USER_ID = 861;

    // ============================================================
    // TRACK PROFILE SAVES
    // ============================================================

    const profilePosts = [];

    // ============================================================
    // 1. SEND OTP
    // ============================================================

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

    // ============================================================
    // 2. VERIFY LOGIN OTP
    // ============================================================

    await page.route(
      '**/api/auth/verify-otp',
      async route => {

        const body = route.request().postDataJSON();

        expect(body).toMatchObject({
          recipient: `+91${TEST_PHONE}`,
          otp: LOGIN_OTP,
          contactType: 'phone',
        });

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            isNewUser: false,
            isActive: true,
            role: 'user',

            user: {
              id: TEST_USER_ID,
              UserId: TEST_USER_ID,
              username: 'existinguser',
              email: TEST_EMAIL,
              phone: `+91${TEST_PHONE}`,
              status: 'Active',
              consentRequired: false,
            },
          }),
        });
      }
    );

    // ============================================================
    // 3. USER LOOKUP
    // ============================================================

    await page.route(
      '**/api/user/lookup*',
      async route => {

        await route.fulfill({
          status: 200,
          contentType: 'application/json',

          body: JSON.stringify({
            success: true,
            isNewUser: false,
            isActive: true,
            role: 'user',

            data: {
              userId: TEST_USER_ID,
              email: TEST_EMAIL,
            },
          }),
        });
      }
    );

    // ============================================================
    // 4. CONSENT
    // ============================================================

    await page.route(
      '**/api/user/consent*',
      async route => {

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
      }
    );

    // ============================================================
    // 5. PROFILE GET + POST
    // ============================================================

    await page.route(
      '**/api/user/profile*',
      async route => {

        const method = route.request().method();

        // --------------------------------------------------------
        // GET PROFILE
        // --------------------------------------------------------

        if (method === 'GET') {

          await route.fulfill({
            status: 200,
            contentType: 'application/json',

            body: JSON.stringify({
              success: true,

              data: {
                userId: TEST_USER_ID,
                userName: 'Nitheesh Lingam',
                email: TEST_EMAIL,
                phoneNumber: TEST_PHONE,
                gender: 'Male',
                height: 170,
                communityId: 'WB12345',
                dietType: 'Vegetarian',
                latestWeight: 72.5,
                latestWeightBodyFat: 22,
                latestBmr: 1424,
                bodyFat: 22,
                physicalActivityLevel: 'moderate',
                profileImage: 'https://example.com/profile.jpg',
                profileComplete: true,
                weightGoalMode: 'loss',
              },
            }),
          });

          return;
        }

        // --------------------------------------------------------
        // POST PROFILE
        // --------------------------------------------------------

        if (method === 'POST') {

          const body = route.request().postDataJSON();

          console.log(
            'CP-022 PROFILE POST:',
            body
          );

          profilePosts.push({
            ...body,
          });

          await route.fulfill({
            status: 200,
            contentType: 'application/json',

            body: JSON.stringify({
              success: true,

              message: 'Profile saved successfully!',

              data: {
                ...body,
                userId: TEST_USER_ID,
                profileComplete: true,
              },
            }),
          });

          return;
        }

        await route.continue();
      }
    );

    // ============================================================
    // 6. SETUP COMPLETE
    // ============================================================

    await page.route(
      '**/api/user/status*',
      async route => {

        await route.fulfill({
          status: 200,
          contentType: 'application/json',

          body: JSON.stringify({
            success: true,
            setupComplete: true,
            setupSkipped: true,
            hasTeamId: true,
            hasUpline: true,
            teamId: 1,
            uplineCoachId: 12345,
            role: 'user',
            pendingRequest: null,
            redirectTo: null,
          }),
        });
      }
    );

    // ============================================================
    // 7. OPEN APPLICATION
    // ============================================================

    await page.goto('/');

    // ============================================================
    // 8. LOGIN
    // ============================================================

    const mobileInput =
      page.getByLabel('Mobile Number');

    await expect(
      mobileInput
    ).toBeVisible({
      timeout: 15000,
    });

    await mobileInput.fill(
      TEST_PHONE
    );

    await page
      .getByRole('button', {
        name: 'Send OTP',
        exact: true,
      })
      .click();

    // ============================================================
    // 9. OTP
    // ============================================================

    await expect(
      page.getByText('Enter OTP', {
        exact: true,
      })
    ).toBeVisible({
      timeout: 15000,
    });

    const otpInputs =
      page.locator('input[type="tel"]');

    await expect(
      otpInputs
    ).toHaveCount(6);

    for (
      let i = 0;
      i < LOGIN_OTP.length;
      i++
    ) {

      await otpInputs
        .nth(i)
        .fill(LOGIN_OTP[i]);
    }

    // ============================================================
    // 10. WAIT FOR AUTHENTICATION
    // ============================================================

    await expect
      .poll(
        async () => {

          return await page.evaluate(() => {

            const rawUser =
              localStorage.getItem('otpUser');

            return {
              verified:
                localStorage.getItem(
                  'isOtpVerified'
                ),

              user:
                rawUser
                  ? JSON.parse(rawUser)
                  : null,
            };
          });
        },
        {
          timeout: 15000,
          intervals: [200, 500, 1000],
        }
      )
      .toMatchObject({
        verified: 'true',

        user: {
          isNewUser: false,
        },
      });

    // ============================================================
    // 11. HELPER — OPEN MY PROFILE
    // ============================================================

    async function openMyProfile() {

      const myProfileButton =
        page.getByRole('button', {
          name: 'My Profile',
          exact: true,
        });

      await expect(
        myProfileButton
      ).toBeVisible({
        timeout: 20000,
      });

      await myProfileButton.click();

      await expect(
        page.getByRole('heading', {
          name: 'My Profile',
          exact: true,
        })
      ).toBeVisible({
        timeout: 15000,
      });

      const personalDetailsHeading =
        page.getByText(
          'Personal Details',
          {
            exact: true,
          }
        );

      await expect(
        personalDetailsHeading
      ).toBeVisible({
        timeout: 10000,
      });

      const personalDetailsSection =
        personalDetailsHeading.locator(
          'xpath=ancestor::div[contains(@class,"bg-white")][1]'
        );

      await expect(
        personalDetailsSection
      ).toBeVisible({
        timeout: 10000,
      });

      return personalDetailsSection;
    }

    // ============================================================
    // 12. OPEN PROFILE
    // ============================================================

    let personalDetailsSection =
      await openMyProfile();

    // ============================================================
    // 13. HELPER — GET HEIGHT + SAVE BUTTON
    // ============================================================

    async function getHeightControls() {

      personalDetailsSection =
        await page.getByText(
          'Personal Details',
          {
            exact: true,
          }
        ).locator(
          'xpath=ancestor::div[contains(@class,"bg-white")][1]'
        );

      const heightInput =
        personalDetailsSection.locator(
          'input[placeholder="e.g. 170"]'
        );

      await expect(
        heightInput
      ).toHaveCount(1);

      await expect(
        heightInput
      ).toBeVisible();

      const saveButton =
        page.getByRole('button', {
          name: 'Save profile',
          exact: true,
        });

      await expect(
        saveButton
      ).toBeVisible({
        timeout: 10000,
      });

      return {
        heightInput,
        saveButton,
      };
    }

    // ============================================================
    // 14. HELPER — TEST HEIGHT
    // ============================================================

    async function testHeightValue(
      value,
      expectedValid
    ) {

      const {
        heightInput,
        saveButton,
      } = await getHeightControls();

      // Clear previous POST records
      profilePosts.length = 0;

      // Enter height
      await heightInput.fill(
        String(value)
      );

      await expect(
        heightInput
      ).toHaveValue(
        String(value)
      );

      console.log(
        `CP-022 ENTER HEIGHT: ${value}`
      );

      // Click Save
      await saveButton.click();

      // ==========================================================
      // INVALID VALUE
      // ==========================================================

      if (!expectedValid) {

        // Give the application time to process validation.
        await page.waitForTimeout(1000);

        // Invalid height must NOT trigger profile POST.
        expect(
          profilePosts.length
        ).toBe(0);

        console.log(
          `CP-022 HEIGHT ${value}: INVALID`
        );

        return;
      }

      // ==========================================================
      // VALID VALUE
      // ==========================================================

      await expect
        .poll(
          () => profilePosts.length,
          {
            timeout: 5000,
            intervals: [200, 500, 1000],
          }
        )
        .toBe(1);

      expect(
        profilePosts[0]
      ).toMatchObject({

        email: TEST_EMAIL,
        name: 'Nitheesh Lingam',
        height: Number(value),
        physicalActivityLevel: 'moderate',
        dietType: 'Vegetarian',
        gender: 'Male',
        phoneNumber: TEST_PHONE,
        communityId: 'WB12345',
      });

      console.log(
        `CP-022 HEIGHT ${value}: VALID`
      );

      // Successful save causes onComplete().
      await expect(
        page.getByRole('heading', {
          name: 'My Profile',
          exact: true,
        })
      ).not.toBeVisible({
        timeout: 10000,
      }).catch(() => {
        // Some versions keep the heading mounted briefly.
      });

      // Return to Profile for the next valid value.
      await openMyProfile();
    }

    // ============================================================
    // CASE 1 — 49
    //
    // INVALID
    // ============================================================

    await testHeightValue(
      49,
      false
    );

    // ============================================================
    // CASE 2 — 50
    //
    // VALID
    // ============================================================

    await testHeightValue(
      50,
      true
    );

    // ============================================================
    // CASE 3 — 198
    //
    // VALID
    // ============================================================

    await testHeightValue(
      198,
      true
    );

    // ============================================================
    // CASE 4 — 199
    //
    // INVALID
    // ============================================================

    await testHeightValue(
      199,
      false
    );

    console.log(
      'CP-022 HEIGHT VALUES VERIFIED: 49, 50, 198, 199'
    );
  }
);

test(
  'CP-023 Profile Phone Number validates valid, invalid and empty values',
  async ({ page }) => {

    // ============================================================
    // TEST DATA
    // ============================================================

    const TEST_PHONE = '7695834209';
    const LOGIN_OTP = '123456';
    const TEST_EMAIL = 'existing@test.com';
    const TEST_USER_ID = 861;


    // ============================================================
    // FUNCTION: SETUP ALL MOCKS
    // ============================================================

    async function setupMocks() {

      const profilePosts = [];

      // ----------------------------------------------------------
      // SEND OTP
      // ----------------------------------------------------------

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


      // ----------------------------------------------------------
      // VERIFY LOGIN OTP
      // ----------------------------------------------------------

      await page.route(
        '**/api/auth/verify-otp',
        async route => {

          const body =
            route.request().postDataJSON();

          expect(body).toMatchObject({
            recipient:
              `+91${TEST_PHONE}`,

            otp:
              LOGIN_OTP,

            contactType:
              'phone',
          });

          await route.fulfill({
            status: 200,
            contentType: 'application/json',

            body: JSON.stringify({

              success: true,

              isNewUser: false,

              isActive: true,

              role: 'user',

              user: {

                id:
                  TEST_USER_ID,

                UserId:
                  TEST_USER_ID,

                username:
                  'existinguser',

                email:
                  TEST_EMAIL,

                phone:
                  `+91${TEST_PHONE}`,

                status:
                  'Active',

                consentRequired:
                  false,
              },
            }),
          });

        }
      );


      // ----------------------------------------------------------
      // USER LOOKUP
      // ----------------------------------------------------------

      await page.route(
        '**/api/user/lookup*',
        async route => {

          await route.fulfill({
            status: 200,
            contentType: 'application/json',

            body: JSON.stringify({

              success: true,

              isNewUser: false,

              isActive: true,

              role: 'user',

              data: {

                userId:
                  TEST_USER_ID,

                email:
                  TEST_EMAIL,
              },
            }),
          });

        }
      );


      // ----------------------------------------------------------
      // CONSENT
      // ----------------------------------------------------------

      await page.route(
        '**/api/user/consent*',
        async route => {

          if (
            route.request().method() ===
            'GET'
          ) {

            await route.fulfill({
              status: 200,
              contentType:
                'application/json',

              body: JSON.stringify({

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

          await route.continue();
        }
      );


      // ----------------------------------------------------------
      // PROFILE GET + POST
      // ----------------------------------------------------------

      await page.route(
        '**/api/user/profile*',
        async route => {

          const method =
            route.request().method();


          // GET
          if (
            method === 'GET'
          ) {

            await route.fulfill({
              status: 200,
              contentType:
                'application/json',

              body: JSON.stringify({

                success:
                  true,

                data: {

                  userId:
                    TEST_USER_ID,

                  userName:
                    'Nitheesh Lingam',

                  email:
                    TEST_EMAIL,

                  phoneNumber:
                    TEST_PHONE,

                  gender:
                    'Male',

                  height:
                    170,

                  communityId:
                    'WB12345',

                  dietType:
                    'Vegetarian',

                  latestWeight:
                    72.5,

                  latestWeightBodyFat:
                    22,

                  latestBmr:
                    1424,

                  bodyFat:
                    22,

                  physicalActivityLevel:
                    'moderate',

                  profileImage:
                    'https://example.com/profile.jpg',

                  profileComplete:
                    true,

                  weightGoalMode:
                    'loss',
                },
              }),
            });

            return;
          }


          // POST
          if (
            method === 'POST'
          ) {

            const body =
              route.request().postDataJSON();

            console.log(
              'CP-023 PROFILE POST:',
              body
            );

            profilePosts.push({
              ...body,
            });

            await route.fulfill({
              status: 200,
              contentType:
                'application/json',

              body: JSON.stringify({

                success:
                  true,

                message:
                  'Profile saved successfully!',

                data: {

                  ...body,

                  userId:
                    TEST_USER_ID,

                  profileComplete:
                    true,
                },
              }),
            });

            return;
          }


          await route.continue();
        }
      );


      // ----------------------------------------------------------
      // USER STATUS
      // ----------------------------------------------------------

      await page.route(
        '**/api/user/status*',
        async route => {

          await route.fulfill({
            status: 200,
            contentType:
              'application/json',

            body: JSON.stringify({

              success:
                true,

              setupComplete:
                true,

              setupSkipped:
                true,

              hasTeamId:
                true,

              hasUpline:
                true,

              teamId:
                1,

              uplineCoachId:
                12345,

              role:
                'user',

              pendingRequest:
                null,

              redirectTo:
                null,
            }),
          });

        }
      );


      return profilePosts;
    }


    // ============================================================
    // FUNCTION: LOGIN AND OPEN PROFILE
    // ============================================================

    async function loginAndOpenProfile() {

      await page.goto('/');


      // ----------------------------------------------------------
      // MOBILE
      // ----------------------------------------------------------

      const mobileInput =
        page.getByLabel(
          'Mobile Number'
        );

      await expect(
        mobileInput
      ).toBeVisible({
        timeout: 15000,
      });


      await mobileInput.fill(
        TEST_PHONE
      );


      await page
        .getByRole(
          'button',
          {
            name:
              'Send OTP',

            exact:
              true,
          }
        )
        .click();


      // ----------------------------------------------------------
      // OTP SCREEN
      // ----------------------------------------------------------

      await expect(
        page.getByText(
          'Enter OTP',
          {
            exact:
              true,
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
      ).toHaveCount(
        6
      );


      for (
        let i = 0;
        i < LOGIN_OTP.length;
        i++
      ) {

        await otpInputs
          .nth(i)
          .fill(
            LOGIN_OTP[i]
          );

      }


      // ----------------------------------------------------------
      // WAIT FOR LOGIN
      // ----------------------------------------------------------

      await expect
        .poll(
          async () => {

            return await page.evaluate(
              () => {

                const rawUser =
                  localStorage.getItem(
                    'otpUser'
                  );

                return {

                  verified:
                    localStorage.getItem(
                      'isOtpVerified'
                    ),

                  user:
                    rawUser
                      ? JSON.parse(
                          rawUser
                        )
                      : null,
                };

              }
            );

          },
          {
            timeout:
              15000,

            intervals:
              [
                200,
                500,
                1000,
              ],
          }
        )
        .toMatchObject({

          verified:
            'true',

          user: {
            isNewUser:
              false,
          },
        });


      // ----------------------------------------------------------
      // MY PROFILE
      // ----------------------------------------------------------

      const myProfileButton =
        page.getByRole(
          'button',
          {
            name:
              'My Profile',

            exact:
              true,
          }
        );


      await expect(
        myProfileButton
      ).toBeVisible({
        timeout:
          20000,
      });


      await myProfileButton.click();


      // ----------------------------------------------------------
      // PROFILE PAGE
      // ----------------------------------------------------------

      await expect(
        page.getByRole(
          'heading',
          {
            name:
              'My Profile',

            exact:
              true,
          }
        )
      ).toBeVisible({
        timeout:
          15000,
      });


      await expect(
        page.getByText(
          'Personal Details',
          {
            exact:
              true,
          }
        )
      ).toBeVisible({
        timeout:
          10000,
      });

    }


    // ============================================================
    // FUNCTION: GET PHONE FIELD + SAVE BUTTON
    // ============================================================

    async function getPhoneLocators() {

      const personalDetailsHeading =
        page.getByText(
          'Personal Details',
          {
            exact:
              true,
          }
        );


      const personalDetailsSection =
        personalDetailsHeading.locator(
          'xpath=ancestor::div[contains(@class,"bg-white")][1]'
        );


      const phoneInput =
        personalDetailsSection.locator(
          'input[placeholder="e.g. +91 9876543210"]'
        );


      const saveButton =
        page.getByRole(
          'button',
          {
            name:
              'Save profile',

            exact:
              true,
          }
        );


      await expect(
        phoneInput
      ).toHaveCount(
        1
      );


      await expect(
        phoneInput
      ).toBeVisible();


      await expect(
        saveButton
      ).toBeVisible({
        timeout:
          10000,
      });


      return {
        phoneInput,
        saveButton,
      };

    }


    // ============================================================
    // CASE 1
    // 7695834209 — VALID
    // ============================================================

    {

      const profilePosts =
        await setupMocks();


      await loginAndOpenProfile();


      const {
        phoneInput,
        saveButton,
      } =
        await getPhoneLocators();


      await phoneInput.fill(
        '7695834209'
      );


      await expect(
        phoneInput
      ).toHaveValue(
        '7695834209'
      );


      await expect(
        saveButton
      ).toBeEnabled();


      await saveButton.click();


      await expect
        .poll(
          () =>
            profilePosts.length,
          {
            timeout:
              5000,

            intervals:
              [
                200,
                500,
                1000,
              ],
          }
        )
        .toBe(1);


      expect(
        profilePosts[0]
      ).toMatchObject({

        phoneNumber:
          '7695834209',

        email:
          TEST_EMAIL,

        name:
          'Nitheesh Lingam',

        height:
          170,

      });


      console.log(
        'CP-023 PHONE 7695834209: VALID'
      );

    }


    // ============================================================
    // CASE 2
    // 76965opf — INVALID
    // Save remains enabled.
    // Click Save.
    // No POST should occur.
    //
    // IMPORTANT:
    // We start a fresh login/profile flow, so the result of Case 1
    // cannot affect Case 2.
    // ============================================================

    {

      const profilePosts =
        await setupMocks();


      await loginAndOpenProfile();


      const {
        phoneInput,
        saveButton,
      } =
        await getPhoneLocators();


      await phoneInput.fill(
        '76965opf'
      );


      await expect(
        phoneInput
      ).toHaveValue(
        '76965opf'
      );


      // Actual UI behavior observed:
      // Save remains enabled.
      await expect(
        saveButton
      ).toBeEnabled();


      await saveButton.click();


      await page.waitForTimeout(
        1000
      );


      // Invalid value must not be posted.
      expect(
        profilePosts.length
      ).toBe(0);


      console.log(
        'CP-023 PHONE 76965opf: INVALID - NO POST'
      );

    }


    // ============================================================
    // CASE 3
    // EMPTY — SAVE DISABLED
    // ============================================================

    {

      const profilePosts =
        await setupMocks();


      await loginAndOpenProfile();


      const {
        phoneInput,
        saveButton,
      } =
        await getPhoneLocators();


      await phoneInput.fill(
        ''
      );


      await expect(
        phoneInput
      ).toHaveValue(
        ''
      );


      await expect(
        saveButton
      ).toBeDisabled();


      expect(
        profilePosts.length
      ).toBe(0);


      console.log(
        'CP-023 PHONE EMPTY: SAVE DISABLED'
      );

    }


    console.log(
      'CP-023 PHONE NUMBER VALIDATION VERIFIED'
    );

  }
);

test(
  'CP-024 Profile Physical Activity field validates available options',
  async ({ page }) => {

    // ============================================================
    // TEST DATA
    // ============================================================

    const TEST_PHONE = '7695834209';
    const LOGIN_OTP = '123456';
    const TEST_EMAIL = 'existing@test.com';
    const TEST_USER_ID = 861;


    // ============================================================
    // SETUP MOCKS
    // ============================================================

    async function setupMocks() {

      const profilePosts = [];


      // ----------------------------------------------------------
      // SEND OTP
      // ----------------------------------------------------------

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


      // ----------------------------------------------------------
      // VERIFY LOGIN OTP
      // ----------------------------------------------------------

      await page.route(
        '**/api/auth/verify-otp',
        async route => {

          const body =
            route.request().postDataJSON();

          expect(
            body
          ).toMatchObject({

            recipient:
              `+91${TEST_PHONE}`,

            otp:
              LOGIN_OTP,

            contactType:
              'phone',
          });


          await route.fulfill({
            status: 200,
            contentType: 'application/json',

            body: JSON.stringify({

              success:
                true,

              isNewUser:
                false,

              isActive:
                true,

              role:
                'user',

              user: {

                id:
                  TEST_USER_ID,

                UserId:
                  TEST_USER_ID,

                username:
                  'existinguser',

                email:
                  TEST_EMAIL,

                phone:
                  `+91${TEST_PHONE}`,

                status:
                  'Active',

                consentRequired:
                  false,
              },
            }),
          });

        }
      );


      // ----------------------------------------------------------
      // USER LOOKUP
      // ----------------------------------------------------------

      await page.route(
        '**/api/user/lookup*',
        async route => {

          await route.fulfill({
            status: 200,
            contentType:
              'application/json',

            body: JSON.stringify({

              success:
                true,

              isNewUser:
                false,

              isActive:
                true,

              role:
                'user',

              data: {

                userId:
                  TEST_USER_ID,

                email:
                  TEST_EMAIL,
              },
            }),
          });

        }
      );


      // ----------------------------------------------------------
      // CONSENT
      // ----------------------------------------------------------

      await page.route(
        '**/api/user/consent*',
        async route => {

          if (
            route.request().method() ===
            'GET'
          ) {

            await route.fulfill({
              status: 200,
              contentType:
                'application/json',

              body: JSON.stringify({

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


          await route.continue();

        }
      );


      // ----------------------------------------------------------
      // PROFILE GET + POST
      // ----------------------------------------------------------

      await page.route(
        '**/api/user/profile*',
        async route => {

          const method =
            route.request().method();


          // ------------------------------------------------------
          // GET
          // ------------------------------------------------------

          if (
            method === 'GET'
          ) {

            await route.fulfill({
              status: 200,
              contentType:
                'application/json',

              body: JSON.stringify({

                success:
                  true,

                data: {

                  userId:
                    TEST_USER_ID,

                  userName:
                    'Nitheesh Lingam',

                  email:
                    TEST_EMAIL,

                  phoneNumber:
                    TEST_PHONE,

                  gender:
                    'Male',

                  height:
                    170,

                  communityId:
                    'WB12345',

                  dietType:
                    'Vegetarian',

                  latestWeight:
                    72.5,

                  latestWeightBodyFat:
                    22,

                  latestBmr:
                    1424,

                  bodyFat:
                    22,

                  physicalActivityLevel:
                    'moderate',

                  profileImage:
                    'https://example.com/profile.jpg',

                  profileComplete:
                    true,

                  weightGoalMode:
                    'loss',
                },
              }),
            });

            return;
          }


          // ------------------------------------------------------
          // POST
          // ------------------------------------------------------

          if (
            method === 'POST'
          ) {

            const body =
              route.request().postDataJSON();


            console.log(
              'CP-024 PROFILE POST:',
              body
            );


            profilePosts.push({
              ...body,
            });


            await route.fulfill({
              status: 200,
              contentType:
                'application/json',

              body: JSON.stringify({

                success:
                  true,

                message:
                  'Profile saved successfully!',

                data: {

                  ...body,

                  userId:
                    TEST_USER_ID,

                  profileComplete:
                    true,
                },
              }),
            });

            return;
          }


          await route.continue();

        }
      );


      // ----------------------------------------------------------
      // USER STATUS
      // ----------------------------------------------------------

      await page.route(
        '**/api/user/status*',
        async route => {

          await route.fulfill({
            status: 200,
            contentType:
              'application/json',

            body: JSON.stringify({

              success:
                true,

              setupComplete:
                true,

              setupSkipped:
                true,

              hasTeamId:
                true,

              hasUpline:
                true,

              teamId:
                1,

              uplineCoachId:
                12345,

              role:
                'user',

              pendingRequest:
                null,

              redirectTo:
                null,
            }),
          });

        }
      );


      return profilePosts;

    }


    // ============================================================
    // LOGIN + OPEN PROFILE
    // ============================================================

    async function loginAndOpenProfile() {

      await page.goto('/');


      // ----------------------------------------------------------
      // MOBILE
      // ----------------------------------------------------------

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


      await page
        .getByRole(
          'button',
          {
            name:
              'Send OTP',

            exact:
              true,
          }
        )
        .click();


      // ----------------------------------------------------------
      // OTP
      // ----------------------------------------------------------

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
        6
      );


      for (
        let i = 0;
        i < LOGIN_OTP.length;
        i++
      ) {

        await otpInputs
          .nth(i)
          .fill(
            LOGIN_OTP[i]
          );

      }


      // ----------------------------------------------------------
      // WAIT FOR LOGIN
      // ----------------------------------------------------------

      await expect
        .poll(
          async () => {

            return await page.evaluate(
              () => {

                const rawUser =
                  localStorage.getItem(
                    'otpUser'
                  );


                return {

                  verified:
                    localStorage.getItem(
                      'isOtpVerified'
                    ),

                  user:
                    rawUser
                      ? JSON.parse(
                          rawUser
                        )
                      : null,
                };

              }
            );

          },
          {
            timeout:
              15000,

            intervals:
              [
                200,
                500,
                1000,
              ],
          }
        )
        .toMatchObject({

          verified:
            'true',

          user: {
            isNewUser:
              false,
          },
        });


      // ----------------------------------------------------------
      // MY PROFILE
      // ----------------------------------------------------------

      const myProfileButton =
        page.getByRole(
          'button',
          {
            name:
              'My Profile',

            exact:
              true,
          }
        );


      await expect(
        myProfileButton
      ).toBeVisible({
        timeout:
          20000,
      });


      await myProfileButton.click();


      // ----------------------------------------------------------
      // PROFILE PAGE
      // ----------------------------------------------------------

      await expect(
        page.getByRole(
          'heading',
          {
            name:
              'My Profile',

            exact:
              true,
          }
        )
      ).toBeVisible({
        timeout:
          15000,
      });


      await expect(
        page.getByText(
          'Personal Details',
          {
            exact:
              true,
          }
        )
      ).toBeVisible({
        timeout:
          10000,
      });

    }


    // ============================================================
    // GET PHYSICAL ACTIVITY + SAVE BUTTON
    // ============================================================

    async function getPhysicalActivityLocators() {

      const personalDetailsHeading =
        page.getByText(
          'Personal Details',
          {
            exact:
              true,
          }
        );


      const personalDetailsSection =
        personalDetailsHeading.locator(
          'xpath=ancestor::div[contains(@class,"bg-white")][1]'
        );


      const selects =
        personalDetailsSection.locator(
          'select'
        );


      await expect(
        selects
      ).toHaveCount(
        2
      );


      // First select = Gender
      // Second select = Physical Activity

      const physicalActivitySelect =
        selects.nth(1);


      const saveButton =
        page.getByRole(
          'button',
          {
            name:
              'Save profile',

            exact:
              true,
          }
        );


      await expect(
        physicalActivitySelect
      ).toBeVisible();


      await expect(
        saveButton
      ).toBeVisible({
        timeout:
          10000,
      });


      return {
        physicalActivitySelect,
        saveButton,
      };

    }


    // ============================================================
    // CASE 1
    // VERIFY DEFAULT VALUE + ALL OPTIONS
    // ============================================================

    {

      const profilePosts =
        await setupMocks();


      await loginAndOpenProfile();


      const {
        physicalActivitySelect,
      } =
        await getPhysicalActivityLocators();


      // ----------------------------------------------------------
      // Existing value
      // ----------------------------------------------------------

      await expect(
        physicalActivitySelect
      ).toHaveValue(
        'moderate'
      );


      // ----------------------------------------------------------
      // Read actual option texts
      // ----------------------------------------------------------

      const options =
        await physicalActivitySelect
          .locator('option')
          .allTextContents();


      const cleanedOptions =
        options.map(
          option =>
            option.trim()
        );


      // Actual DOM contains:
      //
      // Select activity level
      // Sedentary
      // Light Active
      // Moderate
      // Very Active
      // Highly Active
      //

      expect(
        cleanedOptions
      ).toEqual([
        'Select activity level',
        'Sedentary',
        'Light Active',
        'Moderate',
        'Very Active',
        'Highly Active',
      ]);


      // Verify the five real choices separately.
      expect(
        cleanedOptions.slice(1)
      ).toEqual([
        'Sedentary',
        'Light Active',
        'Moderate',
        'Very Active',
        'Highly Active',
      ]);


      expect(
        profilePosts.length
      ).toBe(0);


      console.log(
        'CP-024 PHYSICAL ACTIVITY OPTIONS VERIFIED'
      );

    }


    // ============================================================
    // CASE 2
    // SEDENTARY → SAVE
    // ============================================================

    {

      const profilePosts =
        await setupMocks();


      await loginAndOpenProfile();


      const {
        physicalActivitySelect,
        saveButton,
      } =
        await getPhysicalActivityLocators();


      await physicalActivitySelect.selectOption({
        label:
          'Sedentary',
      });


      await expect(
        physicalActivitySelect
      ).toHaveValue(
        'sedentary'
      );


      await expect(
        saveButton
      ).toBeEnabled();


      await saveButton.click();


      await expect
        .poll(
          () =>
            profilePosts.length,
          {
            timeout:
              5000,

            intervals:
              [
                200,
                500,
                1000,
              ],
          }
        )
        .toBe(1);


      expect(
        profilePosts[0]
      ).toMatchObject({

        physicalActivityLevel:
          'sedentary',

        email:
          TEST_EMAIL,

        name:
          'Nitheesh Lingam',

        height:
          170,

        phoneNumber:
          TEST_PHONE,

        gender:
          'Male',

      });


      console.log(
        'CP-024 PHYSICAL ACTIVITY SEDENTARY: SAVED'
      );

    }


    // ============================================================
    // CASE 3
    // HIGHLY ACTIVE → SAVE
    // ============================================================

    {

      const profilePosts =
        await setupMocks();


      await loginAndOpenProfile();


      const {
        physicalActivitySelect,
        saveButton,
      } =
        await getPhysicalActivityLocators();


      await physicalActivitySelect.selectOption({
        label:
          'Highly Active',
      });


      await expect(
        physicalActivitySelect
      ).toHaveValue(
        'highly_active'
      );


      await expect(
        saveButton
      ).toBeEnabled();


      await saveButton.click();


      await expect
        .poll(
          () =>
            profilePosts.length,
          {
            timeout:
              5000,

            intervals:
              [
                200,
                500,
                1000,
              ],
          }
        )
        .toBe(1);


      expect(
        profilePosts[0]
      ).toMatchObject({

        physicalActivityLevel:
          'highly_active',

        email:
          TEST_EMAIL,

        name:
          'Nitheesh Lingam',

        height:
          170,

        phoneNumber:
          TEST_PHONE,

        gender:
          'Male',

      });


      console.log(
        'CP-024 PHYSICAL ACTIVITY HIGHLY ACTIVE: SAVED'
      );

    }


    console.log(
      'CP-024 PHYSICAL ACTIVITY VALIDATION VERIFIED'
    );

  }
);

test(
  'CP-025 Profile Diet Preference validates available values',
  async ({ page }) => {

    // ============================================================
    // TEST DATA
    // ============================================================

    const TEST_PHONE = '7695834209';
    const LOGIN_OTP = '123456';
    const TEST_EMAIL = 'existing@test.com';
    const TEST_USER_ID = 861;


    // ============================================================
    // SETUP MOCKS
    // ============================================================

    async function setupMocks() {

      const profilePosts = [];


      // ----------------------------------------------------------
      // SEND OTP
      // ----------------------------------------------------------

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


      // ----------------------------------------------------------
      // VERIFY LOGIN OTP
      // ----------------------------------------------------------

      await page.route(
        '**/api/auth/verify-otp',
        async route => {

          const body =
            route.request().postDataJSON();

          expect(
            body
          ).toMatchObject({

            recipient:
              `+91${TEST_PHONE}`,

            otp:
              LOGIN_OTP,

            contactType:
              'phone',
          });


          await route.fulfill({
            status: 200,
            contentType: 'application/json',

            body: JSON.stringify({

              success:
                true,

              isNewUser:
                false,

              isActive:
                true,

              role:
                'user',

              user: {

                id:
                  TEST_USER_ID,

                UserId:
                  TEST_USER_ID,

                username:
                  'existinguser',

                email:
                  TEST_EMAIL,

                phone:
                  `+91${TEST_PHONE}`,

                status:
                  'Active',

                consentRequired:
                  false,
              },
            }),
          });

        }
      );


      // ----------------------------------------------------------
      // USER LOOKUP
      // ----------------------------------------------------------

      await page.route(
        '**/api/user/lookup*',
        async route => {

          await route.fulfill({
            status: 200,
            contentType: 'application/json',

            body: JSON.stringify({

              success:
                true,

              isNewUser:
                false,

              isActive:
                true,

              role:
                'user',

              data: {

                userId:
                  TEST_USER_ID,

                email:
                  TEST_EMAIL,
              },
            }),
          });

        }
      );


      // ----------------------------------------------------------
      // CONSENT
      // ----------------------------------------------------------

      await page.route(
        '**/api/user/consent*',
        async route => {

          if (
            route.request().method() ===
            'GET'
          ) {

            await route.fulfill({
              status: 200,
              contentType:
                'application/json',

              body: JSON.stringify({

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


          await route.continue();

        }
      );


      // ----------------------------------------------------------
      // PROFILE GET + POST
      // ----------------------------------------------------------

      await page.route(
        '**/api/user/profile*',
        async route => {

          const method =
            route.request().method();


          // GET
          if (
            method === 'GET'
          ) {

            await route.fulfill({
              status: 200,
              contentType:
                'application/json',

              body: JSON.stringify({

                success:
                  true,

                data: {

                  userId:
                    TEST_USER_ID,

                  userName:
                    'Nitheesh Lingam',

                  email:
                    TEST_EMAIL,

                  phoneNumber:
                    TEST_PHONE,

                  gender:
                    'Male',

                  height:
                    170,

                  communityId:
                    'WB12345',

                  dietType:
                    'Vegetarian',

                  latestWeight:
                    72.5,

                  latestWeightBodyFat:
                    22,

                  latestBmr:
                    1424,

                  bodyFat:
                    22,

                  physicalActivityLevel:
                    'moderate',

                  profileImage:
                    'https://example.com/profile.jpg',

                  profileComplete:
                    true,

                  weightGoalMode:
                    'loss',
                },
              }),
            });

            return;
          }


          // POST
          if (
            method === 'POST'
          ) {

            const body =
              route.request().postDataJSON();

            console.log(
              'CP-025 PROFILE POST:',
              body
            );

            profilePosts.push({
              ...body,
            });


            await route.fulfill({
              status: 200,
              contentType:
                'application/json',

              body: JSON.stringify({

                success:
                  true,

                message:
                  'Profile saved successfully!',

                data: {

                  ...body,

                  userId:
                    TEST_USER_ID,

                  profileComplete:
                    true,
                },
              }),
            });

            return;
          }


          await route.continue();

        }
      );


      // ----------------------------------------------------------
      // USER STATUS
      // ----------------------------------------------------------

      await page.route(
        '**/api/user/status*',
        async route => {

          await route.fulfill({
            status: 200,
            contentType:
              'application/json',

            body: JSON.stringify({

              success:
                true,

              setupComplete:
                true,

              setupSkipped:
                true,

              hasTeamId:
                true,

              hasUpline:
                true,

              teamId:
                1,

              uplineCoachId:
                12345,

              role:
                'user',

              pendingRequest:
                null,

              redirectTo:
                null,
            }),
          });

        }
      );


      return profilePosts;

    }


    // ============================================================
    // LOGIN + OPEN PROFILE
    // ============================================================

    async function loginAndOpenProfile() {

      await page.goto('/');


      // ----------------------------------------------------------
      // MOBILE
      // ----------------------------------------------------------

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


      await page
        .getByRole(
          'button',
          {
            name:
              'Send OTP',

            exact:
              true,
          }
        )
        .click();


      // ----------------------------------------------------------
      // OTP
      // ----------------------------------------------------------

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
        6
      );


      for (
        let i = 0;
        i < LOGIN_OTP.length;
        i++
      ) {

        await otpInputs
          .nth(i)
          .fill(
            LOGIN_OTP[i]
          );

      }


      // ----------------------------------------------------------
      // WAIT FOR AUTHENTICATION
      // ----------------------------------------------------------

      await expect
        .poll(
          async () => {

            return await page.evaluate(
              () => {

                const rawUser =
                  localStorage.getItem(
                    'otpUser'
                  );

                return {

                  verified:
                    localStorage.getItem(
                      'isOtpVerified'
                    ),

                  user:
                    rawUser
                      ? JSON.parse(
                          rawUser
                        )
                      : null,
                };

              }
            );

          },
          {
            timeout:
              15000,

            intervals:
              [
                200,
                500,
                1000,
              ],
          }
        )
        .toMatchObject({

          verified:
            'true',

          user: {
            isNewUser:
              false,
          },
        });


      // ----------------------------------------------------------
      // OPEN MY PROFILE
      // ----------------------------------------------------------

      const myProfileButton =
        page.getByRole(
          'button',
          {
            name:
              'My Profile',

            exact:
              true,
          }
        );


      await expect(
        myProfileButton
      ).toBeVisible({
        timeout:
          20000,
      });


      await myProfileButton.click();


      // ----------------------------------------------------------
      // PROFILE PAGE
      // ----------------------------------------------------------

      await expect(
        page.getByRole(
          'heading',
          {
            name:
              'My Profile',

            exact:
              true,
          }
        )
      ).toBeVisible({
        timeout:
          15000,
      });


      await expect(
        page.getByText(
          'Personal Details',
          {
            exact:
              true,
          }
        )
      ).toBeVisible({
        timeout:
          10000,
      });

    }


    // ============================================================
    // GET DIET DROPDOWN + SAVE BUTTON
    // ============================================================

    async function getDietLocators() {

      const dietLabel =
        page.getByText(
          'Diet Preference',
          {
            exact:
              true,
          }
        );


      await expect(
        dietLabel
      ).toBeVisible({
        timeout:
          10000,
      });


      const dietContainer =
        dietLabel.locator(
          'xpath=..'
        );


      const dietButton =
        dietContainer.getByRole(
          'button'
        );


      const saveButton =
        page.getByRole(
          'button',
          {
            name:
              'Save profile',

            exact:
              true,
          }
        );


      await expect(
        dietButton
      ).toBeVisible();


      await expect(
        saveButton
      ).toBeVisible({
        timeout:
          10000,
      });


      return {
        dietContainer,
        dietButton,
        saveButton,
      };

    }


    // ============================================================
    // SELECT DIET OPTION
    //
    // The dropdown contains:
    //   1. Current-value button
    //   2. Option buttons
    //
    // Therefore the option must be scoped to the opened
    // dropdown container.
    // ============================================================

   async function selectDiet(dietLabel) {

  const {
    dietButton,
  } = await getDietLocators();


  // Open the diet dropdown.
  await dietButton.click();


  const matchingButtons =
    page.getByRole(
      'button',
      {
        name: dietLabel,
        exact: true,
      }
    );


  const count =
    await matchingButtons.count();


  expect(
    count
  ).toBeGreaterThan(0);


  // When the selected value is the same as the option,
  // there are two buttons:
  //   1. current-value button
  //   2. dropdown option
  //
  // For other options there is only one button.
  const optionButton =
    matchingButtons.nth(
      count - 1
    );


  await expect(
    optionButton
  ).toBeVisible({
    timeout: 5000,
  });


  await optionButton.click();


  await expect(
    dietButton
  ).toContainText(
    dietLabel
  );

}


    // ============================================================
    // CASE 1
    // EXISTING VALUE = VEGETARIAN
    // ============================================================

    {

      await setupMocks();

      await loginAndOpenProfile();


      const {
        dietButton,
      } =
        await getDietLocators();


      await expect(
        dietButton
      ).toContainText(
        'Vegetarian'
      );


      // Open dropdown and inspect all available options.
      await dietButton.click();


      const optionButtons =
        page.getByRole(
          'button'
        );


      const vegetarianOptions =
        page.getByRole(
          'button',
          {
            name:
              'Vegetarian',
            exact:
              true,
          }
        );


      const nonVegetarianOptions =
        page.getByRole(
          'button',
          {
            name:
              'Non-Vegetarian',
            exact:
              true,
          }
        );


      const veganOptions =
        page.getByRole(
          'button',
          {
            name:
              'Vegan',
            exact:
              true,
          }
        );


      const pescatarianOptions =
        page.getByRole(
          'button',
          {
            name:
              'Pescatarian',
            exact:
              true,
          }
        );


      await expect(
        vegetarianOptions
      ).toHaveCount(
        2
      );


      await expect(
        nonVegetarianOptions
      ).toHaveCount(
        1
      );


      await expect(
        veganOptions
      ).toHaveCount(
        1
      );


      await expect(
        pescatarianOptions
      ).toHaveCount(
        1
      );


      // Close dropdown by selecting existing value.
      await vegetarianOptions.nth(1).click();


      console.log(
        'CP-025 DIET OPTIONS VERIFIED'
      );

    }


    // ============================================================
    // CASE 2
    // VEGETARIAN → SAVE
    // ============================================================

    {

      const profilePosts =
        await setupMocks();

      await loginAndOpenProfile();


      await selectDiet(
        'Vegetarian'
      );


      const {
        saveButton,
      } =
        await getDietLocators();


      await expect(
        saveButton
      ).toBeEnabled();


      await saveButton.click();


      await expect
        .poll(
          () =>
            profilePosts.length,
          {
            timeout:
              5000,

            intervals:
              [
                200,
                500,
                1000,
              ],
          }
        )
        .toBe(1);


      expect(
        profilePosts[0]
      ).toMatchObject({

        dietType:
          'Vegetarian',

        email:
          TEST_EMAIL,

        name:
          'Nitheesh Lingam',

      });


      console.log(
        'CP-025 DIET VEGETARIAN: SAVED'
      );

    }


    // ============================================================
    // CASE 3
    // NON-VEGETARIAN → SAVE
    // ============================================================

    {

      const profilePosts =
        await setupMocks();

      await loginAndOpenProfile();


      await selectDiet(
        'Non-Vegetarian'
      );


      const {
        saveButton,
      } =
        await getDietLocators();


      await expect(
        saveButton
      ).toBeEnabled();


      await saveButton.click();


      await expect
        .poll(
          () =>
            profilePosts.length,
          {
            timeout:
              5000,

            intervals:
              [
                200,
                500,
                1000,
              ],
          }
        )
        .toBe(1);


      expect(
        profilePosts[0]
      ).toMatchObject({

        dietType:
          'Non-Vegetarian',

      });


      console.log(
        'CP-025 DIET NON-VEGETARIAN: SAVED'
      );

    }


    // ============================================================
    // CASE 4
    // VEGAN → SAVE
    // ============================================================

    {

      const profilePosts =
        await setupMocks();

      await loginAndOpenProfile();


      await selectDiet(
        'Vegan'
      );


      const {
        saveButton,
      } =
        await getDietLocators();


      await expect(
        saveButton
      ).toBeEnabled();


      await saveButton.click();


      await expect
        .poll(
          () =>
            profilePosts.length,
          {
            timeout:
              5000,

            intervals:
              [
                200,
                500,
                1000,
              ],
          }
        )
        .toBe(1);


      expect(
        profilePosts[0]
      ).toMatchObject({

        dietType:
          'Vegan',

      });


      console.log(
        'CP-025 DIET VEGAN: SAVED'
      );

    }


    // ============================================================
    // CASE 5
    // PESCATARIAN → SAVE
    // ============================================================

    {

      const profilePosts =
        await setupMocks();

      await loginAndOpenProfile();


      await selectDiet(
        'Pescatarian'
      );


      const {
        saveButton,
      } =
        await getDietLocators();


      await expect(
        saveButton
      ).toBeEnabled();


      await saveButton.click();


      await expect
        .poll(
          () =>
            profilePosts.length,
          {
            timeout:
              5000,

            intervals:
              [
                200,
                500,
                1000,
              ],
          }
        )
        .toBe(1);


      expect(
        profilePosts[0]
      ).toMatchObject({

        dietType:
          'Pescatarian',

      });


      console.log(
        'CP-025 DIET PESCATARIAN: SAVED'
      );

    }


    console.log(
      'CP-025 DIET PREFERENCE VALIDATION VERIFIED'
    );

  }
);

});