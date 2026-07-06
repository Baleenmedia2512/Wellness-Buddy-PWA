/**
 * TestimonialForm.jsx
 * Form for a member to upload their before/after photos, enter weights,
 * select goal type (loss/gain), and set the duration.
 * Used for both initial submit and edit mode.
 */
import React, { useRef } from 'react';
import { Camera, Upload, CheckCircle } from 'lucide-react';
import TouchFeedbackButton from '../../../shared/components/TouchFeedbackButton';

function ImagePicker({ label, image, inputRef, onChange, required }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
      <TouchFeedbackButton
        onClick={() => inputRef.current?.click()}
        className={`w-36 h-36 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-colors ${
          image
            ? 'border-green-400 bg-green-50'
            : 'border-gray-300 bg-gray-50 hover:border-green-400 hover:bg-green-50'
        }`}
        ariaLabel={`Upload ${label} photo`}
      >
        {image ? (
          <img
            src={image.preview}
            alt={`${label} preview`}
            className="w-full h-full object-cover rounded-2xl"
          />
        ) : (
          <>
            <Upload className="h-7 w-7 text-gray-400" />
            <span className="text-xs text-gray-400 text-center px-2">
              {required ? 'Tap to upload *' : 'Tap to upload'}
            </span>
          </>
        )}
      </TouchFeedbackButton>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={onChange}
      />
      {image && (
        <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
          <CheckCircle className="h-3.5 w-3.5" /> Uploaded
        </span>
      )}
    </div>
  );
}

export default function TestimonialForm({
  form,
  setField,
  beforeImage,
  afterImage,
  beforeInputRef,
  afterInputRef,
  onBeforeChange,
  onAfterChange,
  onSubmit,
  submitting,
  error,
  isEditMode,
  onCancel,
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-5">
      <div className="flex items-center gap-2">
        <Camera className="h-5 w-5 text-green-600" />
        <h2 className="text-base font-bold text-gray-800">
          {isEditMode ? 'Edit Your Testimonial' : 'Submit Your Transformation'}
        </h2>
      </div>

      {/* Before / After photo pickers */}
      <div className="flex justify-around gap-4">
        <ImagePicker
          label="Before"
          image={beforeImage}
          inputRef={beforeInputRef}
          onChange={onBeforeChange}
          required={!isEditMode}
        />
        <ImagePicker
          label="After"
          image={afterImage}
          inputRef={afterInputRef}
          onChange={onAfterChange}
          required={!isEditMode}
        />
      </div>

      {isEditMode && !beforeImage && !afterImage && (
        <p className="text-xs text-gray-400 text-center -mt-2">
          Leave photos blank to keep existing ones.
        </p>
      )}

      {/* Weight inputs */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">
            Before Weight (kg) <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            min="1"
            max="500"
            step="0.1"
            placeholder="e.g. 85.0"
            value={form.beforeWeightKg}
            onChange={(e) => setField('beforeWeightKg', e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">
            After Weight (kg) <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            min="1"
            max="500"
            step="0.1"
            placeholder="e.g. 72.5"
            value={form.afterWeightKg}
            onChange={(e) => setField('afterWeightKg', e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
          />
        </div>
      </div>

      {/* Goal type radio */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-2">
          Goal Type <span className="text-red-500">*</span>
        </label>
        <div className="flex gap-4">
          {[
            { value: 'loss', label: '⬇️ Weight Loss' },
            { value: 'gain', label: '⬆️ Weight Gain' },
          ].map(({ value, label }) => (
            <label
              key={value}
              className={`flex-1 flex items-center justify-center gap-2 border-2 rounded-xl py-2.5 cursor-pointer text-sm font-medium transition-colors ${
                form.goalType === value
                  ? 'border-green-500 bg-green-50 text-green-800'
                  : 'border-gray-200 text-gray-600 hover:border-green-300'
              }`}
            >
              <input
                type="radio"
                name="goalType"
                value={value}
                checked={form.goalType === value}
                onChange={() => setField('goalType', value)}
                className="sr-only"
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      {/* Duration */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">
          Duration <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          placeholder="e.g. 3 months, 12 weeks"
          maxLength={100}
          value={form.durationText}
          onChange={(e) => setField('durationText', e.target.value)}
          className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        {isEditMode && onCancel && (
          <TouchFeedbackButton
            onClick={onCancel}
            disabled={submitting}
            className="flex-1 py-3 rounded-xl border-2 border-gray-300 text-gray-700 text-sm font-semibold"
          >
            Cancel
          </TouchFeedbackButton>
        )}
        <TouchFeedbackButton
          onClick={onSubmit}
          disabled={submitting}
          className="flex-1 py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-bold transition-colors disabled:opacity-60"
        >
          {submitting
            ? 'Submitting…'
            : isEditMode
              ? 'Update & Re-send to Coach'
              : 'Submit to Coach'}
        </TouchFeedbackButton>
      </div>
    </div>
  );
}
