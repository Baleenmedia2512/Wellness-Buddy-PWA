// src/components/WeightDashboard.js
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Scale,
  RotateCcw,
  Calendar,
  TrendingUp,
  TrendingDown
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
 * Monthly view with month-wise categorization
 */
const WeightDashboard = ({ user, apiBaseUrl, hideHeader }) => {
  // Weight history states
  const [weightHistory, setWeightHistory] = useState([]);
  const [_stats, setStats] = useState(null); // eslint-disable-line no-unused-vars
  const [loading, setLoading] = useState(true);
  const [_error, setError] = useState(null); // eslint-disable-line no-unused-vars

  // UI state - viewMode fixed to 'overview' since camera was removed
  const [viewMode] = useState('overview');

  // Modal and delete states
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [showModal, setShowModal] = useState(false);
  
  // Undo placeholders: key -> { originalEntry, expiresAt, ttlSeconds }
  const [undoState, setUndoState] = useState({});

  /**
   * Group weight entries by month
   */
  const groupEntriesByMonth = () => {
    const grouped = {};
    weightHistory.forEach(entry => {
      if (entry.isUndoPlaceholder) return;
      const date = new Date(entry.CreatedAt);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthName = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      
      if (!grouped[monthKey]) {
        grouped[monthKey] = {
          monthName,
          entries: [],
          date: date
        };
      }
      grouped[monthKey].entries.push(entry);
    });
    
    // Sort months in descending order (most recent first)
    return Object.values(grouped).sort((a, b) => b.date - a.date);
  };

  /**
   * Get current month name
   */
  const getCurrentMonth = () => {
    const now = new Date();
    return now.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  /**
   * Calculate month statistics
   */
  const getMonthStats = (entries) => {
    if (entries.length === 0) return null;
    
    const weights = entries.map(e => parseFloat(e.Weight));
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    const avgWeight = (totalWeight / weights.length).toFixed(1);
    const minWeight = Math.min(...weights).toFixed(1);
    const maxWeight = Math.max(...weights).toFixed(1);
    
    // Calculate weight change (first entry vs last entry)
    const firstEntry = entries[entries.length - 1];
    const lastEntry = entries[0];
    const weightChange = (parseFloat(lastEntry.Weight) - parseFloat(firstEntry.Weight)).toFixed(1);
    
    return {
      avgWeight,
      minWeight,
      maxWeight,
      weightChange,
      count: entries.length
    };
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
      
       const params = new URLSearchParams({
        userId,
        limit: '10',
        offset: '0'
      });
      
      const response = await fetch(`${apiBaseUrl}/api/get-weight-history?${params}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
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
   * Note: Actual backend deletion happens in handleUndoExpire callback
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

    // Backend deletion will happen in handleUndoExpire callback
    console.log('⏳ Entry marked for deletion:', entryToDelete.ID);
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

    console.log('✅ Undo restore (no backend call needed):', originalEntry.ID);
  };

  /**
   * Handle undo expiration - called when timer runs out
   */
  const handleUndoExpire = async (pid, originalEntry) => {
    // Remove placeholder from UI
    setWeightHistory(prev => prev.filter(e => e.ID !== pid));
    setUndoState(prev => {
      const next = { ...prev };
      delete next[pid];
      return next;
    });

    // Now perform the actual backend deletion
    try {
      const response = await fetch(`${apiBaseUrl}/api/delete-weight-entry`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: user.email || user.id || user.uid,
          entryId: originalEntry.ID
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to delete entry');
      }

      console.log('✅ Entry permanently deleted:', originalEntry.ID);

    } catch (err) {
      console.error('❌ Delete error:', err);
      // Restore entry on backend failure
      setWeightHistory(prev => prev.concat(originalEntry));
      alert(err.message || 'Failed to delete. Entry has been restored.');
    }
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
    const monthlyGroups = groupEntriesByMonth();
    
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

          {/* Latest Weight Card */}
          {latestWeight && currentMonthStats && (
            <div className="mb-6">
              {/*  bg-white/60 backdrop-blur-xl rounded-2xl shadow-md border border-gray-100 ||  bg-gradient-to-br from-emerald-400 to-teal-600 rounded-2xl */}
              <div className="w-full max-w-md mx-auto 
                bg-gradient-to-br from-purple-50 to-white 
                backdrop-blur-xl rounded-2xl 
                border border-purple-100 shadow-lg p-6 text-black">

  {/* Month and Entries */}
  <div className="flex items-center justify-between mb-5">
    <div className="flex items-center gap-2">
      <Calendar className="w-4 h-4 text-purple-600" />
      <span className="text-sm font-semibold text-purple-700">
        {monthlyGroups.length > 0 ? monthlyGroups[0].monthName : getCurrentMonth()}
      </span>
    </div>
    <span className="text-sm text-gray-600">
      {currentMonthStats.count} {currentMonthStats.count === 1 ? 'entry' : 'entries'}
    </span>
  </div>

  {/* Current Weight */}
  <div className="flex items-center justify-between mb-5">
    <div className="flex-1">
      <p className="text-sm text-gray-500">Current Weight</p>
      <p className="text-4xl font-bold mt-1 text-purple-700">
        {latestWeight.Weight}
        <span className="text-lg font-normal ml-1 text-gray-600">kg</span>
      </p>
      <p className="text-xs text-gray-500 mt-1">
        {new Date(latestWeight.CreatedAt).toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric', 
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}
      </p>
    </div>

    <div className="p-3 bg-purple-100 rounded-xl shadow-inner">
      <Scale className="w-10 h-10 text-purple-700" />
    </div>
  </div>

  {/* Stats Grid */}
  <div className="grid grid-cols-3 gap-3 mt-4">

    {/* Lowest */}
    <div className="bg-white rounded-xl p-3 text-center shadow-md border border-purple-100">
      <p className="text-xs text-gray-600 mb-1">Lowest</p>
      <p className="text-xl font-bold text-gray-900">{currentMonthStats.minWeight}</p>
      <p className="text-xs text-gray-500">kg</p>
      <TrendingDown className="w-4 h-4 mx-auto mt-1 text-green-600" />
    </div>

    {/* Highest */}
    <div className="bg-white rounded-xl p-3 text-center shadow-md border border-purple-100">
      <p className="text-xs text-gray-600 mb-1">Highest</p>
      <p className="text-xl font-bold text-gray-900">{currentMonthStats.maxWeight}</p>
      <p className="text-xs text-gray-500">kg</p>
      <TrendingUp className="w-4 h-4 mx-auto mt-1 text-red-500" />
    </div>

    {/* Average */}
    <div className="bg-white rounded-xl p-3 text-center shadow-md border border-purple-100">
      <p className="text-xs text-gray-600 mb-1">Average</p>
      <p className="text-xl font-bold text-gray-900">{currentMonthStats.avgWeight}</p>
      <p className="text-xs text-gray-500">kg</p>

      {parseFloat(latestWeight.Weight) < parseFloat(currentMonthStats.avgWeight) ? (
        <TrendingDown className="w-4 h-4 mx-auto mt-1 text-green-600" />
      ) : parseFloat(latestWeight.Weight) > parseFloat(currentMonthStats.avgWeight) ? (
        <TrendingUp className="w-4 h-4 mx-auto mt-1 text-red-500" />
      ) : (
        <div className="w-4 h-4 mx-auto mt-1 bg-blue-400 rounded-full" />
      )}
    </div>
  </div>
</div>

            </div>
          )}

        {/* Weight Entries Grouped by Month */}
        <div className="space-y-6">
          {monthlyGroups.length === 0 ? (
            <div className="text-center py-16 px-6 backdrop-blur-xl bg-white/30 rounded-2xl shadow-lg border border-white/40">
              <div className="text-6xl mb-4">⚖️</div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">No Weight Entries</h3>
              <p className="text-gray-600 max-w-xs mx-auto">
                Take a photo of your weighing scale to start tracking your weight.
              </p>
            </div>
          ) : (
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

                  {/* Month Entries */}
                  <div className="space-y-3">
                    {/* First pass: collect placeholders to display */}
                    {(() => {
                      // Include placeholders in the sorted entries
                      const allEntries = [
                        ...monthGroup.entries,
                        ...Object.keys(undoState).map(pid => {
                          const entry = undoState[pid].originalEntry;
                          // Check if this placeholder belongs to current month
                          const date = new Date(entry.CreatedAt);
                          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                          const currentMonthKey = `${monthGroup.date.getFullYear()}-${String(monthGroup.date.getMonth() + 1).padStart(2, '0')}`;
                          if (monthKey === currentMonthKey) {
                            return {
                              ID: pid,
                              isUndoPlaceholder: true,
                              CreatedAt: entry.CreatedAt,
                              Weight: entry.Weight
                            };
                          }
                          return null;
                        }).filter(Boolean)
                      ];

                      return allEntries
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
                                onExpire={() => handleUndoExpire(entry.ID, undoEntry.originalEntry)}
                              />
                            );
                          }

                          // Regular weight card
                          const prevEntry = allEntries
                            .filter(e => !e.isUndoPlaceholder)
                            .sort((a, b) => new Date(b.CreatedAt) - new Date(a.CreatedAt))
                            .find((e, i, arr) => {
                              const currentIndex = arr.findIndex(x => x.ID === entry.ID);
                              return i === currentIndex + 1;
                            });
                          
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
                        });
                    })()}
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
