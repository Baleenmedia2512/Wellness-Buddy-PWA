/**
 * Admin Config Setup tab ids + default resolution.
 */
export const ADMIN_CONFIG_TABS = {
  WELLNESS_SCORE: 'wellness-score',
  ACTIVITY_TIME: 'activity-time',
  AI_CONFIG: 'ai-config',
  PAGE_ACCESS: 'page-access',
};

export const ADMIN_CONFIG_TAB_LABELS = {
  [ADMIN_CONFIG_TABS.WELLNESS_SCORE]: 'Wellness Score',
  [ADMIN_CONFIG_TABS.ACTIVITY_TIME]: 'Activity Time',
  [ADMIN_CONFIG_TABS.AI_CONFIG]: 'AI Config',
  [ADMIN_CONFIG_TABS.PAGE_ACCESS]: 'Page Access',
};

/**
 * Resolve which tab to show given flags and an optional deep-link.
 * Activity Time is always available for admin config. Wellness / AI / Page Access follow flags.
 */
export function resolveAdminConfigTab(
  initialTab,
  {
    wellnessScoreEnabled = true,
    aiCreditsEnabled = true,
    navPageAccessEnabled = true,
  } = {},
) {
  if (initialTab === ADMIN_CONFIG_TABS.WELLNESS_SCORE && wellnessScoreEnabled) {
    return ADMIN_CONFIG_TABS.WELLNESS_SCORE;
  }
  if (initialTab === ADMIN_CONFIG_TABS.AI_CONFIG && aiCreditsEnabled) {
    return ADMIN_CONFIG_TABS.AI_CONFIG;
  }
  if (initialTab === ADMIN_CONFIG_TABS.PAGE_ACCESS && navPageAccessEnabled) {
    return ADMIN_CONFIG_TABS.PAGE_ACCESS;
  }
  if (initialTab === ADMIN_CONFIG_TABS.ACTIVITY_TIME) {
    return ADMIN_CONFIG_TABS.ACTIVITY_TIME;
  }
  if (wellnessScoreEnabled) return ADMIN_CONFIG_TABS.WELLNESS_SCORE;
  if (aiCreditsEnabled) return ADMIN_CONFIG_TABS.AI_CONFIG;
  if (navPageAccessEnabled) return ADMIN_CONFIG_TABS.PAGE_ACCESS;
  return ADMIN_CONFIG_TABS.ACTIVITY_TIME;
}

/** Map legacy navigateTo keys → admin config tab. */
export function adminConfigTabFromNavigateTarget(targetPage) {
  if (targetPage === 'ai-credits-setup') return ADMIN_CONFIG_TABS.AI_CONFIG;
  if (targetPage === 'page-access-setup') return ADMIN_CONFIG_TABS.PAGE_ACCESS;
  if (targetPage === 'admin-config-setup') return null; // use default resolution
  return ADMIN_CONFIG_TABS.WELLNESS_SCORE;
}
