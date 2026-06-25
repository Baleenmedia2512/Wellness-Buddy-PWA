/**
 * useWeightUndoActions.js — slice-internal mutation hook.
 *
 * Owns undo placeholder state plus delete/undo/restore/expire/update
 * handlers. Receives the history setter from `useWeightHistoryData` so
 * optimistic updates stay coherent with the underlying data source.
 */
import { useState } from 'react';
import { UNDO_SECONDS } from '../services/weightDashboardFormatter';

export function useWeightUndoActions({
  user, apiBaseUrl, userIdRef, setWeightHistory, setSelectedEntry,
}) {
  const [undoState, setUndoState] = useState({});

  const handleDeleteEntry = async (entryToDelete) => {
    const placeholder = {
      ID: `undo-${entryToDelete.ID}`, isUndoPlaceholder: true,
      CreatedAt: entryToDelete.CreatedAt, Weight: entryToDelete.Weight,
    };
    setWeightHistory((prev) => {
      const idx = prev.findIndex((e) => e.ID === entryToDelete.ID);
      if (idx === -1) return prev;
      const next = prev.slice(); next.splice(idx, 1, placeholder); return next;
    });
    setUndoState((prev) => ({
      ...prev,
      [placeholder.ID]: {
        originalEntry: entryToDelete,
        expiresAt: Date.now() + UNDO_SECONDS * 1000,
        ttlSeconds: UNDO_SECONDS,
      },
    }));
    try {
      const userId = userIdRef.current || user?.id;
      const r = await fetch(`${apiBaseUrl}/api/weight/delete`, {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, entryId: entryToDelete.ID }),
      });
      const data = await r.json();
      if (!r.ok || !data.success) throw new Error(data.message || 'Failed to delete entry');
    } catch (err) {
      console.error('Delete error:', err);
      setWeightHistory((prev) => {
        const idx = prev.findIndex((e) => e.ID === placeholder.ID);
        if (idx === -1) return prev;
        const next = prev.slice(); next.splice(idx, 1, entryToDelete); return next;
      });
      setUndoState((prev) => { const n = { ...prev }; delete n[placeholder.ID]; return n; });
      alert(err.message || 'Failed to delete. Please try again.');
    }
  };

  const handleUndoRestore = async (pid, originalEntry) => {
    setWeightHistory((prev) => {
      const idx = prev.findIndex((e) => e.ID === pid);
      if (idx === -1) return prev.concat(originalEntry);
      const next = prev.slice(); next.splice(idx, 1, originalEntry); return next;
    });
    setUndoState((prev) => { const n = { ...prev }; delete n[pid]; return n; });
    try {
      const userId = userIdRef.current || user?.id;
      const r = await fetch(`${apiBaseUrl}/api/weight/undo`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: originalEntry.ID, userId }),
      });
      const data = await r.json();
      if (!r.ok || !data.success) throw new Error(data.message || 'Failed to restore entry');
    } catch (err) {
      console.error('Undo restore error:', err);
      setWeightHistory((prev) => {
        const idx = prev.findIndex((e) => e.ID === originalEntry.ID);
        if (idx === -1) return prev;
        const next = prev.slice();
        next.splice(idx, 1, {
          ID: pid, isUndoPlaceholder: true,
          CreatedAt: originalEntry.CreatedAt, Weight: originalEntry.Weight,
        });
        return next;
      });
      setUndoState((prev) => ({
        ...prev,
        [pid]: { originalEntry, expiresAt: Date.now() + UNDO_SECONDS * 1000, ttlSeconds: UNDO_SECONDS },
      }));
      alert(err.message || 'Failed to restore. Please try again.');
    }
  };

  const handleUndoExpire = (pid) => {
    setWeightHistory((prev) => prev.filter((e) => e.ID !== pid));
    setUndoState((prev) => { const n = { ...prev }; delete n[pid]; return n; });
  };

  const handleUpdateEntry = async (entryId, newWeight) => {
    const userId = userIdRef.current || user?.id;
    const r = await fetch(`${apiBaseUrl}/api/weight/save`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, entryId, weightValue: newWeight }),
    });
    const data = await r.json();
    if (!r.ok || !data.success) throw new Error(data.message || 'Failed to update weight');
    setWeightHistory((prev) => prev.map(
      (e) => (String(e.ID ?? e.id) === String(entryId) ? { ...e, Weight: String(newWeight) } : e),
    ));
    setSelectedEntry((prev) => (prev && String(prev.ID ?? prev.id) === String(entryId)
      ? { ...prev, Weight: String(newWeight) } : prev));
  };

  return {
    undoState,
    handleDeleteEntry, handleUndoRestore, handleUndoExpire, handleUpdateEntry,
  };
}
