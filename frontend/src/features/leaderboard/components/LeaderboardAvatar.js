import React, { useEffect, useState } from 'react';
import {
  buildUserAvatarUrl,
  getAvatarDisplayVersion,
  subscribeAvatarDisplayVersion,
  isAvatarFailed,
  markAvatarFailed,
} from '../../user/services/avatarDisplayVersion';
import {
  COLOR_HEXES,
  buildAvatarFallbackDataUri,
} from '../domain/avatarFallback.rules.js';
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
 * For share cards (interactive === false), renders the fallback initial circle
 * as an SVG Data URI underneath the image. If the user has not posted
 * a profile photo (endpoint returns 404), html2canvas paints the fallback initial circle
 * with the letter perfectly dead-center (using dominant-baseline="central").
 */
export default function LeaderboardAvatar({
  apiBaseUrl,
  userId,
  email,
  userName,
  profileImage: _profileImage,
  onViewProfile,
  interactive = true,
  sizeClass = 'w-8 h-8 sm:w-10 sm:h-10',
}) {
  const [failed, setFailed] = useState(() => isAvatarFailed(userId));
  const [avatarVersion, setAvatarVersion] = useState(getAvatarDisplayVersion);

  useEffect(() => subscribeAvatarDisplayVersion((ver) => {
    setAvatarVersion(ver);
    setFailed(isAvatarFailed(userId));
  }), [userId]);

  useEffect(() => {
    setFailed(isAvatarFailed(userId));
  }, [avatarVersion, userId]);

  const initial = userName
    ? userName.charAt(0).toUpperCase()
    : email
      ? email.charAt(0).toUpperCase()
      : '?';
  const colorIndex = (userName || email || '').length % COLORS.length;
  const remoteSrc = buildUserAvatarUrl(apiBaseUrl, userId, avatarVersion);
  const src = !failed ? remoteSrc : null;

  const handleImageError = () => {
    markAvatarFailed(userId);
    setFailed(true);
  };

  const isLarge = sizeClass?.includes('w-12');
  const sizePx = isLarge ? 48 : 36;
  const fallbackDataUri = buildAvatarFallbackDataUri(initial, COLOR_HEXES[colorIndex]);

  const renderFallbackImage = (extraStyle = {}) => (
    <img
      src={fallbackDataUri}
      alt={userName || 'User'}
      width={sizePx}
      height={sizePx}
      className={`${sizeClass} rounded-full select-none drop-shadow-sm pointer-events-none shrink-0`}
      style={{
        width: sizePx,
        height: sizePx,
        borderRadius: '50%',
        display: 'block',
        boxSizing: 'border-box',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        ...extraStyle,
      }}
      draggable={false}
    />
  );

  if (src) {
    if (!interactive) {
      return (
        <div
          className={`${sizeClass} relative rounded-full shadow-md overflow-hidden shrink-0`}
          style={{
            width: sizePx,
            height: sizePx,
            borderRadius: '50%',
            position: 'relative',
            overflow: 'hidden',
            boxSizing: 'border-box',
          }}
        >
          {/* Base fallback circle as SVG Data URI: dead-center guaranteed */}
          <img
            src={fallbackDataUri}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full rounded-full select-none pointer-events-none"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              display: 'block',
            }}
            draggable={false}
          />
          {/* Top image: painted over the base fallback circle when loaded */}
          <img
            key={src}
            src={src}
            alt={userName || 'User'}
            className="absolute inset-0 w-full h-full rounded-full object-cover border-2 border-white"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              objectFit: 'cover',
              border: '2px solid #ffffff',
              boxSizing: 'border-box',
            }}
            loading="eager"
            decoding="async"
            crossOrigin="anonymous"
            referrerPolicy="no-referrer"
            onError={handleImageError}
          />
        </div>
      );
    }
    return (
      <ProfilePhotoThumbnail
        src={src}
        alt={userName || 'User'}
        onViewProfile={onViewProfile}
        onError={handleImageError}
        className="shrink-0 rounded-full"
        imageClassName={`${sizeClass} rounded-full object-cover shadow-md border-2 border-white`}
        fallbackClassName={`${sizeClass} rounded-full overflow-hidden shrink-0`}
        fallback={
          <img
            src={fallbackDataUri}
            alt={userName || 'User'}
            className="w-full h-full rounded-full object-cover select-none pointer-events-none"
            draggable={false}
          />
        }
      />
    );
  }

  if (!interactive) {
    return renderFallbackImage();
  }

  return (
    <ProfilePhotoThumbnail
      src={null}
      alt={userName || 'User'}
      onViewProfile={onViewProfile}
      className="shrink-0 rounded-full"
      imageClassName={`${sizeClass} rounded-full object-cover shadow-md border-2 border-white`}
      fallbackClassName={`${sizeClass} rounded-full overflow-hidden shrink-0`}
      fallback={
        <img
          src={fallbackDataUri}
          alt={userName || 'User'}
          className="w-full h-full rounded-full object-cover select-none pointer-events-none"
          draggable={false}
        />
      }
    />
  );
}
