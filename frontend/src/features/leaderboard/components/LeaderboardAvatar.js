import React, { useState } from 'react';

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
 * Leaderboard strip avatar — prefers inline profileImage, else loads
 * /api/user/avatar?userId= (keeps list JSON small). Falls back to letter.
 */
export default function LeaderboardAvatar({
  apiBaseUrl,
  userId,
  email,
  userName,
  profileImage,
}) {
  const [failed, setFailed] = useState(false);

  const remoteSrc =
    apiBaseUrl && userId != null && userId !== ''
      ? `${apiBaseUrl}/api/user/avatar?userId=${encodeURIComponent(userId)}`
      : null;
  const src = !failed ? profileImage || remoteSrc : null;

  if (src) {
    return (
      <img
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
