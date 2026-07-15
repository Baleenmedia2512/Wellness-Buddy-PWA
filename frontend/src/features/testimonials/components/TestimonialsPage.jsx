/**
 * TestimonialsPage.jsx
 * Top-level page for the testimonials feature.
 * - Everyone sees the MemberCard-style view (before/after, videos, health issues).
 * - Users with a downline also get Mine | Direct | Full + search/filters.
 * - Users without a downline only see their own card (no team chrome).
 * - Edit opens a focused modal with only that slot’s form (TestimonialsHub).
 *
 * Route: shown when App.js `showTestimonials` is true.
 */
import React, { useCallback, useState } from 'react';
import { ArrowLeft, X } from 'lucide-react';
import TouchFeedbackButton from '../../../shared/components/TouchFeedbackButton';
import CoachTestimonialsPage from './CoachTestimonialsPage';
import TestimonialsHub from './TestimonialsHub';

const FOCUS_TITLES = {
  before:   'Edit Before Photo',
  after:    'Edit After Photo',
  health:   'Edit Health Video',
  business: 'Edit Business Video',
  issues:   'Edit Health Issues',
};

export default function TestimonialsPage({ user, onBack }) {
  const userId = user?.userId ?? user?.id ?? null;
  const [focusSlot, setFocusSlot] = useState(null);
  const [reloadSignal, setReloadSignal] = useState(0);

  const bumpReload = useCallback(() => {
    setReloadSignal((n) => n + 1);
  }, []);

  const handleEditOwnSlot = useCallback((slot) => {
    setFocusSlot(slot);
  }, []);

  const handleFocusClose = useCallback(() => {
    setFocusSlot(null);
    // Edit may have reset status to pending + emailed a new OTP — refresh Mine card
    bumpReload();
  }, [bumpReload]);

  return (
    <div className="min-h-screen bg-gray-50">
      {onBack && (
        <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 max-w-lg mx-auto">
          <TouchFeedbackButton onClick={onBack} className="p-1 rounded-full text-gray-600 hover:text-green-700">
            <ArrowLeft className="h-5 w-5" />
          </TouchFeedbackButton>
          <span className="font-bold text-gray-800">Results / Testimonials</span>
        </div>
      )}

      {userId ? (
        <CoachTestimonialsPage
          user={user}
          onEditOwnSlot={handleEditOwnSlot}
          reloadSignal={reloadSignal}
        />
      ) : (
        <div className="max-w-lg mx-auto px-4 py-12 text-center text-gray-400">
          <p>Unable to load your profile. Please sign in again.</p>
        </div>
      )}

      {/* Focused edit modal — Mine → Edit (any role) */}
      {focusSlot && userId && (
        <div
          className="fixed inset-0 z-[100] bg-black/50 flex flex-col justify-end sm:justify-center"
          role="dialog"
          aria-modal="true"
          aria-label={FOCUS_TITLES[focusSlot] || 'Edit'}
        >
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Close"
            onClick={handleFocusClose}
          />
          <div className="relative z-10 w-full max-w-lg mx-auto bg-gray-50 rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[92vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100 shrink-0">
              <p className="text-sm font-bold text-gray-900">
                {FOCUS_TITLES[focusSlot] || 'Edit'}
              </p>
              <TouchFeedbackButton
                onClick={handleFocusClose}
                className="p-1.5 rounded-full text-gray-500 hover:bg-gray-100"
                ariaLabel="Close"
              >
                <X className="h-5 w-5" />
              </TouchFeedbackButton>
            </div>
            <div className="overflow-y-auto flex-1">
              <TestimonialsHub
                userId={userId}
                focusOnly={focusSlot}
                onFocusClose={handleFocusClose}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
