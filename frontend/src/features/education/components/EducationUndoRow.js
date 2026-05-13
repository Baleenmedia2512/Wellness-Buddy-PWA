/**
 * EducationUndoRow.js — inline countdown row for soft-deleted logs.
 *
 * Renders the amber undo banner that replaces a card while the
 * soft-delete window is open; calls `onRestore`/`onExpire` from the
 * dashboard hook.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, RotateCcw } from 'lucide-react';

const EducationUndoRow = ({ pid, originalLog, expiresAt, ttlSeconds, onRestore, onExpire }) => {
  const [now, setNow] = useState(Date.now());
  const [undoing, setUndoing] = useState(false);

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(iv);
  }, []);

  const { total, delayAtMount } = useMemo(() => {
    const t = Math.max(0, ttlSeconds);
    const startedAt = expiresAt - t * 1000;
    const elapsed = Math.min(t, Math.max(0, (Date.now() - startedAt) / 1000));
    return { total: t, delayAtMount: -elapsed };
  }, [expiresAt, ttlSeconds]);

  useEffect(() => {
    const ms = Math.max(0, expiresAt - Date.now());
    const timer = setTimeout(() => onExpire(), ms);
    return () => clearTimeout(timer);
  }, [expiresAt, onExpire]);

  const remaining = Math.ceil(Math.max(0, expiresAt - now) / 1000);

  return (
    <div className="relative bg-white border border-amber-200/70 rounded-xl p-3 flex items-center gap-3 shadow-sm" style={{ height: 84 }}>
      <div className="h-7 w-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
        <BookOpen className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-800 truncate">
          <span className="font-medium">Removed:</span> {originalLog.Topic}
        </p>
        <p className="text-[11px] text-amber-700/80">Undo available for {remaining}s</p>
      </div>
      <button disabled={undoing}
        onClick={async () => {
          if (undoing) return;
          setUndoing(true);
          await onRestore(pid, originalLog);
          setUndoing(false);
        }}
        className={`inline-flex items-center gap-1.5 rounded-full border border-amber-300 px-3 py-1.5 text-sm font-medium ${
          undoing ? 'text-amber-500 bg-amber-50 cursor-not-allowed' : 'text-amber-800 hover:bg-amber-100/60 active:scale-95 transition'
        }`}>
        {undoing ? (
          <>
            <span className="inline-block h-4 w-4 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
            Restoring…
          </>
        ) : (<><RotateCcw className="w-4 h-4" />Undo</>)}
      </button>
      <span className="absolute left-0 right-0 bottom-0 h-0.5 bg-amber-200/70 overflow-hidden rounded-b-xl">
        <span key={pid} className="block h-full bg-amber-600 origin-left will-change-transform"
          style={{ transformOrigin: 'left',
            animation: `countdown-shrink ${total}s linear ${delayAtMount}s forwards` }} />
      </span>
    </div>
  );
};

export default EducationUndoRow;
