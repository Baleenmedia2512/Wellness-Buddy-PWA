/**
 * TestimonialVideoForm.jsx
 * Form for uploading health-results and business-results videos.
 *
 * Health video:   optional, max 1 min
 * Business video: optional, max 2 min
 * At least one must be selected before submitting.
 * After upload, coach receives an OTP email; member enters it to verify.
 */
import React, { useRef } from 'react';
import { Video, CheckCircle, Plus, Trash2, Upload } from 'lucide-react';
import TouchFeedbackButton from '../../../shared/components/TouchFeedbackButton';

function VideoPicker({ label, description, video, inputRef, onChange, onRemove }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Video className="h-4 w-4 text-green-600 shrink-0" />
        <p className="text-sm font-semibold text-gray-700">
          {label} <span className="text-gray-400 font-normal text-xs">({description} — optional)</span>
        </p>
      </div>

      {video ? (
        /* Uploaded state */
        <div className="flex items-center justify-between bg-green-50 border border-green-300 rounded-xl px-3 py-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-green-800 truncate">{video.name}</p>
              <p className="text-[11px] text-green-600">
                {video.sizeLabel}
                {video.durationUnverified ? ' · length not verified on this device' : ''}
              </p>
            </div>
          </div>
          <div className="flex gap-1 shrink-0 ml-2">
            <TouchFeedbackButton
              onClick={() => inputRef.current?.click()}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-green-300 text-green-700 text-xs font-medium"
              ariaLabel={`Replace ${label}`}
            >
              <Upload className="h-3 w-3" /> Replace
            </TouchFeedbackButton>
            <TouchFeedbackButton
              onClick={onRemove}
              className="p-1 rounded-lg bg-white border border-red-200 text-red-500"
              ariaLabel={`Remove ${label}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </TouchFeedbackButton>
          </div>
        </div>
      ) : (
        /* Empty state */
        <TouchFeedbackButton
          onClick={() => inputRef.current?.click()}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl border-2 border-dashed border-gray-300 text-gray-500 text-sm font-medium hover:border-green-400 hover:text-green-700 transition-colors"
          ariaLabel={`Upload ${label}`}
        >
          <Plus className="h-4 w-4" />
          Upload {label}
        </TouchFeedbackButton>
      )}

      {/* Hidden file input — MP4, MOV, QT, 3GP (common mobile camera formats) */}
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/3gpp,.mp4,.mov,.qt,.3gp"
        className="hidden"
        onChange={onChange}
      />
    </div>
  );
}

export default function TestimonialVideoForm({
  healthVideo,
  businessVideo,
  handleHealthVideoChange,
  handleBusinessVideoChange,
  onRemoveHealth,
  onRemoveBusiness,
  onSubmit,
  submitting,
  error,
  warning,
  locked,        // true when no photo testimonial exists yet
}) {
  const healthRef   = useRef(null);
  const businessRef = useRef(null);

  const hasAny = !!(healthVideo || businessVideo);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Video className="h-5 w-5 text-green-600" />
        <h2 className="text-base font-bold text-gray-800">Result Videos</h2>
        <span className="ml-auto text-[11px] text-gray-400 font-medium bg-gray-100 rounded-full px-2.5 py-0.5">
          Optional
        </span>
      </div>

      <p className="text-xs text-gray-500 leading-relaxed">
        Share your real results! Upload a short health or business results video.
        Your coach will verify the upload with an OTP.
      </p>

      {locked ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          <p className="font-semibold">Photos required first</p>
          <p className="text-xs mt-1">Please upload your before/after transformation photos before adding result videos.</p>
        </div>
      ) : (
        <>
          <VideoPicker
            label="Health Results Video"
            description="max 1 min"
            video={healthVideo}
            inputRef={healthRef}
            onChange={handleHealthVideoChange}
            onRemove={onRemoveHealth}
          />

          <VideoPicker
            label="Business Results Video"
            description="max 2 min"
            video={businessVideo}
            inputRef={businessRef}
            onChange={handleBusinessVideoChange}
            onRemove={onRemoveBusiness}
          />

          {warning && !error && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
              {warning}
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <TouchFeedbackButton
            onClick={onSubmit}
            disabled={submitting || !hasAny}
            className="w-full py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-bold transition-colors disabled:opacity-50"
          >
            {submitting ? 'Uploading…' : 'Upload & Notify Coach'}
          </TouchFeedbackButton>
        </>
      )}
    </div>
  );
}
