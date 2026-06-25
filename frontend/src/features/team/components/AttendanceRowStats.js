/**
 * AttendanceRowStats.js — pure renderer for the per-row stats strip.
 *
 * Handles the three-column "Self / Direct / Full" layout, the
 * single-column focus modes (sortBy === 'self' | 'direct' | 'full'),
 * and the dual-self layout for co-coach partnerships.
 */
import React from 'react';
import { Check, XCircle, MapPin, Wifi } from 'lucide-react';
import { SelfLogo, DirectLogo, FullTeamLogo } from '../../../shared/components/common/DisciplineScoreLogos';

const AttendedClusters = ({ clubs, remoteCount, size = 'sm' }) => {
  const isLg = size === 'lg';
  const pad = isLg ? 'px-1.5 py-0.5' : 'px-1 py-0.5';
  const iconClass = isLg ? 'h-3 w-3' : 'h-2 w-2';
  const fontClass = isLg ? 'text-[10px]' : 'text-[8px]';
  const checkClass = isLg ? 'w-5 h-5' : 'w-3.5 h-3.5';
  return (
    <div className="flex flex-wrap gap-0.5 justify-center mt-0.5">
      {clubs.length > 0 && (
        <div className={`flex items-center gap-0.5 ${pad} rounded-full bg-green-100 border border-green-300`}>
          <MapPin className={`${iconClass} text-green-700`} />
          <span className={`${fontClass} font-bold text-green-700`}>{clubs.length}</span>
        </div>
      )}
      {remoteCount > 0 && (
        <div className={`flex items-center gap-0.5 ${pad} rounded-full bg-blue-100 border border-blue-300`}>
          <Wifi className={`${iconClass} text-blue-700`} />
          <span className={`${fontClass} font-bold text-blue-700`}>{remoteCount}</span>
        </div>
      )}
      {clubs.length === 0 && remoteCount === 0 && (
        <Check className={`${checkClass} text-green-600`} />
      )}
    </div>
  );
};

const SelfBlock = ({ name, color, attended, clubs, remoteCount }) => (
  <div className="flex-1 flex flex-col items-center pr-1">
    <SelfLogo className={`w-4 h-4 ${color}`} />
    <span className={`text-[9px] font-semibold tracking-wide ${color}`}>{name}</span>
    {attended ? (
      <AttendedClusters clubs={clubs} remoteCount={remoteCount} />
    ) : (
      <XCircle className="w-3.5 h-3.5 text-red-500 mt-0.5" />
    )}
  </div>
);

const SoloSelf = ({ attended, clubs, remoteCount }) => (
  <div className="flex-1 flex flex-col items-center pr-2">
    <SelfLogo className="w-4 h-4 text-blue-600" />
    <span className="text-[10px] font-semibold tracking-wide text-blue-600">SELF</span>
    {attended ? (
      <AttendedClusters clubs={clubs} remoteCount={remoteCount} size="lg" />
    ) : (
      <span className="text-lg font-bold text-red-500">0</span>
    )}
  </div>
);

const FocusBlock = ({ logo: Logo, color, label, value }) => (
  <div className="flex-1 flex flex-col items-center gap-0.5">
    <Logo className={`w-5 h-5 ${color}`} />
    <span className={`text-[8px] font-semibold ${color} uppercase tracking-wide leading-none`}>{label}</span>
    {value}
  </div>
);

export const renderStats = (node, level, isCurrentUser, coCoach = null, sortBy = 'name') => {
  const attended = node.metrics?.attended === true;
  const clubs = node.metrics?.clubs || [];
  const remoteCount = node.metrics?.remoteCount || 0;
  const directQualified = node.directTeamCount?.qualified || 0;
  const directTotal = node.directTeamCount?.total || 0;
  const fullQualified = node.fullTeamCount?.qualified || 0;
  const fullTotal = node.fullTeamCount?.total || 0;
  const isSingle = sortBy !== 'all';

  if (isSingle && sortBy === 'self') {
    return (
      <FocusBlock logo={SelfLogo} color="text-blue-600" label="Self" value={
        attended
          ? <AttendedClusters clubs={clubs} remoteCount={remoteCount} size="lg" />
          : <XCircle className="w-5 h-5 text-red-500 mt-0.5" />
      } />
    );
  }
  if (isSingle && sortBy === 'direct') {
    return (
      <FocusBlock logo={DirectLogo} color="text-green-600" label="Direct" value={
        <span className="text-base sm:text-lg font-bold text-gray-900">{directQualified}/{directTotal}</span>
      } />
    );
  }
  if (isSingle && sortBy === 'full') {
    return (
      <FocusBlock logo={FullTeamLogo} color="text-purple-600" label="Full" value={
        <span className="text-base sm:text-lg font-bold text-gray-900">{fullQualified}/{fullTotal}</span>
      } />
    );
  }

  return (
    <>
      {coCoach ? (
        <>
          <SelfBlock name={node.userName || node.name} color="text-blue-600"
            attended={attended} clubs={clubs} remoteCount={remoteCount} />
          <SelfBlock name={coCoach.userName || coCoach.name} color="text-purple-600"
            attended={coCoach.metrics?.attended === true}
            clubs={coCoach.metrics?.clubs || []}
            remoteCount={coCoach.metrics?.remoteCount || 0} />
        </>
      ) : (
        <SoloSelf attended={attended} clubs={clubs} remoteCount={remoteCount} />
      )}
      <div className="flex-1 flex flex-col items-center px-2">
        <DirectLogo className="w-4 h-4 text-green-600" />
        <span className="text-[10px] font-semibold tracking-wide text-green-600">DIRECT</span>
        <span className="text-sm font-bold text-gray-900">{directQualified}/{directTotal}</span>
      </div>
      <div className="flex-1 flex flex-col items-center pl-2">
        <FullTeamLogo className="w-4 h-4 text-purple-600" />
        <span className="text-[10px] font-semibold tracking-wide text-purple-600">FULL</span>
        <span className="text-sm font-bold text-gray-900">{fullQualified}/{fullTotal}</span>
      </div>
    </>
  );
};
