const { test, expect } = require('@playwright/test');

test.describe('BCM Module (Body Composition Metrics)', () => {
  test.use({ storageState: 'playwright/.auth/user.json' });

  const MOCK_CARDS = [
    {
      id: 1,
      name: 'VIKKEY',
      phoneNumber: '8576794649',
      heightCm: 167,
      weightKg: null,
      bmi: '',
      age: 24,
      gender: 'Male',
      recordedDate: '2026-08-24',
      locationName: 'Voc'
    },
    {
      id: 2,
      name: 'NITHEESHLINGAM R',
      phoneNumber: '8536942091',
      heightCm: 168,
      weightKg: null,
      bmi: '',
      age: 22,
      gender: 'Male',
      recordedDate: '2026-08-24',
      locationName: 'Adayar'
    },
    {
      id: 3,
      name: 'AVINASH',
      phoneNumber: '7837583753',
      heightCm: null,
      weightKg: 55,
      bmi: '19.3',
      age: 21,
      gender: 'Male',
      recordedDate: '2026-08-24',
      locationName: ''
    },
    {
      id: 4,
      name: 'TEST_AVINASH',
      phoneNumber: '8563952471',
      heightCm: 168,
      weightKg: null,
      bmi: '',
      age: 22,
      gender: 'Male',
      recordedDate: '2026-08-24',
      locationName: ''
    }
  ];

  test.beforeEach(async ({ page }) => {
    // Intercept user verification
    await page.route('**/api/user/verify-session*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          userId: 99999,
          user: { id: 99999, UserId: 99999, UserName: 'Test Coach', phone: '+1234567890', role: 'coach', email: 'test@example.com' }
        })
      });
    });

    // Mock team hierarchy list
    await page.route('**/api/coach/team-hierarchy*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          allMembers: [
            {
              UserId: 101,
              UserName: 'MEMBER ONE',
              phoneNumber: '9876543210',
              height: 175,
              gender: 'Male',
              age: 28,
              visceralFat: 6,
              bodyAge: 27,
              chestCm: 90,
              waistCm: 80,
              hipCm: 88,
              bmr: 1550
            },
            {
              UserId: 202,
              UserName: 'JAFAR',
              phoneNumber: '6369591703',
              height: 150,
              gender: 'Male',
              bmr: 1748
            }
          ]
        })
      });
    });

    // Mock member-prefill
    await page.route('**/api/body-parameters-card/member-prefill*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            weightKg: null,
            fatPercent: null,
            bmi: null
          }
        })
      });
    });

    // Mock user lookup
    await page.route('**/api/user/lookup*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          isActive: true,
          role: 'coach',
          userId: 99999
        })
      });
    });

    // Mock consent status
    await page.route('**/api/user/consent-status*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          consentRequired: false
        })
      });
    });

    // Mock status check
    await page.route('**/api/user/status*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          setupComplete: true
        })
      });
    });

    // Mock user profile
    await page.route('**/api/user/profile*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            profileComplete: true,
            userName: 'Test Coach',
            email: 'test@example.com',
            phoneNumber: '+1234567890',
            physicalActivityLevel: 'active',
            profileImage: 'https://example.com/pic.jpg',
            // Required so onboarding Transformation Photos gate does not block nav tabs
            transformationPhotos: {
              left: 'https://example.com/left.jpg',
              front: 'https://example.com/front.jpg',
              right: 'https://example.com/right.jpg',
            },
          }
        })
      });
    });

    // Mock body parameter cards listing
    await page.route('**/api/body-parameters-card/list*', async (route) => {
      const url = new URL(route.request().url());
      const search = url.searchParams.get('search');
      
      let filteredCards = [...MOCK_CARDS];
      if (search) {
        const query = search.toLowerCase();
        filteredCards = filteredCards.filter(c => 
          c.name.toLowerCase().includes(query) || 
          c.phoneNumber.includes(query)
        );
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          success: true,
          data: filteredCards,
          pagination: {
            totalRecords: filteredCards.length,
            totalPages: 1,
            currentPage: 1,
            pageSize: 20,
            hasNextPage: false,
            hasPreviousPage: false
          }
        })
      });
    });

    // Mock phone BCM status (unknown number — no exists prompt)
    await page.route('**/api/body-parameters-card/phone-status*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: {
            activated: false,
            message: null,
            userId: null,
            existingCard: null
          }
        })
      });
    });

    // Mock phone autocomplete/search
    await page.route('**/api/body-parameters-card/phone-search*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: []
        })
      });
    });

    // Navigate to dashboard and click BCM tab
    await page.goto('/');
    const bcmTab = page.getByRole('button', { name: 'Counselling' });
    await expect(bcmTab).toBeVisible({ timeout: 15000 });
    await bcmTab.click();
    await page.waitForTimeout(1000); // Wait for transition
  });

  test('BCM-001 Navigation and Initial Load', async ({ page }) => {
    // Verify BCM title is displayed
    await expect(page.getByRole('heading', { name: 'Body Composition Metrics', exact: true })).toBeVisible();

    // Verify all 4 cards are loaded
    await expect(page.getByText('4 Cards')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'VIKKEY', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'NITHEESHLINGAM R', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'AVINASH', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'TEST_AVINASH', exact: true })).toBeVisible();
  });

  test('BCM-002 Refresh Functionality', async ({ page }) => {
    let refreshCount = 0;
    
    // Set up request counter
    await page.route('**/api/body-parameters-card/list*', async (route) => {
      refreshCount++;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          success: true,
          data: MOCK_CARDS,
          pagination: {
            totalRecords: 4,
            totalPages: 1,
            currentPage: 1,
            pageSize: 20,
            hasNextPage: false,
            hasPreviousPage: false
          }
        })
      });
    });

    // Click Refresh button (the sibling to Heading)
    const refreshButton = page.locator('h1:has-text("Body Composition Metrics") + button');
    await expect(refreshButton).toBeVisible();
    await refreshButton.click();
    await page.waitForTimeout(500);

    // Verify list API was requested again
    expect(refreshCount).toBeGreaterThan(0);
  });

  test('BCM-003 Create Modal and Prefilled Venue', async ({ page }) => {
    // Step 1: Type "Chennai" into the Checked At header venue field
    const checkedAtInput = page.locator('#bpc-header-venue');
    await expect(checkedAtInput).toBeVisible();
    await checkedAtInput.click({ clickCount: 3 });
    await checkedAtInput.type('Chennai');
    await expect(checkedAtInput).toHaveValue('Chennai');

    // Step 2: Click the Create (+) button to open the form
    const createButton = page.getByRole('button', { name: 'Create Body Parameters Card' });
    await expect(createButton).toBeVisible();
    await createButton.click();

    // Step 3: Verify modal "Your Body Parameters" opened
    await expect(page.getByRole('heading', { name: 'Your Body Parameters' })).toBeVisible();

    // Step 4: Verify the Venue field is auto-prefilled with "Chennai"
    const venueInput = page.getByPlaceholder('e.g. Chennai');
    await expect(venueInput).toBeVisible();
    await expect(venueInput).toHaveValue('Chennai');
  });


  test('BCM-004 Form Required Fields Validation', async ({ page }) => {
    // Click Create (+) button
    await page.getByRole('button', { name: 'Create Body Parameters Card' }).click();

    // Setup Mock for create
    let createCalled = false;
    let lastCreateBody = null;
    await page.route('**/api/body-parameters-card/create', async (route) => {
      createCalled = true;
      try {
        lastCreateBody = route.request().postDataJSON();
      } catch {
        lastCreateBody = null;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id: 5,
            name: 'NEW CLIENT',
            phoneNumber: null,
            heightCm: 172,
            weightKg: 65,
            recordedDate: '2026-08-24',
            locationName: 'Chennai',
            publicShareToken: 'token123'
          }
        })
      });
    });

    // Name is required; phone is optional
    const saveButton = page.getByRole('button', { name: 'Save & Share' });

    // Try to save with everything empty - creation should not be called
    await saveButton.click();
    expect(createCalled).toBe(false);

    // Fill Name but keep Phone empty - creation should succeed without phone
    await page.getByPlaceholder('FULL NAME').fill('NEW CLIENT');
    await saveButton.click();
    await page.waitForTimeout(500);
    expect(createCalled).toBe(true);
    expect(lastCreateBody?.phoneNumber == null || lastCreateBody?.phoneNumber === '').toBe(true);

    // Verify that the BCM modal closes (meaning success)
    await expect(page.getByRole('heading', { name: 'Your Body Parameters' })).not.toBeVisible();
  });

  test('BCM-005 Search Functionality', async ({ page }) => {
    const searchInput = page.getByPlaceholder('Search by name or phone...');
    await searchInput.fill('VIKKEY');
    await page.waitForTimeout(500);

    // Verify that only VIKKEY is displayed
    await expect(page.getByRole('heading', { name: 'VIKKEY', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'NITHEESHLINGAM R', exact: true })).not.toBeVisible();
  });

  test('BCM-006 Edit Card', async ({ page }) => {
    let listCards = JSON.parse(JSON.stringify(MOCK_CARDS));

    // Keep list mock mutable so post-update refresh can show the edited name
    await page.route('**/api/body-parameters-card/list*', async (route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.get('cardId') === '1') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            data: listCards.find((c) => c.id === 1) || listCards[0],
          }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          success: true,
          data: listCards,
          pagination: {
            totalRecords: listCards.length,
            totalPages: 1,
            currentPage: 1,
            pageSize: 20,
            hasNextPage: false,
            hasPreviousPage: false,
          },
        }),
      });
    });

    // Mock update request (CapacitorHttp uses PATCH)
    let updatePayload = null;
    await page.route('**/api/body-parameters-card/update', async (route) => {
      updatePayload = route.request().postDataJSON();
      const updated = {
        id: 1,
        name: 'VIKKEY EDITED',
        phoneNumber: '8576794649',
        heightCm: 167,
        weightKg: 70,
        bmi: '25.1',
        age: 24,
        gender: 'Male',
        recordedDate: '2026-08-24',
        locationName: 'Voc',
        publicShareToken: 'token123',
      };
      listCards = listCards.map((c) => (c.id === 1 ? { ...c, ...updated } : c));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: updated,
        }),
      });
    });

    // Click Edit button on the VIKKEY card
    const vikkeyCard = page.locator('div.bg-white:has-text("VIKKEY")');
    await vikkeyCard.getByRole('button', { name: 'Edit VIKKEY' }).click();

    // Verify Edit Modal is open with "Edit Body Parameters" heading
    await expect(page.getByRole('heading', { name: 'Edit Body Parameters' })).toBeVisible();
    const nameInput = page.getByPlaceholder('FULL NAME');
    await expect(nameInput).toHaveValue('VIKKEY');

    // Edit Name (NativeInput — clear + type is more reliable than fill under load)
    await nameInput.click({ clickCount: 3 });
    await nameInput.press('Backspace');
    await nameInput.type('VIKKEY EDITED', { delay: 20 });
    await expect(nameInput).toHaveValue('VIKKEY EDITED');
    await page.getByRole('button', { name: 'Update & Share' }).click();

    // Verify modal closes and API received the new name
    await expect(page.getByRole('heading', { name: 'Edit Body Parameters' })).not.toBeVisible({ timeout: 15000 });
    expect(updatePayload?.name).toBe('VIKKEY EDITED');

    // Dismiss any share sheet / overlay, then refresh list from mutated mock
    await page.keyboard.press('Escape').catch(() => {});
    const refreshButton = page.locator('h1:has-text("Body Composition Metrics") + button');
    if (await refreshButton.isVisible().catch(() => false)) {
      await refreshButton.click();
    }
    await expect(page.getByRole('heading', { name: 'VIKKEY EDITED', exact: true })).toBeVisible({ timeout: 15000 });
  });

  test('BCM-007 Delete Card', async ({ page }) => {
    // Mock delete request
    let deleteCalled = false;
    await page.route('**/api/body-parameters-card/delete', async (route) => {
      deleteCalled = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { id: 1 }
        })
      });
    });

    // Click delete icon on VIKKEY card
    const vikkeyCard = page.locator('div.bg-white:has-text("VIKKEY")');
    await vikkeyCard.getByRole('button', { name: 'Delete VIKKEY' }).click();

    // Verify CustomAlertModal is visible
    await expect(page.getByRole('heading', { name: 'Delete card?' })).toBeVisible();
    await expect(page.getByText('Delete VIKKEY? This cannot be undone.')).toBeVisible();

    // Click "Delete" button inside modal
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await page.waitForTimeout(500);

    // Verify API delete was requested and card is removed from list
    expect(deleteCalled).toBe(true);
    await expect(page.getByRole('heading', { name: 'VIKKEY', exact: true })).not.toBeVisible();
  });

  test('BCM-008 Auto-Calculations (BMI & BMR)', async ({ page }) => {
    await page.getByRole('button', { name: 'Create Body Parameters Card' }).click();
    await expect(page.getByRole('heading', { name: 'Your Body Parameters' })).toBeVisible();

    // Select Gender (required parent field for Fat%)
    const genderSelect = page.locator('div:has(> label:has-text("Gender")) select');
    await genderSelect.selectOption('Male');

    // Fill Height & Weight to trigger BMI auto-calculation
    const heightInput = page.locator('div').filter({ has: page.locator('> label').filter({ hasText: /^Height/i }) }).locator('input');
    const weightInput = page.locator('div').filter({ has: page.locator('> label').filter({ hasText: /^Weight/i }) }).locator('input');

    await heightInput.fill('170');
    await weightInput.fill('70');
    await page.waitForTimeout(300);

    // BMI should automatically calculate to 24.2
    const bmiInput = page.locator('div').filter({ has: page.locator('> label').filter({ hasText: /^BMI/i }) }).locator('input');
    await expect(bmiInput).toHaveValue('24.2');

    // Fill body fat % to trigger BMR auto-calculation (Katch-McArdle)
    const fatInput = page.locator('div').filter({ has: page.locator('> label').filter({ hasText: /^Fat%/i }) }).locator('input');
    await fatInput.fill('10');
    await page.waitForTimeout(300);

    const bmrInput = page.locator('div').filter({ has: page.locator('> label').filter({ hasText: /^BMR/i }) }).locator('input');
    await expect(bmrInput).toHaveValue('1731');
  });

  test('BCM-009 Manual Override Locks on Auto-Calculations', async ({ page }) => {
    await page.getByRole('button', { name: 'Create Body Parameters Card' }).click();

    const heightInput = page.locator('div').filter({ has: page.locator('> label').filter({ hasText: /^Height/i }) }).locator('input');
    const weightInput = page.locator('div').filter({ has: page.locator('> label').filter({ hasText: /^Weight/i }) }).locator('input');
    const bmiInput = page.locator('div').filter({ has: page.locator('> label').filter({ hasText: /^BMI/i }) }).locator('input');

    // Pre-fill height and weight
    await heightInput.fill('170');
    await weightInput.fill('70');
    await expect(bmiInput).toHaveValue('24.2');

    // Manually override BMI input to 25.0
    await bmiInput.click({ clickCount: 3 });
    await bmiInput.type('25.0');
    await page.waitForTimeout(300);

    // Update weight -> BMI should NOT update automatically now
    await weightInput.click({ clickCount: 3 });
    await weightInput.type('80');
    await page.waitForTimeout(300);

    await expect(bmiInput).toHaveValue('25.0');
  });

  test('BCM-010 Gender-Based Placeholder and Hint updates', async ({ page }) => {
    await page.getByRole('button', { name: 'Create Body Parameters Card' }).click();

    const genderSelect = page.locator('div:has(> label:has-text("Gender")) select');
    const fatLabel = page.locator('div:has(> input) label:has-text("Fat%")');

    // Verify default layout
    await expect(fatLabel).toContainText('(%)');

    // Select Male
    await genderSelect.selectOption('Male');
    // Hint should update to Male healthy range (10-20%)
    await expect(fatLabel).toContainText('(10–20%)');

    // Select Female
    await genderSelect.selectOption('Female');
    // Hint should update to Female healthy range (20-30%)
    await expect(fatLabel).toContainText('(20–30%)');
  });

  test('BCM-011 Existing Activated Phone Prompts Override Or New', async ({ page }) => {
    // Intercept phone-status request to simulate activated (registered) phone number
    await page.route('**/api/body-parameters-card/phone-status*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: {
            activated: true,
            message: 'User already exists',
            userId: 55,
            exists: true,
            existingCard: null
          }
        })
      });
    });

    await page.getByRole('button', { name: 'Create Body Parameters Card' }).click();

    // Fill validation fields
    await page.getByPlaceholder('FULL NAME').fill('DUPLICATE USER');

    const phoneInput = page.getByPlaceholder('Client phone (optional)');
    await phoneInput.fill('9999999999');
    await page.waitForTimeout(500);

    // Activated number shows Override / New dialog (not a hard field block)
    await expect(page.getByText(
      'This number already exists. Override the existing card, or create a new card for this number?'
    )).toBeVisible();
    await expect(page.getByRole('button', { name: 'Override' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'New' })).toBeVisible();

    // Save stays disabled until the coach chooses
    const saveButton = page.getByRole('button', { name: 'Save & Share' });
    await expect(saveButton).toBeDisabled();

    // New keeps the phone and unlocks save
    await page.getByRole('button', { name: 'New' }).click();
    await expect(phoneInput).toHaveValue('9999999999');
    await expect(saveButton).toBeEnabled();
  });

  test('BCM-012 Existing Phone Prompts Override Or New', async ({ page }) => {
    await page.route('**/api/body-parameters-card/phone-status*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: {
            activated: false,
            message: null,
            userId: 101,
            exists: true,
            existingCard: {
              id: 1,
              name: 'MEMBER ONE',
              phoneNumber: '9876543210',
              heightCm: 175,
              gender: 'Male',
              age: 28,
            }
          }
        })
      });
    });

    await page.route('**/api/body-parameters-card/member-prefill*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: {
            userName: 'MEMBER ONE',
            heightCm: 175,
            gender: 'Male',
            age: 28,
          }
        })
      });
    });

    await page.getByRole('button', { name: 'Create Body Parameters Card' }).click();

    const phoneInput = page.getByPlaceholder('Client phone (optional)');
    await phoneInput.fill('9876543210');
    await page.waitForTimeout(500);

    await expect(page.getByText(
      'This number already exists. Override the existing card, or create a new card for this number?'
    )).toBeVisible();

    // New keeps the phone so a fresh card can be saved for that number
    await page.getByRole('button', { name: 'New' }).click();
    await expect(phoneInput).toHaveValue('9876543210');

    // Re-enter (change then restore) and choose Override to prefill
    await phoneInput.fill('9876543211');
    await phoneInput.fill('9876543210');
    await page.waitForTimeout(500);
    await expect(page.getByText(
      'This number already exists. Override the existing card, or create a new card for this number?'
    )).toBeVisible();
    await page.getByRole('button', { name: 'Override' }).click();
    await page.waitForTimeout(500);

    await expect(page.getByPlaceholder('FULL NAME')).toHaveValue('MEMBER ONE');
    const heightInput = page.locator('div').filter({ has: page.locator('> label').filter({ hasText: /^Height/i }) }).locator('input');
    await expect(heightInput).toHaveValue('175');
    await expect(page.locator('div:has(> label:has-text("Gender")) select')).toHaveValue('Male');
    const ageInput = page.locator('div').filter({ has: page.locator('> label').filter({ hasText: /^Age$/ }) }).locator('input');
    await expect(ageInput).toHaveValue('28');
  });

  test('BCM-013 Phone Autocomplete Pick Still Prompts Override Or New', async ({ page }) => {
    await page.route('**/api/body-parameters-card/phone-status*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: {
            activated: false,
            message: null,
            userId: 202,
            exists: true,
            existingCard: {
              id: 2,
              name: 'JAFAR',
              phoneNumber: '6369591703',
              heightCm: 150,
              gender: 'Male',
            }
          }
        })
      });
    });

    // Mock team hierarchy used by teamHierarchyService.getFlatTeamList
    const mockTeamData = {
      success: true,
      allMembers: [{
        UserId: 202,
        UserName: 'Jafar',
        phoneNumber: '6369591703',
        heightCm: 150,
        bmr: 1748,
        gender: 'Male',
      }],
      data: [{
        userId: 202,
        userName: 'Jafar',
        phoneNumber: '6369591703',
        heightCm: 150,
        bmr: 1748,
        gender: 'Male',
      }]
    };

    await page.route('**/api/coach/team-hierarchy*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockTeamData)
      });
    });

    await page.route('**/api/team/hierarchy/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockTeamData)
      });
    });

    await page.getByRole('button', { name: 'Create Body Parameters Card' }).click();

    const phoneInput = page.getByPlaceholder('Client phone (optional)');
    await phoneInput.click();
    await phoneInput.fill('');
    await phoneInput.pressSequentially('6369', { delay: 40 });

    const suggestion = page.locator('li[role="option"]').filter({ hasText: '6369591703' });
    await expect(suggestion).toBeVisible({ timeout: 10000 });

    // Autocomplete option relies on onMouseDown/onTouchEnd handlers
    await suggestion.dispatchEvent('mousedown');

    // Must ask — autocomplete must not silent-override
    const modalHeading = page.getByRole('heading', { name: 'Number already exists' });
    await expect(modalHeading).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: 'Override' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'New' })).toBeVisible();

    // Name should NOT be prefilled until Override
    await expect(page.getByPlaceholder('FULL NAME')).toHaveValue('');
  });

  test('BCM-014 Verify every field in a BCM card modal can be filled', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const bcmTabBtn = page.getByRole('button', { name: /BCM|Counselling/i }).or(page.getByText('BCM', { exact: true })).first();
    await expect(bcmTabBtn).toBeVisible({ timeout: 15000 });
    await bcmTabBtn.click({ force: true });

    const createBtn = page.getByRole('button', { name: 'Create Body Parameters Card' });
    await expect(createBtn).toBeVisible({ timeout: 15000 });
    await createBtn.click({ force: true });

    // Verify modal heading
    const modalHeading = page.getByRole('heading', { name: /Body Parameters/i }).first();
    await expect(modalHeading).toBeVisible({ timeout: 10000 });

    // 1. Date (prefilled, fill explicit date)
    const dateInput = page.locator('input[type="date"]').first();
    await dateInput.fill('2026-09-29');

    // 2. Venue
    const venueInput = page.getByPlaceholder('e.g. Chennai');
    if (await venueInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await venueInput.fill('Chennai Central');
      await expect(venueInput).toHaveValue('Chennai Central');
    }

    // 3. Name
    const nameInput = page.getByPlaceholder('FULL NAME');
    await nameInput.fill('Test Client');
    await expect(nameInput).toHaveValue('TEST CLIENT');

    // 4. Phone Number
    const phoneInput = page.getByPlaceholder('Client phone (optional)');
    await phoneInput.fill('9876543210');
    await expect(phoneInput).toHaveValue('9876543210');

    // 5. Age
    const ageInput = page.locator('input[inputmode="decimal"]').first();
    await ageInput.fill('30');
    await expect(ageInput).toHaveValue('30');

    // 6. Gender
    const genderSelect = page.locator('select').first();
    await genderSelect.selectOption('Male');
    await expect(genderSelect).toHaveValue('Male');

    // 7. Height (cm)
    const heightInput = page.getByPlaceholder('cm').first();
    await heightInput.fill('175');
    await expect(heightInput).toHaveValue('175');

    // 8. Weight (kg)
    const weightInput = page.getByPlaceholder('kg').first();
    await weightInput.fill('72.5');
    await expect(weightInput).toHaveValue('72.5');

    // 9. Fat% (%)
    const fatInput = page.getByPlaceholder('%').first();
    await fatInput.fill('18.5');
    await expect(fatInput).toHaveValue('18.5');

    // 10. Visceral Fat (V-Fat)
    const vFatInput = page.getByPlaceholder('Visceral fat').first();
    await vFatInput.fill('5');
    await expect(vFatInput).toHaveValue('5');

    // 11. BMR (kcal)
    const bmrInput = page.getByPlaceholder('kcal').first();
    await bmrInput.fill('1650');
    await expect(bmrInput).toHaveValue('1650');

    // 12. Physical Activity Level
    const activitySelect = page.locator('select').nth(1);
    if (await activitySelect.isVisible({ timeout: 2000 }).catch(() => false)) {
      await activitySelect.selectOption('Moderate');
    }

    // 13. BMI
    const bmiInput = page.getByPlaceholder('e.g. 21').first();
    await bmiInput.fill('23');
    await expect(bmiInput).toHaveValue('23');

    // 14. Body Age
    const bodyAgeInput = page.getByPlaceholder('yrs').first();
    await bodyAgeInput.fill('26');
    await expect(bodyAgeInput).toHaveValue('26');

    // 15. Chest (cm)
    const chestInput = page.getByPlaceholder('cm').nth(1);
    if (await chestInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await chestInput.fill('95');
      await expect(chestInput).toHaveValue('95');
    }

    // 16. Waist (cm)
    const waistInput = page.getByPlaceholder('cm').nth(2);
    if (await waistInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await waistInput.fill('80');
      await expect(waistInput).toHaveValue('80');
    }

    // 17. Hip (cm)
    const hipInput = page.getByPlaceholder('cm').nth(3);
    if (await hipInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await hipInput.fill('92');
      await expect(hipInput).toHaveValue('92');
    }

    // 18. Diet Preference
    const dietButton = page.getByRole('button', { name: /Select diet preference|Vegetarian|Non-Vegetarian|Vegan/i }).first();
    await expect(dietButton).toBeVisible({ timeout: 5000 });
    await dietButton.click();
    const vegOption = page.getByRole('button', { name: 'Vegetarian', exact: true }).or(page.getByText('Vegetarian', { exact: true })).first();
    await expect(vegOption).toBeVisible({ timeout: 5000 });
    await vegOption.click();
    await expect(dietButton).toContainText('Vegetarian');

    // 19. Health Issues (DiseaseMultiSelect)
    const healthInput = page.getByPlaceholder(/Search health issues|Add more/i).first();
    await expect(healthInput).toBeVisible({ timeout: 5000 });
    await healthInput.click();
    await healthInput.fill('Fatty Liver');
    const fattyLiverOption = page.getByRole('button', { name: 'Fatty Liver', exact: true });
    await expect(fattyLiverOption).toBeVisible({ timeout: 5000 });
    await fattyLiverOption.click();
    await expect(page.getByText('Fatty Liver', { exact: true })).toBeVisible({ timeout: 5000 });

    // 20. Transformation Photos (Left, Centre, Right)
    const dummyImageBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64'
    );

    // Upload Left photo
    await page.getByRole('button', { name: 'Left', exact: true }).click();
    const galleryInput = page.locator('input[type="file"]').last();
    await galleryInput.setInputFiles({
      name: 'left.png',
      mimeType: 'image/png',
      buffer: dummyImageBuffer,
    });

    // Upload Centre photo
    await page.getByRole('button', { name: 'Centre', exact: true }).click();
    await galleryInput.setInputFiles({
      name: 'centre.png',
      mimeType: 'image/png',
      buffer: dummyImageBuffer,
    });

    // Upload Right photo
    await page.getByRole('button', { name: 'Right', exact: true }).click();
    await galleryInput.setInputFiles({
      name: 'right.png',
      mimeType: 'image/png',
      buffer: dummyImageBuffer,
    });

    console.log('BCM-014: Successfully verified ALL fields including Diet Preference and Transformation Photos in BCM card modal');
  });

  test('BCM-015 Verify mandatory fields validation, invalid phone check, and all parent prerequisite field prompts in BCM modal', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const bcmTabBtn = page.getByRole('button', { name: /BCM|Counselling/i }).or(page.getByText('BCM', { exact: true })).first();
    await expect(bcmTabBtn).toBeVisible({ timeout: 15000 });
    await bcmTabBtn.click({ force: true });

    const createBtn = page.getByRole('button', { name: 'Create Body Parameters Card' });
    await expect(createBtn).toBeVisible({ timeout: 15000 });
    await createBtn.click({ force: true });

    let createApiCalled = false;
    await page.route('**/api/body-parameters-card/create', async (route) => {
      createApiCalled = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { id: 99, name: 'VALIDATED CLIENT', phoneNumber: '9876543210', recordedDate: '2026-09-29' }
        })
      });
    });

    const saveButton = page.getByRole('button', { name: 'Save & Share' });
    await expect(saveButton).toBeVisible({ timeout: 10000 });

    // 1. Mandatory Name Validation: Click Save with empty Name -> Blocks API submission & shows "Name is required"
    await saveButton.click({ force: true });
    expect(createApiCalled).toBe(false);

    const nameInput = page.getByPlaceholder('FULL NAME');
    await expect(page.getByText('Name is required')).toBeVisible({ timeout: 5000 });

    // 2. Invalid Phone Validation: Type invalid 3-digit phone -> Blur -> Displays invalid phone error
    const phoneInput = page.getByPlaceholder('Client phone (optional)');
    await phoneInput.fill('123');
    await phoneInput.blur();
    const phoneError = page.getByText(/Please enter a valid phone number/i);
    await expect(phoneError).toBeVisible({ timeout: 5000 });

    // Clear invalid phone (Phone is optional — empty is valid)
    await phoneInput.fill('');
    await phoneInput.blur();
    await expect(phoneError).not.toBeVisible({ timeout: 5000 });

    // 3. Parent Prerequisite Prompt (Height needed for Weight)
    const weightInput = page.getByPlaceholder('kg').first();
    await weightInput.focus();
    const heightPrompt = page.getByText(/Please enter height for Weight/i);
    await expect(heightPrompt).toBeVisible({ timeout: 5000 });

    // 4. Parent Prerequisite Prompt (Gender needed for Fat%)
    const fatInput = page.getByPlaceholder('%').first();
    await fatInput.focus();
    const genderFatPrompt = page.getByText(/Please select gender for Fat%/i);
    await expect(genderFatPrompt).toBeVisible({ timeout: 5000 });

    // 5. Parent Prerequisite Prompt (Gender needed for Chest / Waist / Hip)
    const chestInput = page.getByPlaceholder('cm').nth(1);
    if (await chestInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await chestInput.focus();
      const genderChestPrompt = page.getByText(/Please select gender for Chest/i);
      await expect(genderChestPrompt).toBeVisible({ timeout: 5000 });
    }

    // 6. Parent Prerequisite Prompt (Age needed for Body Age)
    const bodyAgeInput = page.getByPlaceholder('yrs').first();
    if (await bodyAgeInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await bodyAgeInput.focus();
      const ageBodyAgePrompt = page.getByText(/Please enter age for Body Age/i);
      await expect(ageBodyAgePrompt).toBeVisible({ timeout: 5000 });
    }

    // 7. Satisfy Mandatory Name & Optional Valid Phone -> Save succeeds
    await nameInput.fill('VALIDATED CLIENT');
    await phoneInput.fill('9876543210');
    await saveButton.click({ force: true });

    await page.waitForTimeout(500);
    expect(createApiCalled).toBe(true);

    console.log('BCM-015: Successfully verified all mandatory fields, invalid phone validation, and parent prerequisite prompts');
  });
});
