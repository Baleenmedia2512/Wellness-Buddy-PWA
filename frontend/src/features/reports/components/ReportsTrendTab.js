/**
 * ReportsTrendTab — selected member's weight history from first valid
 * record through latest. Uses existing /api/weight/history.
 */
import React, { useEffect, useState } from 'react';
import {
  getWeightHistory,
  WEIGHT_TREND_RANGE_MAX,
} from '../../weight';
import {
  reportsMemberPossessiveTitle,
  resolveReportsViewedUser,
} from '../utils/reportsViewedMember.js';
import ReportsWeightTrendChart from './ReportsWeightTrendChart';

export default function ReportsTrendTab({ user, selectedMember }) {
  const viewedUser = resolveReportsViewedUser(selectedMember, user);
  const viewedUserId = viewedUser?.id || viewedUser?.userId;
  const viewerUserId = user?.id || user?.userId;
  const title = reportsMemberPossessiveTitle(selectedMember, 'Weight Trend');

  const [weightHistory, setWeightHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rangeDays, setRangeDays] = useState(WEIGHT_TREND_RANGE_MAX);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!viewedUserId) {
        setWeightHistory([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      const { ok, status, data } = await getWeightHistory(viewedUserId, {
        includeImage: false,
        viewerUserId,
      });
      if (cancelled) return;
      if (!ok || !data?.success) {
        setWeightHistory([]);
        setError(status === 403
          ? 'You do not have permission to view this member.'
          : (data?.message || 'Failed to load weight records.'));
        setLoading(false);
        return;
      }
      setWeightHistory(Array.isArray(data.data) ? data.data : []);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [viewedUserId, viewerUserId]);

  return (
    <div className="max-w-6xl mx-auto w-full px-3 sm:px-4 py-4">
      <h2 className="text-base sm:text-lg font-bold text-gray-900 mb-3">{title}</h2>
      {loading ? (
        <p className="text-sm text-gray-500 py-10 text-center">Loading weight trend...</p>
      ) : error ? (
        <p className="text-sm text-gray-500 py-10 text-center">{error}</p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 sm:p-4">
          <ReportsWeightTrendChart
            weightHistory={weightHistory}
            rangeDays={rangeDays}
            onRangeChange={setRangeDays}
          />
        </div>
      )}
    </div>
  );
}
