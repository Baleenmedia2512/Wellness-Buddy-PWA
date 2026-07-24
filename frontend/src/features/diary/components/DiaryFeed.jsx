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

import React, { useMemo, useEffect, useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useDiary } from '../hooks/useDiary';
import ROWS_BY_KIND, { OtherRow } from './rows';
import { EmojiOrNative } from '../../../shared/components/icons/EmojiImage';
import { formatBusinessTime, todayBusinessDate } from '../../../shared/utils/datetimeUtils';
import { resolveDiaryTimezone } from '../utils/diaryTimezone';
import { getProfile } from '../../user/services/user.api';

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
    entry.kind === 'unknown' && entry.payload?.isPendingAnalysis === true;

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
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const target = new Date(y, m - 1, d);
  const todayYmd = todayBusinessDate(timezoneIana);
  const [ty, tm, td] = todayYmd.split('-').map(Number);
  const today = new Date(ty, tm - 1, td);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const isToday =
    target.getFullYear() === today.getFullYear() &&
    target.getMonth() === today.getMonth() &&
    target.getDate() === today.getDate();
  const isYesterday =
    target.getFullYear() === yesterday.getFullYear() &&
    target.getMonth() === yesterday.getMonth() &&
    target.getDate() === yesterday.getDate();

  const long = target.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
  if (isToday)     return `Today \u00b7 ${long}`;
  if (isYesterday) return `Yesterday \u00b7 ${long}`;
  return long;
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
 * @param {Date|string} props.date     selected calendar day
 * @param {object|null} [props.timezoneSource] Owner user for business-calendar TZ (matches backend owner TZ)
 * @param {number} [props.refreshKey]  bump from parent to trigger background re-fetch without unmounting
 * @param {(entry) => void} [props.onEntryOpen]  click handler per row
 * @param {(entry) => void} [props.onEntryDelete]  delete handler per row (swipe-to-delete)
 * @param {boolean} [props.canDelete]  when false, swipe-to-delete is disabled (coach read-only view)
 * @param {{ kind: string, entryId: string|number, message: string, expiresAt: number }|null} [props.pendingUndo]
 *        active undo window — keeps empty feed visible while countdown runs
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
  date,
  timezoneSource = null,
  refreshKey: externalRefreshKey = 0,
  onEntryOpen,
  onEntryDelete,
  canDelete = true,
  pendingUndo = null,
  filterKinds = null,
  showTimeline = false,
  analyzingCaptureIds = null,
  pendingCaptureMeta = null,
}) {
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
    getProfile(email, { cacheBust: true })
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

  const { loading, error, data, refresh } = useDiary({
    ownerUserId,
    viewerUserId,
    date,
    timezoneSource: profileOwnerTimezone || fallbackTimezoneIana,
    refreshKey: externalRefreshKey,
  });

  const ownerTimezoneIana = data?.ownerTimezoneIana
    || profileOwnerTimezone
    || fallbackTimezoneIana;

  // Pre-bind onClick and onDelete once per entry kind to keep child renders cheap.
  // The mapping itself is identity-stable (frozen module-level object).
  const renderRow = useMemo(
    () => (entry, { hideTime = false } = {}) => {
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
      const isBackgroundPending =
        entry.kind === 'unknown' &&
        (entry.payload?.isPendingAnalysis === true ||
          (captureIdStr !== '' &&
            pendingCaptureMeta != null &&
            pendingCaptureMeta.has(captureIdStr))) &&
        !isAnalyzing;
      // Attempt progress stored by onAttempt callback via markCaptureAnalyzing.
      // Look up for both isAnalyzing (user-initiated re-detect) and
      // isBackgroundPending (camera capture flow) so both states show the badge.
      const captureMeta = (isAnalyzing || isBackgroundPending) && captureIdStr !== ''
        ? (pendingCaptureMeta?.get(captureIdStr) ?? null)
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
          {...(entry.kind === 'unknown'
            ? {
                isAnalyzing,
                isBackgroundPending,
                currentAttempt: captureMeta?.currentAttempt ?? null,
                totalAttempts:  captureMeta?.totalAttempts  ?? null,
              }
            : {})}
        />
      );
    },
    [onEntryOpen, onEntryDelete, canDelete, analyzingCaptureIds, pendingCaptureMeta, ownerTimezoneIana],
  );

  /** Build optimistic unknown rows for captures still being classified. */
  const withOptimisticEntries = useMemo(() => {
    const base = Array.isArray(data?.entries) ? data.entries : [];
    if (!pendingCaptureMeta || pendingCaptureMeta.size === 0) {
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
    pendingCaptureMeta.forEach((meta, captureId) => {
      if (existingCaptureIds.has(captureId)) return;
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
  }, [data?.entries, pendingCaptureMeta]);

  if (loading && !data && (!pendingCaptureMeta || pendingCaptureMeta.size === 0)) {
    return <FeedSkeleton />;
  }
  if (error && !data && (!pendingCaptureMeta || pendingCaptureMeta.size === 0)) {
    return <FeedError error={error} onRetry={refresh} />;
  }
  if (!data && pendingCaptureMeta && pendingCaptureMeta.size > 0) {
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
  const visibleEntries = Array.isArray(filterKinds)
    ? withOptimisticEntries.filter((e) => filterKinds.includes(e.kind))
    : withOptimisticEntries;

  if (visibleEntries.length === 0 && !pendingUndo) {
    return <FeedEmpty date={dateStr} isSelf={isSelf} filterKinds={filterKinds} />;
  }

  // ── Timeline mode (ff.diary-timeline) ───────────────────────────────────
  if (showTimeline) {
    return (
      <div data-testid="diary-timeline">
        {/* Refreshing indicator */}
        {loading && (
          <div
            className="flex items-center justify-center text-xs text-gray-500 gap-2 py-1 mb-2"
            aria-live="polite"
          >
            <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
            Refreshing…
          </div>
        )}

        {/* Read-only hint when a coach views a member diary */}
        {canDelete === false && (
          <div className="mx-1 mb-3 px-3 py-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg">
            Viewing a team member&apos;s diary — swipe to delete only works on your own entries.
            Use <strong>View mine</strong> above to switch back.
          </div>
        )}

        {/* Date group header */}
        <div className="flex items-center gap-2 px-1 mb-4">
          <span className="text-sm font-bold text-gray-700 whitespace-nowrap">
            {formatTimelineDate(dateStr, ownerTimezoneIana)}
          </span>
          <div className="flex-1 h-px bg-gray-200" aria-hidden="true" />
        </div>

        {/* Timeline entries (may be empty while undo countdown is active) */}
        <div className="pl-1">
          {visibleEntries.map((entry, idx) => (
            <TimelineEntryWrapper
              key={`${entry.kind}-${entry.payload?.id ?? entry.capturedAt}`}
              isLast={idx === visibleEntries.length - 1}
            >
              {renderRow(entry)}
            </TimelineEntryWrapper>
          ))}
        </div>

        {visibleEntries.length === 0 && pendingUndo && (
          <p className="text-sm text-gray-500 px-1 mt-1">No other entries for this day.</p>
        )}
      </div>
    );
  }

  // ── Default flat-card mode ───────────────────────────────────────────────
  return (
    <div data-testid="diary-feed">
      <div className="space-y-3">
        {loading && (
          <div
            className="flex items-center justify-center text-xs text-gray-500 gap-2 py-1"
            aria-live="polite"
          >
            <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
            Refreshing…
          </div>
        )}
        {visibleEntries.map(renderRow)}
      </div>
    </div>
  );
}