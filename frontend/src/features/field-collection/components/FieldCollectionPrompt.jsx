/**
 * One later field: skippable until the admin skip limit or must-fill day.
 */
import React, { useState } from 'react';
import { saveProfile } from '../../user/services/profileService';
import DiseaseMultiSelect from '../../testimonials/components/DiseaseMultiSelect';
import { EVENT_LEVEL_OPTIONS } from '../../user/domain/eventProfilePrefs';
import { recordFieldCollectionAction } from '../services/fieldCollection.api';
import { deferFieldForSession } from '../domain/sessionDefer';

const inputCls = 'w-full px-3 py-3 border-2 border-gray-200 rounded-xl text-base focus:outline-none focus:border-green-400';

function accountIds(user) {
  return {
    email: user?.email || user?.Email || '',
    userId: user?.id || user?.UserId || user?.userId || null,
  };
}

export default function FieldCollectionPrompt({ user, prompt, apiBaseUrl, onDone }) {
  const [value, setValue] = useState('');
  const [issues, setIssues] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const blocking = prompt?.mode === 'ask_blocking';
  const { email, userId } = accountIds(user);

  const saveValue = async () => {
    const payload = {};
    if (userId) payload.userId = userId;
    else if (email) payload.email = email;
    if (prompt.key === 'currentWeight') {
      const n = parseFloat(value);
      if (!(n >= 20 && n <= 300)) {
        setError('Enter weight from 20 to 300 kg.');
        return false;
      }
      payload.currentWeight = n;
    } else if (prompt.key === 'fatPercent') {
      const n = parseFloat(value);
      if (!(n >= 1 && n <= 70)) {
        setError('Enter Fat % from 1 to 70.');
        return false;
      }
      payload.bodyFat = n;
    } else if (prompt.key === 'bodyAge') {
      const n = parseFloat(value);
      if (!(n >= 1 && n <= 120)) {
        setError('Enter body age from 1 to 120.');
        return false;
      }
      payload.bodyAge = n;
    } else if (prompt.key === 'chest' || prompt.key === 'waist' || prompt.key === 'hip') {
      const n = parseFloat(value);
      if (!(n >= 30 && n <= 200)) {
        setError('Enter a measurement from 30 to 200 cm.');
        return false;
      }
      if (prompt.key === 'chest') payload.chestCm = n;
      if (prompt.key === 'waist') payload.waistCm = n;
      if (prompt.key === 'hip') payload.hipCm = n;
    } else if (prompt.key === 'healthIssues') {
      payload.recoveredHealthIssues = issues;
    } else if (prompt.key === 'communityPosition') {
      if (!EVENT_LEVEL_OPTIONS.includes(value)) {
        setError('Choose your community position.');
        return false;
      }
      payload.eventLevel = value;
    } else {
      setError('This field cannot be saved here.');
      return false;
    }
    await saveProfile(payload);
    await recordFieldCollectionAction({
      userId,
      fieldKey: prompt.key,
      action: 'filled',
      apiBaseUrl,
    });
    if (Number(prompt.askEveryDays) === 0) deferFieldForSession(userId, prompt.key);
    return true;
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const ok = await saveValue();
      if (ok) await onDone?.();
    } catch (err) {
      setError(err?.message || 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = async () => {
    setSaving(true);
    setError('');
    try {
      await recordFieldCollectionAction({
        userId,
        fieldKey: prompt.key,
        action: 'skip',
        apiBaseUrl,
      });
      if (Number(prompt.askEveryDays) === 0) deferFieldForSession(userId, prompt.key);
      await onDone?.();
    } catch (err) {
      setError(err?.message || 'Could not skip.');
    } finally {
      setSaving(false);
    }
  };

  const unit = prompt.key === 'currentWeight' ? 'kg' : (prompt.key === 'fatPercent' ? '%' : 'cm');

  return (
    <div className="fixed inset-0 z-[10060] bg-gray-50 flex flex-col">
      <div className={`px-5 pt-12 pb-6 text-white ${blocking ? 'bg-amber-600' : 'bg-emerald-600'}`}>
        <h1 className="text-xl font-bold">{prompt.label}</h1>
        <p className="text-sm text-white/90 mt-1">
          {blocking
            ? 'Required now'
            : `${prompt.skipsRemaining} skip${prompt.skipsRemaining === 1 ? '' : 's'} left`}
        </p>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-5">
        <div className="max-w-md mx-auto bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
          {prompt.key === 'communityPosition' ? (
            <div className="space-y-2">
              {EVENT_LEVEL_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => { setValue(option); setError(''); }}
                  className={`w-full text-left rounded-xl border px-3 py-3 text-sm font-semibold ${
                    value === option
                      ? 'border-green-500 bg-green-50 text-green-800'
                      : 'border-gray-200 bg-white text-gray-800'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          ) : prompt.key === 'healthIssues' ? (
            <DiseaseMultiSelect value={issues} onChange={setIssues} />
          ) : (
            <label className="block text-sm font-semibold text-gray-700">
              {prompt.label} ({unit}) <span className="text-red-500">*</span>
              <input
                inputMode="decimal"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className={`${inputCls} mt-1`}
              />
            </label>
          )}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>
      </div>
      <div className="px-4 pb-5 pt-2 bg-gray-50 space-y-2 max-w-md mx-auto w-full">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3.5 rounded-xl bg-green-600 text-white font-bold disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        {!blocking && (
          <button
            type="button"
            onClick={handleSkip}
            disabled={saving}
            className="w-full py-3 rounded-xl border border-gray-300 text-gray-700 font-semibold disabled:opacity-50"
          >
            Skip for now
          </button>
        )}
      </div>
    </div>
  );
}
