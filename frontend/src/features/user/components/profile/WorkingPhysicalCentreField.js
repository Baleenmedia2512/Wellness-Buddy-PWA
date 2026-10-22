import React from 'react';

const WorkingPhysicalCentreField = ({
  value = '',
  onChange,
}) => {
  const selectedValue = value || 'None';

  return (
    <div className="w-full">
      <label
        htmlFor="workingPhysicalCentreId"
        className="block text-sm font-medium text-gray-700 mb-2"
      >
        Working Physical Centre ID
      </label>

      <select
        id="workingPhysicalCentreId"
        name="workingPhysicalCentreId"
        value={selectedValue}
        onChange={(event) => onChange(event.target.value === 'None' ? '' : event.target.value)}
        className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
      >
        <option value="None">None</option>
      </select>

      <p className="mt-2 text-sm text-gray-500">
        Select your working physical centre ID, or choose None if you do not have one.
      </p>
    </div>
  );
};

export default WorkingPhysicalCentreField;