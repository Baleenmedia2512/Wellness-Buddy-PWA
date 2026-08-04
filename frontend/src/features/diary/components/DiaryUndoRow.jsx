/**
 * DiaryUndoRow.jsx — inline undo placeholder for diary timeline swipe-delete.
 *
 * Replaces the deleted food / weight / education / watch / unknown card in
 * the same list slot (matches WeightUndoRow / EducationUndoRow). Keeps undo
 * in-place instead of a floating bottom banner.
 *
 * Undo is optimistic: the parent swaps this row for the restored card on the
 * same click tick — no "Restoring…" wait on the network.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { RotateCcw, Trash2 } from 'lucide-react';

import { UNDO_SECONDS } from '../../nutrition/hooks/useNutritionUndo';

export const DIARY_UNDO_SECONDS = UNDO_SECONDS;

/**
 * @param {Object} props
 * @param {string} props.entryKey       stable key for progress-bar remount
 * @param {string} props.title          short label for the removed entry
 * @param {string} [props.message]      optional primary line override
 * @param {number} props.expiresAt      unix ms when soft-delete window ends
 * @param {number} [props.ttlSeconds]
 * @param {() => void} props.onUndo
 * @param {() => void} props.onExpire
 */
export default function DiaryUndoRow({
  entryKey,
  title,
  message,
  expiresAt,
  ttlSeconds = DIARY_UNDO_SECONDS,
  onUndo,
  onExpire,
}) {
  const [now, setNow] = useState(Date.now());
  const [clicked, setClicked] = useState(false);

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(iv);
  }, []);

  const { total, delayAtMount } = useMemo(() => {
    const totalSec = Math.max(0, ttlSeconds);
    const startedAt = expiresAt - totalSec * 1000;
    const elapsedAtMount = Math.min(totalSec, Math.max(0, (Date.now() - startedAt) / 1000));
    return { total: totalSec, delayAtMount: -elapsedAtMount };
  }, [expiresAt, ttlSeconds]);

  useEffect(() => {
    if (clicked) return undefined;
    const msLeft = Math.max(0, expiresAt - Date.now());
    const t = setTimeout(() => onExpire?.(), msLeft);
    return () => clearTimeout(t);
  }, [expiresAt, onExpire, clicked]);

  const remainingSecs = Math.ceil(Math.max(0, expiresAt - now) / 1000);
  const headline = message || (title ? `Removed “${title}”` : 'Entry removed');

  const handleUndo = (e) => {
    e?.stopPropagation?.();
    if (clicked) return;
    setClicked(true);
    // Parent swaps this row for the real card synchronously — do not await API.
    onUndo?.();
  };

  return (
    <div
      className="relative bg-white border border-amber-200/70 rounded-xl p-3 flex items-center gap-3 shadow-sm"
      style={{ minHeight: 84 }}
      role="status"
      aria-live="polite"
      data-testid="diary-undo-row"
    >
      <div className="h-7 w-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
        <Trash2 className="w-4 h-4" aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-800 truncate">
          <span className="font-medium">{headline}</span>
        </p>
        <p className="text-[11px] text-amber-700/80">
          Undo available for {remainingSecs}s
        </p>
      </div>
      <button
        type="button"
        disabled={clicked}
        onClick={handleUndo}
        className={`inline-flex items-center gap-1.5 rounded-full border border-amber-300 px-3 py-1.5 text-sm font-medium shrink-0 ${
          clicked
            ? 'text-amber-500 bg-amber-50 cursor-not-allowed'
            : 'text-amber-800 hover:bg-amber-100/60 active:scale-95 transition'
        }`}
        aria-label="Undo delete"
      >
        <RotateCcw className="w-4 h-4" aria-hidden="true" />
        Undo
      </button>
      <span className="absolute left-0 right-0 bottom-0 h-0.5 bg-amber-200/70 overflow-hidden rounded-b-xl" aria-hidden="true">
        <span
          key={entryKey}
          className="block h-full bg-amber-600 origin-left will-change-transform"
          style={{
            transformOrigin: 'left',
            animation: `countdown-shrink ${total}s linear ${delayAtMount}s forwards`,
          }}
        />
      </span>
    </div>
  );
}
