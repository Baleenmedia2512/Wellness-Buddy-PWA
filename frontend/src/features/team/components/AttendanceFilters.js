/**
 * AttendanceFilters.js — filter primitives for the attendance report.
 *
 * Exports the `filterOptions` constant used by `HierarchicalReportLayout`
 * and the empty-state placeholder that explains why no rows are visible.
 */
import React from 'react';
import { Users } from 'lucide-react';
import { filterOptions } from '../services/attendanceReportFormatter';

export { filterOptions };

export const AttendanceEmptyState = ({ filter, searchQuery }) => {
  let detail = 'No team members to display.';
  if (filter && filter !== 'all') {
    const label = filterOptions.find((f) => f.value === filter)?.label;
    detail = `No members match the "${label}" filter.`;
  } else if (searchQuery) {
    detail = `No members match "${searchQuery}".`;
  }
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
        <Users className="w-8 h-8 text-gray-400" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">No members found</h3>
      <p className="text-sm text-gray-500 max-w-sm">{detail}</p>
    </div>
  );
};

export default AttendanceEmptyState;
