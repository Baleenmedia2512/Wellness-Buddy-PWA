// src/components/TeamMemberProfileModal.js
import React, { useState, useEffect } from 'react';
import { X, User, Mail, Ruler, Flame, Salad, Phone } from 'lucide-react';

const DIET_LABELS = {
  veg: '🥦 Vegetarian',
  nonveg: '🍗 Non-Vegetarian',
  vegan: '🌱 Vegan',
  eggetarian: '🥚 Eggetarian',
};

/**
 * TeamMemberProfileModal
 * Read-only profile viewer for coach to see a team member's details.
 *
 * @param {boolean}  isOpen        - Whether the modal is visible
 * @param {Function} onClose       - Close handler
 * @param {string}   memberEmail   - Email of the member whose profile to load
 * @param {string}   apiBaseUrl    - Base URL for API calls
 */
const TeamMemberProfileModal = ({ isOpen, onClose, memberEmail, apiBaseUrl }) => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen || !memberEmail) return;

    const fetchProfile = async () => {
      setLoading(true);
      setError('');
      setProfile(null);
      try {
        const base = apiBaseUrl || process.env.REACT_APP_API_BASE_URL;
        const res = await fetch(
          `${base}/api/get-user-profile?email=${encodeURIComponent(memberEmail)}&_t=${Date.now()}`,
          { cache: 'no-store', headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' } }
        );
        if (!res.ok) throw new Error('Failed to load profile');
        const data = await res.json();
        if (data.success && data.data) {
          setProfile(data.data);
        } else {
          setError('Profile not found.');
        }
      } catch (err) {
        setError('Could not load profile. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [isOpen, memberEmail, apiBaseUrl]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      onClick={onClose}
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Bottom Sheet — always full-width sheet on all screens */}
      <div
        className="relative w-full bg-white rounded-t-3xl shadow-2xl"
        style={{ maxHeight: '90vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Green header banner */}
        <div className="bg-gradient-to-br from-green-500 to-emerald-600 px-6 pt-6 pb-16 relative">
          {/* X button — top right inside header */}
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

        {/* Avatar overlapping banner */}
        <div className="flex justify-center -mt-12 mb-4 relative z-10">
          {profile?.profileImage ? (
            <img
              src={profile.profileImage}
              alt={profile.userName}
              className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg"
            />
          ) : (
            <div
              className="w-24 h-24 rounded-full border-4 border-white shadow-lg flex items-center justify-center text-white text-3xl font-bold"
              style={{ background: 'linear-gradient(135deg, #22c55e, #10b981)' }}
            >
              {profile?.userName?.charAt(0).toUpperCase() || memberEmail?.charAt(0).toUpperCase() || 'A'}
            </div>
          )}
        </div>

        {/* Body */}
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
              <ProfileRow
                icon={<User className="h-4 w-4 text-green-600" />}
                label="Name"
                value={profile.userName || '—'}
              />
              <ProfileRow
                icon={<Mail className="h-4 w-4 text-green-600" />}
                label="Email"
                value={profile.email || '—'}
              />
              <ProfileRow
                icon={<Ruler className="h-4 w-4 text-green-600" />}
                label="Height"
                value={profile.height ? `${profile.height} cm` : '—'}
              />
              <ProfileRow
                icon={<Flame className="h-4 w-4 text-orange-500" />}
                label="BMR"
                value={
                  profile.latestBmr
                    ? `${Math.round(profile.latestBmr)} kcal / day`
                    : '—'
                }
              />
              <ProfileRow
                icon={<span className="text-base">⚖️</span>}
                label="Ideal Weight"
                value={
                  profile.height
                    ? `${(23 * Math.pow(parseFloat(profile.height) / 100, 2)).toFixed(1)} kg`
                    : '—'
                }
                highlight
              />
              {/* Current Weight */}
              {profile.latestWeight && (
                <ProfileRow
                  icon={<span className="text-base">📊</span>}
                  label="Current Weight"
                  value={`${parseFloat(profile.latestWeight).toFixed(1)} kg`}
                />
              )}
              {/* Weight Mode Badge */}
              {profile.height && profile.latestWeight && (() => {
                const ideal = parseFloat((23 * Math.pow(parseFloat(profile.height) / 100, 2)).toFixed(1));
                const current = parseFloat(profile.latestWeight);
                const diff = Math.abs(current - ideal).toFixed(1);
                const isLoss = current > ideal + 0.5;
                const isGain = current < ideal - 0.5;
                if (isLoss) return (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-red-50 border border-red-200">
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-red-100 shadow-sm flex items-center justify-center">
                      <span className="text-base">🔥</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-red-400">Weight Mode</p>
                      <p className="text-sm font-semibold text-red-700">Weight Loss Mode · −{diff} kg</p>
                    </div>
                  </div>
                );
                if (isGain) return (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-orange-50 border border-orange-200">
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-orange-100 shadow-sm flex items-center justify-center">
                      <span className="text-base">🏋️</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-orange-400">Weight Mode</p>
                      <p className="text-sm font-semibold text-orange-700">Weight Gain Mode · +{diff} kg</p>
                    </div>
                  </div>
                );
                return (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-green-50 border border-green-200">
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-green-100 shadow-sm flex items-center justify-center">
                      <span className="text-base">✅</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-green-500">Weight Mode</p>
                      <p className="text-sm font-semibold text-green-700">At Ideal Weight 🎯</p>
                    </div>
                  </div>
                );
              })()}
              <ProfileRow
                icon={<Salad className="h-4 w-4 text-green-600" />}
                label="Diet Preference"
                value={
                  profile.dietType
                    ? DIET_LABELS[profile.dietType] || profile.dietType
                    : '—'
                }
              />
              {profile.phoneNumber && (
                <ProfileRow
                  icon={<Phone className="h-4 w-4 text-green-600" />}
                  label="Phone"
                  value={profile.phoneNumber}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const ProfileRow = ({ icon, label, value, highlight }) => (
  <div className={`flex items-center gap-3 p-3 rounded-xl ${highlight ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50'}`}>
    <div className={`flex-shrink-0 w-10 h-10 rounded-xl shadow-sm flex items-center justify-center ${highlight ? 'bg-blue-100' : 'bg-white'}`}>
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <p className={`text-xs font-medium ${highlight ? 'text-blue-500' : 'text-gray-400'}`}>{label}</p>
      <p className={`text-sm font-semibold truncate ${highlight ? 'text-blue-700' : 'text-gray-800'}`}>{value}</p>
    </div>
  </div>
);

export default TeamMemberProfileModal;
