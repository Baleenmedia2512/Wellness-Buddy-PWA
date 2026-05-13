// src/features/user/components/MandatoryProfilePictureModal.js
// Blocking modal — forces upload of a profile picture (face-verified).
import React, { useState } from 'react';
import { Camera, Upload } from 'lucide-react';
import useImageCropper from '../hooks/useImageCropper';
import useFaceDetection from '../hooks/useFaceDetection';
import { saveProfile } from '../services/profileService';
import CropOverlay from './shared/CropOverlay';
import FaceStatusBadge from './shared/FaceStatusBadge';
import CameraGalleryButtons from './shared/CameraGalleryButtons';
import PicturePreview from './picture/PicturePreview';

const MandatoryProfilePictureModal = ({ user, onComplete }) => {
  const [profileImage, setProfileImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const face = useFaceDetection();

  const cropper = useImageCropper({
    onError: setError,
    onCropped: (cropped) => {
      setProfileImage(cropped); setPreviewUrl(cropped); face.reset(); face.run(cropped);
    },
  });

  const handleUpload = async () => {
    if (!profileImage) { setError('Please select an image first'); return; }
    if (face.status === 'detecting') { setError('Please wait while we verify your photo...'); return; }
    if (face.status === 'no_face') { setError('No face detected. Please upload a clear photo of your face.'); return; }
    setError(''); setIsSaving(true);
    try {
      await saveProfile({ email: user.email, profileImage });
      onComplete(profileImage);
    } catch (err) {
      setError(err.message || 'Failed to upload profile picture');
    } finally { setIsSaving(false); }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" style={{ zIndex: 350 }}>
      {cropper.showCropper && cropper.rawImageSrc && (
        <CropOverlay {...cropper}
          onCancel={cropper.cancelCropper} onDone={cropper.apply} zIndex={360} />
      )}
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
        <div className="p-6 bg-gradient-to-r from-green-500 to-green-600 rounded-t-2xl">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
              <Camera className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Profile Picture Required</h2>
              <p className="text-sm text-green-50">Please upload your photo to continue</p>
            </div>
          </div>
        </div>
        <div className="p-6 space-y-5">
          <div className="flex items-start space-x-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <p className="text-sm font-medium text-amber-900">Profile picture is mandatory</p>
          </div>
          <PicturePreview previewUrl={previewUrl} faceStatus={face.status}
            onRecrop={previewUrl ? cropper.reopenCropper : undefined} isSaving={isSaving} />
          <FaceStatusBadge status={face.status} />
          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg"><p className="text-sm text-red-600">{error}</p></div>}
          <CameraGalleryButtons disabled={isSaving}
            onCameraSelect={cropper.selectFile} onGallerySelect={cropper.selectFile} />
          <button onClick={handleUpload}
            disabled={!profileImage || isSaving || face.status === 'detecting' || face.status === 'no_face'}
            className="w-full py-3 px-4 bg-gradient-to-r from-green-500 to-green-600 text-white font-semibold rounded-xl hover:from-green-600 hover:to-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2">
            {isSaving ? (
              <><div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" /><span>Uploading...</span></>
            ) : (
              <><Upload className="w-5 h-5" /><span>Save & Continue</span></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MandatoryProfilePictureModal;
