/**
 * Admin Config Setup — hub with in-page tabs for platform admin configuration.
 *
 * Tabs:
 *   1. Wellness Score Setup (ff.wellness-score-sheet)
 *   2. Activity Time Setup (always for admin)
 *   3. AI Configuration Setup (ff.ai-credits)
 *   4. Page Access (ff.nav-page-access)
 */
import React, { useEffect, useState, startTransition } from 'react';
import { ArrowLeft, Settings2 } from 'lucide-react';
import { isFlagEnabled } from '../../config/featureFlags';
import { getUserId } from '../../shared/services/userIdentity';
import TimeWindowSettingsModal from '../../shared/components/TimeWindowSettingsModal';
import { useNutritionRefreshOptional } from '../../shared/context/NutritionRefreshContext';
import { WellnessScoreSetup } from '../../features/wellness-score-sheet';
import { AiCreditsSetup } from '../../features/ai-credits';
import { NavPageAccessSetup } from '../../features/nav-page-access';
import { FieldCollectionSetup } from '../../features/field-collection';
import {
  ADMIN_CONFIG_TABS,
  ADMIN_CONFIG_TAB_LABELS,
  resolveAdminConfigTab,
} from '../domain/adminConfigSetupTabs';

export { ADMIN_CONFIG_TABS } from '../domain/adminConfigSetupTabs';

const TAB_BTN = (active) =>
  `shrink-0 whitespace-nowrap py-2 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer px-3 ${
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
  /** Refetch live nav ACL after Page Access save (mobile + web). */
  onNavAccessSaved,
}) {
  const wellnessScoreEnabled = isFlagEnabled('ff.wellness-score-sheet');
  const aiCreditsEnabled = isFlagEnabled('ff.ai-credits');
  const navPageAccessEnabled = isFlagEnabled('ff.nav-page-access');
  const fieldCollectionEnabled = isFlagEnabled('ff.field-collection');
  const flagOpts = {
    wellnessScoreEnabled,
    aiCreditsEnabled,
    navPageAccessEnabled,
    fieldCollectionEnabled,
  };
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
  const [pageAccessMounted, setPageAccessMounted] = useState(
    () => resolveAdminConfigTab(initialTab, flagOpts) === ADMIN_CONFIG_TABS.PAGE_ACCESS,
  );
  const [fieldCollectionMounted, setFieldCollectionMounted] = useState(
    () => resolveAdminConfigTab(initialTab, flagOpts) === ADMIN_CONFIG_TABS.FIELD_COLLECTION,
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
    if (next === ADMIN_CONFIG_TABS.PAGE_ACCESS) setPageAccessMounted(true);
    if (next === ADMIN_CONFIG_TABS.FIELD_COLLECTION) setFieldCollectionMounted(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTab, wellnessScoreEnabled, aiCreditsEnabled, navPageAccessEnabled, fieldCollectionEnabled]);

  const selectTab = (tab) => {
    if (tab === activeTab) return;
    if (tab === ADMIN_CONFIG_TABS.WELLNESS_SCORE && !wellnessScoreEnabled) return;
    if (tab === ADMIN_CONFIG_TABS.AI_CONFIG && !aiCreditsEnabled) return;
    if (tab === ADMIN_CONFIG_TABS.PAGE_ACCESS && !navPageAccessEnabled) return;
    if (tab === ADMIN_CONFIG_TABS.FIELD_COLLECTION && !fieldCollectionEnabled) return;
    startTransition(() => {
      setActiveTab(tab);
      if (tab === ADMIN_CONFIG_TABS.WELLNESS_SCORE) setWellnessMounted(true);
      if (tab === ADMIN_CONFIG_TABS.ACTIVITY_TIME) setActivityMounted(true);
      if (tab === ADMIN_CONFIG_TABS.AI_CONFIG) setAiMounted(true);
      if (tab === ADMIN_CONFIG_TABS.PAGE_ACCESS) setPageAccessMounted(true);
      if (tab === ADMIN_CONFIG_TABS.FIELD_COLLECTION) setFieldCollectionMounted(true);
      scrollAdminConfigToTop();
      // Keep the selected tab visible in the horizontally scrollable tablist.
      requestAnimationFrame(() => {
        document
          .getElementById(`admin-config-tab-${tab}`)
          ?.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' });
      });
    });
  };

  const wellnessActive = activeTab === ADMIN_CONFIG_TABS.WELLNESS_SCORE;
  const activityActive = activeTab === ADMIN_CONFIG_TABS.ACTIVITY_TIME;
  const aiActive = activeTab === ADMIN_CONFIG_TABS.AI_CONFIG;
  const pageAccessActive = activeTab === ADMIN_CONFIG_TABS.PAGE_ACCESS;
  const fieldCollectionActive = activeTab === ADMIN_CONFIG_TABS.FIELD_COLLECTION;

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
            className="mt-3 flex w-full gap-1 overflow-x-auto scrollbar-hide rounded-xl border border-gray-200 bg-white p-1 shadow-sm"
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
                {ADMIN_CONFIG_TAB_LABELS[ADMIN_CONFIG_TABS.WELLNESS_SCORE]}
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
              {ADMIN_CONFIG_TAB_LABELS[ADMIN_CONFIG_TABS.ACTIVITY_TIME]}
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
                {ADMIN_CONFIG_TAB_LABELS[ADMIN_CONFIG_TABS.AI_CONFIG]}
              </button>
            )}
            {fieldCollectionEnabled && (
              <button
                type="button"
                role="tab"
                id="admin-config-tab-field-collection"
                aria-controls="admin-config-panel-field-collection"
                aria-selected={fieldCollectionActive}
                tabIndex={fieldCollectionActive ? 0 : -1}
                onClick={() => selectTab(ADMIN_CONFIG_TABS.FIELD_COLLECTION)}
                className={TAB_BTN(fieldCollectionActive)}
              >
                {ADMIN_CONFIG_TAB_LABELS[ADMIN_CONFIG_TABS.FIELD_COLLECTION]}
              </button>
            )}
            {navPageAccessEnabled && (
              <button
                type="button"
                role="tab"
                id="admin-config-tab-page-access"
                aria-controls="admin-config-panel-page-access"
                aria-selected={pageAccessActive}
                tabIndex={pageAccessActive ? 0 : -1}
                onClick={() => selectTab(ADMIN_CONFIG_TABS.PAGE_ACCESS)}
                className={TAB_BTN(pageAccessActive)}
              >
                {ADMIN_CONFIG_TAB_LABELS[ADMIN_CONFIG_TABS.PAGE_ACCESS]}
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

      {fieldCollectionMounted && fieldCollectionEnabled && (
        <div
          id="admin-config-panel-field-collection"
          role="tabpanel"
          aria-labelledby="admin-config-tab-field-collection"
          hidden={!fieldCollectionActive}
          className={fieldCollectionActive ? '' : 'hidden'}
        >
          <FieldCollectionSetup user={user} apiBaseUrl={apiBaseUrl} />
        </div>
      )}

      {pageAccessMounted && navPageAccessEnabled && (
        <div
          id="admin-config-panel-page-access"
          role="tabpanel"
          aria-labelledby="admin-config-tab-page-access"
          hidden={!pageAccessActive}
          className={pageAccessActive ? '' : 'hidden'}
        >
          <NavPageAccessSetup
            user={user}
            apiBaseUrl={apiBaseUrl}
            embedded
            onSaved={onNavAccessSaved}
          />
        </div>
      )}
    </div>
  );
}
