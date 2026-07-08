import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Save, RotateCcw, Loader2 } from 'lucide-react';
import { getUserId } from '../../../shared/services/userIdentity';
import {
  DEFAULT_PARAMETER_CONFIG,
  PARAMETER_SECTIONS,
  WELLNESS_PARAMETERS,
} from '../domain/parameterRegistry';
import {
  fetchWellnessScoreAdminConfig,
  saveWellnessScoreAdminConfig,
} from '../services/wellnessScore.api';
import WellnessScoreSetupRow from './WellnessScoreSetupRow';

/**
 * Admin / developer Wellness Score Setup — 34 parameters.
 */
export default function WellnessScoreSetup({ user, apiBaseUrl, onBack }) {
  const [config, setConfig] = useState(DEFAULT_PARAMETER_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const userId = (await getUserId(user)) || user?.id;
        if (!userId && !user?.email) throw new Error('Unable to resolve user');
        const data = await fetchWellnessScoreAdminConfig({
          requesterUserId: userId,
          requesterEmail: user?.email || null,
          apiBaseUrl,
        });
        if (!cancelled && data?.parameters) {
          setConfig(data.parameters);
        }
      } catch (err) {
        if (!cancelled) setError(err?.message || 'Failed to load configuration');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user, apiBaseUrl]);

  const totals = useMemo(() => {
    const active = config.filter((c) => c.enabled !== false);
    return {
      count: active.length,
      points: active.reduce((s, c) => s + (Number(c.maxPoints) || 0), 0),
    };
  }, [config]);

  const updateParam = (key, next) => {
    setConfig((prev) => prev.map((c) => (c.key === key ? { ...next, key } : c)));
    setSavedFlash(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const userId = (await getUserId(user)) || user?.id;
      const data = await saveWellnessScoreAdminConfig({
        requesterUserId: userId,
        requesterEmail: user?.email || null,
        parameters: config,
        apiBaseUrl,
      });
      if (data?.parameters) setConfig(data.parameters);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2500);
    } catch (err) {
      setError(err?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setConfig(DEFAULT_PARAMETER_CONFIG.map((c) => ({ ...c })));
    setSavedFlash(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-gray-100">
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-gray-200 shadow-sm safe-top">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="p-2 -ml-2 rounded-xl hover:bg-gray-100 transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-gray-900">Wellness Score Setup</h1>
            <p className="text-xs text-gray-500">Configure max points per parameter (34 total)</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 pb-32 space-y-4">
        {loading && (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" aria-label="Loading" />
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && (
          <>
            <div className="bg-emerald-600 text-white rounded-2xl p-4 shadow-md">
              <p className="text-sm font-medium opacity-90">Total possible per day</p>
              <p className="text-3xl font-bold mt-1">
                {totals.points.toLocaleString()}
                <span className="text-base font-medium opacity-80"> pts</span>
              </p>
              <p className="text-xs opacity-80 mt-1">{totals.count} active parameters</p>
            </div>

            {PARAMETER_SECTIONS.map((section) => (
              <div key={section.id} className="space-y-2">
                <h2 className="text-xs font-bold uppercase tracking-wide text-gray-500 px-1">
                  {section.label}
                </h2>
                {WELLNESS_PARAMETERS.filter((p) => p.section === section.id).map((param) => {
                  const cfg = config.find((c) => c.key === param.key) || {
                    key: param.key,
                    maxPoints: 100,
                    enabled: true,
                  };
                  return (
                    <WellnessScoreSetupRow
                      key={param.key}
                      category={param}
                      config={cfg}
                      onChange={(next) => updateParam(param.key, next)}
                    />
                  );
                })}
              </div>
            ))}
          </>
        )}
      </div>

      {!loading && (
        <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur border-t border-gray-200 safe-bottom">
          <div className="max-w-lg mx-auto px-4 py-3 flex gap-3">
            <button
              type="button"
              onClick={handleReset}
              disabled={saving}
              className="flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl border border-gray-300 text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <RotateCcw className="w-4 h-4" aria-hidden />
              Reset
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 transition-colors shadow-md disabled:opacity-50"
            >
              {saving
                ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                : <Save className="w-4 h-4" aria-hidden />}
              {savedFlash ? 'Saved!' : 'Save configuration'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
