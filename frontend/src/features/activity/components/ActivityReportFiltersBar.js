import React from 'react';
import { Calendar, ChevronDown, Filter, Search, X } from 'lucide-react';
import TouchFeedbackButton from '../../../shared/components/TouchFeedbackButton';
import DateRangePicker from '../../../shared/components/common/DateRangePicker';
import { ACTIVITY_REPORT_DATE_RANGES, formatCustomRangeLabel } from '../../../shared/domain/reportDateRanges';
import { TEAM_SCOPES, TEAM_SCOPE_OPTIONS } from '../../reports/utils/reportFilters';
import {
  ACTIVITY_REPORT_ATTENDANCE_OPTIONS,
} from '../utils/activityReportTableFilters';

const FIELD_LABEL_CLASS =
  'mb-1 block text-[10px] font-semibold uppercase tracking-wide text-gray-500';

const SELECT_CLASS =
  'w-full h-9 appearance-none rounded-lg border border-gray-200 bg-white px-3 pr-8 text-sm text-gray-800 shadow-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/30 disabled:bg-gray-50 disabled:text-gray-400';

const SEGMENT_BASE =
  'inline-flex items-center justify-center h-9 px-3 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50';

/**
 * Single combined Activity Report filter panel:
 * report scope (date / team / category / attendance) + table search / facets.
 */
export default function ActivityReportFiltersBar({
  dateRange,
  customStartDate,
  customEndDate,
  showDatePicker,
  onDateRangeChange,
  onOpenCustomPicker,
  onCustomDateSelect,
  onCloseDatePicker,
  showTeamScope,
  teamScope,
  teamScopeCounts,
  onTeamScopeChange,
  selectedActivity,
  activityTypes,
  summary,
  onActivityChange,
  attendanceStatus,
  onAttendanceChange,
  searchQuery = '',
  onSearchChange,
  activeFilterChips = [],
  onOpenTableFilters,
  onRemoveTableFilter,
  onClearTableFilters,
  summaryLoading = false,
  detailLoading = false,
}) {
  const presetRanges = ACTIVITY_REPORT_DATE_RANGES.filter((range) => range.value !== 'custom');
  const customLabel = dateRange === 'custom'
    ? formatCustomRangeLabel(customStartDate, customEndDate)
    : 'Custom';
  const tableFilterCount = activeFilterChips.length;
  const busy = summaryLoading || detailLoading;

  return (
    <section
      className="mb-3 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
      aria-label="Report filters"
    >
      <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-3 py-2 sm:px-4">
        <h2 className="text-xs font-bold uppercase tracking-wide text-gray-500">
          Filters
        </h2>
        {busy && (
          <span className="text-[10px] font-medium text-gray-400">Updating…</span>
        )}
      </div>

      <div className="space-y-3 p-3 sm:p-4">
        <div>
          <span className={FIELD_LABEL_CLASS}>Date range</span>
          <div className="flex flex-wrap items-center gap-1.5">
            {presetRanges.map((range) => {
              const active = dateRange === range.value;
              return (
                <TouchFeedbackButton
                  key={range.value}
                  type="button"
                  disabled={summaryLoading}
                  onClick={() => onDateRangeChange(range.value)}
                  className={`${SEGMENT_BASE} ${
                    active
                      ? 'bg-green-600 text-white shadow-sm'
                      : 'border border-gray-200 bg-white text-gray-700 hover:border-green-400 hover:bg-green-50'
                  }`}
                >
                  {range.label}
                </TouchFeedbackButton>
              );
            })}
            <TouchFeedbackButton
              type="button"
              disabled={summaryLoading}
              onClick={() => {
                if (dateRange === 'custom') {
                  onOpenCustomPicker?.();
                } else {
                  onDateRangeChange('custom');
                }
              }}
              ariaLabel={
                dateRange === 'custom'
                  ? `Edit custom dates, ${customLabel}`
                  : 'Choose custom date range'
              }
              className={`${SEGMENT_BASE} gap-1.5 max-w-full ${
                dateRange === 'custom'
                  ? 'bg-green-600 text-white shadow-sm'
                  : 'border border-gray-200 bg-white text-gray-700 hover:border-green-400 hover:bg-green-50'
              }`}
            >
              <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate">{customLabel}</span>
              <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 opacity-70" />
            </TouchFeedbackButton>
          </div>
        </div>

        {showDatePicker && dateRange === 'custom' && (
          <DateRangePicker
            startDate={customStartDate}
            endDate={customEndDate}
            onSelect={onCustomDateSelect}
            onClose={onCloseDatePicker}
          />
        )}

        <div
          className={`grid gap-3 ${
            showTeamScope ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'
          }`}
        >
          {showTeamScope && (
            <label className="min-w-0 block">
              <span className={FIELD_LABEL_CLASS}>Team</span>
              <div className="relative">
                <select
                  value={teamScope}
                  onChange={(event) => onTeamScopeChange(event.target.value)}
                  disabled={busy}
                  className={SELECT_CLASS}
                >
                  {TEAM_SCOPE_OPTIONS.map(({ value, label }) => {
                    const count = teamScopeCounts?.[value] ?? 0;
                    const showCount = value !== TEAM_SCOPES.MINE;
                    return (
                      <option key={value} value={value}>
                        {showCount ? `${label} (${count})` : label}
                      </option>
                    );
                  })}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              </div>
            </label>
          )}

          <label className="min-w-0 block">
            <span className={FIELD_LABEL_CLASS}>Category</span>
            <div className="relative">
              <select
                value={selectedActivity}
                onChange={(event) => onActivityChange(event.target.value)}
                disabled={detailLoading}
                className={SELECT_CLASS}
              >
                {activityTypes.map((activity) => (
                  <option key={activity.id} value={activity.id}>
                    {activity.label} ({summary?.[activity.id] || 0})
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            </div>
          </label>

          <label className="min-w-0 block">
            <span className={FIELD_LABEL_CLASS}>Attendance</span>
            <div className="relative">
              <select
                value={attendanceStatus}
                onChange={onAttendanceChange}
                disabled={detailLoading}
                className={SELECT_CLASS}
              >
                {ACTIVITY_REPORT_ATTENDANCE_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            </div>
          </label>
        </div>

        <div>
          <span className={FIELD_LABEL_CLASS}>Find in results</span>
          <div className="flex items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search name or phone"
                value={searchQuery}
                onChange={(event) => onSearchChange?.(event.target.value)}
                className="h-9 w-full rounded-lg border border-gray-200 bg-white pl-8 pr-3 text-sm text-gray-800 shadow-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/30"
              />
            </div>
            <TouchFeedbackButton
              type="button"
              onClick={onOpenTableFilters}
              disabled={detailLoading}
              ariaLabel={
                tableFilterCount > 0
                  ? `Open more filters, ${tableFilterCount} active`
                  : 'Open more filters'
              }
              className={`relative inline-flex h-9 flex-shrink-0 items-center gap-1.5 rounded-lg border px-3 text-sm font-semibold ${
                tableFilterCount > 0
                  ? 'border-green-600 bg-green-50 text-green-800'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-green-400'
              }`}
            >
              <Filter className="h-3.5 w-3.5" />
              More
              {tableFilterCount > 0 && (
                <span className="inline-flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-green-600 px-1 text-[10px] font-bold text-white">
                  {tableFilterCount}
                </span>
              )}
            </TouchFeedbackButton>
          </div>
        </div>

        {tableFilterCount > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-0.5">
            {activeFilterChips.map((chip) => (
              <TouchFeedbackButton
                key={chip.id}
                type="button"
                onClick={() => onRemoveTableFilter?.(chip.columnId, chip.value)}
                className="inline-flex max-w-full flex-shrink-0 items-center gap-0.5 rounded-full bg-green-100 py-0.5 pl-2 pr-1 text-[10px] font-semibold text-green-800"
                ariaLabel={`Remove ${chip.label} ${chip.displayValue} filter`}
              >
                <span className="truncate">
                  {chip.label}: {chip.displayValue}
                </span>
                <X className="h-3 w-3 flex-shrink-0" />
              </TouchFeedbackButton>
            ))}
            <TouchFeedbackButton
              type="button"
              onClick={onClearTableFilters}
              className="flex-shrink-0 px-1 text-[10px] font-semibold text-gray-500 hover:text-gray-800"
              ariaLabel="Clear table filters"
            >
              Clear all
            </TouchFeedbackButton>
          </div>
        )}
      </div>
    </section>
  );
}
