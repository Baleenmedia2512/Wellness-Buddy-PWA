import React, { useMemo } from 'react';
import { ArrowLeft, Settings2, ClipboardList } from 'lucide-react';
import { PARAMETER_SECTIONS } from '../domain/parameterRegistry';
import { buildMockDailyScore } from '../domain/mockScoreData';
import ScoreCircularProgress from './ScoreCircularProgress';
import ScoreParameterRow from './ScoreParameterRow';

function formatDateLabel(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dt);
  target.setHours(0, 0, 0, 0);
  if (target.getTime() === today.getTime()) return 'Today';
  return dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/**
 * Full wellness score sheet — 34 parameters grouped by section.
 */
export default function WellnessScoreSheet({
  onBack,
  onOpenCoachConfig,
  showCoachConfigLink = false,
  date,
}) {
  const dateStr = date || new Date().toISOString().slice(0, 10);
  const scoreData = useMemo(() => buildMockDailyScore(dateStr), [dateStr]);

  const bySection = useMemo(() => {
    const map = new Map();
    for (const section of PARAMETER_SECTIONS) {
      map.set(section.id, {
        ...section,
        items: scoreData.parameters.filter((p) => p.section === section.id),
      });
    }
    return [...map.values()].filter((s) => s.items.length > 0);
  }, [scoreData.parameters]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-green-50">
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
            <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-emerald-600 shrink-0" aria-hidden />
              Wellness Score
            </h1>
            <p className="text-xs text-gray-500">{formatDateLabel(scoreData.date)}</p>
          </div>
          {showCoachConfigLink && onOpenCoachConfig && (
            <button
              type="button"
              onClick={onOpenCoachConfig}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold hover:bg-emerald-200 transition-colors"
            >
              <Settings2 className="w-3.5 h-3.5" aria-hidden />
              Setup
            </button>
          )}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 pb-28 space-y-5">
        {/* Overall summary */}
        <div className="bg-white/90 backdrop-blur border border-emerald-200/80 rounded-2xl p-4 shadow-md flex items-center gap-4">
          <ScoreCircularProgress
            percentage={scoreData.overallScore}
            size={96}
            subtitle="Score"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-emerald-800">Overall wellness score</p>
            <p className="text-2xl font-bold text-gray-900 mt-0.5">
              {scoreData.overallScore}
              <span className="text-base font-medium text-gray-400">/100</span>
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {scoreData.totalEarned.toLocaleString()} / {scoreData.totalPossible.toLocaleString()} points earned
            </p>
            <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all duration-700"
                style={{ width: `${scoreData.overallScore}%` }}
              />
            </div>
          </div>
        </div>

        <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-center">
          Preview UI — scores use sample data until backend is connected.
        </p>

        {/* Sections */}
        {bySection.map((section) => (
          <section key={section.id} aria-labelledby={`section-${section.id}`}>
            <div className="mb-2 px-1">
              <h2 id={`section-${section.id}`} className="text-sm font-bold text-gray-800">
                {section.label}
              </h2>
              <p className="text-[11px] text-gray-500">{section.description}</p>
            </div>
            <div className="space-y-2">
              {section.items.map((param) => (
                <ScoreParameterRow key={param.key} param={param} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
