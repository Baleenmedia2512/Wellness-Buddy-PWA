/**
 * Community Position — first field. Nothing else is asked until this is saved.
 */
import React, { useState } from 'react';
import { saveProfile } from '../../user/services/profileService';
import { EVENT_LEVEL_OPTIONS } from '../../user/domain/eventProfilePrefs';

export default function OnboardingCommunityPositionPage({ user, onComplete }) {
  const [position, setPosition] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const email = user?.email || user?.Email || '';
  const userId = user?.id || user?.UserId || user?.userId;

  const handleSave = async () => {
    if (!EVENT_LEVEL_OPTIONS.includes(position)) {
      setError('Choose your community position to continue.');
      return;
    }
    if (!email && !userId) {
      setError('Unable to identify your account. Please re-login.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = { eventLevel: position };
      if (userId) payload.userId = userId;
      else if (email) payload.email = email;
      await saveProfile(payload);
      await onComplete?.(position);
    } catch (err) {
      setError(err?.message || 'Could not save community position.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10060] bg-gray-50 flex flex-col">
      <div className="bg-gradient-to-r from-green-600 to-green-700 px-5 pt-12 pb-6 text-white">
        <h1 className="text-xl font-bold">Community Position</h1>
        <p className="text-sm text-green-100 mt-1">Required before the rest of your profile.</p>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-5">
        <div className="max-w-md mx-auto bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-2">
          {EVENT_LEVEL_OPTIONS.map((option) => {
            const selected = position === option;
            return (
              <button
                key={option}
                type="button"
                onClick={() => { setPosition(option); setError(''); }}
                className={`w-full text-left rounded-xl border px-3 py-3 text-sm font-semibold ${
                  selected
                    ? 'border-green-500 bg-green-50 text-green-800'
                    : 'border-gray-200 bg-white text-gray-800'
                }`}
              >
                {option}
              </button>
            );
          })}
          {error ? <p className="text-sm text-red-600 pt-2">{error}</p> : null}
        </div>
      </div>
      <div className="px-4 pb-5 pt-2 bg-gray-50">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !position}
          className="max-w-md mx-auto block w-full py-3.5 rounded-xl bg-green-600 text-white font-bold disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Continue'}
        </button>
      </div>
    </div>
  );
}
