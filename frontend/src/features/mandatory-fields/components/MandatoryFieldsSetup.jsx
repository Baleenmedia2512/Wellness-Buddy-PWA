/**
 * Admin Config tab: Mandatory Profile Fields.
 * Saves only registered keys through the existing admin API.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { getUserId } from '../../../shared/services/userIdentity';
import { listCommunityPositions } from '../../user/services/communityPosition.api';
import { registeredAdminFields, validateAdminRuleDraft } from '../domain/adminRuleDraft';
import { fetchAdminMandatoryFields, saveAdminMandatoryField } from '../services/mandatoryFields.api';

const AUDIENCE_OPTIONS = [
  { value: 'member', label: 'Members' },
  { value: 'coach', label: 'Coaches' },
  { value: 'both', label: 'Both' },
];

function draftFromField(field) {
  return {
    required: field.required === true,
    audience: field.audience || 'both',
    graceType: field.graceType === 'skips' ? 'skips' : 'days',
    graceLimit: Number(field.graceLimit) || 0,
    minAppVersion: field.minAppVersion || field.editorMinAppVersion || '',
    remindEveryDays: Number(field.remindEveryDays) || 0,
    notifyEnabled: field.notifyEnabled !== false,
    positionScope: field.positionScope === 'specific' ? 'specific' : 'all',
    positionCodes: Array.isArray(field.positionCodes) ? [...field.positionCodes] : [],
  };
}

function FieldCard({ field, catalog, onSaved }) {
  const [draft, setDraft] = useState(() => draftFromField(field));
  const [codeInput, setCodeInput] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDraft(draftFromField(field));
    setConfirming(false);
    setError('');
  }, [field]);

  const set = (key, value) => {
    setSaved(false);
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const addCode = (raw) => {
    const code = String(raw || '').trim().replace(/\s+/g, ' ').toUpperCase();
    if (!code) return;
    set('positionCodes', [...new Set([...(draft.positionCodes || []), code])]);
    setCodeInput('');
  };

  const save = async () => {
    const checked = validateAdminRuleDraft(draft, field);
    if (!checked.ok) {
      setError(checked.message);
      setConfirming(false);
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSaved(field.fieldKey, checked.rule);
      setSaved(true);
      setConfirming(false);
    } catch (err) {
      setError(err?.message || 'Could not save this field.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <article className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-gray-900">{field.label}</h3>
          <p className="text-xs text-gray-500">Editor from {field.editorMinAppVersion}</p>
        </div>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-800">
          <input
            type="checkbox"
            checked={draft.required}
            onChange={(e) => set('required', e.target.checked)}
          />
          Required
        </label>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block text-sm text-gray-700">
          Audience
          <select
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
            value={draft.audience}
            onChange={(e) => set('audience', e.target.value)}
          >
            {AUDIENCE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm text-gray-700">
          Grace type
          <select
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
            value={draft.graceType}
            onChange={(e) => set('graceType', e.target.value)}
          >
            <option value="days">Days</option>
            <option value="skips">Skips</option>
          </select>
        </label>
        <label className="block text-sm text-gray-700">
          Grace limit
          <input
            type="number"
            min="0"
            step="1"
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
            value={draft.graceLimit}
            onChange={(e) => set('graceLimit', e.target.value === '' ? '' : Number(e.target.value))}
          />
        </label>
        <label className="block text-sm text-gray-700">
          Minimum app version
          <input
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
            value={draft.minAppVersion}
            onChange={(e) => set('minAppVersion', e.target.value)}
          />
        </label>
        <label className="block text-sm text-gray-700">
          Reminder interval (days)
          <input
            type="number"
            min="0"
            step="1"
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
            value={draft.remindEveryDays}
            onChange={(e) => set('remindEveryDays', e.target.value === '' ? '' : Number(e.target.value))}
          />
        </label>
        <label className="mt-6 flex items-center gap-2 text-sm text-gray-800">
          <input
            type="checkbox"
            checked={draft.notifyEnabled}
            onChange={(e) => set('notifyEnabled', e.target.checked)}
          />
          Notification setting
        </label>
      </div>

      {field.fieldKey === 'communityPosition' && (
        <div className="mt-3 rounded-xl bg-gray-50 p-3">
          <p className="text-sm font-medium text-gray-800">Accepted community positions</p>
          <p className="mt-1 text-xs text-gray-500">
            This chooses which saved positions count as filled. It does not limit who is asked.
          </p>
          <div className="mt-2 flex gap-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name={`${field.fieldKey}-scope`}
                checked={draft.positionScope !== 'specific'}
                onChange={() => set('positionScope', 'all')}
              />
              All
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name={`${field.fieldKey}-scope`}
                checked={draft.positionScope === 'specific'}
                onChange={() => set('positionScope', 'specific')}
              />
              Specific
            </label>
          </div>
          {draft.positionScope === 'specific' && (
            <div className="mt-2">
              <div className="flex gap-2">
                <input
                  className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  list={`positions-${field.fieldKey}`}
                  value={codeInput}
                  placeholder="Add a position code"
                  onChange={(e) => setCodeInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addCode(codeInput);
                    }
                  }}
                />
                <button
                  type="button"
                  className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white"
                  onClick={() => addCode(codeInput)}
                >
                  Add
                </button>
              </div>
              <datalist id={`positions-${field.fieldKey}`}>
                {catalog.map((row) => (
                  <option key={row.code} value={row.code}>{row.label || row.code}</option>
                ))}
              </datalist>
              <ul className="mt-2 flex flex-wrap gap-2">
                {(draft.positionCodes || []).map((code) => (
                  <li key={code} className="flex items-center gap-1 rounded-full bg-white px-2 py-1 text-xs ring-1 ring-gray-200">
                    {code}
                    <button
                      type="button"
                      className="text-gray-500"
                      aria-label={`Remove ${code}`}
                      onClick={() => set('positionCodes', draft.positionCodes.filter((item) => item !== code))}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <p className="mt-3 text-xs leading-5 text-gray-500">
        Zero grace blocks immediately. A reminder interval of 0 asks on every eligible visit.
        The notification setting does not turn the profile prompt on or off.
      </p>
      {error && <p className="mt-2 text-sm text-red-600" role="alert">{error}</p>}
      {saved && !error && <p className="mt-2 text-sm text-emerald-700">Saved.</p>}

      <div className="mt-3 flex gap-2">
        {!confirming ? (
          <button
            type="button"
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            disabled={saving}
            onClick={() => {
              const checked = validateAdminRuleDraft(draft, field);
              if (!checked.ok) {
                setError(checked.message);
                return;
              }
              setError('');
              setConfirming(true);
            }}
          >
            Save
          </button>
        ) : (
          <>
            <button
              type="button"
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              disabled={saving}
              onClick={save}
            >
              {saving ? 'Saving…' : 'Confirm save'}
            </button>
            <button
              type="button"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm"
              disabled={saving}
              onClick={() => setConfirming(false)}
            >
              Cancel
            </button>
          </>
        )}
      </div>
    </article>
  );
}

export default function MandatoryFieldsSetup({ user, apiBaseUrl }) {
  const [fields, setFields] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userId, setUserId] = useState(user?.id || null);
  const email = user?.email || user?.Email || '';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const id = (await getUserId(user)) || user?.id || null;
      if (!cancelled) setUserId(id);
    })();
    return () => { cancelled = true; };
  }, [user]);

  const load = useCallback(async () => {
    if (!userId && !email) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [nextFields, positions] = await Promise.all([
        fetchAdminMandatoryFields({ userId, email, apiBaseUrl }),
        listCommunityPositions().catch(() => []),
      ]);
      setFields(registeredAdminFields(nextFields));
      setCatalog(positions);
    } catch (err) {
      setError(err?.message || 'Could not load mandatory fields.');
    } finally {
      setLoading(false);
    }
  }, [userId, email, apiBaseUrl]);

  useEffect(() => { load(); }, [load]);

  const save = async (fieldKey, rule) => {
    await saveAdminMandatoryField({ userId, email, fieldKey, rule, apiBaseUrl });
    const nextFields = await fetchAdminMandatoryFields({ userId, email, apiBaseUrl });
    setFields(registeredAdminFields(nextFields));
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-4">
      <h2 className="text-lg font-bold text-gray-900">Mandatory Profile Fields</h2>
      <p className="mt-1 text-sm text-gray-600">
        Only registered profile fields can be required. A new member-editable field appears here
        after it is declared in the profile field catalog. Required stays off until you save it on.
        Grace limit 0 means the field is required immediately, with no Skip. A grace limit above 0
        keeps every grace field on one screen with Skip. Day 10 of the server clock still locks a
        field that is empty. Saving again while Required stays on does not restart that clock.
        Turning it off stops enforcement. Turning it on again starts a new 10 days.
      </p>
      {loading && <p className="mt-4 text-sm text-gray-500">Loading fields…</p>}
      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
          <p>{error}</p>
          <button type="button" className="mt-2 font-semibold underline" onClick={load}>Try again</button>
        </div>
      )}
      {!loading && !error && (
        <div className="mt-4 space-y-4">
          {fields.map((field) => (
            <FieldCard key={field.fieldKey} field={field} catalog={catalog} onSaved={save} />
          ))}
        </div>
      )}
    </div>
  );
}
