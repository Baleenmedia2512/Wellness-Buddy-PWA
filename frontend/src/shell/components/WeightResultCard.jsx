/**
 * shell/components/WeightResultCard.jsx
 * ---------------------------------------------------------------------------
 * Visible weight-analysis result card shown on the home screen after a
 * weight photo is captured and saved. Displays:
 *   - The detected/corrected weight value with inline edit capability
 *   - Ideal weight strip (BMI 19–23 range from user profile height)
 *   - "vs Previous entry" diff strip with gain/loss colouring
 *
 * Extracted from App.js (2026-07-16) — JSX is byte-identical.
 * State and handlers come from useWeightCapture via App.js destructuring.
 * ---------------------------------------------------------------------------
 */
import React from 'react';
import { Pencil, Check, X as XIcon } from 'lucide-react';

export function WeightResultCard({
  weightResult,
  weightDiff,
  idealWeight,
  isEditingWeight,
  editWeightValue,
  isSavingWeightEdit,
  weightEditError,
  setEditWeightValue,
  setIsEditingWeight,
  setWeightEditError,
  handleWeightEditSave,
}) {
  return (
                <div className="bg-white rounded-xl shadow-lg border-2 border-white-200 p-6">
                  <h2 className="text-xl font-bold text-green-700 flex items-center mb-4">
                    Weight Analysis
                  </h2>

                  <div className="bg-purple-50 rounded-lg p-4 border border-purple-100 text-center flex flex-col items-center">
                    <div className="flex items-center justify-between w-full mb-1">
                      <p className="text-sm text-purple-600 font-medium">
                        Weight
                      </p>
                      {!isEditingWeight && (
                        <button
                          onClick={() => {
                            setEditWeightValue(
                              String(weightResult.weightValue),
                            );
                            setWeightEditError("");
                            setIsEditingWeight(true);
                          }}
                          className="flex items-center gap-1 text-xs text-purple-500 hover:text-purple-700 transition-colors"
                          title="Edit weight"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          Edit
                        </button>
                      )}
                    </div>

                    {isEditingWeight ? (
                      <div className="w-full mt-1">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={editWeightValue}
                            onChange={(e) => setEditWeightValue(e.target.value)}
                            className="flex-1 border border-purple-300 rounded-lg px-3 py-2 text-xl font-bold text-purple-700 text-center focus:outline-none focus:ring-2 focus:ring-purple-400"
                            inputMode="decimal"
                            step="0.1"
                            min="20"
                            max="300"
                            autoFocus
                          />
                          <span className="text-sm text-purple-600">
                            {weightResult.unit}
                          </span>
                        </div>
                        {weightEditError && (
                          <p className="text-xs text-red-500 mt-1 text-center">
                            {weightEditError}
                          </p>
                        )}
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={handleWeightEditSave}
                            disabled={isSavingWeightEdit}
                            className="flex-1 flex items-center justify-center gap-1 py-2 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
                          >
                            {isSavingWeightEdit ? (
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Check className="w-4 h-4" />
                            )}
                            {isSavingWeightEdit ? "Saving…" : "Save"}
                          </button>
                          <button
                            onClick={() => {
                              setIsEditingWeight(false);
                              setWeightEditError("");
                            }}
                            disabled={isSavingWeightEdit}
                            className="flex-1 flex items-center justify-center gap-1 py-2 bg-gray-100 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                          >
                            <XIcon className="w-4 h-4" />
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-3xl font-bold text-purple-700">
                        {parseFloat((+weightResult.weightValue).toFixed(2))}
                        <span className="text-lg font-normal ml-1">
                          {weightResult.unit}
                        </span>
                      </p>
                    )}
                  </div>

                  <div className="mt-3 text-center text-xs text-gray-500">
                    Logged at{" "}
                    {new Date(
                      weightResult.loggedAt || Date.now(),
                    ).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </div>

                  {/* Ideal weight */}
                  {idealWeight && (
                    <div className="mt-3 flex items-center justify-between px-4 py-3 rounded-xl bg-blue-50 border border-blue-100">
                      <div>
                        <p className="text-xs text-blue-600 font-semibold uppercase tracking-wide">
                          Ideal Weight
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Based on height {idealWeight.heightCm} cm
                        </p>
                      </div>
                      <div className="text-blue-700 font-bold text-lg">
                        {idealWeight.value} {idealWeight.unit}
                      </div>
                    </div>
                  )}

                  {/* Weight diff vs previous entry */}
                  {weightDiff && (
                    <div
                      className={`mt-3 flex items-center justify-between px-4 py-3 rounded-xl ${
                        weightDiff.change < 0
                          ? "bg-green-50 border border-green-100"
                          : weightDiff.change > 0
                          ? "bg-red-50 border border-red-100"
                          : "bg-gray-50 border border-gray-100"
                      }`}
                    >
                      <div>
                        <p className="text-xs text-gray-500">
                          vs Previous entry
                        </p>
                        <p className="text-sm font-semibold text-gray-700">
                          {weightDiff.previous} {weightResult.unit}
                        </p>
                      </div>
                      <div
                        className={`font-bold text-lg ${
                          weightDiff.change < 0
                            ? "text-green-600"
                            : weightDiff.change > 0
                            ? "text-red-500"
                            : "text-gray-500"
                        }`}
                      >
                        {weightDiff.change > 0
                          ? "↑"
                          : weightDiff.change < 0
                          ? "↓"
                          : "—"}{" "}
                        {weightDiff.change === 0
                          ? "No change"
                          : `${Math.abs(weightDiff.change).toFixed(1)} ${
                              weightResult.unit
                            }`}
                        {weightDiff.change < 0 && (
                          <span className="text-sm ml-1">🎉</span>
                        )}
                      </div>
                    </div>
                  )}

                </div>
  );
}
