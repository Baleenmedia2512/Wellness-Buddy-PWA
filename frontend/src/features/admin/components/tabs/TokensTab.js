/**
 * TokensTab.js — primary cost+token summary view.
 *
 * Shows the swipeable summary card (cost ↔ tokens) plus the standing
 * USD-per-million pricing config the dashboard is using.
 */
import React, { useState } from 'react';
import { DollarSign } from 'lucide-react';
import SummaryStatsCard from '../shared/SummaryStatsCard';
import AdminSkeleton from '../shared/AdminSkeleton';
import ErrorBanner from '../shared/ErrorBanner';

const PricingRow = ({ label, value }) => (
  <div className="flex items-center justify-between py-1.5">
    <span className="text-xs text-gray-500">{label}</span>
    <span className="text-sm font-semibold text-gray-800">
      {value != null ? `$${Number(value).toFixed(2)}` : '—'}
    </span>
  </div>
);

export default function TokensTab({ loading, apiError, summary, perMillionCosts }) {
  const [summaryTab, setSummaryTab] = useState('cost');

  if (loading) return <AdminSkeleton showStats rows={0} />;

  return (
    <div className="space-y-4">
      <ErrorBanner apiError={apiError} />
      <SummaryStatsCard summary={summary} summaryTab={summaryTab} setSummaryTab={setSummaryTab} />

      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-2">
          <DollarSign className="w-4 h-4 text-green-500" />
          Pricing (USD per 1M tokens)
        </h3>
        <PricingRow label="Input"  value={perMillionCosts?.inputPerMillion} />
        <PricingRow label="Output" value={perMillionCosts?.outputPerMillion} />
        <p className="text-[11px] text-gray-400 mt-2">
          Open the Corrections tab to update.
        </p>
      </div>
    </div>
  );
}
