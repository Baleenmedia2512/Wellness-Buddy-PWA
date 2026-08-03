/**
 * PhysicalActivitySetup.jsx
 *
 * One-time onboarding gate shown right after the profile wizard when the user
 * has not selected a physical activity level. Runs before coach selection / OTP.
 * Cannot be dismissed without a selection.
 */
import React, { useState } from 'react';
import { Activity } from 'lucide-react';
import { PHYSICAL_ACTIVITY_OPTIONS } from '../../../shared/utils/tdeeCalculations.js';

export default function PhysicalActivitySetup({ user, apiBaseUrl, onComplete }) {
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!selected) {
      setError('Please select your physical activity level to continue.');
      return;
    }
    const email = user?.email;
    if (!email) {
      setError('Unable to identify your account. Please re-login.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`${apiBaseUrl}/api/user/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, physicalActivityLevel: selected }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || 'Failed to save. Please try again.');
        return;
      }
      await onComplete?.({
        physicalActivityLevel: selected,
        calorieTarget: data.data?.calorieTarget ?? null,
      });
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-50 overflow-y-auto" style={{ zIndex: 9999 }}>
      <div className="bg-gradient-to-r from-teal-500 to-green-600 px-6 pt-14 pb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="bg-white/20 rounded-full p-2">
            <Activity className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Physical Activity</h1>
        </div>
        <p className="text-green-100 text-sm">
          This helps us calculate your daily calorie target (TDEE).
        </p>
      </div>

      <div className="max-w-md mx-auto p-5 space-y-4 mt-2 pb-24">
        {PHYSICAL_ACTIVITY_OPTIONS.map((option) => {
          const isSelected = selected === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => { setSelected(option.id); setError(''); }}
              className={`w-full text-left rounded-2xl border p-4 transition-all ${
                isSelected
                  ? 'border-green-500 bg-green-50 shadow-md ring-2 ring-green-200'
                  : 'border-gray-200 bg-white hover:border-green-300'
              }`}
            >
              <div className="font-semibold text-gray-900">{option.label}</div>
              <div className="text-sm text-gray-600 mt-1">{option.description}</div>
            </button>
          );
        })}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !selected}
          className="w-full py-3 rounded-xl font-semibold text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving…' : 'Continue'}
        </button>
      </div>
    </div>
  );
}
