/**
 * TestimonialsHub.jsx
 * Unified single-page transformation hub for members.
 *
 * Five distinct upload slots on one page:
 *   1. Before Photo  (with weight / goal / duration metadata)
 *   2. After Photo   (available once before photo is saved)
 *   3. Health Results Video  (max 1 min)
 *   4. Business Results Video  (max 2 min)
 *   5. Recovered Health Issues  (searchable multi-select)
 *
 * Overall status bar classifies the member's upload completeness across all 5 slots:
 *   Not Uploaded → Partial Upload → Awaiting Approval → Fully Uploaded / Verified
 *
 * Users may upload any slot independently or fill multiple slots then submit each section.
 */
import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Camera,
  Images,
  Video,
  CheckCircle,
  Clock,
  AlertCircle,
  Lock,
  Pencil,
  ShieldCheck,
  Trophy,
  Plus,
  Trash2,
  Upload,
  ChevronDown,
  ChevronUp,
  Star,
  HeartPulse,
  Save,
} from 'lucide-react';
import TouchFeedbackButton from '../../../shared/components/TouchFeedbackButton';
import LoadingSpinner from '../../../shared/components/LoadingSpinner';
import { useTestimonial } from '../hooks/useTestimonial.js';
import { useTestimonialVideo } from '../hooks/useTestimonialVideo.js';
import { MAX_HEALTH_VIDEO_MB, MAX_BUSINESS_VIDEO_MB } from '../utils/videoLimits.js';
import { editTestimonial } from '../services/testimonialApi.js';
import {
  PORTRAIT_IMAGE_CLASS_SM,
  sanitizeDurationDigits,
} from '../services/testimonialFormUtils.js';
import DiseaseMultiSelect from './DiseaseMultiSelect.jsx';
import OtpInline from './OtpInline.jsx';

// ── Constants ─────────────────────────────────────────────────────────────────

const PORTRAIT_PLACEHOLDER_CLS =
  'w-full max-w-[160px] mx-auto aspect-[9/16] rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center';

// ── Slot status badge ─────────────────────────────────────────────────────────

const SLOT_STATUS_CFG = {
  none:     { label: 'Not Uploaded',      cls: 'bg-gray-100  text-gray-500',   Icon: AlertCircle },
  uploaded: { label: 'Saved',             cls: 'bg-blue-100  text-blue-700',   Icon: CheckCircle },
  pending:  { label: 'Awaiting Approval', cls: 'bg-amber-100 text-amber-700',  Icon: Clock       },
  verified: { label: 'Verified ✓',        cls: 'bg-green-100 text-green-700',  Icon: CheckCircle },
  locked:   { label: 'Locked',            cls: 'bg-gray-100  text-gray-400',   Icon: Lock        },
};

function SlotBadge({ status }) {
  const cfg = SLOT_STATUS_CFG[status] ?? SLOT_STATUS_CFG.none;
  const { label, cls, Icon } = cfg;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold shrink-0 ${cls}`}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

// ── Slot status computation ───────────────────────────────────────────────────

function computeSlotStatuses(existing, existingVideo) {
  const beforePhoto =
    !existing                          ? 'none'
    : existing.status === 'verified'   ? 'verified'
    : existing.status === 'pending'    ? 'pending'
    : /* incomplete */                   'uploaded';

  const afterPhoto =
    !existing || existing.status === 'incomplete' ? 'none'
    : existing.status === 'pending'               ? 'pending'
    : /* verified */                                'verified';

  const healthVideo =
    !existingVideo || !existingVideo.hasHealthVideo ? 'none'
    : existingVideo.videoStatus === 'verified'       ? 'verified'
    : /* pending */                                    'pending';

  const businessVideo =
    !existingVideo || !existingVideo.hasBusinessVideo ? 'none'
    : existingVideo.videoStatus === 'verified'         ? 'verified'
    : /* pending */                                      'pending';

  const issues = existing?.recoveredHealthIssues ?? existingVideo?.recoveredHealthIssues ?? [];
  const healthIssues =
    !existing && !existingVideo               ? 'none'
    : Array.isArray(issues) && issues.length > 0 ? 'uploaded'
    :                                              'none';

  return { beforePhoto, afterPhoto, healthVideo, businessVideo, healthIssues };
}

// ── Overall status bar ────────────────────────────────────────────────────────

function OverallStatusBar({ slots, photoSuccess, videoSuccess }) {
  const values    = Object.values(slots);
  const uploaded  = values.filter((s) => s !== 'none' && s !== 'locked').length;
  const pending   = values.filter((s) => s === 'pending').length;
  const verified  = values.filter((s) => s === 'verified').length;
  const total     = 5;

  let label, barPct;
  if (uploaded === 0) {
    label  = 'Upload any item below to start your transformation';
    barPct = 0;
  } else if (verified === total) {
    label  = 'Fully Verified — all 5 items approved by your sponsor';
    barPct = 100;
  } else if (uploaded === total && pending > 0) {
    label  = `All ${total} items uploaded · ${pending} awaiting sponsor approval`;
    barPct = 90;
  } else if (pending > 0) {
    label  = `${uploaded} of ${total} items uploaded · ${pending} awaiting approval`;
    barPct = (uploaded / total) * 80;
  } else {
    label  = `${uploaded} of ${total} items uploaded`;
    barPct = (uploaded / total) * 70;
  }

  const barColor =
    verified === total  ? 'bg-green-500'
    : pending > 0       ? 'bg-amber-400'
    : uploaded > 0      ? 'bg-blue-500'
    : 'bg-gray-200';

  // Dot colours per slot
  const dotColor = (s) =>
    s === 'verified' ? 'bg-green-500 shadow-sm shadow-green-200'
    : s === 'pending' ? 'bg-amber-400'
    : s !== 'none'    ? 'bg-blue-400'
    : 'bg-gray-200';

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
      {/* Title row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-green-600" />
          <h1 className="text-base font-bold text-gray-900">My Transformation</h1>
        </div>
        <span className="text-xs font-bold text-gray-400 bg-gray-100 rounded-full px-2.5 py-1">
          {uploaded}/{total}
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${barPct}%` }}
        />
      </div>

      {/* Slot dots legend */}
      <div className="grid grid-cols-5 gap-1.5 text-center">
        {[
          { label: 'Before',   key: 'beforePhoto' },
          { label: 'After',    key: 'afterPhoto' },
          { label: 'Health',   key: 'healthVideo' },
          { label: 'Business', key: 'businessVideo' },
          { label: 'Issues',   key: 'healthIssues' },
        ].map(({ label: l, key }) => (
          <div key={key} className="space-y-1">
            <div className={`h-2 w-full rounded-full ${dotColor(slots[key])}`} />
            <p className="text-[9px] text-gray-400 font-medium leading-tight">{l}</p>
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-500 leading-relaxed">{label}</p>

      {/* Toast messages */}
      {photoSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-3 py-2 text-xs text-green-800 font-medium">
          {photoSuccess}
        </div>
      )}
      {videoSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-3 py-2 text-xs text-green-800 font-medium">
          {videoSuccess}
        </div>
      )}
    </div>
  );
}

// ── Image picker ──────────────────────────────────────────────────────────────

function InlineImagePicker({ image, existingPreviewUrl, cameraRef, galleryRef, onCameraChange, onGalleryChange }) {
  const previewSrc = image?.preview || existingPreviewUrl || null;
  const isExistingOnly = !image && !!existingPreviewUrl;

  return (
    <div className="space-y-2">
      {previewSrc ? (
        <div className="space-y-2">
          <img
            src={previewSrc}
            alt={isExistingOnly ? 'Current photo' : 'Selected'}
            className={`${PORTRAIT_IMAGE_CLASS_SM} max-w-[160px] mx-auto`}
          />
          <div className="flex gap-2 max-w-[160px] mx-auto">
            <TouchFeedbackButton
              onClick={() => cameraRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl bg-gray-100 text-gray-600 text-xs font-medium hover:bg-gray-200"
            >
              <Camera className="h-3.5 w-3.5" /> {isExistingOnly ? 'Camera' : 'Retake'}
            </TouchFeedbackButton>
            <TouchFeedbackButton
              onClick={() => galleryRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl bg-gray-100 text-gray-600 text-xs font-medium hover:bg-gray-200"
            >
              <Images className="h-3.5 w-3.5" /> Gallery
            </TouchFeedbackButton>
          </div>
          <p className="text-xs text-green-600 font-medium text-center flex items-center justify-center gap-1">
            <CheckCircle className="h-3.5 w-3.5" />
            {isExistingOnly ? 'Current photo — replace to change' : 'Photo selected'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className={PORTRAIT_PLACEHOLDER_CLS}>
            <Plus className="h-8 w-8 text-gray-300" />
          </div>
          <div className="flex gap-2">
            <TouchFeedbackButton
              onClick={() => cameraRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-xs font-bold transition-colors"
            >
              <Camera className="h-4 w-4" /> Camera
            </TouchFeedbackButton>
            <TouchFeedbackButton
              onClick={() => galleryRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 border-gray-300 text-gray-700 text-xs font-bold hover:border-green-400 hover:text-green-700 transition-colors"
            >
              <Images className="h-4 w-4" /> Gallery
            </TouchFeedbackButton>
          </div>
          <p className="text-[11px] text-gray-400 text-center">Portrait orientation (vertical) only</p>
        </div>
      )}
      <input ref={cameraRef}  type="file" accept="image/*" capture="environment" className="hidden" onChange={onCameraChange} />
      <input ref={galleryRef} type="file" accept="image/*"                        className="hidden" onChange={onGalleryChange} />
    </div>
  );
}

// ── Slot card wrapper ─────────────────────────────────────────────────────────

function SlotCard({ icon: Icon, iconBg, iconColor, title, subtitle, status, isExpanded, onToggle, disabled, children }) {
  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-opacity ${disabled ? 'opacity-50 border-gray-100' : 'border-gray-100'}`}>
      <button
        type="button"
        onClick={disabled ? undefined : onToggle}
        disabled={disabled}
        className={`w-full flex items-center gap-3 p-4 text-left transition-colors ${disabled ? 'cursor-not-allowed' : 'hover:bg-gray-50'}`}
      >
        <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}>
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-800">{title}</p>
          {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          <SlotBadge status={status} />
          {!disabled && (
            isExpanded
              ? <ChevronUp  className="h-4 w-4 text-gray-400" />
              : <ChevronDown className="h-4 w-4 text-gray-400" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-gray-100">
          {children}
        </div>
      )}
    </div>
  );
}

// ── Before photo slot ─────────────────────────────────────────────────────────

function BeforePhotoSlotContent({
  existing, isEditMode,
  form, setField,
  beforeImage,
  beforeCameraRef, beforeGalleryRef,
  onBeforeCameraChange, onBeforeGalleryChange,
  submitting, error,
  onSubmit, onCancel,
}) {
  return (
    <div className="px-4 pb-5 pt-4 space-y-4">
      {!isEditMode && (
        <p className="text-xs text-gray-500 leading-relaxed">
          Upload your starting photo. Add your weight, goal type, and how long you plan to stay on the programme.
        </p>
      )}
      {isEditMode && (
        <p className="text-xs text-gray-500 leading-relaxed">
          Update your before photo or change your starting details.
        </p>
      )}

      <InlineImagePicker
        image={beforeImage}
        existingPreviewUrl={isEditMode ? existing?.beforeImageUrl : null}
        cameraRef={beforeCameraRef}
        galleryRef={beforeGalleryRef}
        onCameraChange={onBeforeCameraChange}
        onGalleryChange={onBeforeGalleryChange}
      />

      {/* Metadata fields */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">
            Before Weight (kg) <span className="text-red-500">*</span>
          </label>
          <input
            type="text" inputMode="decimal" pattern="[0-9]*" min="1" max="500" step="0.1" placeholder="e.g. 85.0"
            value={form.beforeWeightKg}
            onChange={(e) => setField('beforeWeightKg', e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">
            Goal <span className="text-red-500">*</span>
          </label>
          <select
            value={form.goalType}
            onChange={(e) => setField('goalType', e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-white"
          >
            <option value="loss">⬇️ Weight Loss</option>
            <option value="gain">⬆️ Weight Gain</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">
            Duration <span className="text-red-500">*</span>
          </label>
          <input
            type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="off"
            placeholder="e.g. 3" maxLength={4}
            value={form.durationValue}
            onChange={(e) => setField('durationValue', sanitizeDurationDigits(e.target.value))}
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">
            Unit <span className="text-red-500">*</span>
          </label>
          <select
            value={form.durationUnit}
            onChange={(e) => setField('durationUnit', e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-white"
          >
            <option value="days">Days</option>
            <option value="months">Months</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="flex gap-3">
        {isEditMode && onCancel && (
          <TouchFeedbackButton
            onClick={onCancel} disabled={submitting}
            className="flex-1 py-3 rounded-xl border-2 border-gray-300 text-gray-700 text-sm font-semibold"
          >
            Cancel
          </TouchFeedbackButton>
        )}
        <TouchFeedbackButton
          onClick={onSubmit} disabled={submitting}
          className="flex-1 py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-bold disabled:opacity-60 transition-colors"
        >
          {submitting ? 'Saving…' : isEditMode ? 'Update Before Photo' : 'Save Before Photo'}
        </TouchFeedbackButton>
      </div>
    </div>
  );
}

// ── After photo slot content ──────────────────────────────────────────────────

function AfterPhotoSlotContent({
  form, setField,
  afterImage,
  existingAfterUrl,
  isEditMode,
  afterCameraRef, afterGalleryRef,
  onAfterCameraChange, onAfterGalleryChange,
  submitting, error,
  onSubmit, onCancel,
}) {
  const hasPhoto = !!(afterImage || existingAfterUrl);

  return (
    <div className="px-4 pb-5 pt-4 space-y-4">
      <p className="text-xs text-gray-500 leading-relaxed">
        {isEditMode
          ? 'Update your after photo or change your result weight.'
          : 'Upload your transformation result photo. Your sponsor will receive a verification email with an OTP.'}
      </p>

      <InlineImagePicker
        image={afterImage}
        existingPreviewUrl={isEditMode ? existingAfterUrl : null}
        cameraRef={afterCameraRef}
        galleryRef={afterGalleryRef}
        onCameraChange={onAfterCameraChange}
        onGalleryChange={onAfterGalleryChange}
      />

      {hasPhoto && (
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">
            After Weight (kg) <span className="text-red-500">*</span>
          </label>
          <input
            type="text" inputMode="decimal" pattern="[0-9]*" min="1" max="500" step="0.1" placeholder="e.g. 72.5"
            value={form.afterWeightKg}
            onChange={(e) => setField('afterWeightKg', e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
          />
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="flex gap-3">
        {onCancel && (
          <TouchFeedbackButton
            onClick={onCancel} disabled={submitting}
            className="flex-1 py-3 rounded-xl border-2 border-gray-300 text-gray-700 text-sm font-semibold"
          >
            Cancel
          </TouchFeedbackButton>
        )}
        <TouchFeedbackButton
          onClick={onSubmit} disabled={submitting || !hasPhoto}
          className="flex-1 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold disabled:opacity-60 transition-colors"
        >
          {submitting
            ? 'Saving…'
            : isEditMode
              ? 'Update After Photo'
              : 'Complete Testimonial'}
        </TouchFeedbackButton>
      </div>
    </div>
  );
}

// ── Video slot content ────────────────────────────────────────────────────────

function VideoSlotContent({
  slot, video, onChange, onRemove,
  submitting, error, warning,
  onSubmit, onCancel, isEditMode, existingHasVideo,
}) {
  const inputRef = useRef(null);
  const isHealth = slot === 'health';
  const accentBtn = isHealth ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700';
  const accentBorder = isHealth ? 'border-green-200 text-green-700' : 'border-blue-200 text-blue-700';
  const maxLabel = isHealth ? '1 min' : '2 min';
  const maxMb = isHealth ? MAX_HEALTH_VIDEO_MB : MAX_BUSINESS_VIDEO_MB;

  return (
    <div className="px-4 pb-5 pt-4 space-y-4">
      {isEditMode && existingHasVideo && !video ? (
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5">
          <CheckCircle className="h-4 w-4 text-gray-400 shrink-0" />
          <p className="text-xs text-gray-500 font-medium">Current video will be kept. Select a file only to replace it.</p>
        </div>
      ) : (
        <p className="text-xs text-gray-500 leading-relaxed">
          {isEditMode
            ? `Replace your ${isHealth ? 'health' : 'business'} results video. Your sponsor will receive a new OTP.`
            : `Upload a short ${isHealth ? 'health' : 'business'} results video (max ${maxLabel}, ${maxMb} MB). Your sponsor verifies it.`}
        </p>
      )}

      {video ? (
        <div className={`flex items-center justify-between bg-green-50 border border-green-300 rounded-xl px-3 py-2.5`}>
          <div className="flex items-center gap-2 min-w-0">
            <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-green-800 truncate">{video.name}</p>
              <p className="text-[11px] text-green-600">
                {video.sizeLabel}
                {video.durationUnverified ? ' · length unverified on this device' : ''}
              </p>
            </div>
          </div>
          <div className="flex gap-1 shrink-0 ml-2">
            <TouchFeedbackButton
              onClick={() => inputRef.current?.click()}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg bg-white border ${accentBorder} text-xs font-medium`}
            >
              <Upload className="h-3 w-3" /> Replace
            </TouchFeedbackButton>
            <TouchFeedbackButton
              onClick={onRemove}
              className="p-1 rounded-lg bg-white border border-red-200 text-red-500"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </TouchFeedbackButton>
          </div>
        </div>
      ) : (
        <TouchFeedbackButton
          onClick={() => inputRef.current?.click()}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl border-2 border-dashed border-gray-300 text-gray-500 text-sm font-medium hover:border-green-400 hover:text-green-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          {isHealth ? 'Upload Health Video' : 'Upload Business Video'}
        </TouchFeedbackButton>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/3gpp,.mp4,.mov,.qt,.3gp"
        className="hidden"
        onChange={onChange}
      />

      {warning && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-xs text-amber-700 leading-relaxed">
          {warning}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 text-sm text-red-700">{error}</div>
      )}

      {(video || (isEditMode && existingHasVideo)) && (
        <div className="flex gap-3">
          {onCancel && (
            <TouchFeedbackButton
              onClick={onCancel} disabled={submitting}
              className="flex-1 py-3 rounded-xl border-2 border-gray-300 text-gray-700 text-sm font-semibold"
            >
              Cancel
            </TouchFeedbackButton>
          )}
          {video && (
            <TouchFeedbackButton
              onClick={onSubmit} disabled={submitting}
              className={`flex-1 py-3 rounded-xl ${accentBtn} text-white text-sm font-bold disabled:opacity-60 transition-colors`}
            >
              {submitting ? 'Uploading…' : `Upload ${isHealth ? 'Health' : 'Business'} Video`}
            </TouchFeedbackButton>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main hub ──────────────────────────────────────────────────────────────────

/**
 * @param {{
 *   userId: number,
 *   focusOnly?: 'before'|'after'|'health'|'business'|'issues'|null,
 *   onFocusClose?: () => void,
 * }} props
 */
export default function TestimonialsHub({ userId, focusOnly = null, onFocusClose }) {
  // ── Health issues slot state (declared before hooks so submit payloads can include them) ──
  const [healthIssues,         setHealthIssues]         = useState([]);
  const [healthIssuesExpanded, setHealthIssuesExpanded] = useState(false);
  const [healthIssuesSaving,   setHealthIssuesSaving]   = useState(false);
  const [healthIssuesError,    setHealthIssuesError]    = useState(null);
  const [healthIssuesSuccess,  setHealthIssuesSuccess]  = useState(null);

  // ── Photo hook ──────────────────────────────────────────────────────────────
  const {
    form, setField,
    beforeImage, afterImage,
    handleBeforeImageChange, handleAfterImageChange,
    existing, reload,
    isEditMode, isCompletingMode,
    submitting, error, success,
    handleSubmit, startEdit, startCompleting, cancelEdit,
  } = useTestimonial({ userId, healthIssues });

  // ── Video hook ──────────────────────────────────────────────────────────────
  const {
    existing: existingVideo,
    reload: reloadVideo,
    healthVideo, businessVideo,
    handleHealthVideoChange, handleBusinessVideoChange,
    removeHealthVideo, removeBusinessVideo,
    submitting: videoSubmitting,
    error: videoError,
    warning: videoWarning,
    success: videoSuccess,
    showOtpModal, setShowOtpModal,
    pendingTestimonialId,
    handleSubmit: handleVideoSubmit,
    handleVideoVerified,
    isEditMode: isVideoEditMode,
    startEdit: startVideoEdit, cancelEdit: cancelVideoEdit,
  } = useTestimonialVideo({ userId, healthIssues });

  // Sync shared health issues from photo or video testimonial row
  useEffect(() => {
    if (existing && Array.isArray(existing.recoveredHealthIssues)) {
      setHealthIssues(existing.recoveredHealthIssues);
      return;
    }
    if (existingVideo && Array.isArray(existingVideo.recoveredHealthIssues)) {
      setHealthIssues(existingVideo.recoveredHealthIssues);
    }
  }, [existing, existingVideo]);

  // ── Which slot is expanded ──────────────────────────────────────────────────
  const [expandedSlot, setExpandedSlot] = useState(null);

  // Stable camera/gallery refs for all photo slots
  const beforeCameraRef  = useRef(null);
  const beforeGalleryRef = useRef(null);
  const afterCameraRef   = useRef(null);
  const afterGalleryRef  = useRef(null);

  // ── ALL useCallback hooks declared unconditionally (before any early return) ─

  const toggleSlot = useCallback((slot) => {
    // cancelEdit / cancelVideoEdit are safe to call even when not in edit mode
    cancelEdit();
    cancelVideoEdit();
    setExpandedSlot((prev) => (prev === slot ? null : slot));
  }, [cancelEdit, cancelVideoEdit]);

  const handleEditBefore = useCallback(() => {
    startEdit();
    setExpandedSlot('before');
  }, [startEdit]);

  const handleAddAfter = useCallback(() => {
    startCompleting();
    setExpandedSlot('after');
  }, [startCompleting]);

  const handleEditAfter = useCallback(() => {
    startCompleting();
    setExpandedSlot('after');
  }, [startCompleting]);

  const handleEditVideo = useCallback((slot) => {
    startVideoEdit();
    setExpandedSlot(slot);
  }, [startVideoEdit]);

  const handleEditIssues = useCallback(() => {
    cancelEdit();
    cancelVideoEdit();
    setExpandedSlot(null);
    setHealthIssuesExpanded(true);
    setHealthIssuesError(null);
    setHealthIssuesSuccess(null);
  }, [cancelEdit, cancelVideoEdit]);

  // Open the requested slot when mounted in focused (modal) mode
  useEffect(() => {
    if (!focusOnly) return;
    if (focusOnly === 'before') handleEditBefore();
    else if (focusOnly === 'after') handleEditAfter();
    else if (focusOnly === 'health') handleEditVideo('health');
    else if (focusOnly === 'business') handleEditVideo('business');
    else if (focusOnly === 'issues') handleEditIssues();
    // intentionally only when focusOnly is set / changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusOnly]);

  const finishFocus = useCallback(() => {
    cancelEdit();
    cancelVideoEdit();
    setExpandedSlot(null);
    setHealthIssuesExpanded(false);
    onFocusClose?.();
  }, [cancelEdit, cancelVideoEdit, onFocusClose]);

  const handleCancelPhotoEdit = useCallback(() => {
    if (focusOnly) {
      finishFocus();
      return;
    }
    cancelEdit();
    setExpandedSlot(null);
  }, [focusOnly, finishFocus, cancelEdit]);

  const handleCancelVideoEdit = useCallback(() => {
    if (focusOnly) {
      finishFocus();
      return;
    }
    cancelVideoEdit();
    setExpandedSlot(null);
  }, [focusOnly, finishFocus, cancelVideoEdit]);

  const handlePhotoSubmit = useCallback(async () => {
    const ok = await handleSubmit();
    if (ok) {
      setExpandedSlot(null);
      if (focusOnly) onFocusClose?.();
    }
  }, [handleSubmit, focusOnly, onFocusClose]);

  const handleVideoSlotSubmit = useCallback(async () => {
    const ok = await handleVideoSubmit();
    if (ok) {
      setExpandedSlot(null);
      if (focusOnly) onFocusClose?.();
    }
  }, [handleVideoSubmit, focusOnly, onFocusClose]);

  const handleVideoOtpVerified = useCallback(() => {
    handleVideoVerified();
    reload();
  }, [handleVideoVerified, reload]);

  const handlePhotoOtpVerified = useCallback(() => {
    reload();
  }, [reload]);

  const handleHealthIssuesSave = useCallback(async () => {
    if (!userId || (!existing && !existingVideo)) return;
    if (!Array.isArray(healthIssues) || healthIssues.length === 0) {
      setHealthIssuesError('Please add at least one recovered health issue.');
      setHealthIssuesSuccess(null);
      return;
    }
    setHealthIssuesError(null);
    setHealthIssuesSuccess(null);
    setHealthIssuesSaving(true);
    try {
      const result = await editTestimonial({ userId, recoveredHealthIssues: healthIssues });
      setHealthIssuesSuccess(result?.message || 'Health issues saved successfully.');
      setHealthIssuesExpanded(false);
      reload();
      reloadVideo();
      if (focusOnly) onFocusClose?.();
    } catch (err) {
      setHealthIssuesError(err.message || 'Failed to save health issues.');
    } finally {
      setHealthIssuesSaving(false);
    }
  }, [userId, existing, existingVideo, healthIssues, reload, reloadVideo, focusOnly, onFocusClose]);

  // ── Loading guard (after all hooks) ────────────────────────────────────────
  if (existing === undefined || existingVideo === undefined) {
    return <LoadingSpinner message="Loading your testimonial…" />;
  }

  // ── Slot statuses (plain JS — not hooks, safe after guard) ─────────────────
  const slots = computeSlotStatuses(existing, existingVideo);
  const hasTestimonialRow = !!(existing || existingVideo);
  const isFocused = !!focusOnly;
  const showBefore   = !isFocused || focusOnly === 'before';
  const showAfter    = !isFocused || focusOnly === 'after';
  const showIssues   = !isFocused || focusOnly === 'issues';
  const showHealth   = !isFocused || focusOnly === 'health';
  const showBusiness = !isFocused || focusOnly === 'business';
  const showVideosSection = showHealth || showBusiness;

  // ── Before photo slot state ─────────────────────────────────────────────────
  const beforeSlotExpanded = expandedSlot === 'before';
  const beforeSlotSubtitle =
    existing
      ? `${existing.beforeWeightKg} kg · ${existing.goalType === 'loss' ? 'Weight Loss' : 'Weight Gain'} · ${existing.durationText}`
      : 'Upload your starting photo';

  // ── After photo slot state ──────────────────────────────────────────────────
  const afterSlotLocked   = !existing;
  const afterSlotExpanded = expandedSlot === 'after';
  const afterSlotSubtitle =
    afterSlotLocked                    ? 'Upload before photo first'
    : slots.afterPhoto === 'none'      ? 'Complete your transformation story'
    : slots.afterPhoto === 'pending'   ? 'Awaiting sponsor verification — enter OTP when ready'
    : slots.afterPhoto === 'verified'  ? `After: ${existing?.afterWeightKg} kg — Δ ${Math.abs((existing?.afterWeightKg ?? 0) - (existing?.beforeWeightKg ?? 0)).toFixed(1)} kg`
    : '';

  // ── Video slot status ───────────────────────────────────────────────────────
  const videoOtpPending   = existingVideo && existingVideo.videoStatus === 'pending';
  const videoOtpJustDone  = showOtpModal;
  const videoTestimonialId = pendingTestimonialId ?? existingVideo?.testimonialId ?? null;

  const healthSlotExpanded   = expandedSlot === 'health';
  const businessSlotExpanded = expandedSlot === 'business';

  return (
    <div className={`max-w-lg mx-auto px-4 pt-4 space-y-3 ${isFocused ? 'pb-6' : 'pb-24'}`}>

      {/* ── Overall status bar (hidden in focused edit modal) ─────────────── */}
      {!isFocused && (
        <OverallStatusBar
          slots={slots}
          photoSuccess={success}
          videoSuccess={videoSuccess && !showOtpModal ? videoSuccess : null}
        />
      )}

      {/* ══════════════════ PHOTOS SECTION ════════════════════════════════════ */}
      {(showBefore || showAfter || showIssues) && (
      <div className="space-y-2">
        {/* Section label */}
        {!isFocused && (
          <div className="flex items-center gap-2 px-1 pt-2">
            <Camera className="h-4 w-4 text-gray-400" />
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Photos</p>
          </div>
        )}

        {/* ── Before Photo slot ──────────────────────────────────────────────── */}
        {showBefore && (
        <>
        <SlotCard
          icon={Camera}
          iconBg="bg-green-50"
          iconColor="text-green-600"
          title="Before Photo"
          subtitle={beforeSlotExpanded ? null : beforeSlotSubtitle}
          status={slots.beforePhoto}
          isExpanded={beforeSlotExpanded || isFocused}
          onToggle={() => {
            if (isFocused) return;
            if (slots.beforePhoto !== 'none' && !beforeSlotExpanded) {
              handleEditBefore();
            } else if (beforeSlotExpanded) {
              handleCancelPhotoEdit();
            } else {
              toggleSlot('before');
            }
          }}
        >
          <BeforePhotoSlotContent
            existing={existing}
            isEditMode={isEditMode || isFocused}
            form={form}
            setField={setField}
            beforeImage={beforeImage}
            beforeCameraRef={beforeCameraRef}
            beforeGalleryRef={beforeGalleryRef}
            onBeforeCameraChange={handleBeforeImageChange}
            onBeforeGalleryChange={handleBeforeImageChange}
            submitting={submitting}
            error={error}
            onSubmit={handlePhotoSubmit}
            onCancel={isEditMode || isFocused ? handleCancelPhotoEdit : null}
          />
        </SlotCard>

        {/* Before photo thumbnail when collapsed and uploaded */}
        {!isFocused && !beforeSlotExpanded && existing && existing.beforeImageUrl && (
          <div className="bg-white rounded-2xl border border-gray-100 px-4 py-3 flex items-center gap-3 shadow-sm">
            <img
              src={existing.beforeImageUrl}
              alt="Before"
              className="w-14 h-20 object-contain bg-gray-50 rounded-xl border border-gray-200 shrink-0"
            />
            <div className="flex-1 min-w-0 space-y-0.5">
              <p className="text-xs font-semibold text-gray-700">Before: {existing.beforeWeightKg} kg</p>
              <p className="text-xs text-gray-500">{existing.goalType === 'loss' ? '⬇️ Weight Loss' : '⬆️ Weight Gain'}</p>
              <p className="text-xs text-gray-500">Duration: {existing.durationText}</p>
            </div>
            <TouchFeedbackButton
              onClick={handleEditBefore}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 text-gray-500 text-xs font-semibold hover:border-green-400 hover:text-green-700 transition-colors shrink-0"
            >
              <Pencil className="h-3.5 w-3.5" /> Edit
            </TouchFeedbackButton>
          </div>
        )}
        </>
        )}

        {/* ── Health Issues (after before photo, before after photo) ─────────── */}
        {showIssues && (
        <div className="space-y-2">
          {!isFocused && (
            <div className="flex items-center gap-2 px-1 pt-2">
              <HeartPulse className="h-4 w-4 text-gray-400" />
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Recovered Health Issues</p>
              <span className="text-[10px] text-gray-400 font-normal ml-auto">Shared for photo &amp; video verification</span>
            </div>
          )}

          <SlotCard
            icon={HeartPulse}
            iconBg="bg-rose-50"
            iconColor="text-rose-500"
            title="Health Issues Recovered"
            subtitle={
              healthIssuesExpanded || isFocused
                ? null
                : (healthIssues.length > 0
                    ? healthIssues.slice(0, 3).join(' · ') + (healthIssues.length > 3 ? ` +${healthIssues.length - 3} more` : '')
                    : 'Which health issues did you recover from?')
            }
            status={slots.healthIssues}
            isExpanded={healthIssuesExpanded || (isFocused && focusOnly === 'issues')}
            disabled={!hasTestimonialRow}
            onToggle={() => {
              if (isFocused) return;
              if (!hasTestimonialRow) return;
              setHealthIssuesExpanded((prev) => !prev);
              setHealthIssuesError(null);
              setHealthIssuesSuccess(null);
            }}
          >
            <div className="px-4 pb-5 pt-4 space-y-4">
              {!hasTestimonialRow && (
                <p className="text-xs text-gray-400 italic">Upload a before photo or result video first, then add recovered health issues here.</p>
              )}
              {hasTestimonialRow && (
                <>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Share which health conditions you recovered from. These apply to both photo and video testimonials. If you edit them after submitting, your sponsor gets a new OTP with your latest photos or videos.
                  </p>
                  <DiseaseMultiSelect
                    value={healthIssues}
                    onChange={setHealthIssues}
                    disabled={healthIssuesSaving}
                    required
                  />
                  {healthIssuesError && (
                    <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 text-xs text-red-700">
                      {healthIssuesError}
                    </div>
                  )}
                  {healthIssuesSuccess && (
                    <div className="bg-green-50 border border-green-200 rounded-xl px-3 py-2.5 text-xs text-green-800 font-medium flex items-center gap-1.5">
                      <CheckCircle className="h-3.5 w-3.5" /> {healthIssuesSuccess}
                    </div>
                  )}
                  <div className="flex gap-3">
                    <TouchFeedbackButton
                      onClick={() => {
                        if (focusOnly) {
                          finishFocus();
                          return;
                        }
                        setHealthIssuesExpanded(false);
                        setHealthIssuesError(null);
                        setHealthIssuesSuccess(null);
                      }}
                      disabled={healthIssuesSaving}
                      className="flex-1 py-3 rounded-xl border-2 border-gray-300 text-gray-700 text-sm font-semibold"
                    >
                      Cancel
                    </TouchFeedbackButton>
                    <TouchFeedbackButton
                      onClick={handleHealthIssuesSave}
                      disabled={healthIssuesSaving}
                      className="flex-1 py-3 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-sm font-bold disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
                    >
                      <Save className="h-4 w-4" />
                      {healthIssuesSaving ? 'Saving…' : 'Save Issues'}
                    </TouchFeedbackButton>
                  </div>
                </>
              )}
            </div>
          </SlotCard>

          {/* Verified video badge — under health issues */}
          {!isFocused && existingVideo?.videoStatus === 'verified' && existingVideo.videoVerifiedAt && (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-2xl px-4 py-3">
              <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
              <p className="text-xs text-green-800 font-medium">
                Videos verified on{' '}
                {new Date(existingVideo.videoVerifiedAt).toLocaleDateString('en-IN', {
                  day: 'numeric', month: 'short', year: 'numeric',
                })}
              </p>
            </div>
          )}
        </div>
        )}

        {/* ── After Photo slot ────────────────────────────────────────────────── */}
        {showAfter && (
        <>
        <SlotCard
          icon={Star}
          iconBg={afterSlotLocked ? 'bg-gray-50' : 'bg-purple-50'}
          iconColor={afterSlotLocked ? 'text-gray-300' : 'text-purple-600'}
          title="After Photo"
          subtitle={afterSlotExpanded ? null : afterSlotSubtitle}
          status={afterSlotLocked ? 'locked' : slots.afterPhoto}
          isExpanded={afterSlotExpanded || (isFocused && focusOnly === 'after')}
          disabled={afterSlotLocked}
          onToggle={() => {
            if (isFocused) return;
            if (afterSlotLocked) return;
            if (afterSlotExpanded) {
              handleCancelPhotoEdit();
            } else if (slots.afterPhoto === 'none') {
              handleAddAfter();
            } else {
              handleEditAfter();
            }
          }}
        >
          {/* Upload / edit form */}
          {(isCompletingMode || (isFocused && focusOnly === 'after')) && (
            <AfterPhotoSlotContent
              form={form}
              setField={setField}
              afterImage={afterImage}
              existingAfterUrl={existing?.afterImageUrl}
              isEditMode={slots.afterPhoto !== 'none'}
              afterCameraRef={afterCameraRef}
              afterGalleryRef={afterGalleryRef}
              onAfterCameraChange={handleAfterImageChange}
              onAfterGalleryChange={handleAfterImageChange}
              submitting={submitting}
              error={error}
              onSubmit={handlePhotoSubmit}
              onCancel={handleCancelPhotoEdit}
            />
          )}
        </SlotCard>

        {/* After photo thumbnail when collapsed and uploaded */}
        {!isFocused && !afterSlotLocked && !afterSlotExpanded && slots.afterPhoto !== 'none' && existing?.afterImageUrl && (
          <div className="bg-white rounded-2xl border border-gray-100 px-4 py-3 flex items-center gap-3 shadow-sm">
            <img
              src={existing.afterImageUrl}
              alt="After"
              className="w-14 h-20 object-contain bg-gray-50 rounded-xl border border-gray-200 shrink-0"
            />
            <div className="flex-1 min-w-0 space-y-0.5">
              <p className="text-xs font-semibold text-gray-700">After: {existing?.afterWeightKg} kg</p>
              {existing?.beforeWeightKg && existing?.afterWeightKg && (
                <p className="text-xs text-gray-500">
                  Δ {Math.abs(existing.afterWeightKg - existing.beforeWeightKg).toFixed(1)} kg {existing.goalType === 'loss' ? '⬇️' : '⬆️'}
                </p>
              )}
            </div>
            <TouchFeedbackButton
              onClick={handleEditAfter}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 text-gray-500 text-xs font-semibold hover:border-purple-400 hover:text-purple-700 transition-colors shrink-0"
            >
              <Pencil className="h-3.5 w-3.5" /> Edit
            </TouchFeedbackButton>
          </div>
        )}

        {/* OTP entry for pending photo */}
        {!isFocused && !afterSlotLocked && !afterSlotExpanded && slots.afterPhoto === 'pending' && existing?.id && (
          <div className="bg-white rounded-2xl border border-amber-200 shadow-sm px-4 py-4">
            <OtpInline
              testimonialId={existing.id}
              type="photo"
              onVerified={handlePhotoOtpVerified}
            />
          </div>
        )}
        </>
        )}
      </div>
      )}

      {/* ══════════════════ RESULT VIDEOS SECTION ═════════════════════════════ */}
      {showVideosSection && (
      <div className="space-y-2">
        {/* Section label */}
        {!isFocused && (
          <div className="flex items-center gap-2 px-1 pt-2">
            <Video className="h-4 w-4 text-gray-400" />
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Result Videos</p>
            <span className="text-[10px] text-gray-400 font-normal ml-auto">Optional · both or either</span>
          </div>
        )}

        {/* ── Health Results Video slot ─────────────────────────────────────── */}
        {showHealth && (
        <SlotCard
          icon={Video}
          iconBg="bg-green-50"
          iconColor="text-green-600"
          title="Health Results"
          subtitle={healthSlotExpanded ? null : `Max 1 min · ${MAX_HEALTH_VIDEO_MB} MB`}
          status={slots.healthVideo}
          isExpanded={healthSlotExpanded || (isFocused && focusOnly === 'health')}
          onToggle={() => {
            if (isFocused) return;
            if (healthSlotExpanded) {
              handleCancelVideoEdit();
            } else if (slots.healthVideo !== 'none' && !isVideoEditMode) {
              handleEditVideo('health');
            } else {
              setExpandedSlot('health');
            }
          }}
        >
          <VideoSlotContent
            slot="health"
            video={healthVideo}
            onChange={handleHealthVideoChange}
            onRemove={removeHealthVideo}
            submitting={videoSubmitting}
            error={videoError}
            warning={videoWarning}
            onSubmit={handleVideoSlotSubmit}
            onCancel={handleCancelVideoEdit}
            isEditMode={isVideoEditMode || (isFocused && focusOnly === 'health')}
            existingHasVideo={!!existingVideo?.hasHealthVideo}
          />
        </SlotCard>
        )}

        {/* ── Business Results Video slot ───────────────────────────────────── */}
        {showBusiness && (
        <SlotCard
          icon={Video}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
          title="Business Results"
          subtitle={businessSlotExpanded ? null : `Max 2 min · ${MAX_BUSINESS_VIDEO_MB} MB`}
          status={slots.businessVideo}
          isExpanded={businessSlotExpanded || (isFocused && focusOnly === 'business')}
          onToggle={() => {
            if (isFocused) return;
            if (businessSlotExpanded) {
              handleCancelVideoEdit();
            } else if (slots.businessVideo !== 'none' && !isVideoEditMode) {
              handleEditVideo('business');
            } else {
              setExpandedSlot('business');
            }
          }}
        >
          <VideoSlotContent
            slot="business"
            video={businessVideo}
            onChange={handleBusinessVideoChange}
            onRemove={removeBusinessVideo}
            submitting={videoSubmitting}
            error={videoError}
            warning={videoWarning}
            onSubmit={handleVideoSlotSubmit}
            onCancel={handleCancelVideoEdit}
            isEditMode={isVideoEditMode || (isFocused && focusOnly === 'business')}
            existingHasVideo={!!existingVideo?.hasBusinessVideo}
          />
        </SlotCard>
        )}

        {/* ── Shared video OTP entry ────────────────────────────────────────── */}
        {!isFocused && (videoOtpPending || videoOtpJustDone) && videoTestimonialId && (
          <div className="bg-white rounded-2xl border border-amber-200 shadow-sm px-4 py-4 space-y-1">
            <p className="text-xs font-bold text-amber-700 uppercase tracking-wide flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" /> Verify Your Videos
            </p>
            <p className="text-xs text-gray-500 pb-1">
              One OTP covers both uploaded videos. Ask your sponsor for the code they received by email.
            </p>
            <OtpInline
              testimonialId={videoTestimonialId}
              type="video"
              onVerified={handleVideoOtpVerified}
            />
          </div>
        )}
      </div>
      
      )}

      {/* ── How it works (first-time hint) ─────────────────────────────────── */}
      {!isFocused && !existing && !existingVideo && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl px-4 py-4 space-y-2">
          <p className="text-xs font-bold text-blue-800">How it works</p>
          <ol className="list-decimal list-inside space-y-1 text-xs text-blue-700 leading-5">
            <li>Tap <strong>Before Photo</strong> to upload your starting photo and weight.</li>
            <li>Add any <strong>Health Issues</strong> you recovered from.</li>
            <li>When you have results, tap <strong>After Photo</strong> — your sponsor gets an OTP by email.</li>
            <li>Ask your sponsor for the OTP and enter it here to get officially verified.</li>
            <li>Optionally upload <strong>Health</strong> or <strong>Business</strong> result videos — same OTP flow.</li>
            <li>You can upload any item independently, in any order, at any time.</li>
          </ol>
        </div>
      )}
    </div>
  );
}
