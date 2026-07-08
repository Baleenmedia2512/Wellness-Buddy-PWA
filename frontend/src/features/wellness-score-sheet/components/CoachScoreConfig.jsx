import React, { useMemo, useState } from 'react';
import { ArrowLeft, Save, RotateCcw } from 'lucide-react';
import {
  WELLNESS_PARAMETERS,
  PARAMETER_SECTIONS,
  buildDefaultCoachConfig,
} from '../domain/parameterRegistry';
import CoachScoreConfigRow from './CoachScoreConfigRow';

const STORAGE_KEY = 'wv.wellness-score-coach-config';

function loadSavedConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function mergeConfig(saved) {
  const defaults = buildDefaultCoachConfig();
  if (!saved) return defaults;
  const byKey = new Map(saved.map((c) => [c.key, c]));
  return defaults.map((d) => ({ ...d, ...byKey.get(d.key) }));
}

/**
 * Coach team scoring configuration — max marks per parameter (UI only).
 */
export default function CoachScoreConfig({ onBack }) {
  const [config, setConfig] = useState(() => mergeConfig(loadSavedConfig()));
  const [savedFlash, setSavedFlash] = useState(false);

  const bySection = useMemo(() => PARAMETER_SECTIONS.map((section) => ({
    ...section,
    params: WELLNESS_PARAMETERS.filter((p) => p.section === section.id),
  })), []);

  const totals = useMemo(() => {
    const active = config.filter((c) => {
      const spec = WELLNESS_PARAMETERS.find((p) => p.key === c.key);
      return c.enabled && spec?.scoringType !== 'deferred';
    });
    return {
      count: active.length,
      points: active.reduce((s, c) => s + (c.maxMark || 0), 0),
    };
  }, [config]);

  const updateParam = (key, next) => {
    setConfig((prev) => prev.map((c) => (c.key === key ? next : c)));
    setSavedFlash(false);
  };

  const handleSave = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2500);
    } catch {
      /* non-fatal for UI preview */
    }
  };

  const handleReset = () => {
    setConfig(buildDefaultCoachConfig());
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
            <h1 className="text-lg font-bold text-gray-900">Team scoring setup</h1>
            <p className="text-xs text-gray-500">Configure marks for your team</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 pb-32 space-y-5">
        <div className="bg-emerald-600 text-white rounded-2xl p-4 shadow-md">
          <p className="text-sm font-medium opacity-90">Total possible per day</p>
          <p className="text-3xl font-bold mt-1">
            {totals.points.toLocaleString()}
            <span className="text-base font-medium opacity-80"> pts</span>
          </p>
          <p className="text-xs opacity-80 mt-1">{totals.count} active parameters</p>
        </div>

        <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Preview UI — config saves to this device only until the API is connected.
        </p>

        {bySection.map((section) => (
          <section key={section.id}>
            <div className="mb-2 px-1">
              <h2 className="text-sm font-bold text-gray-800">{section.label}</h2>
              <p className="text-[11px] text-gray-500">{section.description}</p>
            </div>
            <div className="space-y-2">
              {section.params.map((param) => {
                const cfg = config.find((c) => c.key === param.key) || {
                  key: param.key,
                  enabled: param.defaultEnabled,
                  maxMark: param.defaultMaxMark,
                };
                return (
                  <CoachScoreConfigRow
                    key={param.key}
                    param={param}
                    config={cfg}
                    onChange={(next) => updateParam(param.key, next)}
                  />
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur border-t border-gray-200 safe-bottom">
        <div className="max-w-lg mx-auto px-4 py-3 flex gap-3">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl border border-gray-300 text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-colors"
          >
            <RotateCcw className="w-4 h-4" aria-hidden />
            Reset
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 transition-colors shadow-md"
          >
            <Save className="w-4 h-4" aria-hidden />
            {savedFlash ? 'Saved!' : 'Save configuration'}
          </button>
        </div>
      </div>
    </div>
  );
}
