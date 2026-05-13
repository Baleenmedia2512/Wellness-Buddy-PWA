/**
 * AttendanceSummary.js — feedback surfaces for the attendance report.
 *
 * Renders the global alert modal (download outcomes / errors) and the
 * team-member profile modal triggered from row avatars.
 */
import React from 'react';
import CustomAlertModal from '../../../shared/components/CustomAlertModal';
import { TeamMemberProfileModal } from '../../user';

const AttendanceSummary = ({ alertModal, onCloseAlert, profileModalEmail, onCloseProfile }) => (
  <>
    <CustomAlertModal
      isOpen={alertModal.isOpen}
      onClose={onCloseAlert}
      title={alertModal.title}
      message={alertModal.message}
      type={alertModal.type}
      confirmText={alertModal.confirmText}
      cancelText={alertModal.cancelText}
      onConfirm={alertModal.onConfirm}
      onCancel={alertModal.onCancel}
    />
    <TeamMemberProfileModal
      isOpen={!!profileModalEmail}
      onClose={onCloseProfile}
      memberEmail={profileModalEmail}
    />
  </>
);

export default AttendanceSummary;
