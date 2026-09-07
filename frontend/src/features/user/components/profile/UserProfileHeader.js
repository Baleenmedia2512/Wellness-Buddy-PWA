// Header bar with avatar (Centre transform photo), role badge, name, email, close.
import React from 'react';
import { X } from 'lucide-react';
import TouchFeedbackButton from '../../../../shared/components/TouchFeedbackButton';
import { EmojiOrNative } from '../../../../shared/components/icons/EmojiImage';

const COLORS = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-yellow-500', 'bg-red-500', 'bg-teal-500'];

const initialOf = (name, email) => (name || email || 'U').charAt(0).toUpperCase();
const colorOf = (name, email) => COLORS[(name || email || '').length % COLORS.length];

const ROLE_LABELS = { admin: 'Admin', developer: 'Developer', coach: 'Coach', user: 'User' };

const UserProfileHeader = ({
  user, name, userRole, profileImagePreview,
  onClose, isSaving,
  weightGoalMode,
}) => {
  const displayName = name || user?.displayName || user?.name || 'User';
  const role = ROLE_LABELS[userRole] || 'User';
  return (
    <div className="flex items-center justify-between p-6 bg-gradient-to-r from-green-500 to-green-600 rounded-t-2xl">
      <div className="flex items-center space-x-3">
        <div className="relative w-16 h-16 rounded-full border-2 border-white overflow-hidden">
          {profileImagePreview ? (
            <img src={profileImagePreview} alt={displayName} className="w-full h-full object-cover"
              loading="lazy" decoding="async" referrerPolicy="no-referrer" />
          ) : (
            <div className={`w-full h-full flex items-center justify-center text-white font-bold text-2xl ${colorOf(name, user?.email)}`}>
              {initialOf(name || user?.displayName || user?.name, user?.email)}
            </div>
          )}
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-bold text-white">{displayName}</h2>
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-900">
              {role}
            </span>
          </div>
          <p className="text-sm text-green-50">{user?.email}</p>
        </div>
      </div>
      <div className="flex flex-col items-end gap-2">
        {weightGoalMode && (
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border-2 shadow-sm
              ${weightGoalMode === 'loss'
                ? 'bg-red-100 border-red-300 text-red-700'
                : weightGoalMode === 'gain'
                ? 'bg-blue-100 border-blue-300 text-blue-700'
                : 'bg-green-100 border-green-300 text-green-700'
              }`}
          >
            <EmojiOrNative
              emoji={weightGoalMode === 'loss' ? '🔥' : weightGoalMode === 'gain' ? '💪' : '⚖️'}
              className="w-3.5 h-3.5"
              nativeClassName="text-sm leading-none"
            />
            <span>
              {weightGoalMode === 'loss' ? 'Loss Mode' : weightGoalMode === 'gain' ? 'Gain Mode' : 'Maintain'}
            </span>
          </span>
        )}
        <TouchFeedbackButton onClick={onClose} disabled={isSaving} ariaLabel="Close"
          className="p-2 hover:bg-green-700 rounded-lg disabled:opacity-50 text-white">
          <X className="w-5 h-5 text-white" />
        </TouchFeedbackButton>
      </div>
    </div>
  );
};

export default UserProfileHeader;
