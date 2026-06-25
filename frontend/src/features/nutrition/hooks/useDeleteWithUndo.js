import { useCallback, useEffect, useRef, useState } from "react";

export function useDeleteWithUndo({
  disabled,
  onDelete,
  onRestore,
  index,
  itemSnapshot,
  undoSeconds = 5,
}) {
  const [isDeletePending, setIsDeletePending] = useState(false);
  const [deleteCountdown, setDeleteCountdown] = useState(undoSeconds);
  const [deleteAnimKey, setDeleteAnimKey] = useState(0);

  const deleteTimeoutRef = useRef(null);
  const deleteIntervalRef = useRef(null);

  const clearDeleteTimers = useCallback(() => {
    if (deleteTimeoutRef.current) {
      clearTimeout(deleteTimeoutRef.current);
      deleteTimeoutRef.current = null;
    }
    if (deleteIntervalRef.current) {
      clearInterval(deleteIntervalRef.current);
      deleteIntervalRef.current = null;
    }
  }, []);

  const resetPendingDelete = useCallback(() => {
    clearDeleteTimers();
    setIsDeletePending(false);
    setDeleteCountdown(undoSeconds);
    setDeleteAnimKey(0);
  }, [clearDeleteTimers, undoSeconds]);

  useEffect(() => {
    return () => {
      clearDeleteTimers();
    };
  }, [clearDeleteTimers]);

  const handleDelete = useCallback(async () => {
    if (disabled || !onDelete || isDeletePending) return;

    try {
      await onDelete(index, { phase: "immediate", itemSnapshot });
    } catch (error) {
      console.error("[EditableFoodItem] Immediate delete failed:", error);
      alert("Failed to delete item. Please try again.");
      return;
    }

    setIsDeletePending(true);
    setDeleteCountdown(undoSeconds);
    setDeleteAnimKey((prev) => prev + 1);

    deleteIntervalRef.current = setInterval(() => {
      setDeleteCountdown((prev) => {
        if (prev <= 1) {
          if (deleteIntervalRef.current) {
            clearInterval(deleteIntervalRef.current);
            deleteIntervalRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    deleteTimeoutRef.current = setTimeout(() => {
      clearDeleteTimers();
      setIsDeletePending(false);
      setDeleteCountdown(undoSeconds);
      setDeleteAnimKey(0);
      onDelete(index, { phase: "finalize", itemSnapshot });
    }, undoSeconds * 1000);
  }, [
    disabled,
    onDelete,
    isDeletePending,
    index,
    itemSnapshot,
    undoSeconds,
    clearDeleteTimers,
  ]);

  const handleUndoDelete = useCallback(async () => {
    if (!isDeletePending) return;

    if (onRestore) {
      try {
        await onRestore(index, itemSnapshot);
      } catch (error) {
        console.error("[EditableFoodItem] Undo restore failed:", error);
        alert("Failed to restore item. Please try again.");
        return;
      }
    }

    resetPendingDelete();
  }, [isDeletePending, onRestore, index, itemSnapshot, resetPendingDelete]);

  return {
    isDeletePending,
    deleteCountdown,
    deleteAnimKey,
    handleDelete,
    handleUndoDelete,
  };
}
