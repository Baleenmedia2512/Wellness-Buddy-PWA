/**
 * TestimonialsPage.jsx
 * Top-level page for the testimonials feature.
 * - Members see the unified TestimonialsHub (4 upload slots on one page).
 * - Coaches see the team list view (CoachTestimonialsPage) + their own hub below.
 *
 * Route: shown when App.js `showTestimonials` is true.
 */
import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import TouchFeedbackButton from '../../../shared/components/TouchFeedbackButton';
import CoachTestimonialsPage from './CoachTestimonialsPage';
import TestimonialsHub from './TestimonialsHub';

export default function TestimonialsPage({ user, userRole, onBack }) {
  const isCoach = userRole === 'coach' || userRole === 'admin' || userRole === 'developer';
  const [activeTab, setActiveTab] = useState('photos');

  const userId = user?.userId ?? user?.id ?? null;

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

      {isCoach ? (
        <>
          <CoachTestimonialsPage
            user={user}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
          {userId && (
            <div className="border-t border-gray-200 mt-4">
              <div className="max-w-lg mx-auto px-4 py-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                  Your Own Transformation
                </p>
                <TestimonialsHub userId={userId} />
              </div>
            </div>
          )}
        </>
      ) : (
        userId
          ? <TestimonialsHub userId={userId} />
          : (
            <div className="max-w-lg mx-auto px-4 py-12 text-center text-gray-400">
              <p>Unable to load your profile. Please sign in again.</p>
            </div>
          )
      )}
    </div>
  );
}
