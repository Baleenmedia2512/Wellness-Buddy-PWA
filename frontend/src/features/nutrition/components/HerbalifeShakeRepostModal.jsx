/**
 * Asks whether to post another Herbalife Shake inside the one-hour window.
 */
import React from 'react';
import { formatBusinessTime, DEFAULT_BUSINESS_TIMEZONE } from '../../../shared/utils/datetimeUtils';

export default function HerbalifeShakeRepostModal({
  loggedAt,
  timezoneIana = DEFAULT_BUSINESS_TIMEZONE,
  onConfirm,
  onCancel,
}) {
  const postedAt = formatBusinessTime(loggedAt, timezoneIana);

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="herbalife-shake-repost-title"
      className="fixed inset-0 z-[100000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel?.();
      }}
    >
      <div
        className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-br from-amber-500 to-orange-600 p-6 text-white">
          <h2 id="herbalife-shake-repost-title" className="text-2xl font-bold text-center">
            Post again?
          </h2>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-gray-800 text-center leading-relaxed">
              You posted a Herbalife Shake
              {postedAt ? (
                <>
                  {' '}at <span className="font-semibold text-amber-900">{postedAt}</span>
                </>
              ) : (
                ' within the last hour'
              )}
              . Do you want to post it again?
            </p>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 bg-gray-100 text-gray-700 py-3.5 px-4 rounded-xl font-semibold"
            >
              No
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-600 text-white py-3.5 px-4 rounded-xl font-semibold"
            >
              Yes, post again
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
