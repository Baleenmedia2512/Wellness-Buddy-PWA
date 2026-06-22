// src/features/user/components/UserProfileModal.js
// Modal: view/edit profile (name, height, phone, BMR, diet, picture).
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { getUserContext } from '../../../shared/services/userIdentity';
import useProfileForm from '../hooks/useProfileForm';
import useImageCropper from '../hooks/useImageCropper';
import useFaceDetection from '../hooks/useFaceDetection';
import { fetchProfile, saveProfile } from '../services/profileService';
import CropOverlay from './shared/CropOverlay';
import UserProfileHeader from './profile/UserProfileHeader';
import UserProfileBody from './profile/UserProfileBody';
import FaceDetectionToast from './profile/FaceDetectionToast';
import UserProfileFooter from './profile/UserProfileFooter';

const UserProfileModal = ({ isOpen, onClose, user, userRole = 'user', onProfileUpdate }) => {
  const form = useProfileForm();
  const [profileImagePreview, setProfileImagePreview] = useState(null);
  const [profileImage, setProfileImage] = useState(null);
  const [latestWeight, setLatestWeight] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [hasSaved, setHasSaved] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const face = useFaceDetection();
  const handleSaveRef = useRef(null);

  const cropper = useImageCropper({
    onError: setError,
    onCropped: (img) => {
      setProfileImage(img); setProfileImagePreview(img); face.reset();
      setShowToast(true); face.run(img);
    },
  });

  const loadProfile = useCallback(async () => {
    setIsLoading(true); setError('');
    try {
      const { data } = await fetchProfile(user.email);
      if (data) {
        form.reload({
          name: data.userName || user.name || '',
          height: data.height ? String(data.height) : '',
          phone: data.phoneNumber || '',
          dietType: data.dietType || '',
          bmr: data.latestBmr ? String(Math.round(data.latestBmr)) : '',
          weightGoalMode: data.weightGoalMode || null,
        });
        setLatestWeight(data.latestWeight ? parseFloat(data.latestWeight) : null);
        if (data.profileImage) setProfileImagePreview(data.profileImage);
      }
    } catch (e) { setError(e.message || 'Failed to load profile.'); }
    finally { setIsLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: listed deps would cause an infinite re-render
  }, [user]);

  useEffect(() => {
    if (isOpen && user?.email) {
      setSuccessMessage(''); setHasSaved(false); setError('');
      setProfileImage(null); face.reset(); setShowToast(false);
      loadProfile();
    }
    if (!isOpen) { face.reset(); setShowToast(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: listed deps would cause an infinite re-render
  }, [isOpen, user?.email]);

  useEffect(() => {
    if (!successMessage) return;
    const t = setTimeout(() => { setSuccessMessage(''); onClose(); }, 2000);
    return () => clearTimeout(t);
  }, [successMessage, onClose]);

  const handleSave = useCallback(async () => {
    setError(''); setSuccessMessage(''); setIsSaving(true);
    try {
      const err = form.validate({ requireDiet: false, maxHeight: 198 });
      if (err) { setError(err); return; }
      if (profileImage) {
        const status = await face.awaitResult();
        if (status === 'no_face') { setError('No face detected. Please upload a clear photo of your face.'); return; }
        if (status === 'detection_error') { setError('Photo verification failed. Please try again.'); return; }
      }
      const data = await saveProfile(form.payload(user.email, profileImage ? { profileImage } : {}));
      onProfileUpdate?.({
        name: form.name,
        height: form.height ? parseFloat(form.height) : null,
        bmr: form.bmr ? parseFloat(form.bmr) : null,
        dietType: form.dietType || null,
        profileImage: profileImagePreview || null,
      });
      if (user?.id) getUserContext(user.id).catch(() => {});
      await loadProfile();
      setSuccessMessage(data.message || 'Profile saved successfully!');
      setHasSaved(true); setProfileImage(null);
    } catch (e) { setError(e.message || 'Failed to save profile'); }
    finally { setIsSaving(false); }
  }, [form, profileImage, profileImagePreview, user, face, loadProfile, onProfileUpdate]);

  handleSaveRef.current = handleSave;

  useEffect(() => {
    if (face.status === 'face_found' && profileImage) handleSaveRef.current?.();
    else if (face.status === 'no_face') setError('No face detected. Please upload a clear real photo of your face.');
    else if (face.status === 'detection_error') setError('Photo verification failed. Please try again.');
  }, [face.status, profileImage]);

  const handleCancel = () => { if (!isSaving) { setError(''); onClose(); } };

  if (!isOpen) return null;

  const saveDisabled = isSaving || !form.nameValid ||
    !form.height || form.height.trim() === '' || !form.phone || form.phone.trim() === '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <FaceDetectionToast status={face.status} visible={showToast} onDismiss={() => setShowToast(false)} />
      {cropper.showCropper && cropper.rawImageSrc && (
        <CropOverlay {...cropper} onCancel={cropper.cancelCropper} onDone={cropper.apply} zIndex={60} />
      )}
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <UserProfileHeader user={user} name={form.name} userRole={userRole}
          profileImagePreview={profileImagePreview} faceStatus={face.status}
          showRecrop={!!profileImagePreview && !!cropper.rawImageSrc}
          weightGoalMode={form.weightGoalMode}
          onPickImage={() => cropper.fileInputRef.current?.click()}
          onRecrop={cropper.reopenCropper} onClose={handleCancel} isSaving={isSaving} />
        <input ref={cropper.fileInputRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => cropper.selectFile(e.target.files?.[0])} />
        <UserProfileBody isLoading={isLoading} form={form} latestWeight={latestWeight}
          error={error} successMessage={successMessage} />
        {!isLoading && (
          <UserProfileFooter isSaving={isSaving} hasSaved={hasSaved} disabled={saveDisabled}
            onCancel={handleCancel} onSave={handleSave} />
        )}
      </div>
    </div>
  );
};

export default UserProfileModal;
