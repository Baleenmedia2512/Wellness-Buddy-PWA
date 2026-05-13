/**
 * EducationSummaryCards.js — streak / persona / week-activity card.
 *
 * Pure presentational summary slide rendered inside the swipeable
 * dashboard header.
 */
import React from 'react';
import { Flame, Check } from 'lucide-react';
import { detectPersona, buildWeekDays } from '../services/educationDashboardFormatter';

const StreakBlock = ({ summary, summaryLoading }) => (
  <div>
    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Current Streak</p>
    <div className="flex items-center gap-2">
      <h3 className="text-3xl font-bold text-gray-900 tracking-tight">
        {summaryLoading
          ? <div className="w-12 h-9 bg-gray-200 rounded animate-pulse" />
          : (summary?.currentStreak || 0)}
      </h3>
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-50 text-orange-500">
        <Flame className="w-5 h-5 fill-orange-500" />
      </div>
    </div>
    <p className="text-xs text-gray-400 mt-1">days in a row</p>
  </div>
);

const PersonaBadge = ({ persona }) => persona && (
  <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border ${persona.style}`}>
    {persona.icon}
    <span className="text-xs font-semibold">{persona.text}</span>
  </div>
);

const WeekStrip = ({ summary, summaryLoading, educationLogs }) => {
  const days = buildWeekDays(summary, educationLogs);
  return (
    <div>
      <div className="flex justify-between items-end mb-2">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Week</p>
        <p className="text-[10px] font-medium text-gray-400">
          {summaryLoading
            ? <span className="inline-block w-12 h-3 bg-gray-200 rounded animate-pulse" />
            : `${summary?.last7DaysCount || 0} sessions`}
        </p>
      </div>
      <div className="flex justify-between items-center gap-2">
        {days.map(({ i, hasLog, isToday, label }) => (
          <div key={i} className="flex flex-col items-center gap-1.5 flex-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-500 ${
              hasLog
                ? 'bg-gradient-to-tr from-green-500 to-emerald-400 shadow-lg shadow-green-500/40 ring-2 ring-green-100 scale-105'
                : 'bg-gray-100/80'
            }`}>
              {hasLog && <Check className="w-4 h-4 text-white drop-shadow-md" strokeWidth={3} />}
            </div>
            <span className={`text-[10px] font-medium ${
              hasLog ? 'text-emerald-600 font-bold' : isToday ? 'text-gray-500' : 'text-gray-400'
            }`}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const EducationSummaryCards = React.forwardRef(({ summary, summaryLoading, educationLogs }, ref) => {
  const persona = educationLogs.length > 0 ? detectPersona(educationLogs) : null;
  return (
    <div ref={ref} className="w-1/2 shrink-0 px-4 md:px-5 pb-4 md:pb-5">
      <div className="flex justify-between items-start mb-6">
        <StreakBlock summary={summary} summaryLoading={summaryLoading} />
        <PersonaBadge persona={persona} />
      </div>
      <WeekStrip summary={summary} summaryLoading={summaryLoading} educationLogs={educationLogs} />
    </div>
  );
});

export default EducationSummaryCards;
