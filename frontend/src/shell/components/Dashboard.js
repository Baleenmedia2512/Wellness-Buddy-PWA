// src/shell/components/Dashboard.js
//
// Moved from `frontend/src/shared/components/Dashboard.js` in F1 of
// ADR-0003 (preceded by ADR-0001 §"shell composition layer").
//
// This is the in-app dashboard SHELL — a cross-feature composition root
// that legitimately imports from `features/*`. It lives under `shell/`
// (not `shared/`) so the §2.2 `shared-cannot-import-features` rule no
// longer flags it. See `frontend/src/shell/README.md` for the layer's
// charter and import policy.
import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { ArrowLeft, Calendar, ChevronLeft, ChevronRight, FileBarChart, Footprints, Smartphone } from 'lucide-react';
import TouchFeedbackButton from '../../shared/components/TouchFeedbackButton';
import { TeamMemberSearch } from '../../features/team';
import TeamMemberProfileModal from '../../shared/components/TeamMemberProfileModal';
import { isFlagEnabled } from '../../config/featureFlags';
import { useNutritionRefresh } from '../../shared/context/NutritionRefreshContext';
import DashboardTabs from './DashboardTabs';
// ADR-0003 (revised) — Food / Weight / Education keep their original
// dashboards; the shell only hosts the "Other" (unknown capture) flow.
import UnknownEntryFlow from './UnknownEntryFlow';
import UnknownCaptureUndoBanner, { UNDO_SECONDS } from './UnknownCaptureUndoBanner';
import { undoDeleteCapture } from '../../features/captures';

// âœ… LAZY LOADING: Load tab components on-demand (only one visible at a time)
const NutritionDashboard = lazy(() => import('../../features/nutrition/components/NutritionDashboard'));
const WeightDashboard = lazy(() => import('../../features/weight/components/WeightDashboard'));
const EducationDashboard = lazy(() => import('../../features/education/components/EducationDashboard'));
// PR-C / ADR-0003 — mounted only when `ff.diary-feed` is enabled. The
// import call is still wrapped in `lazy()` so the bundle chunk for
// `features/diary/` is fetched on-demand the first time the tab is
// shown (zero-cost when the flag is OFF).
const DiaryFeed = lazy(() =>
  import('../../features/diary').then((m) => ({ default: m.DiaryFeed })),
);
// FEATURE DISABLED: const StepsDashboard = lazy(() => import('./StepsDashboard'));
// FEATURE DISABLED: const ScreenDashboard = lazy(() => import('./ScreenDashboard'));

/**
 * Unified Dashboard with tabs for Nutrition and Weight tracking
 * Replaces the separate Nutrition Dashboard and Weight Tracking pages
 * @param {string} initialTab - Optional tab to open initially ('nutrition' or 'weight')
 * @param {string} userRole - User's role for access control (coach, coCoach, admin, user)
 * @param {string} initialTab - Optional tab to open initially ('nutrition' | 'weight' | 'education')
 * @param {string} initialMealId - Optional meal ID to auto-open in Nutrition tab (deep link)
 */
const Dashboard = ({ user, onBack, apiBaseUrl, onMealDelete, initialTab, userRole = 'user', bmrUpdateKey = 0, educationRefreshKey = 0, watchBurnedCalories = 0, initialSelectedMember = null, initialDate = null, initialMealId = null, onOpenReports = null }) => {
  // PR-C / ADR-0003 — Diary tab is mounted iff the FE feature flag is ON.
  // Resolution order is documented in `config/featureFlags.js`. Resolved
  // once per mount so toggling the flag at runtime requires a re-mount
  // (matches the other tab-visibility decisions in this component).
  const diaryEnabled = isFlagEnabled('ff.diary-feed');
  // ff.diary-timeline — when ON (requires diaryEnabled), the stacked
  // NutritionDashboard / WeightDashboard / EducationDashboard + DiaryFeed(unknown)
  // layout is replaced with a single chronological DiaryFeed that shows all
  // entry kinds (food, weight, education, watch, unknown) for the selected IST day.
  // Set REACT_APP_FF_DIARY_TIMELINE=false to revert to the stacked layout.
  const timelineEnabled = diaryEnabled && isFlagEnabled('ff.diary-timeline');
  const { triggerRefresh: triggerNutritionRefresh, refreshKey: nutritionContextRefreshKey } = useNutritionRefresh();

  const [activeTab, setActiveTab] = useState(() => {
    // Use initialTab prop if provided, otherwise restore from localStorage
    const validTabs = ['nutrition', 'weight', 'education', 'steps', 'screen'];
    if (diaryEnabled) validTabs.push('diary');
    if (initialTab && validTabs.includes(initialTab)) {
      localStorage.setItem('dashboard_activeTab', initialTab);
      return initialTab;
    }
    const stored = localStorage.getItem('dashboard_activeTab');
    // Fall back to 'nutrition' if the stored tab is now invalid (e.g.
    // user landed on 'diary' previously but the flag was flipped off).
    if (stored && validTabs.includes(stored)) return stored;
    return 'nutrition';
  });

  // Team member selection state (for coaches)
  const [selectedMember, setSelectedMember] = useState(initialSelectedMember);
  // Profile viewer modal for a selected team member
  const [showMemberProfile, setShowMemberProfile] = useState(false);
  
  // Unified date state shared between both tabs
  const [selectedDate, setSelectedDate] = useState(() => {
    if (initialDate) {
      const d = new Date(initialDate);
      if (!Number.isNaN(d.getTime())) return d;
    }
    return new Date();
  });
  
  // Calendar visibility and month navigation
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  // Respond to deep-link prop changes while the component is already mounted.
  // The useState initializers above only run on first mount, so if a new
  // share link arrives while Dashboard is open we must imperatively update
  // the three seeded values here.
  useEffect(() => {
    if (!initialTab) return;
    const valid = ['nutrition', 'weight', 'education', 'steps', 'screen'];
    if (diaryEnabled) valid.push('diary');
    if (!valid.includes(initialTab)) return;
    setActiveTab(initialTab);
    localStorage.setItem('dashboard_activeTab', initialTab);
  }, [initialTab, diaryEnabled]);

  useEffect(() => {
    // null means "view self" (isSelf deep-link); undefined means not provided.
    if (initialSelectedMember === undefined) return;
    setSelectedMember(initialSelectedMember);
  }, [initialSelectedMember]);

  useEffect(() => {
    if (!initialDate) return;
    const d = new Date(initialDate);
    if (!Number.isNaN(d.getTime())) setSelectedDate(d);
  }, [initialDate]);

  // Determine which user's data to display (selected member or coach)
  const displayUser = selectedMember || user;

  // Label for the shell-level date-picker button: "Today" when the
  // selected day is the current day, otherwise a short date (e.g. "Jun 9").
  const dateButtonLabel =
    selectedDate.toDateString() === new Date().toDateString()
      ? 'Today'
      : selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  // Save active tab to localStorage when it changes
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    localStorage.setItem('dashboard_activeTab', tab);
    if (tab === 'steps' || tab === 'screen') {
      setSelectedDate(new Date());
    }
  };

  // ── ADR-0003 (revised) — "Other" tab hosting ─────────────────────────────
  // Food / Weight / Education now render their ORIGINAL dashboards (with their
  // own detail modals + optimistic updates). The shell only hosts the
  // unrecognised ("unknown") capture flow here. `diaryReloadKey` re-fetches
  // the Other feed after a retry / delete / undo.
  const ownerId = displayUser?.id || displayUser?.userId;
  const [diaryReloadKey, setDiaryReloadKey] = useState(0);
  const reloadDiary = () => setDiaryReloadKey((k) => k + 1);
  const [weightReloadKey, setWeightReloadKey] = useState(0);
  const [diaryEducationRefreshKey, setDiaryEducationRefreshKey] = useState(0);
  // Unknown ("Other") row flow: image viewer + Retry / Edit → respective vertical.
  const [unknownFlow, setUnknownFlow] = useState(null);
  // 2026-06-09 — undo state for unknown capture deletion (shell-level)
  const [unknownUndo, setUnknownUndo] = useState(null);
  // { captureId, userId, imageBase64, expiresAt }
  const viewingSelf = !selectedMember || selectedMember.isSelf;

  // ── Timeline imperative handles (ff.diary-timeline) ──────────────────────
  // Each ref is written by the corresponding hidden dashboard on every render.
  // When a timeline row is tapped, the shell calls the matching ref to open
  // the existing modal inside the relevant dashboard component.
  const nutritionOpenRef = useRef(null);
  const weightOpenRef    = useRef(null);
  const educationOpenRef = useRef(null);

  // Reload the diary feed whenever a nutrition mutation fires the shared context.
  // This keeps the timeline timestamp/calorie values fresh after an edit or delete
  // without requiring a manual refresh.
  const prevNutritionContextKeyRef = useRef(0);
  useEffect(() => {
    if (
      nutritionContextRefreshKey > 0 &&
      nutritionContextRefreshKey !== prevNutritionContextKeyRef.current
    ) {
      prevNutritionContextKeyRef.current = nutritionContextRefreshKey;
      reloadDiary();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- reloadDiary is stable (closure over setState)
  }, [nutritionContextRefreshKey]);

  // Tap handler for timeline entries: dispatches to the matching imperative
  // handle (food/weight/education) or opens the unknown capture flow.
  const handleEntryOpen = (entry) => {
    if (entry.kind === 'food') {
      nutritionOpenRef.current?.(entry.payload?.id);
      return;
    }
    if (entry.kind === 'weight') {
      weightOpenRef.current?.(entry.payload?.id);
      return;
    }
    if (entry.kind === 'education') {
      educationOpenRef.current?.(entry.payload?.id);
      return;
    }
    if (entry.kind === 'unknown') {
      const p = entry.payload || {};
      setUnknownFlow({
        captureId: entry.capture?.id ?? p.id,
        imageBase64: p.imageBase64,
      });
    }
    // watch: informational only (kcal already visible on card), no detail modal.
  };

  // Swipe-to-delete is intentionally disabled for unknown rows to preserve the
  // undo UX (deletion happens inside UnknownEntryFlow). The "Other" feed only
  // contains unknown rows, so this is a no-op kept for the DiaryFeed contract.
  const handleEntryDelete = () => {};

  const handleUnknownChanged = (change = {}) => {
    setUnknownFlow(null);
    reloadDiary();
    if (change.kind === 'food') {
      triggerNutritionRefresh({ immediate: true, source: 'unknown-flow-food' });
    } else if (change.kind === 'weight') {
      setWeightReloadKey((k) => k + 1);
    } else if (change.kind === 'education') {
      setDiaryEducationRefreshKey((k) => k + 1);
    }
  };

  return (
    <>
    <div className="min-h-screen" style={{ backgroundColor: '#e8f5e9' }}>
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 -right-20 w-40 h-40 md:w-80 md:h-80 bg-gradient-to-br from-orange-200/20 to-pink-200/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-20 -left-20 w-40 h-40 md:w-80 md:h-80 bg-gradient-to-tr from-blue-200/20 to-purple-200/20 rounded-full blur-3xl"></div>
      </div>

      {/* Header with tabs */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
        {/* Team Member Search - Only visible for coaches */}
        <TeamMemberSearch
          user={user}
          userRole={userRole}
          selectedMember={selectedMember}
          onMemberSelect={setSelectedMember}
        />
        
        <div className="w-full max-w-md mx-auto md:max-w-2xl lg:max-w-4xl">
          {/* Top bar with back button and title */}
          <div className="flex items-center justify-between p-4 md:p-6 pb-3">
            <TouchFeedbackButton 
              onClick={onBack} 
              className="p-2 md:p-3 hover:bg-gray-100 rounded-xl transition-colors"
              ariaLabel="Go back"
            >
              <ArrowLeft className="h-5 w-5 text-gray-700" />
            </TouchFeedbackButton>

            <div className="text-center">
              <h1 className="text-lg md:text-xl font-semibold text-gray-900">
                {diaryEnabled ? 'Diary' : 'Dashboard'}{selectedMember && !selectedMember.isSelf ? (
                  <>
                    {' - '}
                    <button
                      onClick={() => setShowMemberProfile(true)}
                      className="text-blue-600 active:text-green-600 hover:text-blue-700 hover:underline transition-colors"
                      title="View profile"
                    >
                      {selectedMember.userName}
                    </button>
                  </>
                ) : ''}
              </h1>
              <p className="text-xs text-gray-500">
                {selectedMember && !selectedMember.isSelf 
                  ? (
                    <button
                      onClick={() => setShowMemberProfile(true)}
                      className="text-blue-600 active:text-green-600 hover:underline"
                    >
                      {`Viewing ${selectedMember.userName}'s data`}
                    </button>
                  )
                  : 'Track your wellness journey'
                }
              </p>
            </div>

            {/* Calendar button — for the steps/screen tabs (disabled) AND the
                single-page Diary. In the Diary, this one shell-level "Today"
                button opens the month-grid date picker and drives the day for
                every stacked dashboard (Nutrition's own strip is suppressed). */}
            {(activeTab === 'steps' || activeTab === 'screen') && (
              <TouchFeedbackButton 
                onClick={() => { setShowCalendar(!showCalendar); setCalendarMonth(new Date(selectedDate)); }} 
                className="p-2 md:p-3 hover:bg-gray-100 rounded-xl transition-colors"
                ariaLabel="Toggle calendar"
              >
                <Calendar className="h-5 w-5 text-gray-700" />
              </TouchFeedbackButton>
            )}
            {diaryEnabled && (
              <div className="flex items-center gap-1">
                {onOpenReports && (
                  <TouchFeedbackButton
                    onClick={() => onOpenReports(selectedMember)}
                    className="p-2 md:p-3 hover:bg-emerald-50 rounded-xl transition-colors"
                    ariaLabel="Open reports"
                  >
                    <FileBarChart className="h-5 w-5 text-emerald-700" />
                  </TouchFeedbackButton>
                )}
                <TouchFeedbackButton
                  onClick={() => { setShowCalendar(!showCalendar); setCalendarMonth(new Date(selectedDate)); }}
                  className="flex items-center gap-1.5 px-3 py-2 md:px-4 md:py-2.5 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-colors"
                  ariaLabel="Open date picker"
                >
                  <Calendar className="h-4 w-4 md:h-5 md:w-5 text-emerald-700" />
                  <span className="text-sm md:text-base font-semibold text-emerald-700">{dateButtonLabel}</span>
                </TouchFeedbackButton>
              </div>
            )}
            {/* Empty space to keep the title centred when there's no top-right action */}
            {!diaryEnabled && (activeTab === 'nutrition' || activeTab === 'weight' || activeTab === 'education') && (
              <div className="p-2 md:p-3 w-9 h-9 md:w-11 md:h-11"></div>
            )}
          </div>

          {/* Tab navigation — only when the single-page Diary is OFF. When
              ff.diary-feed is ON, Food / Weight / Education / Other are
              stacked on one scrollable page (no tab switching). */}
          {!diaryEnabled && (
            <DashboardTabs
              activeTab={activeTab}
              onTabChange={handleTabChange}
              diaryEnabled={diaryEnabled}
            />
          )}
          {/* Steps + Screen tab buttons remain DISABLED — see
              feature-disabled banners in App.js. When re-enabled,
              extend DashboardTabs.jsx, not this file. */}
        </div>
      </div>

      {/* Inline Calendar — month-grid date picker. Shown for the
          (disabled) steps/screen tabs AND the single-page Diary. */}
      {(activeTab === 'steps' || activeTab === 'screen' || diaryEnabled) && (
        <div className={`bg-white shadow-sm overflow-hidden transition-all duration-300 ease-in-out ${
          showCalendar ? 'max-h-[32rem] opacity-100' : 'max-h-0 opacity-0'
        }`}>
        <div className={`max-w-md mx-auto p-0 md:p-4 transform transition-transform duration-300 ease-in-out ${
          showCalendar ? 'translate-y-0' : '-translate-y-4'
        }`}>
          <div className="bg-white rounded-2xl border-0 md:border md:border-grey-100">
            {/* Calendar Header */}
            <div className="flex items-center justify-between p-4 border-b border-grey-100">
              <TouchFeedbackButton
                onClick={() => {
                  const prevMonth = new Date(calendarMonth);
                  prevMonth.setMonth(prevMonth.getMonth() - 1);
                  setCalendarMonth(prevMonth);
                }}
                className="p-2 hover:bg-emerald-50 rounded-lg transition-colors"
                ariaLabel="Previous month"
              >
                <ChevronLeft className="w-5 h-5 text-grey-600" />
              </TouchFeedbackButton>
              
              <h3 className="text-lg font-semibold text-grey-900">
                {calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </h3>
              
              <TouchFeedbackButton
                onClick={() => {
                  const nextMonth = new Date(calendarMonth);
                  nextMonth.setMonth(nextMonth.getMonth() + 1);
                  setCalendarMonth(nextMonth);
                }}
                className="p-2 hover:bg-emerald-50 rounded-lg transition-colors"
                ariaLabel="Next month"
              >
                <ChevronRight className="w-5 h-5 text-grey-600" />
              </TouchFeedbackButton>
            </div>
            
            {/* Days of Week Headers */}
            <div className="grid grid-cols-7 gap-1 px-4 pt-4 pb-2">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                <div key={index} className="text-center text-sm font-semibold text-gray-500 py-2">
                  {day}
                </div>
              ))}
            </div>
            
            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1 px-4 pb-4">
              {(() => {
                const year = calendarMonth.getFullYear();
                const month = calendarMonth.getMonth();
                const today = new Date();
                
                // Get first day of month and number of days
                const firstDay = new Date(year, month, 1);
                const lastDay = new Date(year, month + 1, 0);
                const daysInMonth = lastDay.getDate();
                const startingDayOfWeek = firstDay.getDay(); // 0 = Sunday
                
                const days = [];
                
                // Add empty cells for days before the month starts
                for (let i = 0; i < startingDayOfWeek; i++) {
                  const prevDate = new Date(year, month, -startingDayOfWeek + i + 1);
                  days.push({
                    date: prevDate,
                    dayNumber: prevDate.getDate(),
                    isCurrentMonth: false,
                    isToday: prevDate.toDateString() === today.toDateString(),
                    isSelected: prevDate.toDateString() === selectedDate.toDateString(),
                    isFuture: prevDate > today
                  });
                }
                
                // Add days of current month
                for (let day = 1; day <= daysInMonth; day++) {
                  const date = new Date(year, month, day);
                  days.push({
                    date: date,
                    dayNumber: day,
                    isCurrentMonth: true,
                    isToday: date.toDateString() === today.toDateString(),
                    isSelected: date.toDateString() === selectedDate.toDateString(),
                    isFuture: date > today
                  });
                }
                
                // Add days from next month to fill the grid
                const remainingCells = 42 - days.length; // 6 rows Ã— 7 days
                for (let day = 1; day <= remainingCells; day++) {
                  const nextDate = new Date(year, month + 1, day);
                  days.push({
                    date: nextDate,
                    dayNumber: day,
                    isCurrentMonth: false,
                    isToday: nextDate.toDateString() === today.toDateString(),
                    isSelected: nextDate.toDateString() === selectedDate.toDateString(),
                    isFuture: nextDate > today
                  });
                }
                
                return days.map((day, index) => {
                  const isDisabled = day.isFuture;
                  
                  return (
                    <TouchFeedbackButton
                      key={index}
                      onClick={() => {
                        if (!isDisabled) {
                          setSelectedDate(day.date);
                          setShowCalendar(false);
                        }
                      }}
                      disabled={isDisabled}
                      className={`
                        aspect-square p-2 text-sm font-medium rounded-lg transition-all duration-200 relative
                        ${
                          day.isSelected
                            ? `bg-gradient-to-br from-${
                                activeTab === 'nutrition' ? 'green-500 to-emerald-500' : 'emerald-400 to-teal-500'
                              } text-white shadow-lg transform scale-105`
                            : day.isToday && !day.isSelected
                              ? `bg-${
                                  activeTab === 'nutrition' ? 'green-100 text-green-700' : 'emerald-100 text-emerald-700'
                                } border-2 border-${
                                  activeTab === 'nutrition' ? 'green-300' : 'emerald-300'
                                } font-bold`
                              : day.isCurrentMonth
                                ? isDisabled
                                  ? 'text-gray-400 cursor-not-allowed opacity-50'
                                  : `text-gray-700 hover:bg-${
                                      activeTab === 'nutrition' ? 'green-50' : 'emerald-50'
                                    } hover:scale-105`
                                : isDisabled
                                  ? 'text-gray-300 cursor-not-allowed opacity-30'
                                  : `text-gray-400 hover:bg-${
                                      activeTab === 'nutrition' ? 'green-50' : 'emerald-50'
                                    } hover:scale-105`
                        }
                      `}
                    >
                      {day.dayNumber}
                      
                      {/* Today indicator dot */}
                      {day.isToday && !day.isSelected && (
                        <div className={`absolute bottom-1 left-1/2 transform -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-${
                          activeTab === 'nutrition' ? 'green-500' : 'emerald-500'
                        }`} />
                      )}
                    </TouchFeedbackButton>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Tab content */}
      <div className="relative">
        <Suspense fallback={
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-300 border-t-emerald-600"></div>
          </div>
        }>
          {/* ff.diary-timeline ON — unified chronological activity timeline.
              DiaryFeed fetches all entry kinds (food / weight / education /
              watch / unknown) from GET /api/diary/list and renders them as a
              vertical timeline for the selected IST day. The stacked section-
              dashboards are intentionally absent: Diary is presentation-layer
              aggregation only (claude.md §3.3). Adding new entries is handled
              by the existing camera / add flows outside this component.
              Unknown entries retain the full UnknownEntryFlow (Retry / Edit /
              undo) via onEntryOpen → handleEntryOpen. */}
          {timelineEnabled ? (
            <>
              <div className="w-full md:max-w-2xl lg:max-w-4xl md:mx-auto px-3 md:px-4 pb-40 mt-2">
                <DiaryFeed
                  showTimeline
                  refreshKey={diaryReloadKey}
                  ownerUserId={ownerId}
                  viewerUserId={user?.id || user?.userId}
                  date={selectedDate}
                  onEntryOpen={handleEntryOpen}
                  onEntryDelete={handleEntryDelete}
                />
              </div>

              {/* Hidden dashboards — mounted so their existing modals (position:fixed)
                  remain available when the user taps a timeline entry. The container
                  has height:0 + overflow:hidden which clips the visual content but
                  does NOT affect position:fixed descendants (modals use fixed inset-0
                  and are anchored to the viewport, not this box). The openRef handles
                  receive the matching open-by-id function on every render. The
                  onAfterModalClose callbacks keep the timeline feed in sync after an
                  edit or delete. */}
              <div
                aria-hidden="true"
                style={{ position: 'absolute', height: 0, overflow: 'hidden', width: '100%' }}
              >
                <NutritionDashboard
                  user={displayUser}
                  onBack={onBack}
                  apiBaseUrl={apiBaseUrl}
                  onMealDelete={onMealDelete}
                  hideHeader
                  hideDateStrip
                  hideOverview
                  selectedDate={selectedDate}
                  setSelectedDate={setSelectedDate}
                  bmrUpdateKey={bmrUpdateKey}
                  watchBurnedCalories={watchBurnedCalories}
                  openRef={nutritionOpenRef}
                />
                <WeightDashboard
                  user={displayUser}
                  apiBaseUrl={apiBaseUrl}
                  hideHeader
                  hideOverview
                  selectedDate={selectedDate}
                  refreshKey={weightReloadKey}
                  openRef={weightOpenRef}
                  onAfterModalClose={reloadDiary}
                />
                <EducationDashboard
                  user={displayUser}
                  apiBaseUrl={apiBaseUrl}
                  hideHeader
                  hideOverview
                  selectedDate={selectedDate}
                  refreshKey={educationRefreshKey + diaryEducationRefreshKey}
                  openRef={educationOpenRef}
                  onAfterModalClose={reloadDiary}
                />
              </div>
            </>

          ) : diaryEnabled ? (
            /* ff.diary-feed ON + ff.diary-timeline OFF — legacy stacked layout
               (NutritionDashboard / WeightDashboard / EducationDashboard +
               DiaryFeed(unknown)). Preserved as the fallback so the flag can be
               toggled without a redeploy. */
            <div className="space-y-2">
              <NutritionDashboard
                user={displayUser}
                onBack={onBack}
                apiBaseUrl={apiBaseUrl}
                onMealDelete={onMealDelete}
                hideHeader={true}
                hideDateStrip={true}
                hideOverview={true}
                selectedDate={selectedDate}
                setSelectedDate={setSelectedDate}
                bmrUpdateKey={bmrUpdateKey}
                watchBurnedCalories={watchBurnedCalories}
                initialMealId={initialMealId}
              />

              <WeightDashboard
                user={displayUser}
                onBack={onBack}
                apiBaseUrl={apiBaseUrl}
                hideHeader={true}
                hideOverview={true}
                selectedDate={selectedDate}
                initialEntryId={initialMealId}
                refreshKey={weightReloadKey}
              />

              <EducationDashboard
                user={displayUser}
                apiBaseUrl={apiBaseUrl}
                hideHeader={true}
                hideOverview={true}
                selectedDate={selectedDate}
                refreshKey={educationRefreshKey + diaryEducationRefreshKey}
                initialEntryId={initialMealId}
              />

              {/* "Other" — unrecognised ("unknown") captures only. Reuses the
                  diary read-model filtered to `unknown`, preserving the image
                  viewer + Retry / Edit / undo flow handled below. */}
              <div className="w-full md:max-w-2xl lg:max-w-4xl md:mx-auto px-3 md:px-4 pb-40 mt-2">
                <h2 className="text-sm font-semibold text-gray-500 px-1 mb-2 mt-4">Other</h2>
                <DiaryFeed
                  refreshKey={diaryReloadKey}
                  ownerUserId={ownerId}
                  viewerUserId={user?.id || user?.userId}
                  date={selectedDate}
                  filterKinds={['unknown']}
                  onEntryOpen={handleEntryOpen}
                  onEntryDelete={handleEntryDelete}
                />
              </div>
            </div>
          ) : (
          <>
          {activeTab === 'nutrition' && (
            <NutritionDashboard
              user={displayUser}
              onBack={onBack}
              apiBaseUrl={apiBaseUrl}
              onMealDelete={onMealDelete}
              hideHeader={true}
              hideOverview={true}
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              bmrUpdateKey={bmrUpdateKey}
              watchBurnedCalories={watchBurnedCalories}
              initialMealId={initialMealId}
            />
          )}

          {activeTab === 'weight' && (
            <WeightDashboard
              user={displayUser}
              onBack={onBack}
              apiBaseUrl={apiBaseUrl}
              hideHeader={true}
              hideOverview={true}
              initialEntryId={initialMealId}
            />
          )}

          {activeTab === 'education' && (
            <EducationDashboard
              user={displayUser}
              apiBaseUrl={apiBaseUrl}
              hideHeader={true}
              hideOverview={true}
              refreshKey={educationRefreshKey}
              initialEntryId={initialMealId}
            />
          )}
          </>
          )}

          {/* FEATURE DISABLED: Steps tab content
          {activeTab === 'steps' && (
            <StepsDashboard
              user={displayUser}
              apiBaseUrl={apiBaseUrl}
              hideHeader={true}
              selectedDate={selectedDate}
              setSelectedDate={(d) => { setSelectedDate(d); setShowCalendar(false); }}
            />
          )}
          */}

          {/* FEATURE DISABLED: Screen tab content
          {activeTab === 'screen' && (
            <ScreenDashboard
              key={displayUser?.id || displayUser?.userId || 'self'}
              user={displayUser}
              apiBaseUrl={apiBaseUrl}
              hideHeader={true}
              selectedDate={selectedDate}
              setSelectedDate={(d) => { setSelectedDate(d); setShowCalendar(false); }}
            />
          )}
          */}
        </Suspense>
      </div>
    </div>

    {/* Team Member Profile Viewer */}
    {selectedMember && !selectedMember.isSelf && (
      <TeamMemberProfileModal
        isOpen={showMemberProfile}
        onClose={() => setShowMemberProfile(false)}
        memberEmail={selectedMember.email}
        apiBaseUrl={apiBaseUrl}
      />
    )}

    {/* ADR-0003 — "Other" (unknown) row: image viewer + Retry / Edit */}
    {unknownFlow && (
      <UnknownEntryFlow
        open
        captureId={unknownFlow.captureId}
        imageBase64={unknownFlow.imageBase64}
        canMutate={viewingSelf}
        userId={ownerId}
        apiBaseUrl={apiBaseUrl}
        onClose={() => setUnknownFlow(null)}
        onChanged={handleUnknownChanged}
        onDeleteWithUndo={({ captureId, imageBase64 }) => {
          setUnknownUndo({
            captureId,
            userId: ownerId,
            imageBase64,
            expiresAt: Date.now() + UNDO_SECONDS * 1000,
          });
          setUnknownFlow(null);
          reloadDiary();
        }}
      />
    )}

    {/* 2026-06-09 — undo banner for unknown capture deletion */}
    {unknownUndo && (
      <UnknownCaptureUndoBanner
        captureId={unknownUndo.captureId}
        userId={unknownUndo.userId}
        imageBase64={unknownUndo.imageBase64}
        expiresAt={unknownUndo.expiresAt}
        onUndo={async ({ captureId, userId }) => {
          await undoDeleteCapture({ captureId, userId });
          setUnknownUndo(null);
          reloadDiary();
        }}
        onExpire={() => {
          setUnknownUndo(null);
        }}
      />
    )}
    </>
  );
};

export default Dashboard;
