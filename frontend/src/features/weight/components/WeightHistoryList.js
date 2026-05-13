/**
 * WeightHistoryList.js — month-grouped, lazily-rendered weight history.
 *
 * Renders the empty-state, monthly group headers, lazy-loaded
 * `WeightCard` instances (first 10 immediate, the rest deferred until
 * scrolled into view), undo placeholders, and the infinite-scroll
 * sentinel/loading indicator.
 */
import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Calendar } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import BathroomScaleIcon from '../../../shared/components/icons/BathroomScaleIcon';
import { istToLocalDate } from '../../../shared/utils/timezoneUtils';
import { UNDO_SECONDS } from '../services/weightDashboardFormatter';
import WeightUndoRow from './WeightUndoRow';

const WeightCard = lazy(() => import('./WeightCard'));

const LazyLoadWrapper = ({ children, fallback, rootMargin = '100px' }) => {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setIsVisible(true); observer.disconnect(); }
    }, { rootMargin, threshold: 0 });
    observer.observe(element);
    return () => observer.disconnect();
  }, [rootMargin]);
  return <div ref={ref}>{isVisible ? children : fallback}</div>;
};

const Skeleton = () => (
  <div className="bg-white rounded-xl p-2.5 xs:p-3 sm:p-4 animate-pulse" style={{ minHeight: 72 }}>
    <div className="flex items-center gap-2 xs:gap-3 sm:gap-4">
      <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gray-200 rounded-lg" />
      <div className="flex-1 space-y-1.5 sm:space-y-2">
        <div className="h-3 sm:h-4 bg-gray-200 rounded w-3/4" />
        <div className="h-2.5 sm:h-3 bg-gray-200 rounded w-1/2" />
      </div>
      <div className="h-6 sm:h-8 bg-gray-200 rounded w-12 sm:w-16" />
    </div>
  </div>
);

const WeightHistoryList = ({
  user, apiBaseUrl, monthlyGroups, previousWeightMap, undoState,
  savedUserName, savedProfileImage, userIdRef,
  hasMoreWeights, loadingMore, loadMoreSentinelRef,
  handleViewEntry, handleDeleteEntry, handleUndoRestore, handleUndoExpire,
}) => {
  const isIOS = Capacitor.getPlatform() === 'ios';
  const cardProps = (entry, index) => ({
    data: entry,
    previousWeight: previousWeightMap.get(entry.ID),
    onDelete: handleDeleteEntry,
    onView: handleViewEntry,
    index,
    userName: savedUserName || user?.displayName || user?.name || 'User',
    profileImage: savedProfileImage || null,
    apiBaseUrl,
    userId: userIdRef.current,
  });

  return (
    <>
      {monthlyGroups.length === 0 && (
        <div className="flex flex-col items-center justify-center text-center py-12 px-6 bg-white/60 backdrop-blur-xl rounded-2xl shadow-md border border-gray-100">
          {isIOS ? (
            <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
              <BathroomScaleIcon className="w-9 h-9 text-gray-400" />
            </div>
          ) : (
            <div className="text-6xl mb-4">⚖️</div>
          )}
          <h3 className="text-xl font-semibold text-gray-800 mb-2">No Weight Entries</h3>
          <p className="text-gray-500 text-sm max-w-xs mx-auto">
            Take a photo of your weighing scale to start tracking your weight.
          </p>
        </div>
      )}

      <div className="space-y-6">
        {monthlyGroups.map((monthGroup) => (
          <div key={monthGroup.monthKey} className="mb-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-600" />
                <span className="text-sm font-semibold text-gray-600">{monthGroup.monthName}</span>
              </div>
            </div>
            <div className="space-y-3">
              {monthGroup.entries
                .filter((e) => e && e.ID && e.CreatedAt && e.Weight)
                .sort((a, b) => istToLocalDate(b.CreatedAt) - istToLocalDate(a.CreatedAt))
                .map((entry, index) => {
                  if (entry.isUndoPlaceholder) {
                    const u = undoState[entry.ID];
                    if (!u || !u.originalEntry) return null;
                    return (
                      <WeightUndoRow
                        key={entry.ID} pid={entry.ID}
                        originalEntry={u.originalEntry}
                        expiresAt={u.expiresAt}
                        ttlSeconds={u.ttlSeconds ?? UNDO_SECONDS}
                        onRestore={handleUndoRestore}
                        onExpire={() => handleUndoExpire(entry.ID, u.originalEntry)}
                      />
                    );
                  }
                  if (index < 10) {
                    return (
                      <Suspense key={entry.ID} fallback={<Skeleton />}>
                        <WeightCard {...cardProps(entry, index)} />
                      </Suspense>
                    );
                  }
                  return (
                    <LazyLoadWrapper key={entry.ID} fallback={<Skeleton />} rootMargin="200px">
                      <Suspense fallback={<Skeleton />}>
                        <WeightCard {...cardProps(entry, index)} />
                      </Suspense>
                    </LazyLoadWrapper>
                  );
                })}
            </div>
          </div>
        ))}

        {(hasMoreWeights || loadingMore) && (
          <div ref={loadMoreSentinelRef} className="flex items-center justify-center py-6">
            {loadingMore ? (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span className="inline-block h-4 w-4 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />
                Loading more entries…
              </div>
            ) : (
              <span className="text-xs text-gray-400">Scroll to load more</span>
            )}
          </div>
        )}
      </div>
    </>
  );
};

export default WeightHistoryList;
