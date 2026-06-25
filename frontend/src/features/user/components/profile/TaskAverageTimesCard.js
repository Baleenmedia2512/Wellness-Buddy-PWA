// Displays learned (or default) average completion times per activity.
import React from 'react';
import { Clock3 } from 'lucide-react';

const LABELS = {
  weight: 'Weight Upload',
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  education: 'Education',
  water: 'Water Intake',
};

function formatPgTime(timeStr) {
  if (!timeStr) return '—';
  const [h, m] = String(timeStr).split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const dh = h % 12 || 12;
  return `${dh}:${String(m).padStart(2, '0')} ${period}`;
}

const TaskAverageTimesCard = ({ averages = [], loading = false }) => {
  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
        <div className="animate-pulse h-4 w-40 bg-gray-200 rounded mb-3" />
        <div className="space-y-2">
          <div className="h-3 bg-gray-200 rounded w-full" />
          <div className="h-3 bg-gray-200 rounded w-5/6" />
        </div>
      </div>
    );
  }

  if (!averages.length) return null;

  return (
    <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Clock3 className="w-4 h-4 text-emerald-600" />
        <h3 className="text-sm font-semibold text-emerald-900">Your Usual Times</h3>
      </div>
      <div className="space-y-2">
        {averages.map((row) => {
          const label = LABELS[row.task_type] || row.task_type;
          const displayTime = formatPgTime(row.effective_reminder_time || row.average_completion_time);
          return (
            <div key={row.task_type} className="flex items-center justify-between text-sm">
              <span className="text-gray-700">{label}</span>
              <span className="font-medium text-gray-900">
                {displayTime}
                {!row.is_personalized && row.sample_count > 0 && (
                  <span className="ml-1 text-xs text-gray-500">(default)</span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TaskAverageTimesCard;
