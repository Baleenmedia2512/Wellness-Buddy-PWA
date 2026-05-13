/**
 * AttendanceRowStatus.js — pure renderers for the status badge and the
 * expanded attended-locations detail strip.
 *
 * Both functions return JSX consumed by `HierarchicalNode` callbacks.
 */
import React from 'react';
import { Check, XCircle, MapPin, Wifi } from 'lucide-react';

const Pill = ({ tone, icon: Icon, children }) => (
  <div className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full ${tone}`}>
    <Icon className="h-2.5 w-2.5 flex-shrink-0" />
    <span className="text-[9px] font-semibold whitespace-nowrap">{children}</span>
  </div>
);

export const renderStatus = (node) => {
  const attended = node.metrics?.attended === true;
  const clubs = node.metrics?.clubs || [];
  const remoteCount = node.metrics?.remoteCount || 0;
  if (!attended) {
    return (
      <Pill tone="bg-red-50 border border-red-200 text-red-500" icon={XCircle}>
        Not Attended
      </Pill>
    );
  }
  if (clubs.length + remoteCount > 1) {
    return (
      <Pill tone="bg-green-50 border border-green-300 text-green-700" icon={MapPin}>
        {`${clubs.length + remoteCount} locations`}
      </Pill>
    );
  }
  if (clubs.length === 1) {
    return (
      <Pill tone="bg-green-50 border border-green-300 text-green-700" icon={MapPin}>
        {clubs[0].name}
      </Pill>
    );
  }
  if (remoteCount === 1) {
    return (
      <Pill tone="bg-blue-50 border border-blue-300 text-blue-600" icon={Wifi}>
        Remote
      </Pill>
    );
  }
  return (
    <Pill tone="bg-green-50 border border-green-300 text-green-700" icon={Check}>
      Attended
    </Pill>
  );
};

export const renderExpandedDetails = (node, level, isCurrentUser) => {
  const clubs = node.metrics?.clubs || [];
  const remoteCount = node.metrics?.remoteCount || 0;
  if (clubs.length + remoteCount <= 1) return null;
  return (
    <div
      className={`px-3 py-2 space-y-1.5 ${isCurrentUser ? 'bg-yellow-50' : 'bg-green-50'}`}
    >
      {clubs.map((club, idx) => (
        <div
          key={`club-${idx}`}
          className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white border border-green-200"
        >
          <MapPin className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
          <span className="text-xs font-medium text-gray-800">{club.name}</span>
        </div>
      ))}
      {remoteCount > 0 && (
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white border border-blue-200">
          <Wifi className="h-3.5 w-3.5 text-blue-600 flex-shrink-0" />
          <span className="text-xs font-medium text-gray-800">Remote</span>
        </div>
      )}
    </div>
  );
};
