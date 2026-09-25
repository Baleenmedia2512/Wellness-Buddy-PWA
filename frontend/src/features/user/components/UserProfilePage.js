// src/features/user/components/UserProfilePage.js
//
// Inline full-page profile editor — replaces the old UserProfileModal overlay.
// Rendered as a first-class page route inside App.js (showProfilePage=true).
//
// Sections:
//   1. Avatar (tap to change — Centre transform photo / ProfileImage)
//   2. Profile fields (name, height, phone, community ID / team code, email, diet, BMR, PAL)
//   3. Transformation photos (Left / Centre / Right — same as onboarding)
//   4. Settings  (auto camera toggle)
//   5. Account actions (sign out, delete account)
//
// Lead pre-fill: on first load, if the profile has no name or phone and the
// user has a phone number from auth, the app checks for a counselling lead
// record with the same phone and pre-populates the form fields.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, LogOut, Trash2, CheckCircle, Sparkles, Camera, KeyRound } from 'lucide-react';
import { getUserContext } from '../../../shared/services/userIdentity';
import * as Session from '../../../shared/services/sessionStorage';
import {
  isAutoCameraOnResumeEnabled,
  setAutoCameraOnResumeEnabled,
} from '../../../shared/utils/autoCameraPreference';
import useProfileForm from '../hooks/useProfileForm';
import { fetchProfile, saveProfile, requestCommunityId, verifyCommunityIdOtp, requestHeightChangeOtp, verifyHeightChangeOtp } from '../services/profileService';
import { syncMarathonWeightComparisonFromProfile } from '../../marathon/marathonWeightComparisonCache';
import { loadProfileMarathonWeightComparison } from '../../marathon';
import { fetchMyAssessment, fetchLeadByPhone } from '../../counselling/services/counsellingApi';
import UserProfileFields from './profile/UserProfileFields';
import ProfileEmailKycSection from './profile/ProfileEmailKycSection';
import UserProfileBodyMetrics from './profile/UserProfileBodyMetrics';
import IdealWeightCards from './profile/IdealWeightCards';
import DietDropdown from './profile/DietDropdown';
import TransformationPhotosSection from './profile/TransformationPhotosSection';
import HealthIssuesFilterSelect from '../../body-parameters-card/components/HealthIssuesFilterSelect';
import { EmojiOrNative } from '../../../shared/components/icons/EmojiImage';
import BathroomScaleIcon from '../../../shared/components/icons/BathroomScaleIcon';
import { deriveWeightGoalMode } from '../../weight/services/weightFormService';
import DeleteAccountModal from './DeleteAccountModal';
import ChangeProfilePhotoModal from './ChangeProfilePhotoModal';
import ProfilePhotoViewer from './picture/ProfilePhotoViewer';
import TouchFeedbackButton from '../../../shared/components/TouchFeedbackButton';
import { invalidateHasTeamMembersCache } from '../../team/services/teamSearchService';
import { bumpAvatarDisplayVersion } from '../services/avatarDisplayVersion';
import { getProfile } from '../services/user.api';
import useTransformationPhotos from '../hooks/useTransformationPhotos';
import { hasValidProfileName } from '../domain/profileCompleteness';
import { isFlagEnabled } from '../../../config/featureFlags';
import { COMMUNITY_ID_OTP_FLAG } from '../domain/communityId';
import { HEIGHT_CHANGE_OTP_FLAG, isHeightLocked, validateHeightCm } from '../domain/heightChange';
import { looksLikeEmail } from '../domain/onboardingEmail';

const COLORS = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-yellow-500', 'bg-red-500', 'bg-teal-500'];
const colorOf = (name, email) => COLORS[(name || email || '').length % COLORS.length];
const initialOf = (name, email) => (name || email || 'U').charAt(0).toUpperCase();

/** Prefer any known account email — session `user.email` alone is often empty after phone OTP. */
function resolveAccountEmail(user, formEmail) {
  const otpUser = Session.getOtpUser();
  const candidates = [
    formEmail,
    user?.email,
    user?.Email,
    otpUser?.email,
    otpUser?.Email,
    Session.getUserEmail(),
  ];
  for (const c of candidates) {
    const v = String(c || '').trim();
    if (v.includes('@')) return v;
  }
  return '';
}

const ROLE_LABELS = { admin: 'Admin', developer: 'Developer', coach: 'Coach', upline: 'Upline', user: 'Customer' };

const UserProfilePage = ({ user, userRole = 'user', onBack, onSignOut, onProfileUpdate }) => {
  const form = useProfileForm();
  const transformationPhotos = useTransformationPhotos();
  const [profileImagePreview, setProfileImagePreview] = useState(null);
  const [latestWeight, setLatestWeight] = useState(null);
  const [initialWeight, setInitialWeight] = useState(null);
  const [initialWeightDate, setInitialWeightDate] = useState(null);
  const [marathonWeightComparison, setMarathonWeightComparison] = useState(null);
  const [coachName, setCoachName] = useState('');
  const [sponsorEmail, setSponsorEmail] = useState('');
  const [idealCoachName, setIdealCoachName] = useState('');
  const [teamSeat, setTeamSeat] = useState(null);
  const [communityIdRequest, setCommunityIdRequest] = useState(null);
  const [communityIdPair, setCommunityIdPair] = useState(null);
  const [communityIdBusy, setCommunityIdBusy] = useState(false);
  const [communityIdError, setCommunityIdError] = useState('');
  const [lockedHeight, setLockedHeight] = useState(null);
  const [heightOtpBusy, setHeightOtpBusy] = useState(false);
  const [heightOtpError, setHeightOtpError] = useState('');
  const [heightOtpPending, setHeightOtpPending] = useState(false);
  const [heightOtpDestination, setHeightOtpDestination] = useState('');
  const [pendingHeightCm, setPendingHeightCm] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [hasSaved, setHasSaved] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [emailKycMode, setEmailKycMode] = useState('verify'); // verify | recover
  const emailKycRef = useRef(null);
  const [showChangePhotoModal, setShowChangePhotoModal] = useState(false);
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);
  const [startPhotoRecrop, setStartPhotoRecrop] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [leadPreFilled, setLeadPreFilled] = useState(false); // true once we've pre-filled from lead
  const leadPreFilledRef = useRef(false);
  const profileLoadGenRef = useRef(0);
  const [autoCameraEnabled, setAutoCameraEnabled] = useState(
    () => isAutoCameraOnResumeEnabled()
  );

  const accountEmail = useMemo(
    () => resolveAccountEmail(user, form.email),
    [user, form.email],
  );

  // Stable identity for loads — never depend on form.email (reload updates it and
  // would re-trigger loadProfile forever → Personal Details spinner stuck).
  const sessionEmail = useMemo(
    () => resolveAccountEmail(user, null),
    [user],
  );
  const sessionUserId = user?.id || user?.UserId || user?.userId || null;

  const loadProfile = useCallback(async ({ cacheBust = true, userId: forceUserId = null, email: forceEmail = null } = {}) => {
    const emailKey = forceEmail || sessionEmail;
    const uid = forceUserId || sessionUserId;
    if (!emailKey && !uid) {
      setIsLoading(false);
      return;
    }
    const loadGen = ++profileLoadGenRef.current;
    setIsLoading(true);
    setError('');
    try {
      // Prefer userId when both exist so we always load the signed-in row.
      const { data } = await fetchProfile(
        uid
          ? { userId: uid, cacheBust }
          : { email: emailKey, cacheBust },
      );
      // Drop stale responses (e.g. previous account after Recover — phone already cleared).
      if (loadGen !== profileLoadGenRef.current) return;
      if (!data) {
        setError('Failed to load profile.');
        setIsLoading(false);
        return;
      }
      const profileData = {
        name: data?.userName || '',
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
        email: data?.email || emailKey || '',
        communityId: (() => {
          const fromProfile = data?.communityId != null ? String(data.communityId).trim() : '';
          if (fromProfile) return fromProfile;
          const pendingCode = data?.communityIdRequest?.communityId;
          if (pendingCode) return String(pendingCode).trim();
          if (data?.teamId) return String(data.teamId).trim();
          return '';
        })(),
        bodyMetrics: data?.bodyMetrics || null,
        recoveredHealthIssues: Array.isArray(data?.recoveredHealthIssues)
          ? data.recoveredHealthIssues
          : [],
      };

      form.reload(profileData);
      setLockedHeight(
        isHeightLocked(profileData.height) ? profileData.height : null,
      );
      setHeightOtpPending(false);
      setHeightOtpError('');
      setPendingHeightCm(null);
      setHeightOtpDestination('');
      setLatestWeight(data?.latestWeight ? parseFloat(data.latestWeight) : null);
      setInitialWeight(data?.initialWeight != null ? parseFloat(data.initialWeight) : null);
      setInitialWeightDate(data?.initialWeightDate || null);
      const comparisonFromServer = data?.marathonWeightComparison || null;
      setMarathonWeightComparison(comparisonFromServer);
      syncMarathonWeightComparisonFromProfile(data);
      void loadProfileMarathonWeightComparison({
        userId: uid,
        timezoneSource: data?.timezone || user,
        fromProfile: comparisonFromServer,
      }).then((resolved) => {
        if (!resolved) return;
        if (loadGen !== profileLoadGenRef.current) return;
        setMarathonWeightComparison(resolved);
        syncMarathonWeightComparisonFromProfile({ marathonWeightComparison: resolved });
      });
      setCoachName(
        (data?.sponsorName || data?.coachName)
          ? String(data.sponsorName || data.coachName).trim()
          : '',
      );
      setSponsorEmail(
        String(
          data?.communityIdRequest?.approverEmail
          || data?.sponsorEmail
          || '',
        ).trim(),
      );
      setIdealCoachName(data?.idealCoachName ? String(data.idealCoachName).trim() : '');
      setTeamSeat(data?.teamSeat || null);
      setCommunityIdRequest(data?.communityIdRequest || null);
      setCommunityIdPair(data?.communityIdPair || null);
      setCommunityIdError('');
      transformationPhotos.loadFromProfile(data?.transformationPhotos);
      if (data?.profileImage) {
        setProfileImagePreview(data.profileImage);
      } else if (data?.transformationPhotos?.front) {
        // Centre transform photo is the profile avatar.
        setProfileImagePreview(data.transformationPhotos.front);
      }
      // Stop spinner as soon as core profile is ready — do not wait on counselling.
      setIsLoading(false);

      // Counselling pre-fill only when key fields are still empty (background).
      const needsCounsellingPrefill =
        !leadPreFilledRef.current
        && (!profileData.name || !profileData.dietType || !profileData.phone);
      if (!needsCounsellingPrefill) return;

      let counselling = null;
      try {
        if (uid) {
          counselling = await fetchMyAssessment(uid);
        }
        if (loadGen !== profileLoadGenRef.current) return;
        if (!counselling) {
          const phoneForLookup = profileData.phone || user?.phoneNumber || user?.phone || '';
          if (phoneForLookup) {
            const lead = await fetchLeadByPhone(phoneForLookup);
            if (loadGen !== profileLoadGenRef.current) return;
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
      if (loadGen !== profileLoadGenRef.current) return;
      setError(e.message || 'Failed to load profile.');
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: avoid re-fetch loops from form identity
  }, [sessionEmail, sessionUserId]);

  useEffect(() => {
    if (sessionEmail || sessionUserId) {
      setSuccessMessage('');
      setHasSaved(false);
      setError('');
      loadProfile();
      return;
    }
    setIsLoading(false);
  }, [sessionEmail, sessionUserId, loadProfile]);

  const handleSave = useCallback(async () => {
    setError('');
    setSuccessMessage('');
    setIsSaving(true);
    try {
      const err = form.validate({ requireDiet: false, maxHeight: 198 });
      if (err) { setError(err); return; }
      // Only send a verified account email — unverified addresses use Profile KYC OTP.
      const emailForSave = accountEmail || undefined;
      const payload = form.payload(emailForSave, {
        userId: user?.id || undefined,
        lockedHeight,
      });
      if (!emailForSave) {
        delete payload.email;
      }
      const photoExtras = transformationPhotos.payloadExtras();
      // Only newly uploaded Centre slot updates ProfileImage (same as onboarding).
      const centrePhoto = photoExtras.transformationPhotos?.front || null;
      Object.assign(payload, photoExtras);
      if (centrePhoto) {
        payload.profileImage = centrePhoto;
      }
      if (user?.id && !payload.userId) {
        payload.userId = user.id;
      }
      const data = await saveProfile(payload);
      // Profile Left/Centre/Right stay on the profile only — do not sync to Transformation.
      if (user?.id) {
        invalidateHasTeamMembersCache(user.id);
      }
      const nextPreview = centrePhoto || profileImagePreview || null;
      if (centrePhoto) {
        setProfileImagePreview(centrePhoto);
        bumpAvatarDisplayVersion();
      }
      onProfileUpdate?.({
        name: form.name,
        height: form.height ? parseFloat(form.height) : null,
        physicalActivityLevel: form.physicalActivityLevel || null,
        dietType: form.dietType || null,
        communityId: form.communityId || null,
        profileImage: nextPreview,
        teamSearchRefresh: true,
      });
      if (user?.id) getUserContext(user.id).catch(() => {});
      // Reload while pending uploads still exist so mergePreviewsPreservingPending
      // keeps Left/Centre/Right if the server briefly returns a stale profile.
      await loadProfile({ cacheBust: true });
      transformationPhotos.clearPending();
      setSuccessMessage(data.message || 'Profile saved successfully!');
      setHasSaved(true);
    } catch (e) {
      setError(e.message || 'Failed to save profile');
    } finally {
      setIsSaving(false);
    }
  }, [
    form,
    profileImagePreview,
    user,
    accountEmail,
    loadProfile,
    onProfileUpdate,
    transformationPhotos,
    latestWeight,
    lockedHeight,
  ]);

  const handleHeightRequestOtp = useCallback(async (nextHeight) => {
    setHeightOtpError('');
    setSuccessMessage('');
    setHeightOtpBusy(true);
    try {
      const check = validateHeightCm(nextHeight);
      if (!check.valid) {
        setHeightOtpError(check.message);
        return;
      }
      const data = await requestHeightChangeOtp({
        userId: sessionUserId || undefined,
        email: accountEmail || undefined,
        height: check.value,
      });
      setPendingHeightCm(check.value);
      setHeightOtpPending(true);
      setHeightOtpDestination(data.destinationMasked || '');
      setSuccessMessage(data.message || 'Verification code sent.');
    } catch (e) {
      setHeightOtpError(e.message || 'Could not send the height verification code.');
    } finally {
      setHeightOtpBusy(false);
    }
  }, [sessionUserId, accountEmail]);

  const handleHeightVerifyOtp = useCallback(async (otp) => {
    setHeightOtpError('');
    setSuccessMessage('');
    setHeightOtpBusy(true);
    try {
      const heightValue = pendingHeightCm != null
        ? pendingHeightCm
        : validateHeightCm(form.height).value;
      if (heightValue == null) {
        setHeightOtpError('Enter a valid height before verifying.');
        return;
      }
      const data = await verifyHeightChangeOtp({
        userId: sessionUserId || undefined,
        email: accountEmail || undefined,
        height: heightValue,
        otp,
      });
      const saved = data.height != null ? String(data.height) : String(heightValue);
      form.setHeight(saved);
      setLockedHeight(saved);
      setHeightOtpPending(false);
      setPendingHeightCm(null);
      setHeightOtpDestination('');
      setSuccessMessage(data.message || 'Height updated.');
      setHasSaved(true);
      onProfileUpdate?.({
        height: parseFloat(saved),
      });
      await loadProfile({ cacheBust: true });
    } catch (e) {
      setHeightOtpError(e.message || 'That verification code did not match.');
    } finally {
      setHeightOtpBusy(false);
    }
  }, [
    pendingHeightCm,
    form,
    sessionUserId,
    accountEmail,
    onProfileUpdate,
    loadProfile,
  ]);

  const handleCommunityIdCreate = useCallback(async (code) => {
    setCommunityIdError('');
    setSuccessMessage('');
    setCommunityIdBusy(true);
    try {
      const data = await requestCommunityId({
        userId: sessionUserId || undefined,
        email: accountEmail || undefined,
        communityId: code,
      });

      // Already confirmed on the server — lock field to pencil mode (no OTP).
      if (data.alreadyOwned) {
        const seat = data.teamSeat || 'sponsor';
        setCommunityIdRequest(null);
        if (data.communityId) form.setCommunityId(String(data.communityId));
        setTeamSeat(seat);
        if (data.communityIdPair) setCommunityIdPair(data.communityIdPair);
        setSuccessMessage(data.message || 'Community ID confirmed.');
        setHasSaved(true);
        onProfileUpdate?.({
          communityId: data.communityId || null,
          teamSearchRefresh: true,
        });
        await loadProfile({ cacheBust: true });
        setTeamSeat(seat);
        return;
      }

      setCommunityIdRequest(data.communityIdRequest || null);
      if (data.communityIdRequest?.approverEmail) {
        setSponsorEmail(String(data.communityIdRequest.approverEmail).trim());
      }
      if (data.communityIdRequest?.communityId) {
        form.setCommunityId(String(data.communityIdRequest.communityId));
      }
    } catch (e) {
      setCommunityIdError(e.message || 'Could not send the approval request.');
    } finally {
      setCommunityIdBusy(false);
    }
  }, [sessionUserId, accountEmail, form, loadProfile, onProfileUpdate]);

  const handleCommunityIdVerify = useCallback(async (otp) => {
    setCommunityIdError('');
    setSuccessMessage('');
    setCommunityIdBusy(true);
    try {
      const data = await verifyCommunityIdOtp({
        userId: sessionUserId || undefined,
        email: accountEmail || undefined,
        otp,
      });
      const confirmedSeat = data.teamSeat || null;
      setCommunityIdRequest(null);
      if (data.communityId) form.setCommunityId(String(data.communityId));
      // Lock the field to pencil mode immediately — do not wait on profile reload.
      if (confirmedSeat) setTeamSeat(confirmedSeat);
      onProfileUpdate?.({
        communityId: data.communityId || null,
        teamSearchRefresh: true,
      });
      setSuccessMessage(data.message || 'Community ID confirmed.');
      setHasSaved(true);
      await loadProfile({ cacheBust: true });
      // Profile reload can briefly miss the new coach_teams seat; keep confirmed UI.
      if (confirmedSeat) {
        setTeamSeat(confirmedSeat);
      }
    } catch (e) {
      setCommunityIdError(e.message || 'That approval code did not match.');
    } finally {
      setCommunityIdBusy(false);
    }
  }, [sessionUserId, accountEmail, form, onProfileUpdate, loadProfile]);

  const handleEmailVerified = useCallback(async (result) => {
    const nextEmail = String(result?.email || '').trim();
    const adoptedUserId = result?.adopted && result?.userId ? result.userId : null;
    const nextPhone = String(result?.phone || '').trim();
    if (nextEmail) {
      form.setEmail(nextEmail);
      Session.setUserEmail(nextEmail);
    }
    // Show the moved phone immediately so a stale profile fetch for the old
    // (phone-cleared) account cannot blank the field.
    if (nextPhone && form.setPhone) {
      form.setPhone(nextPhone);
    }
    if (adoptedUserId) {
      Session.setDbUserId(adoptedUserId);
    }
    onProfileUpdate?.({
      email: nextEmail || undefined,
      name: result?.userName || form.name,
      adopted: result?.adopted === true,
      userId: result?.userId,
      phone: result?.phone,
      teamSearchRefresh: true,
    });
    const hadVerifiedEmail = looksLikeEmail(accountEmail);
    setSuccessMessage(
      result?.adopted
        ? 'Account recovered and email verified.'
        : hadVerifiedEmail
          ? 'Email updated and verified.'
          : 'Email verified. You can appear as a sponsor to new members.',
    );
    setHasSaved(true);
    // Load recovered row by new id (sessionUserId in this closure is still old).
    await loadProfile({
      cacheBust: true,
      userId: adoptedUserId || undefined,
      email: adoptedUserId ? undefined : (nextEmail || undefined),
    });
  }, [form, onProfileUpdate, loadProfile, accountEmail]);

  const handlePhotoUploaded = useCallback(async (uploadedImage) => {
    // Optimistic preview — keep previous photo if refresh fails.
    const previousPreview = profileImagePreview;
    if (uploadedImage) {
      setProfileImagePreview(uploadedImage);
    }
    setIsUploadingPhoto(true);
    setError('');
    setSuccessMessage('');
    try {
      bumpAvatarDisplayVersion();
      const emailKey = accountEmail || user?.email || user?.Email;
      let serverImage = uploadedImage || null;
      try {
        const data = await getProfile({
          email: emailKey || undefined,
          userId: user?.id || undefined,
          cacheBust: true,
        });
        if (data?.success && data?.data?.profileImage) {
          serverImage = data.data.profileImage;
          setProfileImagePreview(serverImage);
        } else if (data?.data?.transformationPhotos?.front) {
          serverImage = data.data.transformationPhotos.front;
          setProfileImagePreview(serverImage);
        }
      } catch {
        // Non-fatal — optimistic preview already applied.
      }
      onProfileUpdate?.({
        profileImage: serverImage,
        name: form.name,
        teamSearchRefresh: true,
      });
      if (emailKey) Session.markProfilePictureUploaded(emailKey);
      setSuccessMessage('Profile photo updated!');
      setHasSaved(true);
    } catch (e) {
      setProfileImagePreview(previousPreview);
      setError(e?.message || 'Failed to update profile photo.');
    } finally {
      setIsUploadingPhoto(false);
    }
  }, [profileImagePreview, accountEmail, user, form.name, onProfileUpdate]);

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
  const displayName = (() => {
    const phoneNumber = form.phone || user?.phoneNumber || user?.phone;
    const email = accountEmail || user?.email;
    const candidates = [form.name, user?.userName, user?.displayName, user?.name];
    const valid = candidates.find((n) => hasValidProfileName(n, { email, phoneNumber }));
    return valid || 'User';
  })();
  const role = ROLE_LABELS[userRole] || 'Customer';

  return (
    <div className="min-h-full bg-gray-50 pb-8">
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

        {/* Avatar — tap photo to view; Edit badge to change */}
        <div className="flex items-center gap-4">
          <div className="relative w-20 h-20 flex-shrink-0 rounded-full overflow-hidden shadow-lg border-[3px] border-white">
            <TouchFeedbackButton
              type="button"
              onClick={() => {
                if (isUploadingPhoto || isSaving) return;
                if (profileImagePreview) setShowPhotoViewer(true);
                else setShowChangePhotoModal(true);
              }}
              disabled={isUploadingPhoto || isSaving}
              className="w-full h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-70"
              ariaLabel={profileImagePreview ? 'View profile photo' : 'Add profile photo'}
              title={profileImagePreview ? 'View profile photo' : 'Add profile photo'}
            >
              {profileImagePreview ? (
                <img
                  src={profileImagePreview}
                  alt={displayName}
                  className="w-full h-full object-cover pointer-events-none"
                  loading="lazy"
                  decoding="async"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className={`w-full h-full flex items-center justify-center text-white font-bold text-3xl ${colorOf(form.name, accountEmail)}`}>
                  {initialOf(form.name || user?.displayName || user?.name, accountEmail)}
                </div>
              )}
            </TouchFeedbackButton>
            <TouchFeedbackButton
              type="button"
              onClick={() => {
                if (!isUploadingPhoto && !isSaving) setShowChangePhotoModal(true);
              }}
              disabled={isUploadingPhoto || isSaving}
              className="absolute inset-x-0 bottom-0 rounded-b-full bg-black/45 text-white text-[10px] font-semibold py-0.5 flex items-center justify-center gap-1"
              ariaLabel="Change profile photo"
              title="Change profile photo"
            >
              <Camera className="w-3 h-3" />
              {isUploadingPhoto ? '…' : 'Edit'}
            </TouchFeedbackButton>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xl font-bold text-white truncate">{displayName}</p>
            <p className="text-sm text-green-100 truncate">{accountEmail || user?.email}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-900">
                {role}
              </span>
              {displayWeightGoalMode && (
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border
                  ${displayWeightGoalMode === 'loss' ? 'bg-red-100 border-red-300 text-red-700' : displayWeightGoalMode === 'gain' ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-green-100 border-green-300 text-green-700'}`}>
                  {displayWeightGoalMode === 'maintain' ? (
                    <BathroomScaleIcon className="w-3.5 h-3.5" alt="" />
                  ) : (
                    <EmojiOrNative
                      emoji={displayWeightGoalMode === 'loss' ? '🔥' : '💪'}
                      className="w-3.5 h-3.5"
                      nativeClassName="text-xs leading-none"
                    />
                  )}
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
            {/* <p className="text-xs text-green-200 mt-1">Tap photo to change</p> */}
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
                <div ref={emailKycRef}>
                  <ProfileEmailKycSection
                    userId={user?.id || user?.UserId || user?.userId || Session.getDbUserId() || null}
                    userName={form.name}
                    verifiedEmail={accountEmail}
                    disabled={isSaving || isUploadingPhoto}
                    mode={emailKycMode}
                    onModeChange={setEmailKycMode}
                    onVerified={handleEmailVerified}
                  />
                </div>
                <UserProfileFields
                  email={form.email}
                  hideEmailField
                  name={form.name} setName={form.setName}
                  height={form.height} setHeight={form.setHeight}
                  phone={form.phone} setPhone={form.setPhone}
                  gender={form.gender} setGender={form.setGender}
                  bmr={form.bmr}
                  setBmr={form.setBmr}
                  physicalActivityLevel={form.physicalActivityLevel}
                  setPhysicalActivityLevel={form.setPhysicalActivityLevel}
                  communityId={form.communityId}
                  setCommunityId={form.setCommunityId}
                  teamSeat={teamSeat}
                  communityIdOtpEnabled={isFlagEnabled(COMMUNITY_ID_OTP_FLAG)}
                  communityIdRequest={communityIdRequest}
                  communityIdPair={communityIdPair}
                  onCommunityIdCreate={handleCommunityIdCreate}
                  onCommunityIdVerify={handleCommunityIdVerify}
                  communityIdBusy={communityIdBusy}
                  communityIdError={communityIdError}
                  sponsorName={coachName}
                  sponsorEmail={sponsorEmail}
                  heightOtpEnabled={isFlagEnabled(HEIGHT_CHANGE_OTP_FLAG)}
                  lockedHeight={lockedHeight}
                  onHeightRequestOtp={handleHeightRequestOtp}
                  onHeightVerifyOtp={handleHeightVerifyOtp}
                  heightOtpBusy={heightOtpBusy}
                  heightOtpError={heightOtpError}
                  heightOtpPending={heightOtpPending}
                  heightOtpDestination={heightOtpDestination}
                />
                <UserProfileBodyMetrics
                  bodyMetrics={form.bodyMetrics}
                  gender={form.gender}
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
                  marathonWeightComparison={marathonWeightComparison}
                />
                <DietDropdown value={form.dietType} onChange={form.setDietType} />
              </div>
            )}
          </div>
        </div>

        {/* Left / Centre / Right — same transformation_photos as onboarding */}
        {!isLoading && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700">Transformation Photos</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Left, Centre, and Right — optional. Same photos as login/onboarding.
              </p>
            </div>
            <div className="p-4">
              <TransformationPhotosSection
                selectedType={transformationPhotos.selectedType}
                onSelectType={transformationPhotos.setSelectedType}
                previews={transformationPhotos.previews}
                disabled={isSaving || isUploadingPhoto}
                onSelectFile={async (slot, file) => {
                  try {
                    setError('');
                    await transformationPhotos.setSlotFromFile(slot, file);
                  } catch (e) {
                    setError(e.message || 'Failed to prepare photo.');
                  }
                }}
              />
            </div>
          </div>
        )}


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
              onClick={() => {
                setEmailKycMode('recover');
                requestAnimationFrame(() => {
                  emailKycRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
                });
              }}
              className="w-full px-4 py-3.5 flex items-center gap-3 hover:bg-blue-50 transition-colors"
              ariaLabel="Recover account"
            >
              <div className="p-2 rounded-full bg-blue-50">
                <KeyRound className="w-4 h-4 text-blue-600" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium text-blue-700">Recover Account</p>
                <p className="text-xs text-gray-400">Restore an existing email account to this phone</p>
              </div>
            </TouchFeedbackButton>
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
            {/* Delete Account — userId + typed DELETE (no email OTP) */}
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

      <ProfilePhotoViewer
        isOpen={showPhotoViewer}
        src={profileImagePreview}
        alt={displayName}
        onClose={() => setShowPhotoViewer(false)}
        onRecrop={() => {
          setShowPhotoViewer(false);
          setStartPhotoRecrop(true);
          setShowChangePhotoModal(true);
        }}
        onChange={() => {
          setShowPhotoViewer(false);
          setShowChangePhotoModal(true);
        }}
      />

      <ChangeProfilePhotoModal
        isOpen={showChangePhotoModal}
        onClose={() => {
          setShowChangePhotoModal(false);
          setStartPhotoRecrop(false);
        }}
        user={user}
        accountEmail={accountEmail}
        currentPreviewUrl={profileImagePreview}
        startWithRecrop={startPhotoRecrop}
        onStartWithRecropConsumed={() => setStartPhotoRecrop(false)}
        onUploaded={handlePhotoUploaded}
      />

      {/* Delete Account Modal — userId + typed DELETE (Apple Guideline 5.1.1(v)) */}
      <DeleteAccountModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        userId={user?.id || user?.UserId || user?.userId || Session.getDbUserId() || null}
        accountLabel={accountEmail || form.name || form.phone || ''}
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
