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
import { saveProfile } from '../services/profileService';

export default function PhysicalActivitySetup({ user, onComplete }) {
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!selected) {
      setError('Please select your physical activity level to continue.');
      return;
    }
    const email = (user?.email || user?.Email || '').trim();
    if (!email) {
      setError('Unable to identify your account. Please re-login.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      // saveProfile clears the shared getProfile cache so the onboarding gate
      // cannot re-read a stale profile without physicalActivityLevel.
      const data = await saveProfile({ email, physicalActivityLevel: selected });
      await onComplete?.({
        physicalActivityLevel: selected,
        calorieTarget: data.data?.calorieTarget ?? null,
      });
    } catch (err) {
      setError(err?.message || 'Network error. Please check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-50 flex flex-col overflow-hidden" style={{ zIndex: 9999 }}>
      <div className="bg-gradient-to-r from-teal-500 to-green-600 px-4 pt-10 pb-3 shrink-0">
        <div className="flex items-center gap-2 mb-0.5">
          <div className="bg-white/20 rounded-full p-1.5">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-lg font-bold text-white leading-tight">Physical Activity</h1>
        </div>
        <p className="text-green-100 text-xs leading-snug pl-9">
          This helps us calculate your daily calorie target (TDEE).
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-2 min-h-0">
        <div className="max-w-md mx-auto space-y-2">
          {PHYSICAL_ACTIVITY_OPTIONS.map((option) => {
            const isSelected = selected === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => { setSelected(option.id); setError(''); }}
                className={`w-full text-left rounded-xl border py-2.5 px-3 transition-all ${
                  isSelected
                    ? 'border-green-500 bg-green-50 shadow-md ring-2 ring-green-200'
                    : 'border-gray-200 bg-white hover:border-green-300'
                }`}
              >
                <div className="text-sm font-semibold text-gray-900">{option.label}</div>
              </button>
            );
          })}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-xs">
              {error}
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 px-4 pt-2 pb-4 bg-gray-50 border-t border-gray-100">
        <div className="max-w-md mx-auto">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !selected}
            className="w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving…' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
