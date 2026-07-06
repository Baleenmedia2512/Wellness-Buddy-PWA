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
  const beforeCameraRef  = useRef(null);
  const beforeGalleryRef = useRef(null);
  const afterCameraRef   = useRef(null);
  const afterGalleryRef  = useRef(null);

  const {
    form, setField,
    beforeImage, afterImage,
    handleBeforeImageChange, handleAfterImageChange,
    existing, reload,
    isEditMode, isCompletingMode,
    submitting, error, success,
    handleSubmit, startEdit, startCompleting, cancelEdit,
  } = useTestimonial({ userId });

  if (existing === undefined) {
    return <LoadingSpinner message="Loading your testimonial…" />;
  }

  // Show form when: no existing record, or in full-edit mode, or in completing mode
  const showForm = !existing || isEditMode || isCompletingMode;

  return (
    <div className="max-w-lg mx-auto px-4 pt-4 pb-24 space-y-4">
      <div className="flex items-center gap-2">
        <Trophy className="h-5 w-5 text-green-600" />
        <h1 className="text-lg font-bold text-gray-900">My Transformation</h1>
      </div>

      {success && (
        <div className="bg-green-50 border border-green-300 rounded-2xl px-4 py-3 text-sm text-green-800 font-medium">
          {success}
        </div>
      )}

      {/* Status card — shown when there's an existing record and not in edit mode */}
      {existing && !isEditMode && !isCompletingMode && (
        <TestimonialStatusCard
          testimonial={existing}
          onEdit={startEdit}
          onAddAfter={existing.status === 'incomplete' ? startCompleting : null}
          onVerified={reload}
        />
      )}

      {/* Form — new submission, full edit, or completing incomplete */}
      {showForm && (
        <TestimonialForm
          form={form}
          setField={setField}
          beforeImage={beforeImage}
          afterImage={afterImage}
          beforeCameraRef={beforeCameraRef}
          beforeGalleryRef={beforeGalleryRef}
          afterCameraRef={afterCameraRef}
          afterGalleryRef={afterGalleryRef}
          onBeforeCameraChange={handleBeforeImageChange}
          onBeforeGalleryChange={handleBeforeImageChange}
          onAfterCameraChange={handleAfterImageChange}
          onAfterGalleryChange={handleAfterImageChange}
          onSubmit={handleSubmit}
          submitting={submitting}
          error={error}
          isEditMode={isEditMode}
          isIncomplete={isCompletingMode}
          onCancel={existing ? cancelEdit : null}
        />
      )}

      {/* How it works — only for fresh users */}
      {!existing && !showForm && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl px-4 py-4 text-sm text-blue-800 space-y-1">
          <p className="font-bold">How it works</p>
          <ol className="list-decimal list-inside space-y-1 text-xs leading-5">
            <li>Upload your <strong>Before</strong> photo now — After photo is optional at this step.</li>
            <li>When you have your results, come back and add the <strong>After</strong> photo.</li>
            <li>Your coach receives an email with the OTP — they share it with you.</li>
            <li>Enter the OTP in the app to get your testimonial officially verified.</li>
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
