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
import React, { useState, useEffect, useRef, lazy, Suspense, useMemo, useCallback } from 'react';
import { flushSync } from 'react-dom';
import { Calendar, ChevronLeft, ChevronRight, Footprints, Smartphone } from 'lucide-react';
import TouchFeedbackButton from '../../shared/components/TouchFeedbackButton';
import { TeamMemberSearch, formatMemberSubtitle, subtitleCommunityId } from '../../features/team';
import TeamMemberProfileModal from '../../shared/components/TeamMemberProfileModal';
import { isFlagEnabled } from '../../config/featureFlags';
import { useNutritionRefresh } from '../../shared/context/NutritionRefreshContext';
import { DIARY_ANALYZING_POLL_MS } from '../../shared/constants/limits';
import { setVisibilityAwareInterval } from '../../shared/utils/visibilityAwareInterval';
import DashboardTabs from './DashboardTabs';
// ADR-0003 — delete-only unknown captures still use UnknownEntryFlow; classify/manual
// log for Other / Needs logging reuses ManualEntryPage (same as post-capture).
import UnknownEntryFlow from './UnknownEntryFlow';
import UnknownCaptureUndoBanner, { UNDO_SECONDS } from './UnknownCaptureUndoBanner';
import { undoDeleteCapture } from '../../features/captures';
import { deleteGoodHabit, undoDeleteGoodHabit, GoodHabitDetailModal } from '../../features/good-habits';
import { deleteMealById, undoMealDelete } from '../../features/nutrition';
import { parseAnalysisData } from '../../features/nutrition/services/nutritionDashboard/analysisHelpers';
import { prefetchMealDetails } from '../../features/nutrition/services/mealDetailCache';
import { deleteWeight, undoDeleteWeight } from '../../features/weight';
import {
  deleteEducationLog,
  undoEducationDelete,
} from '../../features/education/services/educationDashboardService';
import { isCaloriesBurnedTopic } from '../../features/education/services/educationFormatter';
import { DIARY_UNDO_SECONDS } from '../../features/diary/components/DiaryUndoRow';

// âœ… LAZY LOADING: Load tab components on-demand (only one visible at a time)
const NutritionDashboard = lazy(() => import('../../features/nutrition/components/NutritionDashboard'));
const WeightDashboard = lazy(() => import('../../features/weight/components/WeightDashboard'));
const EducationDashboard = lazy(() => import('../../features/education/components/EducationDashboard'));
const ManualEntryPage = lazy(() => import('./ManualEntryPage'));
// PR-C / ADR-0003 — mounted only when `ff.diary-feed` is enabled. The
// import call is still wrapped in `lazy()` so the bundle chunk for
// `features/diary/` is fetched on-demand the first time the tab is
// shown (zero-cost when the flag is OFF).
const DiaryFeed = lazy(() =>
  import('../../features/diary').then((m) => ({ default: m.DiaryFeed })),
);

/** Matches the inline calendar panel expand/collapse transition (duration-300). */
const CALENDAR_EXPAND_MS = 320;

/** Nearest scrollable ancestor (e.g. App.js `.ios-scroll-body` on Capacitor/Web). */
function getScrollParent(el) {
  if (!el) return null;
  let parent = el.parentElement;
  while (parent) {
    const { overflowY } = window.getComputedStyle(parent);
    if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') {
      return parent;
    }
    parent = parent.parentElement;
  }
  return document.scrollingElement || document.documentElement;
}

/** Noon on the diary day — keeps saves inside activity windows. */
function buildNoonTimestamp(date) {
  if (!date) return undefined;
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
}

async function retagCaptureType({ apiBaseUrl, captureId, userId, imageType }) {
  if (!captureId || !userId || !apiBaseUrl) return;
  await fetch(`${apiBaseUrl}/api/background-analysis/captures`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: captureId, userId, imageType }),
  });
}
// FEATURE DISABLED: const ScreenDashboard = lazy(() => import('./ScreenDashboard'));

/**
 * Unified Dashboard with tabs for Nutrition and Weight tracking
 * Replaces the separate Nutrition Dashboard and Weight Tracking pages
 * @param {string} initialTab - Optional tab to open initially ('nutrition' or 'weight')
 * @param {string} userRole - User's role for access control (coach, coCoach, admin, user)
 * @param {string} initialTab - Optional tab to open initially ('nutrition' | 'weight' | 'education')
 * @param {string} initialMealId - Optional meal ID to auto-open in Nutrition tab (deep link)
 */
const Dashboard = ({ user, onBack, apiBaseUrl, onMealDelete, initialTab, userRole = 'user', bmrUpdateKey = 0, educationRefreshKey = 0, watchBurnedCalories = 0, onWatchBurnedCaloriesReset = null, initialSelectedMember = null, initialDate = null, initialMealId = null, onStartBackgroundCaptureAi = null, onToast = null, tabVisitKey = 0 }) => {
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
  const { triggerRefresh: triggerNutritionRefresh, refreshKey: nutritionContextRefreshKey, analyzingCaptureIds: contextAnalyzingIds, pendingCaptureMeta } = useNutritionRefresh();

  const [activeTab, setActiveTab] = useState(() => {
    // Use initialTab prop if provided, otherwise restore from localStorage
    const validTabs = ['nutrition', 'weight', 'education', 'screen'];
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
  // Timeline date can lag selectedDate briefly while scrolling back to the
  // calendar after "Today" is tapped away from the top of the page.
  const [diaryTimelineDate, setDiaryTimelineDate] = useState(() => {
    if (initialDate) {
      const d = new Date(initialDate);
      if (!Number.isNaN(d.getTime())) return d;
    }
    return new Date();
  });
  const stickyHeaderRef = useRef(null);
  const calendarSectionRef = useRef(null);
  const scrollEndTimerRef = useRef(null);
  const scrollSessionRef = useRef(0);

  // Respond to deep-link prop changes while the component is already mounted.
  // The useState initializers above only run on first mount, so if a new
  // share link arrives while Dashboard is open we must imperatively update
  // the three seeded values here.
  useEffect(() => {
    if (!initialTab) return;
    const valid = ['nutrition', 'weight', 'education', 'screen'];
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
    if (!Number.isNaN(d.getTime())) {
      setSelectedDate(d);
      setDiaryTimelineDate(d);
    }
  }, [initialDate]);

  useEffect(() => () => {
    if (scrollEndTimerRef.current) clearTimeout(scrollEndTimerRef.current);
  }, []);

  const applySelectedDate = useCallback((date) => {
    setSelectedDate(date);
    setDiaryTimelineDate(date);
  }, []);

  const isCalendarSectionVisible = useCallback(() => {
    const calendarEl = calendarSectionRef.current;
    if (!calendarEl) return true;
    const headerBottom = stickyHeaderRef.current?.getBoundingClientRect().bottom ?? 0;
    const calendarTop = calendarEl.getBoundingClientRect().top;
    return calendarTop >= headerBottom - 4 && calendarTop < window.innerHeight;
  }, []);

  const handleDiaryDateButtonClick = useCallback(() => {
    const calendarVisible = isCalendarSectionVisible();

    setCalendarMonth(new Date(selectedDate));

    if (calendarVisible) {
      setShowCalendar((prev) => !prev);
      return;
    }

    // Scrolled down — expand the calendar for the current selection and scroll it into view.
    setShowCalendar(true);

    const session = scrollSessionRef.current + 1;
    scrollSessionRef.current = session;

    const scrollToCalendar = () => {
      const calendarEl = calendarSectionRef.current;
      if (!calendarEl) return;

      const margin = (stickyHeaderRef.current?.offsetHeight ?? 120) + 8;
      calendarEl.style.scrollMarginTop = `${margin}px`;

      let finished = false;
      const scrollRoot = getScrollParent(calendarEl);
      const scrollTarget = scrollRoot && scrollRoot !== document.documentElement
        ? scrollRoot
        : window;

      const complete = () => {
        if (finished || scrollSessionRef.current !== session) return;
        finished = true;
        scrollTarget.removeEventListener('scroll', onScroll);
        if (scrollEndTimerRef.current) {
          clearTimeout(scrollEndTimerRef.current);
          scrollEndTimerRef.current = null;
        }
      };

      const onScroll = () => {
        if (scrollEndTimerRef.current) clearTimeout(scrollEndTimerRef.current);
        scrollEndTimerRef.current = setTimeout(complete, 150);
      };

      scrollTarget.addEventListener('scroll', onScroll, { passive: true });
      calendarEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      scrollEndTimerRef.current = setTimeout(complete, 800);
    };

    const expandDelay = showCalendar ? 0 : CALENDAR_EXPAND_MS;
    setTimeout(() => {
      requestAnimationFrame(scrollToCalendar);
    }, expandDelay);
  }, [selectedDate, showCalendar, isCalendarSectionVisible]);

  // Determine which user's data to display (selected member or coach)
  const displayUser = selectedMember || user;

  // Clear diary-owned TZ when switching members so we don't flash the previous owner's zone.
  useEffect(() => {
    setDiaryOwnerTimezoneIana(null);
  }, [displayUser?.id, displayUser?.userId, selectedMember?.id, selectedMember?.userId]);

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
    if (tab === 'screen') {
      applySelectedDate(new Date());
    }
  };

  // ── ADR-0003 (revised) — "Other" tab hosting ─────────────────────────────
  // Food / Weight / Education now render their ORIGINAL dashboards (with their
  // own detail modals + optimistic updates). The shell only hosts the
  // unrecognised ("unknown") capture flow here. `diaryReloadKey` re-fetches
  // the Other feed after a retry / delete / undo.
  const ownerId = displayUser?.id || displayUser?.userId;

  const handleFoodEntriesLoaded = useCallback((entries) => {
    if (!ownerId) return;
    const foodIds = (entries || [])
      .filter((e) => e.kind === 'food' && !e.isUndoPlaceholder && e.payload?.id != null)
      .slice(0, 8)
      .map((e) => e.payload.id);
    if (foodIds.length === 0) return;
    void prefetchMealDetails({
      userId: ownerId,
      mealIds: foodIds,
      apiBaseUrl,
      concurrency: 3,
    });
  }, [ownerId, apiBaseUrl]);
  // Safety ref: prevents setState calls after Dashboard unmounts (e.g. user
  // navigates Home while an async AI retry is still in flight).
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);
  const [diaryReloadKey, setDiaryReloadKey] = useState(0);
  const reloadDiary = () => setDiaryReloadKey((k) => k + 1);
  const [weightReloadKey, setWeightReloadKey] = useState(0);
  const [diaryEducationRefreshKey, setDiaryEducationRefreshKey] = useState(0);
  // Unknown ("Other") row: delete-only → UnknownEntryFlow; classify → ManualEntryPage.
  const [unknownFlow, setUnknownFlow] = useState(null);
  const [classifyFlow, setClassifyFlow] = useState(null);

  // Set of capture IDs whose AI analysis is currently in flight.
  // Passed to DiaryFeed → OtherRow so the card shows an inline loading state
  // and prevents duplicate taps while the analysis runs.
  const [analyzingCaptureIds, setAnalyzingCaptureIds] = useState(() => new Set());
  // Ref prevents a second tap from firing a duplicate request for the same ID.
  const analyzingRef = useRef(new Set());

  // Stable key for polling while background AI runs (App.js Phase 2).
  const backgroundAnalyzingKey = useMemo(
    () => [...(contextAnalyzingIds ?? [])].sort().join(','),
    [contextAnalyzingIds],
  );

  // Merge Dashboard (Retry) + App.js (background AI) analyzing sets for diary cards.
  const mergedAnalyzingCaptureIds = useMemo(() => {
    const merged = new Set(analyzingCaptureIds);
    if (contextAnalyzingIds) {
      contextAnalyzingIds.forEach((id) => merged.add(id));
    }
    return merged;
  }, [analyzingCaptureIds, contextAnalyzingIds]);

  // 2026-06-09 — undo state for unknown capture deletion (shell-level)
  const [unknownUndo, setUnknownUndo] = useState(null);
  // Multi-undo map so back-to-back swipe-deletes each keep an inline undo card.
  // Key: `${kind}:${entryId}` → undo snapshot
  const [diaryUndos, setDiaryUndos] = useState({});
  // Instant card restores while undo API + diary reload catch up (same key scheme).
  const [diaryOptimisticEntries, setDiaryOptimisticEntries] = useState({});

  const diaryUndoKey = useCallback(
    (kind, entryId) => `${kind}:${String(entryId)}`,
    [],
  );

  const upsertDiaryUndo = useCallback((snapshot) => {
    if (!snapshot?.entryId) return;
    const key = diaryUndoKey(snapshot.kind, snapshot.entryId);
    setDiaryUndos((prev) => ({ ...prev, [key]: snapshot }));
    setDiaryOptimisticEntries((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, [diaryUndoKey]);

  const removeDiaryUndo = useCallback((kind, entryId) => {
    const key = diaryUndoKey(kind, entryId);
    setDiaryUndos((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, [diaryUndoKey]);

  const clearAllDiaryUndos = useCallback(() => {
    setDiaryUndos({});
    setDiaryOptimisticEntries({});
  }, []);

  // Drop in-flight undo/restore UI when the selected day or diary subject changes.
  useEffect(() => {
    clearAllDiaryUndos();
  }, [diaryTimelineDate, clearAllDiaryUndos]);

  useEffect(() => {
    clearAllDiaryUndos();
  }, [ownerId, clearAllDiaryUndos]);

  const diaryUndoList = useMemo(() => Object.values(diaryUndos), [diaryUndos]);
  const diaryOptimisticList = useMemo(
    () => Object.values(diaryOptimisticEntries),
    [diaryOptimisticEntries],
  );

  // { kind, entryId, userId, message, expiresAt }
  const viewingSelf = !selectedMember || selectedMember.isSelf;

  // ── Timeline imperative handles (ff.diary-timeline) ──────────────────────
  // Each ref is written by the corresponding hidden dashboard on every render.
  // When a timeline row is tapped, the shell calls the matching ref to open
  // the existing modal inside the relevant dashboard component.
  const nutritionOpenRef = useRef(null);
  const [diaryOwnerTimezoneIana, setDiaryOwnerTimezoneIana] = useState(null);
  const weightOpenRef    = useRef(null);
  const educationOpenRef = useRef(null);
  const [goodHabitDetail, setGoodHabitDetail] = useState(null);

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

  // Refetch all dashboard data whenever the Diary tab is opened again.
  const prevTabVisitKeyRef = useRef(tabVisitKey);
  useEffect(() => {
    if (!tabVisitKey || tabVisitKey === prevTabVisitKeyRef.current) return;
    prevTabVisitKeyRef.current = tabVisitKey;
    reloadDiary();
    setWeightReloadKey((k) => k + 1);
    setDiaryEducationRefreshKey((k) => k + 1);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- reloadDiary is stable
  }, [tabVisitKey]);

  // Poll the diary feed while background AI is in flight so the card
  // auto-upgrades from "Analyzing…" to food / weight / education rows.
  // Pauses while the tab/app is hidden to avoid wasted /api/diary/list traffic.
  useEffect(() => {
    if (!backgroundAnalyzingKey) return undefined;
    return setVisibilityAwareInterval(() => reloadDiary(), DIARY_ANALYZING_POLL_MS);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- reloadDiary is stable
  }, [backgroundAnalyzingKey]);

  // Refresh hidden weight/education dashboards when background AI finishes so
  // timeline tap-to-open finds the new row without leaving the diary tab.
  const prevBackgroundAnalyzingKeyRef = useRef('');
  useEffect(() => {
    const prev = prevBackgroundAnalyzingKeyRef.current;
    prevBackgroundAnalyzingKeyRef.current = backgroundAnalyzingKey;
    if (prev && !backgroundAnalyzingKey) {
      setWeightReloadKey((k) => k + 1);
      setDiaryEducationRefreshKey((k) => k + 1);
    }
  }, [backgroundAnalyzingKey]);

  // ── Diary entry tap dispatcher (Open/Closed Principle) ───────────────────
  //
  // To add a new entry kind: add one entry to KNOWN_KIND_HANDLERS below.
  // The core dispatch loop (handleEntryOpen) is NEVER modified for new kinds.
  //
  // KNOWN_KIND_HANDLERS maps entry.kind → synchronous open fn.
  // Each handler receives the full diary entry so hidden dashboards can
  // open from the row payload when their own lists have not loaded yet.
  //
  // The 'unknown' path is handled separately because it requires an async
  // AI retry pipeline with its own resilience contract (see below).

  // Registry: add new diary kinds here — zero changes elsewhere.
  const KNOWN_KIND_HANDLERS = {
    food:      (entry) => nutritionOpenRef.current?.(entry),
    weight:    (entry) => weightOpenRef.current?.(entry),
    education: (entry) => educationOpenRef.current?.(entry),
    watch:     (entry) => educationOpenRef.current?.(entry),
    'good-habit': (entry) => setGoodHabitDetail(entry),
  };

  // ── Unknown / Needs logging tap → same ManualEntryPage as post-capture ──
  const handleUnknownTap = (entry) => {
    const p = entry.payload || {};
    const captureIdRaw = entry.capture?.id ?? p.id;
    const captureId = captureIdRaw != null && captureIdRaw !== ''
      ? String(captureIdRaw) : '';

    // Guard: prevent double-tap opening two modals.
    if (captureId && analyzingRef.current.has(captureId)) return;

    // Coach viewing member diary — read-only / legacy delete flow only.
    if (!viewingSelf) {
      setUnknownFlow({
        captureId,
        imageBase64: p.imageBase64,
        diaryDate: selectedDate,
        originalCapturedAt: entry.capturedAt ?? null,
        initialAiResult: null,
        deleteOnly: true,
      });
      return;
    }

    setClassifyFlow({
      captureId,
      imageBase64: p.imageBase64 || null,
      originalCapturedAt: entry.capturedAt ?? null,
    });
  };

  // Core dispatch — closed for modification; open for new kinds via KNOWN_KIND_HANDLERS.
  const handleEntryOpen = (entry) => {
    const knownHandler = KNOWN_KIND_HANDLERS[entry.kind];
    if (knownHandler) { knownHandler(entry); return; }
    if (entry.kind === 'unknown') { handleUnknownTap(entry); }
  };

  /** Short label shown on the inline diary undo card. */
  const diaryEntryUndoTitle = useCallback((entry) => {
    if (!entry) return 'Entry';
    const p = entry.payload || {};
    switch (entry.kind) {
      case 'food':
        return parseAnalysisData(p.analysisData)?.name || 'Food entry';
      case 'weight':
        return p.weight != null ? `${p.weight} kg` : 'Weight entry';
      case 'education':
        return p.topic || 'Education entry';
      case 'watch':
        return p.topic || 'Smartwatch entry';
      case 'unknown':
        return 'Capture';
      case 'good-habit':
        return entry.payload?.habitType === 'before_after' ? 'Before vs After' : 'Good Habit';
      default:
        return 'Entry';
    }
  }, []);

  /** Shallow snapshot only — never deep-clone (food photos are large base64). */
  const snapshotDiaryEntry = useCallback((entry) => {
    if (!entry) return null;
    return {
      kind: entry.kind,
      capturedAt: entry.capturedAt,
      capture: entry.capture || undefined,
      payload: entry.payload || {},
    };
  }, []);

  const buildDiaryUndo = useCallback(({
    kind, entryId, expiresAt, topic = null, title = null, capturedAt = null, originalEntry = null,
  }) => ({
    kind,
    entryId,
    userId: ownerId,
    topic,
    title: title || 'Entry',
    capturedAt: capturedAt || new Date().toISOString(),
    expiresAt: expiresAt ?? Date.now() + DIARY_UNDO_SECONDS * 1000,
    ttlSeconds: DIARY_UNDO_SECONDS,
    originalEntry: originalEntry ? snapshotDiaryEntry(originalEntry) : null,
  }), [ownerId, snapshotDiaryEntry]);

  const handleEntryDeleteWithUndo = useCallback(({
    kind, entryId, expiresAt, topic = null, title = null, capturedAt = null,
  }) => {
    upsertDiaryUndo(buildDiaryUndo({
      kind, entryId, expiresAt, topic, title, capturedAt,
    }));
    reloadDiary();
  }, [buildDiaryUndo, reloadDiary, upsertDiaryUndo]);

  const handleMealDeleteWithUndo = useCallback(({ mealId, expiresAt }) => {
    onMealDelete?.(mealId);
    handleEntryDeleteWithUndo({ kind: 'food', entryId: mealId, expiresAt, title: 'Food entry' });
    triggerNutritionRefresh({ immediate: true, source: 'meal-modal-delete' });
  }, [onMealDelete, handleEntryDeleteWithUndo, triggerNutritionRefresh]);

  const handleMealDeleteUndoCancel = useCallback(({ mealId } = {}) => {
    if (mealId != null) removeDiaryUndo('food', mealId);
    else clearAllDiaryUndos();
  }, [removeDiaryUndo, clearAllDiaryUndos]);

  const handleWeightDeleteWithUndo = useCallback(({ entryId, expiresAt }) => {
    handleEntryDeleteWithUndo({ kind: 'weight', entryId, expiresAt, title: 'Weight entry' });
    setWeightReloadKey((k) => k + 1);
  }, [handleEntryDeleteWithUndo]);

  const handleWeightDeleteUndoCancel = useCallback(({ entryId } = {}) => {
    if (entryId != null) removeDiaryUndo('weight', entryId);
    else clearAllDiaryUndos();
    setWeightReloadKey((k) => k + 1);
  }, [removeDiaryUndo, clearAllDiaryUndos]);

  const refreshExerciseCalories = (source) => {
    onWatchBurnedCaloriesReset?.();
    triggerNutritionRefresh({ immediate: true, source });
  };

  const handleEducationDeleteWithUndo = useCallback(({ entryId, expiresAt, topic = null }) => {
    const kind = isCaloriesBurnedTopic(topic) ? 'watch' : 'education';
    handleEntryDeleteWithUndo({
      kind,
      entryId,
      expiresAt,
      topic,
      title: topic || (kind === 'watch' ? 'Smartwatch entry' : 'Education entry'),
    });
    setDiaryEducationRefreshKey((k) => k + 1);
    if (kind === 'watch') {
      refreshExerciseCalories('diary-modal-delete-watch');
    }
  }, [handleEntryDeleteWithUndo, triggerNutritionRefresh, onWatchBurnedCaloriesReset]);

  const handleEducationDeleteUndoCancel = useCallback(({ entryId, topic = null } = {}) => {
    if (entryId != null) {
      const kind = isCaloriesBurnedTopic(topic) ? 'watch' : 'education';
      removeDiaryUndo(kind, entryId);
    } else {
      clearAllDiaryUndos();
    }
    setDiaryEducationRefreshKey((k) => k + 1);
  }, [removeDiaryUndo, clearAllDiaryUndos]);

  const affectsExerciseCalories = (entry) => {
    if (!entry) return false;
    if (entry.kind === 'watch') return true;
    if (entry.kind === 'education') {
      return isCaloriesBurnedTopic(entry.payload?.topic);
    }
    return false;
  };

  const restoreDiaryEntry = async ({ kind, entryId, userId, topic = null }) => {
    switch (kind) {
      case 'food':
        await undoMealDelete({ apiBaseUrl, id: entryId, userId });
        triggerNutritionRefresh({ immediate: true, source: 'diary-undo' });
        break;
      case 'weight': {
        const { ok, data } = await undoDeleteWeight({ id: entryId, userId });
        if (!ok || !data?.success) {
          throw new Error(data?.message || 'Failed to restore weight entry');
        }
        setWeightReloadKey((k) => k + 1);
        break;
      }
      case 'education':
      case 'watch':
        await undoEducationDelete({ apiBaseUrl, userId, logId: entryId });
        setDiaryEducationRefreshKey((k) => k + 1);
        if (affectsExerciseCalories({ kind, payload: { topic } })) {
          refreshExerciseCalories('diary-undo-watch');
        }
        break;
      case 'unknown':
        await undoDeleteCapture({ captureId: entryId, userId });
        break;
      case 'good-habit':
        await undoDeleteGoodHabit({ userId, id: entryId });
        break;
      default:
        return;
    }
    reloadDiary();
  };

  /**
   * Optimistic undo — swap undo row → real card on this click tick.
   * Server restore + diary reload run in the background (no UI wait).
   */
  const handleDiaryUndoRestore = (snapshot) => {
    if (!snapshot?.entryId) return;
    const key = diaryUndoKey(snapshot.kind, snapshot.entryId);
    // Reuse the snapshot already stored at delete time — do not re-clone photos.
    const restored = snapshot.originalEntry || null;

    // Force the card to paint before any network work starts.
    flushSync(() => {
      setDiaryUndos((prev) => {
        if (!prev[key]) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      });
      if (restored) {
        setDiaryOptimisticEntries((prev) => ({ ...prev, [key]: restored }));
      }
    });

    restoreDiaryEntry(snapshot).catch((err) => {
      console.error('[Dashboard] diary undo failed:', err);
      setDiaryOptimisticEntries((prev) => {
        if (!prev[key]) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      });
      upsertDiaryUndo(snapshot);
      alert(err?.message || 'Failed to restore. Please try again.');
    });
  };

  const handleDiaryUndoExpire = useCallback((snapshot) => {
    if (!snapshot?.entryId) return;
    removeDiaryUndo(snapshot.kind, snapshot.entryId);
  }, [removeDiaryUndo]);

  // Swipe-to-delete for timeline rows including unknown ("Other") rows.
  // Allowed for self and for coaches viewing a downline member (same as
  // NutritionDashboard meal deletes — APIs receive ownerId = diary subject).
  const handleEntryDelete = async (entry) => {
    if (!entry || !ownerId) return;
    const entryId = entry.payload?.id;
    if (!entryId) return;

    // Show inline undo in the same card slot immediately (before API round-trip).
    // Upsert into the map so back-to-back deletes each keep their own undo card.
    const undoSnapshot = buildDiaryUndo({
      kind: entry.kind,
      entryId,
      topic: entry.payload?.topic ?? null,
      title: diaryEntryUndoTitle(entry),
      capturedAt: entry.capturedAt,
      originalEntry: entry,
    });
    upsertDiaryUndo(undoSnapshot);

    try {
      switch (entry.kind) {
        case 'food':
          await deleteMealById({ apiBaseUrl, id: entryId, userId: ownerId });
          triggerNutritionRefresh({ immediate: true, source: 'diary-swipe-delete' });
          break;
        case 'weight': {
          const { ok, data } = await deleteWeight({ userId: ownerId, entryId });
          if (!ok || !data?.success) {
            throw new Error(data?.message || 'Failed to delete weight entry');
          }
          setWeightReloadKey((k) => k + 1);
          break;
        }
        case 'education':
        case 'watch': {
          await deleteEducationLog({ apiBaseUrl, userId: ownerId, logId: entryId });
          setDiaryEducationRefreshKey((k) => k + 1);
          if (affectsExerciseCalories(entry)) {
            refreshExerciseCalories('diary-swipe-delete-watch');
          }
          break;
        }
        case 'unknown': {
          // Direct capture delete (no associated domain row for unknown entries).
          const { deleteCapture } = await import('../../features/captures');
          await deleteCapture({ captureId: entryId, userId: ownerId });
          break;
        }
        case 'good-habit':
          await deleteGoodHabit({ userId: ownerId, id: entryId });
          break;
        default:
          removeDiaryUndo(entry.kind, entryId);
          return;
      }

      reloadDiary();
    } catch (err) {
      console.error('[Dashboard] diary swipe-delete failed:', err);
      removeDiaryUndo(entry.kind, entryId);
      alert(err?.message || 'Failed to delete. Please try again.');
      reloadDiary();
    }
  };

  const handleUnknownChanged = (change = {}) => {
    // Read diaryDate before clearing the flow — this is the date that was
    // selected when the user opened the unknown entry (the single source of
    // truth for which diary day this action belongs to).
    const diaryDate = unknownFlow?.diaryDate;
    setUnknownFlow(null);
    // If the user somehow navigated to a different date while the modal was
    // open, restore the original diary date so the reload targets the correct
    // day instead of wherever selectedDate currently points.
    if (diaryDate && diaryDate.toDateString() !== selectedDate.toDateString()) {
      applySelectedDate(diaryDate);
    }
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
      <div ref={stickyHeaderRef} className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
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
            <div className="p-2 md:p-3 w-9 h-9 md:w-11 md:h-11" aria-hidden="true" />

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
                      {(() => {
                        const subtitle = formatMemberSubtitle(
                          selectedMember.email,
                          subtitleCommunityId(selectedMember),
                        );
                        return subtitle
                          ? subtitle
                          : `Viewing ${selectedMember.userName}'s data`;
                      })()}
                    </button>
                  )
                  : 'Track your wellness journey'
                }
              </p>
            </div>

            {/* Calendar button — for the steps/screen tabs (disabled) AND the
                single-page Diary. In the Diary, this shell-level date button
                toggles the month grid for the currently selected day and scrolls
                the calendar into view when the user is lower on the page. */}
            {(activeTab === 'screen') && (
              <TouchFeedbackButton 
                onClick={() => { setShowCalendar(prev => !prev); setCalendarMonth(new Date(selectedDate)); }} 
                className="p-2 md:p-3 hover:bg-gray-100 rounded-xl transition-colors"
                ariaLabel="Toggle calendar"
              >
                <Calendar className="h-5 w-5 text-gray-700" />
              </TouchFeedbackButton>
            )}
            {diaryEnabled && (
              <div className="flex items-center gap-1">
                <TouchFeedbackButton
                  onClick={handleDiaryDateButtonClick}
                  className="flex items-center gap-1.5 px-3 py-2 md:px-4 md:py-2.5 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-colors"
                  ariaLabel="Toggle date picker"
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
              processingCount={(contextAnalyzingIds?.size ?? 0) + analyzingCaptureIds.size}
            />
          )}
          {/* Steps + Screen tab buttons remain DISABLED — see
              feature-disabled banners in App.js. When re-enabled,
              extend DashboardTabs.jsx, not this file. */}
        </div>
      </div>

      {/* Inline Calendar — month-grid date picker. Shown for the
          (disabled) steps/screen tabs AND the single-page Diary. */}
      {(activeTab === 'screen' || diaryEnabled) && (
        <div
          ref={calendarSectionRef}
          className={`bg-white shadow-sm overflow-hidden transition-all duration-300 ease-in-out ${
          showCalendar ? 'max-h-[32rem] opacity-100' : 'max-h-0 opacity-0 pointer-events-none'
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
                          applySelectedDate(day.date);
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
              {/* Processing count pill — visible at top of timeline whenever
                  background AI is running so the user knows items are pending. */}
              {(() => {
                const count = (contextAnalyzingIds?.size ?? 0) + analyzingCaptureIds.size;
                return count > 0 ? (
                  <div className="flex items-center gap-2 mx-3 mt-2 mb-1 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-full w-fit">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                    </span>
                    <span className="text-xs font-medium text-amber-700">
                      {count} item{count > 1 ? 's' : ''} processing…
                    </span>
                  </div>
                ) : null;
              })()}
              <div className="w-full md:max-w-2xl lg:max-w-4xl md:mx-auto px-3 md:px-4 pb-40 mt-2">
                <DiaryFeed
                  key={ownerId || 'self'}
                  showTimeline
                  refreshKey={diaryReloadKey}
                  ownerUserId={ownerId}
                  viewerUserId={user?.id || user?.userId}
                  timezoneSource={displayUser}
                  date={diaryTimelineDate}
                  onEntryOpen={handleEntryOpen}
                  onEntryDelete={handleEntryDelete}
                  canDelete
                  pendingUndos={diaryUndoList}
                  optimisticEntries={diaryOptimisticList}
                  onOptimisticEntryConsumed={(entry) => {
                    if (!entry?.payload?.id) return;
                    const key = diaryUndoKey(entry.kind, entry.payload.id);
                    setDiaryOptimisticEntries((prev) => {
                      if (!prev[key]) return prev;
                      const next = { ...prev };
                      delete next[key];
                      return next;
                    });
                  }}
                  onUndoRestore={handleDiaryUndoRestore}
                  onUndoExpire={handleDiaryUndoExpire}
                  analyzingCaptureIds={mergedAnalyzingCaptureIds}
                  pendingCaptureMeta={pendingCaptureMeta}
                  onOwnerTimezoneChange={setDiaryOwnerTimezoneIana}
                  onFoodEntriesLoaded={handleFoodEntriesLoaded}
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
                  onMealDeleteWithUndo={handleMealDeleteWithUndo}
                  onMealDeleteUndoCancel={handleMealDeleteUndoCancel}
                  hideHeader
                  hideDateStrip
                  hideOverview
                  deferDataFetch
                  selectedDate={selectedDate}
                  setSelectedDate={applySelectedDate}
                  bmrUpdateKey={bmrUpdateKey}
                  watchBurnedCalories={watchBurnedCalories}
                  initialMealId={initialMealId}
                  openRef={nutritionOpenRef}
                  timezoneIana={diaryOwnerTimezoneIana}
                />
                <WeightDashboard
                  user={displayUser}
                  apiBaseUrl={apiBaseUrl}
                  hideHeader
                  hideOverview
                  deferDataFetch
                  selectedDate={selectedDate}
                  refreshKey={weightReloadKey}
                  initialEntryId={initialMealId}
                  openRef={weightOpenRef}
                  onAfterModalClose={reloadDiary}
                  onDeleteWithUndo={handleWeightDeleteWithUndo}
                  onDeleteUndoCancel={handleWeightDeleteUndoCancel}
                />
                <EducationDashboard
                  user={displayUser}
                  apiBaseUrl={apiBaseUrl}
                  hideHeader
                  hideOverview
                  deferDataFetch
                  selectedDate={selectedDate}
                  refreshKey={educationRefreshKey + diaryEducationRefreshKey}
                  initialEntryId={initialMealId}
                  openRef={educationOpenRef}
                  onAfterModalClose={reloadDiary}
                  onDeleteWithUndo={handleEducationDeleteWithUndo}
                  onDeleteUndoCancel={handleEducationDeleteUndoCancel}
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
                onMealDeleteWithUndo={handleMealDeleteWithUndo}
                onMealDeleteUndoCancel={handleMealDeleteUndoCancel}
                hideHeader={true}
                hideDateStrip={true}
                hideOverview={true}
                selectedDate={selectedDate}
                setSelectedDate={applySelectedDate}
                bmrUpdateKey={bmrUpdateKey}
                watchBurnedCalories={watchBurnedCalories}
                initialMealId={initialMealId}
                timezoneIana={diaryOwnerTimezoneIana}
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
                onDeleteWithUndo={handleWeightDeleteWithUndo}
                onDeleteUndoCancel={handleWeightDeleteUndoCancel}
              />

              <EducationDashboard
                user={displayUser}
                apiBaseUrl={apiBaseUrl}
                hideHeader={true}
                hideOverview={true}
                selectedDate={selectedDate}
                refreshKey={educationRefreshKey + diaryEducationRefreshKey}
                initialEntryId={initialMealId}
                onDeleteWithUndo={handleEducationDeleteWithUndo}
                onDeleteUndoCancel={handleEducationDeleteUndoCancel}
              />

              {/* "Other" — unrecognised ("unknown") captures only. Reuses the
                  diary read-model filtered to `unknown`, preserving the image
                  viewer + Retry / Edit / undo flow handled below. */}
              <div className="w-full md:max-w-2xl lg:max-w-4xl md:mx-auto px-3 md:px-4 pb-40 mt-2">
                <h2 className="text-sm font-semibold text-gray-500 px-1 mb-2 mt-4">Other</h2>
                <DiaryFeed
                  key={`other-${ownerId || 'self'}`}
                  refreshKey={diaryReloadKey}
                  ownerUserId={ownerId}
                  viewerUserId={user?.id || user?.userId}
                  timezoneSource={displayUser}
                  date={diaryTimelineDate}
                  filterKinds={['unknown']}
                  onEntryOpen={handleEntryOpen}
                  onEntryDelete={handleEntryDelete}
                  canDelete
                  pendingUndos={diaryUndoList.filter((u) => u.kind === 'unknown')}
                  optimisticEntries={diaryOptimisticList.filter((e) => e.kind === 'unknown')}
                  onOptimisticEntryConsumed={(entry) => {
                    if (!entry?.payload?.id) return;
                    const key = diaryUndoKey(entry.kind, entry.payload.id);
                    setDiaryOptimisticEntries((prev) => {
                      if (!prev[key]) return prev;
                      const next = { ...prev };
                      delete next[key];
                      return next;
                    });
                  }}
                  onUndoRestore={handleDiaryUndoRestore}
                  onUndoExpire={handleDiaryUndoExpire}
                  analyzingCaptureIds={mergedAnalyzingCaptureIds}
                  pendingCaptureMeta={pendingCaptureMeta}
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
              onMealDeleteWithUndo={handleMealDeleteWithUndo}
              onMealDeleteUndoCancel={handleMealDeleteUndoCancel}
              hideHeader={true}
              hideOverview={true}
              selectedDate={selectedDate}
              setSelectedDate={applySelectedDate}
              bmrUpdateKey={bmrUpdateKey}
              watchBurnedCalories={watchBurnedCalories}
              initialMealId={initialMealId}
              timezoneIana={diaryOwnerTimezoneIana}
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
              onDeleteWithUndo={handleWeightDeleteWithUndo}
              onDeleteUndoCancel={handleWeightDeleteUndoCancel}
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
              onDeleteWithUndo={handleEducationDeleteWithUndo}
              onDeleteUndoCancel={handleEducationDeleteUndoCancel}
            />
          )}
          </>
          )}

          {/* FEATURE DISABLED: Screen tab content
          {activeTab === 'screen' && (
            <ScreenDashboard
              key={displayUser?.id || displayUser?.userId || 'self'}
              user={displayUser}
              apiBaseUrl={apiBaseUrl}
              hideHeader={true}
              selectedDate={selectedDate}
              setSelectedDate={(d) => { applySelectedDate(d); setShowCalendar(false); }}
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

    {goodHabitDetail && (
      <GoodHabitDetailModal
        entry={goodHabitDetail}
        ownerUserId={ownerId}
        timezoneIana={diaryOwnerTimezoneIana}
        onClose={() => setGoodHabitDetail(null)}
      />
    )}

    {/* ADR-0003 — classify / manual log: same ManualEntryPage as post-capture */}
    {classifyFlow && viewingSelf && (
      <Suspense fallback={null}>
        <ManualEntryPage
          userId={ownerId}
          apiBaseUrl={apiBaseUrl}
          captureId={classifyFlow.captureId}
          imageBase64={classifyFlow.imageBase64}
          originalCapturedAt={classifyFlow.originalCapturedAt}
          discardCaptureOnCancel={false}
          onBack={() => {
            setClassifyFlow(null);
            reloadDiary();
          }}
          onSaved={() => {
            setClassifyFlow(null);
            reloadDiary();
            // Score refresh runs from ManualEntryPage after promote/save completes.
            setWeightReloadKey((k) => k + 1);
            setDiaryEducationRefreshKey((k) => k + 1);
          }}
          onStartBackgroundAi={({ reservationId }) => {
            const flow = classifyFlow;
            setClassifyFlow(null);
            onStartBackgroundCaptureAi?.({
              captureId: flow.captureId,
              imageBase64: flow.imageBase64,
              userId: ownerId,
              reservationId: reservationId || null,
            });
            reloadDiary();
          }}
          onToast={onToast}
        />
      </Suspense>
    )}

    {/* ADR-0003 — delete-only / coach view for unknown captures */}
    {unknownFlow && (
      <UnknownEntryFlow
        open
        captureId={unknownFlow.captureId}
        imageBase64={unknownFlow.imageBase64}
        initialAiResult={unknownFlow.initialAiResult ?? null}
        diaryDate={unknownFlow.diaryDate ?? null}
        originalCapturedAt={unknownFlow.originalCapturedAt ?? null}
        deleteOnly={unknownFlow.deleteOnly ?? false}
        canMutate={viewingSelf}
        userId={ownerId}
        userName={user?.userName || user?.username || user?.name || null}
        userEmail={user?.email || user?.Email || null}
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