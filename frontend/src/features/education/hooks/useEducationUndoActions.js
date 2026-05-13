/**
 * useEducationUndoActions.js — optimistic delete + undo handlers.
 *
 * Split out from `useEducationDashboard` so the orchestrator hook
 * stays under the LOC budget. Receives raw setters from the parent
 * hook and exposes the three handlers consumed by the log list.
 */
import { useCallback } from 'react';
import { deleteEducationLog, undoEducationDelete } from '../services/educationDashboardService';

export const UNDO_SECONDS = 10;

const buildPlaceholder = (log) => ({
  Id: `undo-${log.Id}`, isUndoPlaceholder: true,
  CreatedAt: log.CreatedAt, Platform: log.Platform, Topic: log.Topic,
});

const buildUndoEntry = (log) => ({
  originalLog: log, expiresAt: Date.now() + UNDO_SECONDS * 1000, ttlSeconds: UNDO_SECONDS,
});

const replaceAt = (prev, matcher, replacement) => {
  const idx = prev.findIndex(matcher);
  if (idx === -1) return replacement === null ? prev : prev.concat(replacement);
  const next = prev.slice();
  if (replacement === null) next.splice(idx, 1);
  else next.splice(idx, 1, replacement);
  return next;
};

export function useEducationUndoActions({
  apiBaseUrl, user, userIdRef, setEducationLogs, setUndoState, refreshSummary,
}) {
  const userId = () => userIdRef.current || user?.id;

  const handleDeleteEducationLog = useCallback(async (log) => {
    if (!log || log.isUndoPlaceholder) return;
    const placeholder = buildPlaceholder(log);
    setEducationLogs((prev) => replaceAt(prev, (e) => e.Id === log.Id, placeholder));
    setUndoState((p) => ({ ...p, [placeholder.Id]: buildUndoEntry(log) }));
    try {
      await deleteEducationLog({ apiBaseUrl, userId: userId(), logId: log.Id });
      refreshSummary();
    } catch (err) {
      setEducationLogs((prev) => replaceAt(prev, (e) => e.Id === placeholder.Id, log));
      setUndoState((p) => { const n = { ...p }; delete n[placeholder.Id]; return n; });
      alert(err.message || 'Failed to delete. Please try again.');
    }
  }, [apiBaseUrl, user, userIdRef, setEducationLogs, setUndoState, refreshSummary]);

  const handleUndoRestore = useCallback(async (pid, originalLog) => {
    setEducationLogs((prev) => replaceAt(prev, (e) => e.Id === pid, originalLog));
    setUndoState((p) => { const n = { ...p }; delete n[pid]; return n; });
    try {
      await undoEducationDelete({ apiBaseUrl, userId: userId(), logId: originalLog.Id });
      refreshSummary();
    } catch (err) {
      setEducationLogs((prev) => replaceAt(prev, (e) => e.Id === originalLog.Id, {
        ...buildPlaceholder(originalLog), Id: pid,
      }));
      setUndoState((p) => ({ ...p, [pid]: buildUndoEntry(originalLog) }));
      alert(err.message || 'Failed to restore. Please try again.');
    }
  }, [apiBaseUrl, user, userIdRef, setEducationLogs, setUndoState, refreshSummary]);

  const handleUndoExpire = useCallback((pid) => {
    setEducationLogs((prev) => prev.filter((e) => e.Id !== pid));
    setUndoState((p) => { const n = { ...p }; delete n[pid]; return n; });
  }, [setEducationLogs, setUndoState]);

  return { handleDeleteEducationLog, handleUndoRestore, handleUndoExpire };
}
