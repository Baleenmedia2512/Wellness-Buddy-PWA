/**
 * frontend/src/features/diary/components/DiaryFeed.jsx
 *
 * Cards-only newest-first feed shell (PR-C / ADR-0003).
 *
 * Renders the response of `GET /api/diary/list` as a flat scrollable
 * list. Each entry is dispatched to one of the five row components in
 * `./rows` via the kind → component lookup table.
 *
 * Owns no async work directly — that's `useDiary`'s job. Owns no
 * business decisions about visibility — that's the parent
 * `Dashboard.js`'s job (mounting the Diary tab is gated on
 * `ff.diary-feed` at the call site, not here).
 *
 * Date + member selection are passed in as props so this component
 * can be mounted under any shell (the current `Dashboard.js`, a future
 * embedded coach-view modal, an admin overview, etc.).
 *
 * `showTimeline` (ff.diary-timeline) — when true the entries are
 * rendered inside a vertical timeline layout with a date-group header
 * and left-side time labels instead of the default flat card list.
 * The existing row components (FoodRow, WeightRow, etc.) are
 * unchanged — the timeline is a presentation wrapper only.
 */

import React, { useMemo, useEffect, useState, useCallback } from 'react';
import { AlertCircle } from 'lucide-react';
import { useDiary } from '../hooks/useDiary';
import { useDiaryWeightPreviousMap } from '../hooks/useDiaryWeightPreviousMap';
import ROWS_BY_KIND, { OtherRow } from './rows';
import DiaryUndoRow, { DIARY_UNDO_SECONDS } from './DiaryUndoRow';
import { EmojiOrNative } from '../../../shared/components/icons/EmojiImage';
import { formatBusinessTime, formatOwnerDayLabel } from '../../../shared/utils/datetimeUtils';
import { resolveDiaryTimezone } from '../utils/diaryTimezone';
import { isStalePendingAnalysis, filterPendingCaptureMetaForOwner } from '../utils/stalePending';
import { getProfile } from '../../user/services/user.api';

/** Merge active undo placeholders into the feed at each deleted entry's sort position. */
function withPendingUndoPlaceholders(entries, pendingUndos) {
  const list = Array.isArray(pendingUndos)
    ? pendingUndos.filter((u) => u?.entryId != null)
    : (pendingUndos?.entryId != null ? [pendingUndos] : []);
  if (list.length === 0) return entries;

  const deletedKeys = new Set(list.map((u) => `${u.kind}:${String(u.entryId)}`));
  const withoutDeleted = entries.filter((e) => {
    if (e.isUndoPlaceholder) return true;
    return !deletedKeys.has(`${e.kind}:${String(e.payload?.id ?? '')}`);
  });
  const placeholders = list.map((u) => ({
    kind: u.kind,
    capturedAt: u.capturedAt || new Date().toISOString(),
    isUndoPlaceholder: true,
    payload: { id: u.entryId },
    undo: u,
  }));
  return [...withoutDeleted, ...placeholders].sort(
    (a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime(),
  );
}

/** Re-insert restored entries instantly while undo API + reload catch up. */
function withOptimisticRestores(entries, optimisticEntries) {
  const list = Array.isArray(optimisticEntries)
    ? optimisticEntries.filter(Boolean)
    : (optimisticEntries ? [optimisticEntries] : []);
  if (list.length === 0) return entries;

  let next = entries;
  for (const optimisticEntry of list) {
    const entryId = String(optimisticEntry.payload?.id ?? '');
    if (!entryId) continue;
    const alreadyPresent = next.some(
      (e) =>
        !e.isUndoPlaceholder
        && e.kind === optimisticEntry.kind
        && String(e.payload?.id ?? '') === entryId,
    );
    if (alreadyPresent) continue;
    next = [...next, optimisticEntry];
  }
  if (next === entries) return entries;
  return next.sort(
    (a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime(),
  );
}

const SKELETON_ROWS = 6;

/** Hide stale or duplicate "Analyzing…" rows in the diary feed. */
function dedupePendingDiaryEntries(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return entries;

  const entryCaptureId = (entry) => {
    const id = entry.capture?.id ?? entry.payload?.id;
    if (id == null || id === '') return '';
    return String(id);
  };
  const isPendingAnalysisEntry = (entry) =>
    entry.kind === 'unknown'
    && entry.payload?.isPendingAnalysis === true
    && !isStalePendingAnalysis(entry.capturedAt);

  const resolvedCaptureIds = new Set();
  for (const entry of entries) {
    if (isPendingAnalysisEntry(entry)) continue;
    const captureId = entryCaptureId(entry);
    if (captureId !== '') resolvedCaptureIds.add(captureId);
  }

  const seenPendingCaptureIds = new Set();
  return entries.filter((entry) => {
    if (!isPendingAnalysisEntry(entry)) return true;
    const captureId = entryCaptureId(entry);
    if (captureId === '') return true;
    if (resolvedCaptureIds.has(captureId)) return false;
    if (seenPendingCaptureIds.has(captureId)) return false;
    seenPendingCaptureIds.add(captureId);
    return true;
  });
}

function formatTimelineTime(iso, timezoneIana) {
  if (!iso) return '';
  return formatBusinessTime(iso, timezoneIana);
}

/**
 * Returns a human-readable date header for the timeline:
 *   today     → "Today · Jun 18, 2026"
 *   yesterday → "Yesterday · Jun 17, 2026"
 *   other     → "Jun 16, 2026"
 *
 * `dateStr` is `YYYY-MM-DD` business calendar date from the API.
 */
function formatTimelineDate(dateStr, timezoneIana) {
  return formatOwnerDayLabel(dateStr, timezoneIana);
}

/**
 * Wraps a single diary row inside a timeline entry: left-side time
 * label + vertical connector to the next entry.
 *
 * @param {{ entry: object, isLast: boolean, children: React.ReactNode }} props
 */
function TimelineEntryWrapper({ isLast, children }) {
  return (
    <div className="flex gap-3 items-start">
      {/* Left column: vertical connector only — time is shown inside the tile */}
      <div className="flex flex-col items-center" style={{ minWidth: '1rem' }}>
        <div className="w-2 h-2 rounded-full bg-emerald-400 mt-3 shrink-0" aria-hidden="true" />
        {!isLast && (
          <div
            className="flex-1 mt-1 w-px bg-gray-200"
            style={{ minHeight: '1.25rem' }}
            aria-hidden="true"
          />
        )}
      </div>
      {/* Entry card */}
      <div className="flex-1 pb-3 min-w-0">
        {children}
      </div>
    </div>
  );
}

function FeedSkeleton() {
  return (
    <div className="space-y-3" data-testid="diary-feed-skeleton">
      {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
        <div
          key={i}
          className="bg-white rounded-xl border border-gray-100 p-3 flex items-center gap-3 animate-pulse"
        >
          <div className="w-12 h-12 bg-gray-200 rounded-lg" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-3/5 bg-gray-200 rounded" />
            <div className="h-3 w-2/5 bg-gray-200 rounded" />
          </div>
          <div className="h-6 w-12 bg-gray-200 rounded" />
        </div>
      ))}
    </div>
  );
}

function FeedError({ error, onRetry }) {
  const isAuth = error?.status === 401 || error?.status === 403;
  const heading = isAuth
    ? "You don't have access to this diary"
    : 'Could not load the diary';
  return (
    <div
      className="text-center py-12 px-4 flex flex-col items-center"
      data-testid="diary-feed-error"
    >
      <AlertCircle className="w-10 h-10 text-red-400 mb-3" aria-hidden="true" />
      <p className="text-base font-semibold text-gray-900 mb-1">{heading}</p>
      <p className="text-sm text-gray-500 mb-5">
        {error?.message || 'Something went wrong.'}
      </p>
      {!isAuth && (
        <button
          type="button"
          onClick={onRetry}
          className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white px-6 py-3 rounded-xl font-semibold shadow"
        >
          Try Again
        </button>
      )}
    </div>
  );
}

function FeedEmpty({ date, isSelf, filterKinds }) {
  const isUnknownOnly =
    Array.isArray(filterKinds) &&
    filterKinds.length === 1 &&
    filterKinds[0] === 'unknown';

  const emptyEmoji = isUnknownOnly ? '🗂️' : '📔';
  const emptyIcon = (
    <div className="flex justify-center mb-4">
      <EmojiOrNative emoji={emptyEmoji} className="w-14 h-14" nativeClassName="text-5xl" />
    </div>
  );

  if (isUnknownOnly) {
    return (
      <div
        className="flex flex-col items-center justify-center text-center min-h-[50dvh] px-3 xs:px-4"
        data-testid="diary-feed-empty"
      >
        {emptyIcon}
        <p className="text-base font-semibold text-gray-900 mb-1">
          No unrecognised captures
        </p>
        <p className="text-sm text-gray-500">
          Photos we couldn&apos;t classify as food, weight, or education show up
          here so you can retry or edit them.
        </p>
        <p className="text-xs text-gray-400 mt-3">{date}</p>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col items-center justify-center text-center min-h-[50dvh] px-3 xs:px-4"
      data-testid="diary-feed-empty"
    >
      {emptyIcon}
      <p className="text-base font-semibold text-gray-900 mb-1">
        {isSelf ? 'No entries yet for this day' : 'Nothing logged on this day'}
      </p>
      <p className="text-sm text-gray-500">
        {isSelf
          ? "Add a food, weight, or education entry — they'll all show up here."
          : `Try a different date.`}
      </p>
      <p className="text-xs text-gray-400 mt-3">{date}</p>
    </div>
  );
}

/**
 * @param {Object} props
 * @param {string} props.ownerUserId   the diary subject
 * @param {string} props.viewerUserId  the authenticated session user
 * @param {object|null} [props.shareUser] session user for WhatsApp brand line
 * @param {Date|string} props.date     selected calendar day
 * @param {object|null} [props.timezoneSource] Owner user for business-calendar TZ (matches backend owner TZ)
 * @param {number} [props.refreshKey]  bump from parent to trigger background re-fetch without unmounting
 * @param {(entry) => void} [props.onEntryOpen]  click handler per row
 * @param {(entry) => void} [props.onEntryDelete]  delete handler per row (swipe-to-delete)
 * @param {boolean} [props.canDelete]  when false, swipe-to-delete is disabled
 * @param {Array<object>|object|null} [props.pendingUndos]
 *        active undo windows — each renders an inline undo card in its deleted slot
 * @param {Array<object>|object|null} [props.optimisticEntries]
 *        entries shown instantly after Undo while API reloads
 * @param {(entry: object) => void} [props.onOptimisticEntryConsumed]
 *        fired when API feed already includes an optimistic entry
 * @param {(snapshot: object) => Promise<void>|void} [props.onUndoRestore]
 *        restore one soft-deleted entry
 * @param {(snapshot: object) => void} [props.onUndoExpire]
 *        clear one undo slot after countdown
 * @param {string[]} [props.filterKinds]  when set, only entries whose `kind`
 *        is in this list are rendered (e.g. ['unknown'] for the "Other" tab).
 *        Empty-state copy adapts accordingly.
 * @param {boolean} [props.showTimeline]  when true the feed is rendered as a
 *        vertical activity timeline with a date-group header and left-side
 *        time labels (ff.diary-timeline). Default false (flat card list).
 * @param {Set<string>} [props.analyzingCaptureIds]  capture IDs with a
 *        user-initiated pre-flight AI run (handleEntryOpen). Locks tap/swipe.
 * @param {Map<string, { imageBase64?: string, imagePath?: string, capturedAt?: string }>} [props.pendingCaptureMeta]
 *        optimistic diary rows for in-flight background analysis (Phase 2).
 */
export default function DiaryFeed({
  ownerUserId,
  viewerUserId,
  shareUser = null,
  date,
  timezoneSource = null,
  refreshKey: externalRefreshKey = 0,
  onEntryOpen,
  onEntryDelete,
  canDelete = true,
  pendingUndos = null,
  optimisticEntries = null,
  onOptimisticEntryConsumed = null,
  onUndoRestore = null,
  onUndoExpire = null,
  filterKinds = null,
  showTimeline = false,
  analyzingCaptureIds = null,
  pendingCaptureMeta = null,
  onOwnerTimezoneChange = null,
  /** Called when diary entries load — used for background meal detail prefetch. */
  onFoodEntriesLoaded = null,
}) {
  const pendingUndoList = useMemo(() => {
    if (Array.isArray(pendingUndos)) return pendingUndos.filter((u) => u?.entryId != null);
    return pendingUndos?.entryId != null ? [pendingUndos] : [];
  }, [pendingUndos]);

  const optimisticEntryList = useMemo(() => {
    if (Array.isArray(optimisticEntries)) return optimisticEntries.filter(Boolean);
    return optimisticEntries ? [optimisticEntries] : [];
  }, [optimisticEntries]);

  const handleUndoRestore = useCallback((snapshot) => {
    onUndoRestore?.(snapshot);
  }, [onUndoRestore]);

  const handleUndoExpire = useCallback((snapshot) => {
    onUndoExpire?.(snapshot);
  }, [onUndoExpire]);
  const fallbackTimezoneIana = resolveDiaryTimezone(timezoneSource);
  const [profileOwnerTimezone, setProfileOwnerTimezone] = useState(null);

  // Coach/admin views: member objects from team search lack timezone — fetch from profile.
  useEffect(() => {
    const email = timezoneSource?.email || timezoneSource?.Email;
    const viewingOther = Boolean(
      ownerUserId
      && viewerUserId
      && String(ownerUserId) !== String(viewerUserId),
    );
    if (!viewingOther || !email) {
      setProfileOwnerTimezone(null);
      return undefined;
    }

    let cancelled = false;
    getProfile(email)
      .then((res) => {
        if (cancelled) return;
        const tz = res?.data?.timezone || res?.data?.timezoneIana || null;
        setProfileOwnerTimezone(tz);
      })
      .catch(() => {
        if (!cancelled) setProfileOwnerTimezone(null);
      });

    return () => { cancelled = true; };
  }, [timezoneSource?.email, timezoneSource?.Email, ownerUserId, viewerUserId]);

  const {
    loading,
    loadingMore,
    error,
    data,
    hasMore,
    loadMoreSentinelRef,
    refresh,
  } = useDiary({
    ownerUserId,
    viewerUserId,
    date,
    timezoneSource: profileOwnerTimezone || fallbackTimezoneIana,
    refreshKey: externalRefreshKey,
  });

  const ownerTimezoneIana = data?.ownerTimezoneIana
    || profileOwnerTimezone
    || fallbackTimezoneIana;

  useEffect(() => {
    if (typeof onOwnerTimezoneChange === 'function' && ownerTimezoneIana) {
      onOwnerTimezoneChange(ownerTimezoneIana);
    }
  }, [ownerTimezoneIana, onOwnerTimezoneChange]);

  useEffect(() => {
    if (loading || !data?.entries || typeof onFoodEntriesLoaded !== 'function') return;
    onFoodEntriesLoaded(data.entries);
  }, [loading, data?.entries, onFoodEntriesLoaded]);

  /** In-flight captures scoped to this diary owner (coach uploads must not leak). */
  const scopedPendingCaptureMeta = useMemo(
    () => filterPendingCaptureMetaForOwner(pendingCaptureMeta, ownerUserId, viewerUserId),
    [pendingCaptureMeta, ownerUserId, viewerUserId],
  );

  const hasWeightEntries = useMemo(
    () => (data?.entries || []).some(
      (e) => e?.kind === 'weight' && !e.isUndoPlaceholder && e.payload?.id != null,
    ),
    [data?.entries],
  );

  const previousWeightById = useDiaryWeightPreviousMap({
    ownerUserId,
    viewerUserId,
    refreshKey: externalRefreshKey,
    enabled: hasWeightEntries,
  });

  // Pre-bind onClick and onDelete once per entry kind to keep child renders cheap.
  // The mapping itself is identity-stable (frozen module-level object).
  const renderRow = useMemo(
    () => (entry, { hideTime = false } = {}) => {
      if (entry.isUndoPlaceholder && entry.undo) {
        const u = entry.undo;
        return (
          <DiaryUndoRow
            key={`undo-${u.kind}-${u.entryId}`}
            entryKey={`${u.kind}-${u.entryId}`}
            title={u.title}
            message={u.message}
            expiresAt={u.expiresAt}
            ttlSeconds={u.ttlSeconds ?? DIARY_UNDO_SECONDS}
            onUndo={() => handleUndoRestore(u)}
            onExpire={() => handleUndoExpire(u)}
          />
        );
      }

      const Row = ROWS_BY_KIND[entry.kind] || OtherRow;
      // Resolve the capture ID the same way Dashboard.js does so the
      // Set lookup always matches (entry.capture?.id takes precedence).
      const captureId = entry.capture?.id ?? entry.payload?.id;
      const captureIdStr =
        captureId != null && captureId !== '' ? String(captureId) : '';
      // Only lock tap while Dashboard is running a user-initiated pre-flight AI
      // (handleEntryOpen). Background analysis from the capture flow must NOT
      // block tap-to-fix — the user can always tap to re-run detection.
      const isAnalyzing =
        entry.kind === 'unknown' &&
        captureIdStr !== '' &&
        analyzingCaptureIds != null &&
        analyzingCaptureIds.has(captureIdStr);
      // Only show "Analyzing…" when AI is actually in flight (local markCaptureAnalyzing
      // / analyzingCaptureIds). API isPendingAnalysis alone means the user saved the
      // photo but has not chosen a type or started AI — that is "Needs logging", not
      // Analyzing, and must NOT become Other / couldn't identify.
      const isBackgroundPending =
        entry.kind === 'unknown' &&
        !isAnalyzing &&
        !isStalePendingAnalysis(entry.capturedAt) &&
        captureIdStr !== '' &&
        scopedPendingCaptureMeta != null &&
        scopedPendingCaptureMeta.has(captureIdStr);
      const needsClassify =
        entry.kind === 'unknown' &&
        !isAnalyzing &&
        !isBackgroundPending &&
        (entry.payload?.isPendingAnalysis === true ||
          entry.capture?.type === 'pending');
      // Attempt progress stored by onAttempt callback via markCaptureAnalyzing.
      // Look up for both isAnalyzing (user-initiated re-detect) and
      // isBackgroundPending (camera capture flow) so both states show the badge.
      const captureMeta = (isAnalyzing || isBackgroundPending) && captureIdStr !== ''
        ? (scopedPendingCaptureMeta?.get(captureIdStr) ?? null)
        : null;
      const weightId = entry.kind === 'weight' && entry.payload?.id != null
        ? String(entry.payload.id)
        : null;
      return (
        <Row
          key={`${entry.kind}-${entry.payload?.id ?? entry.capturedAt}`}
          entry={entry}
          onOpen={onEntryOpen}
          onDelete={onEntryDelete}
          canDelete={canDelete}
          hideTime={hideTime}
          timezoneIana={ownerTimezoneIana}
          ownerUserId={ownerUserId}
          viewerUserId={viewerUserId}
          shareUser={shareUser}
          {...(entry.kind === 'weight'
            ? { previousWeight: weightId ? (previousWeightById.get(weightId) ?? null) : null }
            : {})}
          {...(entry.kind === 'unknown'
            ? {
                isAnalyzing,
                isBackgroundPending,
                needsClassify,
                currentAttempt: captureMeta?.currentAttempt ?? null,
                totalAttempts:  captureMeta?.totalAttempts  ?? null,
              }
            : {})}
        />
      );
    },
    [
      onEntryOpen,
      onEntryDelete,
      canDelete,
      analyzingCaptureIds,
      scopedPendingCaptureMeta,
      ownerTimezoneIana,
      previousWeightById,
      handleUndoRestore,
      handleUndoExpire,
      ownerUserId,
      viewerUserId,
      shareUser,
    ],
  );

  /** Build optimistic unknown rows for captures still being classified. */
  const withOptimisticEntries = useMemo(() => {
    const base = Array.isArray(data?.entries) ? data.entries : [];
    if (!scopedPendingCaptureMeta || scopedPendingCaptureMeta.size === 0) {
      return dedupePendingDiaryEntries(base);
    }

    // Skip optimistic rows when the API feed already includes this capture
    // (pending rows from /api/diary/list). Without this, each photo appears
    // twice: once from pendingCaptureMeta and once from the API.
    const existingCaptureIds = new Set(
      base
        .map((entry) => entry.capture?.id ?? entry.payload?.id)
        .filter((id) => id != null && id !== '')
        .map(String),
    );

    const optimistic = [];
    scopedPendingCaptureMeta.forEach((meta, captureId) => {
      if (existingCaptureIds.has(captureId)) return;
      if (isStalePendingAnalysis(meta.capturedAt)) return;
      optimistic.push({
        kind: 'unknown',
        capturedAt: meta.capturedAt || new Date().toISOString(),
        capture: { id: captureId, type: 'pending' },
        payload: {
          id: captureId,
          imageBase64: meta.imageBase64 ?? null,
          imagePath: meta.imagePath ?? null,
          isPendingAnalysis: true,
        },
      });
    });

    if (optimistic.length === 0) {
      return dedupePendingDiaryEntries(base);
    }
    return dedupePendingDiaryEntries(
      [...optimistic, ...base].sort(
        (a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime(),
      ),
    );
  }, [data?.entries, scopedPendingCaptureMeta]);

  // Once the live API feed includes a restored entry, drop that optimistic copy.
  useEffect(() => {
    if (!optimisticEntryList.length || !onOptimisticEntryConsumed) return;
    const base = Array.isArray(data?.entries) ? data.entries : [];
    for (const optimisticEntry of optimisticEntryList) {
      const entryId = String(optimisticEntry.payload?.id ?? '');
      if (!entryId) continue;
      const found = base.some(
        (e) =>
          e.kind === optimisticEntry.kind
          && String(e.payload?.id ?? '') === entryId,
      );
      if (found) onOptimisticEntryConsumed(optimisticEntry);
    }
  }, [data?.entries, optimisticEntryList, onOptimisticEntryConsumed]);

  if (loading && !data && (!scopedPendingCaptureMeta || scopedPendingCaptureMeta.size === 0)) {
    return <FeedSkeleton />;
  }
  if (error && !data && (!scopedPendingCaptureMeta || scopedPendingCaptureMeta.size === 0)) {
    return <FeedError error={error} onRetry={refresh} />;
  }
  if (!data && scopedPendingCaptureMeta && scopedPendingCaptureMeta.size > 0) {
    const optimisticOnly = withOptimisticEntries;
    const visibleOnly = Array.isArray(filterKinds)
      ? optimisticOnly.filter((e) => filterKinds.includes(e.kind))
      : optimisticOnly;
    if (visibleOnly.length === 0) return <FeedSkeleton />;
    return (
      <div data-testid="diary-feed">
        <div className="space-y-3">
          {visibleOnly.map(renderRow)}
        </div>
      </div>
    );
  }
  if (!data) return <FeedSkeleton />;

  const { entries = [], date: dateStr, isSelf } = data;

  // Optionally restrict the feed to a subset of kinds (e.g. the "Other"
  // tab only renders `unknown` rows). When no filter is supplied the full
  // merged feed is shown (backward-compatible default).
  const filteredEntries = Array.isArray(filterKinds)
    ? withOptimisticEntries.filter((e) => filterKinds.includes(e.kind))
    : withOptimisticEntries;
  const withRestore = withOptimisticRestores(filteredEntries, optimisticEntryList);
  const visibleEntries = withPendingUndoPlaceholders(withRestore, pendingUndoList);

  if (visibleEntries.length === 0) {
    return <FeedEmpty date={dateStr} isSelf={isSelf} filterKinds={filterKinds} />;
  }

  // ── Timeline mode (ff.diary-timeline) ───────────────────────────────────
  if (showTimeline) {
    return (
      <div data-testid="diary-timeline">
        {/* Date group header */}
        <div className="flex items-center gap-2 px-1 mb-4">
          <span className="text-sm font-bold text-gray-700 whitespace-nowrap">
            {formatTimelineDate(dateStr, ownerTimezoneIana)}
          </span>
          <div className="flex-1 h-px bg-gray-200" aria-hidden="true" />
        </div>

        {/* Timeline entries (includes inline undo placeholder while countdown is active) */}
        <div className="pl-1">
          {visibleEntries.map((entry, idx) => (
            <TimelineEntryWrapper
              key={
                entry.isUndoPlaceholder
                  ? `undo-${entry.undo?.kind}-${entry.undo?.entryId}`
                  : `${entry.kind}-${entry.payload?.id ?? entry.capturedAt}`
              }
              isLast={idx === visibleEntries.length - 1 && !hasMore}
            >
              {renderRow(entry)}
            </TimelineEntryWrapper>
          ))}
        </div>

        <div ref={loadMoreSentinelRef} className="h-4" aria-hidden="true" />
        {loadingMore && (
          <div className="flex justify-center py-3" data-testid="diary-loading-more">
            <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" aria-label="Loading more" />
          </div>
        )}
        {error && data && (
          <div className="px-2 py-3 text-center">
            <p className="text-xs text-red-600 mb-2">{error.message || 'Failed to load more'}</p>
            <button
              type="button"
              onClick={refresh}
              className="text-xs font-semibold text-emerald-700"
            >
              Retry
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── Default flat-card mode ───────────────────────────────────────────────
  return (
    <div data-testid="diary-feed">
      <div className="space-y-3">
        {visibleEntries.map(renderRow)}
      </div>
      <div ref={loadMoreSentinelRef} className="h-4" aria-hidden="true" />
      {loadingMore && (
        <div className="flex justify-center py-3" data-testid="diary-loading-more">
          <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" aria-label="Loading more" />
        </div>
      )}
      {error && data && (
        <div className="px-2 py-3 text-center">
          <p className="text-xs text-red-600 mb-2">{error.message || 'Failed to load more'}</p>
          <button
            type="button"
            onClick={refresh}
            className="text-xs font-semibold text-emerald-700"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
