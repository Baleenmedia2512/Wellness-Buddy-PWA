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
    })).toBe(ADMIN_CONFIG_TABS.WELLNESS_SCORE);
  });

  it('falls back when wellness flag is off', () => {
    expect(resolveAdminConfigTab(ADMIN_CONFIG_TABS.WELLNESS_SCORE, {
      wellnessScoreEnabled: false,
      aiCreditsEnabled: true,
    })).toBe(ADMIN_CONFIG_TABS.AI_CONFIG);
  });

  it('honours AI deep-link when enabled', () => {
    expect(resolveAdminConfigTab(ADMIN_CONFIG_TABS.AI_CONFIG, {
      wellnessScoreEnabled: true,
      aiCreditsEnabled: true,
    })).toBe(ADMIN_CONFIG_TABS.AI_CONFIG);
  });

  it('always allows activity time', () => {
    expect(resolveAdminConfigTab(ADMIN_CONFIG_TABS.ACTIVITY_TIME, {
      wellnessScoreEnabled: false,
      aiCreditsEnabled: false,
    })).toBe(ADMIN_CONFIG_TABS.ACTIVITY_TIME);
  });
});

describe('adminConfigTabFromNavigateTarget', () => {
  it('maps legacy AI route to AI tab', () => {
    expect(adminConfigTabFromNavigateTarget('ai-credits-setup')).toBe(ADMIN_CONFIG_TABS.AI_CONFIG);
  });

  it('maps wellness setup to wellness tab', () => {
    expect(adminConfigTabFromNavigateTarget('wellness-score-setup')).toBe(ADMIN_CONFIG_TABS.WELLNESS_SCORE);
  });
});
