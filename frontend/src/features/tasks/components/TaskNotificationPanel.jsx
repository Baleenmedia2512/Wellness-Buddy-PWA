/**
 * TaskNotificationPanel.jsx — Full-screen task notification overlay
 * 
 * Shown when user returns to home screen with pending tasks
 * Features:
 * - Two tabs: "To Do" and "Completed"
 * - Camera integration for task completion
 * - Real-time updates
 * 
 * Per claude.md §2.3: PascalCase for React components
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import TaskCard from './TaskCard';
import CompletedTaskCard from './CompletedTaskCard';
import ReminderActionBar from './ReminderActionBar';
import { useTaskData } from '../hooks/useTaskData';
import { debugLog } from '../../../shared/utils/logger';

const TaskNotificationPanel = ({ 
  userId, 
  onClose, 
  highlightedTaskId = null,
  onTaskComplete 
}) => {
  const { tasks, loading, refresh } = useTaskData(userId);
  const [activeTab, setActiveTab] = useState('todo');
  
  // Filter tasks by status
  const pendingTasks   = tasks.filter((t) => String(t.status).toLowerCase() === 'pending');
  const completedTasks = tasks.filter(t => t.status === 'completed');

  // True only when the user has actually done some tasks today (not just "no tasks yet")
  const hasDoneTasksToday = completedTasks.length > 0;

  // Auto-close ONLY when user has completed tasks AND none are pending
  // (do NOT auto-close at midnight just because no windows have opened yet)
  useEffect(() => {
    if (!loading && pendingTasks.length === 0 && hasDoneTasksToday && activeTab === 'todo') {
      debugLog('[TaskPanel] All tasks completed — auto-closing in 2 seconds');
      const timer = setTimeout(() => {
        onClose();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [loading, pendingTasks.length, hasDoneTasksToday, activeTab, onClose]);
  
  // Refresh tasks every 60 seconds while panel is open
  useEffect(() => {
    const interval = setInterval(() => {
      debugLog('[TaskPanel] Auto-refreshing tasks');
      refresh();
    }, 60000);
    return () => clearInterval(interval);
  }, [refresh]);
  
  const handleTaskClick = (task) => {
    debugLog('[TaskPanel] Task clicked', { taskId: task.task_id, taskType: task.task_type });
    // #region agent log
    fetch('http://127.0.0.1:7614/ingest/1b02d057-3db7-401f-8265-b89fca49dfb2',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'fbd973'},body:JSON.stringify({sessionId:'fbd973',location:'TaskNotificationPanel.jsx:handleTaskClick',message:'task card clicked',data:{taskId:task.task_id,taskType:task.task_type},timestamp:Date.now(),hypothesisId:'H-camera-gesture',runId:'post-fix-2'})}).catch(()=>{});
    // #endregion
    if (onTaskComplete) {
      onTaskComplete(task);
    }
  };

  /** Called by ReminderActionBar after a successful snooze or dismiss. */
  const handleReminderAction = useCallback((action, meta) => {
    debugLog('[TaskPanel] Reminder action', { action, meta });
    refresh();
  }, [refresh]);
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-white z-[9999] flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-green-500 to-teal-500 shadow-md">
        <div>
          <h2 className="text-xl font-bold text-white">Today's Tasks</h2>
          <p className="text-xs text-green-50">Complete your daily activities</p>
        </div>
        <button
          onClick={onClose}
          className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
          aria-label="Close"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      {/* Tabs */}
      <div className="flex border-b bg-white">
        <button
          onClick={() => setActiveTab('todo')}
          className={`flex-1 py-3 font-semibold transition-all relative ${
            activeTab === 'todo'
              ? 'text-green-600'
              : 'text-gray-500'
          }`}
        >
          <span>To Do ({pendingTasks.length})</span>
          {activeTab === 'todo' && (
            <motion.div
              layoutId="activeTab"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-600"
            />
          )}
        </button>
        <button
          onClick={() => setActiveTab('completed')}
          className={`flex-1 py-3 font-semibold transition-all relative ${
            activeTab === 'completed'
              ? 'text-green-600'
              : 'text-gray-500'
          }`}
        >
          <span>Completed ({completedTasks.length})</span>
          {activeTab === 'completed' && (
            <motion.div
              layoutId="activeTab"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-600"
            />
          )}
        </button>
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-gray-50">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4"></div>
              <p className="text-gray-500">Loading tasks...</p>
            </div>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {activeTab === 'todo' ? (
              <motion.div
                key="todo"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="p-4 space-y-3"
              >
                {pendingTasks.length === 0 ? (
                  hasDoneTasksToday ? (
                    /* All windows opened & completed */
                    <div className="text-center py-16">
                      <div className="text-6xl mb-4">🎉</div>
                      <h3 className="text-xl font-bold text-gray-700 mb-2">All Done!</h3>
                      <p className="text-gray-500">You've completed all your tasks for now</p>
                    </div>
                  ) : (
                    /* No tasks yet — windows haven't opened yet today */
                    <div className="text-center py-16">
                      <div className="text-6xl mb-4">🕐</div>
                      <h3 className="text-xl font-bold text-gray-700 mb-2">No Tasks Yet</h3>
                      <p className="text-gray-500 text-sm px-4">
                        Your daily tasks will appear here once their time windows open.
                        Check back later!
                      </p>
                      <button
                        onClick={refresh}
                        className="mt-4 px-4 py-2 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                      >
                        Refresh
                      </button>
                    </div>
                  )
                ) : (
                  pendingTasks.map((task) => (
                    <div key={task.task_id}>
                      <TaskCard
                        task={task}
                        onClick={() => handleTaskClick(task)}
                        isHighlighted={task.task_id === highlightedTaskId}
                      />
                      {/* Snooze / Don't remind again today actions */}
                      {!task.reminder_dismissed_today && (
                        <ReminderActionBar
                          task={task}
                          userId={userId}
                          onActionComplete={handleReminderAction}
                        />
                      )}
                    </div>
                  ))
                )}
              </motion.div>
            ) : (
              <motion.div
                key="completed"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="p-4 space-y-3"
              >
                {completedTasks.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="text-6xl mb-4">📋</div>
                    <h3 className="text-xl font-bold text-gray-700 mb-2">No Completed Tasks Yet</h3>
                    <p className="text-gray-500">Completed tasks will appear here</p>
                  </div>
                ) : (
                  completedTasks.map((task) => (
                    <CompletedTaskCard
                      key={task.task_id}
                      task={task}
                    />
                  ))
                )}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </motion.div>
  );
};

export default TaskNotificationPanel;
