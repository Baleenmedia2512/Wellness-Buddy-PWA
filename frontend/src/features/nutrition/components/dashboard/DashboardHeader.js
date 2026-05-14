import React from 'react';
import { ArrowLeft, Calendar } from 'lucide-react';
import TouchFeedbackButton from '../../../../shared/components/TouchFeedbackButton';

/**
 * Top sticky header: back button, screen title, formatted date, calendar toggle.
 * Pure presentation — parent owns navigation + calendar state.
 */
function DashboardHeader({
  onBack,
  selectedDate,
  formatDateHeader,
  showCalendar,
  setShowCalendar,
}) {
  return (
    <div className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
      <div className="w-full max-w-md mx-auto md:max-w-2xl lg:max-w-4xl">
        <div className="flex items-center justify-between p-4 md:p-6">
          <TouchFeedbackButton
            onClick={onBack}
            className="p-2 md:p-3 hover:bg-gray-100 rounded-xl transition-colors"
            ariaLabel="Go back"
          >
            <ArrowLeft className="h-5 w-5 text-gray-700" />
          </TouchFeedbackButton>

          <div className="text-center">
            <h1 className="text-lg md:text-xl font-semibold text-gray-900">
              Nutrition
            </h1>
            <p className="text-sm text-gray-600">
              {formatDateHeader(selectedDate)}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCalendar(!showCalendar)}
              className="p-2 md:p-3 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <Calendar className="h-5 w-5 text-gray-700" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashboardHeader;
