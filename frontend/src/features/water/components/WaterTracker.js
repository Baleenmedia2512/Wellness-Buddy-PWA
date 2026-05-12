/**
 * WaterTracker.js
 * Displays daily water intake progress with quick-log buttons.
 * Discipline is achieved when total intake >= requiredMl (weight/20*1000).
 * Default required: 2500 ml (2.5 L) when no weight is logged.
 *
 * Data flow:
 *   READ  → GET /api/water/intake?userId=X&date=YYYY-MM-DD
 *   WRITE → POST /api/background-analysis  (stores a food_nutrition_data_table row
 *           with AnalysisData = { foods: [{ name:"water", volume_ml: N, calories: 0 }] })
 */

import React, { useState, useCallback, useEffect } from "react";
import { Droplets, CheckCircle, AlertCircle, RefreshCw, Plus } from "lucide-react";
import { saveNutritionAnalysis } from "../../nutrition/services/nutritionSaveService";

// Quick-log amounts in ml
const QUICK_AMOUNTS = [
  { label: "250 ml", value: 250 },
  { label: "500 ml", value: 500 },
  { label: "1 L", value: 1000 },
  { label: "2 L", value: 2000 },
];

function formatMl(ml) {
  if (ml >= 1000) return `${(ml / 1000).toFixed(1).replace(/\.0$/, "")} L`;
  return `${ml} ml`;
}

function todayLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function WaterTracker({ user, userId: propUserId, apiBaseUrl: propApiBase }) {
  const apiBaseUrl = propApiBase || process.env.REACT_APP_API_BASE_URL;

  // ── State ────────────────────────────────────────────────────────────────
  const [resolvedUserId, setResolvedUserId] = useState(propUserId || null);
  const [waterData, setWaterData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(null); // { amount: 500 }
  const [customMl, setCustomMl] = useState("");
  const [showCustom, setShowCustom] = useState(false);

  // ── Resolve userId ───────────────────────────────────────────────────────
  useEffect(() => {
    if (propUserId) {
      setResolvedUserId(propUserId);
      return;
    }
    // Try localStorage first
    const stored = localStorage.getItem("dbUserId");
    if (stored) {
      setResolvedUserId(Number(stored));
      return;
    }
    // Fallback: look up via email
    const email = user?.email || localStorage.getItem("userEmail");
    if (email) {
      fetch(`${apiBaseUrl}/api/user/lookup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
        .then((r) => r.json())
        .then((d) => {
          if (d.success && d.userId) {
            localStorage.setItem("dbUserId", String(d.userId));
            setResolvedUserId(d.userId);
          }
        })
        .catch(() => {});
    }
  }, [propUserId, user, apiBaseUrl]);

  // ── Fetch water intake data ──────────────────────────────────────────────
  const fetchWaterData = useCallback(async () => {
    if (!resolvedUserId) return;
    setLoading(true);
    setError(null);
    try {
      const date = todayLocal();
      const res = await fetch(
        `${apiBaseUrl}/api/water/intake?userId=${resolvedUserId}&date=${date}&_t=${Date.now()}`,
        { cache: "no-store", headers: { "Cache-Control": "no-cache" } },
      );
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();
      setWaterData(data);
    } catch (err) {
      console.error("[WaterTracker] fetchWaterData error:", err);
      setError("Failed to load water data. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [resolvedUserId, apiBaseUrl]);

  useEffect(() => {
    if (resolvedUserId) fetchWaterData();
  }, [resolvedUserId, fetchWaterData]);

  // ── Log water ────────────────────────────────────────────────────────────
  const logWater = useCallback(
    async (ml) => {
      if (!resolvedUserId || saving) return;
      if (!ml || ml <= 0) {
        setError("Please enter a valid amount.");
        return;
      }

      setSaving(true);
      setError(null);
      setSaveSuccess(null);

      try {
        const analysisResult = {
          foods: [
            {
              name: "water",
              volume_ml: ml,
              calories: 0,
              weight_g: ml, // 1 ml ≈ 1 g for water
              unit: "ml",
              isLiquid: true,
              portion: `${ml} ml`,
              nutrition: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
            },
          ],
          total: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
          confidence: "high",
        };

        await saveNutritionAnalysis({
          userId: resolvedUserId,
          imagePath: null,
          imageBase64: null,
          analysisResult,
          deviceInfo: { source: "WaterTracker" },
          userEmail: user?.email || localStorage.getItem("userEmail"),
        });

        setSaveSuccess({ amount: ml });
        // Re-fetch to update progress
        await fetchWaterData();
      } catch (err) {
        console.error("[WaterTracker] logWater error:", err);
        setError(err.message || "Failed to log water. Please try again.");
      } finally {
        setSaving(false);
        setTimeout(() => setSaveSuccess(null), 3000);
      }
    },
    [resolvedUserId, saving, user, fetchWaterData],
  );

  const handleCustomLog = () => {
    const ml = parseInt(customMl, 10);
    if (!ml || ml <= 0) {
      setError("Enter a valid amount in ml.");
      return;
    }
    setCustomMl("");
    setShowCustom(false);
    logWater(ml);
  };

  // ── Derived values ───────────────────────────────────────────────────────
  const totalMl = waterData?.totalMl ?? 0;
  const requiredMl = waterData?.requiredMl ?? 2500;
  const remainingMl = waterData?.remainingMl ?? requiredMl;
  const achieved = waterData?.achieved ?? false;
  const progressPercent = waterData?.progressPercent ?? 0;
  const defaultWeight = waterData?.defaultWeight ?? true;
  const weightKg = waterData?.weightKg ?? null;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-blue-50 rounded-xl">
            <Droplets className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-800 text-sm">Water Intake</h3>
            <p className="text-xs text-gray-400">
              {defaultWeight
                ? "Goal: 2.5 L (default — log your weight for a custom goal)"
                : `Goal: ${formatMl(requiredMl)} (based on ${weightKg} kg)`}
            </p>
          </div>
        </div>
        <button
          onClick={fetchWaterData}
          disabled={loading}
          className="p-2 rounded-full hover:bg-gray-100 transition-colors"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 text-gray-400 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs font-medium">
          <span className="text-blue-600">{formatMl(totalMl)} logged</span>
          <span className="text-gray-400">{formatMl(requiredMl)} goal</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
          <div
            className={`h-3 rounded-full transition-all duration-500 ${
              achieved ? "bg-green-400" : "bg-blue-400"
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="text-xs text-right text-gray-400">{progressPercent}%</div>
      </div>

      {/* Discipline status */}
      {waterData && (
        <div
          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium ${
            achieved
              ? "bg-green-50 text-green-700"
              : "bg-blue-50 text-blue-700"
          }`}
        >
          {achieved ? (
            <>
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              <span>Discipline Achieved! 🎉 Great job staying hydrated.</span>
            </>
          ) : (
            <>
              <Droplets className="w-4 h-4 flex-shrink-0" />
              <span>
                Drink{" "}
                <strong>{formatMl(remainingMl)}</strong> more to reach your
                daily goal.
              </span>
            </>
          )}
        </div>
      )}

      {/* Error / success toast */}
      {error && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-50 text-red-600 rounded-xl text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {saveSuccess && (
        <div className="flex items-center gap-2 px-3 py-2 bg-green-50 text-green-700 rounded-xl text-sm animate-fade-in">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          <span>+{formatMl(saveSuccess.amount)} logged successfully!</span>
        </div>
      )}

      {/* Quick-log buttons */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
          Quick Log
        </p>
        <div className="grid grid-cols-4 gap-2">
          {QUICK_AMOUNTS.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => logWater(value)}
              disabled={saving}
              className={`py-2 px-1 rounded-xl text-xs font-semibold border transition-all duration-150
                ${
                  saving
                    ? "opacity-50 cursor-not-allowed bg-gray-50 border-gray-200 text-gray-400"
                    : "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 active:scale-95"
                }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Custom amount row */}
        {showCustom ? (
          <div className="flex gap-2">
            <input
              type="number"
              min="1"
              max="5000"
              placeholder="Amount in ml"
              value={customMl}
              onChange={(e) => setCustomMl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCustomLog()}
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
              autoFocus
            />
            <button
              onClick={handleCustomLog}
              disabled={saving}
              className="px-4 py-2 bg-blue-500 text-white rounded-xl text-sm font-semibold hover:bg-blue-600 active:scale-95 transition-all disabled:opacity-50"
            >
              Log
            </button>
            <button
              onClick={() => { setShowCustom(false); setCustomMl(""); }}
              className="px-3 py-2 bg-gray-100 text-gray-500 rounded-xl text-sm hover:bg-gray-200 transition-all"
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowCustom(true)}
            className="w-full flex items-center justify-center gap-1 py-2 border border-dashed border-blue-300 rounded-xl text-blue-500 text-sm hover:bg-blue-50 transition-all"
          >
            <Plus className="w-4 h-4" />
            Custom amount
          </button>
        )}
      </div>

      {/* Today's logs */}
      {waterData?.logs && waterData.logs.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Today's Logs
          </p>
          <div className="max-h-32 overflow-y-auto space-y-1">
            {waterData.logs.map((log, i) => (
              <div
                key={i}
                className="flex justify-between items-center px-3 py-1.5 bg-blue-50 rounded-lg text-xs text-blue-700"
              >
                <span>
                  {new Date(log.loggedAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <span className="font-semibold">{formatMl(log.volumeMl)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !waterData && (
        <div className="space-y-2 animate-pulse">
          <div className="h-3 bg-gray-100 rounded-full w-3/4" />
          <div className="h-3 bg-gray-100 rounded-full w-1/2" />
        </div>
      )}
    </div>
  );
}
