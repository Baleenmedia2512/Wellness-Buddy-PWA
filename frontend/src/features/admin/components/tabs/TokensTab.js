/**
 * TokensTab.js — consolidated token overview (post-refactor).
 *
 * Merges the former Analytics and Reports tabs.
 * Shows: AI model, resolved date range (from → to), cost/token summary,
 * input-vs-output distribution, and avg-tokens metrics.
 */
import React, { useState } from 'react';
import { Zap, Calendar } from 'lucide-react';
import SummaryStatsCard from '../shared/SummaryStatsCard';
import AdminSkeleton from '../shared/AdminSkeleton';
import ErrorBanner from '../shared/ErrorBanner';
import { formatCurrency, formatNumber } from '../../services/tokenCostMath';
import { getDateRangeBounds, TIME_RANGE_LABELS } from '../../services/dateRangeUtils';

const Bar = ({ label, value, total, color }) => {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span className="text-gray-600 font-medium">{label}</span>
        <span className="text-gray-500">{formatNumber(value)} ({pct.toFixed(1)}%)</span>
      </div>
      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

export default function TokensTab({
  loading, apiError, summary,
  userCount, timeRange, dateRangeLabel, customStartDate, customEndDate,
}) {
  const [summaryTab, setSummaryTab] = useState('cost');

  if (loading) return <AdminSkeleton showStats rows={0} />;

  const totalTokens = summary.totalTokens || 0;
  const totalCost = summary.totalCost || 0;
  const avgTokensPerUser = userCount > 0 ? Math.round(totalTokens / userCount) : 0;
  const costPerThousand = totalTokens > 0 ? (totalCost / (totalTokens / 1000)) : 0;

  const bounds = getDateRangeBounds(timeRange, customStartDate, customEndDate);
  const dateOpt = { year: 'numeric', month: 'short', day: 'numeric' };
  const fromLabel = bounds.from ? bounds.from.toLocaleDateString('en-IN', dateOpt) : null;
  const toLabel = bounds.to ? bounds.to.toLocaleDateString('en-IN', dateOpt) : null;
  const rangeDisplay =
    timeRange === 'all' ? 'All time' :
    timeRange === 'custom' && dateRangeLabel ? dateRangeLabel :
    TIME_RANGE_LABELS[timeRange] || timeRange;

  return (
    <div className="space-y-4">
      <ErrorBanner apiError={apiError} />

      {/* AI model + resolved date range */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-green-500 flex-shrink-0" />
            <span className="text-xs text-gray-500 font-medium">AI Model</span>
          </div>
          <span className="text-xs font-semibold text-gray-800 bg-green-50 border border-green-100 px-2.5 py-0.5 rounded-full">
            gemini-2.5-flash-lite
          </span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-green-500 flex-shrink-0" />
            <span className="text-xs text-gray-500 font-medium">{rangeDisplay}</span>
          </div>
          {fromLabel && toLabel ? (
            <span className="text-xs font-semibold text-gray-700">{fromLabel} → {toLabel}</span>
          ) : (
            <span className="text-xs text-gray-400">All records</span>
          )}
        </div>
      </div>

      <SummaryStatsCard summary={summary} summaryTab={summaryTab} setSummaryTab={setSummaryTab} />

      {/* Token distribution */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-4">
          <Zap className="w-4 h-4 text-green-500" />
          Token Distribution
        </h3>
        <div className="space-y-3">
          <Bar label="Input Tokens"  value={summary.totalInputTokens || 0}  total={totalTokens} color="bg-blue-500" />
          <Bar label="Output Tokens" value={summary.totalOutputTokens || 0} total={totalTokens} color="bg-purple-500" />
        </div>
      </div>

      {/* Derived metrics */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <p className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold">Avg Tokens / User</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{formatNumber(avgTokensPerUser)}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <p className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold">Cost per 1K Tokens</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{formatCurrency(costPerThousand)}</p>
        </div>
      </div>

    </div>
  );
}
