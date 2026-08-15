/**
 * WellnessScoreReport — Excel-style coach dashboard.
 * Date filter + server-side pagination (10/page); Share Excel for selected date.
 * Interactive column sorting (asc/desc) with visual indicators.
 */
import React, { useState, useCallback, startTransition } from 'react';
import {
  RefreshCw,
  Share2,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWellnessScoreReport } from '../hooks/useWellnessScoreReport';
import ReportSearchBar from './ReportSearchBar';
import TouchFeedbackButton from '../../../shared/components/TouchFeedbackButton';
import { TEAM_SCOPES, TEAM_SCOPE_OPTIONS } from '../utils/reportFilters.js';
import {
  computeWeightChange,
  formatWeightKg,
  formatWellnessScore,
  formatReportNameLines,
} from '../utils/wellnessScoreReportFormat.js';
import {
  buildWellnessScoreReportFileName,
  buildWellnessScoreWorkbookBuffer,
  shareWellnessScoreExcel,
} from '../utils/wellnessScoreReportExcel.js';
import { fetchWellnessScoreReport } from '../services/wellnessScoreReportApi.js';
import { getDbUserId } from '../../../shared/services/sessionStorage';
import {
  DATE_PRESETS,
  formatReportDateLabel,
} from '../utils/reportDateFilter.js';
import {
  REPORT_SORT_KEYS,
  REPORT_SORT_DIRS,
} from '../utils/wellnessScoreReportSort.js';

/**
 * Column headers — `lines` / `mobileLines` stack so labels fit.
 * Mobile uses full labels (WEIGHT, TODAY VS PREVIOUS, WELLNESS SCORE, SPONSOR NAME)
 * with a narrow NAME column so the row still fits on a phone.
 * @type {Array<{
 *   key: string,
 *   sortKey: string,
 *   lines: string[],
 *   mobileLines?: string[],
 *   colClass: string,
 * }>}
 */
const TABLE_HEADERS = [
  {
    key: 'name',
    sortKey: REPORT_SORT_KEYS.NAME,
    lines: ['NAME'],
    colClass: 'w-[4.25rem] min-w-[4.25rem] max-w-[4.25rem] sm:w-[10rem] sm:min-w-[10rem] sm:max-w-[10rem]',
  },
  {
    key: 'weight',
    sortKey: REPORT_SORT_KEYS.WEIGHT,
    lines: ['WEIGHT'],
    colClass: 'w-[3.85rem] min-w-[3.85rem] max-w-[3.85rem] sm:w-[5.5rem] sm:min-w-[5.5rem] sm:max-w-[5.5rem]',
  },
  {
    key: 'vsPrevious',
    sortKey: REPORT_SORT_KEYS.VS_PREVIOUS,
    lines: ['TODAY VS', 'PREVIOUS', 'WEIGHT'],
    mobileLines: ['TODAY VS', 'PREVIOUS'],
    colClass: 'w-[4.6rem] min-w-[4.6rem] max-w-[4.6rem] sm:w-[5.5rem] sm:min-w-[5.5rem] sm:max-w-[5.5rem]',
  },
  {
    key: 'score',
    sortKey: REPORT_SORT_KEYS.SCORE,
    lines: ['WELLNESS', 'SCORE'],
    mobileLines: ['WELLNESS', 'SCORE'],
    colClass: 'w-[4.5rem] min-w-[4.5rem] max-w-[4.5rem] sm:w-[4.5rem] sm:min-w-[4.5rem] sm:max-w-[4.5rem]',
  },
  {
    key: 'sponsor',
    sortKey: REPORT_SORT_KEYS.SPONSOR,
    lines: ['SPONSOR', 'NAME'],
    mobileLines: ['SPONSOR', 'NAME'],
    colClass: 'w-auto min-w-[4.25rem] sm:min-w-[7rem]',
  },
];

/**
 * @param {object} props
 * @param {typeof TABLE_HEADERS[number]} props.header
 * @param {number} props.idx
 * @param {string} props.sort
 * @param {string} props.sortDir
 * @param {(key: string) => void} props.onSort
 * @param {boolean} [props.disabled]
 */
function SortableHeaderCell({ header, idx, sort, sortDir, onSort, disabled }) {
  const isActive = sort === header.sortKey;
  const ariaSort = isActive
    ? (sortDir === REPORT_SORT_DIRS.ASC ? 'ascending' : 'descending')
    : 'none';

  return (
    <th
      className={`px-0.5 sm:px-1.5 py-1.5 text-[9px] sm:text-[11px] font-bold uppercase tracking-normal sm:tracking-wide text-gray-700 border-b border-r border-gray-300 align-middle overflow-hidden ${
        header.colClass
      } ${
        idx === 0
          ? 'sticky left-0 z-20 bg-gray-100 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.12)]'
          : 'bg-gray-100'
      }`}
      aria-sort={ariaSort}
    >
      <button
        type="button"
        onClick={() => onSort(header.sortKey)}
        disabled={disabled}
        className={`group w-full min-w-0 flex flex-col sm:flex-row items-start gap-0 sm:gap-0.5 text-left rounded-md -mx-0.5 px-0.5 py-0.5 transition-colors disabled:opacity-50 ${
          isActive ? 'text-teal-800' : 'hover:text-teal-800 hover:bg-teal-50/60'
        }`}
        aria-label={`Sort by ${header.lines.join(' ')}`}
      >
        <div className="leading-tight min-w-0 flex-1">
          {(header.mobileLines || header.lines).map((line, lineIdx) => (
            <div
              key={`m-${header.key}-${lineIdx}`}
              className={header.mobileLines ? 'sm:hidden' : undefined}
            >
              {line}
            </div>
          ))}
          {header.mobileLines
            ? header.lines.map((line, lineIdx) => (
                <div key={`d-${header.key}-${lineIdx}`} className="hidden sm:block">
                  {line}
                </div>
              ))
            : null}
        </div>
        <span
          className={`flex-shrink-0 sm:mt-0.5 transition-opacity ${
            isActive ? 'opacity-100 text-teal-700' : 'opacity-40 group-hover:opacity-80'
          }`}
          aria-hidden="true"
        >
          {isActive && sortDir === REPORT_SORT_DIRS.ASC ? (
            <ArrowUp className="h-2.5 w-2.5 sm:h-3 sm:w-3" strokeWidth={2.5} />
          ) : isActive && sortDir === REPORT_SORT_DIRS.DESC ? (
            <ArrowDown className="h-2.5 w-2.5 sm:h-3 sm:w-3" strokeWidth={2.5} />
          ) : (
            <ArrowUpDown className="h-2.5 w-2.5 sm:h-3 sm:w-3" strokeWidth={2} />
          )}
        </span>
      </button>
    </th>
  );
}
function SingleDayPicker({ selectedDate, onSelect, onClose }) {
  const [currentMonth, setCurrentMonth] = useState(selectedDate || new Date());

  const daysInMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const getFirstDay = (date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();

  const isFuture = (day) => {
    const d = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    return d > today;
  };

  const isSelected = (day) => {
    if (!selectedDate) return false;
    const d = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    return d.toDateString() === selectedDate.toDateString();
  };

  const blanks = Array(getFirstDay(currentMonth)).fill(null);
  const days = Array.from({ length: daysInMonth(currentMonth) }, (_, i) => i + 1);

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-200 p-4 z-[60] max-w-sm mx-auto"
    >
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={() =>
            setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))
          }
          className="p-2 hover:bg-gray-100 rounded-lg"
          aria-label="Previous month"
        >
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h3 className="font-semibold text-gray-800 text-sm">
          {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </h3>
        <button
          type="button"
          onClick={() =>
            setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))
          }
          className="p-2 hover:bg-gray-100 rounded-lg"
          aria-label="Next month"
        >
          <ChevronRight className="w-5 h-5 text-gray-600" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
          <div key={d} className="text-center text-xs font-medium text-gray-500 py-1">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {blanks.map((_, i) => (
          <div key={`b${i}`} className="aspect-square" />
        ))}
        {days.map((day) => (
          <button
            key={day}
            type="button"
            onClick={() => {
              if (isFuture(day)) return;
              onSelect(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day));
            }}
            disabled={isFuture(day)}
            className={`aspect-square flex items-center justify-center text-sm rounded-lg transition-all ${
              isFuture(day)
                ? 'text-gray-300 cursor-not-allowed'
                : isSelected(day)
                  ? 'bg-teal-700 text-white font-bold shadow-sm'
                  : 'hover:bg-teal-50 text-gray-700'
            }`}
          >
            {day}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onClose}
        className="mt-3 w-full text-xs text-gray-500 hover:text-gray-700 py-1"
      >
        Close
      </button>
    </motion.div>
  );
}

function TableBodySkeleton({ rows = 8 }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={`sk-${i}`} className="animate-pulse">
          <td className={`sticky left-0 z-[5] px-1.5 sm:px-2 py-1.5 border-b border-r border-gray-200 bg-gray-50 overflow-hidden ${TABLE_HEADERS[0].colClass}`}>
            <div className="h-4 w-20 bg-gray-200 rounded" />
          </td>
          {TABLE_HEADERS.slice(1).map((header) => (
            <td
              key={header.key}
              className={`px-1.5 sm:px-2 py-1.5 border-b border-r border-gray-200 overflow-hidden ${header.colClass}`}
            >
              <div className="h-4 w-12 bg-gray-100 rounded" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function WeightChangeCell({ todayWeight, previousWeight, difference }) {
  const change = computeWeightChange(todayWeight, previousWeight, difference);

  if (change.direction === 'none' || change.direction === 'same') {
    return (
      <div className="text-[11px] font-medium text-gray-400 leading-none">—</div>
    );
  }

  const isDown = change.direction === 'down';
  return (
    <div
      className={`text-[10px] sm:text-[11px] font-semibold leading-tight max-w-full overflow-hidden ${
        isDown ? 'text-green-600' : 'text-red-600'
      }`}
      title={change.comparisonLabel}
    >
      <span className="block">{isDown ? '⬇' : '⬆'}</span>
      <span className="block truncate">{change.changeLabel}</span>
    </div>
  );
}

function MemberNameCell({ name }) {
  const { line1, line2 } = formatReportNameLines(name);
  const fullName = [line1, line2].filter(Boolean).join(' ');
  return (
    <div
      className="text-[11px] sm:text-sm font-semibold text-gray-900 leading-tight min-w-0 max-w-full"
      title={fullName}
    >
      <div className="truncate">{line1}</div>
      {line2 ? <div className="truncate">{line2}</div> : null}
    </div>
  );
}

function buildPageNumbers(currentPage, totalPages) {
  if (totalPages <= 0) return [];
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const pages = new Set([1, totalPages, currentPage]);
  for (let p = currentPage - 1; p <= currentPage + 1; p += 1) {
    if (p >= 1 && p <= totalPages) pages.add(p);
  }
  const sorted = [...pages].sort((a, b) => a - b);
  const withGaps = [];
  for (let i = 0; i < sorted.length; i += 1) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) withGaps.push('…');
    withGaps.push(sorted[i]);
  }
  return withGaps;
}

export default function WellnessScoreReport({
  user,
  tabVisitKey = 0,
  hidePageTitle = false,
  embeddedStickyClass = 'sticky top-[6.5rem] z-20',
}) {
  const coachId = user?.id ?? user?.UserId ?? getDbUserId() ?? null;
  const {
    rows,
    teamScope,
    setTeamScope,
    searchQuery,
    setSearchQuery,
    teamScopeCounts,
    pagination,
    scoreDate,
    selectedDate,
    datePreset,
    customDate,
    selectToday,
    selectYesterday,
    selectCustomDate,
    sort,
    sortDir,
    setSortColumn,
    loading,
    refreshing,
    error,
    refresh,
    goToPage,
    goNext,
    goPrevious,
  } = useWellnessScoreReport({ coachId, tabVisitKey });

  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const showToast = useCallback((message) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 3200);
  }, []);

  const runExport = useCallback(
    async () => {
      if (!coachId || exporting) return;
      setExporting(true);
      try {
        const data = await fetchWellnessScoreReport(coachId, {
          teamFilter: teamScope,
          search: searchQuery.trim(),
          sort,
          sortDir,
          date: selectedDate,
          exportAll: true,
          bustCache: true,
        });
        const members = Array.isArray(data?.members) ? data.members : [];
        if (members.length === 0) {
          showToast('No records to export');
          return;
        }

        const exportDate = data?.scoreDate
          ? new Date(`${data.scoreDate}T12:00:00`)
          : new Date();
        const fileName = buildWellnessScoreReportFileName(exportDate);
        const buffer = await buildWellnessScoreWorkbookBuffer(members);

        await shareWellnessScoreExcel(buffer, fileName);
        showToast('Report ready to share');
      } catch (err) {
        console.error('Wellness Score Report export failed:', err);
        showToast(err?.message || 'Export failed. Please try again.');
      } finally {
        setExporting(false);
      }
    },
    [coachId, exporting, teamScope, searchQuery, selectedDate, sort, sortDir, showToast],
  );

  const handleShare = useCallback(() => {
    startTransition(() => {
      void runExport();
    });
  }, [runExport]);

  const filtersBusy = loading && rows.length === 0;
  const pageBusy = loading && rows.length === 0;
  const isRefreshing = refreshing || (loading && rows.length > 0);
  const totalRecords = pagination.totalRecords || 0;
  const page = pagination.page || 1;
  const limit = pagination.limit || 10;
  const showingFrom = totalRecords === 0 ? 0 : (page - 1) * limit + 1;
  const showingTo = Math.min(page * limit, totalRecords);
  const pageNumbers = buildPageNumbers(page, pagination.totalPages || 0);
  const customLabel = datePreset === DATE_PRESETS.CUSTOM && scoreDate
    ? formatReportDateLabel(scoreDate)
    : 'Custom Date';

  return (
    <div className="min-h-full bg-gray-50 flex flex-col">
      <div className={`${hidePageTitle ? embeddedStickyClass : 'sticky top-0 z-20'} bg-white border-b border-gray-200`}>
        <div className="max-w-6xl mx-auto w-full px-3 sm:px-4 py-2.5 relative">
          {!hidePageTitle && (
            <h1 className="text-base sm:text-lg font-bold text-gray-900 leading-tight truncate mb-2">
              Wellness Score Report
            </h1>
          )}
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <div
              className="flex-1 min-w-0 flex items-center gap-1 sm:gap-1.5 overflow-x-auto scrollbar-hide"
              role="group"
              aria-label="Date filter"
            >
              <TouchFeedbackButton
                onClick={() => {
                  selectToday();
                  setShowDatePicker(false);
                }}
                disabled={pageBusy && datePreset === DATE_PRESETS.TODAY}
                className={`flex-shrink-0 whitespace-nowrap px-2.5 sm:px-3.5 py-1.5 rounded-full text-[11px] sm:text-xs font-medium transition-all border ${
                  datePreset === DATE_PRESETS.TODAY
                    ? 'bg-teal-700 text-white border-teal-700 shadow-sm'
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                }`}
                ariaLabel="Today"
              >
                Today
              </TouchFeedbackButton>
              <TouchFeedbackButton
                onClick={() => {
                  selectYesterday();
                  setShowDatePicker(false);
                }}
                className={`flex-shrink-0 whitespace-nowrap px-2.5 sm:px-3.5 py-1.5 rounded-full text-[11px] sm:text-xs font-medium transition-all border ${
                  datePreset === DATE_PRESETS.YESTERDAY
                    ? 'bg-teal-700 text-white border-teal-700 shadow-sm'
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                }`}
                ariaLabel="Yesterday"
              >
                Yesterday
              </TouchFeedbackButton>
              <TouchFeedbackButton
                onClick={() => setShowDatePicker((v) => !v)}
                className={`flex-shrink-0 whitespace-nowrap px-2.5 sm:px-3.5 py-1.5 rounded-full text-[11px] sm:text-xs font-medium transition-all border inline-flex items-center gap-1 sm:gap-1.5 ${
                  datePreset === DATE_PRESETS.CUSTOM
                    ? 'bg-teal-700 text-white border-teal-700 shadow-sm'
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                }`}
                ariaLabel="Custom Date"
              >
                <CalendarIcon className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate max-w-[5.5rem] sm:max-w-none">{customLabel}</span>
              </TouchFeedbackButton>
            </div>

            <TouchFeedbackButton
              onClick={handleShare}
              disabled={exporting || filtersBusy}
              className="flex-shrink-0 inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold bg-teal-50 text-teal-800 border border-teal-200 disabled:opacity-40"
              ariaLabel="Share Excel"
            >
              <Share2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Share</span>
            </TouchFeedbackButton>
            <TouchFeedbackButton
              onClick={refresh}
              disabled={loading && rows.length === 0}
              className="flex-shrink-0 p-1.5 sm:p-2 rounded-xl hover:bg-gray-100 transition-colors disabled:opacity-40"
              ariaLabel="Refresh"
            >
              <RefreshCw className={`h-4 w-4 text-gray-600 ${isRefreshing ? 'animate-spin' : ''}`} />
            </TouchFeedbackButton>
          </div>

          <AnimatePresence>
            {showDatePicker && (
              <SingleDayPicker
                selectedDate={
                  customDate
                  || (scoreDate ? new Date(`${scoreDate}T12:00:00`) : new Date())
                }
                onSelect={(date) => {
                  selectCustomDate(date);
                  setShowDatePicker(false);
                }}
                onClose={() => setShowDatePicker(false)}
              />
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="max-w-6xl mx-auto w-full px-3 sm:px-4 pt-3 pb-4 space-y-3 flex-1 flex flex-col min-h-0">
        <ReportSearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          disabled={filtersBusy}
        />

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
                disabled={filtersBusy}
                aria-pressed={isActive}
                className={`flex-1 min-w-0 py-2 rounded-lg text-[11px] sm:text-xs font-semibold transition-all duration-150 cursor-pointer px-1 sm:px-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                  isActive
                    ? 'bg-teal-700 text-white shadow-sm'
                    : 'text-teal-900 hover:bg-teal-50'
                }`}
              >
                <span className="hidden sm:inline truncate">{desktopLabel}</span>
                <span className="sm:hidden truncate">{mobileLabel}</span>
              </button>
            );
          })}
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div
          className="flex-1 min-h-[50vh] max-h-[calc(100vh-280px)] overflow-x-auto overflow-y-auto overscroll-contain rounded-lg border border-gray-300 bg-white shadow-sm"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          <table className="border-collapse text-left table-fixed w-full">
            <colgroup>
              {TABLE_HEADERS.map((header) => (
                <col key={header.key} className={header.colClass} />
              ))}
            </colgroup>
            <thead className="sticky top-0 z-10">
              <tr className="bg-gray-100">
                {TABLE_HEADERS.map((header, idx) => (
                  <SortableHeaderCell
                    key={header.key}
                    header={header}
                    idx={idx}
                    sort={sort}
                    sortDir={sortDir}
                    onSort={setSortColumn}
                    disabled={filtersBusy}
                  />
                ))}
              </tr>
            </thead>
            <tbody>
              {filtersBusy ? (
                <TableBodySkeleton rows={Math.min(limit, 10)} />
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">
                    No members found for this filter.
                  </td>
                </tr>
              ) : (
                rows.map((row, index) => {
                  const zebra = index % 2 === 0 ? 'bg-white' : 'bg-gray-50';
                  return (
                    <tr key={row.userId} className={`${zebra} hover:bg-teal-50/40`}>
                      <td
                        className={`sticky left-0 z-[5] px-1 sm:px-2 py-1.5 border-b border-r border-gray-200 align-middle overflow-hidden shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)] ${TABLE_HEADERS[0].colClass} ${zebra}`}
                      >
                        <MemberNameCell name={row.name} />
                      </td>
                      <td className={`px-1 sm:px-2 py-1.5 text-[11px] sm:text-sm text-gray-800 border-b border-r border-gray-200 align-middle overflow-hidden ${TABLE_HEADERS[1].colClass}`}>
                        <span className="block truncate tabular-nums">
                          {formatWeightKg(row.todayWeight, { compact: true }) || '—'}
                        </span>
                      </td>
                      <td className={`px-0.5 sm:px-1.5 py-1.5 border-b border-r border-gray-200 align-middle overflow-hidden ${TABLE_HEADERS[2].colClass}`}>
                        <WeightChangeCell
                          todayWeight={row.todayWeight}
                          previousWeight={row.previousWeight}
                          difference={row.difference}
                        />
                      </td>
                      <td className={`px-1 sm:px-2 py-1.5 text-[11px] sm:text-sm font-semibold text-teal-800 border-b border-r border-gray-200 align-middle overflow-hidden tabular-nums ${TABLE_HEADERS[3].colClass}`}>
                        <span className="block truncate">
                          {formatWellnessScore(row.totalEarned ?? row.wellnessScore)}
                        </span>
                      </td>
                      <td className={`px-1 sm:px-2 py-1.5 text-[11px] sm:text-sm text-gray-700 border-b border-gray-200 align-middle overflow-hidden ${TABLE_HEADERS[4].colClass}`}>
                        <span className="block truncate" title={row.sponsor || undefined}>
                          {row.sponsor || '—'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-0.5">
          <p className="text-xs text-gray-500 tabular-nums">
            {totalRecords === 0
              ? 'Showing 0'
              : `Showing ${showingFrom}–${showingTo} of ${totalRecords}`}
          </p>
          <div className="flex items-center gap-1 flex-wrap justify-end">
            <button
              type="button"
              onClick={goPrevious}
              disabled={pageBusy || !pagination.hasPreviousPage}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 bg-white text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Previous
            </button>
            {pageNumbers.map((item, idx) =>
              item === '…' ? (
                <span key={`gap-${idx}`} className="px-1 text-xs text-gray-400">
                  …
                </span>
              ) : (
                <button
                  key={item}
                  type="button"
                  onClick={() => goToPage(item)}
                  disabled={pageBusy}
                  aria-current={item === page ? 'page' : undefined}
                  className={`min-w-[2rem] px-2 py-1.5 rounded-lg text-xs font-semibold border disabled:opacity-40 ${
                    item === page
                      ? 'bg-teal-700 text-white border-teal-700'
                      : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {item}
                </button>
              ),
            )}
            <button
              type="button"
              onClick={goNext}
              disabled={pageBusy || !pagination.hasNextPage}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 bg-white text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {(exporting || toast) && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-gray-900 text-white text-xs font-medium shadow-lg">
          {exporting ? 'Preparing Excel…' : toast}
        </div>
      )}
    </div>
  );
}
