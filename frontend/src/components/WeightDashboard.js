// src/components/WeightDashboard.js
import React, { useState, useEffect, useMemo } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Scale,
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
const WeightDashboard = ({ user, apiBaseUrl, hideHeader, selectedDate: propSelectedDate, setSelectedDate: propSetSelectedDate }) => {
  // Weight history states
  const [weightHistory, setWeightHistory] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // UI state - viewMode fixed to 'overview' since camera was removed
  const [viewMode] = useState('overview');
  
  // Date selection state - use parent's selectedDate if provided, otherwise use local state
  const [localSelectedDate, setLocalSelectedDate] = useState(new Date());
  const selectedDate = propSelectedDate || localSelectedDate;
  const setSelectedDate = propSetSelectedDate || setLocalSelectedDate;

  // Modal and delete states
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [showModal, setShowModal] = useState(false);
  
  // Undo placeholders: key -> { originalEntry, expiresAt, ttlSeconds }
  const [undoState, setUndoState] = useState({});

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
   * Note: Entries are filtered dynamically in renderOverview()
   * No need for separate useEffect - filtering happens on each render
   */

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
        method: 'DELETE',
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
      console.log(err.message || 'Failed to delete. Please try again.');
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

    const dailyEntries = getEntriesForDate();
    
    // Get latest weight for selected date (not always today)
    const latestWeight = dailyEntries.length > 0 ? dailyEntries[0] : null;
    
    // Calculate weight change for selected date
    const weightChange = (() => {
      if (dailyEntries.length < 2) {
        // If less than 2 entries on selected date, compare with previous day's last entry
        const prevDayDate = new Date(selectedDate);
        prevDayDate.setDate(prevDayDate.getDate() - 1);
        const prevDayStr = prevDayDate.toISOString().split('T')[0];
        
        const prevDayEntries = weightHistory.filter(entry => {
          const entryDate = new Date(entry.CreatedAt).toISOString().split('T')[0];
          return entryDate === prevDayStr && !entry.isUndoPlaceholder;
        });
        
        if (dailyEntries.length === 1 && prevDayEntries.length > 0) {
          const currentWeight = parseFloat(dailyEntries[0].Weight);
          const previousWeight = parseFloat(prevDayEntries[0].Weight);
          return (currentWeight - previousWeight).toFixed(1);
        }
        return null;
      }
      
      // If multiple entries on selected date, compare latest vs first
      const latest = parseFloat(dailyEntries[0].Weight);
      const previous = parseFloat(dailyEntries[dailyEntries.length - 1].Weight);
      return (latest - previous).toFixed(1);
    })();
    
    // Calculate dynamic stats for selected date only
    const dailyStats = (() => {
      const realEntries = dailyEntries.filter(e => !e.isUndoPlaceholder);
      if (realEntries.length === 0) return null;
      
      const weights = realEntries.map(e => parseFloat(e.Weight));
      return {
        minWeight: Math.min(...weights),
        maxWeight: Math.max(...weights),
        count: realEntries.length
      };
    })();

    return (
      <div className="w-full md:max-w-2xl lg:max-w-4xl md:mx-auto pb-6">
        <div className="px-4 md:px-6">
          {/* Latest Weight Card */}
          <div className="mt-5 mb-4">
          <div className="w-full max-w-md mx-auto bg-gradient-to-br from-emerald-400 to-teal-600 rounded-2xl shadow-lg p-6 text-white">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-white/80">{formatDateHeader(selectedDate)}'s Weight</p>
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
            {dailyStats && (
              <div className="flex justify-between items-center pt-4 border-t border-white/20">
                <div className="text-center">
                  <p className="text-xs text-white/70">Lowest</p>
                  <div className="flex items-center justify-center gap-1">
                    {dailyStats.minWeight && (
                      <TrendingDown className="w-4 h-4 text-red-400" />
                    )}
                    <p className="text-lg font-bold">
                      {dailyStats.minWeight ? dailyStats.minWeight.toFixed(1) : '-'}
                      {dailyStats.minWeight && <span className="text-sm font-normal ml-0.5">kg</span>}
                    </p>
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-xs text-white/70">Highest</p>
                  <div className="flex items-center justify-center gap-1">
                    {dailyStats.maxWeight && (
                      <TrendingUp className="w-4 h-4 text-green-400" />
                    )}
                    <p className="text-lg font-bold">
                      {dailyStats.maxWeight ? dailyStats.maxWeight.toFixed(1) : '-'}
                      {dailyStats.maxWeight && <span className="text-sm font-normal ml-0.5">kg</span>}
                    </p>
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
            // Only show entries for the selected date, no fallback to recent entries
            const entriesToShow = dailyEntries;
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
