/**
 * EmailGateModal.jsx
 *
 * Full-screen blocking gate shown to phone-OTP users who have no email set.
 * Cannot be dismissed — user must provide a valid email before using the app.
 *
 * On save: POSTs to /api/user/save-email (userId + email).
 * On success: calls onComplete(email) so App.js can update user state.
 */
import React, { useState } from 'react';
import { Mail } from 'lucide-react';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function EmailGateModal({ user, apiBaseUrl, onComplete }) {
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const emailValid = EMAIL_RE.test(email.trim());

  const handleSave = async () => {
    setError('');
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
        body: JSON.stringify({ userId: uid, email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || 'Failed to save email. Please try again.');
        return;
      }
      onComplete(data.email || email.trim());
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-50 overflow-y-auto" style={{ zIndex: 310 }}>
      {/* Header */}
      <div className="bg-gradient-to-r from-green-500 to-green-600 px-6 pt-14 pb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="bg-white/20 rounded-full p-2">
            <Mail className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Add Your Email</h1>
        </div>
        <p className="text-green-100 text-sm">
          Your email is required to receive wellness updates and recover your account.
        </p>
      </div>

      {/* Form */}
      <div className="max-w-md mx-auto p-5 space-y-5 mt-4">
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-5 space-y-4">
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
                onKeyDown={(e) => { if (e.key === 'Enter' && emailValid) handleSave(); }}
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
          disabled={!emailValid || saving}
          className="w-full py-4 bg-gradient-to-r from-green-500 to-green-600 text-white font-bold rounded-xl shadow-lg disabled:opacity-50 transition-all"
        >
          {saving ? 'Saving…' : 'Save & Continue'}
        </button>

        <p className="text-center text-xs text-gray-400">
          This is a one-time setup. You can update it later in your profile.
        </p>
      </div>
    </div>
  );
}
