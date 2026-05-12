import React, { useState, useEffect, useMemo, lazy, Suspense, useRef } from 'react';
import { BookOpen, Calendar, RotateCcw, Monitor, Clock, Layers, TrendingUp, Video, CheckCircle2, Flame, Sun, Moon, Sunset, Check } from 'lucide-react';
import { getUserId } from '../../user/services/getUserId';
import { istToLocalDate, formatISTToLocalDate } from '../../../shared/utils/timezoneUtils';
import EducationCardModal from './EducationCardModal';

const UNDO_SECONDS = 10;

// Lazy load card component
const EducationCard = lazy(() => import('./EducationCard'));

/**
 * UndoRow - Inline undo component with countdown
 */
const UndoRow = ({ pid, originalLog, expiresAt, ttlSeconds = UNDO_SECONDS, onRestore, onExpire }) => {
  const [now, setNow] = useState(Date.now());
  const [undoing, setUndoing] = useState(false);

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(iv);
  }, []);

  const { total, delayAtMount } = useMemo(() => {
    const total = Math.max(0, ttlSeconds);
    const startedAt = expiresAt - total * 1000;
    const elapsedAtMount = Math.min(total, Math.max(0, (Date.now() - startedAt) / 1000));
    return { total, delayAtMount: -elapsedAtMount };
  }, [expiresAt, ttlSeconds]);

  useEffect(() => {
    const msLeft = Math.max(0, expiresAt - Date.now());
    const t = setTimeout(() => onExpire(), msLeft);
    return () => clearTimeout(t);
  }, [expiresAt, onExpire]);

  const remainingSecs = Math.ceil(Math.max(0, expiresAt - now) / 1000);

  return (
    <div className="relative bg-white border border-amber-200/70 rounded-xl p-3 flex items-center gap-3 shadow-sm" style={{ height: 84 }}>
      <div className="h-7 w-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
        <BookOpen className="w-4 h-4" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-800 truncate">
          <span className="font-medium">Removed:</span> {originalLog.Topic}
        </p>
        <p className="text-[11px] text-amber-700/80">Undo available for {remainingSecs}s</p>
      </div>

      <button
        disabled={undoing}
        onClick={async () => {
          if (undoing) return;
          setUndoing(true);
          await onRestore(pid, originalLog);
          setUndoing(false);
        }}
        className={`inline-flex items-center gap-1.5 rounded-full border border-amber-300 px-3 py-1.5 text-sm font-medium
          ${undoing ? 'text-amber-500 bg-amber-50 cursor-not-allowed' : 'text-amber-800 hover:bg-amber-100/60 active:scale-95 transition'}`}
      >
        {undoing ? (
          <>
            <span className="inline-block h-4 w-4 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
            Restoringâ€¦
          </>
        ) : (
          <>
            <RotateCcw className="w-4 h-4" />
            Undo
          </>
        )}
      </button>

      <span className="absolute left-0 right-0 bottom-0 h-0.5 bg-amber-200/70 overflow-hidden rounded-b-xl">
        <span
          key={pid}
          className="block h-full bg-amber-600 origin-left will-change-transform"
          style={{
            transformOrigin: 'left',
            animation: `countdown-shrink ${total}s linear ${delayAtMount}s forwards`
          }}
        />
      </span>
    </div>
  );
};

const EducationDashboard = ({ user, apiBaseUrl, hideHeader, refreshKey = 0 }) => {
  const [educationLogs, setEducationLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [undoState, setUndoState] = useState({});
  const [selectedLog, setSelectedLog] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [educationTrendRangeDays, setEducationTrendRangeDays] = useState(7);
  const [activeEducationPanel, setActiveEducationPanel] = useState('summary');
  const [educationPanelHeight, setEducationPanelHeight] = useState(null);
  const [educationTrendChartWidth, setEducationTrendChartWidth] = useState(0);
  const userIdRef = useRef(null);
  const educationSwipeRef = useRef({ active: false, startX: 0, lastX: 0 });
  const educationSummaryRef = useRef(null);
  const educationTrendRef = useRef(null);
  const educationTrendChartRef = useRef(null);

  // PAGINATION: Lazy-load education logs in pages of 10 (mirrors WeightDashboard)
  const EDUCATION_PAGE_SIZE = 10;
  const [hasMoreLogs, setHasMoreLogs] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadMoreSentinelRef = useRef(null);
  const loadingMoreRef = useRef(false);
  const hasMoreRef = useRef(false);
  const offsetRef = useRef(0);

  const toDateKey = (value) => {
    const d = new Date(value);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const isSmallChartDevice = () =>
    typeof window !== 'undefined' && window.innerWidth < 380;

  /**
   * Group education logs by month
   */
  const monthlyGroups = useMemo(() => {
    const grouped = {};
    
    educationLogs.forEach(log => {
      if (!log || !log.CreatedAt) return;
      
      const date = istToLocalDate(log.CreatedAt);
      if (!date || isNaN(date.getTime())) return;
      
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthName = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      
      if (!grouped[monthKey]) {
        grouped[monthKey] = {
          monthKey,
          monthName,
          entries: [],
          sortDate: new Date(date.getFullYear(), date.getMonth(), 1)
        };
      }
      
      grouped[monthKey].entries.push(log);
    });
    
    return Object.values(grouped).sort((a, b) => b.sortDate - a.sortDate);
  }, [educationLogs]);

  /**
   * Get month statistics
   */
  const getMonthStats = (entries) => {
    if (!entries || entries.length === 0) return null;
    
    const platforms = {};
    entries.forEach(log => {
      platforms[log.Platform] = (platforms[log.Platform] || 0) + 1;
    });
    
    const mostUsedPlatform = Object.keys(platforms).reduce((a, b) => 
      platforms[a] > platforms[b] ? a : b, Object.keys(platforms)[0]
    );
    
    return {
      count: entries.length,
      mostUsedPlatform,
      platforms: Object.keys(platforms).length
    };
  };

  const educationTrendSeries = useMemo(() => {
    if (!educationLogs || educationLogs.length === 0) return [];

    const countByDate = new Map();
    educationLogs.forEach((log) => {
      if (!log || !log.CreatedAt || log.isUndoPlaceholder) return;
      const key = toDateKey(log.CreatedAt);
      countByDate.set(key, (countByDate.get(key) || 0) + 1);
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(today);
    start.setDate(today.getDate() - (educationTrendRangeDays - 1));

    const points = [];
    for (let i = 0; i < educationTrendRangeDays; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const key = toDateKey(d);
      points.push({
        key,
        date: d,
        label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        compactLabel: `${d.toLocaleDateString('en-US', { month: 'short' }).slice(0, 1)} ${d.toLocaleDateString('en-US', { day: 'numeric' })}`,
        value: countByDate.get(key) || 0,
      });
    }

    return points;
  }, [educationLogs, educationTrendRangeDays]);

  const handleEducationPanelPointerDown = (e) => {
    if (!e.isPrimary) return;
    educationSwipeRef.current.active = true;
    educationSwipeRef.current.startX = e.clientX;
    educationSwipeRef.current.lastX = e.clientX;
  };

  const handleEducationPanelPointerMove = (e) => {
    if (!educationSwipeRef.current.active || !e.isPrimary) return;
    educationSwipeRef.current.lastX = e.clientX;
  };

  const handleEducationPanelPointerEnd = () => {
    const swipe = educationSwipeRef.current;
    if (!swipe.active) return;
    swipe.active = false;

    const deltaX = swipe.lastX - swipe.startX;
    if (Math.abs(deltaX) < 36) return;

    if (deltaX < 0) {
      setActiveEducationPanel('trend');
    } else {
      setActiveEducationPanel('summary');
    }
  };

  useEffect(() => {
    const updateEducationPanelHeight = () => {
      const activeRef =
        activeEducationPanel === 'summary'
          ? educationSummaryRef
          : educationTrendRef;
      if (activeRef.current) {
        setEducationPanelHeight(activeRef.current.scrollHeight);
      }
    };

    const rafId = requestAnimationFrame(updateEducationPanelHeight);
    window.addEventListener('resize', updateEducationPanelHeight);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', updateEducationPanelHeight);
    };
  }, [
    activeEducationPanel,
    summaryLoading,
    summary,
    educationLogs,
    educationTrendSeries,
    educationTrendRangeDays,
  ]);

  useEffect(() => {
    const container = educationTrendChartRef.current;
    if (!container) return;

    const updateChartWidth = () => {
      const nextWidth = Math.floor(container.clientWidth || 0);
      setEducationTrendChartWidth((prev) => (prev === nextWidth ? prev : nextWidth));
    };

    updateChartWidth();

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(updateChartWidth);
      observer.observe(container);
      return () => observer.disconnect();
    }

    window.addEventListener('resize', updateChartWidth);
    return () => window.removeEventListener('resize', updateChartWidth);
  }, [activeEducationPanel, educationTrendRangeDays, educationTrendSeries.length]);

  /**
   * Fetch education logs and summary on mount, user change, or external refresh trigger
   */
  useEffect(() => {
    // Don't fetch until user is fully loaded
    if (!user?.id) return;
    // Clear cached userId when user changes
    userIdRef.current = null;
    // Reset pagination
    setEducationLogs([]);
    setHasMoreLogs(false);
    offsetRef.current = 0;
    hasMoreRef.current = false;
    fetchEducationLogs({ reset: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.email, refreshKey]);

  /**
   * Fetch summary data independently
   */
  const fetchSummary = async () => {
    try {
      const userId = userIdRef.current || user?.id;
      if (!userId) return;

      const cacheBuster = Date.now();
      const response = await fetch(`${apiBaseUrl}/api/education/summary?userId=${userId}&_t=${cacheBuster}`, {
        method: 'GET',
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        cache: 'no-store'
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setSummary(data.summary);
        }
      }
    } catch (err) {
      console.error('âŒ Fetch summary error:', err);
    }
  };

  /**
   * Fetch education logs page (limit=10). Set reset=true to load first page.
   * Mirrors the WeightDashboard infinite-scroll pattern.
   */
  const fetchEducationLogs = async ({ reset = false } = {}) => {
    try {
      if (reset) {
        setLoading(true);
      } else {
        if (loadingMoreRef.current || !hasMoreRef.current) return;
        loadingMoreRef.current = true;
        setLoadingMore(true);
      }
      setError(null);

      if (!userIdRef.current) {
        userIdRef.current = user?.id || await getUserId(user);
      }
      const userId = userIdRef.current;

      if (!userId) {
        throw new Error('User not authenticated');
      }

      const currentOffset = reset ? 0 : offsetRef.current;
      const cacheBuster = Date.now();

      // Logs page
      const logsParams = new URLSearchParams({
        userId,
        limit: String(EDUCATION_PAGE_SIZE),
        offset: String(currentOffset),
        // Cards lazy-fetch full image via /api/get-education-log-image,
        // so the list payload stays small.
        includeImage: 'false',
        _t: String(cacheBuster),
      });

      // First page also fetches summary in parallel (cheap & needed up-front).
      const requests = [
        fetch(`${apiBaseUrl}/api/education/logs?${logsParams}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
          },
          cache: 'no-store',
        }),
      ];
      if (reset) {
        requests.push(
          fetch(`${apiBaseUrl}/api/education/summary?userId=${userId}&_t=${cacheBuster}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache',
            },
            cache: 'no-store',
          })
        );
      }

      const [logsResponse, summaryResponse] = await Promise.all(requests);
      const logsData = await logsResponse.json();

      if (!logsResponse.ok || !logsData.success) {
        throw new Error(logsData.message || 'Failed to fetch education logs');
      }

      const newRows = Array.isArray(logsData.logs) ? logsData.logs : [];

      if (reset) {
        setEducationLogs(newRows);
      } else {
        setEducationLogs(prev => {
          // Avoid duplicates if a refresh races with infinite scroll
          const seen = new Set(prev.map(e => e?.Id));
          const merged = prev.slice();
          for (const r of newRows) {
            if (!seen.has(r.Id)) merged.push(r);
          }
          return merged;
        });
      }

      const nextOffset = currentOffset + newRows.length;
      const more = logsData.pagination
        ? !!logsData.pagination.hasMore
        : newRows.length === EDUCATION_PAGE_SIZE;
      offsetRef.current = nextOffset;
      hasMoreRef.current = more;
      setHasMoreLogs(more);

      // Summary (only fetched on reset)
      if (summaryResponse) {
        if (summaryResponse.ok) {
          const summaryData = await summaryResponse.json();
          if (summaryData.success) {
            setSummary(summaryData.summary);
          }
        } else {
          console.warn('Summary fetch failed, will use loaded logs for stats');
        }
        setSummaryLoading(false);
      }

    } catch (err) {
      console.error('âŒ Fetch education logs error:', err);
      setError(err.message || 'Failed to load education logs');
      if (reset) setSummaryLoading(false);
    } finally {
      if (reset) {
        setLoading(false);
      } else {
        loadingMoreRef.current = false;
        setLoadingMore(false);
      }
    }
  };

  /**
   * INFINITE SCROLL: observe sentinel and load next page when visible
   */
  useEffect(() => {
    const el = loadMoreSentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry && entry.isIntersecting && hasMoreRef.current && !loadingMoreRef.current) {
          fetchEducationLogs({ reset: false });
        }
      },
      { rootMargin: '300px', threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMoreLogs, loading]);

  /**
   * Handle delete education log with undo support
   */
  const handleDeleteEducationLog = async (logToDelete) => {
    if (!logToDelete || logToDelete.isUndoPlaceholder) return;

    // Create placeholder
    const placeholder = {
      Id: `undo-${logToDelete.Id}`,
      isUndoPlaceholder: true,
      CreatedAt: logToDelete.CreatedAt,
      Platform: logToDelete.Platform,
      Topic: logToDelete.Topic
    };

    // Replace entry in-place with placeholder
    setEducationLogs(prev => {
      const idx = prev.findIndex(e => e.Id === logToDelete.Id);
      if (idx === -1) return prev;
      const next = prev.slice();
      next.splice(idx, 1, placeholder);
      return next;
    });

    // Store undo state
    setUndoState(prev => ({
      ...prev,
      [placeholder.Id]: {
        originalLog: logToDelete,
        expiresAt: Date.now() + UNDO_SECONDS * 1000,
        ttlSeconds: UNDO_SECONDS
      }
    }));

    // Soft-delete in backend
    try {
      const userId = userIdRef.current || user?.id;
      
      const response = await fetch(`${apiBaseUrl}/api/education/logs`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId,
          logId: logToDelete.Id
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to delete education log');
      }

      console.log('âœ… Education log soft-deleted:', logToDelete.Id);
      
      // Refresh summary to reflect the delete
      fetchSummary();

    } catch (err) {
      console.error('âŒ Delete error:', err);
      // Rollback on backend failure
      setEducationLogs(prev => {
        const idx = prev.findIndex(e => e.Id === placeholder.Id);
        if (idx === -1) return prev;
        const next = prev.slice();
        next.splice(idx, 1, logToDelete);
        return next;
      });
      setUndoState(prev => {
        const next = { ...prev };
        delete next[placeholder.Id];
        return next;
      });
      alert(err.message || 'Failed to delete. Please try again.');
    }
  };

  /**
   * Handle undo restore
   */
  const handleUndoRestore = async (pid, originalLog) => {
    // Optimistic restore
    setEducationLogs(prev => {
      const idx = prev.findIndex(e => e.Id === pid);
      if (idx === -1) return prev.concat(originalLog);
      const next = prev.slice();
      next.splice(idx, 1, originalLog);
      return next;
    });
    setUndoState(prev => {
      const next = { ...prev };
      delete next[pid];
      return next;
    });

    // Call backend undo API
    try {
      const userId = userIdRef.current || user?.id;
      
      const response = await fetch(`${apiBaseUrl}/api/education/undo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          id: originalLog.Id,
          userId
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to restore log');
      }

      console.log('âœ… Education log restored:', originalLog.Id);
      
      // Refresh summary to reflect the restore
      fetchSummary();

    } catch (err) {
      console.error('âŒ Undo restore error:', err);
      // Rollback - put placeholder back
      setEducationLogs(prev => {
        const idx = prev.findIndex(e => e.Id === originalLog.Id);
        if (idx === -1) return prev;
        const next = prev.slice();
        next.splice(idx, 1, { 
          Id: pid, 
          isUndoPlaceholder: true, 
          CreatedAt: originalLog.CreatedAt,
          Platform: originalLog.Platform,
          Topic: originalLog.Topic
        });
        return next;
      });
      setUndoState(prev => ({
        ...prev,
        [pid]: {
          originalLog,
          expiresAt: Date.now() + UNDO_SECONDS * 1000,
          ttlSeconds: UNDO_SECONDS
        }
      }));
      alert(err.message || 'Failed to restore. Please try again.');
    }
  };

  /**
   * Handle undo expiration
   */
  const handleUndoExpire = async (pid, originalLog) => {
    setEducationLogs(prev => prev.filter(e => e.Id !== pid));
    setUndoState(prev => {
      const next = { ...prev };
      delete next[pid];
      return next;
    });

    console.log('â±ï¸ Undo timer expired, log remains deleted:', originalLog.Id);
  };

  /**
   * Render loading state
   */
  if (loading) {
    return (
      <div className="w-full md:max-w-2xl lg:max-w-4xl md:mx-auto pb-24 mt-2 animate-pulse overflow-x-hidden">
        <div className="px-4 md:px-6">
          {/* Summary Card Skeleton */}
          <div className="mb-6 mt-2">
            <div className="w-full max-w-md mx-auto bg-white rounded-2xl shadow-sm border border-gray-200/60 p-5">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <div className="h-3 w-24 bg-gray-200 rounded mb-2 animate-pulse"></div>
                  <div className="h-8 w-16 bg-gray-200 rounded animate-pulse"></div>
                </div>
                <div className="h-8 w-24 bg-gray-200 rounded-lg animate-pulse"></div>
              </div>
              <div>
                <div className="flex justify-between items-end mb-2">
                  <div className="h-2 w-20 bg-gray-200 rounded animate-pulse"></div>
                  <div className="h-2 w-16 bg-gray-200 rounded animate-pulse"></div>
                </div>
                <div className="flex justify-between items-center gap-2">
                  {[...Array(7)].map((_, i) => (
                    <div key={i} className="flex flex-col items-center gap-1.5 flex-1">
                      <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse"></div>
                      <div className="h-2 w-4 bg-gray-200 rounded animate-pulse"></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* List Skeletons */}
          <div className="space-y-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="mb-6">
                <div className="flex items-center gap-2 mb-5">
                  <div className="w-4 h-4 bg-gray-200 rounded animate-pulse"></div>
                  <div className="h-4 w-32 bg-gray-200 rounded animate-pulse"></div>
                </div>
                <div className="space-y-3">
                  {[...Array(2)].map((_, j) => (
                    <div key={j} className="bg-white rounded-xl p-2.5 xs:p-3 sm:p-4" style={{ minHeight: 72 }}>
                      <div className="flex items-center gap-2 xs:gap-3 sm:gap-4">
                        <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gray-200 rounded-lg animate-pulse"></div>
                        <div className="flex-1 space-y-2">
                          <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse"></div>
                          <div className="h-3 bg-gray-200 rounded w-1/2 animate-pulse"></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /**
   * Render empty state
   */
  if (!educationLogs || educationLogs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4">
        <div className="bg-white rounded-2xl p-8 shadow-lg text-center max-w-md">
          <div className="w-20 h-20 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <BookOpen className="w-10 h-10 text-purple-600" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">No Education Logs Yet</h3>
          <p className="text-gray-600 mb-4">
            Upload meeting screenshots to automatically track your education sessions
          </p>
        </div>
      </div>
    );
  }

  /**
   * Render dashboard
   */
  return (
    <>
      {/* CSS keyframes for countdown animation */}
      <style>{`
        @keyframes countdown-shrink { from { transform: scaleX(1); } to { transform: scaleX(0); } }
        @keyframes slideInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
      
    <div className="w-full md:max-w-2xl lg:max-w-4xl md:mx-auto pb-24 mt-2 overflow-x-hidden">
      <div className="px-3 md:px-4">
        <div className="mt-3 md:mt-5 mb-4">
          <div
            className="w-full max-w-md mx-auto bg-white/70 backdrop-blur-xl rounded-2xl border border-gray-200/60 shadow-sm overflow-hidden"
            onPointerDown={handleEducationPanelPointerDown}
            onPointerMove={handleEducationPanelPointerMove}
            onPointerUp={handleEducationPanelPointerEnd}
            onPointerCancel={handleEducationPanelPointerEnd}
            onPointerLeave={handleEducationPanelPointerEnd}
          >
            <div className="px-4 md:px-5 pt-4 md:pt-5 pb-2 flex items-center justify-between">
              <div className="text-xs md:text-sm text-gray-500">
                {activeEducationPanel === 'summary'
                  ? 'Education Summary'
                  : `Education Trend (${educationTrendRangeDays}D)`}
              </div>
              <div className="flex items-center gap-1 bg-gray-100 rounded-full p-0.5">
                <button
                  type="button"
                  onClick={() => setActiveEducationPanel('summary')}
                  className={`px-2 py-0.5 text-[10px] rounded-full transition-all duration-300 ${
                    activeEducationPanel === 'summary'
                      ? 'bg-emerald-500 text-white shadow-sm'
                      : 'text-gray-600 hover:bg-white'
                  }`}
                >
                  Summary
                </button>
                <button
                  type="button"
                  onClick={() => setActiveEducationPanel('trend')}
                  className={`px-2 py-0.5 text-[10px] rounded-full transition-all duration-300 ${
                    activeEducationPanel === 'trend'
                      ? 'bg-emerald-500 text-white shadow-sm'
                      : 'text-gray-600 hover:bg-white'
                  }`}
                >
                  Trend
                </button>
              </div>
            </div>

            <div
              className="overflow-hidden transition-[height] duration-400 ease-out"
              style={educationPanelHeight ? { height: `${educationPanelHeight}px` } : undefined}
            >
              <div
                className="flex items-start w-[200%] transition-transform duration-500 ease-out"
                style={{
                  transform:
                    activeEducationPanel === 'summary'
                      ? 'translateX(0%)'
                      : 'translateX(-50%)',
                }}
              >
                <div ref={educationSummaryRef} className="w-1/2 shrink-0 px-4 md:px-5 pb-4 md:pb-5">
                  {/* Top Row: Streak & Persona */}
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Current Streak</p>
                      <div className="flex items-center gap-2">
                        <h3 className="text-3xl font-bold text-gray-900 tracking-tight">
                          {summaryLoading ? (
                            <div className="w-12 h-9 bg-gray-200 rounded animate-pulse"></div>
                          ) : (
                            summary?.currentStreak || 0
                          )}
                        </h3>
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-50 text-orange-500">
                          <Flame className="w-5 h-5 fill-orange-500" />
                        </div>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">days in a row</p>
                    </div>

                    {/* Persona Tag */}
                    {educationLogs.length > 0 && (() => {
                      const timeSlots = { morning: 0, afternoon: 0, evening: 0, night: 0 };
                      educationLogs.forEach(log => {
                        const hour = istToLocalDate(log.CreatedAt).getHours();
                        if (hour >= 5 && hour < 12) timeSlots.morning++;
                        else if (hour >= 12 && hour < 17) timeSlots.afternoon++;
                        else if (hour >= 17 && hour < 22) timeSlots.evening++;
                        else timeSlots.night++;
                      });

                      const maxSlot = Object.keys(timeSlots).reduce((a, b) => timeSlots[a] > timeSlots[b] ? a : b);
                      let icon = <Sun className="w-3.5 h-3.5" />;
                      let text = 'Learner';
                      let style = 'bg-gray-100 text-gray-600';

                      if (maxSlot === 'morning') {
                        icon = <Sun className="w-3.5 h-3.5" />;
                        text = 'Morning Learner';
                        style = 'bg-orange-50 text-orange-700 border-orange-100';
                      } else if (maxSlot === 'afternoon') {
                        icon = <Sun className="w-3.5 h-3.5" />;
                        text = 'Daytime Achiever';
                        style = 'bg-yellow-50 text-yellow-700 border-yellow-100';
                      } else if (maxSlot === 'evening') {
                        icon = <Sunset className="w-3.5 h-3.5" />;
                        text = 'Evening Scholar';
                        style = 'bg-purple-50 text-purple-700 border-purple-100';
                      } else {
                        icon = <Moon className="w-3.5 h-3.5" />;
                        text = 'Night Owl';
                        style = 'bg-indigo-50 text-indigo-700 border-indigo-100';
                      }

                      return (
                        <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border ${style}`}>
                          {icon}
                          <span className="text-xs font-semibold">{text}</span>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Bottom Row: Week Activity */}
                  <div>
                    <div className="flex justify-between items-end mb-2">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Week</p>
                      <p className="text-[10px] font-medium text-gray-400">
                        {summaryLoading ? (
                          <span className="inline-block w-12 h-3 bg-gray-200 rounded animate-pulse"></span>
                        ) : (
                          `${summary?.last7DaysCount || 0} sessions`
                        )}
                      </p>
                    </div>

                    <div className="flex justify-between items-center gap-2">
                      {(() => {
                        const days = [];
                        const today = new Date();
                        const activeDates = summary?.last7DaysDates
                          ? summary.last7DaysDates.map(d => new Date(d).toDateString())
                          : educationLogs.map(log => istToLocalDate(log.CreatedAt).toDateString());

                        for (let i = 6; i >= 0; i--) {
                          const d = new Date(today);
                          d.setDate(d.getDate() - i);
                          const dateStr = d.toDateString();
                          const hasLog = activeDates.includes(dateStr);
                          const isToday = i === 0;

                          days.push(
                            <div key={i} className="flex flex-col items-center gap-1.5 flex-1">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-500 ${
                                hasLog
                                  ? 'bg-gradient-to-tr from-green-500 to-emerald-400 shadow-lg shadow-green-500/40 ring-2 ring-green-100 scale-105'
                                  : 'bg-gray-100/80'
                              }`}>
                                {hasLog && <Check className="w-4 h-4 text-white drop-shadow-md" strokeWidth={3} />}
                              </div>
                              <span className={`text-[10px] font-medium ${
                                hasLog
                                  ? 'text-emerald-600 font-bold'
                                  : (isToday ? 'text-gray-500' : 'text-gray-400')
                              }`}>
                                {d.toLocaleDateString('en-US', { weekday: 'narrow' })}
                              </span>
                            </div>,
                          );
                        }
                        return days;
                      })()}
                    </div>
                  </div>
                </div>

                <div ref={educationTrendRef} className="w-1/2 shrink-0 px-4 md:px-5 pb-4 md:pb-5">
                  {(() => {
                    const totalSessions = educationTrendSeries.reduce(
                      (sum, point) => sum + (point.value || 0),
                      0,
                    );
                    const avgPerDay = totalSessions / Math.max(educationTrendSeries.length, 1);
                    const bestDay = educationTrendSeries.reduce(
                      (best, point) => {
                        if (!best || (point.value || 0) > (best.value || 0)) return point;
                        return best;
                      },
                      null,
                    );
                    const activeDays = educationTrendSeries.filter((point) => (point.value || 0) > 0).length;

                    return (
                      <>
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="text-xs md:text-sm text-gray-500">Education Trend</p>
                            <p className="text-sm md:text-base font-semibold text-gray-900">Last {educationTrendRangeDays} days</p>
                          </div>
                          <div className="flex items-center gap-1 bg-gray-100 rounded-full p-1">
                            {[7, 14, 30].map((days) => (
                              <button
                                key={days}
                                type="button"
                                onClick={() => setEducationTrendRangeDays(days)}
                                className={`px-2.5 py-1 text-[11px] md:text-xs rounded-full transition-all duration-300 ${
                                  educationTrendRangeDays === days
                                    ? 'bg-emerald-500 text-white shadow-sm'
                                    : 'text-gray-600 hover:bg-white'
                                }`}
                              >
                                {days}D
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
                          <div className="rounded-lg bg-amber-50 px-2 py-1.5">
                            <p className="text-[10px] text-amber-700">Total Sessions</p>
                            <p className="text-xs md:text-sm font-semibold text-amber-900">{totalSessions}/{educationTrendSeries.length || educationTrendRangeDays}</p>
                          </div>
                          {/* <div className="rounded-lg bg-sky-50 px-2 py-1.5">
                            <p className="text-[10px] text-sky-700">Best Day</p>
                            <p className="text-xs sm:text-sm font-semibold text-sky-900">
                              {bestDay ? `${bestDay.label} (${bestDay.value})` : '-'}
                            </p>
                          </div>
                          <div className="rounded-lg bg-emerald-50 px-2 py-1.5">
                            <p className="text-[10px] text-emerald-700">Active Days</p>
                            <p className="text-xs sm:text-sm font-semibold text-emerald-900">
                              {activeDays}/{educationTrendSeries.length || educationTrendRangeDays}
                            </p>
                          </div> */}
                        </div>

                        {educationTrendSeries.length === 0 ? (
                           <div className="h-36 rounded-xl border border-dashed border-gray-200 flex items-center justify-center text-sm text-gray-500">
                            No education trend data
                          </div>
                        ) : (
                          <>
                            {(() => {
                              const chartWidth = Math.max(educationTrendChartWidth, 1);
                              const chartHeight = 120;
                              const maxValue = Math.max(...educationTrendSeries.map((point) => point.value), 1);
                              const plotLeft = 10;
                              const plotRight = 14;
                              const stepX =
                                educationTrendSeries.length > 1
                                  ? (chartWidth - plotLeft - plotRight) / (educationTrendSeries.length - 1)
                                  : 0;

                              const points = educationTrendSeries.map((point, index) => {
                                const x = plotLeft + index * stepX;
                                const y = chartHeight - ((point.value || 0) / maxValue) * chartHeight;
                                return { ...point, x, y };
                              });

                              const markerCountTarget = Math.min(7, points.length);
                              const sampledMarkerIndices = new Set(
                                (() => {
                                  if (markerCountTarget <= 1) return [points.length - 1];
                                  if (points.length <= markerCountTarget) {
                                    return Array.from({ length: points.length }, (_, i) => i);
                                  }

                                  return Array.from(
                                    { length: markerCountTarget },
                                    (_, i) => Math.round((i * (points.length - 1)) / (markerCountTarget - 1))
                                  );
                                })()
                              );
                              const sampledIndices = Array.from(sampledMarkerIndices).sort((a, b) => a - b);
                              const pickEvenlySpaced = (indices, targetCount) => {
                                if (indices.length <= targetCount) return indices;
                                if (targetCount <= 1) return [indices[indices.length - 1]];
                                const picked = [];
                                for (let i = 0; i < targetCount; i++) {
                                  const position = Math.round((i * (indices.length - 1)) / (targetCount - 1));
                                  picked.push(indices[position]);
                                }
                                return Array.from(new Set(picked));
                              };
                              const dateLabelIndices = new Set(sampledIndices);

                              const displayValueByIndex = new Map(
                                sampledIndices.map((sampledIndex) => {
                                  return [sampledIndex, points[sampledIndex].value || 0];
                                })
                              );

                              const shouldRenderMarker = (_point, index) => sampledMarkerIndices.has(index);
                              const firstVisibleIndex = points.findIndex((point, index) => shouldRenderMarker(point, index));
                              const lastVisibleIndex = (() => {
                                for (let i = points.length - 1; i >= 0; i--) {
                                  if (shouldRenderMarker(points[i], i)) return i;
                                }
                                return -1;
                              })();
                              const firstDateLabelIndex = sampledIndices.find((index) => dateLabelIndices.has(index)) ?? -1;
                              const lastDateLabelIndex =
                                [...sampledIndices].reverse().find((index) => dateLabelIndices.has(index)) ?? -1;

                              const linePoints = sampledIndices.map((index) => points[index]);
                              const linePath = linePoints
                                .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x},${point.y}`)
                                .join(' ');
                              const areaPath = `${linePath} L ${chartWidth},${chartHeight} L 0,${chartHeight} Z`;

                              return (
                                <div ref={educationTrendChartRef} className="w-full overflow-hidden">
                                  <svg
                                    viewBox={`0 -14 ${chartWidth} ${chartHeight + 38}`}
                                    className="block"
                                    style={{
                                      width: '100%',
                                      height: `${chartHeight + 38}px`,
                                      overflow: 'visible'
                                    }}
                                    preserveAspectRatio="none"
                                  >
                                    <defs>
                                      <linearGradient id="educationTrendArea" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.24" />
                                        <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.03" />
                                      </linearGradient>
                                    </defs>

                                    <path d={areaPath} fill="url(#educationTrendArea)" />
                                    <path
                                      d={linePath}
                                      fill="none"
                                      stroke="#f59e0b"
                                      strokeWidth="2.5"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    />
                                    {points.map((point, index) => {
                                      if (!shouldRenderMarker(point, index)) return null;
                                      return (
                                        <circle
                                          key={point.key}
                                          cx={point.x}
                                          cy={point.y}
                                          r={isSmallChartDevice() ? 2.5 : 3}
                                          fill="#f59e0b"
                                        />
                                      );
                                    })}
                                    {points.map((point, index) => {
                                      if (!shouldRenderMarker(point, index)) return null;
                                      const isFirst = index === firstVisibleIndex;
                                      const isLast = index === lastVisibleIndex;
                                      const textAnchor = isFirst ? 'start' : isLast ? 'end' : 'middle';
                                      const labelX = isFirst ? point.x + 4 : isLast ? point.x - 4 : point.x;
                                      const displayValue = displayValueByIndex.get(index) ?? 0;
                                      return (
                                        <text
                                          key={`${point.key}-value`}
                                          x={labelX}
                                          y={Math.max(point.y - (isSmallChartDevice() ? 5 : 6), -10)}
                                          textAnchor={textAnchor}
                                          fontSize={isSmallChartDevice() ? 7 : 8}
                                          fontWeight="500"
                                          fill="#9ca3af"
                                        >
                                          {displayValue}
                                        </text>
                                      );
                                    })}
                                  </svg>

                                  <div
                                    className={`relative mt-2 h-4 text-gray-500 ${isSmallChartDevice() ? 'text-[8px]' : 'text-[10px] md:text-xs'}`}
                                    style={{
                                      width: '100%'
                                    }}
                                  >
                                    {points.map((point, index) => {
                                      if (!dateLabelIndices.has(index)) return null;
                                      const isFirst = index === firstDateLabelIndex;
                                      const isLast = index === lastDateLabelIndex;

                                      return (
                                        <span
                                          key={`${point.key}-label`}
                                          className="absolute whitespace-nowrap"
                                          style={{
                                            left: `${(point.x / chartWidth) * 100}%`,
                                            transform: isFirst
                                              ? 'translateX(0)'
                                              : isLast
                                                ? 'translateX(-100%)'
                                                : 'translateX(-50%)'
                                          }}
                                        >
                                          {point.label}
                                        </span>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })()}

                            <div className="mt-3 flex items-center justify-between text-xs text-gray-600">
                              {/* <span>Total: {totalSessions} sessions</span> */}
                              {/* <span>Avg/day: {avgPerDay.toFixed(1)}</span> */}
                            </div>

                            {/* <div className="mt-2 flex items-center gap-3 text-[11px] text-gray-500">
                              <span className="inline-flex items-center gap-1">
                                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
                                day with sessions
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <span className="inline-block w-2 h-2 rounded-full bg-amber-500" />
                                no sessions
                              </span>
                            </div> */}
                          </>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>

            <div className="pb-3 md:pb-4 flex items-center justify-center gap-2">
              <button
                type="button"
                aria-label="Go to education summary slide"
                onClick={() => setActiveEducationPanel('summary')}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  activeEducationPanel === 'summary' ? 'w-6 bg-emerald-500' : 'w-2.5 bg-gray-300'
                }`}
              />
              <button
                type="button"
                aria-label="Go to education trend slide"
                onClick={() => setActiveEducationPanel('trend')}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  activeEducationPanel === 'trend' ? 'w-6 bg-emerald-500' : 'w-2.5 bg-gray-300'
                }`}
              />
            </div>
          </div>
        </div>

        {/* New user message - only show when no entries */}
        {monthlyGroups.length === 0 && (
          <div className="text-center py-12 px-6 bg-white/60 backdrop-blur-xl rounded-2xl shadow-md border border-gray-100">
            <div className="text-6xl mb-4">ðŸ“š</div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">No Education Sessions</h3>
            <p className="text-gray-500 text-sm max-w-xs mx-auto">
              Upload meeting screenshots to automatically track your education sessions.
            </p>
          </div>
        )}

        {/* Education Entries Grouped by Month */}
        <div className="space-y-6">
          {monthlyGroups.length > 0 && (
            monthlyGroups.map((monthGroup) => {
              const monthStats = getMonthStats(monthGroup.entries);
              
              return (
                <div key={monthGroup.monthKey} className="mb-6">
                  {/* Month and Entries */}
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-600" />
                      <span className="text-sm font-semibold text-gray-600">
                        {monthGroup.monthName}
                      </span>
                    </div>
                  </div>

                  {/* Month Entries */}
                  <div className="space-y-3">
                    {monthGroup.entries
                      .filter(log => log && log.Id && log.CreatedAt)
                      .sort((a, b) => {
                        const dateA = istToLocalDate(a.CreatedAt);
                        const dateB = istToLocalDate(b.CreatedAt);
                        return dateB - dateA;
                      })
                      .map((log, index) => {
                        // Show undo row if this is a placeholder
                        if (log.isUndoPlaceholder) {
                          const undoEntry = undoState[log.Id];
                          if (!undoEntry || !undoEntry.originalLog) return null;
                          return (
                            <UndoRow
                              key={log.Id}
                              pid={log.Id}
                              originalLog={undoEntry.originalLog}
                              expiresAt={undoEntry.expiresAt}
                              ttlSeconds={undoEntry.ttlSeconds ?? UNDO_SECONDS}
                              onRestore={handleUndoRestore}
                              onExpire={() => handleUndoExpire(log.Id, undoEntry.originalLog)}
                            />
                          );
                        }

                        const skeleton = (
                          <div className="bg-white rounded-xl p-2.5 xs:p-3 sm:p-4 animate-pulse" style={{ minHeight: 72 }}>
                            <div className="flex items-center gap-2 xs:gap-3 sm:gap-4">
                              <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gray-200 rounded-lg"></div>
                              <div className="flex-1 space-y-1.5 sm:space-y-2">
                                <div className="h-3 sm:h-4 bg-gray-200 rounded w-3/4"></div>
                                <div className="h-2.5 sm:h-3 bg-gray-200 rounded w-1/2"></div>
                              </div>
                            </div>
                          </div>
                        );

                        return (
                          <Suspense key={log.Id} fallback={skeleton}>
                            <EducationCard
                              data={log}
                              onDelete={handleDeleteEducationLog}
                              onClick={(logData) => setSelectedLog(logData)}
                              index={index}
                              apiBaseUrl={apiBaseUrl}
                              userId={userIdRef.current}
                            />
                          </Suspense>
                        );
                      })}
                  </div>
                </div>
              );
            }))}

          {/* INFINITE SCROLL: sentinel + loading indicator for next page */}
          {(hasMoreLogs || loadingMore) && (
            <div ref={loadMoreSentinelRef} className="flex items-center justify-center py-6">
              {loadingMore ? (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <span className="inline-block h-4 w-4 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />
                  Loading more entries...
                </div>
              ) : (
                <span className="text-xs text-gray-400">Scroll to load more</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>

      {/* Education Card Modal */}
      {selectedLog && (
        <EducationCardModal
          log={selectedLog}
          onClose={() => setSelectedLog(null)}
          onDelete={async (log) => {
            setDeletingId(log.Id);
            setSelectedLog(null);
            await handleDeleteEducationLog(log);
            setDeletingId(null);
          }}
          isDeleting={deletingId === selectedLog?.Id}
          apiBaseUrl={apiBaseUrl}
          userId={userIdRef.current}
        />
      )}
    </>
  );
};

export default EducationDashboard;
