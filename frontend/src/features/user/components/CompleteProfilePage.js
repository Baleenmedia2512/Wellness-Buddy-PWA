// CompleteProfilePage — post-OTP onboarding: remaining profile fields
// (gender, height, diet, weight, Fat %, photo). Name/email collected earlier.
import React, { useEffect, useState, useCallback } from 'react';
import { User } from 'lucide-react';
import { fetchProfile, saveProfile } from '../services/profileService';
import useImageCropper from '../hooks/useImageCropper';
import useFaceDetection from '../hooks/useFaceDetection';
import CropOverlay from './shared/CropOverlay';
import CompleteProfileChecklist from './complete/CompleteProfileChecklist';
import CompleteRequiredFields, {
  MIN_WEIGHT_KG,
  MAX_WEIGHT_KG,
} from './complete/CompleteRequiredFields';
import CompletePictureSection from './complete/CompletePictureSection';
import UserProfileBodyMetrics from './profile/UserProfileBodyMetrics';
import HealthIssuesFilterSelect from '../../body-parameters-card/components/HealthIssuesFilterSelect';
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

const EMPTY_OPTIONAL_METRICS = {
  age: '',
  fatPercent: '',
  visceralFat: '',
  bmi: '',
  bodyAge: '',
  chestCm: '',
  waistCm: '',
  hipCm: '',
};

function parseOptionalNumber(raw, { integer = false } = {}) {
  if (raw === null || raw === undefined || String(raw).trim() === '') return null;
  const n = integer ? parseInt(String(raw), 10) : parseFloat(String(raw));
  return Number.isFinite(n) ? n : undefined;
}

function isValidCurrentWeight(value) {
  const n = parseFloat(value);
  return Number.isFinite(n) && n >= MIN_WEIGHT_KG && n <= MAX_WEIGHT_KG;
}

/**
 * @param {{
 *   user: object,
 *   apiBaseUrl?: string,
 *   onComplete: function,
 *   showPictureSection?: boolean,
 *   identityLocked?: boolean,
 * }} props
 */
const CompleteProfilePage = ({
  user,
  apiBaseUrl,
  onComplete,
  showPictureSection = true,
  identityLocked = true,
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [emailLocked, setEmailLocked] = useState(false);
  const [gender, setGender] = useState('');
  const [showGender, setShowGender] = useState(true);
  const [height, setHeight] = useState('');
  const [dietType, setDietType] = useState('');
  const [currentWeight, setCurrentWeight] = useState('');
  const [showCurrentWeight, setShowCurrentWeight] = useState(false);
  const [optionalMetrics, setOptionalMetrics] = useState(EMPTY_OPTIONAL_METRICS);
  const [recoveredHealthIssues, setRecoveredHealthIssues] = useState([]);
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
      const uid = user?.id || user?.UserId || user?.userId || null;
      const phone = user?.phoneNumber || user?.PhoneNumber || user?.phone || null;
      const sessionName = String(
        user?.userName || user?.UserName || user?.username || user?.name || '',
      ).trim();

      const applySessionNameFallback = () => {
        if (hasValidProfileName(sessionName, { phoneNumber: phone })) {
          setName(sessionName);
        }
      };

      const applyProfile = (profile, fallbackEmail = '') => {
        const profileEmail = (profile?.email || fallbackEmail || '').trim();
        if (profileEmail) {
          setEmail(profileEmail);
          setEmailLocked(true);
        } else {
          setEmailLocked(false);
        }

        const hasName = hasValidProfileName(profile?.userName, {
          email: profileEmail,
          phoneNumber: profile?.phoneNumber || phone,
        });
        if (hasName) {
          setName(String(profile.userName).trim());
        } else {
          applySessionNameFallback();
        }

        const bpcGender = profile?.bodyMetrics?.gender;
        if (hasValidProfileGender(profile?.gender, profile?.bodyMetrics)) {
          const resolved = VALID_GENDERS.includes(String(profile.gender || '').trim())
            ? String(profile.gender).trim()
            : String(bpcGender).trim();
          setGender(resolved);
          if (hasValidProfileGender(null, profile.bodyMetrics) && !profile.gender) {
            setShowGender(false);
          }
        }

        const hasH = typeof profile?.height === 'number' && profile.height >= 50 && profile.height <= 250;
        if (hasH) setHeight(String(profile.height));

        if (typeof profile?.dietType === 'string' && profile.dietType.trim()) {
          setDietType(profile.dietType);
        }

        const hasWeight = profile?.latestWeight != null
          && Number.isFinite(Number(profile.latestWeight));
        const needsWeight = profile?.needsCurrentWeight === true || !hasWeight;
        setShowCurrentWeight(needsWeight);
        if (hasWeight) setCurrentWeight(String(profile.latestWeight));

        const bm = profile?.bodyMetrics || {};
        const fatFallback = hasValidBodyFatPercent(profile?.latestWeightBodyFat)
          ? profile.latestWeightBodyFat
          : (hasValidBodyFatPercent(profile?.bodyFat)
            ? profile.bodyFat
            : bm.fatPercent);
        setOptionalMetrics({
          age: bm.age != null ? String(bm.age) : '',
          fatPercent: fatFallback != null && fatFallback !== '' ? String(fatFallback) : '',
          visceralFat: bm.visceralFat != null ? String(bm.visceralFat) : '',
          bmi: bm.bmi != null ? String(bm.bmi) : '',
          bodyAge: bm.bodyAge != null ? String(bm.bodyAge) : '',
          chestCm: bm.chestCm != null ? String(bm.chestCm) : '',
          waistCm: bm.waistCm != null ? String(bm.waistCm) : '',
          hipCm: bm.hipCm != null ? String(bm.hipCm) : '',
        });
        setRecoveredHealthIssues(
          Array.isArray(profile?.recoveredHealthIssues) ? profile.recoveredHealthIssues : [],
        );

        if (profile?.profileImage && (
          profile.profileImage.startsWith('data:image/')
          || profile.profileImage.startsWith('https://')
        )) {
          setPreviewUrl(profile.profileImage);
          setHasExistingPhoto(true);
        }
      };

      try {
        if (!loginEmail && !uid) {
          if (mounted) {
            applySessionNameFallback();
            setEmailLocked(false);
            setShowCurrentWeight(true);
            setLoading(false);
          }
          return;
        }

        const result = loginEmail
          ? await fetchProfile({ email: loginEmail })
          : await fetchProfile({ userId: uid });
        if (!mounted) return;
        const profile = result?.data;
        if (!profile) {
          if (loginEmail) {
            setEmail(loginEmail);
            setEmailLocked(true);
          }
          applySessionNameFallback();
          setShowCurrentWeight(true);
          return;
        }
        applyProfile(profile, loginEmail);
      } catch (e) {
        if (mounted) {
          if (loginEmail) {
            setEmail(loginEmail);
            setEmailLocked(true);
          }
          applySessionNameFallback();
          setShowCurrentWeight(true);
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
  // Name already collected on Welcome — keep valid even after email is entered.
  const nameValid = trimmedName.length >= 2
    && hasValidProfileName(trimmedName, {
      phoneNumber: user?.phoneNumber || user?.PhoneNumber || user?.phone,
    });
  const emailValid = EMAIL_RE.test(trimmedEmail);
  const genderValid = !showGender || hasValidProfileGender(gender, null);
  const heightValid = !Number.isNaN(heightNum) && heightNum >= 50 && heightNum <= 250;
  const dietValid = !!dietType;
  const currentWeightValid = !showCurrentWeight || isValidCurrentWeight(currentWeight);
  const fatPercentValid = hasValidBodyFatPercent(optionalMetrics.fatPercent);
  const pictureValid = !showPictureSection
    || hasExistingPhoto
    || !!profileImage;
  const formValid = nameValid && emailValid && genderValid && heightValid && dietValid
    && currentWeightValid && fatPercentValid && pictureValid;

  const nameLocked = identityLocked && nameValid;
  const checks = [
    ...(nameLocked ? [] : [{ label: 'Name', done: nameValid }]),
    { label: 'Email', done: emailValid },
    ...(showGender ? [{ label: 'Gender', done: genderValid }] : []),
    { label: 'Height', done: heightValid },
    { label: 'Diet Preference', done: dietValid },
    ...(showCurrentWeight ? [{ label: 'Current Weight', done: currentWeightValid }] : []),
    { label: 'Fat %', done: fatPercentValid },
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
      else if (showCurrentWeight && !currentWeightValid) {
        setError(`Please enter current weight (${MIN_WEIGHT_KG}–${MAX_WEIGHT_KG} kg).`);
      }
      else if (!fatPercentValid) {
        setError(`Please enter Fat % (${MIN_BODY_FAT_PCT}–${MAX_BODY_FAT_PCT}%).`);
      }
      else if (showPictureSection && !pictureValid) {
        setError('Profile picture is required.');
      }
      return;
    }
    setSaving(true);
    try {
      const uid = user?.id || user?.userId || user?.UserId;
      const hadEmail = !!(user?.email || user?.Email);

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
      if (showCurrentWeight && isValidCurrentWeight(currentWeight)) {
        payload.currentWeight = parseFloat(currentWeight);
      }
      if (fatPercentValid) {
        payload.bodyFat = parseFloat(optionalMetrics.fatPercent);
      }

      const age = parseOptionalNumber(optionalMetrics.age, { integer: true });
      const visceralFat = parseOptionalNumber(optionalMetrics.visceralFat);
      const bodyAge = parseOptionalNumber(optionalMetrics.bodyAge);
      const chestCm = parseOptionalNumber(optionalMetrics.chestCm);
      const waistCm = parseOptionalNumber(optionalMetrics.waistCm);
      const hipCm = parseOptionalNumber(optionalMetrics.hipCm);
      if (age !== undefined) payload.age = age;
      if (visceralFat !== undefined) payload.visceralFat = visceralFat;
      if (bodyAge !== undefined) payload.bodyAge = bodyAge;
      if (chestCm !== undefined) payload.chestCm = chestCm;
      if (waistCm !== undefined) payload.waistCm = waistCm;
      if (hipCm !== undefined) payload.hipCm = hipCm;
      payload.recoveredHealthIssues = Array.isArray(recoveredHealthIssues)
        ? recoveredHealthIssues
        : [];

      await saveProfile(payload);

      onComplete({
        email: trimmedEmail,
        userName: trimmedName,
        height: heightNum,
        dietType,
        gender: showGender ? gender : undefined,
        profileImage: profileImage || previewUrl || undefined,
        currentWeight: showCurrentWeight && isValidCurrentWeight(currentWeight)
          ? parseFloat(currentWeight)
          : undefined,
        bodyFat: fatPercentValid ? parseFloat(optionalMetrics.fatPercent) : undefined,
      });
    } catch (e) {
      setError(e.message || 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [
    formValid, nameValid, emailValid, genderValid, heightValid, dietValid,
    currentWeightValid, fatPercentValid, pictureValid,
    showPictureSection, profileImage, user, apiBaseUrl,
    trimmedName, trimmedEmail, heightNum, dietType, showGender, gender, previewUrl, onComplete,
    showCurrentWeight, currentWeight, optionalMetrics, recoveredHealthIssues,
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
          Gender, height, diet, body metrics, and photo — then transformation photos.
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
            identityLocked={nameLocked}
            hideName={nameLocked}
            gender={gender}
            setGender={setGender}
            showGender={showGender}
            height={height}
            setHeight={setHeight}
            heightValid={heightValid}
            dietType={dietType}
            setDietType={setDietType}
            currentWeight={currentWeight}
            setCurrentWeight={setCurrentWeight}
            showCurrentWeight={showCurrentWeight}
            currentWeightValid={currentWeightValid}
          />
          <div className="pt-2 border-t border-gray-100">
            <UserProfileBodyMetrics
              bodyMetrics={optionalMetrics}
              heightCm={height}
              weightKg={currentWeight}
              onChange={(key, value) => {
                if (key === 'bmi') return;
                setOptionalMetrics((prev) => ({ ...prev, [key]: value }));
              }}
            />
            <div className="mt-3">
              <HealthIssuesFilterSelect
                value={recoveredHealthIssues}
                onChange={setRecoveredHealthIssues}
              />
            </div>
          </div>
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
