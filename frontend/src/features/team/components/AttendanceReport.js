/**
 * AttendanceReport.js — slice orchestrator.
 *
 * Composes `useAttendanceReport` with `AttendanceTable` (the report
 * shell) and `AttendanceSummary` (alert + profile modals). Renders
 * `LoadingSkeleton` while the initial fetch is in flight.
 */
import React from 'react';
import { LoadingSkeleton } from '../../../shared/components/common/HierarchicalReportLayout';
import { useAttendanceReport } from '../hooks/useAttendanceReport';
import AttendanceTable from './AttendanceTable';
import AttendanceSummary from './AttendanceSummary';

const AttendanceReport = ({ user, onBack }) => {
  const vm = useAttendanceReport({ user });
  if (vm.loading) return <LoadingSkeleton />;
  return (
    <>
      <AttendanceTable vm={vm} onBack={onBack} />
      <AttendanceSummary
        alertModal={vm.alertModal}
        onCloseAlert={vm.closeAlert}
        profileModalEmail={vm.profileModalEmail}
        onCloseProfile={() => vm.setProfileModalEmail(null)}
      />
    </>
  );
};

export default AttendanceReport;
