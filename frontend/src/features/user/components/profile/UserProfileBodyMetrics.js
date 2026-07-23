// Read-only body metrics from body_parameters_cards (coach-recorded).
import React from 'react';
import { Activity } from 'lucide-react';

const readOnlyCls =
  'w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-700';

const displayValue = (value) => {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
};

const MetricField = ({ label, value }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
    <input
      type="text"
      value={displayValue(value)}
      readOnly
      tabIndex={-1}
      className={readOnlyCls}
      style={{ fontSize: '16px' }}
    />
  </div>
);

const FIELDS = [
  { key: 'age', label: 'Age' },
  { key: 'gender', label: 'Gender' },
  { key: 'fatPercent', label: 'Fat %' },
  { key: 'visceralFat', label: 'V-Fat' },
  { key: 'bmi', label: 'BMI' },
  { key: 'bodyAge', label: 'Body Age' },
  { key: 'chestCm', label: 'Chest (cm)' },
  { key: 'waistCm', label: 'Waist (cm)' },
  { key: 'hipCm', label: 'Hip (cm)' },
];

const UserProfileBodyMetrics = ({ bodyMetrics }) => {
  if (!bodyMetrics) return null;

  const hasAny = FIELDS.some(({ key }) => {
    const value = bodyMetrics[key];
    return value !== null && value !== undefined && value !== '';
  });
  if (!hasAny) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Activity className="w-4 h-4 text-indigo-500" />
        <h3 className="text-sm font-semibold text-gray-800">Body Parameters</h3>
      </div>
      <p className="text-xs text-gray-500">
        Recorded by your coach. These values are read-only here.
      </p>
      <div className="grid grid-cols-2 gap-3">
        {FIELDS.map(({ key, label }) => (
          <MetricField key={key} label={label} value={bodyMetrics[key]} />
        ))}
      </div>
    </div>
  );
};

export default UserProfileBodyMetrics;
