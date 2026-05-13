/**
 * StepCounterChart.js — daily history list with week/month toggle.
 *
 * Pure presentational. Receives the already-sliced `historyData` array
 * plus the live "today" overrides so the most recent row reflects the
 * sensor in real time even when the DB hasn't caught up yet.
 */
import React from 'react';
import { Activity, Calendar, TrendingUp, Flame } from 'lucide-react';
import { toDateKey } from '../services/stepCounterCalculations';

const ViewToggle = ({ historyView, onChange }) => (
  <div className="flex bg-gray-100 rounded-xl p-0.5">
    {['week', 'month'].map((v) => (
      <button key={v} onClick={() => onChange(v)}
        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
          historyView === v ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500'
        }`}>{v === 'week' ? 'Week' : 'Month'}</button>
    ))}
  </div>
);

const SummaryRow = ({ avg, total }) => (
  <div className="grid grid-cols-2 gap-3 pt-1 border-t border-gray-100">
    <div className="bg-gray-50 rounded-xl p-3 text-center">
      <div className="flex items-center justify-center gap-1 mb-1">
        <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
        <p className="text-xs text-gray-500 font-medium">Avg Steps</p>
      </div>
      <p className="text-lg sm:text-xl font-bold text-gray-900">{avg.toLocaleString()}</p>
    </div>
    <div className="bg-gray-50 rounded-xl p-3 text-center">
      <div className="flex items-center justify-center gap-1 mb-1">
        <Flame className="w-3.5 h-3.5 text-rose-400" />
        <p className="text-xs text-gray-500 font-medium">Total Calories</p>
      </div>
      <p className="text-lg sm:text-xl font-bold text-rose-600">{total.toLocaleString()}</p>
    </div>
  </div>
);

const HistoryRow = ({ day, isToday, rowSteps, rowCalories }) => {
  const date = new Date(day.date);
  return (
    <div className={`flex items-center justify-between p-3 rounded-xl transition-colors ${
      isToday ? 'bg-emerald-50 ring-1 ring-emerald-200' : 'bg-gray-50'
    }`}>
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-white font-bold text-xs ${
          isToday ? 'bg-gradient-to-br from-emerald-500 to-teal-500' : 'bg-gray-300'
        }`}>{date.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 2)}</div>
        <div>
          <p className={`text-sm font-semibold ${isToday ? 'text-emerald-900' : 'text-gray-800'}`}>
            {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            {isToday && <span className="ml-1.5 text-xs text-emerald-500 font-medium">Today</span>}
          </p>
          <p className="text-xs text-gray-400">{date.toLocaleDateString('en-US', { weekday: 'long' })}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-sm font-bold text-gray-900">{rowSteps.toLocaleString()}</p>
        <p className="text-xs text-gray-400">{rowCalories} kcal</p>
      </div>
    </div>
  );
};

export default function StepCounterChart({
  historyData, historyView, onHistoryViewChange,
  displaySteps, displayCalories,
}) {
  if (historyData.length === 0) {
    return (
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100/80 p-5 sm:p-7">
        <div className="text-center py-10">
          <Activity className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400 font-medium">No activity data yet</p>
          <p className="text-xs text-gray-300 mt-1">Start walking to see your history</p>
        </div>
      </div>
    );
  }

  const today = toDateKey();
  const sumSteps = historyData.reduce((s, day) => {
    const isToday = toDateKey(new Date(day.date)) === today;
    return s + (isToday ? displaySteps : (day.steps || 0));
  }, 0);
  const sumCalories = historyData.reduce((s, day) => {
    const isToday = toDateKey(new Date(day.date)) === today;
    return s + (isToday ? displayCalories : (day.calories || 0));
  }, 0);
  const avg = Math.round(sumSteps / historyData.length);

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-gray-100/80 p-5 sm:p-7">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-emerald-500" />History
        </h2>
        <ViewToggle historyView={historyView} onChange={onHistoryViewChange} />
      </div>
      <SummaryRow avg={avg} total={Math.round(sumCalories)} />
      <div className="mt-4 space-y-2 max-h-64 sm:max-h-80 overflow-y-auto">
        {[...historyData].reverse().map((day) => {
          const isToday = toDateKey(new Date(day.date)) === today;
          return (
            <HistoryRow key={day.date} day={day} isToday={isToday}
              rowSteps={isToday ? displaySteps : (day.steps || 0)}
              rowCalories={isToday ? displayCalories : (day.calories || 0)} />
          );
        })}
      </div>
    </div>
  );
}
