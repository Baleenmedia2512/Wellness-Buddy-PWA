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
 */

import React, { useMemo } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useDiary } from '../hooks/useDiary';
import ROWS_BY_KIND, { OtherRow } from './rows';

const SKELETON_ROWS = 6;

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
 */
export default function DiaryFeed({
  ownerUserId,
  viewerUserId,
  date,
  refreshKey: externalRefreshKey = 0,
  onEntryOpen,
  onEntryDelete,
  filterKinds = null,
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
