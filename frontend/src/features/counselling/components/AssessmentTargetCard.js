/**
 * AssessmentTargetCard.js — presentational.
 * Shows the small "Assessment For" info card at the top of the form.
 */
import React from 'react';

export default function AssessmentTargetCard({ targetMember, counsellor, todayLabel }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
      <h3 className="text-xs sm:text-sm font-medium text-gray-700 mb-2 sm:mb-3">
        Assessment For
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-xs sm:text-sm">
        <div className="flex flex-wrap items-baseline gap-1">
          <span className="text-gray-500">Name:</span>
          <span className="font-medium break-words">
            {targetMember?.userName || targetMember?.name || 'N/A'}
          </span>
        </div>
        <div className="flex flex-wrap items-baseline gap-1">
          <span className="text-gray-500">Email:</span>
          <span className="font-medium break-all text-xs">
            {targetMember?.userEmail || targetMember?.email || 'N/A'}
          </span>
        </div>
        <div className="flex flex-wrap items-baseline gap-1">
          <span className="text-gray-500">Counsellor:</span>
          <span className="font-medium break-words">
            {counsellor?.name || counsellor?.email}
          </span>
        </div>
        <div className="flex flex-wrap items-baseline gap-1">
          <span className="text-gray-500">Date:</span>
          <span className="font-medium">{todayLabel}</span>
        </div>
      </div>
    </div>
  );
}
