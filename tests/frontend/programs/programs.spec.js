import { test, expect } from '@playwright/test';

test(
  'PROG-001 user can open Programs page and select all programs',
  async ({ page }) => {

    // ============================================================
    // TEST DATA
    // ============================================================

    const TEST_PHONE = '7695834209';
    const LOGIN_OTP = '123456';
    const TEST_EMAIL = 'existing@test.com';
    const TEST_USER_ID = 861;

    const programNames = [
      'Family Healthy Breakfast Programme',
      'Weight Loss',
      'Weight Gain',
      'Kids Nutrition',
      'Sports Nutrition',
      'Targeted Nutrition',
      'How to Earn My Product Cost',
      'Extra Income Opportunity',
    ];

    // ============================================================
    // 1. SEND OTP
    // ============================================================

    await page.route(
      '**/api/auth/send-otp',
      async route => {

        console.log(
          'PROG-001 SEND OTP'
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
    // 2. VERIFY OTP
    // ============================================================

    await page.route(
      '**/api/auth/verify-otp',
      async route => {

        const body =
          route.request().postDataJSON();

        console.log(
          'PROG-001 LOGIN OTP BODY:',
          body
        );

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

        const method =
          route.request().method();

        console.log(
          'PROG-001 USER LOOKUP:',
          method,
          route.request().url()
        );

        if (method === 'POST') {

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

          return;
        }

        if (method === 'GET') {

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
                userName: 'Nitheesh Lingam',
                email: TEST_EMAIL,
                phoneNumber: `+91${TEST_PHONE}`,
              },
            }),
          });

          return;
        }

        await route.continue();
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
    // 5. PROFILE
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

                userName: 'Nitheesh Lingam',
                email: TEST_EMAIL,
                phoneNumber: TEST_PHONE,

                gender: 'Male',
                height: 170,

                communityId: 'WB12345',
                dietType: 'Vegetarian',

                latestWeight: 72.5,
                latestWeightBodyFat: 22,
                bodyFat: 22,

                physicalActivityLevel: 'moderate',

                profileImage:
                  'https://example.com/profile.jpg',

                profileComplete: true,

                weightGoalMode: 'loss',
              },
            }),
          });

          return;
        }

        await route.continue();
      }
    );

    // ============================================================
    // 6. SETUP STATUS
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
    // 7. EXISTING PROGRAM ENROLLMENT
    //
    // IMPORTANT:
    //
    // Current application expects:
    //
    // {
    //   success: true,
    //   enrollments: [
    //     {
    //       EnrolledPrograms: "[...]"
    //     }
    //   ]
    // }
    //
    // NOT:
    //
    // {
    //   success: true,
    //   data: {...}
    // }
    // ============================================================

    await page.route(
      '**/api/wellness-university/get-enrollments*',
      async route => {

        console.log(
          'PROG-001 EXISTING ENROLLMENT:',
          route.request().url()
        );

        await route.fulfill({
          status: 200,
          contentType: 'application/json',

          body: JSON.stringify({
            success: true,

            enrollments: [
              {
                EnrolledPrograms: JSON.stringify([
                  'Family Healthy Breakfast Programme',
                ]),

                LastUpdated:
                  '2026-08-28T00:00:00.000Z',
              },
            ],
          }),
        });
      }
    );

    // ============================================================
    // 8. OPEN APPLICATION
    // ============================================================

    await page.goto('/');

    // ============================================================
    // 9. LOGIN
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

    await mobileInput.fill(
      TEST_PHONE
    );

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
    // 10. OTP SCREEN
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
    // 11. VERIFY AUTHENTICATION
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
    // 12. WAIT FOR HOME
    // ============================================================

    const enrollmentButton =
      page.getByRole(
        'button',
        {
          name: 'Enrollment',
          exact: true,
        }
      );

    await expect(
      enrollmentButton
    ).toBeVisible({
      timeout: 20000,
    });

    console.log(
      'PROG-001 HOME READY'
    );

    // ============================================================
    // 13. OPEN PROGRAMS
    // ============================================================

    await enrollmentButton.click();

    console.log(
      'PROG-001 ENROLLMENT CLICKED'
    );

    // ============================================================
    // 14. WAIT FOR PROGRAMS PAGE
    // ============================================================

    const programsHeading =
      page.getByRole(
        'heading',
        {
          name: 'Programmers enrolled',
          exact: true,
        }
      );

    await expect(
      programsHeading
    ).toBeVisible({
      timeout: 15000,
    });

    console.log(
      'PROG-001 PROGRAMS PAGE READY'
    );

    // ============================================================
    // 15. VERIFY PROGRAM DESCRIPTION
    // ============================================================

    await expect(
      page.getByText(
        'I would like more information about:',
        {
          exact: true,
        }
      )
    ).toBeVisible({
      timeout: 10000,
    });

    // ============================================================
    // 16. VERIFY ALL PROGRAM OPTIONS
    // ============================================================

    for (
      const programName of programNames
    ) {

      await expect(
        page.getByText(
          programName,
          {
            exact: true,
          }
        )
      ).toBeVisible({
        timeout: 10000,
      });
    }

    console.log(
      'PROG-001 ALL PROGRAM OPTIONS VISIBLE'
    );

    // ============================================================
    // 17. VERIFY INITIAL SELECTION
    //
    // Family Healthy Breakfast Programme is already selected.
    // ============================================================

    const updateButton =
      page.getByRole(
        'button',
        {
          name: /Update \(\d+ selected\)/,
        }
      );

    await expect(
      updateButton
    ).toBeVisible({
      timeout: 10000,
    });

    await expect(
      updateButton
    ).toHaveText(
      /Update \(1 selected\)/
    );

    console.log(
      'PROG-001 INITIAL SELECTION: 1'
    );

    // ============================================================
    // 18. SELECT REMAINING 7 PROGRAMS
    // ============================================================

    const alreadySelected =
      'Family Healthy Breakfast Programme';

    const remainingPrograms =
      programNames.filter(
        name =>
          name !== alreadySelected
      );

    for (
      const programName of remainingPrograms
    ) {

      const program =
        page.getByText(
          programName,
          {
            exact: true,
          }
        );

      await expect(
        program
      ).toBeVisible({
        timeout: 10000,
      });

      await program.click();

      // Wait until the selection count increases.
      const expectedCount =
        remainingPrograms.indexOf(
          programName
        ) + 2;

      await expect
        .poll(
          async () => {

            const text =
              await updateButton.innerText();

            const match =
              text.match(
                /\((\d+)\s+selected\)/
              );

            return match
              ? Number(match[1])
              : 0;
          },
          {
            timeout: 5000,

            intervals: [
              100,
              200,
              300,
            ],
          }
        )
        .toBe(
          expectedCount
        );

      console.log(
        `PROG-001 ${programName} SELECTED`
      );
    }

    // ============================================================
    // 19. VERIFY ALL 8 PROGRAMS SELECTED
    // ============================================================

    await expect(
      updateButton
    ).toHaveText(
      /Update \(8 selected\)/
    );

    console.log(
      'PROG-001 ALL 8 PROGRAMS SELECTED'
    );

    // ============================================================
    // 20. FINAL ASSERTION
    // ============================================================

    expect(
      await updateButton.innerText()
    ).toContain(
      '8 selected'
    );

    console.log(
      'PROG-001 PASSED'
    );
  }
);

test(
  'PROG-002 update button state changes with program selection and cancel returns home',
  async ({ page }) => {

    // ============================================================
    // TEST DATA
    // ============================================================

    const TEST_PHONE = '7695834209';
    const LOGIN_OTP = '123456';
    const TEST_EMAIL = 'existing@test.com';
    const TEST_USER_ID = 861;

    const alreadySelectedProgram =
      'Family Healthy Breakfast Programme';

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

        const method =
          route.request().method();

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
                    'Nitheesh Lingam',

                  email:
                    TEST_EMAIL,

                  phoneNumber:
                    TEST_PHONE,
                },
              }),
          });

          return;
        }

        await route.continue();

      }
    );

    // ============================================================
    // 4. CONSENT
    // ============================================================

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

        if (
          route.request().method()
          === 'GET'
        ) {

          await route.fulfill({
            status: 200,
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

                  weightGoalMode:
                    'loss',
                },
              }),
          });

          return;
        }

        await route.continue();

      }
    );

    // ============================================================
    // 6. SETUP STATUS
    // ============================================================

    await page.route(
      '**/api/user/status*',
      async route => {

        await route.fulfill({
          status: 200,
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
    // 7. EXISTING PROGRAM ENROLLMENT
    //
    // IMPORTANT:
    //
    // The current component calls:
    //
    // GET
    // /api/wellness-university/get-enrollments
    //
    // and expects:
    //
    // {
    //   success: true,
    //   enrollments: [
    //     {
    //       EnrolledPrograms: "JSON STRING"
    //     }
    //   ]
    // }
    //
    // Start with exactly ONE selected program.
    // ============================================================

    await page.route(
      '**/api/wellness-university/get-enrollments*',
      async route => {

        console.log(
          'PROG-002 WELLNESS UNIVERSITY:',
          route.request().method(),
          route.request().url()
        );

        await route.fulfill({
          status: 200,
          contentType:
            'application/json',

          body:
            JSON.stringify({

              success:
                true,

              enrollments: [

                {

                  EnrolledPrograms:
                    JSON.stringify([
                      alreadySelectedProgram,
                    ]),

                  LastUpdated:
                    '2026-08-28T00:00:00.000Z',
                },

              ],
            }),
        });

      }
    );

    // ============================================================
    // 8. OPEN APPLICATION
    // ============================================================

    await page.goto('/');

    // ============================================================
    // 9. LOGIN
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
    // 10. OTP SCREEN
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
    // 11. WAIT FOR AUTHENTICATION
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
    // 12. WAIT FOR HOME
    // ============================================================

    const enrollmentButton =
      page.getByRole(
        'button',
        {
          name:
            'Enrollment',

          exact:
            true,
        }
      );

    await expect(
      enrollmentButton
    ).toBeVisible({
      timeout:
        20000,
    });

    console.log(
      'PROG-002 HOME READY'
    );

    // ============================================================
    // 13. OPEN ENROLLMENT
    // ============================================================

    await enrollmentButton.click();

    console.log(
      'PROG-002 ENROLLMENT CLICKED'
    );

    // ============================================================
    // 14. VERIFY EXISTING ENROLLMENT PAGE
    // ============================================================

    await expect(
      page.getByRole(
        'heading',
        {
          name:
            'Programmers enrolled',

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
        'I would like more information about:',
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
      'PROG-002 PROGRAMS PAGE READY'
    );

    // ============================================================
    // 15. UPDATE BUTTON
    // ============================================================

    const updateButton =
      page.getByRole(
        'button',
        {
          name:
            /Update \(\d+ selected\)/,
        }
      );

    await expect(
      updateButton
    ).toBeVisible({
      timeout:
        10000,
    });

    // ============================================================
    // 16. VERIFY INITIAL STATE
    //
    // One program was deliberately returned by the API.
    // Therefore:
    //
    // ✓ Update (1 selected)
    // ============================================================

    await expect(
      updateButton
    ).toHaveText(
      /Update \(1 selected\)/
    );

    await expect(
      updateButton
    ).toBeEnabled();

    console.log(
      'PROG-002 INITIAL STATE: 1 SELECTED / UPDATE ENABLED'
    );

    // ============================================================
    // 17. LOCATE CURRENTLY SELECTED PROGRAM
    // ============================================================

    const selectedProgram =
      page.getByText(
        alreadySelectedProgram,
        {
          exact:
            true,
        }
      );

    await expect(
      selectedProgram
    ).toBeVisible({
      timeout:
        10000,
    });

    // ============================================================
    // 18. DESELECT PROGRAM
    //
    // This should change:
    //
    // Update (1 selected)
    //
    // TO:
    //
    // Update (0 selected)
    // ============================================================

    await selectedProgram.click();

    await expect(
      updateButton
    ).toHaveText(
      /Update \(0 selected\)/
    );

    console.log(
      'PROG-002 PROGRAM DESELECTED'
    );

    // ============================================================
    // 19. UPDATE MUST BE ENABLED
    // ============================================================

    await expect(
      updateButton
    ).toBeEnabled();

    console.log(
      'PROG-002 UPDATE ENABLED WITH ZERO SELECTIONS'
    );

    // ============================================================
    // 20. SELECT PROGRAM AGAIN
    // ============================================================

    await selectedProgram.click();

    await expect(
      updateButton
    ).toHaveText(
      /Update \(1 selected\)/
    );

    // ============================================================
    // 21. UPDATE MUST BE ENABLED
    // ============================================================

    await expect(
      updateButton
    ).toBeEnabled();

    console.log(
      'PROG-002 UPDATE ENABLED WITH ONE SELECTION'
    );

    // ============================================================
    // 22. CANCEL
    // ============================================================

    const cancelButton =
      page.getByRole(
        'button',
        {
          name:
            'Cancel',

          exact:
            true,
        }
      );

    await expect(
      cancelButton
    ).toBeVisible({
      timeout:
        10000,
    });

    await cancelButton.click();

    console.log(
      'PROG-002 CANCEL CLICKED'
    );

    // ============================================================
    // 23. VERIFY RETURN TO HOME
    // ============================================================

    await expect(
      page.getByRole(
        'button',
        {
          name:
            'Home',

          exact:
            true,
        }
      )
    ).toBeVisible({
      timeout:
        15000,
    });

    console.log(
      'PROG-002 RETURNED TO HOME'
    );

  }
);


test(
  'PROG-003 coach can edit own and downline Programs; normal user has no member search',
  async ({ browser }) => {

    // ============================================================
    // TEST DATA
    // ============================================================

    const LOGIN_OTP =
      '123456';

    const COACH_PHONE =
      '7695834209';

    const COACH_EMAIL =
      'coach@test.com';

    const COACH_ID =
      7001;

    const DOWNLINE_ID =
      8001;

    const DOWNLINE_NAME =
      'Downline Member';

    const NORMAL_USER_PHONE =
      '7695834210';

    const NORMAL_USER_EMAIL =
      'user@test.com';

    const NORMAL_USER_ID =
      9001;


    // ============================================================
    // TRACK ALL UPDATE REQUESTS
    // ============================================================

    const updateRequests = [];


    // ============================================================
    // COMMON MOCKS
    // ============================================================

    async function registerMocks(
      context
    ) {

      // ==========================================================
      // 1. SEND OTP
      // ==========================================================

      await context.route(
        '**/api/auth/send-otp',
        async route => {

          console.log(
            'PROG-003 SEND OTP'
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


      // ==========================================================
      // 2. VERIFY OTP
      // ==========================================================

      await context.route(
        '**/api/auth/verify-otp',
        async route => {

          const body =
            route.request().postDataJSON();

          const recipient =
            body?.recipient || '';


          console.log(
            'PROG-003 LOGIN OTP BODY:',
            body
          );


          // ------------------------------------------------------
          // COACH
          // ------------------------------------------------------

          if (
            recipient ===
            `+91${COACH_PHONE}`
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

                  isNewUser:
                    false,

                  isActive:
                    true,

                  role:
                    'coach',

                  user: {

                    id:
                      COACH_ID,

                    UserId:
                      COACH_ID,

                    username:
                      'coachuser',

                    email:
                      COACH_EMAIL,

                    phone:
                      `+91${COACH_PHONE}`,

                    status:
                      'Active',

                    consentRequired:
                      false,

                    communityId:
                      'COACH7001',
                  },
                }),
            });

            return;
          }


          // ------------------------------------------------------
          // NORMAL USER
          // ------------------------------------------------------

          if (
            recipient ===
            `+91${NORMAL_USER_PHONE}`
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

                  isNewUser:
                    false,

                  isActive:
                    true,

                  role:
                    'user',

                  user: {

                    id:
                      NORMAL_USER_ID,

                    UserId:
                      NORMAL_USER_ID,

                    username:
                      'normaluser',

                    email:
                      NORMAL_USER_EMAIL,

                    phone:
                      `+91${NORMAL_USER_PHONE}`,

                    status:
                      'Active',

                    consentRequired:
                      false,
                  },
                }),
            });

            return;
          }


          await route.continue();

        }
      );


      // ==========================================================
      // 3. USER LOOKUP
      // ==========================================================

      await context.route(
        '**/api/user/lookup*',
        async route => {

          const method =
            route.request().method();

          const requestUrl =
            route.request().url();

          const url =
            new URL(
              requestUrl
            );

          const email =
            url.searchParams.get(
              'email'
            );


          console.log(
            'PROG-003 USER LOOKUP:',
            method,
            requestUrl
          );


          // ------------------------------------------------------
          // GET - COACH
          // ------------------------------------------------------

          if (
            method === 'GET' &&
            email === COACH_EMAIL
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

                  isNewUser:
                    false,

                  isActive:
                    true,

                  role:
                    'coach',

                  data: {

                    userId:
                      COACH_ID,

                    userName:
                      'Test Coach',

                    email:
                      COACH_EMAIL,

                    phoneNumber:
                      COACH_PHONE,

                    communityId:
                      'COACH7001',
                  },
                }),
            });

            return;
          }


          // ------------------------------------------------------
          // GET - NORMAL USER
          // ------------------------------------------------------

          if (
            method === 'GET' &&
            email === NORMAL_USER_EMAIL
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

                  isNewUser:
                    false,

                  isActive:
                    true,

                  role:
                    'user',

                  data: {

                    userId:
                      NORMAL_USER_ID,

                    userName:
                      'Normal User',

                    email:
                      NORMAL_USER_EMAIL,

                    phoneNumber:
                      NORMAL_USER_PHONE,
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

            const isCoach =
              body?.email ===
              COACH_EMAIL;


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
                    isCoach
                      ? 'coach'
                      : 'user',
                }),
            });

            return;
          }


          await route.continue();

        }
      );


      // ==========================================================
      // 4. CONSENT
      // ==========================================================

      await context.route(
        '**/api/user/consent*',
        async route => {

          if (
            route.request().method() ===
            'GET'
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


      // ==========================================================
      // 5. PROFILE
      // ==========================================================

      await context.route(
        '**/api/user/profile*',
        async route => {

          if (
            route.request().method() !==
            'GET'
          ) {

            await route.continue();

            return;
          }


          const url =
            new URL(
              route.request().url()
            );

          const email =
            url.searchParams.get(
              'email'
            );


          // ------------------------------------------------------
          // COACH PROFILE
          // ------------------------------------------------------

          if (
            email ===
            COACH_EMAIL
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
                      COACH_ID,

                    userName:
                      'Test Coach',

                    email:
                      COACH_EMAIL,

                    phoneNumber:
                      COACH_PHONE,

                    gender:
                      'Male',

                    height:
                      170,

                    communityId:
                      'COACH7001',

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

                    profileComplete:
                      true,
                  },
                }),
            });

            return;
          }


          // ------------------------------------------------------
          // NORMAL USER PROFILE
          // ------------------------------------------------------

          if (
            email ===
            NORMAL_USER_EMAIL
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
                      NORMAL_USER_ID,

                    userName:
                      'Normal User',

                    email:
                      NORMAL_USER_EMAIL,

                    phoneNumber:
                      NORMAL_USER_PHONE,

                    gender:
                      'Male',

                    height:
                      170,

                    communityId:
                      'USER9001',

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


      // ==========================================================
      // 6. USER STATUS
      //
      // Return the correct role based on email.
      // ==========================================================

      await context.route(
        '**/api/user/status*',
        async route => {

          const requestUrl =
            route.request().url();

          const url =
            new URL(
              requestUrl
            );

          const email =
            url.searchParams.get(
              'email'
            );


          const isCoach =
            email === COACH_EMAIL;


          console.log(
            'PROG-003 STATUS:',
            email,
            isCoach
              ? 'coach'
              : 'user'
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
                  isCoach,

                hasUpline:
                  !isCoach,

                teamId:
                  isCoach
                    ? 1
                    : null,

                uplineCoachId:
                  isCoach
                    ? null
                    : COACH_ID,

                role:
                  isCoach
                    ? 'coach'
                    : 'user',

                pendingRequest:
                  null,

                redirectTo:
                  null,
              }),
          });

        }
      );


      // ==========================================================
      // 7. HAS TEAM MEMBERS
      //
      // CRITICAL:
      //
      // Coach 7001 -> true
      // Normal user 9001 -> false
      // ==========================================================

      await context.route(
        '**/api/team/has-members*',
        async route => {

          const requestUrl =
            route.request().url();

          const url =
            new URL(
              requestUrl
            );

          const userId =
            url.searchParams.get(
              'userId'
            );


          const hasTeamMembers =
            userId ===
            String(COACH_ID);


          console.log(
            'PROG-003 HAS TEAM MEMBERS:',
            userId,
            hasTeamMembers
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

                hasTeamMembers:
                  hasTeamMembers,
              }),
          });

        }
      );


      // ==========================================================
      // 8. TEAM HIERARCHY
      // ==========================================================

      await context.route(
        '**/api/coach/team-hierarchy*',
        async route => {

          console.log(
            'PROG-003 TEAM HIERARCHY:',
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

                allMembers: [

                  // ------------------------------------------------
                  // COACH
                  // ------------------------------------------------

                  {
                    UserId:
                      COACH_ID,

                    UserName:
                      'Test Coach',

                    Email:
                      COACH_EMAIL,

                    CommunityId:
                      'COACH7001',

                    Role:
                      'coach',

                    CoachId:
                      null,

                    CoCoachId:
                      null,

                    Status:
                      'Active',
                  },


                  // ------------------------------------------------
                  // DIRECT DOWNLINE
                  // ------------------------------------------------

                  {
                    UserId:
                      DOWNLINE_ID,

                    UserName:
                      DOWNLINE_NAME,

                    Email:
                      'downline@test.com',

                    CommunityId:
                      'DOWNLINE8001',

                    Role:
                      'user',

                    CoachId:
                      COACH_ID,

                    CoCoachId:
                      null,

                    Status:
                      'Active',
                  },

                ],
              }),
          });

        }
      );


      // ==========================================================
      // 9. EXISTING ENROLLMENTS
      // ==========================================================

      await context.route(
        '**/api/wellness-university/get-enrollments*',
        async route => {

          const requestUrl =
            route.request().url();

          const url =
            new URL(
              requestUrl
            );

          const userId =
            url.searchParams.get(
              'userId'
            );


          let programs = [];


          if (
            userId ===
            String(COACH_ID)
          ) {

            programs = [
              'Weight Loss',
            ];

          } else if (
            userId ===
            String(DOWNLINE_ID)
          ) {

            programs = [
              'Weight Gain',
            ];

          } else if (
            userId ===
            String(NORMAL_USER_ID)
          ) {

            programs = [
              'Weight Loss',
            ];

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

                enrollments:
                  programs.length > 0
                    ? [
                        {
                          UserId:
                            Number(userId),

                          EnrolledPrograms:
                            JSON.stringify(
                              Object.fromEntries(
                                programs.map(
                                  program => [
                                    program,
                                    new Date().toISOString(),
                                  ]
                                )
                              )
                            ),
                        },
                      ]
                    : [],
              }),
          });

        }
      );


      // ==========================================================
      // 10. UPDATE ENROLLMENT
      // ==========================================================

      await context.route(
        '**/api/wellness-university/update-enrollment',
        async route => {

          const body =
            route.request().postDataJSON();


          console.log(
            'PROG-003 UPDATE:',
            body
          );


          updateRequests.push({
            ...body,
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

                message:
                  'Enrollment updated successfully',

                enrollment: {

                  id:
                    1000,

                  programs:
                    body.programs,
                },
              }),
          });

        }
      );

    }


    // ============================================================
    // LOGIN HELPER
    // ============================================================

    async function login(
      page,
      phone
    ) {

      await page.goto('/');


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
        phone
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


      await expect
        .poll(
          async () => {

            return await page.evaluate(
              () => ({
                verified:
                  localStorage.getItem(
                    'isOtpVerified'
                  ),
              })
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
        });

    }


    // ============================================================
    // ============================================================
    // PART 1 — COACH
    // ============================================================
    // ============================================================

    const coachContext =
      await browser.newContext();


    try {

      await registerMocks(
        coachContext
      );


      const coachPage =
        await coachContext.newPage();


      await login(
        coachPage,
        COACH_PHONE
      );


      // ----------------------------------------------------------
      // OPEN PROGRAMS
      // ----------------------------------------------------------

      await coachPage
        .getByRole(
          'button',
          {
            name:
              'Enrollment',

            exact:
              true,
          }
        )
        .click();


      await expect(
        coachPage.getByRole(
          'heading',
          {
            name:
              'Programmers enrolled',

            exact:
              true,
          }
        )
      ).toBeVisible({
        timeout:
          15000,
      });


      // ========================================================
      // COACH SEARCH MUST EXIST
      // ========================================================

      const memberSearch =
        coachPage.getByPlaceholder(
          'Type a name to search members...'
        );


      await expect(
        memberSearch
      ).toBeVisible({
        timeout:
          10000,
      });


      console.log(
        'PROG-003 COACH SEARCH VISIBLE'
      );


      // ========================================================
      // COACH EDITS OWN PROGRAM
      // ========================================================

      const ownUpdateButton =
        coachPage.getByRole(
          'button',
          {
            name:
              /Update \(\d+ selected\)/,
          }
        );


      await expect(
        ownUpdateButton
      ).toBeVisible({
        timeout:
          10000,
      });


      await expect(
        ownUpdateButton
      ).toBeEnabled();


      await coachPage
        .getByText(
          'Sports Nutrition',
          {
            exact:
              true,
          }
        )
        .click();


      await coachPage
        .getByRole(
          'button',
          {
            name:
              /Update \(2 selected\)/,
          }
        )
        .click();


      await expect
        .poll(
          () =>
            updateRequests.length,
          {
            timeout:
              10000,
          }
        )
        .toBe(1);


      expect(
        updateRequests[0].userId
      ).toBe(
        COACH_ID
      );


      expect(
        updateRequests[0].programs
      ).toEqual(
        expect.arrayContaining([
          'Weight Loss',
          'Sports Nutrition',
        ])
      );


      console.log(
        'PROG-003 COACH OWN PROGRAM UPDATED'
      );


      // ========================================================
      // COACH SEARCHES DOWNLINE
      // ========================================================

      await memberSearch.fill(
        DOWNLINE_NAME
      );


      const downlineResult =
        coachPage
          .getByRole(
            'button'
          )
          .filter({
            hasText:
              DOWNLINE_NAME,
          });


      await expect(
        downlineResult
      ).toHaveCount(
        1,
        {
          timeout:
            10000,
        }
      );


      await downlineResult.click();


      await expect(
        coachPage.getByText(
          DOWNLINE_NAME,
          {
            exact:
              true,
          }
        )
      ).toBeVisible({
        timeout:
          10000,
      });


      // ========================================================
      // COACH EDITS DOWNLINE
      // ========================================================

      const downlineUpdateButton =
        coachPage.getByRole(
          'button',
          {
            name:
              /Update \(\d+ selected\)/,
          }
        );


      await expect(
        downlineUpdateButton
      ).toBeVisible({
        timeout:
          10000,
      });


      await expect(
        downlineUpdateButton
      ).toBeEnabled();


      await coachPage
        .getByText(
          'Targeted Nutrition',
          {
            exact:
              true,
          }
        )
        .click();


      await coachPage
        .getByRole(
          'button',
          {
            name:
              /Update \(2 selected\)/,
          }
        )
        .click();


      await expect
        .poll(
          () =>
            updateRequests.length,
          {
            timeout:
              10000,
          }
        )
        .toBe(2);


      expect(
        updateRequests[1].userId
      ).toBe(
        DOWNLINE_ID
      );


      expect(
        updateRequests[1].programs
      ).toEqual(
        expect.arrayContaining([
          'Weight Gain',
          'Targeted Nutrition',
        ])
      );


      console.log(
        'PROG-003 COACH DOWNLINE PROGRAM UPDATED'
      );

    } finally {

      await coachContext.close();

    }


    // ============================================================
    // ============================================================
    // PART 2 — NORMAL USER
    // ============================================================
    // ============================================================

    const normalUserContext =
      await browser.newContext();


    try {

      await registerMocks(
        normalUserContext
      );


      const normalUserPage =
        await normalUserContext.newPage();


      await login(
        normalUserPage,
        NORMAL_USER_PHONE
      );


      // ----------------------------------------------------------
      // OPEN PROGRAMS
      // ----------------------------------------------------------

      await normalUserPage
        .getByRole(
          'button',
          {
            name:
              'Enrollment',

            exact:
              true,
          }
        )
        .click();


      await expect(
        normalUserPage.getByRole(
          'heading',
          {
            name:
              'Programmers enrolled',

            exact:
              true,
          }
        )
      ).toBeVisible({
        timeout:
          15000,
      });


      // ========================================================
      // NORMAL USER MUST NOT HAVE SEARCH
      // ========================================================

      await expect(
        normalUserPage.getByPlaceholder(
          'Type a name to search members...'
        )
      ).toHaveCount(
        0
      );


      console.log(
        'PROG-003 NORMAL USER SEARCH NOT VISIBLE'
      );


      // ========================================================
      // NORMAL USER CAN EDIT OWN PROGRAM
      // ========================================================

      const normalUpdateButton =
        normalUserPage.getByRole(
          'button',
          {
            name:
              /Update \(\d+ selected\)/,
          }
        );


      await expect(
        normalUpdateButton
      ).toBeVisible({
        timeout:
          10000,
      });


      await expect(
        normalUpdateButton
      ).toBeEnabled();


      await normalUserPage
        .getByText(
          'Sports Nutrition',
          {
            exact:
              true,
          }
        )
        .click();


      await normalUserPage
        .getByRole(
          'button',
          {
            name:
              /Update \(2 selected\)/,
          }
        )
        .click();


      await expect
        .poll(
          () =>
            updateRequests.length,
          {
            timeout:
              10000,
          }
        )
        .toBe(3);


      expect(
        updateRequests[2].userId
      ).toBe(
        NORMAL_USER_ID
      );


      expect(
        updateRequests[2].programs
      ).toEqual(
        expect.arrayContaining([
          'Weight Loss',
          'Sports Nutrition',
        ])
      );


      console.log(
        'PROG-003 NORMAL USER OWN PROGRAM UPDATED'
      );

    } finally {

      await normalUserContext.close();

    }


    // ============================================================
    // FINAL ASSERTIONS
    // ============================================================

    expect(
      updateRequests
    ).toHaveLength(
      3
    );


    expect(
      updateRequests[0].userId
    ).toBe(
      COACH_ID
    );


    expect(
      updateRequests[1].userId
    ).toBe(
      DOWNLINE_ID
    );


    expect(
      updateRequests[2].userId
    ).toBe(
      NORMAL_USER_ID
    );


    console.log(
      'PROG-003 AUTHORIZATION FLOW VERIFIED'
    );

  }
);


test(
  'PROG-004 user can create a program enrollment',
  async ({ page }) => {

    const PHONE = '7695834209';
    const OTP = '123456';
    const EMAIL = 'existing@test.com';
    const USER_ID = 861;

    let enrollRequest = null;

    // Auth
    await page.route(
      '**/api/auth/send-otp',
      async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      }
    );

    await page.route(
      '**/api/auth/verify-otp',
      async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            isNewUser: false,
            isActive: true,
            role: 'user',
            user: {
              id: USER_ID,
              UserId: USER_ID,
              username: 'existinguser',
              email: EMAIL,
              phone: `+91${PHONE}`,
              status: 'Active',
              consentRequired: false,
            },
          }),
        });
      }
    );

    // Lookup
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
              userId: USER_ID,
              userName: 'Nitheesh Lingam',
              email: EMAIL,
            },
          }),
        });
      }
    );

    // Consent
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

    // Profile
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
                userId: USER_ID,
                userName: 'Nitheesh Lingam',
                email: EMAIL,
                phoneNumber: PHONE,
                gender: 'Male',
                height: 170,
                communityId: 'WB12345',
                dietType: 'Vegetarian',
                profileComplete: true,
              },
            }),
          });
          return;
        }
        await route.continue();
      }
    );

    // Setup complete
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
            hasTeamId: false,
            hasUpline: true,
            role: 'user',
            pendingRequest: null,
            redirectTo: null,
          }),
        });
      }
    );

    // No existing enrollment
    await page.route(
      '**/api/wellness-university/get-enrollments*',
      async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            enrollments: [],
          }),
        });
      }
    );

    // Create enrollment
    await page.route(
      '**/api/wellness-university/enroll',
      async route => {
        enrollRequest =
          route.request().postDataJSON();

        console.log(
          'PROG-004 ENROLL REQUEST:',
          enrollRequest
        );

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            message: 'Enrollment successful',
          }),
        });
      }
    );

    // Login
    await page.goto('/');

    await page
      .getByLabel('Mobile Number')
      .fill(PHONE);

    await page
      .getByRole('button', {
        name: 'Send OTP',
        exact: true,
      })
      .click();

    await expect(
      page.getByText('Enter OTP', { exact: true })
    ).toBeVisible();

    const otpInputs =
      page.locator('input[type="tel"]');

    await expect(otpInputs).toHaveCount(6);

    for (
      let i = 0;
      i < OTP.length;
      i++
    ) {
      await otpInputs.nth(i).fill(OTP[i]);
    }

    await expect
      .poll(
        async () =>
          page.evaluate(() =>
            localStorage.getItem(
              'isOtpVerified'
            )
          ),
        {
          timeout: 15000,
        }
      )
      .toBe('true');

    // Open Programs
    await page
      .getByRole('button', {
        name: 'Enrollment',
        exact: true,
      })
      .click();

    await expect(
      page.getByRole('heading', {
        name: 'Programmers Enrollment',
        exact: true,
      })
    ).toBeVisible({
      timeout: 15000,
    });

    // Enroll button before selection
    const enrollButton =
      page.getByRole('button', {
        name: /Enroll \(0 selected\)/,
      });

    await expect(enrollButton).toBeVisible();
    await expect(enrollButton).toBeDisabled();

    // Select one program
    await page
      .getByText('Weight Loss', {
        exact: true,
      })
      .click();

    // Button should become enabled
    const enabledEnrollButton =
      page.getByRole('button', {
        name: /Enroll \(1 selected\)/,
      });

    await expect(
      enabledEnrollButton
    ).toBeVisible();

    await expect(
      enabledEnrollButton
    ).toBeEnabled();

    // Create enrollment
    await enabledEnrollButton.click();

    // Verify request
    await expect
      .poll(
        () => enrollRequest,
        {
          timeout: 10000,
        }
      )
      .not.toBeNull();

    expect(
      enrollRequest
    ).toMatchObject({
      userId: USER_ID,
      programs: ['Weight Loss'],
    });

    console.log(
      'PROG-004 ENROLLMENT CREATED'
    );
  }
);

test(
  'PROG-005 user can enroll in programs and update existing enrollment',
  async ({ page }) => {

    const PHONE = '7695834209';
    const OTP = '123456';
    const EMAIL = 'existing@test.com';
    const USER_ID = 861;

    let enrollmentCreated = false;
    let enrollRequest = null;
    let updateRequest = null;

    // ==========================================================
    // AUTH
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

    await page.route(
      '**/api/auth/verify-otp',
      async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            isNewUser: false,
            isActive: true,
            role: 'user',
            user: {
              id: USER_ID,
              UserId: USER_ID,
              username: 'existinguser',
              email: EMAIL,
              phone: `+91${PHONE}`,
              status: 'Active',
              consentRequired: false,
            },
          }),
        });
      }
    );

    // ==========================================================
    // USER LOOKUP
    // ==========================================================

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
              userId: USER_ID,
              userName: 'Nitheesh Lingam',
              email: EMAIL,
            },
          }),
        });
      }
    );

    // ==========================================================
    // CONSENT
    // ==========================================================

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

    // ==========================================================
    // PROFILE
    // ==========================================================

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
                userId: USER_ID,
                userName: 'Nitheesh Lingam',
                email: EMAIL,
                phoneNumber: PHONE,
                gender: 'Male',
                height: 170,
                communityId: 'WB12345',
                dietType: 'Vegetarian',
                profileComplete: true,
              },
            }),
          });
          return;
        }

        await route.continue();
      }
    );

    // ==========================================================
    // SETUP
    // ==========================================================

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
            hasTeamId: false,
            hasUpline: true,
            role: 'user',
            pendingRequest: null,
            redirectTo: null,
          }),
        });
      }
    );

    // ==========================================================
    // GET ENROLLMENT
    // First call -> no enrollment
    // Later calls -> existing Weight Loss enrollment
    // ==========================================================

    await page.route(
      '**/api/wellness-university/get-enrollments*',
      async route => {

        const enrollments =
          enrollmentCreated
            ? [
                {
                  UserId: USER_ID,
                  EnrolledPrograms:
                    JSON.stringify({
                      'Weight Loss':
                        new Date().toISOString(),
                    }),
                },
              ]
            : [];

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            enrollments,
          }),
        });
      }
    );

    // ==========================================================
    // CREATE ENROLLMENT
    // ==========================================================

    await page.route(
      '**/api/wellness-university/enroll',
      async route => {

        enrollRequest =
          route.request().postDataJSON();

        console.log(
          'PROG-005 ENROLL:',
          enrollRequest
        );

        enrollmentCreated = true;

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            message: 'Enrollment successful',
          }),
        });
      }
    );

    // ==========================================================
    // UPDATE ENROLLMENT
    // ==========================================================

    await page.route(
      '**/api/wellness-university/update-enrollment',
      async route => {

        updateRequest =
          route.request().postDataJSON();

        console.log(
          'PROG-005 UPDATE:',
          updateRequest
        );

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            message: 'Enrollment updated successfully',
            enrollment: {
              id: 1000,
              programs:
                updateRequest.programs,
            },
          }),
        });
      }
    );

    // ==========================================================
    // LOGIN
    // ==========================================================

    await page.goto('/');

    await page
      .getByLabel('Mobile Number')
      .fill(PHONE);

    await page
      .getByRole('button', {
        name: 'Send OTP',
        exact: true,
      })
      .click();

    await expect(
      page.getByText(
        'Enter OTP',
        { exact: true }
      )
    ).toBeVisible();

    const otpInputs =
      page.locator(
        'input[type="tel"]'
      );

    await expect(
      otpInputs
    ).toHaveCount(6);

    for (
      let i = 0;
      i < OTP.length;
      i++
    ) {
      await otpInputs
        .nth(i)
        .fill(OTP[i]);
    }

    await expect
      .poll(
        async () =>
          page.evaluate(
            () =>
              localStorage.getItem(
                'isOtpVerified'
              )
          ),
        {
          timeout: 15000,
        }
      )
      .toBe('true');

    // ==========================================================
    // OPEN PROGRAMS - CREATE
    // ==========================================================

    await page
      .getByRole('button', {
        name: 'Enrollment',
        exact: true,
      })
      .click();

    await expect(
      page.getByRole('heading', {
        name:
          'Programmers Enrollment',
        exact: true,
      })
    ).toBeVisible({
      timeout: 15000,
    });

    const enrollButton =
      page.getByRole('button', {
        name:
          /Enroll \(0 selected\)/,
      });

    await expect(
      enrollButton
    ).toBeDisabled();

    // ==========================================================
    // SELECT FIRST PROGRAM
    // ==========================================================

    await page
      .getByText(
        'Weight Loss',
        { exact: true }
      )
      .click();

    const createButton =
      page.getByRole('button', {
        name:
          /Enroll \(1 selected\)/,
      });

    await expect(
      createButton
    ).toBeEnabled();

    await createButton.click();

    // ==========================================================
    // VERIFY CREATE REQUEST
    // ==========================================================

    await expect
      .poll(
        () => enrollRequest,
        {
          timeout: 10000,
        }
      )
      .not.toBeNull();

    expect(
      enrollRequest
    ).toMatchObject({
      userId: USER_ID,
      programs: ['Weight Loss'],
    });

    // ==========================================================
    // VERIFY SUCCESS
    // ==========================================================

    await expect(
      page.getByText(
        'Enrollment Successful!',
        { exact: true }
      )
    ).toBeVisible({
      timeout: 5000,
    });

    console.log(
      'PROG-005 ENROLLMENT CREATED'
    );

    // ==========================================================
    // WAIT FOR CREATE FLOW TO CLOSE
    // ==========================================================

    await expect(
      page.getByText(
        'Enrollment Successful!',
        { exact: true }
      )
    ).toBeHidden({
      timeout: 5000,
    });

    // ==========================================================
    // REOPEN PROGRAMS
    // ==========================================================

    await page
      .getByRole('button', {
        name: 'Enrollment',
        exact: true,
      })
      .click();

    await expect(
      page.getByRole('heading', {
        name:
          'Programmers enrolled',
        exact: true,
      })
    ).toBeVisible({
      timeout: 15000,
    });

    // ==========================================================
    // EXISTING PROGRAM MUST BE SELECTED
    // ==========================================================

    const updateButton =
      page.getByRole('button', {
        name:
          /Update \(1 selected\)/,
      });

    await expect(
      updateButton
    ).toBeEnabled();

    await expect(
      page.getByText(
        'Weight Loss',
        { exact: true }
      )
    ).toBeVisible();

    // ==========================================================
    // ADD SECOND PROGRAM
    // ==========================================================

    await page
      .getByText(
        'Sports Nutrition',
        { exact: true }
      )
      .click();

    const finalUpdateButton =
      page.getByRole('button', {
        name:
          /Update \(2 selected\)/,
      });

    await expect(
      finalUpdateButton
    ).toBeEnabled();

    await finalUpdateButton.click();

    // ==========================================================
    // VERIFY UPDATE REQUEST
    // ==========================================================

    await expect
      .poll(
        () => updateRequest,
        {
          timeout: 10000,
        }
      )
      .not.toBeNull();

    expect(
      updateRequest
    ).toMatchObject({
      userId: USER_ID,
    });

    expect(
      updateRequest.programs
    ).toEqual(
      expect.arrayContaining([
        'Weight Loss',
        'Sports Nutrition',
      ])
    );

    expect(
      updateRequest.programs
    ).toHaveLength(2);

    // ==========================================================
    // VERIFY UPDATE SUCCESS
    // ==========================================================

    await expect(
      page.getByText(
        'Enrollment Updated!',
        { exact: true }
      )
    ).toBeVisible({
      timeout: 5000,
    });

    console.log(
      'PROG-005 EXISTING ENROLLMENT UPDATED'
    );
  }
);


test(
  'PROG-006 coach can switch member, use Back to My Enrollment and View Mine',
  async ({ page }) => {

    const PHONE = '7695834209';
    const OTP = '123456';
    const EMAIL = 'coach@test.com';

    const COACH_ID = 7001;
    const MEMBER_ID = 8001;
    const MEMBER_NAME = 'Downline Member';

    // ==========================================================
    // AUTH
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

    await page.route(
      '**/api/auth/verify-otp',
      async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            isNewUser: false,
            isActive: true,
            role: 'coach',
            user: {
              id: COACH_ID,
              UserId: COACH_ID,
              username: 'coachuser',
              email: EMAIL,
              phone: `+91${PHONE}`,
              status: 'Active',
              consentRequired: false,
            },
          }),
        });
      }
    );

    // ==========================================================
    // LOOKUP
    // ==========================================================

    await page.route(
      '**/api/user/lookup*',
      async route => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              isNewUser: false,
              isActive: true,
              role: 'coach',
              data: {
                userId: COACH_ID,
                userName: 'Test Coach',
                email: EMAIL,
                phoneNumber: PHONE,
                communityId: 'COACH7001',
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
            isNewUser: false,
            isActive: true,
            role: 'coach',
          }),
        });
      }
    );

    // ==========================================================
    // CONSENT
    // ==========================================================

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

    // ==========================================================
    // PROFILE
    // ==========================================================

    await page.route(
      '**/api/user/profile*',
      async route => {
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
              userId: COACH_ID,
              userName: 'Test Coach',
              email: EMAIL,
              phoneNumber: PHONE,
              gender: 'Male',
              height: 170,
              communityId: 'COACH7001',
              dietType: 'Vegetarian',
              latestWeight: 72.5,
              bodyFat: 22,
              physicalActivityLevel: 'moderate',
              profileComplete: true,
            },
          }),
        });
      }
    );

    // ==========================================================
    // STATUS
    // ==========================================================

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
            role: 'coach',
            pendingRequest: null,
            redirectTo: null,
          }),
        });
      }
    );

    // ==========================================================
    // TEAM MEMBERS
    // ==========================================================

    await page.route(
      '**/api/team/has-members*',
      async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            hasTeamMembers: true,
          }),
        });
      }
    );

    // ==========================================================
    // TEAM HIERARCHY
    // ==========================================================

    await page.route(
      '**/api/coach/team-hierarchy*',
      async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            allMembers: [
              {
                UserId: COACH_ID,
                UserName: 'Test Coach',
                Email: EMAIL,
                CommunityId: 'COACH7001',
                Role: 'coach',
                CoachId: null,
                CoCoachId: null,
                Status: 'Active',
              },
              {
                UserId: MEMBER_ID,
                UserName: MEMBER_NAME,
                Email: 'downline@test.com',
                CommunityId: 'DOWNLINE8001',
                Role: 'user',
                CoachId: COACH_ID,
                CoCoachId: null,
                Status: 'Active',
              },
            ],
          }),
        });
      }
    );

    // ==========================================================
    // ENROLLMENTS
    // ==========================================================

    await page.route(
      '**/api/wellness-university/get-enrollments*',
      async route => {
        const url = new URL(route.request().url());
        const userId = url.searchParams.get('userId');

        const program =
          userId === String(MEMBER_ID)
            ? 'Weight Gain'
            : 'Weight Loss';

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            enrollments: [
              {
                UserId: Number(userId),
                EnrolledPrograms: JSON.stringify({
                  [program]: new Date().toISOString(),
                }),
              },
            ],
          }),
        });
      }
    );

    // ==========================================================
    // LOGIN
    // ==========================================================

    await page.goto('/');

    await page
      .getByLabel('Mobile Number')
      .fill(PHONE);

    await page
      .getByRole('button', {
        name: 'Send OTP',
        exact: true,
      })
      .click();

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

    for (let i = 0; i < OTP.length; i++) {
      await otpInputs
        .nth(i)
        .fill(OTP[i]);
    }

    await expect
      .poll(
        async () =>
          page.evaluate(
            () =>
              localStorage.getItem(
                'isOtpVerified'
              )
          ),
        {
          timeout: 15000,
        }
      )
      .toBe('true');

    // ==========================================================
    // OPEN PROGRAMS
    // ==========================================================

    await page
      .getByRole('button', {
        name: 'Enrollment',
        exact: true,
      })
      .click();

    await expect(
      page.getByRole('heading', {
        name: 'Programmers enrolled',
        exact: true,
      })
    ).toBeVisible({
      timeout: 15000,
    });

    // ==========================================================
    // OWN ENROLLMENT
    // ==========================================================

    await expect(
      page.getByText('Weight Loss', {
        exact: true,
      })
    ).toBeVisible();

    const search =
      page.getByPlaceholder(
        'Type a name to search members...'
      );

    await expect(
      search
    ).toBeVisible();

    // ==========================================================
    // SELECT MEMBER
    // ==========================================================

    await search.fill(
      MEMBER_NAME
    );

    const memberResult =
      page
        .getByRole('button')
        .filter({
          hasText: MEMBER_NAME,
        });

    await expect(
      memberResult
    ).toHaveCount(
      1,
      {
        timeout: 10000,
      }
    );

    await memberResult.click();

    // ==========================================================
    // VERIFY MEMBER VIEW
    // ==========================================================

    await expect(
      page.getByText(
        MEMBER_NAME,
        {
          exact: true,
        }
      )
    ).toBeVisible({
      timeout: 10000,
    });

    await expect(
      page.getByText('Weight Gain', {
        exact: true,
      })
    ).toBeVisible();

    // ==========================================================
    // BACK TO MY ENROLLMENT MUST BE VISIBLE
    // ==========================================================

    const backButton =
      page.getByRole('button', {
        name:
          '← Back to My Enrollment',
        exact: true,
      });

    await expect(
      backButton
    ).toBeVisible({
      timeout: 10000,
    });

    console.log(
      'PROG-006 BACK TO MY ENROLLMENT VISIBLE'
    );

    // ==========================================================
    // CLICK BACK TO MY ENROLLMENT
    // ==========================================================

    await backButton.click();

    await expect(
      page.getByText('Weight Loss', {
        exact: true,
      })
    ).toBeVisible({
      timeout: 10000,
    });

    // ==========================================================
    // VERIFY MEMBER VIEW CLOSED
    // ==========================================================

    await expect(
      page.getByRole('button', {
        name:
          '← Back to My Enrollment',
        exact: true,
      })
    ).not.toBeVisible();

    console.log(
      'PROG-006 RETURNED TO OWN ENROLLMENT'
    );

    // ==========================================================
    // SELECT MEMBER AGAIN
    // ==========================================================

    await search.fill(
      MEMBER_NAME
    );

    const memberResultAgain =
      page
        .getByRole('button')
        .filter({
          hasText: MEMBER_NAME,
        });

    await expect(
      memberResultAgain
    ).toHaveCount(
      1,
      {
        timeout: 10000,
      }
    );

    await memberResultAgain.click();

    await expect(
      page.getByText(
        MEMBER_NAME,
        {
          exact: true,
        }
      )
    ).toBeVisible({
      timeout: 10000,
    });

    // ==========================================================
    // VIEW MINE MUST NOW BE VISIBLE
    // ==========================================================

    const viewMine =
      page.getByRole('button', {
        name: 'View Mine',
        exact: true,
      });

    await expect(
      viewMine
    ).toBeVisible({
      timeout: 10000,
    });

    console.log(
      'PROG-006 VIEW MINE VISIBLE'
    );

    // ==========================================================
    // CLICK VIEW MINE
    // ==========================================================

    await viewMine.click();

    // ==========================================================
    // VERIFY OWN ENROLLMENT
    // ==========================================================

    await expect(
      page.getByText('Weight Loss', {
        exact: true,
      })
    ).toBeVisible({
      timeout: 10000,
    });

    // ==========================================================
    // BACK BUTTON SHOULD DISAPPEAR
    // ==========================================================

    await expect(
      page.getByRole('button', {
        name:
          '← Back to My Enrollment',
        exact: true,
      })
    ).not.toBeVisible();

    console.log(
      'PROG-006 VIEW MINE RETURNED TO OWN ENROLLMENT'
    );

  }

  
);


test(
  'PROG-007 coach can edit own, downline coach and downline coach member programs',
  async ({ page }) => {

    const PHONE = '7695834209';
    const OTP = '123456';
    const EMAIL = 'coach@test.com';

    const COACH_ID = 7001;
    const DOWNLINE_COACH_ID = 8002;
    const DOWNLINE_MEMBER_ID = 8003;

    const DOWNLINE_COACH = 'Downline Coach';
    const DOWNLINE_MEMBER = 'Downline Coach Member';

    const updates = [];

    // ==========================================================
    // AUTH
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

    await page.route(
      '**/api/auth/verify-otp',
      async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            isNewUser: false,
            isActive: true,
            role: 'coach',
            user: {
              id: COACH_ID,
              UserId: COACH_ID,
              username: 'coachuser',
              email: EMAIL,
              phone: `+91${PHONE}`,
              status: 'Active',
              consentRequired: false,
              communityId: 'COACH7001',
            },
          }),
        });
      }
    );

    // ==========================================================
    // USER LOOKUP
    // ==========================================================

    await page.route(
      '**/api/user/lookup*',
      async route => {

        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              isNewUser: false,
              isActive: true,
              role: 'coach',
              data: {
                userId: COACH_ID,
                userName: 'Test Coach',
                email: EMAIL,
                phoneNumber: PHONE,
                communityId: 'COACH7001',
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
            isNewUser: false,
            isActive: true,
            role: 'coach',
          }),
        });
      }
    );

    // ==========================================================
    // CONSENT
    // ==========================================================

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

    // ==========================================================
    // PROFILE
    // ==========================================================

    await page.route(
      '**/api/user/profile*',
      async route => {

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
              userId: COACH_ID,
              userName: 'Test Coach',
              email: EMAIL,
              phoneNumber: PHONE,
              gender: 'Male',
              height: 170,
              communityId: 'COACH7001',
              dietType: 'Vegetarian',
              latestWeight: 72.5,
              latestWeightBodyFat: 22,
              bodyFat: 22,
              physicalActivityLevel: 'moderate',
              profileComplete: true,
            },
          }),
        });
      }
    );

    // ==========================================================
    // STATUS
    // ==========================================================

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
            role: 'coach',
            pendingRequest: null,
            redirectTo: null,
          }),
        });
      }
    );

    // ==========================================================
    // COACH HAS TEAM MEMBERS
    // ==========================================================

    await page.route(
      '**/api/team/has-members*',
      async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            hasTeamMembers: true,
          }),
        });
      }
    );

    // ==========================================================
    // TEAM HIERARCHY
    //
    // Coach
    //   └── Downline Coach
    //         └── Downline Coach Member
    // ==========================================================

    await page.route(
      '**/api/coach/team-hierarchy*',
      async route => {

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,

            allMembers: [

              {
                UserId: COACH_ID,
                UserName: 'Test Coach',
                Email: EMAIL,
                CommunityId: 'COACH7001',
                Role: 'coach',
                CoachId: null,
                CoCoachId: null,
                Status: 'Active',
              },

              {
                UserId: DOWNLINE_COACH_ID,
                UserName: DOWNLINE_COACH,
                Email: 'downlinecoach@test.com',
                CommunityId: 'COACH8002',
                Role: 'coach',
                CoachId: COACH_ID,
                CoCoachId: null,
                Status: 'Active',
              },

              {
                UserId: DOWNLINE_MEMBER_ID,
                UserName: DOWNLINE_MEMBER,
                Email: 'downlinemember@test.com',
                CommunityId: 'MEMBER8003',
                Role: 'user',
                CoachId: DOWNLINE_COACH_ID,
                CoCoachId: null,
                Status: 'Active',
              },

            ],
          }),
        });
      }
    );

    // ==========================================================
    // EXISTING ENROLLMENTS
    // ==========================================================

    await page.route(
      '**/api/wellness-university/get-enrollments*',
      async route => {

        const url =
          new URL(route.request().url());

        const userId =
          url.searchParams.get('userId');

        let program = 'Weight Loss';

        if (
          userId ===
          String(DOWNLINE_COACH_ID)
        ) {
          program = 'Weight Gain';
        }

        if (
          userId ===
          String(DOWNLINE_MEMBER_ID)
        ) {
          program = 'Targeted Nutrition';
        }

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            enrollments: [
              {
                UserId: Number(userId),
                EnrolledPrograms:
                  JSON.stringify({
                    [program]:
                      new Date().toISOString(),
                  }),
              },
            ],
          }),
        });
      }
    );

    // ==========================================================
    // UPDATE ENROLLMENT
    // ==========================================================

    await page.route(
      '**/api/wellness-university/update-enrollment',
      async route => {

        const body =
          route.request().postDataJSON();

        console.log(
          'PROG-007 UPDATE:',
          body
        );

        updates.push(body);

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            message: 'Enrollment updated successfully',
            enrollment: {
              id: 1000,
              programs: body.programs,
            },
          }),
        });
      }
    );

    // ==========================================================
    // LOGIN
    // ==========================================================

    await page.goto('/');

    await page
      .getByLabel('Mobile Number')
      .fill(PHONE);

    await page
      .getByRole('button', {
        name: 'Send OTP',
        exact: true,
      })
      .click();

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
      i < OTP.length;
      i++
    ) {
      await otpInputs
        .nth(i)
        .fill(OTP[i]);
    }

    await expect
      .poll(
        async () =>
          page.evaluate(
            () =>
              localStorage.getItem(
                'isOtpVerified'
              )
          ),
        {
          timeout: 15000,
        }
      )
      .toBe('true');

    // ==========================================================
    // OPEN PROGRAMS
    // ==========================================================

    await page
      .getByRole('button', {
        name: 'Enrollment',
        exact: true,
      })
      .click();

    await expect(
      page.getByRole('heading', {
        name: 'Programmers enrolled',
        exact: true,
      })
    ).toBeVisible({
      timeout: 15000,
    });

    // ==========================================================
    // SEARCH HELPER
    // ==========================================================

    async function selectMember(
      name
    ) {

      const search =
        page.getByPlaceholder(
          'Type a name to search members...'
        );

      await expect(
        search
      ).toBeVisible({
        timeout: 10000,
      });

      await search.click();

      await search.press(
        'Control+A'
      );

      await search.fill(
        name
      );

      const text =
        page.getByText(
          name,
          {
            exact: true,
          }
        );

      await expect(
        text
      ).toBeVisible({
        timeout: 10000,
      });

      const result =
        text.locator(
          'xpath=ancestor::button[1]'
        );

      await expect(
        result
      ).toBeVisible({
        timeout: 10000,
      });

      await result.click();

      await expect(
        page.getByText(
          name,
          {
            exact: true,
          }
        )
      ).toBeVisible({
        timeout: 10000,
      });
    }

    // ==========================================================
    // 1. COACH EDITS HIMSELF
    // ==========================================================

    const ownUpdate =
      page.getByRole('button', {
        name:
          /Update \(1 selected\)/,
      });

    await expect(
      ownUpdate
    ).toBeVisible({
      timeout: 10000,
    });

    await expect(
      ownUpdate
    ).toBeEnabled();

    await page
      .getByText(
        'Sports Nutrition',
        {
          exact: true,
        }
      )
      .click();

    await page
      .getByRole('button', {
        name:
          /Update \(2 selected\)/,
      })
      .click();

    await expect
      .poll(
        () => updates.length,
        {
          timeout: 10000,
        }
      )
      .toBe(1);

    expect(
      updates[0].userId
    ).toBe(
      COACH_ID
    );

    expect(
      updates[0].programs
    ).toEqual(
      expect.arrayContaining([
        'Weight Loss',
        'Sports Nutrition',
      ])
    );

    console.log(
      'PROG-007 COACH SELF EDIT VERIFIED'
    );

    // ==========================================================
    // RETURN TO OWN ENROLLMENT
    // ==========================================================

    await page
      .getByRole('button', {
        name:
          '← Back to My Enrollment',
        exact: true,
      })
      .count()
      .then(async count => {
        if (count > 0) {
          await page
            .getByRole('button', {
              name:
                '← Back to My Enrollment',
              exact: true,
            })
            .click();
        }
      });

    // ==========================================================
    // 2. COACH EDITS DOWNLINE COACH
    // ==========================================================

    await selectMember(
      DOWNLINE_COACH
    );

    await expect(
      page.getByText(
        'Weight Gain',
        {
          exact: true,
        }
      )
    ).toBeVisible();

    await page
      .getByText(
        'Sports Nutrition',
        {
          exact: true,
        }
      )
      .click();

    const downlineCoachUpdate =
      page.getByRole('button', {
        name:
          /Update \(2 selected\)/,
      });

    await expect(
      downlineCoachUpdate
    ).toBeVisible({
      timeout: 10000,
    });

    await expect(
      downlineCoachUpdate
    ).toBeEnabled();

    await downlineCoachUpdate.click();

    await expect
      .poll(
        () => updates.length,
        {
          timeout: 10000,
        }
      )
      .toBe(2);

    expect(
      updates[1].userId
    ).toBe(
      DOWNLINE_COACH_ID
    );

    expect(
      updates[1].programs
    ).toEqual(
      expect.arrayContaining([
        'Weight Gain',
        'Sports Nutrition',
      ])
    );

    console.log(
      'PROG-007 DOWNLINE COACH EDIT VERIFIED'
    );

    // ==========================================================
    // RETURN TO OWN ENROLLMENT
    // ==========================================================

    await page
      .getByRole('button', {
        name:
          '← Back to My Enrollment',
        exact: true,
      })
      .click();

    // ==========================================================
    // 3. COACH EDITS DOWNLINE COACH MEMBER
    // ==========================================================

    await selectMember(
      DOWNLINE_MEMBER
    );

    await expect(
      page.getByText(
        'Targeted Nutrition',
        {
          exact: true,
        }
      )
    ).toBeVisible();

    await page
      .getByText(
        'Sports Nutrition',
        {
          exact: true,
        }
      )
      .click();

    const memberUpdate =
      page.getByRole('button', {
        name:
          /Update \(2 selected\)/,
      });

    await expect(
      memberUpdate
    ).toBeVisible({
      timeout: 10000,
    });

    await expect(
      memberUpdate
    ).toBeEnabled();

    await memberUpdate.click();

    await expect
      .poll(
        () => updates.length,
        {
          timeout: 10000,
        }
      )
      .toBe(3);

    expect(
      updates[2].userId
    ).toBe(
      DOWNLINE_MEMBER_ID
    );

    expect(
      updates[2].programs
    ).toEqual(
      expect.arrayContaining([
        'Targeted Nutrition',
        'Sports Nutrition',
      ])
    );

    console.log(
      'PROG-007 DOWNLINE COACH MEMBER EDIT VERIFIED'
    );

    // ==========================================================
    // FINAL ASSERTIONS
    // ==========================================================

    expect(
      updates
    ).toHaveLength(3);

    expect(
      updates.map(
        request => request.userId
      )
    ).toEqual([
      COACH_ID,
      DOWNLINE_COACH_ID,
      DOWNLINE_MEMBER_ID,
    ]);

    console.log(
      'PROG-007 ALL THREE PROGRAM EDITS VERIFIED'
    );
  }
);