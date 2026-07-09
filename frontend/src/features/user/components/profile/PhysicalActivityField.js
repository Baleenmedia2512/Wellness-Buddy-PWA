// Physical activity level picker — reused in onboarding and profile.
import React from 'react';
import { PHYSICAL_ACTIVITY_OPTIONS } from '../../../shared/utils/tdeeCalculations.js';

const selectCls =
  'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none bg-white';

export default function PhysicalActivityField({ value, onChange }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
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
            {option.label} — {option.description}
          </option>
        ))}
      </select>
      <p className="text-xs text-gray-400 mt-1">
        Used to calculate your daily calorie target (TDEE = BMR + activity + TEF).
      </p>
    </div>
  );
}
