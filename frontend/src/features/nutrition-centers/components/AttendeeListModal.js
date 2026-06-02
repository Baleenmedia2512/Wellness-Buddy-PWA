import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Users } from 'lucide-react';
import LoadingSpinner from '../../../shared/components/LoadingSpinner';
import { debugLog } from '../../../shared/utils/logger.js';

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
          debugLog(`✅ [AttendeeListModal] Loaded ${result.data.length} attendees for centre ${center.id}`);
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
      // ── Summary mode — fetch all centres in parallel and de-duplicate ──
      const centresWithAttendance = allCenters.filter((c) => (c.todayAttendance || 0) > 0);
      if (centresWithAttendance.length === 0) {
        setLoading(false);
        return;
      }
      Promise.all(centresWithAttendance.map((c) => fetchForCentre(c.id).catch(() => null)))
        .then((results) => {
          if (cancelled) return;
          const seen = new Set();
          const merged = [];
          results.forEach((result) => {
            if (!result?.success) return;
            result.data.forEach((a) => {
              if (!seen.has(a.userId)) {
                seen.add(a.userId);
                merged.push(a);
              }
            });
          });
          debugLog(`✅ [AttendeeListModal] Summary: ${merged.length} unique attendees across ${centresWithAttendance.length} centres`);
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

              {!loading && !error && attendees.length > 0 && (
                <ul className="space-y-2">
                  {attendees.map((a, idx) => (
                    <li
                      key={a.userId}
                      className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0"
                    >
                      {/* Avatar circle */}
                      <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                        <span className="text-green-700 font-semibold text-xs">
                          {(a.userName || '?').charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <span className="text-sm text-gray-800">{a.userName}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Footer count */}
            {!loading && attendees.length > 0 && (
              <div className="px-5 py-3 border-t border-gray-100 text-center">
                <span className="text-xs text-gray-500">
                  {attendees.length} {attendees.length === 1 ? 'person' : 'people'} attended {dateLabel.toLowerCase()}
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
