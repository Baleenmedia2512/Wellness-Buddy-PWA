/**
 * Working Physical Centre ID — free-text club ID typed by the user.
 * Styled to match the Community ID field rendered next to it.
 */
import React from 'react';
import { Hash } from 'lucide-react';

const inputCls =
  'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none';

const WORKING_PHYSICAL_CENTRE_ID_MAX_LENGTH = 100;

const WorkingPhysicalCentreField = ({
  value = '',
  onChange,
}) => {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Working Physical Centre ID
      </label>
      <div className="relative">
        <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          type="text"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          value={value ?? ''}
          onChange={(e) => onChange?.(e.target.value)}
          maxLength={WORKING_PHYSICAL_CENTRE_ID_MAX_LENGTH}
          placeholder="Enter your club ID"
          className={`${inputCls} pl-9 font-mono tracking-wide uppercase`}
          style={{ fontSize: '16px' }}
          aria-label="Working Physical Centre ID"
        />
      </div>
      <p className="text-xs text-gray-500 mt-1">
        Optional club ID of the physical centre you work from. Tap Save Profile after editing.
      </p>
      <p className="text-xs text-gray-400 mt-0.5">
        {(value || '').length}/{WORKING_PHYSICAL_CENTRE_ID_MAX_LENGTH}
      </p>
    </div>
  );
};

export default WorkingPhysicalCentreField;
