import React, { useEffect, useState } from 'react';
import {
  buildUserAvatarUrl,
  getAvatarDisplayVersion,
  subscribeAvatarDisplayVersion,
} from '../../user/services/avatarDisplayVersion';
import ProfilePhotoThumbnail from '../../../shared/components/ProfilePhotoThumbnail.jsx';

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
 * (same order as My Profile / Home: ProfileImage / R2, then Centre fallback).
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
  onViewProfile,
  interactive = true,
}) {
  const [failed, setFailed] = useState(false);
  const [avatarVersion, setAvatarVersion] = useState(getAvatarDisplayVersion);

  useEffect(() => subscribeAvatarDisplayVersion(setAvatarVersion), []);
  useEffect(() => setFailed(false), [avatarVersion, userId]);

  const initial = userName
    ? userName.charAt(0).toUpperCase()
    : email
      ? email.charAt(0).toUpperCase()
      : '?';
  const colorIndex = (userName || email || '').length % COLORS.length;
  const remoteSrc = buildUserAvatarUrl(apiBaseUrl, userId, avatarVersion);
  const src = !failed ? remoteSrc : null;

  if (src) {
    if (!interactive) {
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
    return (
      <ProfilePhotoThumbnail
        src={src}
        alt={userName || 'User'}
        onViewProfile={onViewProfile}
        className="shrink-0 rounded-full"
        imageClassName="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover shadow-md border-2 border-white"
        fallbackClassName={`w-8 h-8 sm:w-10 sm:h-10 rounded-full ${COLORS[colorIndex]} flex items-center justify-center text-white font-bold text-sm sm:text-base shadow-md`}
        fallback={initial}
      />
    );
  }

  if (!interactive) {
    return (
      <div
        className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full ${COLORS[colorIndex]} flex items-center justify-center text-white font-bold text-sm sm:text-base shadow-md`}
      >
        {initial}
      </div>
    );
  }

  return (
    <div
      className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full ${COLORS[colorIndex]} flex items-center justify-center text-white font-bold text-sm sm:text-base shadow-md`}
    >
      {initial}
    </div>
  );
}
