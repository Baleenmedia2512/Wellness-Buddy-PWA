import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Save, Loader2, Check, LayoutGrid } from 'lucide-react';
import { getUserId } from '../../../shared/services/userIdentity';
import {
  fetchNavAccessAdminConfig,
  saveNavAccessAdminConfig,
} from '../services/navAccess.api.js';
import {
  MATRIX_ROLES,
  MATRIX_ROLE_LABELS,
  NAV_PAGE_KEYS,
  NAV_PAGE_LABELS,
  normalizeNavAccessMatrix,
} from '../domain/navAccess.rules.js';

/**
 * Admin / developer — role × page access matrix (DB-backed, no redeploy).
 */
export default function NavPageAccessSetup({
  user,
  apiBaseUrl,
  onBack,
  embedded = false,
  /** Called after a successful Save so the live app nav can refresh immediately. */
  onSaved,
}) {
  const [matrix, setMatrix] = useState(() => normalizeNavAccessMatrix(null));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [error, setError] = useState(null);
  const savedFlashTimerRef = useRef(null);

  useEffect(() => () => {
    if (savedFlashTimerRef.current) clearTimeout(savedFlashTimerRef.current);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const userId = (await getUserId(user)) || user?.id;
        if (!userId && !user?.email) throw new Error('Unable to resolve user');
        const data = await fetchNavAccessAdminConfig({
          requesterUserId: userId,
          requesterEmail: user?.email || null,
          apiBaseUrl,
        });
        if (!cancelled && data) {
          setMatrix(normalizeNavAccessMatrix(data.matrix));
        }
      } catch (err) {
        if (!cancelled) setError(err?.message || 'Failed to load page access config');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user, apiBaseUrl]);

  const toggle = (role, pageKey) => {
    setMatrix((prev) => ({
      ...prev,
      [role]: {
        ...prev[role],
        [pageKey]: !prev[role]?.[pageKey],
      },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const userId = (await getUserId(user)) || user?.id;
      const data = await saveNavAccessAdminConfig({
        requesterUserId: userId,
        requesterEmail: user?.email || null,
        matrix: normalizeNavAccessMatrix(matrix),
        apiBaseUrl,
      });
      if (data?.matrix) setMatrix(normalizeNavAccessMatrix(data.matrix));
      setSavedFlash(true);
      if (savedFlashTimerRef.current) clearTimeout(savedFlashTimerRef.current);
      savedFlashTimerRef.current = setTimeout(() => setSavedFlash(false), 2000);
      // Refresh this device's nav tabs now (no app restart / redeploy).
      await Promise.resolve(onSaved?.());
    } catch (err) {
      setError(err?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={embedded ? 'px-4 pb-8 pt-4' : 'min-h-screen bg-[#f4f7f5]'}>
      {!embedded && (
        <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/95 backdrop-blur safe-top">
          <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="-ml-2 rounded-lg p-2 hover:bg-gray-100"
                aria-label="Go back"
              >
                <ArrowLeft className="h-5 w-5 text-gray-700" />
              </button>
            )}
            <div className="min-w-0 flex-1">
              <h1 className="flex items-center gap-2 text-base font-bold text-gray-900">
                <LayoutGrid className="h-5 w-5 text-emerald-600" aria-hidden />
                Page Access
              </h1>
              <p className="text-xs text-gray-500">Who can see each main nav tab</p>
            </div>
          </div>
        </header>
      )}

      <div className={embedded ? '' : 'mx-auto max-w-lg px-4 py-4'}>
        {embedded && (
          <div className="mb-4">
            <h2 className="flex items-center gap-2 text-sm font-bold text-gray-900">
              <LayoutGrid className="h-4 w-4 text-emerald-600" aria-hidden />
              Page Access
            </h2>
            <p className="mt-0.5 text-xs text-gray-500">
              Toggle main nav tabs per role. Changes apply without redeploy.
            </p>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-500">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            Loading…
          </div>
        ) : (
          <>
            {error && (
              <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {error}
              </div>
            )}

            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
              <table className="w-full min-w-[28rem] border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-3 py-2.5 font-semibold text-gray-700">Page</th>
                    {MATRIX_ROLES.map((role) => (
                      <th
                        key={role}
                        className="px-2 py-2.5 text-center font-semibold text-gray-700"
                      >
                        {MATRIX_ROLE_LABELS[role]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {NAV_PAGE_KEYS.map((pageKey) => (
                    <tr key={pageKey} className="border-b border-gray-50 last:border-0">
                      <td className="px-3 py-2.5 font-medium text-gray-800">
                        {NAV_PAGE_LABELS[pageKey]}
                      </td>
                      {MATRIX_ROLES.map((role) => (
                        <td key={role} className="px-2 py-2 text-center">
                          <input
                            type="checkbox"
                            className="h-4 w-4 cursor-pointer rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                            checked={Boolean(matrix[role]?.[pageKey])}
                            onChange={() => toggle(role, pageKey)}
                            aria-label={`${MATRIX_ROLE_LABELS[role]} can access ${NAV_PAGE_LABELS[pageKey]}`}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="mt-3 text-[11px] leading-relaxed text-gray-500">
              Sponsor uses the coach role. Upline accounts share Sponsor access.
              A customer who has team members (or a Sponsor / Co-Sponsor seat)
              also uses Sponsor pages — their account role may still be Customer.
              Reports also needs the Reports feature flag.
            </p>

            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : savedFlash ? (
                  <Check className="h-4 w-4" aria-hidden />
                ) : (
                  <Save className="h-4 w-4" aria-hidden />
                )}
                {saving ? 'Saving…' : savedFlash ? 'Saved' : 'Save access'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
