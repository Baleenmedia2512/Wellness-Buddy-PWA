/**
 * Entry fields that still block this person: Gender, Age, Height, Diet.
 * Only the keys the server marked as blocking are shown.
 */
import React, { useState } from 'react';
import { saveProfile } from '../../user/services/profileService';
import { DIET_OPTIONS } from '../../user/services/dietOptions';
import { VALID_GENDERS } from '../../user/domain/profileCompleteness';

const inputCls = 'w-full px-3 py-3 border-2 border-gray-200 rounded-xl text-base focus:outline-none focus:border-green-400';

export default function OnboardingEntryFieldsPage({ user, fields, onComplete }) {
  const [gender, setGender] = useState('');
  const [age, setAge] = useState('');
  const [height, setHeight] = useState('');
  const [diet, setDiet] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const email = user?.email || user?.Email || '';
  const userId = user?.id || user?.UserId || user?.userId;
  const asked = new Set(fields || []);

  const handleSave = async () => {
    const ageNum = parseInt(age, 10);
    const heightNum = parseFloat(height);
    if (asked.has('gender') && !VALID_GENDERS.includes(gender)) {
      setError('Select Male or Female.');
      return;
    }
    if (asked.has('age') && !(ageNum >= 1 && ageNum <= 120)) {
      setError('Enter age from 1 to 120.');
      return;
    }
    if (asked.has('height') && !(heightNum >= 50 && heightNum <= 250)) {
      setError('Enter height from 50 to 250 cm.');
      return;
    }
    if (asked.has('diet') && !diet) {
      setError('Select a diet.');
      return;
    }
    if (!email && !userId) {
      setError('Unable to identify your account. Please re-login.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {};
      // Prompts are loaded by user id. Profile save prefers email when both
      // are sent, which can write a different account and bring this form back.
      if (userId) payload.userId = userId;
      else if (email) payload.email = email;
      if (asked.has('gender')) payload.gender = gender;
      if (asked.has('age')) payload.age = ageNum;
      if (asked.has('height')) payload.height = heightNum;
      if (asked.has('diet')) payload.dietType = diet;
      await saveProfile(payload);
      const next = await onComplete?.();
      if (next?.step === 'entryFields') {
        const still = new Set(next.entryFields || []);
        const pending = ['gender', 'age', 'height', 'diet'].filter((key) => asked.has(key) && still.has(key));
        if (pending.length) {
          setError('These details did not save. Please try again.');
        }
      }
    } catch (err) {
      setError(err?.message || 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10060] bg-gray-50 flex flex-col overflow-hidden">
      <div className="bg-gradient-to-r from-green-600 to-green-700 px-5 pt-12 pb-6 text-white">
        <h1 className="text-xl font-bold">Complete your profile</h1>
        <p className="text-sm text-green-100 mt-1">These details are required now.</p>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-5">
        <div className="max-w-md mx-auto bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-4">
          {asked.has('gender') && (
            <label className="block text-sm font-semibold text-gray-700">
              Gender <span className="text-red-500">*</span>
              <select value={gender} onChange={(e) => setGender(e.target.value)} className={`${inputCls} mt-1`}>
                <option value="">Select gender</option>
                {VALID_GENDERS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
          )}
          {asked.has('age') && (
            <label className="block text-sm font-semibold text-gray-700">
              Age <span className="text-red-500">*</span>
              <input
                inputMode="numeric"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="e.g. 32"
                className={`${inputCls} mt-1`}
              />
            </label>
          )}
          {asked.has('height') && (
            <label className="block text-sm font-semibold text-gray-700">
              Height (cm) <span className="text-red-500">*</span>
              <input
                inputMode="decimal"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                placeholder="e.g. 170"
                className={`${inputCls} mt-1`}
              />
            </label>
          )}
          {asked.has('diet') && (
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">Diet <span className="text-red-500">*</span></p>
              <div className="grid grid-cols-2 gap-2">
                {DIET_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setDiet(option.value)}
                    className={`py-3 rounded-xl text-sm font-semibold border-2 ${
                      diet === option.value
                        ? 'border-green-500 bg-green-50 text-green-800'
                        : 'border-gray-200 text-gray-700'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>
      </div>
      <div className="px-4 pb-5 pt-2 bg-gray-50">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="max-w-md mx-auto block w-full py-3.5 rounded-xl bg-green-600 text-white font-bold disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save & Continue'}
        </button>
      </div>
    </div>
  );
}
