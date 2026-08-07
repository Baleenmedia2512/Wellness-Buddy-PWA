/**
 * TestimonialsPage.jsx
 * Top-level page for the testimonials feature.
 * Inline editing is now handled directly on the Mine card — no modal needed.
 * Route: shown when App.js `showTestimonials` is true.
 */
import React, { useState } from 'react';
import CoachTestimonialsPage from './CoachTestimonialsPage';

export default function TestimonialsPage({ user, tabVisitKey = 0 }) {
  const userId = user?.userId ?? user?.id ?? null;
  const [reloadSignal, setReloadSignal] = useState(0);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 max-w-lg mx-auto">
        <span className="font-bold text-gray-800">Results / Testimonials</span>
      </div> */}

      {userId ? (
        <CoachTestimonialsPage
          user={user}
          reloadSignal={reloadSignal}
          tabVisitKey={tabVisitKey}
        />
      ) : (
        <div className="max-w-lg mx-auto px-4 py-12 text-center text-gray-400">
          <p>Unable to load your profile. Please sign in again.</p>
        </div>
      )}
    </div>
  );
}