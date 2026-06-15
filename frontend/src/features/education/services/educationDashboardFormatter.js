/**
 * educationDashboardFormatter.js — pure derivation helpers.
 *
 * Hosts grouping (monthly + per-month stats), persona detection, and
 * trend-series construction used by the dashboard tabs. Behavior
 * preserved verbatim from the legacy `EducationDashboard.js`.
 */
import { Sun, Sunset, Moon } from 'lucide-react';
import React from 'react';
import { istToLocalDate } from '../../../shared/utils/timezoneUtils';

export const toDateKey = (value) => {
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const isSmallChartDevice = () =>
  typeof window !== 'undefined' && window.innerWidth < 380;

/**
 * Filter education logs to a single calendar day (matches the day the
 * log is displayed under, i.e. its IST-local date). Returns the full
 * list when `selectedDate` is falsy. Pure — no IO.
 */
export const filterLogsByDay = (logs, selectedDate) => {
  if (!selectedDate) return logs || [];
  const target = toDateKey(selectedDate);
  return (logs || []).filter((log) => {
    if (!log || !log.CreatedAt) return false;
    const d = istToLocalDate(log.CreatedAt);
    return d && !isNaN(d.getTime()) && toDateKey(d) === target;
  });
};

export const buildMonthlyGroups = (logs) => {
  const grouped = {};
  logs.forEach((log) => {
    if (!log || !log.CreatedAt) return;
    const date = istToLocalDate(log.CreatedAt);
    if (!date || isNaN(date.getTime())) return;
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (!grouped[monthKey]) {
      grouped[monthKey] = {
        monthKey,
        monthName: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        entries: [],
        sortDate: new Date(date.getFullYear(), date.getMonth(), 1),
      };
    }
    grouped[monthKey].entries.push(log);
  });
  return Object.values(grouped).sort((a, b) => b.sortDate - a.sortDate);
};

export const getMonthStats = (entries) => {
  if (!entries || entries.length === 0) return null;
  const platforms = {};
  entries.forEach((log) => {
    platforms[log.Platform] = (platforms[log.Platform] || 0) + 1;
  });
  const mostUsedPlatform = Object.keys(platforms).reduce(
    (a, b) => (platforms[a] > platforms[b] ? a : b),
    Object.keys(platforms)[0],
  );
  return { count: entries.length, mostUsedPlatform, platforms: Object.keys(platforms).length };
};

const PERSONAS = {
  morning: { text: 'Morning Learner', style: 'bg-orange-50 text-orange-700 border-orange-100', Icon: Sun },
  afternoon: { text: 'Daytime Achiever', style: 'bg-yellow-50 text-yellow-700 border-yellow-100', Icon: Sun },
  evening: { text: 'Evening Scholar', style: 'bg-purple-50 text-purple-700 border-purple-100', Icon: Sunset },
  night: { text: 'Night Owl', style: 'bg-indigo-50 text-indigo-700 border-indigo-100', Icon: Moon },
};

export const detectPersona = (logs) => {
  if (!logs || logs.length === 0) return null;
  const slots = { morning: 0, afternoon: 0, evening: 0, night: 0 };
  logs.forEach((log) => {
    const hour = istToLocalDate(log.CreatedAt).getHours();
    if (hour >= 5 && hour < 12) slots.morning++;
    else if (hour >= 12 && hour < 17) slots.afternoon++;
    else if (hour >= 17 && hour < 22) slots.evening++;
    else slots.night++;
  });
  const max = Object.keys(slots).reduce((a, b) => (slots[a] > slots[b] ? a : b));
  const persona = PERSONAS[max] || PERSONAS.night;
  return {
    text: persona.text,
    style: persona.style,
    icon: <persona.Icon className="w-3.5 h-3.5" />,
  };
};

export const buildTrendSeries = (logs, rangeDays) => {
  if (!logs || logs.length === 0) return [];
  const countByDate = new Map();
  logs.forEach((log) => {
    if (!log || !log.CreatedAt || log.isUndoPlaceholder) return;
    const key = toDateKey(log.CreatedAt);
    countByDate.set(key, (countByDate.get(key) || 0) + 1);
  });
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setDate(today.getDate() - (rangeDays - 1));
  const points = [];
  for (let i = 0; i < rangeDays; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = toDateKey(d);
    points.push({
      key,
      date: d,
      label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      compactLabel: `${d.toLocaleDateString('en-US', { month: 'short' }).slice(0, 1)} ${d.toLocaleDateString('en-US', { day: 'numeric' })}`,
      value: countByDate.get(key) || 0,
    });
  }
  return points;
};

export const buildWeekDays = (summary, logs) => {
  const today = new Date();
  const activeDates = summary?.last7DaysDates
    ? summary.last7DaysDates.map((d) => new Date(d).toDateString())
    : (logs || []).map((log) => istToLocalDate(log.CreatedAt).toDateString());
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push({
      i,
      hasLog: activeDates.includes(d.toDateString()),
      isToday: i === 0,
      label: d.toLocaleDateString('en-US', { weekday: 'narrow' }),
    });
  }
  return days;
};
