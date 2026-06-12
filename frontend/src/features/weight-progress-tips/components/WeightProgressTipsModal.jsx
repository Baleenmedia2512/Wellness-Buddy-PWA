/**
 * WeightProgressTipsModal.jsx
 *
 * Shown automatically when a weight upload results in reverse progress
 * (user gained weight in loss-mode or lost weight in gain-mode).
 *
 * Sections:
 *   1. Personalised header — goal, weight change, explanation
 *   2. Yesterday's analysis — nutrition, water, workout, sleep (data-driven)
 *   3. AI recommendations — backend-generated tips
 *   4. User accountability — "Did you follow your plan?" YES / NO
 *   5. YES path — proof-type selector + image upload
 *   6. NO path — reason radio buttons (+ free-text for "Other")
 *   7. Footer — Cancel / Submit (disabled until validation passes)
 */
import React, { useState, useRef } from 'react';
import { X, AlertCircle, CheckCircle, Upload, TrendingUp, TrendingDown } from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────

const PROOF_TYPES = [
  'Meal Photo',
  'Workout Photo',
  'Water Tracking Screenshot',
  'Progress Photo',
  'Other',
];

const NO_REASONS = [
  'Missed Meals',
  'Busy Schedule',
  'Travel',
  'Forgot Tracking',
  'Lack of Motivation',
  'Medical Issue',
  'Other',
];

// ─── Sub-components ───────────────────────────────────────────────────────────

/**
 * Single row in the "Yesterday's Analysis" table.
 * Shows target (when available), consumed value, and signed difference badge.
 */
function AnalysisRow({ label, icon, target, consumed, unit, noDataLabel = 'No data recorded' }) {
  const hasConsumed = consumed != null && consumed > 0;
  const hasTarget   = target  != null && target  > 0;

  if (!hasConsumed && !hasTarget) {
    return (
      <div className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0">
        <span className="flex items-center gap-2 text-sm font-medium text-gray-700">
          {icon && <span>{icon}</span>}
          {label}
        </span>
        <span className="text-sm text-gray-400 italic">{noDataLabel}</span>
      </div>
    );
  }

  const diff = hasTarget && hasConsumed ? Math.round(consumed - target) : null;
  const diffClass =
    diff == null         ? '' :
    diff > 0             ? 'bg-red-100 text-red-700' :
    diff < 0             ? 'bg-orange-100 text-orange-700' :
                           'bg-green-100 text-green-700';

  return (
    <div className="py-2.5 border-b border-gray-100 last:border-0">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-medium text-gray-700">
          {icon && <span>{icon}</span>}
          {label}
        </span>
        {diff != null && (
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${diffClass}`}>
            {diff > 0 ? `+${diff}` : diff} {unit}
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-4 mt-0.5 text-xs text-gray-500">
        {hasTarget && (
          <span>
            Target:{' '}
            <strong className="text-gray-700">{Math.round(target)} {unit}</strong>
          </span>
        )}
        {hasConsumed && (
          <span>
            Yesterday:{' '}
            <strong className={
              diff != null
                ? diff > 50  ? 'text-red-600'
                : diff < -50 ? 'text-orange-600'
                :               'text-green-700'
                : 'text-gray-700'
            }>
              {Math.round(consumed)} {unit}
            </strong>
          </span>
        )}
      </div>
    </div>
  );
}

/** Tip card with colour-coded priority border. */
function TipCard({ tip }) {
  const borderClass =
    tip.priority === 'high'   ? 'border-red-500    bg-red-50' :
    tip.priority === 'medium' ? 'border-orange-500 bg-orange-50' :
                                'border-blue-400   bg-blue-50';

  return (
    <div className={`p-3 rounded-lg border-l-4 ${borderClass}`}>
      <p className="text-sm font-medium text-gray-800">
        {tip.icon} {tip.message}
      </p>
      <p className="text-xs text-gray-500 mt-0.5 capitalize">{tip.priority} priority</p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function WeightProgressTipsModal({
  isOpen,
  onClose,
  comparison,
  tips = [],
  goalMode,
  userName,
  onSubmitReview,
}) {
  const fileInputRef = useRef(null);

  // ── Accountability state ──────────────────────────────────────────────────
  const [followedPlan, setFollowedPlan]   = useState(null);   // null | true | false

  // YES path
  const [proofType, setProofType]         = useState('');
  const [proofFile, setProofFile]         = useState(null);   // { name, base64, preview }

  // NO path
  const [reason, setReason]               = useState('');
  const [reasonOther, setReasonOther]     = useState('');

  // Submission
  const [isSubmitting, setIsSubmitting]   = useState(false);
  const [submitError, setSubmitError]     = useState(null);

  // ── Guard ─────────────────────────────────────────────────────────────────
  if (!isOpen || !comparison) return null;

  const isFirstUpload  = comparison.weight.direction === 'first';
  const displayName    = userName || 'there';
  const goalLabel      = goalMode === 'loss' ? 'Weight Loss'
                       : goalMode === 'gain' ? 'Weight Gain'
                       : 'Weight Management';
  const weightChange   = comparison.weight.change ?? 0;
  const prevWeight     = comparison.weight.previous;
  const currWeight     = comparison.weight.current;

  const explanation = isFirstUpload
    ? `Welcome! Your starting weight is ${currWeight} kg. Let's begin your ${goalLabel.toLowerCase()} journey!`
    : goalMode === 'loss'
    ? `You gained ${Math.abs(weightChange).toFixed(1)} kg even though your goal is weight loss.`
    : `You lost ${Math.abs(weightChange).toFixed(1)} kg even though your goal is weight gain.`;

  // ── Submit validation ─────────────────────────────────────────────────────
  const canSubmit = !isFirstUpload && (
    (followedPlan === true  && proofType && proofFile) ||
    (followedPlan === false && reason && (reason !== 'Other' || reasonOther.trim().length > 0))
  );

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handlePlanToggle = (value) => {
    setFollowedPlan(value);
    // Reset opposite-path fields when switching
    if (value) {
      setReason('');
      setReasonOther('');
    } else {
      setProofType('');
      setProofFile(null);
    }
    setSubmitError(null);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      setProofFile({
        name: file.name,
        base64: evt.target.result,
        preview: evt.target.result,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!canSubmit || isSubmitting || !onSubmitReview) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmitReview({
        goalMode,
        weightChange,
        followedPlan,
        proofType:        followedPlan ? proofType  : null,
        proofImageBase64: followedPlan ? proofFile?.base64 : null,
        reason:           !followedPlan ? reason    : null,
        reasonOther:      (!followedPlan && reason === 'Other') ? reasonOther.trim() : null,
        nutritionSnapshot: {
          calories: comparison.nutrition?.yesterday?.calories ?? null,
          protein:  comparison.nutrition?.yesterday?.protein  ?? null,
          carbs:    comparison.nutrition?.yesterday?.carbs    ?? null,
          fat:      comparison.nutrition?.yesterday?.fat      ?? null,
          water:    comparison.water?.yesterday               ?? null,
          steps:    comparison.activity?.steps                ?? null,
        },
      });
      onClose();
    } catch (err) {
      setSubmitError(err.message || 'Failed to submit. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Data helpers ──────────────────────────────────────────────────────────
  const yNutrition = comparison.nutrition?.yesterday  || {};
  const targets    = comparison.targets               || {};
  const water      = comparison.water                 || {};
  const activity   = comparison.activity;

  const hasActivity = activity && (activity.steps > 0 || activity.caloriesBurned > 0);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 p-4">
      <div className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto bg-white rounded-2xl shadow-2xl flex flex-col">

        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className={`sticky top-0 z-10 ${
          isFirstUpload
            ? 'bg-gradient-to-r from-green-500 to-teal-500'
            : 'bg-gradient-to-r from-orange-500 to-red-500'
        } text-white p-6 rounded-t-2xl`}>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-full transition"
            aria-label="Close"
          >
            <X size={22} />
          </button>

          <div className="flex items-start gap-3 pr-10">
            {isFirstUpload ? <CheckCircle size={32} className="shrink-0 mt-0.5" /> : <AlertCircle size={32} className="shrink-0 mt-0.5" />}
            <div>
              <h2 className="text-xl font-bold leading-tight">
                {isFirstUpload ? '🎉 Welcome to Your Journey!' : '⚠️ Weight Progress Alert'}
              </h2>
              <p className="text-sm opacity-90 mt-0.5">Hello, <strong>{displayName}</strong></p>
              <p className="text-sm opacity-90">
                Your Goal: <strong>{goalLabel}</strong>
              </p>
            </div>
          </div>
        </div>

        {/* ── Body ─────────────────────────────────────────────────────── */}
        <div className="flex-1 p-6 space-y-6">

          {/* Weight Change Card */}
          {!isFirstUpload && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="text-center">
                  <p className="text-xs text-gray-500 mb-1">Previous</p>
                  <p className="text-2xl font-bold text-gray-800">{prevWeight} kg</p>
                </div>
                <div className="flex flex-col items-center">
                  {weightChange > 0
                    ? <TrendingUp className="text-red-500" size={28} />
                    : <TrendingDown className="text-orange-500" size={28} />
                  }
                  <span className={`text-lg font-bold ${weightChange > 0 ? 'text-red-600' : 'text-orange-600'}`}>
                    {weightChange > 0 ? '+' : ''}{weightChange} kg
                  </span>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500 mb-1">Today</p>
                  <p className="text-2xl font-bold text-orange-600">{currWeight} kg</p>
                </div>
              </div>
              <p className="text-sm text-gray-700 mt-3 text-center font-medium">
                {explanation}
              </p>
            </div>
          )}

          {isFirstUpload && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
              <p className="text-xs text-gray-500 mb-1">Starting Weight</p>
              <p className="text-4xl font-bold text-green-600">{currWeight} kg</p>
              <p className="text-sm text-gray-600 mt-2">{explanation}</p>
            </div>
          )}

          {/* Yesterday's Analysis */}
          {!isFirstUpload && (
            <section>
              <h3 className="text-base font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <span>📊</span> Yesterday&rsquo;s Analysis
              </h3>
              <div className="bg-gray-50 rounded-xl px-4 py-1 divide-y divide-gray-100">
                <AnalysisRow
                  label="Calories"
                  icon="🔥"
                  target={targets.calories || null}
                  consumed={yNutrition.calories || null}
                  unit="kcal"
                />
                <AnalysisRow
                  label="Protein"
                  icon="🥩"
                  target={targets.protein || null}
                  consumed={yNutrition.protein || null}
                  unit="g"
                />
                <AnalysisRow
                  label="Carbohydrates"
                  icon="🍞"
                  target={null}
                  consumed={yNutrition.carbs || null}
                  unit="g"
                />
                <AnalysisRow
                  label="Fat"
                  icon="🥑"
                  target={null}
                  consumed={yNutrition.fat || null}
                  unit="g"
                />
                <AnalysisRow
                  label="Water"
                  icon="💧"
                  target={water.target || null}
                  consumed={water.yesterday || null}
                  unit="ml"
                />
                {/* Sleep — no backend source, always show "No data recorded" */}
                <AnalysisRow
                  label="Sleep"
                  icon="😴"
                  target={null}
                  consumed={null}
                  unit="hrs"
                  noDataLabel="No data recorded"
                />
                {/* Workout — from daily_step_activity */}
                <div className="py-2.5">
                  <span className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                    <span>🏋️</span> Workout
                  </span>
                  {hasActivity ? (
                    <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                      <span>Steps: <strong className="text-gray-700">{(activity.steps || 0).toLocaleString()}</strong></span>
                      {activity.caloriesBurned > 0 && (
                        <span>Calories burned: <strong className="text-gray-700">{Math.round(activity.caloriesBurned)} kcal</strong></span>
                      )}
                      {activity.activityType && (
                        <span>Activity: <strong className="text-gray-700 capitalize">{activity.activityType}</strong></span>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 italic">No workout logged</p>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* AI Recommendations */}
          {tips && tips.length > 0 && (
            <section>
              <h3 className="text-base font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <span>💡</span> {isFirstUpload ? 'Getting Started Tips' : 'What Could Have Been Better Yesterday'}
              </h3>
              <div className="space-y-2">
                {tips.map((tip, i) => (
                  <TipCard key={i} tip={tip} />
                ))}
              </div>
            </section>
          )}

          {/* User Accountability — only for reverse-progress (not first upload) */}
          {!isFirstUpload && (
            <section>
              <h3 className="text-base font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <span>🎯</span> Did you follow your plan yesterday?
              </h3>
              <div className="flex gap-3">
                <button
                  onClick={() => handlePlanToggle(true)}
                  className={`flex-1 py-3 rounded-xl font-semibold text-sm transition border-2 ${
                    followedPlan === true
                      ? 'bg-green-500 border-green-500 text-white'
                      : 'bg-white border-gray-300 text-gray-700 hover:border-green-400'
                  }`}
                >
                  👍 YES, I DID
                </button>
                <button
                  onClick={() => handlePlanToggle(false)}
                  className={`flex-1 py-3 rounded-xl font-semibold text-sm transition border-2 ${
                    followedPlan === false
                      ? 'bg-red-500 border-red-500 text-white'
                      : 'bg-white border-gray-300 text-gray-700 hover:border-red-400'
                  }`}
                >
                  👎 NO, I DIDN&rsquo;T
                </button>
              </div>

              {/* ── YES path ────────────────────────────────────────── */}
              {followedPlan === true && (
                <div className="mt-4 bg-green-50 border border-green-200 rounded-xl p-4 space-y-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                      <Upload size={16} /> Upload Supporting Evidence
                    </p>
                    <p className="text-xs text-gray-500 mb-3">
                      Please upload proof that you followed your plan.
                    </p>

                    {/* Proof type selection */}
                    <div className="flex flex-wrap gap-2 mb-3">
                      {PROOF_TYPES.map((type) => (
                        <button
                          key={type}
                          onClick={() => setProofType(type)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                            proofType === type
                              ? 'bg-green-500 border-green-500 text-white'
                              : 'bg-white border-gray-300 text-gray-600 hover:border-green-400'
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>

                    {/* File upload */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-3 border-2 border-dashed border-green-400 rounded-xl text-sm text-green-700 font-medium hover:bg-green-100 transition flex items-center justify-center gap-2"
                    >
                      <Upload size={18} />
                      {proofFile ? 'Change Image' : 'Upload Image'}
                    </button>

                    {/* Image preview */}
                    {proofFile && (
                      <div className="mt-3">
                        <p className="text-xs text-gray-500 mb-1">{proofFile.name}</p>
                        <img
                          src={proofFile.preview}
                          alt="Proof"
                          className="w-full max-h-48 object-cover rounded-lg border border-green-300"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── NO path ─────────────────────────────────────────── */}
              {followedPlan === false && (
                <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
                  <p className="text-sm font-semibold text-gray-700">
                    What prevented you from following your plan?
                  </p>
                  <div className="space-y-2">
                    {NO_REASONS.map((r) => (
                      <label key={r} className="flex items-center gap-3 cursor-pointer group">
                        <input
                          type="radio"
                          name="no-reason"
                          value={r}
                          checked={reason === r}
                          onChange={() => { setReason(r); setReasonOther(''); }}
                          className="w-4 h-4 accent-red-500"
                        />
                        <span className={`text-sm transition ${reason === r ? 'text-red-700 font-medium' : 'text-gray-700 group-hover:text-red-600'}`}>
                          {r}
                        </span>
                      </label>
                    ))}
                  </div>

                  {reason === 'Other' && (
                    <textarea
                      rows={3}
                      value={reasonOther}
                      onChange={(e) => setReasonOther(e.target.value)}
                      placeholder="Enter your reason..."
                      className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm focus:border-red-400 focus:outline-none resize-none mt-2"
                    />
                  )}
                </div>
              )}
            </section>
          )}

          {/* Submit error */}
          {submitError && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
              {submitError}
            </div>
          )}
        </div>

        {/* ── Footer ───────────────────────────────────────────────────── */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 rounded-b-2xl flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 border-2 border-gray-300 rounded-xl font-semibold text-sm text-gray-700 hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          {isFirstUpload ? (
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-xl font-semibold text-sm bg-gradient-to-r from-green-500 to-teal-500 text-white hover:from-green-600 hover:to-teal-600 transition"
            >
              Start My Journey 🚀
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!canSubmit || isSubmitting}
              className={`flex-1 py-3 rounded-xl font-semibold text-sm transition ${
                canSubmit && !isSubmitting
                  ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white hover:from-orange-600 hover:to-red-600'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              {isSubmitting ? 'Submitting…' : 'Submit Response'}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
