/**
 * tests/fixtures/transformation-mock-data.js
 * Comprehensive mock data fixtures for Transformation (Testimonials) E2E tests.
 */

// 1. Master List of Health Conditions
const MOCK_KNOWN_HEALTH_ISSUES = [
  'Thyroid',
  'Diabetes',
  'PCOD / PCOS',
  'Cholesterol',
  'Hypertension',
  'Overweight',
  'Fatty Liver',
  'Joint Pain',
  'Digestive Issues',
  'Asthma',
];

// 2. Base test images (distinct URLs for Before and After)
const MOCK_BEFORE_IMAGE = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500';
const MOCK_AFTER_IMAGE = 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500';
const MOCK_BASE64_IMAGE =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

// 3. Current User Verified Testimonial (Clean initial state)
const MOCK_MEMBER_TESTIMONIAL_VERIFIED = {
  id: 501,
  userId: 99999,
  userName: 'Test Coach',
  status: 'verified',
  beforeImageUrl: MOCK_BEFORE_IMAGE,
  afterImageUrl: MOCK_AFTER_IMAGE,
  beforeWeightKg: 85.0,
  afterWeightKg: 70.0,
  durationText: '4 months',
  recoveredHealthIssues: ['Thyroid', 'Overweight'],
  approvedHealthIssues: ['Thyroid', 'Overweight'],
  healthVideoUrl: null,
  businessVideoUrl: null,
  videoStatus: 'not_uploaded',
  sponsorName: 'Master Coach',
  coachId: 10001,
  createdAt: '2026-01-15T10:00:00.000Z',
  updatedAt: '2026-02-20T10:00:00.000Z',
};

// 4. Testimonial in Pending State (Waiting for OTP)
const MOCK_MEMBER_TESTIMONIAL_PENDING = {
  id: 501,
  userId: 99999,
  userName: 'Test Coach',
  status: 'pending',
  beforeImageUrl: MOCK_BEFORE_IMAGE,
  afterImageUrl: MOCK_AFTER_IMAGE,
  beforeWeightKg: 85.0,
  afterWeightKg: 68.0,
  durationText: '5 months',
  recoveredHealthIssues: ['Thyroid', 'Overweight', 'Diabetes'],
  approvedHealthIssues: ['Thyroid', 'Overweight'],
  sponsorName: 'Master Coach',
  coachId: 10001,
  otpExpiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  otpValidityHours: 24,
  otpExpired: false,
};

// 5. Downline Team Members for Direct Team & Full Team Scopes
const MOCK_TEAM_MEMBERS_DIRECT = [
  {
    user: {
      userId: 801,
      userName: 'Priya Sharma',
      phoneNumber: '+919876543001',
      role: 'member',
      sponsorId: 99999,
      sponsorName: 'Test Coach',
      level: 1,
      profileImage: null,
    },
    testimonial: {
      id: 601,
      userId: 801,
      status: 'verified',
      beforeImageUrl: MOCK_BEFORE_IMAGE,
      afterImageUrl: MOCK_AFTER_IMAGE,
      beforeWeightKg: 78.0,
      afterWeightKg: 65.0,
      durationText: '3 months',
      recoveredHealthIssues: ['PCOD / PCOS', 'Overweight'],
      approvedHealthIssues: ['PCOD / PCOS', 'Overweight'],
      healthVideoUrl: 'https://example.com/videos/priya-health.mp4',
      businessVideoUrl: null,
      videoStatus: 'verified',
    },
    completeness: 'fully_uploaded',
  },
  {
    user: {
      userId: 802,
      userName: 'Karthik Raja',
      phoneNumber: '+919876543002',
      role: 'member',
      sponsorId: 99999,
      sponsorName: 'Test Coach',
      level: 1,
      profileImage: null,
    },
    testimonial: {
      id: 602,
      userId: 802,
      status: 'verified',
      beforeImageUrl: MOCK_BEFORE_IMAGE,
      afterImageUrl: null,
      beforeWeightKg: 92.0,
      afterWeightKg: null,
      durationText: null,
      recoveredHealthIssues: ['Diabetes Type 1', 'Cholesterol'],
      approvedHealthIssues: ['Diabetes Type 1'],
      healthVideoUrl: null,
      businessVideoUrl: null,
      videoStatus: 'not_uploaded',
    },
    completeness: 'partial',
  },
  {
    user: {
      userId: 803,
      userName: 'Ananya Verma',
      phoneNumber: '+919876543003',
      role: 'member',
      sponsorId: 99999,
      sponsorName: 'Test Coach',
      level: 1,
      profileImage: null,
    },
    testimonial: null,
    completeness: 'not_uploaded',
  },
];

const MOCK_TEAM_MEMBERS_FULL = [
  ...MOCK_TEAM_MEMBERS_DIRECT,
  {
    user: {
      userId: 901,
      userName: 'Suresh Kumar',
      phoneNumber: '+919876543004',
      role: 'member',
      sponsorId: 801,
      sponsorName: 'Priya Sharma',
      level: 2,
      profileImage: null,
    },
    testimonial: {
      id: 701,
      userId: 901,
      status: 'verified',
      beforeImageUrl: MOCK_BEFORE_IMAGE,
      afterImageUrl: MOCK_AFTER_IMAGE,
      beforeWeightKg: 88.0,
      afterWeightKg: 74.0,
      durationText: '6 months',
      recoveredHealthIssues: ['Hypertension'],
      approvedHealthIssues: ['Hypertension'],
      healthVideoUrl: 'https://example.com/videos/suresh-health.mp4',
      businessVideoUrl: null,
      videoStatus: 'verified',
    },
    completeness: 'fully_uploaded',
  },
];

async function mockAuthenticatedSession(page, options = {}) {
  const userId = options.userId || 99999;
  const userName = options.userName || 'Test Coach';
  const role = options.role || 'coach';
  const email = options.email || 'test@example.com';
  const phone = options.phone || '+917695834209';

  await page.route('**/api/user/verify-session*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        userId,
        sessionStale: false,
        user: { id: userId, UserId: userId, UserName: userName, phone, role, email },
      }),
    });
  });

  await page.route('**/api/user/lookup*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        isActive: true,
        role,
        userId,
      }),
    });
  });

  await page.route('**/api/user/preferences*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true }),
    });
  });

  await page.route('**/api/user/consent*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, consentRequired: false, consentAccepted: true }),
    });
  });

  await page.route('**/api/user/status*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        setupComplete: true,
        setupSkipped: true,
        hasTeamId: true,
        hasUpline: true,
        pendingRequest: false,
        redirectTo: null,
      }),
    });
  });

  await page.route('**/api/coach/setup-status*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, isSetupComplete: true }),
    });
  });

  await page.route('**/api/user/profile*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          userId,
          userName,
          email,
          phone,
          profileComplete: true,
          physicalActivityLevel: 'Moderate',
          gender: 'Male',
          height: 175,
          latestWeight: 75,
          currentWeight: 75,
          recoveredHealthIssues: ['Thyroid', 'Overweight'],
          profileImage: 'https://example.com/pic.jpg',
        },
      }),
    });
  });

  await page.route('**/api/user/context*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          userId,
          personalCorrections: [],
          globalPatterns: [],
          dietPreference: 'Vegetarian',
          recentMeals: [],
        },
      }),
    });
  });

  await page.route('**/api/testimonials/my-video*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: null }),
    });
  });

  await page.route('**/api/testimonials/prepare-video-upload*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        uploads: {
          health: { path: 'videos/health.mp4', sessionId: 'mock-sess-health' },
          business: { path: 'videos/business.mp4', sessionId: 'mock-sess-business' },
        },
      }),
    });
  });

  await page.route('**/api/testimonials/upload-video-chunk*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true }),
    });
  });

  await page.route('**/api/testimonials/resend-unified-otp*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        message: 'New OTP sent to Master Coach. Valid for 24 hours.',
        otpExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      }),
    });
  });

  await page.route('**/api/testimonials/known-health-issues', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, issues: MOCK_KNOWN_HEALTH_ISSUES }),
    });
  });
}

module.exports = {
  MOCK_KNOWN_HEALTH_ISSUES,
  MOCK_BASE64_IMAGE,
  MOCK_MEMBER_TESTIMONIAL_VERIFIED,
  MOCK_MEMBER_TESTIMONIAL_PENDING,
  MOCK_TEAM_MEMBERS_DIRECT,
  MOCK_TEAM_MEMBERS_FULL,
  mockAuthenticatedSession,
};

