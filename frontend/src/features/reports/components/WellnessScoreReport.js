/**
 * WellnessScoreReport — Excel-style coach dashboard.
 * Sticky header row + sticky NAME column; infinite scroll; Share / Download Excel.
 */
import React, { useEffect, useRef, useState, useCallback, startTransition } from 'react';
import { RefreshCw, Share2, Download, ArrowDown, ArrowUp, Minus } from 'lucide-react';
import { useWellnessScoreReport } from '../hooks/useWellnessScoreReport';
import ReportSearchBar from './ReportSearchBar';
import TouchFeedbackButton from '../../../shared/components/TouchFeedbackButton';
import { TEAM_SCOPES, TEAM_SCOPE_OPTIONS } from '../utils/reportFilters.js';
import {
  computeWeightChange,
  formatWeightKg,
  formatWellnessScore,
} from '../utils/wellnessScoreReportFormat.js';
import {
  buildWellnessScoreReportFileName,
  buildWellnessScoreWorkbookBuffer,
  shareWellnessScoreExcel,
  downloadWellnessScoreExcel,
} from '../utils/wellnessScoreReportExcel.js';
import { fetchWellnessScoreReport } from '../services/wellnessScoreReportApi.js';

function TableSkeleton() {
  return (
    <div className="animate-pulse space-y-0 border border-gray-200 rounded-lg overflow-hidden bg-white">
      <div className="h-10 bg-gray-200" />
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex border-t border-gray-100">
          <div className="w-36 h-11 bg-gray-100 border-r border-gray-100" />
          <div className="flex-1 h-11 bg-gray-50" />
        </div>
      ))}
    </div>
  );
}

function WeightChangeCell({ todayWeight, previousWeight, difference }) {
  const change = computeWeightChange(todayWeight, previousWeight, difference);

  if (change.direction === 'none' || change.direction === 'same') {
    return (
      <span className="inline-flex items-center gap-1 text-sm font-medium text-gray-400">
        <Minus className="h-3.5 w-3.5" aria-hidden />
        <span>—</span>
      </span>
    );
  }

  const isDown = change.direction === 'down';
  return (
    <span
      className={`inline-flex items-center gap-1 text-sm font-semibold ${
        isDown ? 'text-green-600' : 'text-red-600'
      }`}
    >
      {isDown ? (
        <ArrowDown className="h-3.5 w-3.5" aria-hidden />
      ) : (
        <ArrowUp className="h-3.5 w-3.5" aria-hidden />
      )}
      <span>
        {isDown ? '⬇' : '⬆'} {change.changeLabel}
      </span>
    </span>
  );
}

export default function WellnessScoreReport({ user, tabVisitKey = 0 }) {
  const coachId = user?.id ?? null;
  const {
    rows,
    teamScope,
    setTeamScope,
    searchQuery,
    setSearchQuery,
    teamScopeCounts,
    loading,
    loadingMore,
    hasNextPage,
    loadMore,
    error,
    refresh,
  } = useWellnessScoreReport({ coachId, tabVisitKey });

  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState(null);
  const listSentinelRef = useRef(null);
  const scrollContainerRef = useRef(null);

  const showToast = useCallback((message) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 3200);
  }, []);

  useEffect(() => {
    const sentinel = listSentinelRef.current;
    const root = scrollContainerRef.current;
    if (!sentinel) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { root: root || null, rootMargin: '240px', threshold: 0 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore, rows.length]);

  const runExport = useCallback(
    async (mode) => {
      if (!coachId || exporting) return;
      setExporting(true);
      try {
        const data = await fetchWellnessScoreReport(coachId, {
          teamFilter: teamScope,
          search: searchQuery.trim(),
          sort: 'score',
          exportAll: true,
          bustCache: true,
        });
        const members = Array.isArray(data?.members) ? data.members : [];
        if (members.length === 0) {
          showToast('No records to export');
          return;
        }

        const fileName = buildWellnessScoreReportFileName();
        const buffer = await buildWellnessScoreWorkbookBuffer(members);

        if (mode === 'share') {
          await shareWellnessScoreExcel(buffer, fileName);
          showToast('Report ready to share');
        } else {
          await downloadWellnessScoreExcel(buffer, fileName);
          showToast('Excel saved successfully');
        }
      } catch (err) {
        console.error('Wellness Score Report export failed:', err);
        showToast(err?.message || 'Export failed. Please try again.');
      } finally {
        setExporting(false);
      }
    },
    [coachId, exporting, teamScope, searchQuery, showToast],
  );

  const handleShare = useCallback(() => {
    startTransition(() => {
      void runExport('share');
    });
  }, [runExport]);

  const handleDownload = useCallback(() => {
    startTransition(() => {
      void runExport('download');
    });
  }, [runExport]);

  const filtersBusy = loading && rows.length === 0;

  return (
    <div className="min-h-full bg-gray-50 flex flex-col">
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto w-full px-3 sm:px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <h1 className="text-base sm:text-lg font-bold text-gray-900 leading-tight truncate">
                Wellness Score Report
              </h1>
            </div>
            <TouchFeedbackButton
              onClick={handleShare}
              disabled={exporting || filtersBusy}
              className="flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-teal-50 text-teal-800 border border-teal-200 disabled:opacity-40"
              ariaLabel="Share Excel"
            >
              <Share2 className="h-3.5 w-3.5" />
              <span className="hidden xs:inline">Share</span>
            </TouchFeedbackButton>
            <TouchFeedbackButton
              onClick={handleDownload}
              disabled={exporting || filtersBusy}
              className="flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-green-600 text-white disabled:opacity-40"
              ariaLabel="Download Excel"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden xs:inline">Download</span>
            </TouchFeedbackButton>
            <TouchFeedbackButton
              onClick={refresh}
              disabled={loading || exporting}
              className="flex-shrink-0 p-2 rounded-xl hover:bg-gray-100 transition-colors disabled:opacity-40"
              ariaLabel="Refresh"
            >
              <RefreshCw className={`h-4 w-4 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
            </TouchFeedbackButton>
          </div>
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

        {filtersBusy ? (
          <TableSkeleton />
        ) : (
          <div
            ref={scrollContainerRef}
            className="flex-1 min-h-[50vh] max-h-[calc(100vh-220px)] overflow-auto overscroll-contain rounded-lg border border-gray-300 bg-white shadow-sm"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            <table className="border-collapse text-left" style={{ minWidth: '720px', width: '100%' }}>
              <thead className="sticky top-0 z-10">
                <tr className="bg-gray-100">
                  {[
                    'NAME',
                    'TODAY WEIGHT',
                    'TODAY VS PREVIOUS WEIGHT',
                    'WELLNESS SCORE',
                    'SPONSOR',
                    'COACH',
                  ].map((label, idx) => (
                    <th
                      key={label}
                      className={`px-3 py-2.5 text-[10px] sm:text-xs font-bold uppercase tracking-wide text-gray-700 border-b border-r border-gray-300 whitespace-nowrap ${
                        idx === 0
                          ? 'sticky left-0 z-20 bg-gray-100 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.12)]'
                          : 'bg-gray-100'
                      }`}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-500">
                      No members found for this filter.
                    </td>
                  </tr>
                ) : (
                  rows.map((row, index) => {
                    const zebra = index % 2 === 0 ? 'bg-white' : 'bg-gray-50';
                    return (
                      <tr key={row.userId} className={`${zebra} hover:bg-teal-50/40`}>
                        <td
                          className={`sticky left-0 z-[5] px-3 py-2.5 text-sm font-semibold text-gray-900 border-b border-r border-gray-200 whitespace-nowrap shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)] ${zebra}`}
                        >
                          {row.name || '—'}
                        </td>
                        <td className="px-3 py-2.5 text-sm text-gray-800 border-b border-r border-gray-200 whitespace-nowrap">
                          {formatWeightKg(row.todayWeight) || '—'}
                        </td>
                        <td className="px-3 py-2.5 border-b border-r border-gray-200 whitespace-nowrap">
                          <WeightChangeCell
                            todayWeight={row.todayWeight}
                            previousWeight={row.previousWeight}
                            difference={row.difference}
                          />
                        </td>
                        <td className="px-3 py-2.5 text-sm font-semibold text-teal-800 border-b border-r border-gray-200 whitespace-nowrap">
                          {formatWellnessScore(row.percentage ?? row.wellnessScore)}
                        </td>
                        <td className="px-3 py-2.5 text-sm text-gray-700 border-b border-r border-gray-200 whitespace-nowrap">
                          {row.sponsor || '—'}
                        </td>
                        <td className="px-3 py-2.5 text-sm text-gray-700 border-b border-gray-200 whitespace-nowrap">
                          {row.coach || '—'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
            <div ref={listSentinelRef} className="h-8" aria-hidden />
            {loadingMore && (
              <div className="py-3 text-center text-xs text-gray-500">Loading more…</div>
            )}
            {!hasNextPage && rows.length > 0 && (
              <div className="py-3 text-center text-xs text-gray-400">End of report</div>
            )}
          </div>
        )}
      </div>

      {(exporting || toast) && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-gray-900 text-white text-xs font-medium shadow-lg">
          {exporting ? 'Preparing Excel…' : toast}
        </div>
      )}
    </div>
  );
}
