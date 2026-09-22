/**
 * Admin Config Setup — hub with in-page tabs for platform admin configuration.
 *
 * Tabs:
 *   1. Wellness Score Setup (ff.wellness-score-sheet)
 *   2. Activity Time Setup (always for admin)
 *   3. AI Configuration Setup (ff.ai-credits)
 */
import React, { useEffect, useState, startTransition } from 'react';
import { ArrowLeft, Settings2 } from 'lucide-react';
import { isFlagEnabled } from '../../config/featureFlags';
import { getUserId } from '../../shared/services/userIdentity';
import TimeWindowSettingsModal from '../../shared/components/TimeWindowSettingsModal';
import { useNutritionRefreshOptional } from '../../shared/context/NutritionRefreshContext';
import { WellnessScoreSetup } from '../../features/wellness-score-sheet';
import { AiCreditsSetup } from '../../features/ai-credits';
import {
  ADMIN_CONFIG_TABS,
  ADMIN_CONFIG_TAB_LABELS,
  resolveAdminConfigTab,
} from '../domain/adminConfigSetupTabs';

export { ADMIN_CONFIG_TABS } from '../domain/adminConfigSetupTabs';

const TAB_BTN = (active) =>
  `flex-1 min-w-0 py-2 rounded-lg text-[11px] sm:text-xs font-semibold transition-all duration-150 cursor-pointer px-1.5 sm:px-2 ${
    active
      ? 'bg-emerald-600 text-white shadow-sm'
      : 'text-gray-700 hover:bg-emerald-50'
  }`;

function scrollAdminConfigToTop() {
  const scrollBody = document.querySelector('.ios-scroll-body');
  if (scrollBody) {
    scrollBody.scrollTop = 0;
    return;
  }
  window.scrollTo(0, 0);
}

export default function AdminConfigSetup({
  user,
  apiBaseUrl,
  onBack,
  initialTab = ADMIN_CONFIG_TABS.WELLNESS_SCORE,
}) {
  const wellnessScoreEnabled = isFlagEnabled('ff.wellness-score-sheet');
  const aiCreditsEnabled = isFlagEnabled('ff.ai-credits');
  const flagOpts = { wellnessScoreEnabled, aiCreditsEnabled };
  const nutritionRefresh = useNutritionRefreshOptional();

  const [activeTab, setActiveTab] = useState(() =>
    resolveAdminConfigTab(initialTab, flagOpts),
  );
  const [wellnessMounted, setWellnessMounted] = useState(
    () => resolveAdminConfigTab(initialTab, flagOpts) === ADMIN_CONFIG_TABS.WELLNESS_SCORE,
  );
  const [activityMounted, setActivityMounted] = useState(
    () => resolveAdminConfigTab(initialTab, flagOpts) === ADMIN_CONFIG_TABS.ACTIVITY_TIME,
  );
  const [aiMounted, setAiMounted] = useState(
    () => resolveAdminConfigTab(initialTab, flagOpts) === ADMIN_CONFIG_TABS.AI_CONFIG,
  );
  const [resolvedUserId, setResolvedUserId] = useState(user?.id || null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const userId = (await getUserId(user)) || user?.id || null;
      if (!cancelled) setResolvedUserId(userId);
    })();
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    const next = resolveAdminConfigTab(initialTab, flagOpts);
    setActiveTab(next);
    if (next === ADMIN_CONFIG_TABS.WELLNESS_SCORE) setWellnessMounted(true);
    if (next === ADMIN_CONFIG_TABS.ACTIVITY_TIME) setActivityMounted(true);
    if (next === ADMIN_CONFIG_TABS.AI_CONFIG) setAiMounted(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTab, wellnessScoreEnabled, aiCreditsEnabled]);

  const selectTab = (tab) => {
    if (tab === activeTab) return;
    if (tab === ADMIN_CONFIG_TABS.WELLNESS_SCORE && !wellnessScoreEnabled) return;
    if (tab === ADMIN_CONFIG_TABS.AI_CONFIG && !aiCreditsEnabled) return;
    startTransition(() => {
      setActiveTab(tab);
      if (tab === ADMIN_CONFIG_TABS.WELLNESS_SCORE) setWellnessMounted(true);
      if (tab === ADMIN_CONFIG_TABS.ACTIVITY_TIME) setActivityMounted(true);
      if (tab === ADMIN_CONFIG_TABS.AI_CONFIG) setAiMounted(true);
      scrollAdminConfigToTop();
    });
  };

  const wellnessActive = activeTab === ADMIN_CONFIG_TABS.WELLNESS_SCORE;
  const activityActive = activeTab === ADMIN_CONFIG_TABS.ACTIVITY_TIME;
  const aiActive = activeTab === ADMIN_CONFIG_TABS.AI_CONFIG;

  const handleTimeWindowsUpdated = () => {
    nutritionRefresh?.triggerRefresh?.({
      immediate: true,
      source: 'admin-config-time-windows-saved',
    });
  };

  return (
    <div className="min-h-screen bg-[#f4f7f5]">
      <header className="sticky top-0 z-30 border-b border-gray-200/80 bg-white/95 backdrop-blur safe-top">
        <div className="mx-auto max-w-lg px-4 pt-3 pb-3">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="-ml-2 rounded-lg p-2 transition-colors hover:bg-gray-100"
                aria-label="Go back"
              >
                <ArrowLeft className="h-5 w-5 text-gray-700" />
              </button>
            )}
            <div className="min-w-0 flex-1">
              <h1 className="flex items-center gap-2 text-base font-bold text-gray-900">
                <Settings2 className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
                Admin Config Setup
              </h1>
              <p className="text-xs text-gray-500">Platform-wide configuration</p>
            </div>
          </div>

          <div
            className="mt-3 flex w-full gap-1 rounded-xl border border-gray-200 bg-white p-1 shadow-sm"
            role="tablist"
            aria-label="Admin Config Setup tabs"
          >
            {wellnessScoreEnabled && (
              <button
                type="button"
                role="tab"
                id="admin-config-tab-wellness-score"
                aria-controls="admin-config-panel-wellness-score"
                aria-selected={wellnessActive}
                tabIndex={wellnessActive ? 0 : -1}
                onClick={() => selectTab(ADMIN_CONFIG_TABS.WELLNESS_SCORE)}
                className={TAB_BTN(wellnessActive)}
              >
                <span className="truncate">{ADMIN_CONFIG_TAB_LABELS[ADMIN_CONFIG_TABS.WELLNESS_SCORE]}</span>
              </button>
            )}
            <button
              type="button"
              role="tab"
              id="admin-config-tab-activity-time"
              aria-controls="admin-config-panel-activity-time"
              aria-selected={activityActive}
              tabIndex={activityActive ? 0 : -1}
              onClick={() => selectTab(ADMIN_CONFIG_TABS.ACTIVITY_TIME)}
              className={TAB_BTN(activityActive)}
            >
              <span className="truncate">{ADMIN_CONFIG_TAB_LABELS[ADMIN_CONFIG_TABS.ACTIVITY_TIME]}</span>
            </button>
            {aiCreditsEnabled && (
              <button
                type="button"
                role="tab"
                id="admin-config-tab-ai-config"
                aria-controls="admin-config-panel-ai-config"
                aria-selected={aiActive}
                tabIndex={aiActive ? 0 : -1}
                onClick={() => selectTab(ADMIN_CONFIG_TABS.AI_CONFIG)}
                className={TAB_BTN(aiActive)}
              >
                <span className="truncate">{ADMIN_CONFIG_TAB_LABELS[ADMIN_CONFIG_TABS.AI_CONFIG]}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {wellnessMounted && wellnessScoreEnabled && (
        <div
          id="admin-config-panel-wellness-score"
          role="tabpanel"
          aria-labelledby="admin-config-tab-wellness-score"
          hidden={!wellnessActive}
          className={wellnessActive ? '' : 'hidden'}
        >
          <WellnessScoreSetup
            user={user}
            apiBaseUrl={apiBaseUrl}
            embedded
          />
        </div>
      )}

      {activityMounted && (
        <div
          id="admin-config-panel-activity-time"
          role="tabpanel"
          aria-labelledby="admin-config-tab-activity-time"
          hidden={!activityActive}
          className={activityActive ? '' : 'hidden'}
        >
          <TimeWindowSettingsModal
            isOpen={activityActive || activityMounted}
            variant="inline"
            onClose={() => {}}
            onUpdate={handleTimeWindowsUpdated}
            userEmail={user?.email}
            requesterUserId={resolvedUserId}
            title="Activity Time Setup"
          />
        </div>
      )}

      {aiMounted && aiCreditsEnabled && (
        <div
          id="admin-config-panel-ai-config"
          role="tabpanel"
          aria-labelledby="admin-config-tab-ai-config"
          hidden={!aiActive}
          className={aiActive ? '' : 'hidden'}
        >
          <AiCreditsSetup
            user={user}
            apiBaseUrl={apiBaseUrl}
            embedded
          />
        </div>
      )}
    </div>
  );
}
