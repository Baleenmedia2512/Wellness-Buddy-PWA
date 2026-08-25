// src/features/user/components/UserProfilePage.js
//
// Inline full-page profile editor — replaces the old UserProfileModal overlay.
// Rendered as a first-class page route inside App.js (showProfilePage=true).
//
// Sections:
//   1. Avatar / photo picker
//   2. Profile fields (name, height, phone, community ID, email, diet, BMR, PAL)
//   3. Weight goal mode
//   4. Settings  (auto camera toggle)
//   5. Account actions (sign out, delete account)
//
// Lead pre-fill: on first load, if the profile has no name or phone and the
// user has a phone number from auth, the app checks for a counselling lead
// record with the same phone and pre-populates the form fields.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Camera, LogOut, Trash2, CheckCircle, Sparkles } from 'lucide-react';
import { getUserContext } from '../../../shared/services/userIdentity';
import {
  isAutoCameraOnResumeEnabled,
  setAutoCameraOnResumeEnabled,
} from '../../../shared/utils/autoCameraPreference';
import useProfileForm from '../hooks/useProfileForm';
import useImageCropper from '../hooks/useImageCropper';
import useFaceDetection from '../hooks/useFaceDetection';
import { fetchProfile, saveProfile } from '../services/profileService';
import { fetchMyAssessment, fetchLeadByPhone } from '../../counselling/services/counsellingApi';
import CropOverlay from './shared/CropOverlay';
import UserProfileFields from './profile/UserProfileFields';
import UserProfileBodyMetrics from './profile/UserProfileBodyMetrics';
import IdealWeightCards from './profile/IdealWeightCards';
import DietDropdown from './profile/DietDropdown';
import WeightModeSelector from './profile/WeightModeSelector';
import HealthIssuesFilterSelect from '../../body-parameters-card/components/HealthIssuesFilterSelect';
import { EmojiOrNative } from '../../../shared/components/icons/EmojiImage';
import { deriveWeightGoalMode } from '../../weight/services/weightFormService';
import DeleteAccountModal from './DeleteAccountModal';
import TouchFeedbackButton from '../../../shared/components/TouchFeedbackButton';

const COLORS = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-yellow-500', 'bg-red-500', 'bg-teal-500'];
const colorOf = (name, email) => COLORS[(name || email || '').length % COLORS.length];
const initialOf = (name, email) => (name || email || 'U').charAt(0).toUpperCase();

const ROLE_LABELS = { admin: 'Admin', developer: 'Developer', coach: 'Coach', upline: 'Upline', user: 'Member' };

const UserProfilePage = ({ user, userRole = 'user', onBack, onSignOut, onProfileUpdate }) => {
  const form = useProfileForm();
  const [profileImagePreview, setProfileImagePreview] = useState(null);
  const [profileImage, setProfileImage] = useState(null);
  const [latestWeight, setLatestWeight] = useState(null);
  const [initialWeight, setInitialWeight] = useState(null);
  const [initialWeightDate, setInitialWeightDate] = useState(null);
  const [coachName, setCoachName] = useState('');
  const [idealCoachName, setIdealCoachName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [hasSaved, setHasSaved] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [leadPreFilled, setLeadPreFilled] = useState(false); // true once we've pre-filled from lead
  const leadPreFilledRef = useRef(false);
  const [autoCameraEnabled, setAutoCameraEnabled] = useState(
    () => isAutoCameraOnResumeEnabled()
  );
  const face = useFaceDetection();
  const handleSaveRef = useRef(null);

  const cropper = useImageCropper({
    onError: setError,
    onCropped: (img) => {
      setError('');
      setProfileImage(img);
      setProfileImagePreview(img);
      face.reset();
      // Accept any photo (no AI face check) — mark ready for auto-save.
      face.run(img, user?.id ?? null);
    },
  });

  const loadProfile = useCallback(async () => {
    if (!user?.email) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const { data } = await fetchProfile(user.email);
      const profileData = {
        name: data?.userName || user.name || '',
        height: data?.height ? String(data.height) : '',
        phone: data?.phoneNumber || '',
        dietType: data?.dietType || '',
        gender: data?.gender || '',
        bmr: data?.latestBmr ? String(Math.round(data.latestBmr)) : '',
        physicalActivityLevel: data?.physicalActivityLevel || '',
        weightGoalMode: data?.weightGoalMode || 'loss',
        bodyFat: data?.latestWeightBodyFat != null
          ? String(data.latestWeightBodyFat)
          : (data?.bodyFat != null ? String(data.bodyFat) : ''),
        latestWeightBodyFat: data?.latestWeightBodyFat ?? null,
        email: data?.email || user?.email || '',
        communityId: data?.communityId != null ? String(data.communityId) : '',
        bodyMetrics: data?.bodyMetrics || null,
        recoveredHealthIssues: Array.isArray(data?.recoveredHealthIssues)
          ? data.recoveredHealthIssues
          : [],
      };

      form.reload(profileData);
      setLatestWeight(data?.latestWeight ? parseFloat(data.latestWeight) : null);
      setInitialWeight(data?.initialWeight != null ? parseFloat(data.initialWeight) : null);
      setInitialWeightDate(data?.initialWeightDate || null);
      setCoachName(
        (data?.sponsorName || data?.coachName)
          ? String(data.sponsorName || data.coachName).trim()
          : '',
      );
      setIdealCoachName(data?.idealCoachName ? String(data.idealCoachName).trim() : '');
      if (data?.profileImage) setProfileImagePreview(data.profileImage);
      // Stop spinner as soon as core profile is ready — do not wait on counselling.
      setIsLoading(false);

      // Counselling pre-fill only when key fields are still empty (background).
      const needsCounsellingPrefill =
        !leadPreFilledRef.current
        && (!profileData.name || !profileData.dietType || !profileData.phone);
      if (!needsCounsellingPrefill) return;

      let counselling = null;
      try {
        if (user?.id) {
          counselling = await fetchMyAssessment(user.id);
        }
        if (!counselling) {
          const phoneForLookup = profileData.phone || user?.phoneNumber || '';
          if (phoneForLookup) {
            const lead = await fetchLeadByPhone(phoneForLookup);
            if (lead) {
              if (!profileData.name && lead.name) profileData.name = lead.name;
              if (!profileData.phone && lead.phone) profileData.phone = lead.phone;
              counselling = lead;
            }
          }
        }
        if (counselling) {
          if (!profileData.dietType && counselling.dietType) {
            profileData.dietType = counselling.dietType;
          }
          leadPreFilledRef.current = true;
          setLeadPreFilled(true);
          form.reload(profileData);
        }
      } catch {
        // Non-fatal — profile fields already shown.
      }
    } catch (e) {
      setError(e.message || 'Failed to load profile.');
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: avoid re-fetch loops from form identity
  }, [user?.email, user?.id, user?.name, user?.phoneNumber]);

  useEffect(() => {
    if (user?.email) {
      setSuccessMessage('');
      setHasSaved(false);
      setError('');
      setProfileImage(null);
      face.reset();
      loadProfile();
      return;
    }
    setIsLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: reload when identity changes
  }, [user?.email, user?.id, loadProfile]);

  const handleSave = useCallback(async () => {
    setError('');
    setSuccessMessage('');
    setIsSaving(true);
    try {
      const err = form.validate({ requireDiet: false, maxHeight: 198 });
      if (err) { setError(err); return; }
      const payload = form.payload(user.email, profileImage ? { profileImage } : {});
      // BMR is system-calculated on the profile page — never write it from this form.
      delete payload.bmr;
      const data = await saveProfile(payload);
      onProfileUpdate?.({
        name: form.name,
        height: form.height ? parseFloat(form.height) : null,
        physicalActivityLevel: form.physicalActivityLevel || null,
        dietType: form.dietType || null,
        communityId: form.communityId || null,
        profileImage: profileImagePreview || null,
      });
      if (user?.id) getUserContext(user.id).catch(() => {});
      await loadProfile();
      setSuccessMessage(data.message || 'Profile saved successfully!');
      setHasSaved(true);
      setProfileImage(null);
    } catch (e) {
      setError(e.message || 'Failed to save profile');
    } finally {
      setIsSaving(false);
    }
  }, [form, profileImage, profileImagePreview, user, loadProfile, onProfileUpdate]);

  handleSaveRef.current = handleSave;

  useEffect(() => {
    if (face.status === 'face_found' && profileImage) handleSaveRef.current?.();
  }, [face.status, profileImage]);

  const saveDisabled = isSaving || !form.nameValid ||
    !form.height || form.height.trim() === '' ||
    !form.phone || form.phone.trim() === '' ||
    !form.fatPercentValid;

  const derivedWeightGoalMode = useMemo(
    () => deriveWeightGoalMode({ heightCm: form.height, currentWeightKg: latestWeight }),
    [form.height, latestWeight],
  );

  useEffect(() => {
    if (derivedWeightGoalMode) form.setWeightGoalMode(derivedWeightGoalMode);
  }, [derivedWeightGoalMode, form.setWeightGoalMode]);

  const displayWeightGoalMode = derivedWeightGoalMode || form.weightGoalMode || 'loss';
  const displayName = form.name || user?.displayName || user?.name || 'User';
  const role = ROLE_LABELS[userRole] || 'Member';

  return (
    <div className="min-h-full bg-gray-50 pb-8">
      {cropper.showCropper && cropper.rawImageSrc && (
        <CropOverlay {...cropper} onCancel={cropper.cancelCropper} onDone={cropper.apply} zIndex={60} />
      )}

      {/* Page Header */}
      <div className="bg-gradient-to-r from-green-600 to-green-700 px-4 pt-4 pb-6">
        <div className="flex items-center gap-3 mb-4">
          <TouchFeedbackButton
            onClick={onBack}
            className="p-2 rounded-full hover:bg-green-700 transition-colors text-white"
            ariaLabel="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </TouchFeedbackButton>
          <h1 className="text-lg font-bold text-white">My Profile</h1>
        </div>

        {/* Avatar section */}
        <div className="flex items-center gap-4">
          <div
            className="relative w-20 h-20 rounded-full border-3 border-white overflow-hidden cursor-pointer group flex-shrink-0 shadow-lg"
            onClick={() => cropper.fileInputRef.current?.click()}
            style={{ border: '3px solid white' }}
          >
            {profileImagePreview ? (
              <img
                src={profileImagePreview}
                alt={displayName}
                className="w-full h-full object-cover"
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className={`w-full h-full flex items-center justify-center text-white font-bold text-3xl ${colorOf(form.name, user?.email)}`}>
                {initialOf(form.name || user?.displayName || user?.name, user?.email)}
              </div>
            )}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Camera className="w-7 h-7 text-white" />
            </div>
          </div>
          <input
            ref={cropper.fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => cropper.selectFile(e.target.files?.[0])}
          />
          <div className="flex-1 min-w-0">
            <p className="text-xl font-bold text-white truncate">{displayName}</p>
            <p className="text-sm text-green-100 truncate">{user?.email}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-900">
                {role}
              </span>
              {displayWeightGoalMode && (
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border
                  ${displayWeightGoalMode === 'loss' ? 'bg-red-100 border-red-300 text-red-700' : displayWeightGoalMode === 'gain' ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-green-100 border-green-300 text-green-700'}`}>
                  <EmojiOrNative
                    emoji={displayWeightGoalMode === 'loss' ? '🔥' : displayWeightGoalMode === 'gain' ? '💪' : '⚖️'}
                    className="w-3.5 h-3.5"
                    nativeClassName="text-xs leading-none"
                  />
                  <span>
                    {displayWeightGoalMode === 'loss' ? 'Loss Mode' : displayWeightGoalMode === 'gain' ? 'Gain Mode' : 'Maintain'}
                  </span>
                </span>
              )}
              {coachName && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-white/20 text-white border border-white/40">
                  Sponsor: {coachName}
                </span>
              )}
              {idealCoachName && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-white/20 text-white border border-white/40">
                  Coach: {idealCoachName}
                </span>
              )}
            </div>
            <p className="text-xs text-green-200 mt-1">Tap photo to change</p>
          </div>
        </div>
      </div>

      {/* Page Content */}
      <div className="px-4 -mt-2 space-y-4">
        {/* Profile Form Card */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">Personal Details</h2>
          </div>
          <div className="p-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-10">
                <div className="animate-spin rounded-full h-8 w-8 border-4 border-green-500 border-t-transparent" />
              </div>
            ) : (
              <div className="space-y-5">
                {leadPreFilled && (
                  <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 text-blue-800 px-3 py-2 rounded-lg text-xs">
                    <Sparkles className="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-500" />
                    <span>Some details were pre-filled from your wellness counselling session. Please review and save.</span>
                  </div>
                )}
                <UserProfileFields
                  email={form.email}
                  setEmail={form.setEmail}
                  name={form.name} setName={form.setName}
                  height={form.height} setHeight={form.setHeight}
                  phone={form.phone} setPhone={form.setPhone}
                  gender={form.gender} setGender={form.setGender}
                  bmr={form.bmr}
                  bmrReadOnly
                  physicalActivityLevel={form.physicalActivityLevel}
                  setPhysicalActivityLevel={form.setPhysicalActivityLevel}
                  communityId={form.communityId}
                  setCommunityId={form.setCommunityId}
                />
                <UserProfileBodyMetrics
                  bodyMetrics={form.bodyMetrics}
                  onChange={form.setBodyMetricField}
                  heightCm={form.height}
                  weightKg={latestWeight}
                />
                <HealthIssuesFilterSelect
                  value={form.recoveredHealthIssues || []}
                  onChange={form.setRecoveredHealthIssues}
                />
                <IdealWeightCards
                  height={form.height}
                  latestWeight={latestWeight}
                  initialWeight={initialWeight}
                  initialWeightDate={initialWeightDate}
                />
                <DietDropdown value={form.dietType} onChange={form.setDietType} />
                <WeightModeSelector
                  height={form.height}
                  currentWeight={latestWeight}
                  fallbackMode={form.weightGoalMode || 'loss'}
                />
              </div>
            )}
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm font-medium">
            {error}
          </div>
        )}
        {successMessage && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
            {successMessage}
          </div>
        )}

        {/* Save Button */}
        {!isLoading && (
          <TouchFeedbackButton
            onClick={handleSave}
            disabled={saveDisabled}
            ariaLabel="Save profile"
            className="w-full py-3.5 bg-green-500 text-white rounded-xl font-semibold text-base disabled:opacity-50 shadow-md flex items-center justify-center gap-2"
          >
            {isSaving ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                Saving...
              </>
            ) : hasSaved ? (
              <>
                <CheckCircle className="w-5 h-5" />
                Saved
              </>
            ) : (
              'Save Profile'
            )}
          </TouchFeedbackButton>
        )}

        {/* Settings Card */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">Settings</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {/* Auto Camera Toggle */}
            <div className="px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${autoCameraEnabled ? 'bg-green-100' : 'bg-gray-100'}`}>
                  <Camera className={`w-4 h-4 ${autoCameraEnabled ? 'text-green-600' : 'text-gray-400'}`} />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Auto Camera</p>
                  <p className="text-xs text-gray-500">
                    {autoCameraEnabled ? 'Open Camera Automatically' : 'Open Camera Manually'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  const next = !autoCameraEnabled;
                  setAutoCameraEnabled(next);
                  setAutoCameraOnResumeEnabled(next);
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${autoCameraEnabled ? 'bg-green-500' : 'bg-gray-300'}`}
                aria-label="Toggle auto camera"
              >
                <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform ${autoCameraEnabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Account Actions Card */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">Account</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {/* Sign Out */}
            <TouchFeedbackButton
              onClick={onSignOut}
              className="w-full px-4 py-3.5 flex items-center gap-3 hover:bg-red-50 transition-colors"
              ariaLabel="Sign out"
            >
              <div className="p-2 rounded-full bg-red-50">
                <LogOut className="w-4 h-4 text-red-500" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium text-red-600">Sign Out</p>
                <p className="text-xs text-gray-400">Log out of your account</p>
              </div>
            </TouchFeedbackButton>
            {/* Delete Account */}
            <TouchFeedbackButton
              onClick={() => setShowDeleteModal(true)}
              className="w-full px-4 py-3.5 flex items-center gap-3 hover:bg-red-50 transition-colors"
              ariaLabel="Delete account"
            >
              <div className="p-2 rounded-full bg-red-50">
                <Trash2 className="w-4 h-4 text-red-500" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium text-red-600">Delete Account</p>
                <p className="text-xs text-gray-400">Permanently remove your data</p>
              </div>
            </TouchFeedbackButton>
          </div>
        </div>
      </div>

      {/* Delete Account Modal (still a modal — this is correct Apple guideline flow) */}
      <DeleteAccountModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        userEmail={user?.email || ''}
        onSignOut={onSignOut}
        onAccountDeleted={() => {
          setShowDeleteModal(false);
          onSignOut();
        }}
      />
    </div>
  );
};

export default UserProfilePage;
