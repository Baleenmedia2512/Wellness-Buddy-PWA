// src/shared/components/TeamMemberProfileModal/TeamMemberProfileModal.js
import React, { useState, useEffect } from 'react';
import { X, User, Mail, Ruler, Flame, Salad, Phone, Activity, Building2, HeartPulse } from 'lucide-react';
import { EmojiOrNative } from '../icons/EmojiImage';
import PhoneContactActions from '../PhoneContactActions.jsx';
import { fetchTeamMemberProfile } from './fetchTeamMemberProfile.js';
import { isCallablePhone } from '../../domain/phoneContact.js';
import { openPhoneCall } from '../../utils/phoneContactActions.js';
import FullscreenProfilePhotoViewer from '../FullscreenProfilePhotoViewer.jsx';
import { computeBmiFromHeightWeight } from '../../../features/user/domain/bmi.js';
import { formatCommunityIdPairLabel } from '../../../features/user/domain/communityId.js';
import IdealWeightCards from '../../../features/user/components/profile/IdealWeightCards.js';
import {
  BODY_METRIC_FIELDS,
  TRANSFORMATION_SLOTS,
  activityLevelLabel,
  formatCalorieTarget,
  formatMetricValue,
  healthIssueLabels,
  mediaImageSrc,
  transformationPhotoSrc,
  workingCentreName,
} from './memberProfileDisplay.js';

const DIET_LABELS = {
  veg: '🥦 Vegetarian',
  nonveg: '🍗 Non-Vegetarian',
  vegan: '🌱 Vegan',
  eggetarian: '🥚 Eggetarian',
};

function displayText(value) {
  const text = value == null ? '' : String(value).trim();
  return text || '—';
}

/**
 * TeamMemberProfileModal
 * Read-only full profile for a coach viewing a team member from Diary.
 *
 * @param {boolean}  isOpen        - Whether the modal is visible
 * @param {Function} onClose       - Close handler
 * @param {string}   memberEmail   - Email of the member whose profile to load
 * @param {number|string} memberUserId - Numeric user ID when email is unavailable
 * @param {string}   apiBaseUrl    - Base URL for API calls
 */
const TeamMemberProfileModal = ({
  isOpen,
  onClose,
  memberEmail,
  memberUserId,
  apiBaseUrl,
}) => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [enlargedPhoto, setEnlargedPhoto] = useState(null);
  const [showProfilePhoto, setShowProfilePhoto] = useState(false);
  const [avatarBroken, setAvatarBroken] = useState(false);

  useEffect(() => {
    if (!isOpen || (!memberEmail && !memberUserId)) return undefined;

    let cancelled = false;
    const fetchProfile = async () => {
      setLoading(true);
      setError('');
      setProfile(null);
      setEnlargedPhoto(null);
      setShowProfilePhoto(false);
      setAvatarBroken(false);
      try {
        const member = memberEmail || { userId: memberUserId };
        const data = await fetchTeamMemberProfile(member, apiBaseUrl);
        if (cancelled) return;
        if (data.success && data.data) {
          setProfile(data.data);
        } else {
          setError('Profile not found.');
        }
      } catch (err) {
        if (!cancelled) setError('Could not load profile. Please try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchProfile();
    return () => {
      cancelled = true;
    };
  }, [isOpen, memberEmail, memberUserId, apiBaseUrl]);

  if (!isOpen) return null;

  const phone = profile?.phoneNumber;
  const callable = isCallablePhone(phone);
  const photos = profile?.transformationPhotos || {};
  const metrics = profile?.bodyMetrics || {};
  const bmi = metrics.bmi ?? computeBmiFromHeightWeight(profile?.height, profile?.latestWeight);
  const issues = healthIssueLabels(profile?.recoveredHealthIssues);
  const pairLabel = formatCommunityIdPairLabel(profile?.communityIdPair || {});
  const centre = workingCentreName(profile?.workingPhysicalCentre);
  const activity = activityLevelLabel(profile?.physicalActivityLevel);
  const calories = formatCalorieTarget(profile?.calorieTarget);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      onClick={onClose}
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      <div className="absolute inset-0 bg-black/50" />

      <div
        className="relative w-full bg-white rounded-t-3xl shadow-2xl"
        style={{ maxHeight: '90vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-br from-green-500 to-emerald-600 px-6 pt-6 pb-16 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center active:bg-white/40"
            aria-label="Close"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            <X className="h-4 w-4 text-white" />
          </button>

          <p className="text-white/80 text-xs font-medium uppercase tracking-wider">Team Member</p>
          <h2 className="text-white text-xl font-bold mt-0.5 pr-10 truncate">
            {loading ? 'Loading…' : profile?.userName || memberEmail}
          </h2>
        </div>

        <div className="flex justify-center -mt-12 mb-4 relative z-10">
          {mediaImageSrc(profile?.profileImage || profile?.avatarUrl, apiBaseUrl) && !avatarBroken ? (
            <button
              type="button"
              onClick={() => setShowProfilePhoto(true)}
              className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              aria-label={`View ${profile?.userName || 'team member'}'s profile photo`}
            >
              <img
                src={mediaImageSrc(profile?.profileImage || profile?.avatarUrl, apiBaseUrl)}
                alt={profile?.userName || 'Team member'}
                className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg bg-white"
                onError={() => setAvatarBroken(true)}
              />
            </button>
          ) : (
            <div
              className="w-24 h-24 rounded-full border-4 border-white shadow-lg flex items-center justify-center text-white text-3xl font-bold"
              style={{ background: 'linear-gradient(135deg, #22c55e, #10b981)' }}
            >
              {profile?.userName?.charAt(0).toUpperCase() || memberEmail?.charAt(0).toUpperCase() || 'A'}
            </div>
          )}
        </div>

        <div className="px-4 pb-10">
          {loading && (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-green-500 border-t-transparent" />
            </div>
          )}

          {error && (
            <p className="text-center text-red-500 text-sm py-4">{error}</p>
          )}

          {!loading && !error && profile && (
            <div className="space-y-3">
              <SectionTitle>Profile</SectionTitle>
              <ProfileRow
                icon={<User className="h-4 w-4 text-green-600" />}
                label="Name"
                value={displayText(profile.userName)}
              />
              <ProfileRow
                icon={<Phone className="h-4 w-4 text-green-600" />}
                label="Phone"
                value={callable ? (
                  <button
                    type="button"
                    onClick={() => openPhoneCall(phone)}
                    className="text-sm font-semibold text-green-700 underline text-left"
                    aria-label={`Call ${phone}`}
                  >
                    {phone}
                  </button>
                ) : displayText(phone)}
                actions={callable ? (
                  <PhoneContactActions phone={phone} showNumber={false} />
                ) : null}
                wrap
              />
              <ProfileRow
                icon={<Mail className="h-4 w-4 text-green-600" />}
                label="Email"
                value={displayText(profile.email)}
              />
              <ProfileRow
                icon={<User className="h-4 w-4 text-green-600" />}
                label="Community ID"
                value={displayText(profile.communityId)}
                sub={pairLabel || undefined}
              />
              <ProfileRow
                icon={<Building2 className="h-4 w-4 text-green-600" />}
                label="Working Physical Centre"
                value={displayText(centre)}
              />
              <ProfileRow
                icon={<User className="h-4 w-4 text-green-600" />}
                label="Sponsor"
                value={displayText(profile.sponsorName || profile.coachName)}
              />
              <ProfileRow
                icon={<User className="h-4 w-4 text-green-600" />}
                label="Coach"
                value={displayText(profile.idealCoachName)}
              />
              <ProfileRow
                icon={<User className="h-4 w-4 text-green-600" />}
                label="Gender"
                value={displayText(profile.gender)}
              />
              <ProfileRow
                icon={<Ruler className="h-4 w-4 text-green-600" />}
                label="Height"
                value={profile.height ? `${profile.height} cm` : '—'}
              />
              <ProfileRow
                icon={<Salad className="h-4 w-4 text-green-600" />}
                label="Diet Preference"
                value={profile.dietType ? (DIET_LABELS[profile.dietType] || profile.dietType) : '—'}
              />
              <ProfileRow
                icon={<Activity className="h-4 w-4 text-green-600" />}
                label="Physical Activity"
                value={displayText(activity)}
              />
              <ProfileRow
                icon={<Flame className="h-4 w-4 text-orange-500" />}
                label="BMR"
                value={profile.latestBmr ? `${Math.round(profile.latestBmr)} kcal / day` : '—'}
              />
              <ProfileRow
                icon={<Flame className="h-4 w-4 text-orange-500" />}
                label="Calorie Target"
                value={displayText(calories)}
              />

              <SectionTitle>Body Parameters</SectionTitle>
              <div className="grid grid-cols-2 gap-2">
                {BODY_METRIC_FIELDS.map((field) => {
                  const raw = field.key === 'bmi' ? bmi : metrics[field.key];
                  return (
                    <div key={field.key} className="rounded-xl bg-gray-50 px-3 py-2">
                      <p className="text-[11px] font-medium text-gray-400">{field.label}</p>
                      <p className="text-sm font-semibold text-gray-800">
                        {displayText(formatMetricValue(field.key, raw))}
                      </p>
                    </div>
                  );
                })}
              </div>

              <ProfileRow
                icon={<HeartPulse className="h-4 w-4 text-green-600" />}
                label="Health Issues"
                value={issues.length ? issues.join(', ') : '—'}
                wrap
              />

              <SectionTitle>Weight</SectionTitle>
              <IdealWeightCards
                height={profile.height}
                latestWeight={profile.latestWeight}
                initialWeight={profile.initialWeight}
                initialWeightDate={profile.initialWeightDate}
                marathonWeightComparison={profile.marathonWeightComparison}
              />
              {!profile.height && profile.initialWeight != null && Number.isFinite(Number(profile.initialWeight)) ? (
                <ProfileRow
                  icon={<EmojiOrNative emoji="🏁" className="w-5 h-5" nativeClassName="text-base leading-none" />}
                  label="Initial Weight"
                  value={`${parseFloat(profile.initialWeight).toFixed(1)} kg`}
                />
              ) : null}
              {!profile.height && profile.latestWeight ? (
                <ProfileRow
                  icon={<EmojiOrNative emoji="📊" className="w-5 h-5" nativeClassName="text-base leading-none" />}
                  label="Current Weight"
                  value={`${parseFloat(profile.latestWeight).toFixed(1)} kg`}
                />
              ) : null}

              <SectionTitle>Transformation</SectionTitle>
              <div className="grid grid-cols-3 gap-2">
                {TRANSFORMATION_SLOTS.map((slot) => {
                  const src = transformationPhotoSrc(photos, slot.key, apiBaseUrl);
                  return (
                    <button
                      key={slot.key}
                      type="button"
                      disabled={!src}
                      onClick={() => src && setEnlargedPhoto({ src, label: slot.label })}
                      className="min-w-0 text-left"
                      aria-label={src ? `View ${slot.label} photo` : `${slot.label} photo not added`}
                    >
                      <div className="aspect-[3/4] rounded-xl overflow-hidden bg-gray-100 border border-gray-200">
                        {src ? (
                          <img src={src} alt={slot.label} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[11px] text-gray-400 px-1 text-center">
                            No photo
                          </div>
                        )}
                      </div>
                      <p className="mt-1 text-center text-xs font-semibold text-gray-600">{slot.label}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <FullscreenProfilePhotoViewer
        isOpen={Boolean(enlargedPhoto)}
        src={enlargedPhoto?.src}
        alt={enlargedPhoto?.label || 'Transformation photo'}
        title={`${profile?.userName || 'Team member'} · ${enlargedPhoto?.label || 'Transformation'}`}
        onClose={() => setEnlargedPhoto(null)}
      />
      <FullscreenProfilePhotoViewer
        isOpen={showProfilePhoto}
        src={mediaImageSrc(profile?.profileImage || profile?.avatarUrl, apiBaseUrl)}
        alt={profile?.userName || 'Team member'}
        title={`${profile?.userName || 'Team member'}'s profile photo`}
        onClose={() => setShowProfilePhoto(false)}
      />
    </div>
  );
};

const SectionTitle = ({ children }) => (
  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 px-1 pt-1">{children}</p>
);

const ProfileRow = ({ icon, label, value, highlight, sub, actions, wrap }) => (
  <div className={`flex items-center gap-3 p-3 rounded-xl ${highlight ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50'}`}>
    <div className={`flex-shrink-0 w-10 h-10 rounded-xl shadow-sm flex items-center justify-center ${highlight ? 'bg-blue-100' : 'bg-white'}`}>
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <p className={`text-xs font-medium ${highlight ? 'text-blue-500' : 'text-gray-400'}`}>{label}</p>
      {sub ? (
        <p className={`text-[10px] ${highlight ? 'text-blue-400' : 'text-gray-400'}`}>{sub}</p>
      ) : null}
      <div className={`text-sm font-semibold text-gray-800 ${wrap ? 'break-words' : 'truncate'} ${highlight ? 'text-blue-700' : ''}`}>
        {value}
      </div>
    </div>
    {actions ? <div className="flex-shrink-0">{actions}</div> : null}
  </div>
);

export default TeamMemberProfileModal;
