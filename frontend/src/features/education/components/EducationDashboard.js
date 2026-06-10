/**
 * EducationDashboard.js — slice orchestrator.
 *
 * Composes `useEducationDashboard` with the header (summary/trend),
 * the monthly log list and the camera/upload empty-state panels.
 * Selected log opens `EducationCardModal` with delete + undo wired
 * back into the hook.
 */
import React, { useState, useEffect, useRef } from 'react';
import EducationCardModal from './EducationCardModal';
import EducationDashboardHeader from './EducationDashboardHeader';
import EducationLogList from './EducationLogList';
import EducationCameraPanel, { EducationEmptyState } from './EducationCameraPanel';
import EducationDashboardSkeleton from './EducationDashboardSkeleton';
import { useEducationDashboard } from '../hooks/useEducationDashboard';

const EducationDashboard = ({ user, apiBaseUrl, refreshKey = 0, initialEntryId = null, selectedDate = null }) => {
  const vm = useEducationDashboard({ user, apiBaseUrl, refreshKey, selectedDate });
  const [selectedLog, setSelectedLog] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  // Auto-open the entry whose Id matches the deep-link mealId once logs load.
  const autoOpenEducDoneRef = useRef(false);
  useEffect(() => {
    if (!initialEntryId || autoOpenEducDoneRef.current) return;
    if (vm.loading || !vm.educationLogs.length) return;
    const log = vm.educationLogs.find(
      (e) => String(e.Id) === String(initialEntryId),
    );
    if (log) {
      autoOpenEducDoneRef.current = true;
      setSelectedLog(log);
    }
  }, [initialEntryId, vm.loading, vm.educationLogs]);

  if (vm.loading) return <EducationDashboardSkeleton />;
  if (!vm.educationLogs || vm.educationLogs.length === 0) return <EducationEmptyState />;

  return (
    <>
      <style>{`
        @keyframes countdown-shrink { from { transform: scaleX(1); } to { transform: scaleX(0); } }
        @keyframes slideInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
      <div className="w-full md:max-w-2xl lg:max-w-4xl md:mx-auto pb-24 mt-2 overflow-x-hidden">
        <div className="px-3 md:px-4">
          <EducationDashboardHeader
            summary={vm.summary} summaryLoading={vm.summaryLoading}
            educationLogs={vm.educationLogs}
            trendSeries={vm.trendSeries}
            trendRangeDays={vm.trendRangeDays}
            setTrendRangeDays={vm.setTrendRangeDays}
          />
          {vm.monthlyGroups.length === 0 && <EducationCameraPanel />}
          <EducationLogList
            monthlyGroups={vm.monthlyGroups} undoState={vm.undoState}
            onDelete={vm.handleDeleteEducationLog}
            onRestore={vm.handleUndoRestore} onExpire={vm.handleUndoExpire}
            onCardClick={(log) => setSelectedLog(log)}
            apiBaseUrl={vm.apiBaseUrl} userId={vm.userIdRef.current}
            hasMoreLogs={vm.hasMoreLogs} loadingMore={vm.loadingMore}
            sentinelRef={vm.loadMoreSentinelRef}
          />
        </div>
      </div>

      {selectedLog && (
        <EducationCardModal
          log={selectedLog}
          onClose={() => setSelectedLog(null)}
          onDelete={async (log) => {
            setDeletingId(log.Id);
            setSelectedLog(null);
            await vm.handleDeleteEducationLog(log);
            setDeletingId(null);
          }}
          isDeleting={deletingId === selectedLog?.Id}
          apiBaseUrl={vm.apiBaseUrl}
          userId={vm.userIdRef.current}
        />
      )}
    </>
  );
};

export default EducationDashboard;
