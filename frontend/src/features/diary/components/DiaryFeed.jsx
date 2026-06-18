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

import React, { useMemo } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useDiary } from '../hooks/useDiary';
import ROWS_BY_KIND, { OtherRow } from './rows';

const SKELETON_ROWS = 6;

// ─── Timeline helpers ────────────────────────────────────────────────────────

/**
 * Formats `capturedAt` (ISO string) to a short time label for the
 * left-hand column of the timeline (e.g. "08:15 AM").
 * Uses IST locale string so the time matches the business day the
 * backend already scoped the query to.
 */
function formatTimelineTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-US', {
    hour:   'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Returns a human-readable date header for the timeline:
 *   today     → "Today · Jun 18, 2026"
 *   yesterday → "Yesterday · Jun 17, 2026"
 *   other     → "Jun 16, 2026"
 *
 * `dateStr` is `YYYY-MM-DD` in IST (the value the backend echoes back).
 */
function formatTimelineDate(dateStr) {
  if (!dateStr) return '';
  // Parse as a local-midnight date (no timezone shift) so the header
  // matches the IST business-date used throughout the diary feature.
  const [y, m, d] = dateStr.split('-').map(Number);
  const target   = new Date(y, m - 1, d);
  const today    = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const isToday =
    target.getFullYear() === today.getFullYear() &&
    target.getMonth()    === today.getMonth() &&
    target.getDate()     === today.getDate();
  const isYesterday =
    target.getFullYear() === yesterday.getFullYear() &&
    target.getMonth()    === yesterday.getMonth() &&
    target.getDate()     === yesterday.getDate();

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
function TimelineEntryWrapper({ entry, isLast, children }) {
  return (
    <div className="flex gap-3 items-start">
      {/* Left column: time + vertical connector */}
      <div className="flex flex-col items-end" style={{ minWidth: '4.5rem' }}>
        <span
          className="text-xs font-medium text-emerald-700 whitespace-nowrap leading-relaxed"
          aria-hidden="true"
        >
          {formatTimelineTime(entry.capturedAt)}
        </span>
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
  // The "Other" tab (filterKinds === ['unknown']) gets its own copy so an
  // empty list doesn't read like the whole day is empty.
  const isUnknownOnly =
    Array.isArray(filterKinds) &&
    filterKinds.length === 1 &&
    filterKinds[0] === 'unknown';

  if (isUnknownOnly) {
    return (
      <div className="text-center py-16 px-4" data-testid="diary-feed-empty">
        <p className="text-5xl mb-4" aria-hidden="true">🗂️</p>
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
    <div className="text-center py-16 px-4" data-testid="diary-feed-empty">
      <p className="text-5xl mb-4" aria-hidden="true">📔</p>
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
 * @param {number} [props.refreshKey]  bump from parent to trigger background re-fetch without unmounting
 * @param {(entry) => void} [props.onEntryOpen]  click handler per row
 * @param {(entry) => void} [props.onEntryDelete]  delete handler per row (swipe-to-delete)
 * @param {string[]} [props.filterKinds]  when set, only entries whose `kind`
 *        is in this list are rendered (e.g. ['unknown'] for the "Other" tab).
 *        Empty-state copy adapts accordingly.
 * @param {boolean} [props.showTimeline]  when true the feed is rendered as a
 *        vertical activity timeline with a date-group header and left-side
 *        time labels (ff.diary-timeline). Default false (flat card list).
 */
export default function DiaryFeed({
  ownerUserId,
  viewerUserId,
  date,
  refreshKey: externalRefreshKey = 0,
  onEntryOpen,
  onEntryDelete,
  filterKinds = null,
  showTimeline = false,
}) {
  const { loading, error, data, refresh } = useDiary({
    ownerUserId,
    viewerUserId,
    date,
    refreshKey: externalRefreshKey,
  });

  // Pre-bind onClick and onDelete once per entry kind to keep child renders cheap.
  // The mapping itself is identity-stable (frozen module-level object).
  const renderRow = useMemo(
    () => (entry) => {
      const Row = ROWS_BY_KIND[entry.kind] || OtherRow;
      return (
        <Row
          key={`${entry.kind}-${entry.payload?.id ?? entry.capturedAt}`}
          entry={entry}
          onOpen={onEntryOpen}
          onDelete={onEntryDelete}
        />
      );
    },
    [onEntryOpen, onEntryDelete],
  );

  if (loading && !data) return <FeedSkeleton />;
  if (error && !data)   return <FeedError error={error} onRetry={refresh} />;
  if (!data)            return <FeedSkeleton />;

  const { entries = [], date: dateStr, isSelf } = data;

  // Optionally restrict the feed to a subset of kinds (e.g. the "Other"
  // tab only renders `unknown` rows). When no filter is supplied the full
  // merged feed is shown (backward-compatible default).
  const visibleEntries = Array.isArray(filterKinds)
    ? entries.filter((e) => filterKinds.includes(e.kind))
    : entries;

  if (visibleEntries.length === 0) {
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

        {/* Date group header */}
        <div className="flex items-center gap-2 px-1 mb-4">
          <span className="text-sm font-bold text-gray-700 whitespace-nowrap">
            {formatTimelineDate(dateStr)}
          </span>
          <div className="flex-1 h-px bg-gray-200" aria-hidden="true" />
        </div>

        {/* Timeline entries */}
        <div className="pl-1">
          {visibleEntries.map((entry, idx) => (
            <TimelineEntryWrapper
              key={`${entry.kind}-${entry.payload?.id ?? entry.capturedAt}`}
              entry={entry}
              isLast={idx === visibleEntries.length - 1}
            >
              {renderRow(entry)}
            </TimelineEntryWrapper>
          ))}
        </div>
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
