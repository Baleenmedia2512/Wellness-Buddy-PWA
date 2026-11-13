/**
 * While-entering step for the profile introduction fields an admin marked required.
 */
import React, { useEffect, useState } from 'react';
import { fetchProfile, saveProfile } from '../../user/services/profileService';
import ProfileIntroFields from '../../user/components/profile/ProfileIntroFields';
import { introPayload, validateProfileIntro } from '../../user/domain/profileIntro';

function accountIds(user) {
  return {
    email: user?.email || user?.Email || '',
    userId: user?.id || user?.UserId || user?.userId || null,
  };
}

const EMPTY = {
  professionalTitle: '',
  instagram: '',
  youtube: '',
  linkedin: '',
  herbalifeJoinedOn: '',
  aboutMe: '',
  qualification: '',
  languages: [],
};

export default function OnboardingProfileIntroPage({ user, fields = [], onComplete }) {
  const [values, setValues] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const { email, userId } = accountIds(user);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await fetchProfile(userId ? { userId, email } : email);
        if (cancelled || !data) return;
        setValues({
          professionalTitle: data.professionalTitle || '',
          instagram: data.instagram || '',
          youtube: data.youtube || '',
          linkedin: data.linkedin || '',
          herbalifeJoinedOn: data.herbalifeJoinedOn || '',
          aboutMe: data.aboutMe || '',
          qualification: data.qualification || '',
          languages: Array.isArray(data.languages) ? data.languages : [],
        });
      } catch {
        // The form can still be filled if the profile read fails.
      }
    })();
    return () => { cancelled = true; };
  }, [email, userId]);

  const handleSave = async () => {
    const message = validateProfileIntro(values, fields);
    if (message) {
      setError(message);
      return;
    }
    const missing = fields.filter((key) => {
      if (key === 'languages') return !values.languages?.length;
      return !String(values[key] || '').trim();
    });
    if (missing.length > 0) {
      setError('Fill the required details to continue.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = introPayload(values, fields);
      if (userId) payload.userId = userId;
      else payload.email = email;
      await saveProfile(payload);
      await onComplete?.();
    } catch (err) {
      setError(err?.message || 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10060] bg-gray-50 flex flex-col">
      <div className="px-5 pt-12 pb-6 text-white bg-amber-600">
        <h1 className="text-xl font-bold">About you</h1>
        <p className="text-sm text-white/90 mt-1">Required now</p>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-5">
        <div className="max-w-md mx-auto">
          <ProfileIntroFields
            values={values}
            keys={fields}
            onChange={(key, next) => {
              setValues((prev) => ({ ...prev, [key]: next }));
              setError('');
            }}
          />
          {error ? <p className="text-sm text-red-600 mt-3">{error}</p> : null}
        </div>
      </div>
      <div className="px-4 pb-5 pt-2 bg-gray-50 max-w-md mx-auto w-full">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3.5 rounded-xl bg-green-600 text-white font-bold disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Continue'}
        </button>
      </div>
    </div>
  );
}
