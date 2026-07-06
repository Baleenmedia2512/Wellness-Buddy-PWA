/**
 * TestimonialStatusCard.jsx
 * Shows the member's current testimonial summary + status badge.
 * Provides an Edit button that triggers the parent to enter edit mode.
 */
import React from 'react';
import { CheckCircle, Clock, Pencil } from 'lucide-react';
import TouchFeedbackButton from '../../../shared/components/TouchFeedbackButton';

function StatusBadge({ status }) {
  if (status === 'verified') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-100 text-green-800 text-xs font-bold">
        <CheckCircle className="h-3.5 w-3.5" /> Verified
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-bold">
      <Clock className="h-3.5 w-3.5" /> Pending Coach Verification
    </span>
  );
}

export default function TestimonialStatusCard({ testimonial, onEdit }) {
  if (!testimonial) return null;

  const diff = Math.abs(testimonial.afterWeightKg - testimonial.beforeWeightKg).toFixed(1);
  const arrow = testimonial.goalType === 'loss' ? '↓' : '↑';
  const goalLabel = testimonial.goalType === 'loss' ? 'Weight Loss' : 'Weight Gain';

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-gray-800">Your Testimonial</h2>
        <StatusBadge status={testimonial.status} />
      </div>

      {/* Before / After photos */}
      {(testimonial.beforeImageUrl || testimonial.afterImageUrl) && (
        <div className="flex gap-3">
          {testimonial.beforeImageUrl && (
            <div className="flex-1 text-center">
              <img
                src={testimonial.beforeImageUrl}
                alt="Before"
                className="w-full h-32 object-cover rounded-xl border border-gray-200"
                loading="lazy"
              />
              <p className="text-xs text-gray-500 mt-1 font-semibold">BEFORE</p>
            </div>
          )}
          {testimonial.afterImageUrl && (
            <div className="flex-1 text-center">
              <img
                src={testimonial.afterImageUrl}
                alt="After"
                className="w-full h-32 object-cover rounded-xl border border-gray-200"
                loading="lazy"
              />
              <p className="text-xs text-gray-500 mt-1 font-semibold">AFTER</p>
            </div>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-gray-50 rounded-xl p-2">
          <p className="text-[10px] text-gray-500 font-semibold uppercase">Before</p>
          <p className="text-sm font-bold text-gray-800">{testimonial.beforeWeightKg} kg</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-2">
          <p className="text-[10px] text-gray-500 font-semibold uppercase">After</p>
          <p className="text-sm font-bold text-gray-800">{testimonial.afterWeightKg} kg</p>
        </div>
        <div className="bg-green-50 rounded-xl p-2">
          <p className="text-[10px] text-gray-500 font-semibold uppercase">Change</p>
          <p className="text-sm font-bold text-green-700">{arrow} {diff} kg</p>
        </div>
      </div>

      <div className="flex gap-2 text-xs text-gray-600">
        <span className="bg-gray-100 rounded-full px-3 py-1 font-medium">{goalLabel}</span>
        <span className="bg-gray-100 rounded-full px-3 py-1 font-medium">⏱ {testimonial.durationText}</span>
      </div>

      {testimonial.status === 'verified' && testimonial.verifiedAt && (
        <p className="text-xs text-green-600 font-medium">
          ✅ Verified on {new Date(testimonial.verifiedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
      )}

      {/* Edit button — always available, always requires re-verification */}
      <TouchFeedbackButton
        onClick={onEdit}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-gray-300 text-gray-700 text-sm font-semibold hover:border-green-400 hover:text-green-700 transition-colors"
      >
        <Pencil className="h-4 w-4" />
        Edit Testimonial
      </TouchFeedbackButton>

      {testimonial.status === 'pending' && (
        <p className="text-xs text-amber-600 text-center">
          After editing, your coach will receive a new verification email.
        </p>
      )}
    </div>
  );
}
