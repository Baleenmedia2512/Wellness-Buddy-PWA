// Editable body metrics (Age, Fat %, V-Fat, Body Age, Chest/Waist/Hip).
// Fat % is required. BMI is calculated from height + weight (BCM formula) — not editable.
import React, { useMemo } from 'react';
import {
  evaluateChestCm,
  evaluateHipCm,
  evaluateVisceralFat,
  evaluateWaistCm,
  getBodyMetricReferences,
} from '../../../body-parameters-card/domain/bodyMetricReferences';
import { computeBmiFromHeightWeight } from '../../domain/bmi';

const inputCls =
  'flex-1 min-w-0 px-3 py-2 border rounded-lg bg-white text-sm font-medium focus:outline-none';

const inputOkCls = `${inputCls} border-gray-200 text-gray-800 focus:border-green-400`;
const inputBadCls = `${inputCls} border-red-400 text-red-600 focus:border-red-400`;

const referenceCls =
  'w-[88px] shrink-0 px-2 py-2 border border-gray-100 rounded-lg bg-white text-[11px] text-gray-500 text-center leading-tight flex items-center justify-center';

const referenceBadCls =
  'w-[88px] shrink-0 px-2 py-2 border border-red-200 rounded-lg bg-red-50 text-[11px] text-red-600 text-center leading-tight flex items-center justify-center';

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

function isMetricOutOfRange(key, metrics) {
  if (key === 'visceralFat') return evaluateVisceralFat(metrics.visceralFat)?.isOutOfRange === true;
  if (key === 'waistCm') return evaluateWaistCm(metrics.waistCm, metrics.gender)?.isOutOfRange === true;
  if (key === 'chestCm') return evaluateChestCm(metrics.chestCm, metrics.gender)?.isOutOfRange === true;
  if (key === 'hipCm') return evaluateHipCm(metrics.hipCm, metrics.gender)?.isOutOfRange === true;
  if (key === 'bmi') {
    const n = parseFloat(metrics.bmi);
    return Number.isFinite(n) && (n < 18.5 || n > 23);
  }
  if (key === 'fatPercent') {
    const g = String(metrics.gender || '').toLowerCase();
    const n = parseFloat(metrics.fatPercent);
    if (!Number.isFinite(n)) return false;
    if (g === 'male') return n < 10 || n > 20;
    if (g === 'female') return n < 20 || n > 30;
    return false;
  }
  if (key === 'bodyAge') {
    const bodyAge = parseFloat(metrics.bodyAge);
    const age = parseFloat(metrics.age);
    return Number.isFinite(bodyAge) && Number.isFinite(age) && bodyAge > age;
  }
  return false;
}

const MetricField = ({
  label, value, reference, inputMode, onChange, readOnly, required, outOfRange,
}) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {label}{required ? <span className="text-red-500"> *</span> : null}
    </label>
    <div className="flex items-stretch gap-2">
      {readOnly ? (
        <div
          className={`${outOfRange ? inputBadCls : inputOkCls} bg-gray-50`}
          aria-readonly="true"
        >
          {value === null || value === undefined || value === '' ? '—' : String(value)}
        </div>
      ) : (
        <input
          type="text"
          inputMode={inputMode}
          value={value == null ? '' : String(value)}
          onChange={(e) => onChange?.(e.target.value)}
          className={outOfRange ? inputBadCls : inputOkCls}
          aria-invalid={outOfRange}
        />
      )}
      {reference ? (
        <div
          className={outOfRange ? referenceBadCls : referenceCls}
          title="Reference range"
        >
          {reference}
        </div>
      ) : null}
    </div>
  </div>
);

/**
 * @param {{
 *   bodyMetrics: object|null,
 *   gender?: string|null,
 *   onChange?: (key: string, value: string) => void,
 *   readOnly?: boolean,
 *   heightCm?: number|string|null,
 *   weightKg?: number|string|null,
 * }} props
 */
const UserProfileBodyMetrics = ({
  bodyMetrics,
  gender = null,
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
    gender: gender || metrics.gender || '',
    bmi: derivedBmi != null ? derivedBmi : (metrics.bmi ?? ''),
  }), [metrics, derivedBmi, gender]);

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
            outOfRange={isMetricOutOfRange(key, displayMetrics)}
            onChange={fieldReadOnly ? undefined : (v) => onChange?.(key, v)}
          />
        ))}
      </div>
    </div>
  );
};

export default UserProfileBodyMetrics;
export { FIELDS as PROFILE_BODY_METRIC_FORM_FIELDS };
