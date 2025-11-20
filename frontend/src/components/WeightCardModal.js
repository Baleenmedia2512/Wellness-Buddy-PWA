// src/components/WeightCardModal.js
import React from 'react';
import { X, Scale } from 'lucide-react';

/**
 * WeightCardModal Component
 * Detailed view modal for weight entries with comprehensive metrics breakdown
 */
const WeightCardModal = ({ data, onClose, onDelete, previousWeight = null }) => {
  if (!data) return null;

  /**
   * Format date
   */
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
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
          {data.WeightImageBase64 ? (
            <img
              src={
                data.WeightImageBase64.startsWith('data:image') 
                  ? data.WeightImageBase64 
                  : `data:image/jpeg;base64,${data.WeightImageBase64}`
              }
              alt="Weighing Scale"
              className="w-full h-72 object-cover"
              onError={(e) => {
                e.target.src = 'https://images.unsplash.com/photo-1516594915697-87eb3b1c14ea?w=800&q=80';
              }}
            />
          ) : (
            <div className="w-full h-72  bg-gradient-to-br from-emerald-100 to-teal-200 flex items-center justify-center">
              <Scale className="w-24 h-24 text-emerald-600 opacity-50" />
            </div>
          )}

          {/* Gradient Overlay */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-5 space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-xl font-bold text-white leading-tight">
                  {data.Weight} kg
                </h2>
                <div className="text-xs text-white/70 mt-0.5">
                  <p>Logged at {new Date(data.CreatedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</p>
                  <p className="text-xs text-gray-400">{formatDate(data.CreatedAt)}</p>
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
              {/* Weight */}
              <div className="bg-gray-50 p-3 rounded-xl flex justify-between items-center border border-gray-100 hover:bg-gray-100 transition-colors duration-200">
                <div>
                  <p className="font-medium text-gray-900 text-sm">Weight</p>
                  {/* <p className="text-xs text-gray-500">{formatDate(data.CreatedAt)}</p> */}
                </div>
                <div className="text-right">
                  <p className="font-medium text-gray-900 text-sm">{data.Weight}</p>
                  <p className="text-xs text-gray-500">kg</p>
                </div>
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
            Delete
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
