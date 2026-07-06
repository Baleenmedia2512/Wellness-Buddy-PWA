/**
 * DownlineWeightReport.js — Full-page report: direct downline weight status.
 *
 * Shows each direct-downline member's current weight vs their ideal range
 * (BMI 19–23 × height²). Supports filter tabs: Off-Track · On Track · No Data · All.
 *
 * Props:
 *   user      — { id } from App.js session
 *   onBack    — navigate back handler
 */
import React from 'react';
import { ArrowLeft, RefreshCw, TrendingUp, TrendingDown, CheckCircle, HelpCircle } from 'lucide-react';
import { useDownlineWeightReport } from '../hooks/useDownlineWeightReport';
import WeightStatusRow from './WeightStatusRow';
import TouchFeedbackButton from '../../../shared/components/TouchFeedbackButton';

const FILTERS = [
  { key: 'off_track', label: 'Off Track' },
  { key: 'on_track',  label: 'On Track'  },
  { key: 'no_data',   label: 'No Data'   },
  { key: 'all',       label: 'All'       },
];

function SummaryPill({ icon: Icon, count, label, colour }) {
  return (
    <div className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl ${colour}`}>
      <Icon className="h-4 w-4" />
      <span className="text-lg font-bold leading-tight">{count}</span>
      <span className="text-[10px] font-medium leading-tight">{label}</span>
    </div>
  );
}

export default function DownlineWeightReport({ user, onBack }) {
  const coachId = user?.id ?? null;
  const { filter, setFilter, filtered, counts, loading, error, refresh } =
    useDownlineWeightReport({ coachId });

  const offTrackCount = counts.above_ideal + counts.below_ideal;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Page header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center gap-3">
          <TouchFeedbackButton
            onClick={onBack}
            className="flex-shrink-0 p-2 -ml-2 rounded-xl hover:bg-gray-100 transition-colors"
            ariaLabel="Go back"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </TouchFeedbackButton>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-gray-900 leading-tight">Weight Status Report</h1>
            <p className="text-xs text-gray-500 mt-0.5">Direct downline · ideal weight tracking</p>
          </div>
          <TouchFeedbackButton
            onClick={refresh}
            disabled={loading}
            className="flex-shrink-0 p-2 rounded-xl hover:bg-gray-100 transition-colors disabled:opacity-40"
            ariaLabel="Refresh"
          >
            <RefreshCw className={`h-4 w-4 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
          </TouchFeedbackButton>
        </div>
      </div>

      {/* Summary pills */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex gap-2 justify-around bg-white rounded-2xl shadow-sm border border-gray-100 p-3">
          <SummaryPill
            icon={TrendingUp}
            count={counts.above_ideal}
            label="Above"
            colour="text-orange-600"
          />
          <div className="w-px bg-gray-100" />
          <SummaryPill
            icon={TrendingDown}
            count={counts.below_ideal}
            label="Below"
            colour="text-blue-600"
          />
          <div className="w-px bg-gray-100" />
          <SummaryPill
            icon={CheckCircle}
            count={counts.on_track}
            label="On Track"
            colour="text-green-600"
          />
          <div className="w-px bg-gray-100" />
          <SummaryPill
            icon={HelpCircle}
            count={counts.no_data}
            label="No Data"
            colour="text-gray-400"
          />
        </div>
      </div>

      {/* Filter tabs */}
      <div className="px-4 pb-3">
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
          {FILTERS.map(({ key, label }) => {
            const isActive = filter === key;
            return (
              <TouchFeedbackButton
                key={key}
                onClick={() => setFilter(key)}
                className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  isActive
                    ? 'bg-green-600 text-white'
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-green-300'
                }`}
              >
                {label}
                {key === 'off_track' && offTrackCount > 0 && (
                  <span className={`ml-1.5 inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full text-[9px] font-bold ${
                    isActive ? 'bg-white text-green-700' : 'bg-orange-100 text-orange-700'
                  }`}>
                    {offTrackCount}
                  </span>
                )}
              </TouchFeedbackButton>
            );
          })}
        </div>
      </div>

      {/* Body */}
      <div className="px-4 pb-8 space-y-3">
        {/* Loading skeleton */}
        {loading && filtered.length === 0 && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-gray-200" />
                  <div className="flex-1 h-4 rounded bg-gray-200" />
                  <div className="h-5 w-20 rounded-full bg-gray-200" />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="h-8 rounded bg-gray-100" />
                  <div className="h-8 rounded bg-gray-100" />
                </div>
                <div className="mt-3 h-2 rounded-full bg-gray-100" />
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-center">
            <p className="text-sm text-red-600 font-medium">{error}</p>
            <TouchFeedbackButton
              onClick={refresh}
              className="mt-2 text-xs text-red-500 underline"
            >
              Try again
            </TouchFeedbackButton>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <CheckCircle className="h-12 w-12 text-green-400 mb-3" />
            <p className="text-sm font-semibold text-gray-700">
              {filter === 'off_track'
                ? 'All members are at their ideal weight!'
                : 'No members in this category.'}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {filter === 'off_track' ? 'Great work, coach.' : 'Try a different filter.'}
            </p>
          </div>
        )}

        {/* Member rows */}
        {!error && filtered.map((row) => (
          <WeightStatusRow key={row.userId} row={row} />
        ))}
      </div>
    </div>
  );
}
