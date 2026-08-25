// OnboardingIdentityPage — after consent: display name only.
// Email is collected later on CompleteProfilePage (post sponsor OTP).
import React, { useEffect, useState, useCallback } from 'react';
import { User } from 'lucide-react';
import { fetchProfile, saveProfile, saveEmailIdentity } from '../services/profileService';
import { hasValidProfileName } from '../domain/profileCompleteness';

const inputCls = (invalid) =>
  `w-full pl-10 pr-4 py-3 border-2 rounded-xl focus:outline-none text-base bg-white ${
    invalid ? 'border-red-300 focus:border-red-400' : 'border-gray-200 focus:border-green-400'
  }`;

function sessionDisplayName(user) {
  return String(
    user?.userName
    || user?.UserName
    || user?.username
    || user?.name
    || '',
  ).trim();
}

function sessionPhone(user) {
  return user?.phoneNumber || user?.PhoneNumber || user?.phone || null;
}

/**
 * @param {{
 *   user: object,
 *   onComplete: (saved: { email?: string, userName: string }) => void | Promise<void>,
 * }} props
 */
const OnboardingIdentityPage = ({ user, onComplete }) => {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loginEmail = (user?.email || user?.Email || '').trim();
  const phone = sessionPhone(user);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const applySessionName = (emailForCheck) => {
        const fromSession = sessionDisplayName(user);
        if (hasValidProfileName(fromSession, { email: emailForCheck, phoneNumber: phone })) {
          setName(fromSession);
        }
      };

      try {
        if (!loginEmail) {
          if (mounted) {
            applySessionName('');
            setLoading(false);
          }
          return;
        }
        const result = await fetchProfile(loginEmail);
        if (!mounted) return;
        const profile = result?.data;
        const profileEmail = (profile?.email || loginEmail).trim();
        if (hasValidProfileName(profile?.userName, {
          email: profileEmail,
          phoneNumber: profile?.phoneNumber || phone,
        })) {
          setName(String(profile.userName).trim());
        } else {
          applySessionName(profileEmail);
        }
      } catch {
        if (mounted) applySessionName(loginEmail);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [loginEmail, user, phone]);

  // Validate name without email context so BCM names like "PRAVEEN" are not
  // blocked by matching a later email local-part.
  const nameValid = hasValidProfileName(name, { phoneNumber: phone });
  const canContinue = nameValid && !saving;

  const handleContinue = useCallback(async () => {
    setError('');
    if (!nameValid) {
      setError('Please enter your full name (not a temporary login username).');
      return;
    }
    setSaving(true);
    try {
      const trimmedName = String(name).trim();
      const hadEmail = !!loginEmail;
      const uid = user?.id || user?.UserId || user?.userId;

      if (!hadEmail) {
        if (!uid) {
          setError('Unable to identify your account. Please re-login.');
          return;
        }
        const saved = await saveEmailIdentity({
          userId: uid,
          name: trimmedName,
        });
        await onComplete?.({
          email: saved.email || undefined,
          userName: saved.userName || trimmedName,
        });
        return;
      }

      await saveProfile({
        email: loginEmail,
        name: trimmedName,
      });
      await onComplete?.({
        email: loginEmail,
        userName: trimmedName,
      });
    } catch (e) {
      setError(e?.message || 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [name, nameValid, onComplete, user, loginEmail]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-[80] bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-green-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[80] bg-gray-50 flex flex-col">
      <div className="bg-gradient-to-r from-green-600 to-green-700 px-4 pt-10 pb-6 text-white">
        <h1 className="text-xl font-bold">Welcome</h1>
        <p className="text-sm text-green-100 mt-1">
          What should we call you?
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="bg-white rounded-2xl shadow-sm p-5 space-y-5 max-w-md mx-auto">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Full Name <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
              <input
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your full name"
                className={inputCls(name && !nameValid)}
                style={{ fontSize: '16px' }}
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleContinue}
            disabled={!canContinue}
            className="w-full py-3.5 bg-green-500 text-white rounded-xl font-semibold text-base disabled:opacity-50 shadow-md"
          >
            {saving ? 'Saving…' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingIdentityPage;
