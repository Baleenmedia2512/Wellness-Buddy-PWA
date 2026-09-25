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

    // Mock phone BCM status
    await page.route('**/api/body-parameters-card/phone-status*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: {
            activated: false,
            message: null,
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
    await page.route('**/api/body-parameters-card/create', async (route) => {
      createCalled = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id: 5,
            name: 'NEW CLIENT',
            phoneNumber: '9876543210',
            heightCm: 172,
            weightKg: 65,
            recordedDate: '2026-08-24',
            locationName: 'Chennai',
            publicShareToken: 'token123'
          }
        })
      });
    });

    // Verify form requirements: Save & Share does not submit when name/phone are invalid or empty
    const saveButton = page.getByRole('button', { name: 'Save & Share' });

    // Try to save with everything empty - creation should not be called
    await saveButton.click();
    expect(createCalled).toBe(false);

    // Fill Name but keep Phone empty - creation should still not be called
    await page.getByPlaceholder('FULL NAME').fill('NEW CLIENT');
    await saveButton.click();
    expect(createCalled).toBe(false);

    // Fill Phone
    await page.getByPlaceholder('Client phone — creates team member').fill('9876543210');

    // Now it should save successfully
    await saveButton.click();
    await page.waitForTimeout(500);

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

  test('BCM-011 Duplicate Phone Duplication Protection', async ({ page }) => {
    // Intercept phone-status request to simulate duplicate registered phone number
    await page.route('**/api/body-parameters-card/phone-status*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          data: {
            activated: true,
            message: 'User already exists',
            existingCard: null
          }
        })
      });
    });

    await page.getByRole('button', { name: 'Create Body Parameters Card' }).click();

    // Fill validation fields
    await page.getByPlaceholder('FULL NAME').fill('DUPLICATE USER');

    const phoneInput = page.getByPlaceholder('Client phone — creates team member');
    await phoneInput.fill('9999999999');
    await page.waitForTimeout(500);

    // Verify duplicate error displays
    await expect(page.getByText('User already exists')).toBeVisible();

    // Save button must remain disabled
    const saveButton = page.getByRole('button', { name: 'Save & Share' });
    await expect(saveButton).toBeDisabled();
  });

  test('BCM-012 Exact Phone Match Autocomplete Auto-Prefill', async ({ page }) => {
    await page.getByRole('button', { name: 'Create Body Parameters Card' }).click();

    // Enter matching phone number of MEMBER ONE
    const phoneInput = page.getByPlaceholder('Client phone — creates team member');
    await phoneInput.fill('9876543210');
    await page.waitForTimeout(500);

    // Exact match triggers fillFromMember automatically -> Name, Height, Gender, Age, and calculated BMI should be auto-filled
    await expect(page.getByPlaceholder('FULL NAME')).toHaveValue('MEMBER ONE');
    
    // Height input specifically inside the Height label div
    const heightInput = page.locator('div').filter({ has: page.locator('> label').filter({ hasText: /^Height/i }) }).locator('input');
    await expect(heightInput).toHaveValue('175');
    await expect(page.locator('div:has(> label:has-text("Gender")) select')).toHaveValue('Male');
    
    const ageInput = page.locator('div').filter({ has: page.locator('> label').filter({ hasText: /^Age$/ }) }).locator('input');
    await expect(ageInput).toHaveValue('28');
  });

  test('BCM-013 Share Sheet Trigger on Card Save', async ({ page }) => {
    await page.getByRole('button', { name: 'Create Body Parameters Card' }).click();

    const populatedCard = {
      id: 101,
      name: 'SHARE CLIENT',
      phoneNumber: '9876543210',
      heightCm: 170,
      weightKg: 68,
      recordedDate: '2026-08-24',
      publicShareToken: 'sharetoken123',
    };

    await page.route('**/api/body-parameters-card/create', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: populatedCard,
        }),
      });
    });

    await page.getByPlaceholder('FULL NAME').fill('SHARE CLIENT');
    await page.getByPlaceholder('Client phone — creates team member').fill('9876543210');

    const saveButton = page.getByRole('button', { name: 'Save & Share' });
    await expect(saveButton).toBeEnabled();
    await saveButton.click();

    // Form modal closes on successful save
    await expect(page.getByRole('heading', { name: 'Your Body Parameters' })).not.toBeVisible({ timeout: 10000 });
  });

  test('BCM-014 Phone Contact Actions Clickability', async ({ page }) => {
    const mockPopulatedCard = {
      id: 201,
      name: 'CONTACT CLIENT',
      phoneNumber: '9876543210',
      heightCm: 170,
      weightKg: 70,
      bmi: '24.2',
      age: 28,
      gender: 'Male',
      recordedDate: '2026-08-24',
    };

    await page.route('**/api/body-parameters-card/list*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          success: true,
          data: [mockPopulatedCard],
          pagination: { totalRecords: 1, totalPages: 1, currentPage: 1, pageSize: 20 },
        }),
      });
    });

    const refreshBtn = page.locator('h1:has-text("Body Composition Metrics") + button');
    await refreshBtn.click();

    const clientCard = page.locator('div.bg-white:has-text("CONTACT CLIENT")').first();
    await expect(clientCard).toBeVisible({ timeout: 10000 });

    // Click Call button inside PhoneContactActions
    const callButton = clientCard.locator('button[aria-label*="Call"]').first();
    await expect(callButton).toBeVisible();
    await callButton.click();

    // Verify edit modal is NOT opened by clicking phone contact button
    await expect(page.getByRole('heading', { name: 'Edit Body Parameters' })).not.toBeVisible();
  });

  test('BCM-015 Search Suggestions Filter', async ({ page }) => {
    const mockTenClients = Array.from({ length: 10 }, (_, i) => ({
      id: 301 + i,
      name: `Mock Client ${i + 1}`,
      phoneNumber: `987654320${i}`,
      heightCm: 165 + i,
      weightKg: 60 + i,
      bmi: '22.0',
      age: 25 + i,
      gender: i % 2 === 0 ? 'Male' : 'Female',
      recordedDate: '2026-08-24',
    }));

    await page.route('**/api/body-parameters-card/list*', async (route) => {
      const url = new URL(route.request().url());
      const search = url.searchParams.get('search');
      let filtered = [...mockTenClients];
      if (search) {
        const query = search.toLowerCase();
        filtered = filtered.filter((c) => c.name.toLowerCase().includes(query) || c.phoneNumber.includes(query));
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          success: true,
          data: filtered,
          pagination: { totalRecords: filtered.length, totalPages: 1, currentPage: 1, pageSize: 20 },
        }),
      });
    });

    const searchInput = page.getByPlaceholder('Search by name or phone...');
    await searchInput.fill('Client 5');
    await page.waitForTimeout(300);

    // Verify search value is filled and matching card is visible
    await expect(searchInput).toHaveValue('Client 5');
    await expect(page.getByRole('heading', { name: 'Mock Client 5', exact: true })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('heading', { name: 'Mock Client 1', exact: true })).not.toBeVisible();
  });

  test('BCM-016 Extended Body Metrics Inputs (V-Fat, Body Age, Chest, Waist, Hip)', async ({ page }) => {
    await page.getByRole('button', { name: 'Create Body Parameters Card' }).click();
    await expect(page.getByRole('heading', { name: 'Your Body Parameters' })).toBeVisible();

    // Fill parent fields Gender & Age first so dependent metric inputs are unlocked
    await page.locator('div:has(> label:has-text("Gender")) select').selectOption('Male');
    const ageInput = page.locator('div').filter({ has: page.locator('> label').filter({ hasText: /^Age$/ }) }).locator('input');
    await ageInput.fill('28');

    // Fill V-Fat
    const vFatInput = page.getByPlaceholder('Visceral fat');
    await vFatInput.fill('5');
    await expect(vFatInput).toHaveValue('5');

    // Fill Body Age
    const bodyAgeInput = page.getByPlaceholder('yrs');
    await bodyAgeInput.fill('25');
    await expect(bodyAgeInput).toHaveValue('25');

    // Fill Chest, Waist, Hip (placeholder="cm")
    const cmInputs = page.locator('input[placeholder="cm"]');
    if (await cmInputs.count() >= 3) {
      const chestInput = cmInputs.nth(0);
      const waistInput = cmInputs.nth(1);
      const hipInput = cmInputs.nth(2);

      await chestInput.fill('95');
      await waistInput.fill('82');
      await hipInput.fill('90');

      await expect(chestInput).toHaveValue('95');
      await expect(waistInput).toHaveValue('82');
      await expect(hipInput).toHaveValue('90');
    }
  });

  test('BCM-017 Ideal Weight Range Auto-Calculation', async ({ page }) => {
    await page.getByRole('button', { name: 'Create Body Parameters Card' }).click();

    // Fill height to 170cm
    const heightInput = page.locator('div').filter({ has: page.locator('> label').filter({ hasText: /^Height/i }) }).locator('input');
    await heightInput.fill('170');
    await page.waitForTimeout(300);

    // Label should update to include ideal weight range calculation
    const weightLabel = page.locator('label').filter({ hasText: /Weight \(Ideal:/i });
    await expect(weightLabel).toBeVisible({ timeout: 5000 });
  });

  test('BCM-018 Card Tile Click to Edit', async ({ page }) => {
    const mockEditCard = {
      id: 401,
      name: 'EDITABLE CLIENT',
      phoneNumber: '9876543219',
      heightCm: 175,
      weightKg: 75,
      bmi: '24.5',
      age: 30,
      gender: 'Male',
      recordedDate: '2026-08-24',
    };

    await page.route('**/api/body-parameters-card/list*', async (route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.get('cardId') === '401') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true, data: mockEditCard }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          success: true,
          data: [mockEditCard],
          pagination: { totalRecords: 1, totalPages: 1, currentPage: 1, pageSize: 20 },
        }),
      });
    });

    const refreshBtn = page.locator('h1:has-text("Body Composition Metrics") + button');
    await refreshBtn.click();

    // Click card tile for EDITABLE CLIENT
    const clientCard = page.locator('div.bg-white:has-text("EDITABLE CLIENT")').first();
    await expect(clientCard).toBeVisible({ timeout: 10000 });
    await clientCard.click();

    // Verify Edit Body Parameters modal opens prefilled with EDITABLE CLIENT
    await expect(page.getByRole('heading', { name: 'Edit Body Parameters' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByPlaceholder('FULL NAME')).toHaveValue('EDITABLE CLIENT');
  });
});
