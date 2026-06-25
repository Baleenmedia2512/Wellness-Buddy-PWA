import React, { useEffect, useMemo, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { parseAnalysisData } from '../../services/nutritionDashboard/analysisHelpers';
import { undoMealDelete } from '../../services/nutritionDashboard/mealMutationsApi';

const UNDO_SECONDS = 5;

const UndoRow = ({
  pid,
  originalMeal,
  expiresAt,
  ttlSeconds = UNDO_SECONDS,
  user,
  setAnalyses,
  setUndoState,
  applyDailyDelta,
}) => {
  const [now, setNow] = useState(Date.now());
  const [undoing, setUndoing] = useState(false);

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(iv);
  }, []);

  const { total, delayAtMount } = useMemo(() => {
    const t = Math.max(0, ttlSeconds);
    const startedAt = expiresAt - t * 1000;
    const elapsedAtMount = Math.min(t, Math.max(0, (Date.now() - startedAt) / 1000));
    return { total: t, delayAtMount: -elapsedAtMount };
  }, [expiresAt, ttlSeconds]);

  useEffect(() => {
    const msLeft = Math.max(0, expiresAt - Date.now());
    const t = setTimeout(() => {
      setAnalyses((prev) => prev.filter((a) => a.ID !== pid));
      setUndoState((prev) => {
        const next = { ...prev };
        delete next[pid];
        return next;
      });
    }, msLeft);
    return () => clearTimeout(t);
  }, [expiresAt, pid, setAnalyses, setUndoState]);

  const foodName = parseAnalysisData(originalMeal.AnalysisData).name || 'Food';
  const remainingSecs = Math.ceil(Math.max(0, expiresAt - now) / 1000);

  const handleUndo = async () => {
    if (undoing) return;
    setUndoing(true);
    const orig = originalMeal;
    setAnalyses((prev) => prev.filter((a) => a.ID !== pid).concat(orig));
    const n = parseAnalysisData(orig.AnalysisData).nutrition || {};
    const deltas = {
      calories: +(n.calories || orig.TotalCalories || 0),
      protein: +(n.protein || orig.TotalProtein || 0),
      carbs: +(n.carbs || orig.TotalCarbs || 0),
      fat: +(n.fat || orig.TotalFat || 0),
      fiber: +(n.fiber || orig.TotalFiber || 0),
      mealCountDelta: +1,
    };
    applyDailyDelta(deltas);
    setUndoState((prev) => {
      const nxt = { ...prev };
      delete nxt[pid];
      return nxt;
    });
    try {
      await undoMealDelete({ id: orig.ID, userId: user?.id });
    } catch (err) {
      setAnalyses((prev) =>
        prev.filter((a) => a.ID !== orig.ID).concat({
          ID: pid,
          isUndoPlaceholder: true,
          CreatedAt: orig.CreatedAt,
        }),
      );
      applyDailyDelta({
        calories: -deltas.calories,
        protein: -deltas.protein,
        carbs: -deltas.carbs,
        fat: -deltas.fat,
        fiber: -deltas.fiber,
        mealCountDelta: -1,
      });
      setUndoState((prev) => ({ ...prev, [pid]: { originalMeal: orig, expiresAt, ttlSeconds } }));
    } finally {
      setUndoing(false);
    }
  };

  return (
    <div className="relative bg-white border border-amber-200/70 rounded-xl p-3 flex items-center gap-3 shadow-sm">
      <div className="h-7 w-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
          <circle cx="12" cy="12" r="3" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-800 truncate">
          <span className="font-medium">Removed</span> “{foodName}”
        </p>
        <p className="text-[11px] text-amber-700/80">Undo available for {remainingSecs}s</p>
      </div>
      <button
        disabled={undoing}
        onClick={handleUndo}
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

export default UndoRow;
