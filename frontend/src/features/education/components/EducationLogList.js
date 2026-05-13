/**
 * EducationLogList.js — monthly grouped log list with infinite scroll.
 *
 * Renders each month section, lazily mounts `EducationCard` rows, and
 * substitutes `EducationUndoRow` for soft-deleted placeholders. The
 * sentinel ref is owned by the dashboard hook for IntersectionObserver
 * pagination.
 */
import React, { Suspense, lazy } from 'react';
import { Calendar } from 'lucide-react';
import { istToLocalDate } from '../../../shared/utils/timezoneUtils';
import EducationUndoRow from './EducationUndoRow';
import { UNDO_SECONDS } from '../hooks/useEducationDashboard';

const EducationCard = lazy(() => import('./EducationCard'));

const cardSkeleton = (
  <div className="bg-white rounded-xl p-2.5 xs:p-3 sm:p-4 animate-pulse" style={{ minHeight: 72 }}>
    <div className="flex items-center gap-2 xs:gap-3 sm:gap-4">
      <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gray-200 rounded-lg" />
      <div className="flex-1 space-y-1.5 sm:space-y-2">
        <div className="h-3 sm:h-4 bg-gray-200 rounded w-3/4" />
        <div className="h-2.5 sm:h-3 bg-gray-200 rounded w-1/2" />
      </div>
    </div>
  </div>
);

const sortByCreatedDesc = (a, b) => istToLocalDate(b.CreatedAt) - istToLocalDate(a.CreatedAt);

const MonthSection = ({ group, undoState, onDelete, onRestore, onExpire, onCardClick, apiBaseUrl, userId }) => (
  <div key={group.monthKey} className="mb-6">
    <div className="flex items-center justify-between mb-5">
      <div className="flex items-center gap-2">
        <Calendar className="w-4 h-4 text-gray-600" />
        <span className="text-sm font-semibold text-gray-600">{group.monthName}</span>
      </div>
    </div>
    <div className="space-y-3">
      {group.entries
        .filter((log) => log && log.Id && log.CreatedAt)
        .sort(sortByCreatedDesc)
        .map((log, index) => {
          if (log.isUndoPlaceholder) {
            const u = undoState[log.Id];
            if (!u || !u.originalLog) return null;
            return (
              <EducationUndoRow key={log.Id} pid={log.Id}
                originalLog={u.originalLog} expiresAt={u.expiresAt}
                ttlSeconds={u.ttlSeconds ?? UNDO_SECONDS}
                onRestore={onRestore} onExpire={() => onExpire(log.Id, u.originalLog)} />
            );
          }
          return (
            <Suspense key={log.Id} fallback={cardSkeleton}>
              <EducationCard data={log} onDelete={onDelete} onClick={onCardClick}
                index={index} apiBaseUrl={apiBaseUrl} userId={userId} />
            </Suspense>
          );
        })}
    </div>
  </div>
);

const InfiniteScrollSentinel = React.forwardRef(({ loadingMore }, ref) => (
  <div ref={ref} className="flex items-center justify-center py-6">
    {loadingMore ? (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <span className="inline-block h-4 w-4 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />
        Loading more entries...
      </div>
    ) : (
      <span className="text-xs text-gray-400">Scroll to load more</span>
    )}
  </div>
));

const EducationLogList = ({
  monthlyGroups, undoState, onDelete, onRestore, onExpire, onCardClick,
  apiBaseUrl, userId, hasMoreLogs, loadingMore, sentinelRef,
}) => (
  <div className="space-y-6">
    {monthlyGroups.map((group) => (
      <MonthSection key={group.monthKey} group={group} undoState={undoState}
        onDelete={onDelete} onRestore={onRestore} onExpire={onExpire}
        onCardClick={onCardClick} apiBaseUrl={apiBaseUrl} userId={userId} />
    ))}
    {(hasMoreLogs || loadingMore) && (
      <InfiniteScrollSentinel ref={sentinelRef} loadingMore={loadingMore} />
    )}
  </div>
);

export default EducationLogList;
