import {
  ADMIN_CONFIG_TABS,
  resolveAdminConfigTab,
  adminConfigTabFromNavigateTarget,
} from '../domain/adminConfigSetupTabs';

describe('resolveAdminConfigTab', () => {
  it('uses wellness score when requested and enabled', () => {
    expect(resolveAdminConfigTab(ADMIN_CONFIG_TABS.WELLNESS_SCORE, {
      wellnessScoreEnabled: true,
      aiCreditsEnabled: true,
      navPageAccessEnabled: true,
    })).toBe(ADMIN_CONFIG_TABS.WELLNESS_SCORE);
  });

  it('falls back when wellness flag is off', () => {
    expect(resolveAdminConfigTab(ADMIN_CONFIG_TABS.WELLNESS_SCORE, {
      wellnessScoreEnabled: false,
      aiCreditsEnabled: true,
      navPageAccessEnabled: true,
    })).toBe(ADMIN_CONFIG_TABS.AI_CONFIG);
  });

  it('honours AI deep-link when enabled', () => {
    expect(resolveAdminConfigTab(ADMIN_CONFIG_TABS.AI_CONFIG, {
      wellnessScoreEnabled: true,
      aiCreditsEnabled: true,
      navPageAccessEnabled: true,
    })).toBe(ADMIN_CONFIG_TABS.AI_CONFIG);
  });

  it('honours page-access deep-link when enabled', () => {
    expect(resolveAdminConfigTab(ADMIN_CONFIG_TABS.PAGE_ACCESS, {
      wellnessScoreEnabled: true,
      aiCreditsEnabled: true,
      navPageAccessEnabled: true,
    })).toBe(ADMIN_CONFIG_TABS.PAGE_ACCESS);
  });

  it('falls back to page access when wellness and AI are off', () => {
    expect(resolveAdminConfigTab(ADMIN_CONFIG_TABS.WELLNESS_SCORE, {
      wellnessScoreEnabled: false,
      aiCreditsEnabled: false,
      navPageAccessEnabled: true,
    })).toBe(ADMIN_CONFIG_TABS.PAGE_ACCESS);
  });

  it('always allows activity time', () => {
    expect(resolveAdminConfigTab(ADMIN_CONFIG_TABS.ACTIVITY_TIME, {
      wellnessScoreEnabled: false,
      aiCreditsEnabled: false,
      navPageAccessEnabled: false,
    })).toBe(ADMIN_CONFIG_TABS.ACTIVITY_TIME);
  });

  it('always allows mandatory profile fields for an admin deep link', () => {
    expect(resolveAdminConfigTab(ADMIN_CONFIG_TABS.MANDATORY_FIELDS, {
      wellnessScoreEnabled: false,
      aiCreditsEnabled: false,
      navPageAccessEnabled: false,
    })).toBe(ADMIN_CONFIG_TABS.MANDATORY_FIELDS);
  });
});

describe('adminConfigTabFromNavigateTarget', () => {
  it('maps legacy AI route to AI tab', () => {
    expect(adminConfigTabFromNavigateTarget('ai-credits-setup')).toBe(ADMIN_CONFIG_TABS.AI_CONFIG);
  });

  it('maps page-access-setup to page access tab', () => {
    expect(adminConfigTabFromNavigateTarget('page-access-setup')).toBe(ADMIN_CONFIG_TABS.PAGE_ACCESS);
  });

  it('maps mandatory profile fields to its admin tab', () => {
    expect(adminConfigTabFromNavigateTarget('mandatory-fields-setup')).toBe(ADMIN_CONFIG_TABS.MANDATORY_FIELDS);
  });

  it('maps wellness setup to wellness tab', () => {
    expect(adminConfigTabFromNavigateTarget('wellness-score-setup')).toBe(ADMIN_CONFIG_TABS.WELLNESS_SCORE);
  });
});
