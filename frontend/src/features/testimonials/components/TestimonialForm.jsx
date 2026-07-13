/**
 * TestimonialForm.jsx
 * Form for uploading before/after transformation photos.
 *
 * Supports partial submission:
 *   - Before photo only → saved as 'incomplete' (come back for after)
 *   - Both photos       → complete, OTP email sent to coach
 *
 * Each image picker offers two options: take a fresh photo OR pick from gallery.
 */
import React from 'react';
import { Camera, Images, CheckCircle, Plus } from 'lucide-react';
import TouchFeedbackButton from '../../../shared/components/TouchFeedbackButton';
import MedicalConditionAutocomplete from './MedicalConditionAutocomplete';
import {
  PORTRAIT_IMAGE_CLASS,
  sanitizeDurationDigits,
} from '../services/testimonialFormUtils.js';

const PORTRAIT_PLACEHOLDER_CLASS =
  'w-full max-w-[180px] mx-auto aspect-[9/16] rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center text-gray-400';

function blockNonNumericKeyDown(e) {
  const allowed = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End'];
  if (allowed.includes(e.key) || e.ctrlKey || e.metaKey) return;
  if (!/^\d$/.test(e.key)) e.preventDefault();
}

function handleDurationPaste(e, setField) {
  e.preventDefault();
  setField('durationValue', sanitizeDurationDigits(e.clipboardData.getData('text')));
}

/**
 * Single image picker with two tap targets: Camera and Gallery.
 */
function ImagePicker({ label, image, cameraRef, galleryRef, onCameraChange, onGalleryChange, required, optional }) {
  return (
    <div className="flex flex-col items-center gap-2 flex-1">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
        {label} {required && <span className="text-red-500">*</span>}
        {optional && <span className="text-gray-400 normal-case font-normal"> (optional)</span>}
      </p>

      {image ? (
        /* Preview with re-shoot / re-pick buttons */
        <div className="w-full space-y-1">
          <img
            src={image.preview}
            alt={`${label} preview`}
            className={`${PORTRAIT_IMAGE_CLASS} max-w-[180px] mx-auto border-green-400`}
          />
          <div className="flex gap-1">
            <TouchFeedbackButton
              onClick={() => cameraRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl bg-gray-100 text-gray-600 text-xs font-medium hover:bg-gray-200 transition-colors"
              ariaLabel={`Retake ${label} photo`}
            >
              <Camera className="h-3.5 w-3.5" /> Retake
            </TouchFeedbackButton>
            <TouchFeedbackButton
              onClick={() => galleryRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl bg-gray-100 text-gray-600 text-xs font-medium hover:bg-gray-200 transition-colors"
              ariaLabel={`Pick ${label} from gallery`}
            >
              <Images className="h-3.5 w-3.5" /> Gallery
            </TouchFeedbackButton>
          </div>
          <div className="flex items-center justify-center gap-1 text-xs text-green-600 font-medium">
            <CheckCircle className="h-3.5 w-3.5" /> Uploaded
          </div>
        </div>
      ) : (
        /* Upload prompt — camera + gallery side by side */
        <div className="w-full space-y-2">
          <div className={PORTRAIT_PLACEHOLDER_CLASS}>
            <Plus className="h-8 w-8 opacity-40" />
          </div>
          <div className="flex gap-2">
            <TouchFeedbackButton
              onClick={() => cameraRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-xs font-bold transition-colors"
              ariaLabel={`Take ${label} photo`}
            >
              <Camera className="h-4 w-4" /> Camera
            </TouchFeedbackButton>
            <TouchFeedbackButton
              onClick={() => galleryRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 border-gray-300 text-gray-600 text-xs font-bold hover:border-green-400 hover:text-green-700 transition-colors"
              ariaLabel={`Pick ${label} from gallery`}
            >
              <Images className="h-4 w-4" /> Gallery
            </TouchFeedbackButton>
          </div>
        </div>
      )}

      {/* Hidden inputs */}
      <input ref={cameraRef}  type="file" accept="image/*" capture="environment" className="hidden" onChange={onCameraChange} />
      <input ref={galleryRef} type="file" accept="image/*"                        className="hidden" onChange={onGalleryChange} />
    </div>
  );
}

export default function TestimonialForm({
  form,
  setField,
  beforeImage,
  afterImage,
  beforeCameraRef,
  beforeGalleryRef,
  afterCameraRef,
  afterGalleryRef,
  onBeforeCameraChange,
  onBeforeGalleryChange,
  onAfterCameraChange,
  onAfterGalleryChange,
  onSubmit,
  submitting,
  error,
  isEditMode,
  onCancel,
  isIncomplete,   // true when editing an existing 'incomplete' record to add after photo
  medicalCondition,
  onMedicalConditionChange,
  onMedicalConditionBlur,
  medicalConditionError,
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-5">
      <div className="flex items-center gap-2">
        <Camera className="h-5 w-5 text-green-600" />
        <h2 className="text-base font-bold text-gray-800">
          {isIncomplete
            ? 'Add Your After Photo'
            : isEditMode
              ? 'Edit Your Testimonial'
              : 'Start Your Transformation'}
        </h2>
      </div>

      {/* ── Before section ─────────────────────────────────────────── */}
      {!isIncomplete && (
        <>
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-3">
              📸 Before Photo <span className="text-red-500">*</span>
            </p>
            <div className="flex gap-3">
              <ImagePicker
                label="Before"
                image={beforeImage}
                cameraRef={beforeCameraRef}
                galleryRef={beforeGalleryRef}
                onCameraChange={onBeforeCameraChange}
                onGalleryChange={onBeforeGalleryChange}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Before Weight (kg) <span className="text-red-500">*</span>
              </label>
              <input
                type="number" min="1" max="500" step="0.1" placeholder="e.g. 85.0"
                value={form.beforeWeightKg}
                onChange={(e) => setField('beforeWeightKg', e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Goal Type <span className="text-red-500">*</span>
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
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                placeholder="e.g. 3"
                maxLength={4}
                value={form.durationValue}
                onChange={(e) => setField('durationValue', sanitizeDurationDigits(e.target.value))}
                onKeyDown={blockNonNumericKeyDown}
                onPaste={(e) => handleDurationPaste(e, setField)}
                onDrop={(e) => {
                  e.preventDefault();
                  setField('durationValue', sanitizeDurationDigits(e.dataTransfer.getData('text')));
                }}
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

          <MedicalConditionAutocomplete
            value={medicalCondition}
            onChange={onMedicalConditionChange}
            onBlur={onMedicalConditionBlur}
            error={medicalConditionError}
          />

          <p className="text-xs text-gray-400">Portrait photos only (vertical). Duration accepts numbers only.</p>
        </>
      )}

      {/* ── After section ──────────────────────────────────────────── */}
      <div className={`rounded-2xl p-4 space-y-3 ${isIncomplete ? '' : 'border border-dashed border-gray-300 bg-gray-50'}`}>
        {!isIncomplete && (
          <p className="text-xs font-semibold text-gray-500 flex items-center gap-1.5">
            <span className="bg-gray-200 text-gray-600 rounded-full px-2 py-0.5">Optional now</span>
            Add after photo when you have your results
          </p>
        )}
        <div className="flex gap-3">
          <ImagePicker
            label="After"
            image={afterImage}
            cameraRef={afterCameraRef}
            galleryRef={afterGalleryRef}
            onCameraChange={onAfterCameraChange}
            onGalleryChange={onAfterGalleryChange}
            optional={!isIncomplete}
            required={isIncomplete}
          />
        </div>
        {afterImage && (
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              After Weight (kg) <span className="text-red-500">*</span>
            </label>
            <input
              type="number" min="1" max="500" step="0.1" placeholder="e.g. 72.5"
              value={form.afterWeightKg}
              onChange={(e) => setField('afterWeightKg', e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        {(isEditMode || isIncomplete) && onCancel && (
          <TouchFeedbackButton
            onClick={onCancel} disabled={submitting}
            className="flex-1 py-3 rounded-xl border-2 border-gray-300 text-gray-700 text-sm font-semibold"
          >
            Cancel
          </TouchFeedbackButton>
        )}
        <TouchFeedbackButton
          onClick={onSubmit} disabled={submitting}
          className="flex-1 py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-bold transition-colors disabled:opacity-60"
        >
          {submitting
            ? 'Saving…'
            : isIncomplete
              ? 'Complete Testimonial'
              : afterImage
                ? 'Submit to Coach'
                : 'Save Before Photo'}
        </TouchFeedbackButton>
      </div>

      {!afterImage && !isIncomplete && (
        <p className="text-xs text-gray-400 text-center">
          You can submit now with just the before photo and add the after photo later.
        </p>
      )}
    </div>
  );
}
