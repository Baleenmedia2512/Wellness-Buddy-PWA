// src/features/user/components/CompleteProfilePage.js
// Full-screen blocking page shown when mandatory profile fields are missing.
import React, { useEffect, useState, useCallback } from 'react';
import { User } from 'lucide-react';
import { fetchProfile, saveProfile } from '../services/profileService';
import useImageCropper from '../hooks/useImageCropper';
import useFaceDetection from '../hooks/useFaceDetection';
import CropOverlay from './shared/CropOverlay';
import CompleteProfileChecklist from './complete/CompleteProfileChecklist';
import CompleteRequiredFields from './complete/CompleteRequiredFields';
import CompletePictureSection from './complete/CompletePictureSection';

const PHONE_REGEX = /^\+?\d[\d\s\-]{8,18}\d$/;

const CompleteProfilePage = ({ user, apiBaseUrl, onComplete, showPictureSection = false }) => {
  const [height, setHeight] = useState('');
  const [phone, setPhone] = useState('');
  const [dietType, setDietType] = useState('');
  const [missing, setMissing] = useState({ height: true, phoneNumber: true, dietType: true });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [profileImage, setProfileImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [picError, setPicError] = useState('');
  const face = useFaceDetection();
  const cropper = useImageCropper({
    onError: setPicError,
    onCropped: (img) => { setProfileImage(img); setPreviewUrl(img); face.reset(); face.run(img); },
  });

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const result = await fetchProfile(user?.email || user?.Email);
        if (!mounted) return;
        const profile = result?.data;
        if (!profile) { setMissing({ height: true, phoneNumber: true, dietType: true }); return; }
        const hasH = typeof profile.height === 'number' && profile.height >= 50 && profile.height <= 250;
        const hasP = typeof profile.phoneNumber === 'string' && profile.phoneNumber.trim() !== '';
        const hasD = typeof profile.dietType === 'string' && profile.dietType.trim() !== '';
        const next = { height: !hasH, phoneNumber: !hasP, dietType: !hasD };
        setMissing(next);
        if (!next.height && !next.phoneNumber && !next.dietType) { onComplete(profile); return; }
      } catch (e) {
        if (mounted) setError(e.message || 'Failed to load profile.');
      } finally { if (mounted) setLoading(false); }
    })();
    return () => { mounted = false; };
  }, [apiBaseUrl, onComplete, user]);

  const heightNum = parseFloat(height);
  const heightValid = !Number.isNaN(heightNum) && heightNum >= 50 && heightNum <= 250;
  const phoneValid = PHONE_REGEX.test(phone.trim());
  const dietValid = !!dietType;
  const formValid =
    (!missing.height || heightValid) && (!missing.phoneNumber || phoneValid) && (!missing.dietType || dietValid);

  const checks = [];
  if (missing.height) checks.push({ label: 'Height', done: heightValid });
  if (missing.phoneNumber) checks.push({ label: 'Phone Number', done: phoneValid });
  if (missing.dietType) checks.push({ label: 'Diet Preference', done: dietValid });

  const handleSave = useCallback(async () => {
    setError('');
    if (!formValid) {
      if (!heightValid) setError('Please enter a valid height (50 - 250 cm).');
      else if (!phoneValid) setError('Please enter a valid phone number (10-15 digits).');
      else if (!dietValid) setError('Please select a diet preference.');
      return;
    }
    setSaving(true);
    try {
      const payload = { email: user.email || user.Email };
      if (missing.height) payload.height = heightNum;
      if (missing.phoneNumber) payload.phoneNumber = phone.trim();
      if (missing.dietType) payload.dietType = dietType;
      await saveProfile(payload);
      if (showPictureSection && profileImage) {
        await saveProfile({ email: payload.email, profileImage });
      }
      onComplete({
        height: missing.height ? heightNum : undefined,
        phoneNumber: missing.phoneNumber ? phone.trim() : undefined,
        dietType: missing.dietType ? dietType : undefined,
        profileImage: profileImage || undefined,
      });
    } catch (e) { setError(e.message || 'Failed to save. Please try again.'); }
    finally { setSaving(false); }
  }, [formValid, heightValid, phoneValid, dietValid, missing, heightNum, phone, dietType, user, profileImage, showPictureSection, onComplete]);

  return (
    <div className="fixed inset-0 bg-gray-50 overflow-y-auto" style={{ zIndex: 300 }}>
      {cropper.showCropper && cropper.rawImageSrc && (
        <CropOverlay {...cropper} onCancel={cropper.cancelCropper} onDone={cropper.apply} zIndex={310} />
      )}
      <div className="bg-gradient-to-r from-green-500 to-green-600 px-6 pt-14 pb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="bg-white/20 rounded-full p-2"><User className="w-6 h-6 text-white" /></div>
          <h1 className="text-2xl font-bold text-white">Complete Your Profile</h1>
        </div>
        <p className="text-green-100 text-sm">A few details are needed to personalise your wellness journey.</p>
      </div>
      <div className="max-w-md mx-auto p-5 space-y-5">
        <CompleteProfileChecklist loading={loading} checks={checks} />
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5 space-y-4">
          <CompleteRequiredFields missing={missing} height={height} setHeight={setHeight}
            heightValid={heightValid} phone={phone} setPhone={setPhone} phoneValid={phoneValid}
            dietType={dietType} setDietType={setDietType} />
          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg"><p className="text-sm text-red-600">{error}</p></div>}
        </div>
        <CompletePictureSection show={showPictureSection} previewUrl={previewUrl}
          faceStatus={face.status} onRecrop={cropper.reopenCropper}
          onSelectFile={cropper.selectFile} isSaving={saving} error={picError} />
        <button onClick={handleSave} disabled={!formValid || saving || loading}
          className="w-full py-4 bg-gradient-to-r from-green-500 to-green-600 text-white font-bold rounded-xl shadow-lg disabled:opacity-50">
          {saving ? 'Saving...' : 'Save & Continue'}
        </button>
      </div>
    </div>
  );
};

export default CompleteProfilePage;
