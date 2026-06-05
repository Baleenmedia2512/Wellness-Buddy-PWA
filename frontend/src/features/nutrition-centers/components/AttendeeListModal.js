import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Users, ChevronDown, ChevronUp } from 'lucide-react';
import LoadingSpinner from '../../../shared/components/LoadingSpinner';
import { debugLog } from '../../../shared/utils/logger.js';

/**
 * Helper to format timestamp as human-readable time
 */
const formatTime = (timestamp) => {
  if (!timestamp) return '';
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  } catch {
    return '';
  }
};

/**
 * Helper to get icon/emoji for log type
 */
const getLogIcon = (logType) => {
  switch (logType) {
    case 'education': return '📚';
    case 'weight': return '⚖️';
    case 'food': return '🍽️';
    default: return '✅';
  }
};

/**
 * Helper to group logs by user
 */
const groupLogsByUser = (logs) => {
  const grouped = {};
  logs.forEach((log) => {
    if (!grouped[log.userId]) {
      grouped[log.userId] = {
        userId: log.userId,
        userName: log.userName,
        logs: [],
      };
    }
    grouped[log.userId].logs.push({
      logType: log.logType || 'unknown',
      timestamp: log.timestamp || new Date().toISOString(),
    });
  });
  // Sort logs within each user by timestamp ascending, then capture first log time
  Object.values(grouped).forEach((user) => {
    user.logs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    // First log time is now at index 0 after sort
    user.firstLogTime = user.logs.length > 0 ? user.logs[0].timestamp : null;
  });
  return Object.values(grouped);
};

/**
 * AttendeeListModal
 * Bottom-sheet modal that shows who attended a specific nutrition centre
 * on the currently selected date / date range.
 *
 * Props:
 *   isOpen      {boolean}  — controls visibility
 *   onClose     {function} — called when user closes the modal
 *   center      {object}   — { id, center_name } — single centre mode; null = summary mode
 *   allCenters  {Array}    — list of all centres (used when center is null for summary mode)
 *   dateLabel   {string}   — e.g. "Today", "Yesterday", "Jun 1"
 *   startDate   {string}   — ISO date string YYYY-MM-DD
 *   endDate     {string}   — ISO date string YYYY-MM-DD
 *   apiBaseUrl  {string}   — base API URL
 */
const AttendeeListModal = ({
  isOpen,
  onClose,
  center,
  allCenters,
  dateLabel,
  startDate,
  endDate,
  apiBaseUrl,
}) => {
  const [attendees, setAttendees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedUsers, setExpandedUsers] = useState(new Set());

  useEffect(() => {
    if (!isOpen) return;
    // Single-centre mode requires center.id; summary mode requires allCenters
    if (!center?.id && (!allCenters || allCenters.length === 0)) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    setAttendees([]);

    const fetchForCentre = (centreId) => {
      const params = new URLSearchParams({ centerId: centreId });
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      return fetch(`${apiBaseUrl}/api/nutrition-centers/attendees?${params}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      }).then((res) => res.json());
    };

    if (center?.id) {
      // ── Single-centre mode ──────────────────────────────────────────────
      fetchForCentre(center.id)
        .then((result) => {
          if (cancelled) return;
          if (!result.success) throw new Error(result.error?.message || 'Failed to load attendees');
          debugLog(`✅ [AttendeeListModal] Loaded ${result.data.length} log entries for centre ${center.id}`);
          debugLog('[AttendeeListModal] Sample log entry:', result.data[0]);
          setAttendees(result.data);
        })
        .catch((err) => {
          if (!cancelled) {
            setError('Could not load attendees. Please try again.');
            debugLog('❌ [AttendeeListModal] fetch error:', err.message);
          }
        })
        .finally(() => { if (!cancelled) setLoading(false); });
    } else {
      // ── Summary mode — fetch all centres in parallel and merge ──
      const centresWithAttendance = allCenters.filter((c) => (c.todayAttendance || 0) > 0);
      if (centresWithAttendance.length === 0) {
        setLoading(false);
        return;
      }
      Promise.all(centresWithAttendance.map((c) => fetchForCentre(c.id).catch(() => null)))
        .then((results) => {
          if (cancelled) return;
          const merged = [];
          results.forEach((result) => {
            if (!result?.success) return;
            merged.push(...result.data);
          });
          debugLog(`✅ [AttendeeListModal] Summary: ${merged.length} log entries across ${centresWithAttendance.length} centres`);
          setAttendees(merged);
        })
        .catch((err) => {
          if (!cancelled) {
            setError('Could not load attendees. Please try again.');
            debugLog('❌ [AttendeeListModal] summary fetch error:', err.message);
          }
        })
        .finally(() => { if (!cancelled) setLoading(false); });
    }

    return () => { cancelled = true; };
  }, [isOpen, center?.id, allCenters, startDate, endDate, apiBaseUrl]);

  const toggleUser = (userId) => {
    setExpandedUsers((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  // Group logs by user for display, then sort by first log time ascending (earliest first)
  const groupedAttendees = groupLogsByUser(attendees).sort((a, b) => {
    // Handle null timestamps (users without valid timestamps go last)
    if (!a.firstLogTime && !b.firstLogTime) return 0;
    if (!a.firstLogTime) return 1;
    if (!b.firstLogTime) return -1;
    return new Date(a.firstLogTime) - new Date(b.firstLogTime);
  });
  const uniqueAttendeeCount = groupedAttendees.length;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-50"
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            key="sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl max-h-[75vh] flex flex-col"
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-green-600" />
                <div>
                  <h2 className="font-semibold text-gray-900 text-[15px] leading-tight">
                    {center?.center_name || 'All Centres'}
                  </h2>
                  <p className="text-xs text-gray-500">{dateLabel} Attendees</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-3">
              {loading && (
                <div className="flex justify-center py-8">
                  <LoadingSpinner size="md" />
                </div>
              )}

              {!loading && error && (
                <p className="text-center text-sm text-red-500 py-6">{error}</p>
              )}

              {!loading && !error && attendees.length === 0 && (
                <div className="flex flex-col items-center py-10 text-gray-400">
                  <Users className="w-10 h-10 mb-2" />
                  <p className="text-sm">No attendees yet {dateLabel.toLowerCase()}</p>
                </div>
              )}

              {!loading && !error && groupedAttendees.length > 0 && (
                <ul className="space-y-2">
                  {groupedAttendees.map((user) => {
                    const isExpanded = expandedUsers.has(user.userId);
                    return (
                      <li
                        key={user.userId}
                        className="border border-gray-100 rounded-lg overflow-hidden"
                      >
                        {/* User Header - clickable */}
                        <button
                          onClick={() => toggleUser(user.userId)}
                          className="w-full flex items-center gap-3 py-3 px-3 hover:bg-gray-50 transition-colors text-left"
                        >
                          {/* Avatar circle */}
                          <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                            <span className="text-green-700 font-semibold text-sm">
                              {(user.userName || '?').charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-800 block truncate">{user.userName}</span>
                              {user.firstLogTime && (
                                <span className="text-xs font-semibold text-green-600 shrink-0">
                                  {formatTime(user.firstLogTime)}
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-gray-500">
                              {user.logs.length} {user.logs.length === 1 ? 'log' : 'logs'}
                            </span>
                          </div>
                          {/* Expand/Collapse icon */}
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                          )}
                        </button>

                        {/* Expanded Log Details */}
                        {isExpanded && (
                          <div className="bg-gray-50 px-3 py-2 border-t border-gray-100">
                            <div className="space-y-1.5">
                              {user.logs.map((log, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center justify-between text-xs py-1.5 px-2 bg-white rounded border border-gray-100"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="text-base">{getLogIcon(log.logType)}</span>
                                    <span className="font-medium text-gray-700 capitalize">
                                      {log.logType}
                                    </span>
                                  </div>
                                  <span className="text-gray-500">{formatTime(log.timestamp)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Footer count */}
            {!loading && groupedAttendees.length > 0 && (
              <div className="px-5 py-3 border-t border-gray-100 text-center">
                <span className="text-xs text-gray-500">
                  {uniqueAttendeeCount} {uniqueAttendeeCount === 1 ? 'person' : 'people'} attended {dateLabel.toLowerCase()}
                </span>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default AttendeeListModal;
