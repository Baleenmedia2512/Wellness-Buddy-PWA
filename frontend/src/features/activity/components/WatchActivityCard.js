import React, { useState, useEffect, useRef } from "react";
import { Watch, Flame, CheckCircle2, X } from "lucide-react";

/**
 * WatchActivityCard
 * Shown on the main page after a smartwatch / fitness app image is uploaded.
 * AUTO-SAVES to Education Log immediately on mount.
 * Displays the watch image preview, detected calories burned, source app,
 * and a success/error state after saving.
 *
 * Props:
 *   watchData  – { caloriesBurned: number, source: string, loggedAt: ISO string }
 *   imagePreview – base64/blob URL of the uploaded image
 *   user       – Firebase auth user object
 *   apiBaseUrl – backend base URL
 *   onClose    – callback to dismiss the card
 *   onSaved    – optional callback called after successful save
 */
const WatchActivityCard = ({
  watchData,
  imagePreview,
  user,
  apiBaseUrl,
  onClose,
  onSaved,
}) => {
  const [saving, setSaving] = useState(true);  // starts saving immediately
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const hasSavedRef = useRef(false); // prevent double-save in StrictMode

  const { caloriesBurned = 0, source = "Smartwatch", loggedAt, userId: resolvedUserId } = watchData || {};

  const formattedTime = new Date(loggedAt || Date.now()).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  // Convert imagePreview (blob URL or data URL) to base64 for saving
  const toBase64 = (url) =>
    new Promise((resolve, reject) => {
      if (!url) return resolve(null);
      if (url.startsWith("data:")) return resolve(url.split(",")[1]);
      fetch(url)
        .then((r) => r.blob())
        .then((blob) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result.split(",")[1]);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        })
        .catch(reject);
    });

  // ── Auto-save on mount ──────────────────────────────────────────────────────
  useEffect(() => {
    if (hasSavedRef.current) return; // prevent double-save in StrictMode
    hasSavedRef.current = true;

    const autoSave = async () => {
      try {
        const userId = resolvedUserId ||
          user?.id ||
          user?.uid ||
          user?.userId ||
          user?.user_id ||
          (user?.email ? user.email : null);

        const imageBase64 = await toBase64(imagePreview);

        const response = await fetch(`${apiBaseUrl}/api/education/logs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            imageBase64,
            platform: source,
            topic: `Calories Burned: ${caloriesBurned} kcal`,
            confidence: 0.9,
            deviceInfo: window.navigator.userAgent,
            clientTimestamp: new Date().toISOString(),
            clientTimezoneOffset: new Date().getTimezoneOffset(),
          }),
        });

        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.message || "Failed to save activity log");
        }

        setSaved(true);
        if (onSaved) onSaved({ caloriesBurned, source });
      } catch (err) {
        console.error("⌚ Failed to auto-save watch activity:", err);
        setSaveError(err.message || "Save failed. Please try again.");
      } finally {
        setSaving(false);
      }
    };

    autoSave();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: listed deps would cause an infinite re-render
  }, []);
  // ───────────────────────────────────────────────────────────────────────────

  // Return null after hooks are called
  if (!watchData) return null;

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-orange-100 overflow-hidden">
      {/* Watch image preview */}
      {imagePreview && (
        <div className="relative">
          <img
            src={imagePreview}
            alt="Watch Activity"
            className="w-full h-52 object-cover"
          />
          {/* Source badge */}
          <div className="absolute top-3 left-3 bg-orange-500 text-white text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-md">
            <Watch className="w-3.5 h-3.5" />
            {source}
          </div>
          {/* Close button */}
          {onClose && (
            <button
              onClick={onClose}
              className="absolute top-3 right-3 bg-black/40 hover:bg-black/60 text-white rounded-full p-1.5 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      <div className="p-5">
        {/* Header */}
        <div className="flex items-center gap-3.5 mb-5">
          <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center ring-4 ring-orange-50">
            <Watch className="w-6 h-6 text-orange-500" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900 leading-tight">
              Activity Detected
            </h3>
            <p className="text-sm text-gray-500">
              Smartwatch / fitness app screenshot
            </p>
          </div>
        </div>

        {/* Details card */}
        <div className="space-y-3 bg-orange-50/60 rounded-2xl p-4 border border-orange-100 mb-5">
          {/* Calories burned */}
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white rounded-xl shadow-sm border border-orange-100">
              <Flame className="w-4 h-4 text-orange-500" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Calories Burned
              </p>
              <p className="text-sm font-bold text-gray-900">
                {caloriesBurned > 0 ? `${caloriesBurned} kcal` : "Not detected"}
              </p>
            </div>
          </div>

          {/* Source */}
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white rounded-xl shadow-sm border border-orange-100">
              <Watch className="w-4 h-4 text-orange-500" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Source
              </p>
              <p className="text-sm font-bold text-gray-900">{source}</p>
            </div>
          </div>

          {/* Time */}
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white rounded-xl shadow-sm border border-orange-100">
              <span className="text-sm leading-none">🕐</span>
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Logged At
              </p>
              <p className="text-sm font-bold text-gray-900">{formattedTime}</p>
            </div>
          </div>
        </div>

        {/* Status footer */}
        {saving && (
          <div className="flex items-center justify-center gap-2 bg-orange-50 border border-orange-200 rounded-2xl py-3.5 text-orange-600">
            <span className="w-4 h-4 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
            <span className="font-semibold text-sm">Saving to Education Log…</span>
          </div>
        )}

        {saved && !saving && (
          <div className="flex items-center justify-center gap-2 bg-green-50 border border-green-200 rounded-2xl py-3.5 text-green-700">
            <CheckCircle2 className="w-5 h-5" />
            <span className="font-semibold text-sm">Saved to Education Log!</span>
          </div>
        )}

        {saveError && !saving && (
          <div className="space-y-2">
            <p className="text-xs text-red-500 text-center">{saveError}</p>
            <button
              onClick={() => {
                hasSavedRef.current = false;
                setSaving(true);
                setSaveError(null);
                // Re-trigger by resetting the ref and calling again
                const retry = async () => {
                  try {
                    const userId = resolvedUserId ||
                      user?.id || user?.uid || user?.userId || user?.user_id || user?.email;
                    const imageBase64 = await toBase64(imagePreview);
                    const response = await fetch(`${apiBaseUrl}/api/education/logs`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        userId,
                        imageBase64,
                        platform: source,
                        topic: `Calories Burned: ${caloriesBurned} kcal`,
                        confidence: 0.9,
                        deviceInfo: window.navigator.userAgent,
                        clientTimestamp: new Date().toISOString(),
                        clientTimezoneOffset: new Date().getTimezoneOffset(),
                      }),
                    });
                    const data = await response.json();
                    if (!response.ok || !data.success) throw new Error(data.message || "Failed");
                    setSaved(true);
                    if (onSaved) onSaved({ caloriesBurned, source });
                  } catch (err) {
                    setSaveError(err.message || "Save failed. Please try again.");
                  } finally {
                    setSaving(false);
                  }
                };
                retry();
              }}
              className="w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl py-3 font-semibold text-sm transition-colors"
            >
              <Watch className="w-4 h-4" />
              Retry Save
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default WatchActivityCard;

