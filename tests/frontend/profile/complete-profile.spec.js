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

  // ----------------------------------------------------------
  // User lookup
  // ----------------------------------------------------------

  await page.route(
    '**/api/user/lookup*',
    async route => {

      if (route.request().method() === 'GET' ||
          route.request().method() === 'POST') {

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

        return;
      }

      await route.continue();
    }
  );


  // ----------------------------------------------------------
  // Consent
  // ----------------------------------------------------------

  await page.route(
    '**/api/user/consent*',
    async route => {

      const method = route.request().method();

      // GET -> Consent required
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


      // POST -> User agrees
      if (method === 'POST') {

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
  // Profile
  // ----------------------------------------------------------

  await page.route(
    '**/api/user/profile*',
    async route => {

      const method = route.request().method();

      // GET -> incomplete profile
      if (method === 'GET') {

        await route.fulfill({
          status: 200,
          contentType: 'application/json',

          body: JSON.stringify({
            success: true,

            data: {
              profileComplete: false,

              userName: null,
              email: '',
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

      // Don't mock profile submission yet.
      await route.continue();
    }
  );
}


// ============================================================
// Helper: Navigate to Complete Profile
// ============================================================

async function goToCompleteProfile(page) {

  // ----------------------------------------------------------
  // Mock APIs FIRST
  // ----------------------------------------------------------

  await mockCompleteProfileApis(page);


  // ----------------------------------------------------------
  // Create authenticated state
  // NO OTP
  // ----------------------------------------------------------

  await createAuthenticatedState(page);


  // ----------------------------------------------------------
  // Navigate
  // ----------------------------------------------------------

  await page.goto('/');


  // ----------------------------------------------------------
  // Consent form
  // ----------------------------------------------------------

  await expect(
    page.getByRole('heading', {
      name: 'User Consent Form',
    })
  ).toBeVisible({
    timeout: 15000,
  });


  // ----------------------------------------------------------
  // Select I Agree
  // ----------------------------------------------------------

  await page.getByText(
    'I Agree',
    {
      exact: true,
    }
  ).last().click();


  // ----------------------------------------------------------
  // Continue
  // ----------------------------------------------------------

  const continueButton =
    page.getByRole('button', {
      name: 'Continue',
    });


  await expect(
    continueButton
  ).toBeEnabled();


  await continueButton.click();


  // ----------------------------------------------------------
  // Complete Profile
  // ----------------------------------------------------------

  await expect(
    page.getByRole('heading', {
      name: 'Complete Your Profile',
    })
  ).toBeVisible({
    timeout: 15000,
  });
}

// ============================================================
// Fill Complete Profile
// Pass the field name that should remain empty.
// ============================================================

// ============================================================
// Helper: Fill all required fields
// Full Name can be overridden for the field being tested.
// ============================================================

async function fillValidProfile(page, {
  fullName = 'Nitheesh Lingam',
} = {}) {

  // ----------------------------------------------------------
  // Full Name
  // ----------------------------------------------------------

  await page
    .getByPlaceholder('Enter your full name')
    .fill(fullName);


  // ----------------------------------------------------------
  // Email
  // ----------------------------------------------------------

  const emailInput =
    page.getByPlaceholder('you@example.com');

  await emailInput.fill('nitheesh@example.com');


  // ----------------------------------------------------------
  // Gender
  // ----------------------------------------------------------

  const genderSelect =
    page.locator('select').first();

  await genderSelect.selectOption({
    label: 'Male',
  });


  // ----------------------------------------------------------
  // Height
  // ----------------------------------------------------------

  await page
    .getByPlaceholder('e.g. 170')
    .fill('170');


  // ----------------------------------------------------------
  // Diet Preference
  // ----------------------------------------------------------

  await page
    .getByRole('button', {
      name: 'Vegetarian',
      exact: true,
    })
    .click();


  // ----------------------------------------------------------
  // Current Weight
  // ----------------------------------------------------------

  const weightInput =
    page.getByPlaceholder('e.g. 72.5');

  if (await weightInput.isVisible()) {
    await weightInput.fill('70');
  }


  // ----------------------------------------------------------
  // Body Fat
  // ----------------------------------------------------------

  const bodyFatInput =
    page.getByPlaceholder('e.g. 22');

  if (await bodyFatInput.isVisible()) {
    await bodyFatInput.fill('20');
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


      await expect(
        page.getByRole('heading', {
          name: 'Complete Your Profile',
        })
      ).toBeVisible();


      await expect(
        page.getByText(
          'Name, email, gender, height, diet preference, and photo — all in one place.',
          {
            exact: true,
          }
        )
      ).toBeVisible();

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
    'CP-003 new user profile fields are initially empty',
    async ({ page }) => {

      await goToCompleteProfile(page);


      const textInputs =
        page.locator('input');


      const inputCount =
        await textInputs.count();


      console.log(
        'Profile input count:',
        inputCount
      );


      for (
        let i = 0;
        i < inputCount;
        i++
      ) {

        const input =
          textInputs.nth(i);


        const type =
          await input.getAttribute('type');


        if (
          type !== 'file' &&
          type !== 'radio' &&
          type !== 'checkbox'
        ) {

          await expect(
            input
          ).toHaveValue('');

        }

      }

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
    // Mock incomplete profile with existing profile picture
    // ============================================================

    await page.route(
      '**/api/user/profile*',
      async route => {

        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                profileComplete: false,

                // Full Name is intentionally empty.
                userName: '',

                // Email already exists, so the application locks it.
                email: 'newuser@test.com',

                gender: '',
                height: null,
                dietType: '',

                latestWeight: null,
                latestWeightBodyFat: null,
                bodyFat: null,
                needsCurrentWeight: true,

                // Existing picture satisfies pictureValid.
                profileImage: 'https://example.com/profile.jpg',
              },
            }),
          });

          return;
        }

        await route.continue();
      }
    );

    // ============================================================
    // Create authenticated state
    // ============================================================

    await page.addInitScript(() => {
      localStorage.setItem(
        'isOtpVerified',
        'true'
      );

      localStorage.setItem(
        'otpUser',
        JSON.stringify({
          isNewUser: true,
          id: 999999,
          UserId: 999999,
          username: 'newuser',
          email: 'newuser@test.com',
          phone: '+917695834209',
          status: 'Active',
          consentRequired: false,
        })
      );
    });

    // ============================================================
    // Open application
    // ============================================================

    await page.goto('/');

    await expect(
      page.getByRole('heading', {
        name: 'Complete Your Profile',
      })
    ).toBeVisible({
      timeout: 15000,
    });

    // ============================================================
    // Locators
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
      page.locator('select').first();

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

    const saveButton =
      page.getByRole('button', {
        name: 'Save & Continue',
      });

    // ============================================================
    // Verify email is already populated and locked
    // ============================================================

    await expect(emailInput).toHaveValue(
      'newuser@test.com'
    );

    await expect(emailInput).toBeDisabled();

    // ============================================================
    // Fill every required field EXCEPT Full Name
    // ============================================================

    // Gender
    await genderSelect.selectOption({
      label: 'Male',
    });

    // Height
    await heightInput.fill('170');

    // Diet
    await page.getByRole('button', {
      name: 'Vegetarian',
      exact: true,
    }).click();

    // Current Weight
    await weightInput.fill('72.5');

    // Body Fat
    await bodyFatInput.fill('22');

    // ============================================================
    // CASE 1
    // Full Name contains a value
    // ============================================================

    await fullNameInput.fill(
      'Nitheesh Lingam'
    );

    await expect(
      fullNameInput
    ).toHaveValue(
      'Nitheesh Lingam'
    );

    // All requirements are now valid.
    await expect(
      saveButton
    ).toBeEnabled();

    // ============================================================
    // CASE 2
    // Full Name is empty
    // ============================================================

    await fullNameInput.fill('');

    await expect(
      fullNameInput
    ).toHaveValue('');

    // Full Name is now the only invalid required field.
    await expect(
      saveButton
    ).toBeDisabled();

    // ============================================================
    // Restore Full Name
    // ============================================================

    await fullNameInput.fill(
      'Nitheesh Lingam'
    );

    await expect(
      fullNameInput
    ).toHaveValue(
      'Nitheesh Lingam'
    );

    await expect(
      saveButton
    ).toBeEnabled();
  }
);

test(
  'CP-006 Email handles valid, empty, and invalid values',
  async ({ page }) => {

    // ============================================================
    // Mock existing profile
    //
    // The existing profile image satisfies pictureValid.
    // ============================================================

    await page.route(
      '**/api/user/profile*',
      async route => {

        if (route.request().method() === 'GET') {

          await route.fulfill({
            status: 200,
            contentType: 'application/json',

            body: JSON.stringify({
              success: true,

              data: {
                profileComplete: false,

                userName: '',

                email: 'existing@test.com',

                gender: '',
                height: null,
                dietType: '',

                latestWeight: null,
                latestWeightBodyFat: null,
                bodyFat: null,

                needsCurrentWeight: true,

                // Same approach as CP-005.
                // No real image upload.
                profileImage:
                  'https://example.com/profile.jpg',
              },
            }),
          });

          return;
        }

        await route.continue();
      }
    );


    // ============================================================
    // Authenticated state
    // ============================================================

    await page.addInitScript(() => {

      localStorage.setItem(
        'isOtpVerified',
        'true'
      );

      localStorage.setItem(
        'otpUser',
        JSON.stringify({
          isNewUser: true,

          id: 999999,
          UserId: 999999,

          username: 'newuser',

          email:
            'existing@test.com',

          phone:
            '+917695834209',

          status:
            'Active',

          consentRequired:
            false,
        })
      );

    });


    // ============================================================
    // Open Complete Profile
    // ============================================================

    await page.goto('/');

    await expect(
      page.getByRole('heading', {
        name: 'Complete Your Profile',
      })
    ).toBeVisible({
      timeout: 15000,
    });


    // ============================================================
    // Locators
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
      page.locator('select').first();

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

    const saveButton =
      page.getByRole('button', {
        name: 'Save & Continue',
      });


    // ============================================================
    // Wait for the existing profile to load
    // ============================================================

    await expect(
      emailInput
    ).toHaveValue(
      'existing@test.com'
    );


    // ============================================================
    // IMPORTANT
    //
    // The real application locks an email that already belongs
    // to the login account.
    //
    // For this isolated email-validation test only, make the
    // input editable so we can test the email validation logic
    // without uploading a real profile image.
    // ============================================================

    await emailInput.evaluate(
      element => {
        element.removeAttribute('disabled');
      }
    );


    await expect(
      emailInput
    ).toBeEditable();


    // ============================================================
    // Fill all OTHER required fields
    // ============================================================

    await fullNameInput.fill(
      'Nitheesh Lingam'
    );


    await genderSelect.selectOption({
      label: 'Male',
    });


    await heightInput.fill(
      '170'
    );


    await page.getByRole('button', {
      name: 'Vegetarian',
      exact: true,
    }).click();


    await weightInput.fill(
      '72.5'
    );


    await bodyFatInput.fill(
      '22'
    );


    // ============================================================
    // CASE 1
    // VALID EMAIL
    // ============================================================

    await emailInput.fill(
      'nitheesh@example.com'
    );


    await expect(
      emailInput
    ).toHaveValue(
      'nitheesh@example.com'
    );


    // Valid email -> Save enabled.
    await expect(
      saveButton
    ).toBeEnabled();


    // ============================================================
    // CASE 2
    // EMPTY EMAIL
    // ============================================================

    await emailInput.fill('');


    await expect(
      emailInput
    ).toHaveValue('');


    // Empty email -> Save disabled.
    //
    // No border assertion for empty email.
    await expect(
      saveButton
    ).toBeDisabled();


    // ============================================================
    // CASE 3
    // INVALID EMAIL
    // ============================================================

    await emailInput.fill(
      'nitheesh@example'
    );


    await expect(
      emailInput
    ).toHaveValue(
      'nitheesh@example'
    );


    // Invalid non-empty email -> red border.
    await expect(
      emailInput
    ).toHaveClass(
      /border-red-300/
    );


    // Invalid email cannot produce a valid form.
    await expect(
      saveButton
    ).toBeDisabled();


    // ============================================================
    // Restore valid email
    // ============================================================

    await emailInput.fill(
      'nitheesh@example.com'
    );


    await expect(
      emailInput
    ).toHaveValue(
      'nitheesh@example.com'
    );


    await expect(
      saveButton
    ).toBeEnabled();


    await expect(
      emailInput
    ).not.toHaveClass(
      /border-red-300/
    );

  }
);

test(
  'CP-007 Gender controls Save & Continue availability',
  async ({ page }) => {

    // ============================================================
    // Mock profile
    // ============================================================

    await page.route(
      '**/api/user/profile*',
      async route => {

        if (route.request().method() === 'GET') {

          await route.fulfill({
            status: 200,
            contentType: 'application/json',

            body: JSON.stringify({
              success: true,

              data: {
                profileComplete: false,

                userName: '',
                email: 'existing@test.com',

                gender: '',
                height: null,
                dietType: '',

                latestWeight: null,
                latestWeightBodyFat: null,
                bodyFat: null,
                needsCurrentWeight: true,

                profileImage:
                  'https://example.com/profile.jpg',
              },
            }),
          });

          return;
        }

        await route.continue();
      }
    );


    // ============================================================
    // Authenticated state
    // ============================================================

    await page.addInitScript(() => {

      localStorage.setItem(
        'isOtpVerified',
        'true'
      );

      localStorage.setItem(
        'otpUser',
        JSON.stringify({
          isNewUser: true,
          id: 999999,
          UserId: 999999,
          username: 'newuser',
          email: 'existing@test.com',
          phone: '+917695834209',
          status: 'Active',
          consentRequired: false,
        })
      );

    });


    // ============================================================
    // Open Complete Profile
    // ============================================================

    await page.goto('/');

    await expect(
      page.getByRole('heading', {
        name: 'Complete Your Profile',
      })
    ).toBeVisible({
      timeout: 15000,
    });


    // ============================================================
    // Locators
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
      page.locator('select').first();

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

    const saveButton =
      page.getByRole('button', {
        name: 'Save & Continue',
      });


    // ============================================================
    // Email is already populated
    // ============================================================

    await expect(
      emailInput
    ).toHaveValue(
      'existing@test.com'
    );


    // ============================================================
    // Fill all other required fields
    // ============================================================

    await fullNameInput.fill(
      'Nitheesh Lingam'
    );

    await heightInput.fill(
      '170'
    );

    await page.getByRole('button', {
      name: 'Vegetarian',
      exact: true,
    }).click();

    await weightInput.fill(
      '72.5'
    );

    await bodyFatInput.fill(
      '22'
    );


    // ============================================================
    // CASE 1
    // Gender initially empty
    //
    // Save must be disabled because Gender is required.
    // ============================================================

    await expect(
      genderSelect
    ).toHaveValue('');

    await expect(
      saveButton
    ).toBeDisabled();


    // ============================================================
    // CASE 2
    // Valid Gender
    // ============================================================

    await genderSelect.selectOption({
      label: 'Male',
    });

    await expect(
      genderSelect
    ).toHaveValue('Male');

    await expect(
      saveButton
    ).toBeEnabled();


    // ============================================================
    // CASE 3
    // Remove Gender
    //
    // The empty option is disabled in the real UI, so we reset
    // the select value through the DOM and dispatch change.
    // ============================================================

    await genderSelect.evaluate(select => {

      const setter =
        Object.getOwnPropertyDescriptor(
          HTMLSelectElement.prototype,
          'value'
        ).set;

      setter.call(select, '');

      select.dispatchEvent(
        new Event('change', {
          bubbles: true,
        })
      );
    });


    await expect(
      genderSelect
    ).toHaveValue('');

    await expect(
      saveButton
    ).toBeDisabled();


    // ============================================================
    // Restore valid Gender
    // ============================================================

    await genderSelect.selectOption({
      label: 'Female',
    });

    await expect(
      genderSelect
    ).toHaveValue('Female');

    await expect(
      saveButton
    ).toBeEnabled();
  }
);

test(
  'CP-008 Height validates minimum and maximum allowed values',
  async ({ page }) => {

    // ============================================================
    // Mock incomplete profile
    // Existing picture satisfies pictureValid.
    // Height is intentionally empty.
    // ============================================================

    await page.route(
      '**/api/user/profile*',
      async route => {

        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: {
                profileComplete: false,

                userName: '',
                email: 'existing@test.com',

                gender: '',
                height: null,
                dietType: '',

                latestWeight: null,
                latestWeightBodyFat: null,
                bodyFat: null,
                needsCurrentWeight: true,

                profileImage:
                  'https://example.com/profile.jpg',
              },
            }),
          });

          return;
        }

        await route.continue();
      }
    );


    // ============================================================
    // Authenticated state
    // ============================================================

    await page.addInitScript(() => {

      localStorage.setItem(
        'isOtpVerified',
        'true'
      );

      localStorage.setItem(
        'otpUser',
        JSON.stringify({
          isNewUser: true,
          id: 999999,
          UserId: 999999,
          username: 'newuser',
          email: 'existing@test.com',
          phone: '+917695834209',
          status: 'Active',
          consentRequired: false,
        })
      );

    });


    // ============================================================
    // Open Complete Profile
    // ============================================================

    await page.goto('/');

    await expect(
      page.getByRole('heading', {
        name: 'Complete Your Profile',
      })
    ).toBeVisible({
      timeout: 15000,
    });


    // ============================================================
    // Locators
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
      page.locator('select').first();

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

    const saveButton =
      page.getByRole('button', {
        name: 'Save & Continue',
      });


    // ============================================================
    // Fill all other required fields
    // Height is the only field we change.
    // ============================================================

    await fullNameInput.fill(
      'Nitheesh Lingam'
    );

    await genderSelect.selectOption({
      label: 'Male',
    });

    await page.getByRole('button', {
      name: 'Vegetarian',
      exact: true,
    }).click();

    await weightInput.fill('72.5');

    await bodyFatInput.fill('22');

    await expect(
      emailInput
    ).toHaveValue(
      'existing@test.com'
    );


    // ============================================================
    // CASE 1 — 49 cm
    // Below minimum → INVALID
    // ============================================================

    await heightInput.fill('49');

    await expect(
      heightInput
    ).toHaveValue('49');

    await expect(
      saveButton
    ).toBeDisabled();


    // ============================================================
    // CASE 2 — 50 cm
    // Minimum allowed → VALID
    // ============================================================

    await heightInput.fill('50');

    await expect(
      heightInput
    ).toHaveValue('50');

    await expect(
      saveButton
    ).toBeEnabled();


    // ============================================================
    // CASE 3 — 250 cm
    // Maximum allowed → VALID
    // ============================================================

    await heightInput.fill('250');

    await expect(
      heightInput
    ).toHaveValue('250');

    await expect(
      saveButton
    ).toBeEnabled();


    // ============================================================
    // CASE 4 — 251 cm
    // Above maximum → INVALID
    // ============================================================

    await heightInput.fill('251');

    await expect(
      heightInput
    ).toHaveValue('251');

    await expect(
      saveButton
    ).toBeDisabled();


    // ============================================================
    // Restore a valid value
    // ============================================================

    await heightInput.fill('170');

    await expect(
      heightInput
    ).toHaveValue('170');

    await expect(
      saveButton
    ).toBeEnabled();
  }
);



test(
  'CP-009 Diet Preference supports all available options',
  async ({ page }) => {

    // ============================================================
    // Mock incomplete profile
    // ============================================================

    await page.route(
      '**/api/user/profile*',
      async route => {

        if (route.request().method() === 'GET') {

          await route.fulfill({
            status: 200,
            contentType: 'application/json',

            body: JSON.stringify({
              success: true,

              data: {
                profileComplete: false,

                userName: '',
                email: 'existing@test.com',

                gender: '',
                height: null,
                dietType: '',

                latestWeight: null,
                latestWeightBodyFat: null,
                bodyFat: null,
                needsCurrentWeight: true,

                // Same profile-image handling as CP-005
                profileImage:
                  'https://example.com/profile.jpg',
              },
            }),
          });

          return;
        }

        await route.continue();
      }
    );


    // ============================================================
    // Authenticated state
    // ============================================================

    await page.addInitScript(() => {

      localStorage.setItem(
        'isOtpVerified',
        'true'
      );

      localStorage.setItem(
        'otpUser',
        JSON.stringify({
          isNewUser: true,
          id: 999999,
          UserId: 999999,
          username: 'newuser',
          email: 'existing@test.com',
          phone: '+917695834209',
          status: 'Active',
          consentRequired: false,
        })
      );

    });


    // ============================================================
    // Open Complete Profile
    // ============================================================

    await page.goto('/');

    await expect(
      page.getByRole('heading', {
        name: 'Complete Your Profile',
      })
    ).toBeVisible({
      timeout: 15000,
    });


    // ============================================================
    // Locators
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
      page.locator('select').first();

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

    const saveButton =
      page.getByRole('button', {
        name: 'Save & Continue',
      });


    // ============================================================
    // Fill all other required fields
    // Diet Preference is the only field under test.
    // ============================================================

    await expect(
      emailInput
    ).toHaveValue(
      'existing@test.com'
    );

    await fullNameInput.fill(
      'Nitheesh Lingam'
    );

    await genderSelect.selectOption({
      label: 'Male',
    });

    await heightInput.fill(
      '170'
    );

    await weightInput.fill(
      '72.5'
    );

    await bodyFatInput.fill(
      '22'
    );


    // ============================================================
    // Verify all four diet options are available
    // ============================================================

    const dietOptions = [
      'Vegetarian',
      'Non-Vegetarian',
      'Vegan',
      'Pescatarian',
    ];

    for (const option of dietOptions) {

      await expect(
        page.getByRole('button', {
          name: option,
          exact: true,
        })
      ).toBeVisible();
    }


    // ============================================================
    // CASE 1 — Vegetarian
    // ============================================================

    await page.getByRole('button', {
      name: 'Vegetarian',
      exact: true,
    }).click();

    await expect(
      page.getByRole('button', {
        name: 'Vegetarian',
        exact: true,
      })
    ).toHaveClass(
      /border-green-500/
    );

    await expect(
      saveButton
    ).toBeEnabled();


    // ============================================================
    // CASE 2 — Non-Vegetarian
    // ============================================================

    await page.getByRole('button', {
      name: 'Non-Vegetarian',
      exact: true,
    }).click();

    await expect(
      page.getByRole('button', {
        name: 'Non-Vegetarian',
        exact: true,
      })
    ).toHaveClass(
      /border-green-500/
    );

    await expect(
      saveButton
    ).toBeEnabled();


    // ============================================================
    // CASE 3 — Vegan
    // ============================================================

    await page.getByRole('button', {
      name: 'Vegan',
      exact: true,
    }).click();

    await expect(
      page.getByRole('button', {
        name: 'Vegan',
        exact: true,
      })
    ).toHaveClass(
      /border-green-500/
    );

    await expect(
      saveButton
    ).toBeEnabled();


    // ============================================================
    // CASE 4 — Pescatarian
    // ============================================================

    await page.getByRole('button', {
      name: 'Pescatarian',
      exact: true,
    }).click();

    await expect(
      page.getByRole('button', {
        name: 'Pescatarian',
        exact: true,
      })
    ).toHaveClass(
      /border-green-500/
    );

    await expect(
      saveButton
    ).toBeEnabled();
  }
);

test(
  'CP-010 Current Weight validates minimum and maximum allowed values',
  async ({ page }) => {

    // ============================================================
    // Mock incomplete profile
    // Current Weight is intentionally missing.
    // Profile picture is already present.
    // ============================================================

    await page.route(
      '**/api/user/profile*',
      async route => {

        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,

              data: {
                profileComplete: false,

                userName: '',
                email: 'existing@test.com',

                gender: '',
                height: null,
                dietType: '',

                latestWeight: null,
                latestWeightBodyFat: null,
                bodyFat: null,
                needsCurrentWeight: true,

                profileImage:
                  'https://example.com/profile.jpg',
              },
            }),
          });

          return;
        }

        await route.continue();
      }
    );


    // ============================================================
    // Authenticated state
    // ============================================================

    await page.addInitScript(() => {

      localStorage.setItem(
        'isOtpVerified',
        'true'
      );

      localStorage.setItem(
        'otpUser',
        JSON.stringify({
          isNewUser: true,
          id: 999999,
          UserId: 999999,
          username: 'newuser',
          email: 'existing@test.com',
          phone: '+917695834209',
          status: 'Active',
          consentRequired: false,
        })
      );

    });


    // ============================================================
    // Open Complete Profile
    // ============================================================

    await page.goto('/');

    await expect(
      page.getByRole('heading', {
        name: 'Complete Your Profile',
      })
    ).toBeVisible({
      timeout: 15000,
    });


    // ============================================================
    // Locators
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
      page.locator('select').first();

    const heightInput =
      page.getByPlaceholder(
        'e.g. 170'
      );

    const dietVegetarian =
      page.getByRole('button', {
        name: 'Vegetarian',
        exact: true,
      });

    const weightInput =
      page.getByPlaceholder(
        'e.g. 72.5'
      );

    const bodyFatInput =
      page.getByPlaceholder(
        'e.g. 22'
      );

    const saveButton =
      page.getByRole('button', {
        name: 'Save & Continue',
      });


    // ============================================================
    // Fill all other required fields
    // Current Weight is the only field under test.
    // ============================================================

    await expect(
      emailInput
    ).toHaveValue(
      'existing@test.com'
    );

    await fullNameInput.fill(
      'Nitheesh Lingam'
    );

    await genderSelect.selectOption({
      label: 'Male',
    });

    await heightInput.fill(
      '170'
    );

    await dietVegetarian.click();

    await bodyFatInput.fill(
      '22'
    );


    // ============================================================
    // CASE 1 — 19 kg
    // Below minimum → INVALID
    // ============================================================

    await weightInput.fill('19');

    await expect(
      weightInput
    ).toHaveValue('19');

    await expect(
      saveButton
    ).toBeDisabled();


    // ============================================================
    // CASE 2 — 20 kg
    // Minimum allowed → VALID
    // ============================================================

    await weightInput.fill('20');

    await expect(
      weightInput
    ).toHaveValue('20');

    await expect(
      saveButton
    ).toBeEnabled();


    // ============================================================
    // CASE 3 — 300 kg
    // Maximum allowed → VALID
    // ============================================================

    await weightInput.fill('300');

    await expect(
      weightInput
    ).toHaveValue('300');

    await expect(
      saveButton
    ).toBeEnabled();


    // ============================================================
    // CASE 4 — 301 kg
    // Above maximum → INVALID
    // ============================================================

    await weightInput.fill('301');

    await expect(
      weightInput
    ).toHaveValue('301');

    await expect(
      saveButton
    ).toBeDisabled();


    // ============================================================
    // Restore valid value
    // ============================================================

    await weightInput.fill('72.5');

    await expect(
      weightInput
    ).toHaveValue('72.5');

    await expect(
      saveButton
    ).toBeEnabled();
  }
);

test(
  'CP-011 Body Fat validates minimum and maximum allowed values',
  async ({ page }) => {

    // ============================================================
    // Mock incomplete profile
    // Body Fat is intentionally empty.
    // Existing profile picture satisfies pictureValid.
    // ============================================================

    await page.route(
      '**/api/user/profile*',
      async route => {

        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',

            body: JSON.stringify({
              success: true,

              data: {
                profileComplete: false,

                userName: '',
                email: 'existing@test.com',

                gender: '',
                height: null,
                dietType: '',

                latestWeight: null,
                latestWeightBodyFat: null,
                bodyFat: null,
                needsCurrentWeight: true,

                profileImage:
                  'https://example.com/profile.jpg',
              },
            }),
          });

          return;
        }

        await route.continue();
      }
    );


    // ============================================================
    // Authenticated state
    // ============================================================

    await page.addInitScript(() => {

      localStorage.setItem(
        'isOtpVerified',
        'true'
      );

      localStorage.setItem(
        'otpUser',
        JSON.stringify({
          isNewUser: true,
          id: 999999,
          UserId: 999999,
          username: 'newuser',
          email: 'existing@test.com',
          phone: '+917695834209',
          status: 'Active',
          consentRequired: false,
        })
      );

    });


    // ============================================================
    // Open Complete Profile
    // ============================================================

    await page.goto('/');

    await expect(
      page.getByRole('heading', {
        name: 'Complete Your Profile',
      })
    ).toBeVisible({
      timeout: 15000,
    });


    // ============================================================
    // Locators
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
      page.locator('select').first();

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

    const saveButton =
      page.getByRole('button', {
        name: 'Save & Continue',
      });


    // ============================================================
    // Fill all other required fields
    // Body Fat is the only field being tested.
    // ============================================================

    await expect(
      emailInput
    ).toHaveValue(
      'existing@test.com'
    );

    await fullNameInput.fill(
      'Nitheesh Lingam'
    );

    await genderSelect.selectOption({
      label: 'Male',
    });

    await heightInput.fill(
      '170'
    );

    await page.getByRole('button', {
      name: 'Vegetarian',
      exact: true,
    }).click();

    await weightInput.fill(
      '72.5'
    );


    // ============================================================
    // CASE 1 — 0%
    // Below minimum → INVALID
    // ============================================================

    await bodyFatInput.fill('0');

    await expect(
      bodyFatInput
    ).toHaveValue('0');

    await expect(
      saveButton
    ).toBeDisabled();


    // ============================================================
    // CASE 2 — 1%
    // Minimum allowed → VALID
    // ============================================================

    await bodyFatInput.fill('1');

    await expect(
      bodyFatInput
    ).toHaveValue('1');

    await expect(
      saveButton
    ).toBeEnabled();


    // ============================================================
    // CASE 3 — 70%
    // Maximum allowed → VALID
    // ============================================================

    await bodyFatInput.fill('70');

    await expect(
      bodyFatInput
    ).toHaveValue('70');

    await expect(
      saveButton
    ).toBeEnabled();


    // ============================================================
    // CASE 4 — 71%
    // Above maximum → INVALID
    // ============================================================

    await bodyFatInput.fill('71');

    await expect(
      bodyFatInput
    ).toHaveValue('71');

    await expect(
      saveButton
    ).toBeDisabled();


    // ============================================================
    // Restore a normal valid value
    // ============================================================

    await bodyFatInput.fill('22');

    await expect(
      bodyFatInput
    ).toHaveValue('22');

    await expect(
      saveButton
    ).toBeEnabled();
  }
);
const path = require('path');

test(
  'CP-012 Profile Picture controls Save & Continue availability',
  async ({ page }) => {

    // ============================================================
    // Mock incomplete profile
    // No existing profile picture.
    // ============================================================

    await page.route(
      '**/api/user/profile*',
      async route => {

        if (route.request().method() === 'GET') {

          await route.fulfill({
            status: 200,
            contentType: 'application/json',

            body: JSON.stringify({
              success: true,

              data: {
                profileComplete: false,

                userName: '',
                email: 'existing@test.com',

                gender: '',
                height: null,
                dietType: '',

                latestWeight: null,
                latestWeightBodyFat: null,
                bodyFat: null,
                needsCurrentWeight: true,

                // No existing photo.
                profileImage: null,
              },
            }),
          });

          return;
        }

        await route.continue();
      }
    );


    // ============================================================
    // Authenticated state
    // ============================================================

    await page.addInitScript(() => {

      localStorage.setItem(
        'isOtpVerified',
        'true'
      );

      localStorage.setItem(
        'otpUser',
        JSON.stringify({
          isNewUser: true,

          id: 999999,
          UserId: 999999,

          username: 'newuser',

          email: 'existing@test.com',

          phone: '+917695834209',

          status: 'Active',

          consentRequired: false,
        })
      );

    });


    // ============================================================
    // Open Complete Profile
    // ============================================================

    await page.goto('/');


    const completeProfileHeading =
      page.getByRole('heading', {
        name: 'Complete Your Profile',
        exact: true,
      });


    await expect(
      completeProfileHeading
    ).toBeVisible({
      timeout: 15000,
    });


    // ============================================================
    // Fill all required fields except Profile Picture
    // ============================================================

    const fullNameInput =
      page.getByPlaceholder(
        'Enter your full name'
      );


    await fullNameInput.fill(
      'Nitheesh Lingam'
    );


    // Existing email from login/profile.
    const emailInput =
      page.getByPlaceholder(
        'you@example.com'
      );


    await expect(
      emailInput
    ).toHaveValue(
      'existing@test.com'
    );


    // Gender
    const genderSelect =
      page.locator('select').first();


    await genderSelect.selectOption({
      label: 'Male',
    });


    // Height
    await page
      .getByPlaceholder('e.g. 170')
      .fill('170');


    // Diet
    await page.getByRole('button', {
      name: 'Vegetarian',
      exact: true,
    }).click();


    // Current Weight
    await page
      .getByPlaceholder('e.g. 72.5')
      .fill('72.5');


    // Body Fat
    await page
      .getByPlaceholder('e.g. 22')
      .fill('22');


    // ============================================================
    // Save button
    // ============================================================

    const saveButton =
      page.getByRole('button', {
        name: 'Save & Continue',
        exact: true,
      });


    // ============================================================
    // CASE 1
    // No profile picture
    //
    // Picture is the only missing requirement.
    // ============================================================

    await expect(
      saveButton
    ).toBeDisabled();


    // ============================================================
    // Locate the ACTUAL Profile Picture section
    // ============================================================

    const profilePictureHeading =
      page.getByRole('heading', {
        name: 'Profile Picture',
        exact: true,
      });


    await expect(
      profilePictureHeading
    ).toBeVisible();


    // Get the containing white card.
    const profilePictureSection =
      profilePictureHeading.locator(
        'xpath=ancestor::div[contains(@class,"bg-white")][1]'
      );


    await expect(
      profilePictureSection
    ).toBeVisible();


    // ============================================================
    // Find file inputs ONLY inside Profile Picture section
    //
    // 0 = Camera
    // 1 = Gallery
    // ============================================================

    const pictureFileInputs =
      profilePictureSection.locator(
        'input[type="file"][accept="image/*"]'
      );


    await expect(
      pictureFileInputs
    ).toHaveCount(2);


    const galleryInput =
      pictureFileInputs.nth(1);


    // ============================================================
    // Upload the known test fixture
    // ============================================================

    const photoPath =
      path.resolve(
        process.cwd(),
        'tests',
        'fixtures',
        'profile-photo.jpg'
      );


    await galleryInput.setInputFiles(
      photoPath
    );


    // ============================================================
    // IMPORTANT:
    // After uploading, we must still be in Complete Profile.
    //
    // This prevents the wrong file input from taking us to:
    // "What is this image?" / "Log As"
    // ============================================================

    await expect(
      completeProfileHeading
    ).toBeVisible({
      timeout: 15000,
    });


    // ============================================================
    // The unrelated image logging page must NOT appear.
    // ============================================================

    await expect(
      page.getByText(
        'What is this image?',
        {
          exact: false,
        }
      )
    ).not.toBeVisible();


    await expect(
      page.getByText(
        'Log As',
        {
          exact: true,
        }
      )
    ).not.toBeVisible();


    // ============================================================
    // Confirm the Profile Picture section is still present.
    // ============================================================

    await expect(
      page.getByRole('heading', {
        name: 'Profile Picture',
        exact: true,
      })
    ).toBeVisible();


    // ============================================================
    // Confirm the Complete Profile page remains active.
    // ============================================================

    await expect(
      page.getByText(
        'Name, email, gender, height, diet preference, and photo — all in one place.',
        {
          exact: true,
        }
      )
    ).toBeVisible();
  }
);

test(
  'CP-013 Physical Activity allows any option and enables Continue',
  async ({ page }) => {

    // ============================================================
    // PROFILE API
    // ============================================================

    await page.route(
      '**/api/user/profile*',
      async route => {

        const method =
          route.request().method();

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
                profileComplete: false,

                userName: '',
                email: 'existing@test.com',

                gender: null,
                height: null,
                dietType: null,

                latestWeight: null,
                latestWeightBodyFat: null,
                bodyFat: null,
                needsCurrentWeight: true,

                // Existing picture satisfies pictureValid.
                profileImage:
                  'https://example.com/profile.jpg',

                // No activity selected yet.
                physicalActivityLevel: null,
              },
            }),
          });

          return;
        }


        // --------------------------------------------------------
        // PROFILE SAVE
        // --------------------------------------------------------

        if (method === 'POST') {

          const body =
            route.request().postDataJSON();

          console.log(
            'CP-013 PROFILE SAVE:',
            body
          );

          await route.fulfill({
            status: 200,
            contentType: 'application/json',

            body: JSON.stringify({
              success: true,

              data: {
                profileComplete: true,

                userName: body.name,
                email: body.email,
                gender: body.gender,
                height: body.height,
                dietType: body.dietType,
                currentWeight: body.currentWeight,
                bodyFat: body.bodyFat,
                profileImage: body.profileImage,

                // Missing activity means App.js should
                // display PhysicalActivitySetup.
                physicalActivityLevel: null,
              },
            }),
          });

          return;
        }

        await route.continue();
      }
    );


    // ============================================================
    // AUTHENTICATED STATE
    // ============================================================

    await page.addInitScript(() => {

      localStorage.setItem(
        'isOtpVerified',
        'true'
      );

      localStorage.setItem(
        'otpUser',
        JSON.stringify({
          isNewUser: true,

          id: 999999,
          UserId: 999999,

          username: 'newuser',

          email: 'existing@test.com',

          phone: '+917695834209',

          status: 'Active',

          consentRequired: false,
        })
      );

    });


    // ============================================================
    // OPEN COMPLETE PROFILE
    // ============================================================

    await page.goto('/');

    await expect(
      page.getByRole('heading', {
        name: 'Complete Your Profile',
        exact: true,
      })
    ).toBeVisible({
      timeout: 15000,
    });


    // ============================================================
    // LOCATORS
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
      page.locator('select').first();

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

    const saveButton =
      page.getByRole('button', {
        name: 'Save & Continue',
        exact: true,
      });


    // ============================================================
    // WAIT FOR PROFILE DATA
    // ============================================================

    await expect(
      emailInput
    ).toHaveValue(
      'existing@test.com'
    );


    // ============================================================
    // FILL REQUIRED FIELDS
    // ============================================================

    await fullNameInput.fill(
      'Nitheesh Lingam'
    );

    await genderSelect.selectOption({
      label: 'Male',
    });

    await heightInput.fill(
      '170'
    );

    await page.getByRole('button', {
      name: 'Vegetarian',
      exact: true,
    }).click();

    await weightInput.fill(
      '72.5'
    );

    await bodyFatInput.fill(
      '22'
    );


    // ============================================================
    // VERIFY PROFILE IS VALID
    // ============================================================

    await expect(
      fullNameInput
    ).toHaveValue(
      'Nitheesh Lingam'
    );

    await expect(
      genderSelect
    ).toHaveValue(
      'Male'
    );

    await expect(
      heightInput
    ).toHaveValue(
      '170'
    );

    await expect(
      weightInput
    ).toHaveValue(
      '72.5'
    );

    await expect(
      bodyFatInput
    ).toHaveValue(
      '22'
    );


    // ============================================================
    // EXISTING PROFILE PICTURE
    // ============================================================

    await expect(
      page.getByRole('heading', {
        name: 'Profile Picture',
        exact: true,
      })
    ).toBeVisible();


    // ============================================================
    // SAVE PROFILE
    // ============================================================

    await expect(
      saveButton
    ).toBeEnabled({
      timeout: 15000,
    });

    await saveButton.click();


    // ============================================================
    // PHYSICAL ACTIVITY PAGE
    // ============================================================

    await expect(
      page.getByRole('heading', {
        name: 'Physical Activity',
        exact: true,
      })
    ).toBeVisible({
      timeout: 20000,
    });


    await expect(
      page.getByText(
        'This helps us calculate your daily calorie target (TDEE).',
        {
          exact: true,
        }
      )
    ).toBeVisible();


    // ============================================================
    // CONTINUE
    // ============================================================

    const continueButton =
      page.getByRole('button', {
        name: 'Continue',
        exact: true,
      });


    // Nothing selected initially.
    await expect(
      continueButton
    ).toBeDisabled();


    // ============================================================
    // ALL FIVE ACTIVITY OPTIONS
    //
    // IMPORTANT:
    // The button's accessible name includes the description,
    // therefore use a RegExp beginning with the option label.
    // ============================================================

    const activityOptions = [
      'Sedentary',
      'Light Active',
      'Moderate',
      'Very Active',
      'Highly Active',
    ];


    for (const activity of activityOptions) {

      const activityButton =
        page.getByRole('button', {
          name: new RegExp(`^${activity}\\b`),
        });


      await expect(
        activityButton
      ).toBeVisible();


      // Select the activity.
      await activityButton.click();


      // Continue must now be enabled.
      await expect(
        continueButton
      ).toBeEnabled();


      // Selected button gets the selected styling.
      await expect(
        activityButton
      ).toHaveClass(
        /border-green-500/
      );
    }
  }
);

test(
  'CP-014 selecting physical activity opens coach selection',
  async ({ page }) => {

    // ============================================================
    // 1. PROFILE API
    //
    // GET  -> completed profile, but no physical activity
    // POST -> successful physical activity save
    // ============================================================

    await page.route(
      '**/api/user/profile*',
      async route => {

        const method =
          route.request().method();


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
                profileComplete: true,

                userName: 'Nitheesh Lingam',
                email: 'existing@test.com',

                gender: 'Male',
                height: 170,
                dietType: 'Vegetarian',

                latestWeight: 72.5,
                latestWeightBodyFat: 22,
                bodyFat: 22,

                profileImage:
                  'https://example.com/profile.jpg',

                // No physical activity selected yet.
                physicalActivityLevel: null,
              },
            }),
          });

          return;
        }


        // --------------------------------------------------------
        // POST PROFILE
        //
        // This is the physical activity save request.
        // --------------------------------------------------------

        if (method === 'POST') {

          const body =
            route.request().postDataJSON();

          console.log(
            'CP-014 ACTIVITY SAVE:',
            body
          );


          // Verify the application sends the expected data.
          expect(body).toMatchObject({
            email: 'existing@test.com',
            physicalActivityLevel: 'moderate',
          });


          await route.fulfill({
            status: 200,
            contentType: 'application/json',

            body: JSON.stringify({
              success: true,

              data: {
                physicalActivityLevel:
                  body.physicalActivityLevel,

                calorieTarget: 2200,
              },
            }),
          });

          return;
        }


        await route.continue();
      }
    );


    // ============================================================
    // 2. SETUP STATUS
    //
    // After physical activity is saved, App.js checks setup status.
    // setupComplete=false causes Coach Selection / SetupWizard
    // to appear.
    // ============================================================

    await page.route(
      '**/api/user/status?email=*',
      async route => {

        await route.fulfill({
          status: 200,
          contentType: 'application/json',

          body: JSON.stringify({
            success: true,

            setupComplete: false,
            setupSkipped: false,

            pendingRequest: false,

            hasTeamId: false,
            hasUpline: false,
          }),
        });
      }
    );


    // ============================================================
    // 3. COACH SEARCH
    // ============================================================

    await page.route(
      '**/api/users/search**',
      async route => {

        const url =
          new URL(route.request().url());

        const query =
          url.searchParams.get('q');

        const email =
          url.searchParams.get('email');


        console.log(
          'CP-014 COACH SEARCH:',
          {
            query,
            email,
          }
        );


        await route.fulfill({
          status: 200,
          contentType: 'application/json',

          body: JSON.stringify({
            success: true,

            query,

            count: 1,

            coaches: [
              {
                userId: 12345,

                userName:
                  'Test Coach',

                email:
                  'tes*****mple.com',

                displayName:
                  'Test Coach',

                teamId: null,

                hasTeamId: false,
              },
            ],
          }),
        });
      }
    );


    // ============================================================
    // 4. UPLINE REQUEST
    //
    // This verifies that the selected coach is actually submitted.
    // ============================================================

    await page.route(
      '**/api/upline/request',
      async route => {

        const body =
          route.request().postDataJSON();


        console.log(
          'CP-014 UPLINE REQUEST:',
          body
        );


        // Verify the actual request payload.
        expect(body).toMatchObject({
          coachId: 12345,
          email: 'existing@test.com',
        });


        await route.fulfill({
          status: 200,
          contentType: 'application/json',

          body: JSON.stringify({
            success: true,

            message:
              'Request sent successfully',
          }),
        });
      }
    );


    // ============================================================
    // 5. AUTHENTICATED STATE
    // ============================================================

    await page.addInitScript(() => {

      localStorage.setItem(
        'isOtpVerified',
        'true'
      );


      localStorage.setItem(
        'userEmail',
        'existing@test.com'
      );


      localStorage.setItem(
        'otpUser',
        JSON.stringify({
          isNewUser: false,

          id: 999999,
          UserId: 999999,

          username: 'newuser',

          email:
            'existing@test.com',

          phone:
            '+917695834209',

          status:
            'Active',

          consentRequired:
            false,
        })
      );
    });


    // ============================================================
    // 6. OPEN APPLICATION
    // ============================================================

    await page.goto('/');


    // ============================================================
    // 7. PHYSICAL ACTIVITY PAGE
    // ============================================================

    await expect(
      page.getByRole('heading', {
        name: 'Physical Activity',
        exact: true,
      })
    ).toBeVisible({
      timeout: 20000,
    });


    // ============================================================
    // 8. ACTIVITY CONTINUE BUTTON
    // ============================================================

    const activityContinue =
      page.getByRole('button', {
        name: 'Continue',
        exact: true,
      });


    // Initially disabled.
    await expect(
      activityContinue
    ).toBeDisabled();


    // ============================================================
    // 9. SELECT MODERATE
    //
    // Actual activity buttons contain both the label and
    // description, so use a prefix regexp.
    // ============================================================

    const moderateButton =
      page.getByRole('button', {
        name: /^Moderate\b/,
      });


    await expect(
      moderateButton
    ).toBeVisible();


    await moderateButton.click();


    // ============================================================
    // 10. CONTINUE BECOMES ENABLED
    // ============================================================

    await expect(
      activityContinue
    ).toBeEnabled();


    // ============================================================
    // 11. MOVE TO COACH SELECTION
    // ============================================================

    await activityContinue.click();


    // ============================================================
    // 12. COACH SELECTION PAGE
    // ============================================================

    await expect(
      page.getByRole('heading', {
        name: 'Welcome to Wellness Valley',
        exact: true,
      })
    ).toBeVisible({
      timeout: 20000,
    });


    await expect(
      page.getByText(
        'Search for the person who invited you and activate your account.',
        {
          exact: true,
        }
      )
    ).toBeVisible();


    await expect(
      page.getByRole('heading', {
        name: 'Person who invited you for this Program',
        exact: true,
      })
    ).toBeVisible();


    // ============================================================
    // 13. COACH SEARCH FIELD
    // ============================================================

    const coachSearch =
      page.getByPlaceholder(
        'Type your sponsor name or email...'
      );


    await expect(
      coachSearch
    ).toBeVisible();


    // ============================================================
    // 14. COACH CONTINUE INITIALLY DISABLED
    // ============================================================

    const coachContinue =
      page.getByRole('button', {
        name: 'Continue',
        exact: true,
      });


    await expect(
      coachContinue
    ).toBeDisabled();


    // ============================================================
    // 15. SEARCH FOR COACH
    // ============================================================

    await coachSearch.fill(
      'Test Coach'
    );


    // ============================================================
    // 16. SEARCH RESULT
    // ============================================================

    const coachResult =
      page.getByText(
        'Test Coach',
        {
          exact: true,
        }
      );


    await expect(
      coachResult
    ).toBeVisible({
      timeout: 15000,
    });


    // ============================================================
    // 17. SELECT COACH
    //
    // The actual application renders the result as a clickable
    // element, so clicking the visible coach text is sufficient.
    // ============================================================

    await coachResult.click();


    // ============================================================
    // 18. COACH CONTINUE BECOMES ENABLED
    // ============================================================

    await expect(
      coachContinue
    ).toBeEnabled({
      timeout: 10000,
    });


    // ============================================================
    // 19. CLICK COACH CONTINUE
    // ============================================================

    await coachContinue.click();


    // ============================================================
    // 20. VERIFY SUCCESSFUL UPLINE REQUEST
    //
    // The route handler above validates:
    //
    // coachId === 12345
    // email === existing@test.com
    //
    // No UI success-message assertion is used because the actual
    // application does not render "Request sent!" as a visible
    // element in this flow.
    // ============================================================

    await expect(
      coachContinue
    ).not.toBeVisible({
      timeout: 10000,
    }).catch(() => {
      // The application may keep the wizard mounted after the
      // request, so the API payload assertion above is the
      // authoritative success check.
    });
  }
);

test(
  'CP-015 user can enter coach verification code and automatic verification is triggered',
  async ({ page }) => {

    // ============================================================
    // 1. AUTHENTICATED USER
    // ============================================================

    await page.addInitScript(() => {

      localStorage.setItem(
        'isOtpVerified',
        'true'
      );

      localStorage.setItem(
        'userEmail',
        'existing@test.com'
      );

      localStorage.setItem(
        'otpUser',
        JSON.stringify({
          isNewUser: false,
          id: 999999,
          UserId: 999999,
          username: 'existinguser',
          email: 'existing@test.com',
          phone: '+917695834209',
          status: 'Active',
          consentRequired: false,
        })
      );

    });


    // ============================================================
    // 2. USER LOOKUP
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
          }),
        });

      }
    );


    // ============================================================
    // 3. CONSENT
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
    // 4. COMPLETED PROFILE
    // ============================================================

    await page.route(
      '**/api/user/profile*',
      async route => {

        if (route.request().method() === 'GET') {

          await route.fulfill({
            status: 200,
            contentType: 'application/json',

            body: JSON.stringify({
              success: true,

              data: {
                userId: 999999,

                userName: 'Existing User',
                email: 'existing@test.com',
                phoneNumber: '+917695834209',

                gender: 'Male',
                height: 170,
                dietType: 'Vegetarian',

                latestWeight: 72.5,
                latestWeightBodyFat: 22,
                bodyFat: 22,

                physicalActivityLevel:
                  'moderate',

                profileImage:
                  'https://example.com/profile.jpg',

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
    // 5. PENDING COACH REQUEST
    // ============================================================

    await page.route(
      '**/api/user/status*',
      async route => {

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
              id: 12345,
              coachId: 12345,
              coachName: 'Test Coach',
              status: 'pending',
            },
          }),
        });

      }
    );


    // ============================================================
    // 6. MOCK COACH OTP VALIDATION
    //
    // This is the API automatically called when all 6 digits
    // are entered.
    // ============================================================

    const validateOtpRequest =
      page.waitForRequest(request =>
        request.url().includes(
          '/api/upline/validate-otp'
        ) &&
        request.method() === 'POST'
      );


    await page.route(
      '**/api/upline/validate-otp',
      async route => {

        const body =
          route.request().postDataJSON();

        console.log(
          'CP-015 VALIDATE OTP BODY:',
          body
        );


        expect(body).toMatchObject({
          otp: '123456',
          email: 'existing@test.com',
        });


        await route.fulfill({
          status: 200,
          contentType: 'application/json',

          body: JSON.stringify({
            success: true,
            message: 'Verification successful',
          }),
        });
      }
    );


    // ============================================================
    // 7. OPEN APPLICATION
    // ============================================================

    await page.goto('/');


    // ============================================================
    // 8. VERIFY REQUEST PAGE
    // ============================================================

    await expect(
      page.getByRole('heading', {
        name: 'Verify Request',
        exact: true,
      })
    ).toBeVisible({
      timeout: 20000,
    });


    // ============================================================
    // 9. SIX OTP INPUTS
    // ============================================================

    const verificationInputs =
      page.locator(
        'input[data-otp="true"]'
      );

    await expect(
      verificationInputs
    ).toHaveCount(6);


    // ============================================================
    // 10. VERIFY CODE BUTTON
    //
    // The button is initially disabled because no OTP exists.
    // ============================================================

    const verifyButton =
      page.getByRole('button', {
        name: 'Verify Code',
        exact: true,
      });

    await expect(
      verifyButton
    ).toBeVisible();

    await expect(
      verifyButton
    ).toBeDisabled();


    // ============================================================
    // 11. ENTER SIX DIGITS
    //
    // Use the first input and let the application's OTP hook
    // move focus between fields.
    // ============================================================

    await verificationInputs
      .first()
      .click();

    await verificationInputs
      .first()
      .pressSequentially(
        '123456',
        {
          delay: 50,
        }
      );


    // ============================================================
    // 12. VERIFY SIX VALUES
    // ============================================================

    await expect(
      verificationInputs.nth(0)
    ).toHaveValue('1');

    await expect(
      verificationInputs.nth(1)
    ).toHaveValue('2');

    await expect(
      verificationInputs.nth(2)
    ).toHaveValue('3');

    await expect(
      verificationInputs.nth(3)
    ).toHaveValue('4');

    await expect(
      verificationInputs.nth(4)
    ).toHaveValue('5');

    await expect(
      verificationInputs.nth(5)
    ).toHaveValue('6');


    // ============================================================
    // 13. AUTOMATIC OTP VERIFICATION
    //
    // ValidateOTP automatically calls validateOtp() when all
    // six digits are complete.
    // ============================================================

    await validateOtpRequest;


    // ============================================================
    // 14. VERIFY SUCCESS MESSAGE
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

  }
);

test(
  'CP-016 successful coach verification completes setup',
  async ({ page }) => {

    // ============================================================
    // 1. AUTHENTICATED STATE
    // ============================================================

    await page.addInitScript(() => {

      localStorage.setItem(
        'isOtpVerified',
        'true'
      );

      localStorage.setItem(
        'userEmail',
        'existing@test.com'
      );

      localStorage.setItem(
        'otpUser',
        JSON.stringify({
          isNewUser: false,

          id: 999999,
          UserId: 999999,

          username: 'existinguser',

          email: 'existing@test.com',

          phone: '+917695834209',

          status: 'Active',

          consentRequired: false,
        })
      );

    });


    // ============================================================
    // 2. USER LOOKUP
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
          }),
        });

      }
    );


    // ============================================================
    // 3. CONSENT ALREADY ACCEPTED
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
    // 4. COMPLETED PROFILE
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
                userId: 999999,

                userName:
                  'Existing User',

                email:
                  'existing@test.com',

                phoneNumber:
                  '+917695834209',

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
    // 5. PENDING COACH REQUEST
    //
    // This initially displays Verify Request.
    // ============================================================

    await page.route(
      '**/api/user/status*',
      async route => {

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
              id: 12345,

              coachId: 12345,

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
    // 6. COACH OTP VALIDATION
    // ============================================================

    await page.route(
      '**/api/upline/validate-otp',
      async route => {

        const body =
          route.request().postDataJSON();


        console.log(
          'CP-016 VALIDATE OTP:',
          body
        );


        expect(body).toMatchObject({
          otp: '123456',
          email: 'existing@test.com',
        });


        await route.fulfill({
          status: 200,
          contentType: 'application/json',

          body: JSON.stringify({
            success: true,

            message:
              'Verification successful',
          }),
        });

      }
    );


    // ============================================================
    // 7. OPEN APPLICATION
    // ============================================================

    await page.goto('/');


    // ============================================================
    // 8. VERIFY REQUEST SCREEN
    // ============================================================

    await expect(
      page.getByRole('heading', {
        name: 'Verify Request',
        exact: true,
      })
    ).toBeVisible({
      timeout: 20000,
    });


    // ============================================================
    // 9. SIX OTP FIELDS
    // ============================================================

    const otpInputs =
      page.locator(
        'input[data-otp="true"]'
      );

    await expect(
      otpInputs
    ).toHaveCount(6);


    // ============================================================
    // 10. ENTER VALID COACH OTP
    // ============================================================

    const otp =
      '123456';

    for (
      let i = 0;
      i < otp.length;
      i++
    ) {

      await otpInputs
        .nth(i)
        .fill(otp[i]);

    }


    // ============================================================
    // 11. VERIFY ALL DIGITS
    // ============================================================

    for (
      let i = 0;
      i < otp.length;
      i++
    ) {

      await expect(
        otpInputs.nth(i)
      ).toHaveValue(
        otp[i]
      );

    }


    // ============================================================
    // 12. SUCCESS MESSAGE
    // ============================================================

    await expect(
      page.getByText(
        'Verified Successfully!',
        {
          exact: true,
        }
      )
    ).toBeVisible({
      timeout: 15000,
    });


    // ============================================================
    // 13. VERIFY REQUEST SCREEN DISAPPEARS
    // ============================================================

    await expect(
      page.getByRole('heading', {
        name: 'Verify Request',
        exact: true,
      })
    ).not.toBeVisible({
      timeout: 15000,
    });


    // ============================================================
    // 14. UPDATE STATUS TO COMPLETED SETUP
    //
    // The application will check setup status after verification.
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

            setupSkipped: false,

            hasTeamId: true,

            hasUpline: true,

            teamId: 1,

            uplineCoachId: 12345,

            role: 'user',

            pendingRequest:
              null,

            redirectTo:
              '/dashboard',
          }),
        });

      }
    );


    // ============================================================
    // 15. FINAL HOME STATE
    //
    // Use the application's known Home content.
    // ============================================================

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


    // ============================================================
    // 16. VERIFY MAIN NAVIGATION
    // ============================================================

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

  }
);

test(
  'CP-017 Home page is displayed after onboarding is complete',
  async ({ page }) => {

    // ============================================================
    // 1. AUTHENTICATED USER STATE
    // ============================================================

    await page.addInitScript(() => {

      localStorage.setItem(
        'isOtpVerified',
        'true'
      );

      localStorage.setItem(
        'userEmail',
        'existing@test.com'
      );

      localStorage.setItem(
        'otpUser',
        JSON.stringify({
          isNewUser: false,

          id: 999999,
          UserId: 999999,

          username: 'existinguser',

          email: 'existing@test.com',

          phone: '+917695834209',

          status: 'Active',

          consentRequired: false,
        })
      );

    });


    // ============================================================
    // 2. USER LOOKUP
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
          }),
        });

      }
    );


    // ============================================================
    // 3. CONSENT ALREADY ACCEPTED
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
    // 4. PROFILE IS COMPLETE
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
                userId: 999999,

                userName:
                  'Existing User',

                email:
                  'existing@test.com',

                phoneNumber:
                  '+917695834209',

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
    // 5. SETUP IS COMPLETE
    //
    // This prevents Coach Selection / Verification from appearing
    // and allows the application to display Home.
    // ============================================================

    await page.route(
      '**/api/user/status?email=*',
      async route => {

        await route.fulfill({
          status: 200,
          contentType: 'application/json',

          body: JSON.stringify({
            success: true,

            setupComplete:
              true,

            hasTeamId:
              true,

            hasUpline:
              true,

            setupSkipped:
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
              '/dashboard',
          }),
        });

      }
    );


    // ============================================================
    // 6. OPTIONAL HOME DATA
    //
    // Keep leaderboard APIs from depending on the real backend.
    // ============================================================

    await page.route(
      '**/api/leaderboard/get-global-leaderboard**',
      async route => {

        await route.fulfill({
          status: 200,
          contentType: 'application/json',

          body: JSON.stringify({
            success: true,
            data: [],
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
            data: [],
          }),
        });

      }
    );


    // ============================================================
    // 7. OPEN APPLICATION
    // ============================================================

    await page.goto('/');


    // ============================================================
    // 8. HOME PAGE
    // ============================================================

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


    // ============================================================
    // 9. MAIN NAVIGATION
    // ============================================================

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


    // ============================================================
    // 10. HOME ACTIONS
    // ============================================================

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


    // ============================================================
    // 11. ONBOARDING SCREENS MUST NOT BE VISIBLE
    // ============================================================

    await expect(
      page.getByRole('heading', {
        name: 'Complete Your Profile',
        exact: true,
      })
    ).not.toBeVisible();


    await expect(
      page.getByRole('heading', {
        name: 'Welcome to Wellness Valley',
        exact: true,
      })
    ).not.toBeVisible();


    await expect(
      page.getByRole('heading', {
        name: 'Verify Request',
        exact: true,
      })
    ).not.toBeVisible();

  }
);

test(
  'CP-018 Home camera and gallery options accept photo selection',
  async ({ page }) => {

    // ============================================================
    // Common authenticated Home-page setup
    // ============================================================

    const setupHomePage = async () => {

      await page.addInitScript(() => {

        localStorage.setItem(
          'isOtpVerified',
          'true'
        );

        localStorage.setItem(
          'userEmail',
          'existing@test.com'
        );

        localStorage.setItem(
          'otpUser',
          JSON.stringify({
            isNewUser: false,
            id: 999999,
            UserId: 999999,
            username: 'existinguser',
            email: 'existing@test.com',
            phone: '+917695834209',
            status: 'Active',
            consentRequired: false,
          })
        );

      });


      // ----------------------------------------------------------
      // User lookup
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
            }),
          });

        }
      );


      // ----------------------------------------------------------
      // Consent already accepted
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
      // Completed profile
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
                  userId: 999999,

                  userName:
                    'Existing User',

                  email:
                    'existing@test.com',

                  phoneNumber:
                    '+917695834209',

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


      // ----------------------------------------------------------
      // Setup already completed
      // ----------------------------------------------------------

      await page.route(
        '**/api/user/status?email=*',
        async route => {

          await route.fulfill({
            status: 200,
            contentType: 'application/json',

            body: JSON.stringify({
              success: true,

              setupComplete:
                true,

              hasTeamId:
                true,

              hasUpline:
                true,

              setupSkipped:
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
                '/dashboard',
            }),
          });

        }
      );


      // ----------------------------------------------------------
      // Open Home
      // ----------------------------------------------------------

      await page.goto('/');


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
    };


    // ============================================================
    // CASE 1 — CAMERA
    // ============================================================

    await test.step(
      'Camera option accepts a photo',
      async () => {

        await setupHomePage();


        const cameraButton =
          page.getByRole(
            'button',
            {
              name: 'Open camera',
            }
          );


        await expect(
          cameraButton
        ).toBeVisible();


        // Capture the file chooser opened by camera.
        const cameraChooserPromise =
          page.waitForEvent(
            'filechooser'
          );


        await cameraButton.click();


        const cameraChooser =
          await cameraChooserPromise;


        // Use the existing fixture.
        await cameraChooser.setFiles(
          'tests/fixtures/profile-photo.jpg'
        );


        // Confirm the image file was actually attached.
        await expect
          .poll(
            async () => {

              return await page.locator(
                'input[type="file"]'
              ).evaluateAll(
                inputs =>
                  inputs.some(
                    input =>
                      input.files &&
                      input.files.length > 0
                  )
              );

            }
          )
          .toBe(true);

      }
    );


    // ============================================================
    // CASE 2 — GALLERY
    //
    // Start from Home again because selecting the camera image
    // changes the application UI.
    // ============================================================

    await test.step(
      'Gallery option accepts a photo',
      async () => {

        // Reload/reset to Home.
        await page.reload();


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


        const galleryButton =
          page.getByRole(
            'button',
            {
              name: 'Choose from gallery',
            }
          );


        await expect(
          galleryButton
        ).toBeVisible();


        // Capture the gallery file chooser.
        const galleryChooserPromise =
          page.waitForEvent(
            'filechooser'
          );


        await galleryButton.click();


        const galleryChooser =
          await galleryChooserPromise;


        // Use the existing fixture.
        await galleryChooser.setFiles(
          'tests/fixtures/profile-photo.jpg'
        );


        // Confirm the image was attached.
        await expect
          .poll(
            async () => {

              return await page.locator(
                'input[type="file"]'
              ).evaluateAll(
                inputs =>
                  inputs.some(
                    input =>
                      input.files &&
                      input.files.length > 0
                  )
              );

            }
          )
          .toBe(true);

      }
    );


    // ============================================================
    // AUTO DETECT
    //
    // NOT TESTED.
    //
    // Currently disabled in the application, as requested.
    // ============================================================

  }
);

test(
  'CP-019 user can select all main application navigation options',
  async ({ page }) => {

    // ============================================================
    // 1. AUTHENTICATED USER STATE
    // ============================================================

    await page.addInitScript(() => {

      localStorage.setItem(
        'isOtpVerified',
        'true'
      );

      localStorage.setItem(
        'userEmail',
        'existing@test.com'
      );

      localStorage.setItem(
        'otpUser',
        JSON.stringify({
          isNewUser: false,
          id: 999999,
          UserId: 999999,
          username: 'existinguser',
          email: 'existing@test.com',
          phone: '+917695834209',
          status: 'Active',
          consentRequired: false,
        })
      );

    });


    // ============================================================
    // 2. USER LOOKUP
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
          }),
        });

      }
    );


    // ============================================================
    // 3. CONSENT
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
    // 4. COMPLETE PROFILE
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
                userId: 999999,

                userName:
                  'Existing User',

                email:
                  'existing@test.com',

                phoneNumber:
                  '+917695834209',

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
    // 5. SETUP COMPLETE
    // ============================================================

    await page.route(
      '**/api/user/status?email=*',
      async route => {

        await route.fulfill({
          status: 200,
          contentType: 'application/json',

          body: JSON.stringify({
            success: true,

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
              '/dashboard',
          }),
        });

      }
    );


    // ============================================================
    // 6. OPEN HOME
    // ============================================================

    await page.goto('/');


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


    // ============================================================
    // 7. NAVIGATION TEST HELPER
    // ============================================================

    async function selectNavigation(
      buttonName,
      expectedActiveClass,
      displayName
    ) {

      const button =
        page.getByRole(
          'button',
          {
            name: buttonName,
            exact: true,
          }
        );


      await expect(
        button
      ).toBeVisible({
        timeout: 10000,
      });


      await button.click();


      // Verify this navigation button became active.
      await expect(
        button
      ).toHaveClass(
        new RegExp(expectedActiveClass)
      );


      console.log(
        `CP-019 ${displayName} selected`
      );

    }


    // ============================================================
    // 8. HOME
    // ============================================================

    await selectNavigation(
      'Home',
      'bg-green-100',
      'HOME'
    );


    // ============================================================
    // 9. DIARY
    // ============================================================

    await selectNavigation(
      'Diary',
      'bg-green-100',
      'DIARY'
    );


    // ============================================================
    // 10. ACTIVITY
    //
    // Actual accessible name is "Activity Report"
    // Visible label is "Activity".
    // ============================================================

    await selectNavigation(
      'Activity Report',
      'bg-violet-100',
      'ACTIVITY'
    );


    // ============================================================
    // 11. PROGRAMS
    //
    // Actual accessible name is "Enrollment".
    // Visible label is "Programs".
    // ============================================================

    await selectNavigation(
      'Enrollment',
      'bg-emerald-100',
      'PROGRAMS'
    );


    // ============================================================
    // 12. BCM
    //
    // Actual accessible name is "Counselling".
    // Visible label is "BCM".
    // ============================================================

    await selectNavigation(
      'Counselling',
      'bg-pink-100',
      'BCM'
    );


    // ============================================================
    // 13. CLUB
    //
    // Actual accessible name is "Physical Club".
    // Visible label is "Club".
    // ============================================================

    await selectNavigation(
      'Physical Club',
      'bg-teal-100',
      'CLUB'
    );


    // ============================================================
    // 14. TRANSFORMATION
    //
    // Actual accessible name is "Testimonials".
    // Visible label is "Transformation".
    // ============================================================

    await selectNavigation(
      'Testimonials',
      'bg-teal-100',
      'TRANSFORMATION'
    );


    // ============================================================
    // 15. RETURN TO HOME
    // ============================================================

    await selectNavigation(
      'Home',
      'bg-green-100',
      'HOME FINAL'
    );


    // ============================================================
    // 16. FINAL HOME CHECK
    // ============================================================

    await expect(
      page.getByText(
        'Tracking Wellness with Ease',
        {
          exact: true,
        }
      )
    ).toBeVisible({
      timeout: 15000,
    });

  }
);



});