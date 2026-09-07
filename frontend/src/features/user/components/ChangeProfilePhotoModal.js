// Modal to change the signed-in user's profile photo (camera / gallery → crop → save).
import React, { useState } from 'react';
import { Camera, Upload, X } from 'lucide-react';
import useImageCropper from '../hooks/useImageCropper';
import { saveProfile } from '../services/profileService';
import CropOverlay from './shared/CropOverlay';
import CameraGalleryButtons from './shared/CameraGalleryButtons';
import PicturePreview from './picture/PicturePreview';
import * as Session from '../../../shared/services/sessionStorage';

/**
 * @param {{
 *   isOpen: boolean,
 *   onClose: () => void,
 *   user: { email?: string, Email?: string, id?: string|number } | null,
 *   currentPreviewUrl?: string | null,
 *   onUploaded: (profileImage: string) => void,
 * }} props
 */
const ChangeProfilePhotoModal = ({
  isOpen,
  onClose,
  user,
  accountEmail = '',
  currentPreviewUrl = null,
  onUploaded,
}) => {
  const [profileImage, setProfileImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const cropper = useImageCropper({
    onError: setError,
    onCropped: (cropped) => {
      setError('');
      setProfileImage(cropped);
      setPreviewUrl(cropped);
    },
  });

  if (!isOpen) return null;

  const displayPreview = previewUrl || currentPreviewUrl || null;
  const email = (
    accountEmail
    || user?.email
    || user?.Email
    || Session.getUserEmail()
    || ''
  ).trim();

  const handleClose = () => {
    if (isSaving) return;
    setError('');
    setProfileImage(null);
    setPreviewUrl(null);
    cropper.cancelCropper();
    onClose();
  };

  const handleUpload = async () => {
    if (!profileImage) {
      setError('Please select a new photo first');
      return;
    }
    if (!email && user?.id == null) {
      setError('Unable to identify your account. Please sign in again.');
      return;
    }
    setError('');
    setIsSaving(true);
    try {
      const payload = { profileImage };
      if (email) payload.email = email;
      if (user?.id != null) payload.userId = user.id;
      await saveProfile(payload);
      if (email) Session.markProfilePictureUploaded(email);
      onUploaded?.(profileImage);
      setProfileImage(null);
      setPreviewUrl(null);
      cropper.cancelCropper();
      onClose();
    } catch (err) {
      setError(err?.message || 'Failed to update profile photo. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      style={{ zIndex: 350 }}
      role="dialog"
      aria-modal="true"
      aria-label="Change profile photo"
    >
      {cropper.showCropper && cropper.rawImageSrc && (
        <CropOverlay
          {...cropper}
          onCancel={cropper.cancelCropper}
          onDone={cropper.apply}
          zIndex={360}
        />
      )}
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-5 bg-gradient-to-r from-green-500 to-green-600 rounded-t-2xl flex items-start justify-between gap-3">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
              <Camera className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-white truncate">Change Profile Photo</h2>
              <p className="text-sm text-green-50">Take a photo or choose from gallery</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isSaving}
            className="p-1.5 rounded-full text-white/80 hover:text-white hover:bg-white/15 disabled:opacity-50"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <PicturePreview
            previewUrl={displayPreview}
            faceStatus="idle"
            onRecrop={previewUrl ? cropper.reopenCropper : undefined}
            isSaving={isSaving}
          />

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <CameraGalleryButtons
            disabled={isSaving}
            onCameraSelect={cropper.selectFile}
            onGallerySelect={cropper.selectFile}
          />

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSaving}
              className="flex-1 py-3 px-4 border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleUpload}
              disabled={!profileImage || isSaving}
              className="flex-1 py-3 px-4 bg-gradient-to-r from-green-500 to-green-600 text-white font-semibold rounded-xl hover:from-green-600 hover:to-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                  <span>Uploading...</span>
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5" />
                  <span>Save Photo</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChangeProfilePhotoModal;
