// src/components/WeightDashboard.js
import React, { useState, useEffect, useMemo, lazy, Suspense, useRef } from 'react';
import { 
  Scale,
  RotateCcw,
  Calendar,
  TrendingUp,
  TrendingDown, 
  Minus 
} from 'lucide-react';
import { getUserId } from '../services/getUserId';
import '../LazyLoadStyles.css';

// ✅ LAZY LOADING: Load heavy components only when needed
const WeightCard = lazy(() => import('./WeightCard'));
const WeightCardModal = lazy(() => import('./WeightCardModal'));

const UNDO_SECONDS = 10; // undo countdown duration

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
    
    // Process all entries including placeholders
    weightHistory.forEach(entry => {
      // Skip invalid entries but allow placeholders
      if (!entry || !entry.CreatedAt || !entry.Weight) return;
      
      // Parse as local time (remove Z to avoid timezone conversion)
      const date = new Date(entry.CreatedAt.replace('Z', ''));
      // Check if date is valid
      if (isNaN(date.getTime())) return;
      
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthName = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      
      if (!grouped[monthKey]) {
        grouped[monthKey] = {
          monthName,
          entries: [],
          date: date
        };
      }
      
      // Include both regular entries and placeholders
      grouped[monthKey].entries.push(entry);
    });
    
    // Sort months in descending order (most recent first)
    return Object.values(grouped).sort((a, b) => b.date - a.date);
  }, [weightHistory]);

  /**
   * ✅ MEMOIZED: Pre-compute previous weight map for O(1) lookup
   */
  const previousWeightMap = useMemo(() => {
    const map = new Map();
    const sorted = weightHistory
      .filter(e => e && !e.isUndoPlaceholder && e.Weight && e.CreatedAt)
      .sort((a, b) => new Date(b.CreatedAt) - new Date(a.CreatedAt));
    
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
      
      const params = new URLSearchParams({ userId });
      
      const response = await fetch(`${apiBaseUrl}/api/get-weight-history?${params}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to fetch weight history');
      }

      // Set all weight history data
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
        <div className="flex flex-col items-center justify-center py-20 px-4">
          <div className="backdrop-blur-xl bg-white/30 rounded-2xl md:rounded-3xl p-8 md:p-12 border border-white/30 shadow-2xl">
            <div className="animate-spin rounded-full h-12 w-12 md:h-16 md:w-16 border-4 border-emerald-300 border-t-emerald-600 mb-4 md:mb-6 mx-auto"></div>
            <p className="text-gray-700 font-semibold text-lg md:text-xl text-center">Loading weight data...</p>
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
      <div className="w-full md:max-w-2xl lg:max-w-4xl md:mx-auto pb-6">
        <div className="px-4 md:px-6">
          {/* Current Month Header */}
          <div className="mt-5 mb-6">
            <div className="flex items-rigth justify-between">
              {/* <div>
                <h2 className="text-2xl font-bold text-gray-800">{currentMonth}</h2>
                <p className="text-sm text-gray-500 mt-1">Weight tracking history</p>
              </div> */}
              {/* <div className="bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full p-3">
                <Scale className="w-6 h-6 text-white" />
              </div> */}
            </div>
          </div>

          {/* Latest Weight Card - Always show (with data or empty state) */}
          <div className="mb-6">
            <div className="w-full max-w-md mx-auto 
              bg-gradient-to-br to-white 
              backdrop-blur-xl rounded-2xl 
              border 100 shadow-lg p-6 text-black">

  {/* Current Weight */}
  <div className="flex items-center justify-between mb-4 sm:mb-5">
    <div className="flex-1">
      <p className="text-xs sm:text-sm text-gray-500">Current Weight</p>
      <div className="flex items-center gap-2 mt-1">
        <span className="text-3xl sm:text-4xl font-bold text-black whitespace-nowrap">
          {latestWeight ? latestWeight.Weight : '-'}
          <span className="text-base sm:text-lg font-normal ml-1 text-gray-600">kg</span>
        </span>
        <span className="text-sm sm:text-base text-gray-700 whitespace-nowrap">
          ( Previous: {previousWeight !== null ? previousWeight : '-'} kg
          {latestWeight && previousWeight !== null ? (
            (() => {
              const diff = (parseFloat(latestWeight.Weight) - parseFloat(previousWeight)).toFixed(2);
              const diffNum = parseFloat(diff);
              if (diffNum > 0) {
                return (
                  <span className="inline-flex items-center gap-0.5 text-red-500 font-medium ml-1">
                    <TrendingUp className="w-5 h-5" />
                    +{diff} kg
                  </span>
                );
              } else if (diffNum < 0) {
                return (
                  <span className="inline-flex items-center gap-0.5 text-green-600 font-medium ml-1">
                    <TrendingDown className="w-5 h-5" />
                    {diff} kg
                  </span>
                );
              } else {
                return (
                  <span className="inline-flex items-center gap-0.5 text-gray-500 font-medium ml-1">
                    <Minus className="w-5 h-5" />
                    0.00 kg
                  </span>
                );
              }
            })()
          ) : (
            <span className="inline-flex items-center gap-0.5 text-gray-400 font-medium ml-1">
              <Minus className="w-5 h-5" />
              - kg
            </span>
          )}
          {' '})
        </span>
      </div>
      <p className="text-xs text-gray-500 mt-1.5 sm:mt-2">
        {latestWeight 
          ? new Date(latestWeight.CreatedAt.replace('Z', '')).toLocaleDateString('en-US', { 
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
  </div>

  {/* Stats Grid - Lowest & Highest - Always show (from ALL data via API) */}
  <div className="grid grid-cols-2 gap-3 mt-4">
    {/* Lowest */}
    <div className="bg-white rounded-xl p-3 text-center border border-white/40">
      <p className="text-xs text-gray-600 mb-1">Lowest</p>
      <p className="text-xl font-bold text-gray-900">
        {globalStats?.minWeight !== null && globalStats?.minWeight !== undefined 
          ? globalStats.minWeight.toFixed(1) 
          : '-'}
      </p>
      <p className="text-xs text-gray-500">kg</p>
      {globalStats?.minWeight !== null && globalStats?.minWeight !== undefined ? (
        <TrendingDown className="w-4 h-4 mx-auto mt-1 text-green-600" />
      ) : (
        <Minus className="w-5 h-4 mx-auto mt-1 text-gray-400" />
      )}
    </div>

    {/* Highest */}
    <div className="bg-white rounded-xl p-3 text-center border border-white/40">
      <p className="text-xs text-gray-600 mb-1">Highest</p>
      <p className="text-xl font-bold text-gray-900">
        {globalStats?.maxWeight !== null && globalStats?.maxWeight !== undefined 
          ? globalStats.maxWeight.toFixed(1) 
          : '-'}
      </p>
      <p className="text-xs text-gray-500">kg</p>
      {globalStats?.maxWeight !== null && globalStats?.maxWeight !== undefined ? (
        <TrendingUp className="w-4 h-4 mx-auto mt-1 text-red-500" />
      ) : (
        <Minus className="w-5 h-4 mx-auto mt-1 text-gray-400" />
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
                <div key={monthGroup.monthName} className="mb-6">
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
                      .filter(entry => entry && entry.ID && entry.CreatedAt && entry.Weight) // Filter out any invalid entries
                      .sort((a, b) => new Date(b.CreatedAt) - new Date(a.CreatedAt))
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

                        // // Regular weight card
                        // // Use the complete weightHistory to find previous entry across all months
                        // const allHistorySorted = weightHistory
                        //   .filter(e => e && !e.isUndoPlaceholder && e.Weight && e.CreatedAt)
                        //   .sort((a, b) => new Date(b.CreatedAt) - new Date(a.CreatedAt));
                        
                        // // Find the current entry's index in the complete history
                        // const currentIndex = allHistorySorted.findIndex(x => x.ID === entry.ID);
                        
                        // // Get the previous entry (next in array since sorted newest first)
                        // const prevEntry = currentIndex !== -1 && currentIndex < allHistorySorted.length - 1
                        //   ? allHistorySorted[currentIndex + 1]
                        //   : null;
                        
                        // // 🔍 DEBUG: Log last 3 weights
                        // if (index === 0) {
                        //   const last3 = allHistorySorted.slice(0, 3);
                        //   console.log('📊 LAST 3 WEIGHTS:', last3.map((e, i) => ({
                        //     position: i + 1,
                        //     id: e.ID,
                        //     weight: e.Weight,
                        //     date: e.CreatedAt
                        //   })));
                        //   console.log('📊 Total entries:', allHistorySorted.length);
                        // }

                        // ✅ OPTIMIZED: Use pre-computed previousWeightMap for O(1) lookup
                        const prevWeight = previousWeightMap.get(entry.ID);
                        return (
                          <Suspense key={entry.ID} fallback={
                            <div className="bg-white rounded-xl p-2.5 xs:p-3 sm:p-4 animate-pulse" style={{ minHeight: 56 }}>
                              <div className="flex items-center gap-2 xs:gap-3 sm:gap-4">
                                <div className="w-9 h-9 xs:w-10 xs:h-10 sm:w-12 sm:h-12 bg-gray-200 rounded-lg"></div>
                                <div className="flex-1 space-y-1.5 sm:space-y-2">
                                  <div className="h-2.5 xs:h-3 sm:h-4 bg-gray-200 rounded w-3/4"></div>
                                  <div className="h-2 xs:h-2.5 sm:h-3 bg-gray-200 rounded w-1/2"></div>
                                </div>
                                <div className="h-4 xs:h-5 sm:h-6 bg-gray-200 rounded w-8 xs:w-10 sm:w-12"></div>
                              </div>
                            </div>
                          }>
                            <WeightCard
                              data={entry}
                              previousWeight={prevWeight}
                              onDelete={handleDeleteEntry}
                              onView={handleViewEntry}
                              index={index}
                            />
                          </Suspense>
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
        {/* CSS keyframes for countdown animation */}
        <style>{`@keyframes countdown-shrink { from { transform: scaleX(1); } to { transform: scaleX(0); } }`}</style>

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
