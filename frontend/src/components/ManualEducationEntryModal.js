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
  const [platform, setPlatform] = useState("Zoom");
  const [topic, setTopic] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const resetForm = () => {
    setPlatform("Zoom");
    setTopic("");
    setError("");
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

          {/* Topic */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              Topic <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., Nutrition session, Wellness class"
              className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-xl focus:border-blue-400 focus:outline-none text-sm bg-white"
              style={{ fontSize: "16px" }}
            />
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

        {/* Wrong type strip */}
        {altSwitchButtons?.length > 0 && (
          <div className="flex items-center gap-2 px-4 pb-3">
            <span className="text-xs text-gray-400 whitespace-nowrap">Not education?</span>
            <div className="flex gap-1.5 flex-1">
              {altSwitchButtons.map((btn) => (
                <button
                  key={btn.label}
                  onClick={btn.onClick}
                  className="flex-1 flex items-center justify-center gap-1 border border-gray-200 bg-white hover:bg-gray-50 text-gray-500 py-1.5 rounded-full text-xs font-medium transition-colors"
                >
                  <span>{btn.icon}</span>
                  <span>{btn.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ManualEducationEntryModal;
