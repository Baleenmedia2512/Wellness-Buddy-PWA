import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Save, RotateCcw, Loader2, Settings2 } from 'lucide-react';
import { getUserId } from '../../../shared/services/userIdentity';
import {
  DEFAULT_PARAMETER_CONFIG,
  PARAMETER_SECTIONS,
  WELLNESS_PARAMETERS,
} from '../domain/parameterRegistry';
import { getSectionIcon } from '../domain/parameterIcons';
import {
  fetchWellnessScoreAdminConfig,
  saveWellnessScoreAdminConfig,
} from '../services/wellnessScore.api';
import WellnessScoreSetupRow from './WellnessScoreSetupRow';
import { useTimeWindows } from '../hooks/useTimeWindows';

/**
 * Admin / developer Wellness Score Setup — enterprise layout.
 */
export default function WellnessScoreSetup({ user, apiBaseUrl, onBack }) {
  const [config, setConfig] = useState(DEFAULT_PARAMETER_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [error, setError] = useState(null);
  const timeWindows = useTimeWindows();

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
    <div className="min-h-screen bg-[#f4f7f5]">
      <header className="sticky top-0 z-20 border-b border-gray-200/80 bg-white/95 backdrop-blur safe-top">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="-ml-2 rounded-lg p-2 transition-colors hover:bg-gray-100"
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5 text-gray-700" />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="flex items-center gap-2 text-base font-bold text-gray-900">
              <Settings2 className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
              Wellness Score Setup
            </h1>
            <p className="text-xs text-gray-500">Platform-wide scoring configuration</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-4 px-4 py-4 pb-32">
        {loading && (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600" aria-label="Loading" />
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && (
          <>
            <section className="overflow-hidden rounded-2xl border border-emerald-200/80 bg-white shadow-sm">
              <div className="border-b border-emerald-100 bg-gradient-to-r from-emerald-600 to-emerald-700 px-4 py-4 text-white">
                <p className="text-xs font-semibold uppercase tracking-wide opacity-90">
                  Total daily capacity
                </p>
                <p className="mt-1 text-3xl font-bold tabular-nums">
                  {totals.points.toLocaleString()}
                  <span className="ml-1 text-base font-medium opacity-80">pts</span>
                </p>
                <p className="mt-1 text-xs opacity-90">{totals.count} active parameters</p>
              </div>
              <div className="px-4 py-3">
                <p className="text-xs leading-relaxed text-gray-600">
                  Changes apply globally to all users. Each parameter awards up to its configured max when scoring rules are met.
                </p>
              </div>
            </section>

            {PARAMETER_SECTIONS.map((section) => {
              const SectionIcon = getSectionIcon(section.id);
              const sectionParams = WELLNESS_PARAMETERS.filter((p) => p.section === section.id);
              const sectionPoints = sectionParams.reduce((sum, p) => {
                const cfg = config.find((c) => c.key === p.key);
                return cfg?.enabled !== false ? sum + (Number(cfg?.maxPoints) || 0) : sum;
              }, 0);

              return (
                <section
                  key={section.id}
                  className="overflow-hidden rounded-2xl border border-gray-200/90 bg-white shadow-sm"
                >
                  <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/80 px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <SectionIcon className="h-4 w-4 text-emerald-600" aria-hidden />
                      <h2 className="text-xs font-bold uppercase tracking-wide text-gray-700">
                        {section.label}
                      </h2>
                    </div>
                    <span className="text-xs font-semibold tabular-nums text-gray-600">
                      {sectionPoints.toLocaleString()} pts
                    </span>
                  </div>
                  <div className="space-y-2 p-3">
                    {sectionParams.map((param) => {
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
                          timeWindows={timeWindows}
                        />
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </>
        )}
      </main>

      {!loading && (
        <footer className="fixed bottom-0 left-0 right-0 z-30 border-t border-gray-200 bg-white/95 backdrop-blur safe-bottom">
          <div className="mx-auto flex max-w-lg gap-3 px-4 py-3">
            <button
              type="button"
              onClick={handleReset}
              disabled={saving}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
            >
              <RotateCcw className="h-4 w-4" aria-hidden />
              Reset
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white shadow-md transition-colors hover:bg-emerald-700 disabled:opacity-50"
            >
              {saving
                ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                : <Save className="h-4 w-4" aria-hidden />}
              {savedFlash ? 'Saved' : 'Save configuration'}
            </button>
          </div>
        </footer>
      )}
    </div>
  );
}
