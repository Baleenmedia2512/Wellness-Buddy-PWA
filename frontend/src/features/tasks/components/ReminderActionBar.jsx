/**
 * ReminderActionBar.jsx — Snooze / Dismiss action bar for a pending task card
 *
 * Renders four actions beneath a task:
 *   • Snooze   — dropdown: 5 min | 10 min
 *   • Dismiss  — close reminder for now (task stays pending)
 *   • Don't Remind Again Today — hard dismiss for today
 *
 * Per claude.md §2.3: PascalCase component, single default export.
 * Per claude.md §2.5: UI state (open dropdown) is local useState.
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { snoozeTask, dismissTask } from '../api/taskApi';
import { scheduleSnooze, cancelSnooze } from '../../../shared/services/reminderService';
import { debugLog } from '../../../shared/utils/logger';

/** Snooze options exposed to the user. */
const SNOOZE_OPTIONS = [
  { label: '5 minutes',  value: 5 },
  { label: '10 minutes', value: 10 },
];

function isSnoozeActive(task) {
  if (!task?.snoozed_until) return false;
  return new Date(task.snoozed_until) > new Date();
}

function formatSnoozeLabel(minutes) {
  return `${minutes} min`;
}

/**
 * @param {Object}   props
 * @param {Object}   props.task                  - Task object (task_id, task_type, …)
 * @param {Function} props.onActionComplete       - Called after any successful action so the
 *                                                  parent can refresh the task list.
 * @param {string}   props.userId                 - Authenticated user id (same as task list).
 * @param {Function} props.onSoftDismiss           - Called when user dismisses this reminder only.
 * @param {boolean}  props.isSoftDismissed         - Hide actions after soft dismiss.
 */
const ReminderActionBar = ({ task, userId, onActionComplete, onSoftDismiss, isSoftDismissed = false }) => {
  const [snoozeOpen, setSnoozeOpen]   = useState(false);
  const [loading, setLoading]         = useState(false);
  const [errorMsg, setErrorMsg]       = useState(null);
  const [successMsg, setSuccessMsg]   = useState(null);
  const [activeSnoozeMins, setActiveSnoozeMins] = useState(null);

  const snoozeActive = isSnoozeActive(task) || activeSnoozeMins != null;

  useEffect(() => {
    if (!isSnoozeActive(task)) {
      setActiveSnoozeMins(null);
      setSuccessMsg(null);
    }
  }, [task?.snoozed_until, task?.task_id]);

  const snoozeButtonLabel = (() => {
    if (activeSnoozeMins) return `${formatSnoozeLabel(activeSnoozeMins)} ✓`;
    if (isSnoozeActive(task)) return 'Snoozed ✓';
    return 'Snooze';
  })();

  const handleSnooze = async (minutes) => {
    setSnoozeOpen(false);
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      debugLog('[ReminderActionBar] Snoozing task', { taskId: task.task_id, minutes });

      const result = await snoozeTask(task.task_id, minutes, userId);
      if (!result.ok) {
        const detail = Array.isArray(result.error?.details)
          ? result.error.details.join(' ')
          : null;
        setErrorMsg(detail || result.error?.message || 'Could not snooze task');
        return;
      }

      await cancelSnooze(task.task_id);
      await scheduleSnooze(task.task_id, task.task_type, task.task_type, minutes);

      setActiveSnoozeMins(minutes);
      setSuccessMsg(`Snoozed for ${formatSnoozeLabel(minutes)} ✓`);

      onActionComplete?.('snoozed', { taskId: task.task_id, minutes });
    } finally {
      setLoading(false);
    }
  };

  const handleSoftDismiss = () => {
    debugLog('[ReminderActionBar] Soft dismiss', { taskId: task.task_id });
    onSoftDismiss?.(task.task_id);
  };

  const handleDontRemindToday = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      debugLog('[ReminderActionBar] Don\'t remind again today', { taskId: task.task_id });

      const result = await dismissTask(task.task_id, userId);
      if (!result.ok) {
        setErrorMsg(result.error?.message || 'Could not update reminder settings');
        return;
      }

      await cancelSnooze(task.task_id);

      onActionComplete?.('dismissed-today', { taskId: task.task_id });
    } finally {
      setLoading(false);
    }
  };

  if (isSoftDismissed) {
    return null;
  }

  return (
    <div className="mt-2 flex items-center gap-2 flex-wrap">
      {/* ── Snooze ── */}
      <div className="relative">
        <button
          disabled={loading}
          onClick={() => !snoozeActive && setSnoozeOpen((prev) => !prev)}
          className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-full border transition-colors disabled:opacity-50 ${
            snoozeActive
              ? 'bg-green-50 text-green-700 border-green-200'
              : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
          }`}
          aria-haspopup="listbox"
          aria-expanded={snoozeOpen}
        >
          <span>{snoozeActive ? '✓' : '⏰'}</span>
          <span>{snoozeButtonLabel}</span>
          {!snoozeActive && (
            <svg
              className={`w-3 h-3 transition-transform ${snoozeOpen ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          )}
        </button>

        <AnimatePresence>
          {snoozeOpen && !snoozeActive && (
            <motion.ul
              role="listbox"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.12 }}
              className="absolute left-0 top-full mt-1 z-50 bg-white border border-gray-200
                         rounded-lg shadow-lg overflow-hidden w-36"
            >
              {SNOOZE_OPTIONS.map(({ label, value }) => (
                <li key={value}>
                  <button
                    onClick={() => handleSnooze(value)}
                    className="w-full text-left px-3 py-2 text-xs text-gray-700
                               hover:bg-amber-50 transition-colors"
                  >
                    {label}
                  </button>
                </li>
              ))}
            </motion.ul>
          )}
        </AnimatePresence>
      </div>

      {/* ── Dismiss (current reminder only) ── */}
      <button
        disabled={loading}
        onClick={handleSoftDismiss}
        className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full
                   bg-white text-gray-600 border border-gray-200
                   hover:bg-gray-50 disabled:opacity-50 transition-colors"
      >
        <span>✕</span>
        <span>Dismiss</span>
      </button>

      {/* ── Don't Remind Again Today ── */}
      <button
        disabled={loading}
        onClick={handleDontRemindToday}
        className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full
                   bg-gray-50 text-gray-500 border border-gray-200
                   hover:bg-gray-100 disabled:opacity-50 transition-colors"
      >
        <span>🔕</span>
        <span>Don't remind again today</span>
      </button>

      {/* ── Inline feedback ── */}
      {successMsg && (
        <p className="w-full text-xs text-green-600 mt-1 font-medium">{successMsg}</p>
      )}
      {errorMsg && (
        <p className="w-full text-xs text-red-500 mt-1">{errorMsg}</p>
      )}
    </div>
  );
};

export default ReminderActionBar;
