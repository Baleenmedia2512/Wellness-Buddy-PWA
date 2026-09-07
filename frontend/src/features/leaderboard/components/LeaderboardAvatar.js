import React, { useEffect, useState } from 'react';
import {
  buildUserAvatarUrl,
  getAvatarDisplayVersion,
  subscribeAvatarDisplayVersion,
} from '../../user/services/avatarDisplayVersion';

const COLORS = [
  'bg-blue-500',
  'bg-green-500',
  'bg-purple-500',
  'bg-pink-500',
  'bg-indigo-500',
  'bg-yellow-500',
  'bg-red-500',
  'bg-teal-500',
];

/**
 * Leaderboard strip avatar — always loads /api/user/avatar?userId=
 * (same source + My Profile fallback: ProfileImage / R2 → centre transform).
 * Falls back to letter when the endpoint 404s.
 *
 * `profileImage` is accepted for API compatibility but ignored so list payloads
 * cannot diverge from My Profile.
 */
export default function LeaderboardAvatar({
  apiBaseUrl,
  userId,
  email,
  userName,
  profileImage: _profileImage,
}) {
  const [failed, setFailed] = useState(false);
  const [avatarVersion, setAvatarVersion] = useState(getAvatarDisplayVersion);

  useEffect(() => subscribeAvatarDisplayVersion(setAvatarVersion), []);

  // Reset error state when the remote avatar generation changes (after an upload).
  useEffect(() => {
    setFailed(false);
  }, [avatarVersion, userId]);

  const remoteSrc = buildUserAvatarUrl(apiBaseUrl, userId, avatarVersion);
  const src = !failed ? remoteSrc : null;

  if (src) {
    return (
      <img
        key={src}
        src={src}
        alt={userName || 'User'}
        className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover shadow-md border-2 border-white"
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
    );
  }

  const initial = userName
    ? userName.charAt(0).toUpperCase()
    : email
      ? email.charAt(0).toUpperCase()
      : '?';
  const colorIndex = (userName || email || '').length % COLORS.length;

  return (
    <div
      className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full ${COLORS[colorIndex]} flex items-center justify-center text-white font-bold text-sm sm:text-base shadow-md`}
    >
      {initial}
    </div>
  );
}
