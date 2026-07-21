/**
 * DownlineWeightReport.js — Full-page report: team weight status with filters.
 *
 * Shows each member's current weight vs their ideal range (BMI 19–23 × height²).
 * Supports search, team scope (Mine / Direct / Full), and status filter chips.
 *
 * Props:
 *   user      — { id } from App.js session
 *   onBack    — navigate back handler
 */
import React from 'react';
import { ArrowLeft, RefreshCw, CheckCircle } from 'lucide-react';
import { useDownlineWeightReport } from '../hooks/useDownlineWeightReport';
import WeightStatusRow from './WeightStatusRow';
import ReportSearchBar from './ReportSearchBar';
import TouchFeedbackButton from '../../../shared/components/TouchFeedbackButton';
import {
  STATUS_FILTERS,
  STATUS_FILTER_OPTIONS,
  TEAM_SCOPES,
  TEAM_SCOPE_OPTIONS,
} from '../utils/reportFilters.js';
import { resolveRowTeamPerformance } from '../utils/reportTeamPerformance.js';

function getStatusCountKey(filterKey) {
  if (filterKey === STATUS_FILTERS.OFF_TRACK) return 'off_track';
  if (filterKey === STATUS_FILTERS.ON_TRACK) return 'on_track';
  if (filterKey === STATUS_FILTERS.NO_DATA) return 'no_data';
  return 'all';
}

export default function DownlineWeightReport({ user, onBack }) {
  const coachId = user?.id ?? null;
  const {
    teamScope,
    setTeamScope,
    statusFilter,
    setStatusFilter,
    searchQuery,
    setSearchQuery,
    teamScopeCounts,
    statusCounts,
    self,
    filtered,
    teamPerformanceByUserId,
    loading,
    error,
    refresh,
  } = useDownlineWeightReport({ coachId });

  return (
    <div className="min-h-full bg-gray-50">
      {/* Page header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200">
        <div className="max-w-lg mx-auto w-full px-4 sm:px-6 py-3">
          <div className="flex items-center gap-2 sm:gap-3">
            <TouchFeedbackButton
              onClick={onBack}
              className="flex-shrink-0 p-2 -ml-2 rounded-xl hover:bg-gray-100 transition-colors"
              ariaLabel="Go back"
            >
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </TouchFeedbackButton>
            <div className="flex-1 min-w-0">
              <h1 className="text-base sm:text-lg font-bold text-gray-900 leading-tight truncate">
                Ideal Weight Report
              </h1>
              <p className="text-[11px] sm:text-xs text-gray-500 mt-0.5 truncate">
                Team weight · ideal range tracking
              </p>
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
      </div>

      <div className="max-w-lg mx-auto w-full px-4 sm:px-6 pt-4 pb-24 space-y-3">
        {/* Search */}
        <ReportSearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          disabled={loading}
        />

        {/* Team scope segmented control */}
        <div
          className="bg-white rounded-xl border border-gray-200 shadow-sm px-1 py-1 flex gap-1 w-full"
          role="group"
          aria-label="Team scope filter"
        >
          {TEAM_SCOPE_OPTIONS.map(({ value, label, short }) => {
            const isActive = teamScope === value;
            const count = teamScopeCounts[value] ?? 0;
            const showCount = value !== TEAM_SCOPES.MINE;
            const desktopLabel = showCount ? `${label} (${count})` : label;
            const mobileLabel = showCount ? `${short} (${count})` : short;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setTeamScope(value)}
                disabled={loading}
                aria-pressed={isActive}
                className={`flex-1 min-w-0 py-2 sm:py-2.5 rounded-lg text-[11px] sm:text-xs font-semibold transition-all duration-150 cursor-pointer px-1 sm:px-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                  isActive
                    ? 'bg-green-600 text-white shadow-sm'
                    : 'text-green-800 hover:bg-green-50'
                }`}
              >
                <span className="hidden sm:inline truncate">{desktopLabel}</span>
                <span className="sm:hidden truncate">{mobileLabel}</span>
              </button>
            );
          })}
        </div>

        {/* Status filter chips — horizontal scroll on mobile, wrap on larger screens */}
        <div
          className="flex gap-1.5 overflow-x-auto scrollbar-hide sm:flex-wrap sm:gap-2 sm:overflow-visible"
          role="group"
          aria-label="Status filter"
        >
          {STATUS_FILTER_OPTIONS.map(({ key, label }) => {
            const isActive = statusFilter === key;
            const count = statusCounts[getStatusCountKey(key)];
            return (
              <TouchFeedbackButton
                key={key}
                onClick={() => setStatusFilter(key)}
                className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-[11px] sm:text-xs font-semibold transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-green-600 text-white'
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-green-300'
                }`}
              >
                {label} ({count})
              </TouchFeedbackButton>
            );
          })}
        </div>

        {/* Body */}
        <div className="space-y-3">
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
              {statusFilter === STATUS_FILTERS.OFF_TRACK && !searchQuery.trim()
                ? 'All members are at their ideal weight!'
                : 'No members match the current filters.'}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {statusFilter === STATUS_FILTERS.OFF_TRACK && !searchQuery.trim()
                ? 'Great work, coach.'
                : 'Try adjusting your search or filters.'}
            </p>
          </div>
        )}

        {/* Member rows */}
        {!error && filtered.map((row) => (
          <WeightStatusRow
            key={row.userId}
            row={row}
            teamPerformance={resolveRowTeamPerformance({
              row,
              teamScope,
              self,
              loggedInCoachId: coachId,
              teamPerformanceByUserId,
            })}
          />
        ))}
        </div>
      </div>
    </div>
  );
}
