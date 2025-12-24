import React, { useState, useEffect, useMemo, lazy, Suspense, useRef } from 'react';
import { BookOpen, Calendar, RotateCcw, Monitor, Clock, Layers, TrendingUp, Video, CheckCircle2, Flame, Sun, Moon, Sunset, Check } from 'lucide-react';
import { getUserId } from '../services/getUserId';
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
            Restoring…
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

const EducationDashboard = ({ user, apiBaseUrl, hideHeader }) => {
  const [educationLogs, setEducationLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [undoState, setUndoState] = useState({});
  const [selectedLog, setSelectedLog] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const userIdRef = useRef(null);

  /**
   * Group education logs by month
   */
  const monthlyGroups = useMemo(() => {
    const grouped = {};
    
    educationLogs.forEach(log => {
      if (!log || !log.CreatedAt) return;
      
      const date = new Date(log.CreatedAt);
      if (isNaN(date.getTime())) return;
      
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

  /**
   * Fetch education logs on mount
   */
  useEffect(() => {
    fetchEducationLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Fetch summary data independently
   */
  const fetchSummary = async () => {
    try {
      const userId = userIdRef.current || user?.id;
      if (!userId) return;

      const response = await fetch(`${apiBaseUrl}/api/get-education-summary?userId=${userId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setSummary(data.summary);
        }
      }
    } catch (err) {
      console.error('❌ Fetch summary error:', err);
    }
  };

  /**
   * Fetch education logs from API
   */
  const fetchEducationLogs = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!userIdRef.current) {
        userIdRef.current = user?.id || await getUserId(user);
      }
      const userId = userIdRef.current;
      
      if (!userId) {
        throw new Error('User not authenticated');
      }
      
      // Fetch logs and summary in parallel
      const [logsResponse, summaryResponse] = await Promise.all([
        fetch(`${apiBaseUrl}/api/get-education-logs?userId=${userId}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        }),
        fetch(`${apiBaseUrl}/api/get-education-summary?userId=${userId}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        })
      ]);

      const logsData = await logsResponse.json();
      
      if (!logsResponse.ok || !logsData.success) {
        throw new Error(logsData.message || 'Failed to fetch education logs');
      }

      setEducationLogs(logsData.logs || []);

      // Handle summary data
      if (summaryResponse.ok) {
        const summaryData = await summaryResponse.json();
        if (summaryData.success) {
          setSummary(summaryData.summary);
          setSummaryLoading(false);
        }
      } else {
        console.warn('Summary fetch failed, will use loaded logs for stats');
        setSummaryLoading(false);
      }

    } catch (err) {
      console.error('❌ Fetch education logs error:', err);
      setError(err.message || 'Failed to load education logs');
      setSummaryLoading(false);
    } finally {
      setLoading(false);
    }
  };

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
      
      const response = await fetch(`${apiBaseUrl}/api/delete-education-log`, {
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

      console.log('✅ Education log soft-deleted:', logToDelete.Id);
      
      // Refresh summary to reflect the delete
      fetchSummary();

    } catch (err) {
      console.error('❌ Delete error:', err);
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
      
      const response = await fetch(`${apiBaseUrl}/api/undo-deleted-education-log`, {
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

      console.log('✅ Education log restored:', originalLog.Id);
      
      // Refresh summary to reflect the restore
      fetchSummary();

    } catch (err) {
      console.error('❌ Undo restore error:', err);
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

    console.log('⏱️ Undo timer expired, log remains deleted:', originalLog.Id);
  };

  /**
   * Render loading state
   */
  if (loading) {
    return (
      <div className="w-full md:max-w-2xl lg:max-w-4xl md:mx-auto pb-24 mt-2 animate-pulse">
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
      
    <div className="w-full md:max-w-2xl lg:max-w-4xl md:mx-auto pb-24 mt-2">
      <div className="px-4 md:px-6">
        {/* Habit & Streak Summary Card */}
        <div className="mb-6 mt-2">
          <div className="w-full max-w-md mx-auto bg-white rounded-2xl shadow-sm border border-gray-200/60 p-5">
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
                  const hour = new Date(log.CreatedAt).getHours();
                  if (hour >= 5 && hour < 12) timeSlots.morning++;
                  else if (hour >= 12 && hour < 17) timeSlots.afternoon++;
                  else if (hour >= 17 && hour < 22) timeSlots.evening++;
                  else timeSlots.night++;
                });

                const maxSlot = Object.keys(timeSlots).reduce((a, b) => timeSlots[a] > timeSlots[b] ? a : b);
                let icon = <Sun className="w-3.5 h-3.5" />;
                let text = "Learner";
                let style = "bg-gray-100 text-gray-600";

                if (maxSlot === 'morning') {
                  icon = <Sun className="w-3.5 h-3.5" />;
                  text = "Morning Learner";
                  style = "bg-orange-50 text-orange-700 border-orange-100";
                } else if (maxSlot === 'afternoon') {
                  icon = <Sun className="w-3.5 h-3.5" />;
                  text = "Daytime Achiever";
                  style = "bg-yellow-50 text-yellow-700 border-yellow-100";
                } else if (maxSlot === 'evening') {
                  icon = <Sunset className="w-3.5 h-3.5" />;
                  text = "Evening Scholar";
                  style = "bg-purple-50 text-purple-700 border-purple-100";
                } else {
                  icon = <Moon className="w-3.5 h-3.5" />;
                  text = "Night Owl";
                  style = "bg-indigo-50 text-indigo-700 border-indigo-100";
                }

                return (
                  <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border ${style}`}>
                    {icon}
                    <span className="text-xs font-semibold">{text}</span>
                  </div>
                );
              })()}
            </div>

            {/* Bottom Row: Last 7 Days Activity */}
            <div>
              <div className="flex justify-between items-end mb-2">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Last 7 Days</p>
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
                  
                  // Use summary data if available, otherwise fall back to loaded logs
                  const activeDates = summary?.last7DaysDates 
                    ? summary.last7DaysDates.map(d => new Date(d).toDateString())
                    : educationLogs.map(log => new Date(log.CreatedAt).toDateString());
                  
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
                          hasLog ? 'text-emerald-600 font-bold' : (isToday ? 'text-gray-500' : 'text-gray-400')
                        }`}>
                          {d.toLocaleDateString('en-US', { weekday: 'narrow' })}
                        </span>
                      </div>
                    );
                  }
                  return days;
                })()}
              </div>
            </div>
          </div>
        </div>

        {/* New user message - only show when no entries */}
        {monthlyGroups.length === 0 && (
          <div className="text-center py-12 px-6 bg-white/60 backdrop-blur-xl rounded-2xl shadow-md border border-gray-100">
            <div className="text-6xl mb-4">📚</div>
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
                      .sort((a, b) => new Date(b.CreatedAt) - new Date(a.CreatedAt))
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
                            />
                          </Suspense>
                        );
                      })}
                  </div>
                </div>
              );
            }))}
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
        />
      )}
    </>
  );
};

export default EducationDashboard;
