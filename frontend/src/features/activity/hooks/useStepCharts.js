/**
 * useStepCharts.js — owns history list state + member-data fetch.
 *
 * Two responsibilities:
 *   1. Daily history loader (used on mount, after manual refresh, after
 *      midnight reset, and after a successful backfill).
 *   2. "Coach viewing a team member" data loader: when `selectedMember`
 *      is set, fetch their today's row + 30-day history in parallel.
 *
 * Also exposes the `historyView` 'week'/'month' toggle and a `historyData`
 * memo that returns the appropriate slice of the history array.
 */
import { useState, useEffect, useCallback } from 'react';
import { fetchHistory, fetchTodayEntry } from '../services/stepCounterPersistence';
import { calcCalories } from '../services/stepCounterCalculations';

export function useStepCharts({ refs, selectedMember }) {
  const [dailyHistory, setDailyHistory] = useState([]);
  const [historyView, setHistoryView]   = useState('week');
  const [memberData, setMemberData]     = useState({ steps: 0, calories: 0, history: [], loading: false });

  const loadDailyHistory = useCallback(async () => {
    const userId = refs.resolvedUserIdRef.current;
    if (!userId) return;
    try {
      const trend = await fetchHistory(userId, 30);
      setDailyHistory(trend);
    } catch (err) {
      console.error('[StepCounter] Load history failed:', err);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps // intentional: listed deps would cause an infinite re-render // intentional: adding this dep causes an infinite re-render loop
  }, []);

  // Member data fetch (coach viewing a team member)
  useEffect(() => {
    if (!selectedMember || selectedMember.isSelf) {
      setMemberData({ steps: 0, calories: 0, history: [], loading: false });
      return;
    }
    const memberId = selectedMember.id || selectedMember.userId;
    setMemberData((prev) => ({ ...prev, loading: true }));
    Promise.all([fetchTodayEntry(memberId), fetchHistory(memberId, 30)])
      .then(([todayEntry, history]) => {
        const steps = todayEntry?.steps || 0;
        const calories = todayEntry?.caloriesBurned ?? todayEntry?.calories ?? calcCalories(steps);
        setMemberData({ steps, calories, history, loading: false });
      })
      .catch((err) => {
        console.error('[StepCounter] Failed to load member data:', err);
        setMemberData({ steps: 0, calories: 0, history: [], loading: false });
      });
  }, [selectedMember]);

  const sliceForView = useCallback(
    (history) => (historyView === 'week' ? history.slice(-7) : history),
    [historyView]
  );

  return { dailyHistory, loadDailyHistory, historyView, setHistoryView, memberData, sliceForView };
}
