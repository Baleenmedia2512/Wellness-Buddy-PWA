/**
 * Admin Config — who must fill each profile field, and on what schedule.
 */
import React, { useEffect, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { getUserId } from '../../../shared/services/userIdentity';
import { EVENT_LEVEL_OPTIONS } from '../../user/domain/eventProfilePrefs';
import {
  fetchFieldCollectionPolicy,
  saveFieldCollectionPolicy,
} from '../services/fieldCollection.api';

function positionsToSelection(positions) {
  if (positions === 'all' || !Array.isArray(positions)) {
    return { all: true, picked: [...EVENT_LEVEL_OPTIONS] };
  }
  return { all: false, picked: positions };
}

export default function FieldCollectionSetup({ user, apiBaseUrl }) {
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const userId = (await getUserId(user)) || user?.id;
        const data = await fetchFieldCollectionPolicy({
          requesterUserId: userId,
          requesterEmail: user?.email || user?.Email || null,
          apiBaseUrl,
        });
        if (!cancelled) setFields(data?.fields || []);
      } catch (err) {
        if (!cancelled) setError(err?.message || 'Could not load field rules.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user, apiBaseUrl]);

  const updateField = (key, patch) => {
    setFields((prev) => prev.map((field) => (field.key === key ? { ...field, ...patch } : field)));
    setSaved(false);
  };

  const togglePosition = (key, position, currentlyAll, picked) => {
    if (currentlyAll) {
      updateField(key, { positions: EVENT_LEVEL_OPTIONS.filter((item) => item !== position) });
      return;
    }
    const next = picked.includes(position)
      ? picked.filter((item) => item !== position)
      : [...picked, position];
    const all = next.length === 0 || next.length === EVENT_LEVEL_OPTIONS.length;
    updateField(key, { positions: all ? 'all' : next });
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const userId = (await getUserId(user)) || user?.id;
      const data = await saveFieldCollectionPolicy({
        requesterUserId: userId,
        requesterEmail: user?.email || user?.Email || null,
        fields,
        apiBaseUrl,
      });
      setFields(data?.fields || fields);
      setSaved(true);
    } catch (err) {
      setError(err?.message || 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-4 space-y-3 pb-24">
      <p className="text-xs text-gray-600 leading-relaxed">
Manage field access, reminders, and skip limits for members and coaches
      </p>
      {fields.map((field) => {
        const selection = positionsToSelection(field.positions);
        return (
          <section key={field.key} className="rounded-2xl border border-gray-200 bg-white p-3 space-y-2 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-gray-900">{field.label}</h2>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-[11px] font-semibold text-gray-500">
                Who
                <select
                  value={field.audience}
                  onChange={(e) => updateField(field.key, { audience: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-2 text-sm text-gray-800"
                >
                  <option value="both">Member and Coach</option>
                  <option value="member">Member only</option>
                  <option value="coach">Coach only</option>
                </select>
              </label>
              <label className="text-[11px] font-semibold text-gray-500">
                When
                <select
                  value={field.phase}
                  onChange={(e) => {
                    const phase = e.target.value;
                    const patch = { phase };
                    if (phase === 'scheduled' && field.askEveryDays == null) {
                      patch.askEveryDays = 1;
                      patch.maxSkips = 2;
                      patch.mustFillWithinDays = 3;
                    }
                    updateField(field.key, patch);
                  }}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-2 text-sm text-gray-800"
                >
                  <option value="profile">On profile</option>
                  <option value="entry">While entering</option>
                  <option value="scheduled">Ask later</option>
                </select>
              </label>
            </div>
            {field.phase === 'scheduled' && (
              <div className="grid grid-cols-3 gap-2">
                <label className="text-[11px] font-semibold text-gray-500">
                  Every (days)
                  <input
                    inputMode="numeric"
                    value={field.askEveryDays ?? ''}
                    onChange={(e) => updateField(field.key, { askEveryDays: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-2 text-sm"
                  />
                </label>
                <label className="text-[11px] font-semibold text-gray-500">
                  Skips
                  <input
                    inputMode="numeric"
                    value={field.maxSkips ?? ''}
                    onChange={(e) => updateField(field.key, { maxSkips: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-2 text-sm"
                  />
                </label>
                <label className="text-[11px] font-semibold text-gray-500">
                  Must fill (days)
                  <input
                    inputMode="numeric"
                    value={field.mustFillWithinDays ?? ''}
                    onChange={(e) => updateField(field.key, { mustFillWithinDays: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-2 text-sm"
                  />
                </label>
              </div>
            )}
            <div>
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold text-gray-500">Positions</p>
                <button
                  type="button"
                  className="text-[11px] font-semibold text-emerald-700"
                  onClick={() => updateField(field.key, { positions: 'all' })}
                >
                  All positions
                </button>
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {EVENT_LEVEL_OPTIONS.map((position) => {
                  const on = selection.all || selection.picked.includes(position);
                  return (
                    <button
                      key={position}
                      type="button"
                      onClick={() => togglePosition(field.key, position, selection.all, selection.picked)}
                      className={`rounded-full px-2 py-1 text-[10px] font-semibold border ${
                        on
                          ? 'bg-emerald-50 border-emerald-400 text-emerald-800'
                          : 'bg-white border-gray-200 text-gray-500'
                      } disabled:opacity-70`}
                    >
                      {position}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        );
      })}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {saved ? <p className="text-sm text-emerald-700">Saved.</p> : null}
      <button
        type="button"
        onClick={handleSave}
        disabled={saving || fields.length === 0}
        className="w-full py-3 rounded-xl bg-emerald-600 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Save field rules
      </button>
    </div>
  );
}
