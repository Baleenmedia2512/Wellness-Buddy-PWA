/**
 * EducationCardModal.js — slice-level container.
 * Detail modal for a single education log entry. All async lives in
 * `useEducationDetailImage`; all formatting in `educationFormatter`.
 */
import React from 'react';
import { BookOpen } from 'lucide-react';
import EducationImagePreview from './EducationImagePreview';
import { DeleteEducationButton } from './EducationActionButtons';
import { useEducationDetailImage } from '../hooks/useEducationDetailImage';
import {
  formatLogDate, formatLogTime,
  isCaloriesBurnedTopic, extractCaloriesValue,
} from '../services/educationFormatter';

const EducationCardModal = ({ log, onClose, onDelete, isDeleting, apiBaseUrl, userId }) => {
  const { imageSrc, imageLoading } = useEducationDetailImage({ apiBaseUrl, userId, log });
  if (!log) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-slideUp max-h-[80vh] relative"
        onClick={(e) => e.stopPropagation()}
      >
        <EducationImagePreview
          log={log}
          imageSrc={imageSrc}
          imageLoading={imageLoading}
          onClose={onClose}
        />

        <div className="p-4 overflow-y-auto" style={{ maxHeight: '40vh' }}>
          <div className="space-y-3">
            <h3 className="font-semibold text-gray-900 text-sm flex items-center">
              <BookOpen className="w-5 h-5 text-gray-500 mr-1.5" />
              Meeting Details
            </h3>

            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              <DetailRow label="Topic" value={log.Topic || 'Education Meeting'} truncate />
              <DetailRow label="Platform" value={log.Platform || 'Online Meeting'} />
              <DetailRow label="Date" value={formatLogDate(log.CreatedAt)} />
              <DetailRow label="Time" value={formatLogTime(log.CreatedAt)} />

              {isCaloriesBurnedTopic(log.Topic) && (
                <div className="flex justify-between items-center pt-1 border-t border-gray-100 mt-1">
                  <span className="text-sm text-orange-600 font-medium">⌚ Calories Burned</span>
                  <span className="text-sm font-bold text-orange-700">
                    {extractCaloriesValue(log.Topic)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-4 pt-0">
          <DeleteEducationButton onDelete={() => onDelete(log)} isDeleting={isDeleting} />
        </div>
      </div>
    </div>
  );
};

function DetailRow({ label, value, truncate = false }) {
  return (
    <div className="flex justify-between items-start">
      <span className="text-sm text-gray-600">{label}</span>
      <span className={`text-sm font-semibold text-gray-900 text-right ${truncate ? 'max-w-[60%]' : ''}`}>
        {value}
      </span>
    </div>
  );
}

export default EducationCardModal;
