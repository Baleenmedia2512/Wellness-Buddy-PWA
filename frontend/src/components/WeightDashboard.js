// src/components/WeightDashboard.js
import React, { useState, useEffect, useMemo, lazy, Suspense, useRef, useCallback } from 'react';
import { 
  Scale,
  RotateCcw,
  Calendar,
  TrendingUp,
  TrendingDown, 
  Minus 
} from 'lucide-react';
import { getUserId } from '../services/getUserId';
import { istToLocalDate, formatISTToLocalDate } from '../utils/timezoneUtils';
import '../LazyLoadStyles.css';

// ✅ LAZY LOADING: Load heavy components only when needed
const WeightCard = lazy(() => import('./WeightCard'));
const WeightCardModal = lazy(() => import('./WeightCardModal'));

const UNDO_SECONDS = 10; // undo countdown duration

/**
//  * ✅ PERFORMANCE: LazyLoadWrapper - Only render children when visible in viewport
 */
const LazyLoadWrapper = ({ children, fallback, rootMargin = '100px' }) => {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect(); // Once visible, stop observing
        }
      },
      { rootMargin, threshold: 0 }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [rootMargin]);

  return (
    <div ref={ref}>
      {isVisible ? children : fallback}
    </div>
  );
};

/**
 * UndoRow - Inline undo component with countdown
 */
const UndoRow = ({ pid, originalEntry, expiresAt, ttlSeconds = UNDO_SECONDS, onRestore, onExpire }) => {
  const [now, setNow] = useState(Date.now());
  const [undoing, setUndoing] = useState(false);

  // Update countdown text every 250ms
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(iv);
  }, []);

  // Freeze animation config at mount
  const { total, delayAtMount } = useMemo(() => {
    const total = Math.max(0, ttlSeconds);
    const startedAt = expiresAt - total * 1000;
    const elapsedAtMount = Math.min(total, Math.max(0, (Date.now() - startedAt) / 1000));
    return { total, delayAtMount: -elapsedAtMount };
  }, [expiresAt, ttlSeconds]);

  // Expire precisely at expiresAt
  useEffect(() => {
    const msLeft = Math.max(0, expiresAt - Date.now());
    const t = setTimeout(() => {
      onExpire();
    }, msLeft);
    return () => clearTimeout(t);
  }, [expiresAt, onExpire]);

  const remainingSecs = Math.ceil(Math.max(0, expiresAt - now) / 1000);
  // const weightDisplay = originalEntry?.Weight ? `${originalEntry.Weight} kg` : 'Weight';
  const weightDisplay = originalEntry?.Weight ? `${originalEntry.Weight} kg` : 'Weight';

  return (
    <div className="relative bg-white border border-amber-200/70 rounded-xl p-3 flex items-center gap-3 shadow-sm" style={{ height: 84 }}>
      <div className="h-7 w-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor"><circle cx="12" cy="12" r="3" /></svg>
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-800 truncate">
          <span className="font-medium">Removed weight:</span> {weightDisplay}
        </p>
        <p className="text-[11px] text-amber-700/80">Undo available for {remainingSecs}s</p>
      </div>

      <button
        disabled={undoing}
        onClick={async () => {
          if (undoing) return;
          setUndoing(true);
          await onRestore(pid, originalEntry);
          setUndoing(false);
        }}
        className={`inline-flex items-center gap-1.5 rounded-full border border-amber-300 px-3 py-1.5 text-sm font-medium
          ${undoing ? 'text-amber-500 bg-amber-50 cursor-not-allowed' : 'text-amber-800 hover:bg-amber-100/60 active:scale-95 transition'}`}
      >
        {undoing ? (
          <>
            <span className="inline-block h-4 w-4 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
            Restoring…
          </>
        ) : (
          <>
            <RotateCcw className="w-4 h-4" />
            Undo
          </>
        )}
      </button>

      {/* Animated countdown progress bar */}
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

/**
 * Weight Dashboard - Unified component for weight tracking and insights
 * Monthly view with month-wise categorization
 */
const WeightDashboard = ({ user, apiBaseUrl, hideHeader }) => {
  // Weight history states
  const [weightHistory, setWeightHistory] = useState([]);
  const [globalStats, setGlobalStats] = useState(null); // Global min/max from ALL data
  const [loading, setLoading] = useState(true);
  const [_error, setError] = useState(null); // eslint-disable-line no-unused-vars

  // UI state - viewMode fixed to 'overview' since camera was removed
  const [viewMode] = useState('overview');

  // Modal and delete states
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [showModal, setShowModal] = useState(false);
  
  // Undo placeholders: key -> { originalEntry, expiresAt, ttlSeconds }
  const [undoState, setUndoState] = useState({});

  // ✅ CACHE: Store userId to avoid repeated lookups
  const userIdRef = useRef(null);

  /**
   * ✅ MEMOIZED: Group weight entries by month
   * Note: Placeholders are handled separately in the render logic
   */
  const monthlyGroups = useMemo(() => {
    const grouped = {};
    
    // console.log('📊 Processing weightHistory:', weightHistory.length, 'entries');
    
    // Process all entries including placeholders
    weightHistory.forEach(entry => {
      // Skip invalid entries but allow placeholders
      if (!entry || !entry.CreatedAt || !entry.Weight) return;
      
      // Convert IST to user's local time
      const date = istToLocalDate(entry.CreatedAt);
      // Check if date is valid
      if (!date || isNaN(date.getTime())) return;
      
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthName = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      
      if (!grouped[monthKey]) {
        grouped[monthKey] = {
          monthKey, // Store the key for proper sorting
          monthName,
          entries: [],
          // Use first day of month for consistent sorting
          sortDate: new Date(date.getFullYear(), date.getMonth(), 1)
        };
      }
      
      // Include both regular entries and placeholders
      grouped[monthKey].entries.push(entry);
    });
    
    // Sort months in descending order (most recent first) using sortDate
    const result = Object.values(grouped).sort((a, b) => b.sortDate - a.sortDate);
    // console.log('📊 Monthly groups:', result.map(g => ({ month: g.monthName, count: g.entries.length })));
    return result;
  }, [weightHistory]);

  /**
   * ✅ MEMOIZED: Pre-compute previous weight map for O(1) lookup
   */
  const previousWeightMap = useMemo(() => {
    const map = new Map();
    const sorted = weightHistory
      .filter(e => e && !e.isUndoPlaceholder && e.Weight && e.CreatedAt)
      .sort((a, b) => {
        const dateA = istToLocalDate(a.CreatedAt);
        const dateB = istToLocalDate(b.CreatedAt);
        return dateB - dateA;
      });
    
    for (let i = 0; i < sorted.length; i++) {
      const prevEntry = i < sorted.length - 1 ? sorted[i + 1] : null;
      map.set(sorted[i].ID, prevEntry ? prevEntry.Weight : null);
    }
    return map;
  }, [weightHistory]);

  /**
   * Calculate month statistics
   */
  const getMonthStats = (entries) => {
    if (!entries || entries.length === 0) return null;
    
    // Filter out invalid entries
    const validEntries = entries.filter(e => e && e.Weight && !isNaN(parseFloat(e.Weight)));
    if (validEntries.length === 0) return null;
    
    const weights = validEntries.map(e => parseFloat(e.Weight));
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    const avgWeight = (totalWeight / weights.length).toFixed(1);
    const minWeight = Math.min(...weights).toFixed(1);
    const maxWeight = Math.max(...weights).toFixed(1);
    
    // Calculate weight change (first entry vs last entry)
    const firstEntry = validEntries[validEntries.length - 1];
    const lastEntry = validEntries[0];
    const weightChange = (parseFloat(lastEntry.Weight) - parseFloat(firstEntry.Weight)).toFixed(1);
    
    return {
      avgWeight,
      minWeight,
      maxWeight,
      weightChange,
      count: validEntries.length
    };
  };

  /**
   * Fetch ALL weight history on mount
   */
  useEffect(() => {
    fetchWeightHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Fetch ALL weight history (no pagination)
   */
  const fetchWeightHistory = async () => {
    try {
      setLoading(true);
      setError(null);

      // Use cached userId or fetch once
      if (!userIdRef.current) {
        userIdRef.current = user?.id || await getUserId(user);
      }
      const userId = userIdRef.current;
      
      if (!userId) {
        throw new Error('User not authenticated or not found in database');
      }
      
      // Include images so they display in the weight cards
      const params = new URLSearchParams({ 
        userId, 
        includeImage: 'true',
        _t: Date.now() 
      });
      
      const response = await fetch(`${apiBaseUrl}/api/get-weight-history?${params}`, {
        method: 'GET',
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        cache: 'no-store'
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to fetch weight history');
      }

      // Set all weight history data
      // console.log('📊 Weight history loaded:', data.data?.length, 'entries');
      // console.log('📊 Sample entries:', data.data?.slice(0, 3));
      setWeightHistory(data.data || []);
      setGlobalStats(data.stats || null);

    } catch (err) {
      console.error('❌ Fetch weight history error:', err);
      setError(err.message || 'Failed to load weight history');
    } finally {
      setLoading(false);
    }
  };

  // Camera functionality removed - images are processed from main page upload

  /**
   * Handle view weight entry in modal
   */
  const handleViewEntry = (entry) => {
    setSelectedEntry(entry);
    setShowModal(true);
  };

  /**
   * Handle delete with immediate backend soft-delete (like nutrition tab)
   * Allows undo via restore API within timer window
   */
  const handleDeleteEntry = async (entryToDelete) => {
    const placeholder = {
      ID: `undo-${entryToDelete.ID}`,
      isUndoPlaceholder: true,
      CreatedAt: entryToDelete.CreatedAt,
      Weight: entryToDelete.Weight
    };

    // Replace entry in-place with placeholder (no flicker)
    setWeightHistory(prev => {
      const idx = prev.findIndex(e => e.ID === entryToDelete.ID);
      if (idx === -1) return prev;
      const next = prev.slice();
      next.splice(idx, 1, placeholder);
      return next;
    });

    // Store undo state
    setUndoState(prev => ({
      ...prev,
      [placeholder.ID]: {
        originalEntry: entryToDelete,
        expiresAt: Date.now() + UNDO_SECONDS * 1000,
        ttlSeconds: UNDO_SECONDS
      }
    }));

    // Immediately soft-delete in backend (like nutrition tab)
    try {
      const userId = userIdRef.current || user?.id;
      
      const response = await fetch(`${apiBaseUrl}/api/delete-weight-entry`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId,
          entryId: entryToDelete.ID
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to delete entry');
      }

      // console.log('✅ Entry soft-deleted immediately:', entryToDelete.ID);

    } catch (err) {
      console.error('❌ Delete error:', err);
      // Rollback on backend failure
      setWeightHistory(prev => {
        const idx = prev.findIndex(e => e.ID === placeholder.ID);
        if (idx === -1) return prev;
        const next = prev.slice();
        next.splice(idx, 1, entryToDelete);
        return next;
      });
      setUndoState(prev => {
        const next = { ...prev };
        delete next[placeholder.ID];
        return next;
      });
      alert(err.message || 'Failed to delete. Please try again.');
    }
  };

  /**
   * Handle undo restore - called when user clicks Undo button
   */
  const handleUndoRestore = async (pid, originalEntry) => {
    // Optimistic restore - replace placeholder with original entry
    setWeightHistory(prev => {
      const idx = prev.findIndex(e => e.ID === pid);
      if (idx === -1) return prev.concat(originalEntry);
      const next = prev.slice();
      next.splice(idx, 1, originalEntry);
      return next;
    });
    setUndoState(prev => {
      const next = { ...prev };
      delete next[pid];
      return next;
    });

    // Call backend undo API to restore entry
    try {
      const userId = userIdRef.current || user?.id;
      
      const response = await fetch(`${apiBaseUrl}/api/undo-deleted-weight-entry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          id: originalEntry.ID,
          userId
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to restore entry');
      }

      // console.log('✅ Entry restored via API:', originalEntry.ID);

    } catch (err) {
      console.error('❌ Undo restore error:', err);
      // Rollback on backend failure - put placeholder back
      setWeightHistory(prev => {
        const idx = prev.findIndex(e => e.ID === originalEntry.ID);
        if (idx === -1) return prev;
        const next = prev.slice();
        next.splice(idx, 1, { 
          ID: pid, 
          isUndoPlaceholder: true, 
          CreatedAt: originalEntry.CreatedAt,
          Weight: originalEntry.Weight
        });
        return next;
      });
      setUndoState(prev => ({
        ...prev,
        [pid]: {
          originalEntry,
          expiresAt: Date.now() + UNDO_SECONDS * 1000,
          ttlSeconds: UNDO_SECONDS
        }
      }));
      alert(err.message || 'Failed to restore. Please try again.');
    }
  };

  /**
   * Handle undo expiration - called when timer runs out
   * Just remove placeholder (backend already deleted)
   */
  const handleUndoExpire = async (pid, originalEntry) => {
    // Remove placeholder from UI
    setWeightHistory(prev => prev.filter(e => e.ID !== pid));
    setUndoState(prev => {
      const next = { ...prev };
      delete next[pid];
      return next;
    });

    // console.log('⏱️ Undo timer expired, entry remains deleted:', originalEntry.ID);
  };

  // Weight saving removed - entries are added via main page image upload

  /**
   * Render overview mode
   */
  const renderOverview = () => {
    if (loading) {
      return (
        <div className="w-full md:max-w-2xl lg:max-w-4xl md:mx-auto pb-24 mt-2 animate-pulse">
          <div className="px-4 md:px-6">
            {/* Chart Skeleton */}
            <div className="mb-6 mt-2">
              <div className="w-full h-64 bg-white rounded-2xl shadow-sm border border-gray-200/60 p-5 flex items-end justify-between gap-2">
                {[...Array(7)].map((_, i) => (
                  <div key={i} className="w-full bg-gray-200 rounded-t-lg animate-pulse" style={{ height: `${Math.random() * 60 + 20}%` }}></div>
                ))}
              </div>
            </div>

            {/* List Skeletons */}
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="bg-white rounded-xl p-4 flex justify-between items-center shadow-sm border border-gray-100">
                  <div className="space-y-2">
                    <div className="h-4 w-24 bg-gray-200 rounded animate-pulse"></div>
                    <div className="h-3 w-16 bg-gray-200 rounded animate-pulse"></div>
                  </div>
                  <div className="h-8 w-16 bg-gray-200 rounded animate-pulse"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    // Get latest weight entry
    const latestWeight = weightHistory.length > 0 ? weightHistory[0] : null;
    const previousWeight = weightHistory.length > 1 ? weightHistory[1].Weight : null;
    
    // Get current month's entries for statistics
    const currentMonthEntries = monthlyGroups.length > 0 ? monthlyGroups[0].entries : [];
    const currentMonthStats = getMonthStats(currentMonthEntries);

    return (
      <div className="w-full md:max-w-2xl lg:max-w-4xl md:mx-auto pb-24 mt-2">
        <div className="px-4 md:px-6">
          {/* Current Month Header */}
          {/* <div className="mt-5 mb-6"> */}
            {/* <div className="flex items-rigth justify-between"> */}
              {/* <div>
                <h2 className="text-2xl font-bold text-gray-800">{currentMonth}</h2>
                <p className="text-sm text-gray-500 mt-1">Weight tracking history</p>
              </div> */}
              {/* <div className="bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full p-3">
                <Scale className="w-6 h-6 text-white" />
              </div> */}
            {/* </div> */}
          {/* </div> */}

          {/* Latest Weight Card - Always show (with data or empty state) */}
          <div className="mb-6">
            <div className="w-full max-w-md mx-auto 
              bg-gradient-to-br to-white 
              backdrop-blur-xl rounded-2xl 
              border 100 shadow-lg p-4 sm:p-6 text-black">

  {/* Current Weight & Previous Weight - Side by Side */}
  <div className="flex items-start justify-between mb-4 sm:mb-5">
    {/* Current Weight - Left */}
    <div className="flex-1 min-w-0">
      <p className="text-[10px] xs:text-xs sm:text-sm text-gray-500 mb-0.5 sm:mb-1">Current Weight</p>
      <div className="flex items-baseline flex-wrap">
        <span className="text-xl xs:text-2xl sm:text-3xl font-bold text-black">{latestWeight ? latestWeight.Weight : '-'}</span>
        <span className="text-xs xs:text-sm sm:text-base font-normal ml-0.5 sm:ml-1 text-gray-600">kg</span>
      </div>
      <p className="text-[10px] xs:text-xs text-gray-500 mt-0.5 sm:mt-1">
        {latestWeight 
          ? formatISTToLocalDate(latestWeight.CreatedAt, { 
              month: 'short', 
              day: 'numeric', 
              year: 'numeric'
            })
          : new Date().toLocaleDateString('en-US', { 
              month: 'short', 
              day: 'numeric', 
              year: 'numeric'
            })
        }
      </p>
    </div>

    {/* Previous Weight - Right */}
    <div className="flex-1 min-w-0 text-right">
      <p className="text-[10px] xs:text-xs sm:text-sm text-gray-500 mb-0.5 sm:mb-1">Previous Weight</p>
      <div className="flex items-baseline justify-end flex-wrap">
        <span className="text-xl xs:text-2xl sm:text-3xl font-bold text-gray-500">{previousWeight !== null ? previousWeight : '-'}</span>
        <span className="text-xs xs:text-sm sm:text-base font-normal ml-0.5 sm:ml-1 text-gray-600">kg</span>
      </div>
      {latestWeight && previousWeight !== null ? (
        (() => {
          const diff = (parseFloat(latestWeight.Weight) - parseFloat(previousWeight)).toFixed(2);
          const diffNum = parseFloat(diff);
          if (diffNum > 0) {
            return (
              <p className="flex items-center justify-end gap-0.5 text-[10px] xs:text-xs text-red-500 font-medium mt-0.5 sm:mt-1">
                <TrendingUp className="w-3 h-3 xs:w-3.5 xs:h-3.5" />
                +{diff} kg
              </p>
            );
          } else if (diffNum < 0) {
            return (
              <p className="flex items-center justify-end gap-0.5 text-[10px] xs:text-xs text-green-600 font-medium mt-0.5 sm:mt-1">
                <TrendingDown className="w-3 h-3 xs:w-3.5 xs:h-3.5" />
                {diff} kg
              </p>
            );
          } else {
            return (
              <p className="flex items-center justify-end gap-0.5 text-[10px] xs:text-xs text-gray-500 font-medium mt-0.5 sm:mt-1">
                <Minus className="w-3 h-3 xs:w-3.5 xs:h-3.5" />
                0.00 kg
              </p>
            );
          }
        })()
      ) : (
        <p className="flex items-center justify-end gap-0.5 text-[10px] xs:text-xs text-gray-400 font-medium mt-0.5 sm:mt-1">
          <Minus className="w-3 h-3 xs:w-3.5 xs:h-3.5" />
          - kg
        </p>
      )}
    </div>
  </div>

  {/* Stats Grid - Lowest & Highest - Always show (from ALL data via API) */}
  <div className="grid grid-cols-2 gap-2 sm:gap-3 mt-3 sm:mt-4">
    {/* Lowest */}
    <div className="bg-white rounded-lg sm:rounded-xl p-2 sm:p-3 text-center border border-white/40">
      <p className="text-[10px] xs:text-xs text-gray-600 mb-0.5 sm:mb-1">Lowest</p>
      <p className="text-lg xs:text-xl font-bold text-gray-900">
        {globalStats?.minWeight !== null && globalStats?.minWeight !== undefined 
          ? globalStats.minWeight.toFixed(1) 
          : '-'}
      </p>
      <p className="text-[10px] xs:text-xs text-gray-500">kg</p>
      {globalStats?.minWeight !== null && globalStats?.minWeight !== undefined ? (
        <TrendingDown className="w-3 h-3 xs:w-4 xs:h-4 mx-auto mt-0.5 sm:mt-1 text-green-600" />
      ) : (
        <Minus className="w-4 h-3 xs:w-5 xs:h-4 mx-auto mt-0.5 sm:mt-1 text-gray-400" />
      )}
    </div>

    {/* Highest */}
    <div className="bg-white rounded-lg sm:rounded-xl p-2 sm:p-3 text-center border border-white/40">
      <p className="text-[10px] xs:text-xs text-gray-600 mb-0.5 sm:mb-1">Highest</p>
      <p className="text-lg xs:text-xl font-bold text-gray-900">
        {globalStats?.maxWeight !== null && globalStats?.maxWeight !== undefined 
          ? globalStats.maxWeight.toFixed(1) 
          : '-'}
      </p>
      <p className="text-[10px] xs:text-xs text-gray-500">kg</p>
      {globalStats?.maxWeight !== null && globalStats?.maxWeight !== undefined ? (
        <TrendingUp className="w-3 h-3 xs:w-4 xs:h-4 mx-auto mt-0.5 sm:mt-1 text-red-500" />
      ) : (
        <Minus className="w-4 h-3 xs:w-5 xs:h-4 mx-auto mt-0.5 sm:mt-1 text-gray-400" />
      )}
    </div>
  </div>
</div>

          </div>

        {/* New user message - only show when no entries */}
        {monthlyGroups.length === 0 && (
          <div className="text-center py-12 px-6 bg-white/60 backdrop-blur-xl rounded-2xl shadow-md border border-gray-100">
            <div className="text-6xl mb-4">⚖️</div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">No Weight Entries</h3>
            <p className="text-gray-500 text-sm max-w-xs mx-auto">
              Take a photo of your weighing scale to start tracking your weight.
            </p>
          </div>
        )}

        {/* Weight Entries Grouped by Month */}
        <div className="space-y-6">
          {monthlyGroups.length > 0 && (
            monthlyGroups.map((monthGroup) => {
              const monthStats = getMonthStats(monthGroup.entries);
              
              return (
                <div key={monthGroup.monthKey} className="mb-6">
                  {/* Month Header */}
                  {/* <div className="bg-white rounded-xl  p-4 mb-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-bold text-gray-800 flex items-center">
                        <Calendar className="w-5 h-5 mr-2 text-emerald-500" />
                        {monthGroup.monthName}
                      </h3>
                      <span className="text-sm text-gray-500">{monthStats.count} entries</span>
                    </div>
                  </div> */}

{/* Month and Entries */}
  <div className="flex items-center justify-between mb-5">
    <div className="flex items-center gap-2">
      <Calendar className="w-4 h-4 text-gray-600" />
      <span className="text-sm font-semibold text-gray-600">
        {monthGroup.monthName}
      </span>
    </div>
    {/* <span className="text-sm text-gray-600">
      {currentMonthStats.count} {currentMonthStats.count === 1 ? 'entry' : 'entries'}
    </span> */}
  </div>
                  {/* Month Entries */}
                  <div className="space-y-3">
                    {monthGroup.entries
                      .filter(entry => entry && entry.ID && entry.CreatedAt && entry.Weight)
                      .sort((a, b) => {
                        const dateA = istToLocalDate(a.CreatedAt);
                        const dateB = istToLocalDate(b.CreatedAt);
                        return dateB - dateA;
                      })
                      .map((entry, index) => {
                        // Show undo row if this is a placeholder
                        if (entry.isUndoPlaceholder) {
                          const undoEntry = undoState[entry.ID];
                          if (!undoEntry || !undoEntry.originalEntry) return null;
                          return (
                            <UndoRow
                              key={entry.ID}
                              pid={entry.ID}
                              originalEntry={undoEntry.originalEntry}
                              expiresAt={undoEntry.expiresAt}
                              ttlSeconds={undoEntry.ttlSeconds ?? UNDO_SECONDS}
                              onRestore={handleUndoRestore}
                              onExpire={() => handleUndoExpire(entry.ID, undoEntry.originalEntry)}
                            />
                          );
                        }

                        // ✅ OPTIMIZED: Use pre-computed previousWeightMap for O(1) lookup
                        const prevWeight = previousWeightMap.get(entry.ID);
                        
                        // Skeleton placeholder for lazy loading
                        const skeleton = (
                          <div className="bg-white rounded-xl p-2.5 xs:p-3 sm:p-4 animate-pulse" style={{ minHeight: 72 }}>
                            <div className="flex items-center gap-2 xs:gap-3 sm:gap-4">
                              <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gray-200 rounded-lg"></div>
                              <div className="flex-1 space-y-1.5 sm:space-y-2">
                                <div className="h-3 sm:h-4 bg-gray-200 rounded w-3/4"></div>
                                <div className="h-2.5 sm:h-3 bg-gray-200 rounded w-1/2"></div>
                              </div>
                              <div className="h-6 sm:h-8 bg-gray-200 rounded w-12 sm:w-16"></div>
                            </div>
                          </div>
                        );

                        // ✅ PERFORMANCE: First 10 items render immediately, rest lazy load on scroll
                        if (index < 10) {
                          return (
                            <Suspense key={entry.ID} fallback={skeleton}>
                              <WeightCard
                                data={entry}
                                previousWeight={prevWeight}
                                onDelete={handleDeleteEntry}
                                onView={handleViewEntry}
                                index={index}
                              />
                            </Suspense>
                          );
                        }

                        // Lazy load items beyond the first 5
                        return (
                          <LazyLoadWrapper key={entry.ID} fallback={skeleton} rootMargin="200px">
                            <Suspense fallback={skeleton}>
                              <WeightCard
                                data={entry}
                                previousWeight={prevWeight}
                                onDelete={handleDeleteEntry}
                                onView={handleViewEntry}
                                index={index}
                              />
                            </Suspense>
                          </LazyLoadWrapper>
                        );
                      })}
                  </div>
                </div>
              );
            })
          )}
        </div>
        </div>
      </div>
    );
  };

  /**
   * Render capture mode
   */
  // Camera capture view removed - images are processed from main page

  // Main render
  if (!hideHeader) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* CSS keyframes for countdown animation and weight card animations */}
        <style>{`
          @keyframes countdown-shrink { from { transform: scaleX(1); } to { transform: scaleX(0); } }
          @keyframes slideInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        `}</style>

        {viewMode === 'overview' && renderOverview()}
        
        {/* Weight Card Modal */}
        {showModal && selectedEntry && (
          <Suspense fallback={
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-2xl p-6 shadow-xl">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-300 border-t-emerald-600"></div>
              </div>
            </div>
          }>
            <WeightCardModal
              data={selectedEntry}
              onClose={() => {
                setShowModal(false);
                setSelectedEntry(null);
              }}
              onDelete={handleDeleteEntry}
              onEdit={() => {
                // TODO: Implement edit functionality
                // console.log('Edit not implemented yet');
              }}
              previousWeight={(() => {
                const index = weightHistory.findIndex(e => e.ID === selectedEntry.ID);
                const prevEntry = index > 0 && index + 1 < weightHistory.length ? weightHistory[index + 1] : null;
                return prevEntry && prevEntry.Weight ? prevEntry.Weight : null;
              })()}
            />
          </Suspense>
        )}
      </div>
    );
  }

  return (
    <>
      {/* CSS keyframes for animations */}
      <style>{`
        @keyframes countdown-shrink { from { transform: scaleX(1); } to { transform: scaleX(0); } }
        @keyframes slideInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
      
      {viewMode === 'overview' && renderOverview()}
      
      {/* Weight Card Modal */}
      {showModal && selectedEntry && (
        <Suspense fallback={
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 shadow-xl">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-300 border-t-emerald-600"></div>
            </div>
          </div>
        }>
          <WeightCardModal
            data={selectedEntry}
            onClose={() => {
              setShowModal(false);
              setSelectedEntry(null);
            }}
            onDelete={handleDeleteEntry}
            onEdit={() => {
              // TODO: Implement edit functionality
              // console.log('Edit not implemented yet');
            }}
            previousWeight={(() => {
              const index = weightHistory.findIndex(e => e.ID === selectedEntry.ID);
              const prevEntry = index > 0 && index + 1 < weightHistory.length ? weightHistory[index + 1] : null;
              return prevEntry && prevEntry.Weight ? prevEntry.Weight : null;
            })()}
          />
        </Suspense>
      )}
    </>
  );
};

export default WeightDashboard;
