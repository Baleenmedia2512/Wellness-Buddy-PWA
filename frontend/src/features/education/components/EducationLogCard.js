/**
 * EducationLogCard.js — slice-level container.
 * Visible "Education Logged" success card. Share capture lives in
 * `useEducationShare`; the off-screen capture surface is `EducationShareCard`.
 */
import React from 'react';
import EducationLogContent from './EducationLogContent';
import EducationShareCard from './EducationShareCard';
import { useEducationShare } from '../hooks/useEducationShare';

const EducationLogCard = ({
  educationData, imagePreview, user,
  savedUserName, savedProfileImage, sharePhotoBase64,
}) => {
  const { shareRef } = useEducationShare({
    educationData,
    imagePreview,
    deps: [savedProfileImage, sharePhotoBase64],
  });

  if (!educationData) return null;

  return (
    <>
      <EducationShareCard
        shareRef={shareRef}
        educationData={educationData}
        imagePreview={imagePreview}
        user={user}
        savedUserName={savedUserName}
        savedProfileImage={savedProfileImage}
        sharePhotoBase64={sharePhotoBase64}
      />

      <div className="bg-white rounded-2xl shadow-xl shadow-purple-100/50 p-6 mb-6 animate-slideInUp border border-purple-50 relative">
        <EducationLogContent
          educationData={educationData}
          headline="You're building a great learning habit!"
          successMessage="Your session has been verified and saved"
        />
      </div>
    </>
  );
};

export default EducationLogCard;
