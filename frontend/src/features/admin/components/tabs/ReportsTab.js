/**
 * ReportsTab.js — quick reporting / "what is being shown" overview.
 *
 * Surfaces the selected date range, last refresh time, and a couple of
 * derived metrics (avg cost per user, user count). Pure presentational.
 */
import React from 'react';
import { Calendar as CalendarIcon, Clock, Users, Database } from 'lucide-react';
import AdminSkeleton from '../shared/AdminSkeleton';
import ErrorBanner from '../shared/ErrorBanner';
import { formatCurrency, formatNumber } from '../../services/tokenCostMath';

const Card = ({ Icon, label, value, sub }) => (
  <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-start gap-3">
    <div className="w-10 h-10 rounded-xl bg-green-50 text-green-600 flex items-center justify-center flex-shrink-0">
      <Icon className="w-5 h-5" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold">{label}</p>
      <p className="text-base font-bold text-gray-900 truncate">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  </div>
);

export default function ReportsTab({ loading, apiError, summary, dateRangeLabel, timeRange, lastUpdated, userCount }) {
  if (loading) return <AdminSkeleton showStats rows={0} />;

  const totalCost = summary.totalCost || 0;
  const avgPerUser = userCount > 0 ? totalCost / userCount : 0;
  const lastUpdatedText = lastUpdated ? lastUpdated.toLocaleTimeString() : '—';
  const rangeText = timeRange === 'custom' ? dateRangeLabel : (timeRange || '—');

  return (
    <div className="space-y-4">
      <ErrorBanner apiError={apiError} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Card Icon={CalendarIcon} label="Reporting Range" value={rangeText} sub={`${formatNumber(summary.totalTokens || 0)} tokens`} />
        <Card Icon={Clock}        label="Last Refresh"     value={lastUpdatedText} sub="Auto-refreshed on filter change" />
        <Card Icon={Users}        label="Active Users"     value={formatNumber(userCount)} sub={`Avg ${formatCurrency(avgPerUser)} / user`} />
        <Card Icon={Database}     label="Total Spend"      value={formatCurrency(totalCost)}
          sub={`${formatCurrency(summary.totalInputCost || 0)} in / ${formatCurrency(summary.totalOutputCost || 0)} out`} />
      </div>
    </div>
  );
}
