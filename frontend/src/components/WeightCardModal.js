// src/components/WeightCardModal.js
import React, { useState, useEffect } from 'react';
import { X, Scale, Pencil, Check, XCircle } from 'lucide-react';
import { formatISTToLocalDate, formatISTToLocalTime } from '../utils/timezoneUtils';

/**
 * WeightCardModal Component
 * Detailed view modal for weight entries with comprehensive metrics breakdown
 */
const WeightCardModal = ({ data, onClose, onDelete, onUpdate, previousWeight = null, apiBaseUrl, userId = null }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editWeight, setEditWeight] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [editError, setEditError] = useState('');
  // ✅ Lazy-fetched scale image (list endpoint omits base64 for speed)
  const [lazyImage, setLazyImage] = useState(null);
  const [imageLoading, setImageLoading] = useState(false);

  // Sync edit field when data changes
  useEffect(() => {
    if (data?.Weight) {
      setEditWeight(String(data.Weight));
    }
    setIsEditing(false);
    setEditError('');
  }, [data?.ID, data?.Weight]);

  // ✅ Fetch full-size image on demand when modal opens (if not already provided)
  useEffect(() => {
    if (!data?.ID) return;
    if (data?.WeightImageBase64) return; // already provided
    if (!apiBaseUrl || !userId) return;

    let cancelled = false;
    setLazyImage(null);
    setImageLoading(true);
    (async () => {
      try {
        const res = await fetch(
          `${apiBaseUrl}/api/get-weight-image?userId=${encodeURIComponent(userId)}&id=${encodeURIComponent(data.ID)}`
        );
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled) return;
        if (json && json.success && json.image) {
          setLazyImage(json.image);
        }
      } catch (_) { /* non-critical */ }
      finally {
        if (!cancelled) setImageLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [apiBaseUrl, userId, data?.ID, data?.WeightImageBase64]);

  if (!data) return null;

  const handleSaveWeight = async () => {
    const weightValue = parseFloat(editWeight);
    if (isNaN(weightValue) || weightValue < 20 || weightValue > 300) {
      setEditError('Weight must be between 20 and 300 kg');
      return;
    }
    setIsSaving(true);
    setEditError('');
    try {
      const entryId = data.ID ?? data.id;
      if (!entryId) throw new Error('Entry ID not found – cannot update');
      await onUpdate(entryId, weightValue);
      setIsEditing(false);
    } catch (err) {
      setEditError(err.message || 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Format date (without time)
   * Converts IST to user's local timezone
   */
  const formatDate = (dateString) => {
    return formatISTToLocalDate(dateString, {
      weekday: 'long',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-t-3xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-hidden animate-slideUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Image Header with Overlay */}
        <div className="relative">
          {(() => {
            const src = data.WeightImageBase64 || lazyImage;
            if (src) {
              return (
                <img
                  src={
                    src.startsWith('data:image')
                      ? src
                      : `data:image/jpeg;base64,${src}`
                  }
                  alt="Weighing Scale"
                  className="w-full h-72 object-cover"
                  onError={(e) => {
                    e.target.src = 'https://images.unsplash.com/photo-1516594915697-87eb3b1c14ea?w=800&q=80';
                  }}
                />
              );
            }
            return (
              <div className="w-full h-72  bg-gradient-to-br from-emerald-100 to-teal-200 flex items-center justify-center">
                {imageLoading ? (
                  <span className="inline-block h-10 w-10 rounded-full border-4 border-emerald-400 border-t-transparent animate-spin" />
                ) : (
                  <Scale className="w-24 h-24 text-emerald-600 opacity-50" />
                )}
              </div>
            );
          })()}

          {/* Gradient Overlay */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/55 to-transparent p-5 space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-bold text-white leading-tight drop-shadow-lg">
                  {isEditing ? editWeight || '--' : data.Weight} kg
                </h2>
                <div className="text-xs text-white/90 mt-0.5 drop-shadow">
                  <p>Logged at {formatISTToLocalTime(data.CreatedAt)}</p>
                  <p className="text-xs text-white/75">{formatDate(data.CreatedAt)}</p>
                </div>
              </div>
              {/* <div className="text-right">
                <span className="text-3xl font-bold text-white">{data.Weight}</span>
                <span className="text-xs text-white/70 ml-1">kg</span>
              </div> */}
            </div>

            {/* Metrics Pills */}
            {/* <div className="flex flex-wrap gap-2 pt-1">
              <div className="flex items-center bg-white/15 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-sm border border-white/10">
                <span className="text-xl mr-1.5">📊</span>
                <span className="text-xs font-medium text-white">{data.Bmi ? parseFloat(data.Bmi).toFixed(1) : '--'}</span>
              </div>
              <div className="flex items-center bg-white/15 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-sm border border-white/10">
                <span className="text-xl mr-1.5">💧</span>
                <span className="text-xs font-medium text-white">{data.BodyFat ? parseFloat(data.BodyFat).toFixed(1) + '%' : '--'}</span>
              </div>
              <div className="flex items-center bg-white/15 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-sm border border-white/10">
                <span className="text-xl mr-1.5">💪</span>
                <span className="text-xs font-medium text-white">{data.MuscleMass ? parseFloat(data.MuscleMass).toFixed(1) + 'kg' : '--'}</span>
              </div>
              <div className="flex items-center bg-white/15 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-sm border border-white/10">
                <span className="text-xl mr-1.5">🔥</span>
                <span className="text-xs font-medium text-white">{data.Bmr || '--'}</span>
              </div>
            </div> */}
          </div>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-9 h-9 bg-black/40 backdrop-blur-sm text-white rounded-full flex items-center justify-center hover:bg-black/60 transition-all duration-200 border border-white/20"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 288px)' }}>
          {/* Weight Details Section */}
          <div className="mb-4">
            <h3 className="font-semibold text-gray-900 text-sm flex items-center mb-3">
              <Scale className="w-5 h-5 text-gray-500 mr-1.5" />
              Weight Details
            </h3>
            
            {/* Detailed Metrics */}
            <div className="space-y-2">
              {/* Weight - Editable */}
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                <div className="flex justify-between items-center">
                  <p className="font-medium text-gray-900 text-sm">Weight</p>
                  {!isEditing ? (
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 text-sm">{data.Weight}</span>
                      <span className="text-xs text-gray-500">kg</span>
                      {onUpdate && (
                        <button
                          onClick={() => { setIsEditing(true); setEditWeight(String(data.Weight)); }}
                          className="ml-1 flex items-center gap-1 px-2 py-1 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors text-xs font-medium"
                          title="Edit weight"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          Edit
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        inputMode="decimal"
                        value={editWeight}
                        onChange={(e) => setEditWeight(e.target.value)}
                        className="w-20 px-2 py-1 text-sm border-2 border-emerald-400 rounded-lg focus:outline-none focus:border-emerald-500 text-right"
                        style={{ fontSize: '14px' }}
                        min="20"
                        max="300"
                        step="0.1"
                        autoFocus
                        onKeyDown={(e) => { if (e.key === 'Enter') handleSaveWeight(); if (e.key === 'Escape') setIsEditing(false); }}
                      />
                      <span className="text-xs text-gray-500">kg</span>
                      <button
                        onClick={handleSaveWeight}
                        disabled={isSaving}
                        className="p-1 rounded-lg text-white bg-emerald-500 hover:bg-emerald-600 transition-colors disabled:opacity-50"
                        title="Save"
                      >
                        {isSaving ? (
                          <span className="block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Check className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        onClick={() => { setIsEditing(false); setEditError(''); }}
                        disabled={isSaving}
                        className="p-1 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors disabled:opacity-50"
                        title="Cancel"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
                {editError && (
                  <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-xs text-red-700">{editError}</p>
                  </div>
                )}
              </div>

              {/* BMI */}
              {/* <div className="bg-gray-50 p-3 rounded-xl flex justify-between items-center border border-gray-100 hover:bg-gray-100 transition-colors duration-200">
                <div>
                  <p className="font-medium text-gray-900 text-sm">BMI</p>
                  <p className="text-xs text-gray-500">Body Mass Index</p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-gray-900 text-sm">{data.Bmi ? parseFloat(data.Bmi).toFixed(1) : '--'}</p>
                  <p className="text-xs text-gray-500">index</p>
                </div>
              </div> */}

              {/* Body Fat */}
              {/* <div className="bg-gray-50 p-3 rounded-xl flex justify-between items-center border border-gray-100 hover:bg-gray-100 transition-colors duration-200">
                <div>
                  <p className="font-medium text-gray-900 text-sm">Body Fat</p>
                  <p className="text-xs text-gray-500">Fat percentage</p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-gray-900 text-sm">{data.BodyFat ? parseFloat(data.BodyFat).toFixed(1) : '--'}</p>
                  <p className="text-xs text-gray-500">%</p>
                </div>
              </div> */}

              {/* Muscle Mass */}
              {/* <div className="bg-gray-50 p-3 rounded-xl flex justify-between items-center border border-gray-100 hover:bg-gray-100 transition-colors duration-200">
                <div>
                  <p className="font-medium text-gray-900 text-sm">Muscle Mass</p>
                  <p className="text-xs text-gray-500">Skeletal muscle</p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-gray-900 text-sm">{data.MuscleMass ? parseFloat(data.MuscleMass).toFixed(1) : '--'}</p>
                  <p className="text-xs text-gray-500">kg</p>
                </div>
              </div> */}

              {/* BMR */}
              {/* <div className="bg-gray-50 p-3 rounded-xl flex justify-between items-center border border-gray-100 hover:bg-gray-100 transition-colors duration-200">
                <div>
                  <p className="font-medium text-gray-900 text-sm">BMR</p>
                  <p className="text-xs text-gray-500">Basal Metabolic Rate</p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-gray-900 text-sm">{data.Bmr || '--'}</p>
                  <p className="text-xs text-gray-500">kcal</p>
                </div>
              </div> */}
            </div>
          </div>
        </div>
        {/* Delete Button */}
        <div className="p-4 pt-0">
          <button
            onClick={() => {
              onDelete(data);
              onClose();
            }}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-red-500 text-white text-sm font-medium px-4 py-2 shadow-sm hover:bg-red-600 hover:shadow-md active:scale-95 transition-all duration-200"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete Weight Entry
          </button>
        </div>
      </div>

      {/* Slide up animation */}
      <style>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(100%);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-slideUp {
          animation: slideUp 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default WeightCardModal;
