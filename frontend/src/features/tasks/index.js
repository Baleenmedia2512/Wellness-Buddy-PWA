/**
 * index.js — Public surface of the tasks feature
 * 
 * Per claude.md §2.1: One default export per file, helpers are named exports
 */

export { default as TaskNotificationPanel } from './components/TaskNotificationPanel';
export { default as TaskCard } from './components/TaskCard';
export { default as CompletedTaskCard } from './components/CompletedTaskCard';
export { useTaskData } from './hooks/useTaskData';
export { getTasks, completeTask } from './api/taskApi';
