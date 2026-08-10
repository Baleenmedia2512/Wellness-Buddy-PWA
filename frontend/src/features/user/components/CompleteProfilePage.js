// CompleteProfilePage — unified onboarding screen (before activity / coach / OTP).
// Collects: name, email, gender, height, diet preference, profile photo.
import React, { useEffect, useState, useCallback } from 'react';
import { User } from 'lucide-react';
import { fetchProfile, saveProfile } from '../services/profileService';
import useImageCropper from '../hooks/useImageCropper';
import useFaceDetection from '../hooks/useFaceDetection';
import CropOverlay from './shared/CropOverlay';
import CompleteProfileChecklist from './complete/CompleteProfileChecklist';
import CompleteRequiredFields from './complete/CompleteRequiredFields';
import CompletePictureSection from './complete/CompletePictureSection';
import {
  hasValidProfileName,
  hasValidProfileGender,
  hasValidBodyFatPercent,
  VALID_GENDERS,
  MIN_BODY_FAT_PCT,
  MAX_BODY_FAT_PCT,
} from '../domain/profileCompleteness';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const API = process.env.REACT_APP_API_BASE_URL;

const CompleteProfilePage = ({ user, apiBaseUrl, onComplete, showPictureSection = true }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [emailLocked, setEmailLocked] = useState(false);
  const [gender, setGender] = useState('');
  const [showGender, setShowGender] = useState(true);
  const [height, setHeight] = useState('');
  const [dietType, setDietType] = useState('');
  const [communityId, setCommunityId] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [showBodyFat, setShowBodyFat] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [profileImage, setProfileImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [picError, setPicError] = useState('');
  const [hasExistingPhoto, setHasExistingPhoto] = useState(false);
  const face = useFaceDetection();
  const cropper = useImageCropper({
    onError: setPicError,
    onCropped: (img) => { setProfileImage(img); setPreviewUrl(img); face.reset(); face.run(img, user?.id ?? null, 'PROFILE_IMAGE_SET'); },
  });

  useEffect(() => {
    let mounted = true;
    (async () => {
      const loginEmail = (user?.email || user?.Email || '').trim();
      try {
        if (!loginEmail) {
          // Phone-OTP user with no email yet — empty form, email editable.
          if (mounted) {
            setEmailLocked(false);
            setLoading(false);
          }
          return;
        }

        const result = await fetchProfile(loginEmail);
        if (!mounted) return;
        const profile = result?.data;
        if (!profile) {
          setEmail(loginEmail);
          setEmailLocked(true);
          return;
        }

        const profileEmail = (profile.email || loginEmail).trim();
        setEmail(profileEmail);
        setEmailLocked(!!profileEmail);

        const hasName = hasValidProfileName(profile.userName, {
          email: profileEmail,
          phoneNumber: profile.phoneNumber,
        });
        if (hasName) setName(profile.userName.trim());

        const bpcGender = profile.bodyMetrics?.gender;
        if (hasValidProfileGender(profile.gender, profile.bodyMetrics)) {
          const resolved = VALID_GENDERS.includes(String(profile.gender || '').trim())
            ? String(profile.gender).trim()
            : String(bpcGender).trim();
          setGender(resolved);
          // Hide gender field when BPC already recorded it and team gender empty / same.
          if (hasValidProfileGender(null, profile.bodyMetrics) && !profile.gender) {
            setShowGender(false);
          }
        }

        const hasH = typeof profile.height === 'number' && profile.height >= 50 && profile.height <= 250;
        if (hasH) setHeight(String(profile.height));

        if (typeof profile.dietType === 'string' && profile.dietType.trim()) {
          setDietType(profile.dietType);
        }

        if (profile.communityId) setCommunityId(String(profile.communityId));
        // Ask for body fat only when weight / BPC has none.
        const needsBodyFat = profile.needsBodyFat !== false
          && !(typeof profile.bodyFat === 'number' && hasValidBodyFatPercent(profile.bodyFat))
          && !(typeof profile.latestWeightBodyFat === 'number'
            && hasValidBodyFatPercent(profile.latestWeightBodyFat))
          && !hasValidBodyFatPercent(profile.bodyMetrics?.fatPercent);
        setShowBodyFat(needsBodyFat);
        const existingBf = hasValidBodyFatPercent(profile.latestWeightBodyFat)
          ? profile.latestWeightBodyFat
          : (hasValidBodyFatPercent(profile.bodyFat) ? profile.bodyFat : null);
        if (existingBf != null) setBodyFat(String(existingBf));

        if (profile.profileImage && (
          profile.profileImage.startsWith('data:image/')
          || profile.profileImage.startsWith('https://')
        )) {
          setPreviewUrl(profile.profileImage);
          setHasExistingPhoto(true);
        }
      } catch (e) {
        if (mounted) {
          if (loginEmail) {
            setEmail(loginEmail);
            setEmailLocked(true);
          }
          setError(e.message || 'Failed to load profile.');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [user]);

  const heightNum = parseFloat(height);
  const trimmedName = name.trim();
  const trimmedEmail = email.trim().toLowerCase();
  const nameValid = trimmedName.length >= 2
    && hasValidProfileName(trimmedName, { email: trimmedEmail });
  const emailValid = EMAIL_RE.test(trimmedEmail);
  const genderValid = !showGender || hasValidProfileGender(gender, null);
  const heightValid = !Number.isNaN(heightNum) && heightNum >= 50 && heightNum <= 250;
  const dietValid = !!dietType;
  const bodyFatValid = !showBodyFat || hasValidBodyFatPercent(bodyFat);
  const pictureValid = !showPictureSection
    || hasExistingPhoto
    || !!profileImage;
  const formValid = nameValid && emailValid && genderValid && heightValid && dietValid
    && bodyFatValid && pictureValid;

  const checks = [
    { label: 'Name', done: nameValid },
    { label: 'Email', done: emailValid },
    ...(showGender ? [{ label: 'Gender', done: genderValid }] : []),
    { label: 'Height', done: heightValid },
    { label: 'Diet Preference', done: dietValid },
    ...(showBodyFat ? [{ label: 'Body Fat', done: bodyFatValid }] : []),
  ];
  if (showPictureSection) {
    checks.push({ label: 'Profile Picture', done: pictureValid });
  }

  const handleSave = useCallback(async () => {
    setError('');
    if (!formValid) {
      if (!nameValid) setError('Please enter your full name.');
      else if (!emailValid) setError('Please enter a valid email address.');
      else if (!genderValid) setError('Please select Male or Female.');
      else if (!heightValid) setError('Please enter a valid height (50 - 250 cm).');
      else if (!dietValid) setError('Please select a diet preference.');
      else if (showBodyFat && !bodyFatValid) {
        setError(`Please enter body fat (${MIN_BODY_FAT_PCT}–${MAX_BODY_FAT_PCT}%).`);
      }
      else if (showPictureSection && !pictureValid) {
        setError('Profile picture is required.');
      }
      return;
    }
    setSaving(true);
    try {
      const uid = user?.id || user?.UserId;
      const hadEmail = !!(user?.email || user?.Email);

      // Phone users: assign email + name via save-email before profile update.
      if (!hadEmail) {
        if (!uid) {
          setError('Unable to identify your account. Please re-login.');
          return;
        }
        const base = apiBaseUrl || API;
        const res = await fetch(`${base}/api/user/save-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: uid,
            name: trimmedName,
            email: trimmedEmail,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          setError(data.message || 'Failed to save email. Please try again.');
          return;
        }
      }

      const payload = {
        email: trimmedEmail,
        name: trimmedName,
        height: heightNum,
        dietType,
      };
      if (showGender && gender) payload.gender = gender;
      if (showPictureSection && profileImage) payload.profileImage = profileImage;
      const trimmedCommunityId = communityId.trim();
      if (trimmedCommunityId) payload.communityId = trimmedCommunityId;
      if (showBodyFat && hasValidBodyFatPercent(bodyFat)) {
        payload.bodyFat = parseFloat(bodyFat);
      }

      await saveProfile(payload);

      onComplete({
        email: trimmedEmail,
        userName: trimmedName,
        height: heightNum,
        dietType,
        gender: showGender ? gender : undefined,
        profileImage: profileImage || previewUrl || undefined,
        bodyFat: showBodyFat && hasValidBodyFatPercent(bodyFat) ? parseFloat(bodyFat) : undefined,
      });
    } catch (e) {
      setError(e.message || 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [
    formValid, nameValid, emailValid, genderValid, heightValid, dietValid, bodyFatValid, pictureValid,
    showPictureSection, profileImage, user, apiBaseUrl,
    trimmedName, trimmedEmail, heightNum, dietType, showGender, gender, previewUrl, onComplete,
    showBodyFat, bodyFat, communityId,
  ]);

  return (
    <div className="fixed inset-0 bg-gray-50 overflow-y-auto" style={{ zIndex: 9999 }}>
      {cropper.showCropper && cropper.rawImageSrc && (
        <CropOverlay {...cropper} onCancel={cropper.cancelCropper} onDone={cropper.apply} zIndex={10050} />
      )}
      <div className="bg-gradient-to-r from-green-500 to-green-600 px-6 pt-14 pb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="bg-white/20 rounded-full p-2"><User className="w-6 h-6 text-white" /></div>
          <h1 className="text-2xl font-bold text-white">Complete Your Profile</h1>
        </div>
        <p className="text-green-100 text-sm">
          Name, email, gender, height, diet preference, and photo — all in one place.
        </p>
      </div>
      <div className="max-w-md mx-auto p-5 space-y-5">
        <CompleteProfileChecklist loading={loading} checks={checks} />
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5 space-y-4">
          <CompleteRequiredFields
            name={name}
            setName={setName}
            nameValid={nameValid}
            email={email}
            setEmail={setEmail}
            emailValid={emailValid}
            emailLocked={emailLocked}
            gender={gender}
            setGender={setGender}
            showGender={showGender}
            height={height}
            setHeight={setHeight}
            heightValid={heightValid}
            dietType={dietType}
            setDietType={setDietType}
            communityId={communityId}
            setCommunityId={setCommunityId}
            bodyFat={bodyFat}
            setBodyFat={setBodyFat}
            showBodyFat={showBodyFat}
            bodyFatValid={bodyFatValid}
          />
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
        </div>
        <CompletePictureSection
          show={showPictureSection}
          previewUrl={previewUrl}
          faceStatus={hasExistingPhoto && !profileImage ? 'face_found' : face.status}
          onRecrop={cropper.reopenCropper}
          onSelectFile={cropper.selectFile}
          isSaving={saving}
          error={picError}
        />
        <button
          onClick={handleSave}
          disabled={!formValid || saving || loading}
          className="w-full py-4 bg-gradient-to-r from-green-500 to-green-600 text-white font-bold rounded-xl shadow-lg disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save & Continue'}
        </button>
      </div>
    </div>
  );
};

export default CompleteProfilePage;
