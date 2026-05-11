import React, { useState, useEffect } from 'react';
import { Monitor, Calendar, Clock, BookOpen, X } from 'lucide-react';
import TouchFeedbackButton from './TouchFeedbackButton';
import { istToLocalDate, formatISTToLocalDate, formatISTToLocalTime } from '../utils/timezoneUtils';

/**
 * Format date
 */
const formatDate = (dateString) => {
  if (!dateString) return '';
  return formatISTToLocalDate(dateString, {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
};

/**
 * Format time
 */
const formatTime = (dateString) => {
  if (!dateString) return '';
  return formatISTToLocalTime(dateString, {
    hour: '2-digit',
    minute: '2-digit'
  });
};

const EducationCardModal = ({ log, onClose, onDelete, isDeleting, apiBaseUrl, userId }) => {
  const [fullImage, setFullImage] = useState(null);
  const [imageLoading, setImageLoading] = useState(false);

  // Lazy-load full image when modal opens (list API only returns a thumbnail prefix)
  useEffect(() => {
    if (!log || !log.hasFullImage) return;
    if (!apiBaseUrl || !userId || !log.Id) return;

    setImageLoading(true);
    fetch(`${apiBaseUrl}/api/education/log-image?logId=${log.Id}&userId=${userId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.imageBase64) {
          // imageBase64 from DB is the raw base64 string — prefix it for <img src>
          const src = data.imageBase64.startsWith('data:')
            ? data.imageBase64
            : `data:image/jpeg;base64,${data.imageBase64}`;
          setFullImage(src);
        }
      })
      .catch(() => {/* silently ignore — thumbnail fallback still works */})
      .finally(() => setImageLoading(false));
  }, [log?.Id]);

  if (!log) return null;

  // Use full image if loaded, otherwise fall back to the (possibly truncated) thumbnail from list
  const imageSrc = fullImage || (log.ImageBase64
    ? (log.ImageBase64.startsWith('data:') ? log.ImageBase64 : `data:image/jpeg;base64,${log.ImageBase64}`)
    : null);

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-slideUp max-h-[80vh] relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Image header */}
        <div className="relative">
          {imageSrc ? (
            <img
              src={imageSrc}
              alt={log.Topic || 'Meeting Screenshot'}
              className={`w-full h-72 object-cover transition-opacity duration-300 ${imageLoading ? 'opacity-60' : 'opacity-100'}`}
              onError={(e) => {
                e.target.style.display = 'none';
              }}
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
                  Logged at {formatTime(log.CreatedAt)}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <div className="flex items-center bg-white/15 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-sm border border-white/10">
                <Monitor className="w-4 h-4 text-white mr-1.5" />
                <span className="text-xs font-medium text-white">{log.Platform || 'Online Meeting'}</span>
              </div>
              <div className="flex items-center bg-white/15 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-sm border border-white/10">
                <Calendar className="w-4 h-4 text-white mr-1.5" />
                <span className="text-xs font-medium text-white">{formatDate(log.CreatedAt)}</span>
              </div>
              <div className="flex items-center bg-white/15 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-sm border border-white/10">
                <Clock className="w-4 h-4 text-white mr-1.5" />
                <span className="text-xs font-medium text-white">{formatTime(log.CreatedAt)}</span>
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

        {/* Meeting Details */}
        <div className="p-4 overflow-y-auto" style={{ maxHeight: '40vh' }}>
          <div className="space-y-3">
            <h3 className="font-semibold text-gray-900 text-sm flex items-center">
              <BookOpen className="w-5 h-5 text-gray-500 mr-1.5" />
              Meeting Details
            </h3>
            
            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              <div className="flex justify-between items-start">
                <span className="text-sm text-gray-600">Topic</span>
                <span className="text-sm font-semibold text-gray-900 text-right max-w-[60%]">{log.Topic || 'Education Meeting'}</span>
              </div>

              <div className="flex justify-between items-start">
                <span className="text-sm text-gray-600">Platform</span>
                <span className="text-sm font-semibold text-gray-900">{log.Platform || 'Online Meeting'}</span>
              </div>
              
              <div className="flex justify-between items-start">
                <span className="text-sm text-gray-600">Date</span>
                <span className="text-sm font-semibold text-gray-900">{formatDate(log.CreatedAt)}</span>
              </div>
              
              <div className="flex justify-between items-start">
                <span className="text-sm text-gray-600">Time</span>
                <span className="text-sm font-semibold text-gray-900">{formatTime(log.CreatedAt)}</span>
              </div>

              {/* Calories Burned row — only for smartwatch activity logs */}
              {log.Topic && log.Topic.toLowerCase().startsWith('calories burned:') && (
                <div className="flex justify-between items-center pt-1 border-t border-gray-100 mt-1">
                  <span className="text-sm text-orange-600 font-medium">⌚ Calories Burned</span>
                  <span className="text-sm font-bold text-orange-700">
                    {log.Topic.replace(/^calories burned:\s*/i, '')}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Delete button */}
        <div className="p-4 pt-0">
          <TouchFeedbackButton
            disabled={isDeleting}
            className={`w-full flex items-center justify-center gap-2 rounded-lg text-white text-sm font-medium px-4 py-2 shadow-sm transition-all duration-200 ${
              isDeleting
                ? 'bg-red-400 cursor-not-allowed'
                : 'bg-red-500 hover:bg-red-600 hover:shadow-md active:scale-95'
            }`}
            onClick={() => onDelete(log)}
          >
            {isDeleting ? (
              <>
                <span className="inline-block h-4 w-4 rounded-full border-2 border-white/70 border-t-white animate-spin" />
                Deleting…
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
                Delete
              </>
            )}
          </TouchFeedbackButton>
        </div>
      </div>
    </div>
  );
};

export default EducationCardModal;
