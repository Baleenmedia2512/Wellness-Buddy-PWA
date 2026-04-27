// src/components/ManualEducationEntryModal.js
import React, { useState } from "react";
import { X } from "lucide-react";

const PLATFORMS = ["Zoom", "Microsoft Teams", "Google Meet", "In-person", "Other"];

/**
 * ManualEducationEntryModal
 * Opens when AI is unavailable and the user had an education/meeting screenshot.
 * Lets them manually log the platform so it saves to the education log.
 */
const ManualEducationEntryModal = ({ isOpen, onClose, onSave, onBack, altSwitchButtons }) => {
  const [showTypeSelect, setShowTypeSelect] = useState(true);
  const [platform, setPlatform] = useState("Zoom");
  const [topic, setTopic] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const resetForm = () => {
    setPlatform("Zoom");
    setTopic("");
    setError("");
    setShowTypeSelect(true);
  };

  const handleCancel = () => {
    resetForm();
    onClose();
  };

  const handleSave = async () => {
    setError("");

    if (!platform) {
      setError("Please select a platform");
      return;
    }

    try {
      setIsSaving(true);
      await onSave({
        platform,
        topic: topic.trim() || "Education Meeting",
      });
      resetForm();
      onClose();
    } catch (err) {
      setError(err.message || "Failed to save education log");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">

        {/* ── Type Selection Screen ── */}
        {showTypeSelect && (
          <>
            {/* Header */}
            <div className="flex items-start justify-between px-4 pt-4 pb-2 flex-shrink-0">
              <div>
                <p className="text-sm font-bold text-gray-900 leading-snug">AI Unavailable</p>
                <p className="text-[11px] text-gray-400 mt-0.5 leading-snug max-w-[220px]">
                  AI couldn&apos;t detect your input. Please log manually.
                </p>
              </div>
              <button
                onClick={handleCancel}
                className="p-1.5 rounded-xl hover:bg-gray-100 active:bg-gray-200 transition-colors flex-shrink-0"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            {/* Primary education card */}
            <div className="px-4 pb-3">
              <button
                onClick={() => setShowTypeSelect(false)}
                className="w-full text-white rounded-[16px] py-3 px-4 flex flex-col items-center justify-center gap-1 transition-all active:scale-[0.97]"
                style={{
                  background: "linear-gradient(135deg, #2563eb 0%, #3b82f6 60%, #60a5fa 100%)",
                  boxShadow: "0 6px 18px rgba(37,99,235,0.30)",
                }}
              >
                <span className="text-2xl leading-none">🎓</span>
                <span className="text-sm font-bold tracking-tight">Log Education</span>
                <span className="text-[11px] font-normal opacity-80">It&apos;s education time! Log manually</span>
              </button>
            </div>

            {/* Divider */}
            {altSwitchButtons?.length > 0 && (
              <div className="flex items-center gap-3 px-4 pb-2">
                <div className="flex-1 h-px bg-gray-100" />
                <span className="text-[10px] text-gray-400 font-medium tracking-wide uppercase">Log something else</span>
                <div className="flex-1 h-px bg-gray-100" />
              </div>
            )}

            {/* Alt cards */}
            {altSwitchButtons?.length > 0 && (
              <div className="flex gap-2 px-4 pb-4">
                {altSwitchButtons.map((btn) => (
                  <button
                    key={btn.label}
                    onClick={btn.onClick}
                    className="flex-1 bg-white py-3 px-2 rounded-[14px] flex flex-col items-center justify-center gap-0.5 transition-all active:scale-[0.97]"
                    style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.07)", minHeight: "72px" }}
                  >
                    <span className="text-xl leading-none mb-0.5">{btn.icon}</span>
                    <span className="text-xs text-gray-700 font-semibold whitespace-nowrap">No, it&apos;s {btn.label}</span>
                    {btn.sub && (
                      <span className="text-[10px] text-gray-400">{btn.sub}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Education Form ── */}
        {!showTypeSelect && (
        <>
        {/* Header */}
        <div className="relative flex flex-col items-center px-4 pt-4 pb-3 border-b border-gray-100">
          {onBack && (
            <button onClick={() => { resetForm(); onBack(); }} className="absolute left-3 top-3 p-1.5 rounded-xl hover:bg-gray-100 transition-colors">
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <button onClick={handleCancel} className="absolute right-3 top-3 p-1.5 rounded-xl hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4 text-gray-400" />
          </button>
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center mb-2">
            <span className="text-xl">🎓</span>
          </div>
          <h2 className="text-sm font-bold text-gray-800">Manual Education Entry</h2>
          <p className="text-xs text-gray-400 mt-0.5">AI unavailable — log your session manually</p>
        </div>

        {/* Form */}
        <div className="px-4 pt-3 pb-2 space-y-3">
          {/* Platform */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              Platform <span className="text-red-500">*</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {PLATFORMS.map((p) => (
                <button
                  key={p}
                  onClick={() => setPlatform(p)}
                  className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${
                    platform === p
                      ? "bg-blue-500 border-blue-500 text-white"
                      : "bg-white border-gray-200 text-gray-600 hover:border-blue-300 hover:bg-blue-50"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-xs px-3 py-2 rounded-xl">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-4 py-3 border-t border-gray-100">
          <button
            onClick={handleCancel}
            disabled={isSaving}
            className="flex-1 px-4 py-2.5 border-2 border-gray-200 text-gray-600 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 px-4 py-2.5 bg-blue-500 text-white rounded-xl text-sm font-semibold hover:bg-blue-600 active:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSaving ? (
              <>
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Saving...
              </>
            ) : (
              <>Log Session</>
            )}
          </button>
        </div>

        </> /* end !showTypeSelect */
        )}

      </div>
    </div>
  );
};

export default ManualEducationEntryModal;
