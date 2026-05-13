/**
 * EducationImagePreview.js — presentational.
 * Image header for the education detail modal: image (or fallback), gradient
 * overlay with topic + chips, and a close button. Render-only.
 */
import React from 'react';
import { Monitor, Calendar, Clock, BookOpen, X } from 'lucide-react';
import { formatLogDate, formatLogTime } from '../services/educationFormatter';

export default function EducationImagePreview({
  log, imageSrc, imageLoading, onClose,
}) {
  return (
    <div className="relative">
      {imageSrc ? (
        <img
          src={imageSrc}
          alt={log.Topic || 'Meeting Screenshot'}
          className={`w-full h-72 object-cover transition-opacity duration-300 ${imageLoading ? 'opacity-60' : 'opacity-100'}`}
          onError={(e) => { e.target.style.display = 'none'; }}
        />
      ) : (
        <div className="w-full h-72 bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center">
          <BookOpen className="w-12 h-12 text-purple-400" />
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-5 space-y-3">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold text-white leading-tight">
              {log.Topic || 'Education Meeting'}
            </h2>
            <p className="text-xs text-white/70 mt-0.5">
              Logged at {formatLogTime(log.CreatedAt)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <Chip icon={Monitor} label={log.Platform || 'Online Meeting'} />
          <Chip icon={Calendar} label={formatLogDate(log.CreatedAt)} />
          <Chip icon={Clock} label={formatLogTime(log.CreatedAt)} />
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

function Chip({ icon: Icon, label }) {
  return (
    <div className="flex items-center bg-white/15 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-sm border border-white/10">
      <Icon className="w-4 h-4 text-white mr-1.5" />
      <span className="text-xs font-medium text-white">{label}</span>
    </div>
  );
}
