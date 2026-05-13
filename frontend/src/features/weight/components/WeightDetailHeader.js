/**
 * WeightDetailHeader.js — presentational.
 * Image header + close button + title overlay for the detail modal.
 */
import React from 'react';
import { X } from 'lucide-react';
import BathroomScaleIcon from '../../../shared/components/icons/BathroomScaleIcon';
import { formatWeightImageSrc, formatDetailDate } from '../services/weightFormService';
import { formatISTToLocalTime } from '../../../shared/utils/timezoneUtils';

const FALLBACK = 'https://images.unsplash.com/photo-1516594915697-87eb3b1c14ea?w=800&q=80';

export default function WeightDetailHeader({
  data, lazyImage, imageLoading, displayWeight, onClose,
}) {
  const src = formatWeightImageSrc(data.WeightImageBase64 || lazyImage);

  return (
    <div className="relative">
      {src ? (
        <img
          src={src}
          alt="Weighing Scale"
          className="w-full h-72 object-cover"
          onError={(e) => { e.target.src = FALLBACK; }}
        />
      ) : (
        <div className="w-full h-72 bg-gradient-to-br from-emerald-100 to-teal-200 flex items-center justify-center">
          {imageLoading ? (
            <span className="inline-block h-10 w-10 rounded-full border-4 border-emerald-400 border-t-transparent animate-spin" />
          ) : (
            <BathroomScaleIcon className="w-24 h-24 text-emerald-600 opacity-50" />
          )}
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/55 to-transparent p-5 space-y-3">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold text-white leading-tight drop-shadow-lg">
              {displayWeight} kg
            </h2>
            <div className="text-xs text-white/90 mt-0.5 drop-shadow">
              <p>Logged at {formatISTToLocalTime(data.CreatedAt)}</p>
              <p className="text-xs text-white/75">{formatDetailDate(data.CreatedAt)}</p>
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-9 h-9 bg-black/40 backdrop-blur-sm text-white rounded-full flex items-center justify-center hover:bg-black/60 transition-all duration-200 border border-white/20"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  );
}
