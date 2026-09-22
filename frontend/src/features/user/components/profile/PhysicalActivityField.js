// Physical activity level picker — reused in onboarding and profile.
import React, { useMemo } from 'react';
import { PHYSICAL_ACTIVITY_OPTIONS } from '../../../../shared/utils/tdeeCalculations.js';

const selectCls =
  'w-full min-w-0 max-w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none bg-white';

const DEFAULT_LABEL_CLS = 'block text-sm font-medium text-gray-700 mb-1';

export default function PhysicalActivityField({ value, onChange, labelClassName }) {
  const selected = useMemo(
    () => PHYSICAL_ACTIVITY_OPTIONS.find((o) => o.id === value) || null,
    [value],
  );

  return (
    <div className="min-w-0 max-w-full">
      <label className={labelClassName || DEFAULT_LABEL_CLS}>
        Physical Activity
      </label>
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className={selectCls}
        style={{ fontSize: '16px' }}
      >
        <option value="">Select activity level</option>
        {PHYSICAL_ACTIVITY_OPTIONS.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
      {selected ? (
        <p className="text-xs text-gray-600 mt-1.5 leading-snug">
          {selected.description}
        </p>
      ) : (
        <p className="text-xs text-gray-400 mt-1.5 leading-snug">
          Choose how active you are day to day. This sets your daily calorie target (TDEE).
        </p>
      )}
    </div>
  );
}
