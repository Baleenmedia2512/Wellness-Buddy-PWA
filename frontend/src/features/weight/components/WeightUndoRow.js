/**
 * WeightUndoRow.js — slice-internal undo placeholder row.
 *
 * Renders an inline countdown card with an Undo button replacing a
 * deleted weight entry. Animation is frozen at mount via a delay so
 * remounts mid-countdown don't restart the visual progress bar.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { UNDO_SECONDS } from '../services/weightDashboardFormatter';

const WeightUndoRow = ({
  pid, originalEntry, expiresAt, ttlSeconds = UNDO_SECONDS, onRestore, onExpire,
}) => {
  const [now, setNow] = useState(Date.now());
  const [undoing, setUndoing] = useState(false);

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
    const msLeft = Math.max(0, expiresAt - Date.now());
    const t = setTimeout(() => onExpire(), msLeft);
    return () => clearTimeout(t);
  }, [expiresAt, onExpire]);

  const remainingSecs = Math.ceil(Math.max(0, expiresAt - now) / 1000);
  const weightDisplay = originalEntry?.Weight ? `${originalEntry.Weight} kg` : 'Weight';

  return (
    <div
      className="relative bg-white border border-amber-200/70 rounded-xl p-3 flex items-center gap-3 shadow-sm"
      style={{ height: 84 }}
    >
      <div className="h-7 w-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
          <circle cx="12" cy="12" r="3" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-800 truncate">
          <span className="font-medium">Removed weight:</span> {weightDisplay}
        </p>
        <p className="text-[11px] text-amber-700/80">Undo available for {remainingSecs}s</p>
      </div>
      <button
        disabled={undoing}
        onClick={async () => {
          if (undoing) return;
          setUndoing(true);
          await onRestore(pid, originalEntry);
          setUndoing(false);
        }}
        className={`inline-flex items-center gap-1.5 rounded-full border border-amber-300 px-3 py-1.5 text-sm font-medium ${
          undoing
            ? 'text-amber-500 bg-amber-50 cursor-not-allowed'
            : 'text-amber-800 hover:bg-amber-100/60 active:scale-95 transition'
        }`}
      >
        {undoing ? (
          <>
            <span className="inline-block h-4 w-4 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
            Restoring…
          </>
        ) : (
          <>
            <RotateCcw className="w-4 h-4" />
            Undo
          </>
        )}
      </button>
      <span className="absolute left-0 right-0 bottom-0 h-0.5 bg-amber-200/70 overflow-hidden rounded-b-xl">
        <span
          key={pid}
          className="block h-full bg-amber-600 origin-left will-change-transform"
          style={{
            transformOrigin: 'left',
            animation: `countdown-shrink ${total}s linear ${delayAtMount}s forwards`,
          }}
        />
      </span>
    </div>
  );
};

export default WeightUndoRow;
