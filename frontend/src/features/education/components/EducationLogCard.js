/**
 * EducationLogCard.js — slice-level container.
 * Visible "Education Logged" success card. Share capture lives in
 * `useEducationShare`; the off-screen capture surface is `EducationShareCard`.
 */
import React from 'react';
import { Share2 } from 'lucide-react';
import EducationLogContent from './EducationLogContent';
import EducationShareCard from './EducationShareCard';
import { useEducationShare } from '../hooks/useEducationShare';

const EducationLogCard = ({
  educationData, imagePreview, user,
  savedUserName, savedProfileImage, sharePhotoBase64,
}) => {
  const { shareRef, isSharing, handleShare } = useEducationShare({
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

        {imagePreview && (
          <button
            onClick={handleShare}
            disabled={isSharing}
            className={`w-full mt-6 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-all duration-200 shadow-md ${
              isSharing ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-lg active:scale-[0.98]'
            }`}
            style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
          >
            {isSharing ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Sharing...</span>
              </>
            ) : (
              <>
                <Share2 className="w-5 h-5" />
                <span>Share Session</span>
              </>
            )}
          </button>
        )}
      </div>
    </>
  );
};

export default EducationLogCard;
