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
import { educationLogFromDiaryRow } from '../services/educationFormatter';

const EducationDashboard = ({
  user, apiBaseUrl, refreshKey = 0, initialEntryId = null, selectedDate = null, hideOverview = false,
  onDeleteWithUndo = null,
  onDeleteUndoCancel = null,
  // Imperative handle: parent passes a React ref; we write `openRef.current =
  // (entry) => ...` each render so the timeline shell can open a log entry.
  openRef = null,
  // Called after the detail modal is closed so the timeline can refresh.
  onAfterModalClose = null,
  /** Timeline modal-host: skip logs/summary until first open. */
  deferDataFetch = false,
}) => {
  const [dataFetchEnabled, setDataFetchEnabled] = useState(!deferDataFetch);
  const vm = useEducationDashboard({
    user, apiBaseUrl, refreshKey, selectedDate,
    onDeleteWithUndo, onDeleteUndoCancel,
    enabled: dataFetchEnabled,
  });
  const [selectedLog, setSelectedLog] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const pendingOpenRef = useRef(null);

  const openLog = (log) => {
    if (log) {
      pendingOpenRef.current = null;
      setSelectedLog(log);
    }
  };

  const resolveLogFromDiaryEntry = (entry) => {
    const p = entry?.payload || {};
    const found = (vm.educationLogs || []).find((e) => String(e.Id) === String(p.id));
    return found || educationLogFromDiaryRow(entry);
  };

  // Imperative open handle for the timeline shell (ff.diary-timeline).
  if (openRef) {
    openRef.current = (entryOrId) => {
      if (deferDataFetch && !dataFetchEnabled) {
        setDataFetchEnabled(true);
      }
      if (
        entryOrId
        && typeof entryOrId === 'object'
        && (entryOrId.kind === 'education' || entryOrId.kind === 'watch')
      ) {
        openLog(resolveLogFromDiaryEntry(entryOrId));
        return;
      }
      const entryId = entryOrId;
      const log = (vm.educationLogs || []).find((e) => String(e.Id) === String(entryId));
      if (log) {
        openLog(log);
      } else if (entryId != null && entryId !== '') {
        pendingOpenRef.current = String(entryId);
      }
    };
  }

  // Open once paginated logs load when the user tapped before fetch completed.
  useEffect(() => {
    const pendingId = pendingOpenRef.current;
    if (!pendingId || vm.loading) return;
    const log = (vm.educationLogs || []).find((e) => String(e.Id) === String(pendingId));
    if (log) openLog(log);
  }, [vm.loading, vm.educationLogs]);

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

  const detailModal = selectedLog ? (
    <EducationCardModal
      log={selectedLog}
      onClose={() => { setSelectedLog(null); onAfterModalClose?.(); }}
      onDelete={async (log) => {
        setDeletingId(log.Id);
        setSelectedLog(null);
        onAfterModalClose?.();
        await vm.handleDeleteEducationLogFromModal(log);
        setDeletingId(null);
      }}
      isDeleting={deletingId === selectedLog?.Id}
      apiBaseUrl={vm.apiBaseUrl}
      userId={vm.userIdRef.current}
    />
  ) : null;

  if (vm.loading) {
    return (
      <>
        <EducationDashboardSkeleton />
        {detailModal}
      </>
    );
  }
  if (!vm.educationLogs || vm.educationLogs.length === 0) {
    return (
      <>
        <EducationEmptyState />
        {detailModal}
      </>
    );
  }

  return (
    <>
      <style>{`
        @keyframes countdown-shrink { from { transform: scaleX(1); } to { transform: scaleX(0); } }
        @keyframes slideInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
      <div className="w-full md:max-w-2xl lg:max-w-4xl md:mx-auto pb-24 mt-2 overflow-x-hidden">
        <div className="px-3 md:px-4">
          {!hideOverview && (
          <EducationDashboardHeader
            summary={vm.summary} summaryLoading={vm.summaryLoading}
            educationLogs={vm.educationLogs}
            trendSeries={vm.trendSeries}
            trendRangeDays={vm.trendRangeDays}
            setTrendRangeDays={vm.setTrendRangeDays}
          />
          )}
          {vm.monthlyGroups.length === 0 && <EducationCameraPanel />}
          <EducationLogList
            monthlyGroups={vm.monthlyGroups} undoState={vm.undoState}
            onDelete={vm.handleDeleteEducationLog}
            onRestore={vm.handleUndoRestore} onExpire={vm.handleUndoExpire}
            onCardClick={(log) => setSelectedLog(log)}
            apiBaseUrl={vm.apiBaseUrl} userId={vm.userIdRef.current}
            timezoneIana={vm.timezoneIana}
            hasMoreLogs={vm.hasMoreLogs} loadingMore={vm.loadingMore}
            sentinelRef={vm.loadMoreSentinelRef}
          />
        </div>
      </div>

      {detailModal}
    </>
  );
};

export default EducationDashboard;
