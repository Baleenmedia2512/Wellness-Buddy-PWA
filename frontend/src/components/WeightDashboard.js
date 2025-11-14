// src/components/WeightDashboard.js
import React, { useState, useEffect, useMemo } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Scale,
  ChevronLeft,
  ChevronRight,
  RotateCcw
} from 'lucide-react';
// Camera removed - images are uploaded from main page
import WeightCard from './WeightCard';
import WeightCardModal from './WeightCardModal';

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

  return (
    <div className="relative bg-white border border-amber-200/70 rounded-xl p-3 flex items-center gap-3 shadow-sm" style={{ height: 84 }}>
      <div className="h-7 w-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor"><circle cx="12" cy="12" r="3" /></svg>
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-800 truncate">
          <span className="font-medium">Removed</span> "{originalEntry.Weight} kg"
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
 * Matches the style and layout of NutritionDashboard
 */
const WeightDashboard = ({ user, apiBaseUrl, hideHeader }) => {
  // Weight history states
  const [weightHistory, setWeightHistory] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // UI state - viewMode fixed to 'overview' since camera was removed
  const [viewMode] = useState('overview');
  
  // Date selection state
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Modal and delete states
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [showModal, setShowModal] = useState(false);
  
  // Undo placeholders: key -> { originalEntry, expiresAt, ttlSeconds }
  const [undoState, setUndoState] = useState({});

  /**
   * Date navigation helper
   */
  const navigateDate = (direction) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + direction);
    const today = new Date();
    if (newDate <= today) {
      setSelectedDate(newDate);
    }
  };

  /**
   * Format date header
   */
  const formatDateHeader = (date) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric' 
      });
    }
  };

  /**
   * Generate horizontal calendar dates (desktop view)
   */
  const generateHorizontalCalendarDates = () => {
    const dates = [];
    const today = new Date();
    for (let i = -3; i <= 3; i++) {
      const date = new Date(selectedDate);
      date.setDate(selectedDate.getDate() + i);
      const prevDate = i > -3 ? new Date(selectedDate) : null;
      if (prevDate) prevDate.setDate(selectedDate.getDate() + (i - 1));
      const isNewMonth = i === -3 || (prevDate && date.getMonth() !== prevDate.getMonth());
      dates.push({
        date,
        dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNumber: date.getDate(),
        monthName: date.toLocaleDateString('en-US', { month: 'short' }),
        isToday: date.toDateString() === today.toDateString(),
        isSelected: date.toDateString() === selectedDate.toDateString(),
        isFuture: date > today,
        isNewMonth
      });
    }
    return dates;
  };

  /**
   * Generate scrollable dates (mobile view)
   */
  const generateScrollableDates = () => {
    const dates = [];
    const today = new Date();
    for (let i = -20; i <= 0; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const prevDate = i > -20 ? new Date(today) : null;
      if (prevDate) prevDate.setDate(today.getDate() + (i - 1));
      const isNewMonth = i === -20 || (prevDate && date.getMonth() !== prevDate.getMonth());
      dates.push({
        date,
        dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNumber: date.getDate(),
        monthName: date.toLocaleDateString('en-US', { month: 'short' }),
        isToday: date.toDateString() === today.toDateString(),
        isSelected: date.toDateString() === selectedDate.toDateString(),
        isFuture: false,
        isNewMonth
      });
    }
    return dates;
  };

  /**
   * Check if device is mobile
   */
  const isMobileDevice = () =>
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    window.innerWidth <= 768;

  /**
   * Get time period from timestamp
   */
  const getTimePeriod = (timeString) => {
    const hour = new Date(timeString).getHours();
    if (hour >= 0 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    return 'evening';
  };

  /**
   * Get time period display info
   */
  const getTimePeriodInfo = (period) => {
    const periods = {
      'morning': { name: 'Morning', timeRange: '12:00 AM - 12:00 PM' },
      'afternoon': { name: 'Afternoon', timeRange: '12:00 PM - 5:00 PM' },
      'evening': { name: 'Evening', timeRange: '5:00 PM - 12:00 AM' }
    };
    return periods[period] || periods['evening'];
  };

  /**
   * Get entries for selected date
   */
  const getEntriesForDate = () => {
    const dateStr = selectedDate.toISOString().split('T')[0];
    return weightHistory.filter(entry => {
      const entryDate = new Date(entry.CreatedAt).toISOString().split('T')[0];
      return entryDate === dateStr;
    });
  };

  /**
   * Fetch weight history on mount
   */
  useEffect(() => {
    fetchWeightHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Re-fetch when date changes
   */
  useEffect(() => {
    if (weightHistory.length > 0) {
      // Filter entries for selected date (for display)
      getEntriesForDate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  /**
   * Auto-scroll to selected date on mobile
   */
  useEffect(() => {
    if (isMobileDevice()) {
      setTimeout(() => {
        const scrollableDates = generateScrollableDates();
        const selectedIndex = scrollableDates.findIndex(
          (d) => d.date.toDateString() === selectedDate.toDateString()
        );
        if (selectedIndex !== -1) {
          const el = document.querySelector(`[data-date-index="${selectedIndex}"]`);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
      }, 100);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  /**
   * Fetch weight history from backend
   */
  const fetchWeightHistory = async () => {
    try {
      setLoading(true);
      setError(null);

      const userId = user.email || user.id || user.uid;
      
      const response = await fetch(`${apiBaseUrl}/api/get-weight-history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, limit: 30, offset: 0 })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to fetch weight history');
      }

      setWeightHistory(data.data || [])
      setStats(data.stats || null);

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
   * Handle delete with optimistic placeholder (inline undo)
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

    try {
      const response = await fetch(`${apiBaseUrl}/api/delete-weight-entry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: user.email || user.id || user.uid,
          // entryId: entryToDelete.ID 
          entryId: entryToDelete.ID
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to delete entry');
      }

      console.log('✅ Entry deleted:', entryToDelete.ID);

    } catch (err) {
      console.error('❌ Delete error:', err);
      // Rollback on failure
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
   * Handle undo restore
   */
  const handleUndoRestore = async (pid, originalEntry) => {
    // Optimistic restore
    setWeightHistory(prev => prev.filter(e => e.ID !== pid).concat(originalEntry));
    setUndoState(prev => {
      const next = { ...prev };
      delete next[pid];
      return next;
    });

    // Note: No backend call needed - entry was never actually deleted
    console.log('✅ Undo restore:', originalEntry.ID);
  };

  // Weight saving removed - entries are added via main page image upload

  /**
   * Format date
   */
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  /**
   * Get weight change indicator
   */
  const getWeightChange = () => {
    if (!weightHistory || weightHistory.length < 2) return null;
    const latest = weightHistory[0].Weight;
    const previous = weightHistory[1].Weight;
    return (latest - previous).toFixed(1);
  };

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

    const weightChange = getWeightChange();
    const latestWeight = weightHistory.length > 0 ? weightHistory[0] : null;
    const dailyEntries = getEntriesForDate();

    return (
      <div className="w-full md:max-w-2xl lg:max-w-4xl md:mx-auto pb-6">
        {/* Horizontal Calendar Date Selector */}
        <div className="mb-4 bg-white/50 backdrop-blur-sm shadow-sm">
          {isMobileDevice() ? (
            <div className="px-4 py-3">
              <div className="overflow-x-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                <style jsx>{`div::-webkit-scrollbar{display:none;}`}</style>
                <div className="flex space-x-2 pb-1" style={{ minWidth: 'max-content' }}>
                  {generateScrollableDates().map((day, index) => (
                    <React.Fragment key={index}>
                      {day.isNewMonth && index > 0 && (
                        <div className="flex items-center justify-center mx-1 relative">
                          <div className="backdrop-blur-sm bg-white/30 rounded-lg px-1.5 py-1.5 shadow-sm border border-white/20">
                            <div
                              className="text-xs font-semibold text-gray-600"
                              style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', fontSize: '9px', letterSpacing: '1px' }}
                            >
                              {day.monthName.toUpperCase()}
                            </div>
                          </div>
                        </div>
                      )}
                      <button
                        data-date-index={index}
                        onClick={() => setSelectedDate(day.date)}
                        className={`flex-shrink-0 w-12 text-center py-2 px-1 rounded-lg transition-all duration-300 relative backdrop-blur-sm border
                          ${day.isSelected ? 'bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-lg scale-105 border-emerald-300'
                            : day.isToday ? 'bg-white/40 text-gray-800 border-white/30 shadow-md'
                            : 'text-gray-600 hover:bg-white/30 bg-white/20 border-white/20' }`}
                      >
                        <div className="text-xs font-medium mb-0.5">{day.dayName}</div>
                        <div className="text-sm font-semibold">{day.dayNumber}</div>
                        {day.isToday && (
                          <div className={`w-1 h-1 rounded-full mx-auto mt-0.5 ${day.isSelected ? 'bg-white' : 'bg-emerald-500'}`} />
                        )}
                      </button>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center px-4 py-3 md:px-6 md:py-2">
              <button
                onClick={() => navigateDate(-1)}
                className="p-2 md:p-3 hover:bg-white/30 rounded-xl md:rounded-2xl transition-all duration-300 mr-2 md:mr-3 backdrop-blur-sm border border-white/20"
              >
                <ChevronLeft className="h-4 w-4 md:h-5 md:w-5 text-gray-600" />
              </button>

              <div className="flex-1 overflow-hidden">
                <div className="flex items-center justify-center space-x-1 md:space-x-2">
                  {generateHorizontalCalendarDates().map((day, index) => (
                    <React.Fragment key={index}>
                      {day.isNewMonth && index > 0 && (
                        <div className="flex items-center justify-center mx-1 md:mx-2 relative h-full">
                          <div className="backdrop-blur-sm bg-white/30 rounded-lg md:rounded-xl px-1.5 md:px-2 py-2 md:py-3 shadow-sm border border-white/20">
                            <div
                              className="text-xs font-bold text-gray-600 tracking-wider"
                              style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', letterSpacing: '2px' }}
                            >
                              {day.monthName.toUpperCase()}
                            </div>
                          </div>
                        </div>
                      )}
                      <button
                        onClick={() => !day.isFuture && setSelectedDate(day.date)}
                        disabled={day.isFuture}
                        className={`w-12 h-12 md:w-16 md:h-16 text-center rounded-lg md:rounded-2xl transition-all duration-300 relative backdrop-blur-sm border
                          ${day.isSelected ? 'bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-lg scale-105 border-emerald-300'
                            : day.isToday ? 'bg-white/40 text-gray-800 border-white/30 shadow-md'
                            : day.isFuture ? 'text-gray-300 cursor-not-allowed bg-white/10 border-white/10'
                            : 'text-gray-600 hover:bg-white/30 bg-white/20 border-white/20' }`}
                      >
                        <div className="text-xs font-medium mb-0.5 md:mb-1">{day.dayName}</div>
                        <div className="text-sm md:text-lg font-semibold">{day.dayNumber}</div>
                        {day.isToday && (
                          <div className={`w-1 h-1 md:w-1.5 md:h-1.5 rounded-full mx-auto mt-0.5 md:mt-1 ${day.isSelected ? 'bg-white' : 'bg-emerald-500'}`} />
                        )}
                      </button>
                    </React.Fragment>
                  ))}
                </div>
              </div>

              <button
                onClick={() => navigateDate(1)}
                disabled={(() => {
                  const nextDay = new Date(selectedDate);
                  nextDay.setDate(selectedDate.getDate() + 1);
                  return nextDay > new Date();
                })()}
                className="p-2 md:p-3 hover:bg-white/30 rounded-xl md:rounded-2xl transition-all duration-300 ml-2 md:ml-3 disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-sm border border-white/20"
              >
                <ChevronRight className="h-4 w-4 md:h-5 md:w-5 text-gray-600" />
              </button>
            </div>
          )}
        </div>

        <div className="px-4 md:px-6">
          {/* Latest Weight Card */}
          <div className="mt-5 mb-4">
          <div className="w-full max-w-md mx-auto bg-gradient-to-br from-emerald-400 to-teal-600 rounded-2xl shadow-lg p-6 text-white">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-white/80">Current Weight</p>
                {latestWeight ? (
                  <>
                    <p className="text-4xl font-bold mt-1">
                      {latestWeight.Weight}
                      <span className="text-lg font-normal ml-1">kg</span>
                    </p>
                    <p className="text-xs text-white/70 mt-1">{formatDate(latestWeight.CreatedAt)}</p>
                  </>
                ) : (
                  <p className="text-2xl font-bold mt-1">No data</p>
                )}
              </div>
              <div className="flex flex-col items-end space-y-2">
                {weightChange && (
                  <div className={`flex items-center space-x-1 px-2 py-1 rounded-full ${
                    parseFloat(weightChange) > 0 
                      ? 'bg-red-500/30' 
                      : 'bg-green-500/30'
                  }`}>
                    {parseFloat(weightChange) > 0 ? (
                      <TrendingUp className="w-4 h-4" />
                    ) : (
                      <TrendingDown className="w-4 h-4" />
                    )}
                    <span className="text-sm font-medium">
                      {parseFloat(weightChange) > 0 ? '+' : ''}{weightChange} kg
                    </span>
                  </div>
                )}
                <Scale className="w-8 h-8 text-white/60" />
              </div>
            </div>

            {/* Stats Row */}
            {stats && (
              <div className="flex justify-between items-center pt-4 border-t border-white/20">
                {/* <div className="text-center">
                  <p className="text-xs text-white/70">Entries</p>
                  <p className="text-lg font-bold">{weightHistory.filter(e => !e.isUndoPlaceholder).length}</p>
                </div> */}
                <div className="text-center">
                  <p className="text-xs text-white/70">Lowest</p>
                  <div className="flex items-center justify-center gap-1">
                    {stats.minWeight && (
                      <TrendingDown className="w-4 h-4 text-red-400" />
                    )}
                    <p className="text-lg font-bold">{stats.minWeight ? stats.minWeight.toFixed(1) : '-'}</p>
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-xs text-white/70">Highest</p>
                  <div className="flex items-center justify-center gap-1">
                    {stats.maxWeight && (
                      <TrendingUp className="w-4 h-4 text-green-400" />
                    )}
                    <p className="text-lg font-bold">{stats.maxWeight ? stats.maxWeight.toFixed(1) : '-'}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Camera button removed - use main page upload for weight scale images */}

        {/* Weight Entries Grouped by Time Period */}
        <div className="space-y-4">
          {(() => {
            const entriesToShow = dailyEntries.length > 0 ? dailyEntries : weightHistory.slice(0, 10);
            const hasUndoPlaceholders = entriesToShow.some(e => e.isUndoPlaceholder);
            const hasRealEntries = entriesToShow.some(e => !e.isUndoPlaceholder);

            if (!hasRealEntries && !hasUndoPlaceholders) {
              return (
                <div className="text-center py-16 px-6 backdrop-blur-xl bg-white/30 rounded-2xl shadow-lg border border-white/40">
                  <div className="text-6xl mb-4">⚖️</div>
                  <h3 className="text-xl font-semibold text-gray-800 mb-2">No Weight Entries</h3>
                  <p className="text-gray-600 max-w-xs mx-auto">
                    Take a photo of your weighing scale to start tracking your weight.
                  </p>
                </div>
              );
            }

            // Group entries by time period
            const groupedEntries = entriesToShow.reduce((groups, entry) => {
              const period = getTimePeriod(entry.CreatedAt);
              if (!groups[period]) groups[period] = [];
              groups[period].push(entry);
              return groups;
            }, {});

            return (
              <>
                {['evening','afternoon','morning'].map((period) => {
                  const entries = groupedEntries[period] || [];
                  if (entries.length === 0) return null;

                  const periodInfo = getTimePeriodInfo(period);
                  const periodTotalWeight = entries.reduce((sum, entry) => {
                    if (entry.isUndoPlaceholder) return sum;
                    return sum + (parseFloat(entry.Weight) || 0);
                  }, 0);
                  const realEntriesCount = entries.filter(e => !e.isUndoPlaceholder).length;
                  const avgWeight = realEntriesCount > 0 ? (periodTotalWeight / realEntriesCount).toFixed(1) : '0.0';

                  return (
                    <div key={period}>
                      <div className="flex items-center justify-between mb-3 px-2">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-800">{periodInfo.name}</h3>
                          <p className="text-sm text-gray-500">{periodInfo.timeRange}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-base font-semibold text-gray-800">{avgWeight}</p>
                          <p className="text-xs text-gray-500">kg avg</p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {entries
                          .slice()
                          // .sort((a, b) => new Date(a.CreatedAt) - new Date(b.CreatedAt))
                          .sort((a, b) => new Date(b.CreatedAt) - new Date(a.CreatedAt))
                          .map((entry, index) => {
                            // Show undo row if this is a placeholder
                            if (entry.isUndoPlaceholder) {
                              const undoEntry = undoState[entry.ID];
                              if (!undoEntry) return null;
                              return (
                                <UndoRow
                                  key={entry.ID}
                                  pid={entry.ID}
                                  originalEntry={undoEntry.originalEntry}
                                  expiresAt={undoEntry.expiresAt}
                                  ttlSeconds={undoEntry.ttlSeconds ?? UNDO_SECONDS}
                                  onRestore={handleUndoRestore}
                                  onExpire={() => {
                                    setWeightHistory(prev => prev.filter(e => e.ID !== entry.ID));
                                    setUndoState(prev => {
                                      const next = { ...prev };
                                      delete next[entry.ID];
                                      return next;
                                    });
                                  }}
                                />
                              );
                            }

                            // Regular weight card
                            const prevEntry = entries[index + 1];
                            return (
                              <WeightCard
                                key={entry.ID}
                                data={entry}
                                previousWeight={prevEntry ? prevEntry.Weight : null}
                                onDelete={handleDeleteEntry}
                                onView={handleViewEntry}
                                index={index}
                              />
                            );
                          })}
                      </div>
                    </div>
                  );
                })}
              </>
            );
          })()}
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
          <WeightCardModal
            data={selectedEntry}
            onClose={() => {
              setShowModal(false);
              setSelectedEntry(null);
            }}
            onDelete={handleDeleteEntry}
            onEdit={() => {
              // TODO: Implement edit functionality
              console.log('Edit not implemented yet');
            }}
            previousWeight={(() => {
              const index = weightHistory.findIndex(e => e.ID === selectedEntry.ID);
              return index > 0 ? weightHistory[index + 1].Weight : null;
            })()}
          />
        )}
      </div>
    );
  }

  return (
    <>
      {viewMode === 'overview' && renderOverview()}
      
      {/* Weight Card Modal */}
      {showModal && selectedEntry && (
        <WeightCardModal
          data={selectedEntry}
          onClose={() => {
            setShowModal(false);
            setSelectedEntry(null);
          }}
          onDelete={handleDeleteEntry}
          onEdit={() => {
            // TODO: Implement edit functionality
            console.log('Edit not implemented yet');
          }}
          previousWeight={(() => {
            const index = weightHistory.findIndex(e => e.ID === selectedEntry.ID);
            return index > 0 ? weightHistory[index + 1].Weight : null;
          })()}
        />
      )}
    </>
  );
};

export default WeightDashboard;
