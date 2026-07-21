/**
 * EmailGateModal.jsx
 *
 * Full-screen blocking gate shown to phone-OTP users who have no email set.
 * Collects name + email before coach setup so approval emails show a real name.
 *
 * On save: POSTs to /api/user/save-email (userId + name + email).
 * On success: calls onComplete({ email, userName }) so App.js can update user state.
 */
import React, { useState } from 'react';
import { Mail, User } from 'lucide-react';
import { hasValidProfileName } from '../domain/profileCompleteness';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function EmailGateModal({ user, apiBaseUrl, onComplete }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const trimmedName = name.trim();
  const trimmedEmail = email.trim();
  const emailValid = EMAIL_RE.test(trimmedEmail);
  const nameValid = trimmedName.length >= 2
    && hasValidProfileName(trimmedName, { email: trimmedEmail.toLowerCase() });
  const formValid = nameValid && emailValid;

  const handleSave = async () => {
    setError('');
    if (!nameValid) {
      setError(trimmedName.length < 2
        ? 'Please enter your full name.'
        : 'Please enter your full name (not your email address).');
      return;
    }
    if (!emailValid) {
      setError('Please enter a valid email address.');
      return;
    }
    const uid = user?.id || user?.UserId;
    if (!uid) {
      setError('Unable to identify your account. Please re-login.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/user/save-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: uid,
          name: trimmedName,
          email: trimmedEmail,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || 'Failed to save details. Please try again.');
        return;
      }
      onComplete({
        email: data.email || trimmedEmail,
        userName: data.userName || trimmedName,
      });
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-50 overflow-y-auto" style={{ zIndex: 310 }}>
      <div className="bg-gradient-to-r from-green-500 to-green-600 px-6 pt-14 pb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="bg-white/20 rounded-full p-2">
            <Mail className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Complete Your Details</h1>
        </div>
        <p className="text-green-100 text-sm">
          Your name and email help your coach recognise you and keep your account secure.
        </p>
      </div>

      <div className="max-w-md mx-auto p-5 space-y-5 mt-4">
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5 space-y-4">
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
                onChange={(e) => { setName(e.target.value); setError(''); }}
                placeholder="Enter your full name"
                style={{ fontSize: '16px' }}
                className={`w-full pl-10 pr-4 py-3 border-2 rounded-xl focus:outline-none text-base bg-white ${
                  name && !nameValid
                    ? 'border-red-300 focus:border-red-400'
                    : 'border-gray-200 focus:border-green-400'
                }`}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Shown to your coach when you request to join their team.
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Email Address <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(''); }}
                placeholder="e.g. yourname@gmail.com"
                style={{ fontSize: '16px' }}
                className={`w-full pl-10 pr-4 py-3 border-2 rounded-xl focus:outline-none text-base bg-white ${
                  email && !emailValid
                    ? 'border-red-300 focus:border-red-400'
                    : 'border-gray-200 focus:border-green-400'
                }`}
                onKeyDown={(e) => { if (e.key === 'Enter' && formValid) handleSave(); }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Used for account recovery and wellness notifications.
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
        </div>

        <button
          onClick={handleSave}
          disabled={!formValid || saving}
          className="w-full py-4 bg-gradient-to-r from-green-500 to-green-600 text-white font-bold rounded-xl shadow-lg disabled:opacity-50 transition-all"
        >
          {saving ? 'Saving…' : 'Save & Continue'}
        </button>

        <p className="text-center text-xs text-gray-400">
          This is a one-time setup. You can update these later in your profile.
        </p>
      </div>
    </div>
  );
}
