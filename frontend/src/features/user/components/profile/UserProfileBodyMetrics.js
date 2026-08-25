// Editable body metrics (Age, Fat %, V-Fat, Body Age, Chest/Waist/Hip).
// Fat % is required. BMI is calculated from height + weight (BCM formula) — not editable.
import React, { useMemo } from 'react';
import { getBodyMetricReferences } from '../../../body-parameters-card/domain/bodyMetricReferences';
import { computeBmiFromHeightWeight } from '../../domain/bmi';

const inputCls =
  'flex-1 min-w-0 px-3 py-2 border border-gray-200 rounded-lg bg-white text-gray-800 text-sm font-medium focus:outline-none focus:border-green-400';

const referenceCls =
  'w-[88px] shrink-0 px-2 py-2 border border-gray-100 rounded-lg bg-white text-[11px] text-gray-500 text-center leading-tight flex items-center justify-center';

const FIELDS = [
  { key: 'age', label: 'Age', inputMode: 'numeric' },
  { key: 'fatPercent', label: 'Fat %', inputMode: 'decimal', required: true },
  { key: 'visceralFat', label: 'V-Fat', inputMode: 'decimal' },
  { key: 'bmi', label: 'BMI', inputMode: 'decimal', readOnly: true },
  { key: 'bodyAge', label: 'Body Age', inputMode: 'decimal' },
  { key: 'chestCm', label: 'Chest (cm)', inputMode: 'decimal' },
  { key: 'waistCm', label: 'Waist (cm)', inputMode: 'decimal' },
  { key: 'hipCm', label: 'Hip (cm)', inputMode: 'decimal' },
];

const MetricField = ({ label, value, reference, inputMode, onChange, readOnly, required }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {label}{required ? <span className="text-red-500"> *</span> : null}
    </label>
    <div className="flex items-stretch gap-2">
      {readOnly ? (
        <div className={`${inputCls} bg-gray-50`} aria-readonly="true">
          {value === null || value === undefined || value === '' ? '—' : String(value)}
        </div>
      ) : (
        <input
          type="text"
          inputMode={inputMode}
          value={value == null ? '' : String(value)}
          onChange={(e) => onChange?.(e.target.value)}
          className={inputCls}
        />
      )}
      {reference ? (
        <div className={referenceCls} title="Reference range">
          {reference}
        </div>
      ) : null}
    </div>
  </div>
);

/**
 * @param {{
 *   bodyMetrics: object|null,
 *   onChange?: (key: string, value: string) => void,
 *   readOnly?: boolean,
 *   heightCm?: number|string|null,
 *   weightKg?: number|string|null,
 * }} props
 */
const UserProfileBodyMetrics = ({
  bodyMetrics,
  onChange,
  readOnly = false,
  heightCm = null,
  weightKg = null,
}) => {
  const metrics = bodyMetrics || {};
  const derivedBmi = useMemo(
    () => computeBmiFromHeightWeight(heightCm, weightKg),
    [heightCm, weightKg],
  );

  const displayMetrics = useMemo(() => ({
    ...metrics,
    bmi: derivedBmi != null ? derivedBmi : (metrics.bmi ?? ''),
  }), [metrics, derivedBmi]);

  const references = useMemo(
    () => getBodyMetricReferences(displayMetrics),
    [displayMetrics],
  );

  const hasAnyReference = FIELDS.some(({ key }) => references[key]);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-800">Body Parameters</h3>
      </div>

      {hasAnyReference && (
        <div className="hidden sm:grid grid-cols-[1fr_88px] gap-2 px-0.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Value</span>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 text-center">Reference</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {FIELDS.map(({ key, label, inputMode, required, readOnly: fieldReadOnly }) => (
          <MetricField
            key={key}
            label={label}
            value={displayMetrics[key]}
            reference={references[key]}
            inputMode={inputMode}
            required={Boolean(required)}
            readOnly={readOnly || Boolean(fieldReadOnly)}
            onChange={fieldReadOnly ? undefined : (v) => onChange?.(key, v)}
          />
        ))}
      </div>
    </div>
  );
};

export default UserProfileBodyMetrics;
export { FIELDS as PROFILE_BODY_METRIC_FORM_FIELDS };
