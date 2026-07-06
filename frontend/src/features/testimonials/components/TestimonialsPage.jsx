/**
 * TestimonialsPage.jsx
 * Top-level page for the testimonials feature.
 * - Members see their submission form + status card.
 * - Coaches see the team list view (CoachTestimonialsPage).
 *
 * Route: shown when App.js `showTestimonials` is true.
 */
import React, { useRef } from 'react';
import { ArrowLeft, Trophy } from 'lucide-react';
import TouchFeedbackButton from '../../../shared/components/TouchFeedbackButton';
import LoadingSpinner from '../../../shared/components/LoadingSpinner';
import { useTestimonial } from '../hooks/useTestimonial.js';
import TestimonialForm from './TestimonialForm';
import TestimonialStatusCard from './TestimonialStatusCard';
import CoachTestimonialsPage from './CoachTestimonialsPage';

function MemberView({ userId }) {
  const beforeInputRef = useRef(null);
  const afterInputRef  = useRef(null);

  const {
    form,
    setField,
    beforeImage,
    afterImage,
    handleBeforeImageChange,
    handleAfterImageChange,
    existing,
    isEditMode,
    submitting,
    error,
    success,
    handleSubmit,
    startEdit,
    cancelEdit,
  } = useTestimonial({ userId });

  // Still loading existing testimonial
  if (existing === undefined) {
    return <LoadingSpinner message="Loading your testimonial…" />;
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-4 pb-24 space-y-4">
      {/* Page title */}
      <div className="flex items-center gap-2">
        <Trophy className="h-5 w-5 text-green-600" />
        <h1 className="text-lg font-bold text-gray-900">My Transformation</h1>
      </div>

      {/* Success banner */}
      {success && (
        <div className="bg-green-50 border border-green-300 rounded-2xl px-4 py-3 text-sm text-green-800 font-medium">
          {success}
        </div>
      )}

      {/* Show status card when there's an existing testimonial and not in edit mode */}
      {existing && !isEditMode && (
        <TestimonialStatusCard testimonial={existing} onEdit={startEdit} />
      )}

      {/* Show form when there's no existing testimonial OR we're in edit mode */}
      {(!existing || isEditMode) && (
        <TestimonialForm
          form={form}
          setField={setField}
          beforeImage={beforeImage}
          afterImage={afterImage}
          beforeInputRef={beforeInputRef}
          afterInputRef={afterInputRef}
          onBeforeChange={handleBeforeImageChange}
          onAfterChange={handleAfterImageChange}
          onSubmit={handleSubmit}
          submitting={submitting}
          error={error}
          isEditMode={isEditMode}
          onCancel={existing ? cancelEdit : null}
        />
      )}

      {/* Info box — explain the flow to the member */}
      {!existing && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl px-4 py-4 text-sm text-blue-800 space-y-1">
          <p className="font-bold">How it works</p>
          <ol className="list-decimal list-inside space-y-1 text-xs leading-5">
            <li>Upload your before &amp; after photos.</li>
            <li>Fill in your starting weight, final weight, goal type, and duration.</li>
            <li>Tap <strong>Submit to Coach</strong> — your coach gets an email with the photos and a 6-digit OTP.</li>
            <li>Your coach enters the OTP in the app to officially verify your testimonial.</li>
          </ol>
        </div>
      )}
    </div>
  );
}

export default function TestimonialsPage({ user, userRole, onBack }) {
  const isCoach = userRole === 'coach' || userRole === 'admin' || userRole === 'developer';

  // Build a userId number from user context (App.js userContext)
  const userId = user?.userId ?? user?.id ?? null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Back bar (only shows when page is mounted as full-screen overlay, not inside shell) */}
      {onBack && (
        <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 max-w-lg mx-auto">
          <TouchFeedbackButton onClick={onBack} className="p-1 rounded-full text-gray-600 hover:text-green-700">
            <ArrowLeft className="h-5 w-5" />
          </TouchFeedbackButton>
          <span className="font-bold text-gray-800">Results / Testimonials</span>
        </div>
      )}

      {/* Role-based content */}
      {isCoach ? (
        <>
          {/* Coaches see team view, and can also view their own member testimonial */}
          <CoachTestimonialsPage user={user} />
          {userId && (
            <div className="border-t border-gray-200 mt-4">
              <div className="max-w-lg mx-auto px-4 py-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Your Own Testimonial</p>
                <MemberView userId={userId} />
              </div>
            </div>
          )}
        </>
      ) : (
        userId
          ? <MemberView userId={userId} />
          : (
            <div className="max-w-lg mx-auto px-4 py-12 text-center text-gray-400">
              <p>Unable to load your profile. Please sign in again.</p>
            </div>
          )
      )}
    </div>
  );
}
