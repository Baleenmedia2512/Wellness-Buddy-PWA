import React from 'react';

const WorkingPhysicalCentreField = ({ value = '', onChange }) => {
  return (
    <div>
      <label
        style={{
          display: 'block',
          marginBottom: '8px',
          fontSize: '16px',
          color: '#374151',
        }}
      >
        Working Physical Centre ID
      </label>

      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%',
          height: '54px',
          padding: '0 16px',
          border: '1px solid #d1d5db',
          borderRadius: '12px',
          fontSize: '16px',
          backgroundColor: '#fff',
          color: value ? '#111827' : '#9ca3af',
        }}
      >
        <option value="" disabled>
          Enter your club ID
        </option>
        <option value="None">None</option>
      </select>
    </div>
  );
};

export default WorkingPhysicalCentreField;