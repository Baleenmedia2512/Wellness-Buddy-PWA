// Read-only body metrics from body_parameters_cards (coach-recorded).
import React, { useMemo } from 'react';
import { Activity } from 'lucide-react';
import { getBodyMetricReferences } from '../../../body-parameters-card/domain/bodyMetricReferences';

const valueCls =
  'flex-1 min-w-0 px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-800 text-sm font-medium';

const referenceCls =
  'w-[88px] shrink-0 px-2 py-2 border border-gray-100 rounded-lg bg-white text-[11px] text-gray-500 text-center leading-tight flex items-center justify-center';

const displayValue = (value) => {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
};

const hasValue = (value) => value !== null && value !== undefined && value !== '';

const FIELDS = [
  { key: 'age', label: 'Age' },
  // gender is edited on the main profile form and synced to both tables
  { key: 'fatPercent', label: 'Fat %' },
  { key: 'visceralFat', label: 'V-Fat' },
  { key: 'bmi', label: 'BMI' },
  { key: 'bodyAge', label: 'Body Age' },
  { key: 'chestCm', label: 'Chest (cm)' },
  { key: 'waistCm', label: 'Waist (cm)' },
  { key: 'hipCm', label: 'Hip (cm)' },
];

const MetricField = ({ label, value, reference }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
    <div className="flex items-stretch gap-2">
      <div className={valueCls} aria-readonly="true">
        {displayValue(value)}
      </div>
      {reference ? (
        <div className={referenceCls} title="Reference range">
          {reference}
        </div>
      ) : null}
    </div>
  </div>
);

const UserProfileBodyMetrics = ({ bodyMetrics }) => {
  const references = useMemo(
    () => getBodyMetricReferences(bodyMetrics),
    [bodyMetrics],
  );

  if (!bodyMetrics) return null;

  const populatedFields = FIELDS.filter(({ key }) => hasValue(bodyMetrics[key]));
  if (populatedFields.length === 0) return null;

  const hasAnyReference = populatedFields.some(({ key }) => references[key]);

  return (
    <div className="space-y-4">
      {/* <div className="flex items-center gap-2">
        <Activity className="w-4 h-4 text-indigo-500" />
        <h3 className="text-sm font-semibold text-gray-800">Body Parameters</h3>
      </div>
      <p className="text-xs text-gray-500">
        Recorded by your sponsor. These values are read-only here.
      </p> */}

      {hasAnyReference && (
        <div className="hidden sm:grid grid-cols-[1fr_88px] gap-2 px-0.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Value</span>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 text-center">Reference</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {populatedFields.map(({ key, label }) => (
          <MetricField
            key={key}
            label={label}
            value={bodyMetrics[key]}
            reference={references[key]}
          />
        ))}
      </div>
    </div>
  );
};

export default UserProfileBodyMetrics;
