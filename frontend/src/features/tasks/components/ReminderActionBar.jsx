/**
 * ReminderActionBar.jsx — Snooze / Dismiss action bar for a pending task card
 *
 * Renders three actions beneath a task:
 *   • Snooze   — dropdown: 15 min | 30 min | 1 hour
 *   • Dismiss  — soft close ("remind me next window")
 *   • Don't Remind Again Today — hard dismiss for today
 *
 * Per claude.md §2.3: PascalCase component, single default export.
 * Per claude.md §2.5: UI state (open dropdown) is local useState.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { snoozeTask, dismissTask } from '../api/taskApi';
import { scheduleSnooze, cancelSnooze } from '../../../shared/services/reminderService';
import { debugLog } from '../../../shared/utils/logger';

/** Snooze options exposed to the user. */
const SNOOZE_OPTIONS = [
  { label: '15 minutes', value: 15 },
  { label: '30 minutes', value: 30 },
  { label: '1 hour',     value: 60 }
];

/**
 * @param {Object}   props
 * @param {Object}   props.task                  - Task object (task_id, task_type, …)
 * @param {Function} props.onActionComplete       - Called after any successful action so the
 *                                                  parent can refresh the task list.
 * @param {string}   props.userId                 - Authenticated user id (same as task list).
 */
const ReminderActionBar = ({ task, userId, onActionComplete }) => {
  const [snoozeOpen, setSnoozeOpen]   = useState(false);
  const [loading, setLoading]         = useState(false);
  const [errorMsg, setErrorMsg]       = useState(null);

  const handleSnooze = async (minutes) => {
    setSnoozeOpen(false);
    setLoading(true);
    setErrorMsg(null);
    try {
      debugLog('[ReminderActionBar] Snoozing task', { taskId: task.task_id, minutes });

      // 1. Persist snooze state to backend (source of truth)
      const result = await snoozeTask(task.task_id, minutes, userId);
      if (!result.ok) {
        setErrorMsg(result.error?.message || 'Could not snooze task');
        return;
      }

      // 2. Schedule a one-shot native local alarm as a fallback for when the
      //    app is in the background (Android AlarmManager / iOS UNTimeInterval).
      //    cancelSnooze is called first to avoid duplicate notifications.
      await cancelSnooze(task.task_id);
      await scheduleSnooze(task.task_id, task.task_type, task.task_type, minutes);

      onActionComplete?.('snoozed', { taskId: task.task_id, minutes });
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      debugLog('[ReminderActionBar] Dismissing task', { taskId: task.task_id });

      // 1. Persist dismiss to backend
      const result = await dismissTask(task.task_id, userId);
      if (!result.ok) {
        setErrorMsg(result.error?.message || 'Could not dismiss task');
        return;
      }

      // 2. Also cancel any pending native snooze alarm so it doesn't fire later
      await cancelSnooze(task.task_id);

      onActionComplete?.('dismissed', { taskId: task.task_id });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-2 flex items-center gap-2 flex-wrap">
      {/* ── Snooze ── */}
      <div className="relative">
        <button
          disabled={loading}
          onClick={() => setSnoozeOpen((prev) => !prev)}
          className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full
                     bg-amber-50 text-amber-700 border border-amber-200
                     hover:bg-amber-100 disabled:opacity-50 transition-colors"
          aria-haspopup="listbox"
          aria-expanded={snoozeOpen}
        >
          <span>⏰</span>
          <span>Snooze</span>
          <svg
            className={`w-3 h-3 transition-transform ${snoozeOpen ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        <AnimatePresence>
          {snoozeOpen && (
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

      {/* ── Don't Remind Again Today ── */}
      <button
        disabled={loading}
        onClick={handleDismiss}
        className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full
                   bg-gray-50 text-gray-500 border border-gray-200
                   hover:bg-gray-100 disabled:opacity-50 transition-colors"
      >
        <span>🔕</span>
        <span>Don't remind again today</span>
      </button>

      {/* ── Inline error ── */}
      {errorMsg && (
        <p className="w-full text-xs text-red-500 mt-1">{errorMsg}</p>
      )}
    </div>
  );
};

export default ReminderActionBar;
