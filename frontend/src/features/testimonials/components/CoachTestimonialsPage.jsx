/**
 * CoachTestimonialsPage.jsx
 * Coach's read-only view of all direct-downline testimonials.
 * - Members with no testimonial are highlighted in red.
 * - Members with a pending testimonial show an amber badge + reminder to share the OTP.
 * - Members with a verified testimonial show a green badge + before/after photos.
 * OTP is entered by the MEMBER (not coach) after the coach shares it via WhatsApp/phone.
 */
import React, { useEffect, useCallback, useState } from 'react';
import { AlertCircle, CheckCircle, Clock, RefreshCw, Users } from 'lucide-react';
import TouchFeedbackButton from '../../../shared/components/TouchFeedbackButton';
import LoadingSpinner from '../../../shared/components/LoadingSpinner';
import { listForCoach } from '../services/testimonialApi.js';
import { PORTRAIT_IMAGE_CLASS_SM } from '../services/testimonialFormUtils.js';

function MemberRow({ user, testimonial }) {
  const missing  = !testimonial;
  const pending  = testimonial?.status === 'pending';
  const verified = testimonial?.status === 'verified';

  const diff = testimonial
    ? Math.abs(testimonial.afterWeightKg - testimonial.beforeWeightKg).toFixed(1)
    : null;
  const arrow     = testimonial?.goalType === 'loss' ? '↓' : '↑';
  const goalLabel = testimonial?.goalType === 'loss' ? 'Weight Loss' : 'Weight Gain';

  return (
    <div
      className={`rounded-2xl border-2 p-4 space-y-3 transition-colors ${
        missing
          ? 'border-red-300 bg-red-50'
          : pending
            ? 'border-amber-300 bg-amber-50'
            : 'border-green-300 bg-white'
      }`}
    >
      {/* Member header */}
      <div className="flex items-center gap-3">
        {user.profileImage ? (
          <img
            src={user.profileImage}
            alt={user.userName}
            className="h-10 w-10 rounded-full object-cover border border-gray-200"
            loading="lazy"
          />
        ) : (
          <div className="h-10 w-10 rounded-full bg-green-200 flex items-center justify-center text-green-800 font-bold text-sm">
            {(user.userName || '?').charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 text-sm truncate">{user.userName}</p>
          <div className="mt-0.5">
            {missing && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-600">
                <AlertCircle className="h-3 w-3" /> Not Uploaded
              </span>
            )}
            {pending && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700">
                <Clock className="h-3 w-3" /> Pending Verification
              </span>
            )}
            {verified && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-green-700">
                <CheckCircle className="h-3 w-3" /> Verified
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Testimonial details */}
      {testimonial && (
        <>
          {/* Photos */}
          {(testimonial.beforeImageUrl || testimonial.afterImageUrl) && (
            <div className="flex gap-2">
              {testimonial.beforeImageUrl && (
                <div className="flex-1 text-center">
                  <img
                    src={testimonial.beforeImageUrl}
                    alt="Before"
                    className={PORTRAIT_IMAGE_CLASS_SM}
                    loading="lazy"
                  />
                  <p className="text-[10px] text-gray-400 mt-1 font-semibold">BEFORE</p>
                </div>
              )}
              {testimonial.afterImageUrl && (
                <div className="flex-1 text-center">
                  <img
                    src={testimonial.afterImageUrl}
                    alt="After"
                    className={PORTRAIT_IMAGE_CLASS_SM}
                    loading="lazy"
                  />
                  <p className="text-[10px] text-gray-400 mt-1 font-semibold">AFTER</p>
                </div>
              )}
            </div>
          )}

          {/* Stats */}
          <div className="flex gap-2 flex-wrap text-xs">
            <span className="bg-white border border-gray-200 rounded-full px-2.5 py-1 text-gray-700 font-medium">
              Before: {testimonial.beforeWeightKg} kg
            </span>
            <span className="bg-white border border-gray-200 rounded-full px-2.5 py-1 text-gray-700 font-medium">
              After: {testimonial.afterWeightKg} kg
            </span>
            <span className="bg-white border border-gray-200 rounded-full px-2.5 py-1 text-green-700 font-semibold">
              {arrow} {diff} kg
            </span>
            <span className="bg-white border border-gray-200 rounded-full px-2.5 py-1 text-gray-700 font-medium">
              {goalLabel}
            </span>
            <span className="bg-white border border-gray-200 rounded-full px-2.5 py-1 text-gray-700 font-medium">
              ⏱ {testimonial.durationText}
            </span>
          </div>

          {pending && (
            <p className="text-xs text-amber-700 font-medium bg-amber-100 rounded-xl px-3 py-2 text-center">
              📧 OTP sent to your email — share it with {user.userName} to verify
            </p>
          )}

          {verified && testimonial.verifiedAt && (
            <p className="text-xs text-green-600 font-medium">
              ✅ Verified {new Date(testimonial.verifiedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          )}
        </>
      )}
    </div>
  );
}

export default function CoachTestimonialsPage({ user }) {
  const [rows,    setRows]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  // Coach view is read-only — OTP is entered by the member
  // after the coach shares it with them via WhatsApp/phone.

  const coachId = user?.userId || user?.id;

  const load = useCallback(async () => {
    if (!coachId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await listForCoach(coachId);
      setRows(data || []);
    } catch (err) {
      setError(err.message || 'Failed to load testimonials');
    } finally {
      setLoading(false);
    }
  }, [coachId]);

  useEffect(() => { load(); }, [load]);

  const uploadedCount  = rows.filter((r) => r.testimonial).length;
  const verifiedCount  = rows.filter((r) => r.testimonial?.status === 'verified').length;
  const pendingCount   = rows.filter((r) => r.testimonial?.status === 'pending').length;
  const missingCount   = rows.filter((r) => !r.testimonial).length;

  return (
    <div className="max-w-lg mx-auto px-4 pt-4 pb-24 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-green-700" />
          <h1 className="text-lg font-bold text-gray-900">Team Testimonials</h1>
        </div>
        <TouchFeedbackButton
          onClick={load}
          disabled={loading}
          className="p-2 rounded-full text-gray-500 hover:text-green-700 hover:bg-green-50 transition-colors"
          ariaLabel="Refresh"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </TouchFeedbackButton>
      </div>

      {/* Summary chips */}
      {!loading && rows.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <span className="bg-green-100 text-green-800 rounded-full px-3 py-1 text-xs font-bold">
            ✅ Verified: {verifiedCount}
          </span>
          <span className="bg-amber-100 text-amber-800 rounded-full px-3 py-1 text-xs font-bold">
            🕐 Pending: {pendingCount}
          </span>
          <span className="bg-red-100 text-red-800 rounded-full px-3 py-1 text-xs font-bold">
            ⚠️ Not Uploaded: {missingCount}
          </span>
        </div>
      )}

      {loading && <LoadingSpinner message="Loading team testimonials…" />}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && !error && rows.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No team members found</p>
        </div>
      )}

      {!loading && rows.map(({ user: member, testimonial }) => (
        <MemberRow
          key={member.userId}
          user={member}
          testimonial={testimonial}
        />
      ))}


    </div>
  );
}
