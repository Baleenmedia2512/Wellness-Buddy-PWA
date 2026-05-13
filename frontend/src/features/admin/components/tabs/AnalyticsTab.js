/**
 * AnalyticsTab.js — token-mix analytics: total / input / output ratios
 * plus a horizontal bar showing input-vs-output share.
 */
import React from 'react';
import { Zap } from 'lucide-react';
import AdminSkeleton from '../shared/AdminSkeleton';
import ErrorBanner from '../shared/ErrorBanner';
import { formatCurrency, formatNumber } from '../../services/tokenCostMath';

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

export default function AnalyticsTab({ loading, apiError, summary, userCount }) {
  if (loading) return <AdminSkeleton showStats rows={0} />;

  const totalTokens = summary.totalTokens || 0;
  const totalCost = summary.totalCost || 0;
  const avgTokensPerUser = userCount > 0 ? Math.round(totalTokens / userCount) : 0;
  const costPerThousand = totalTokens > 0 ? (totalCost / (totalTokens / 1000)) : 0;

  return (
    <div className="space-y-4">
      <ErrorBanner apiError={apiError} />

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
