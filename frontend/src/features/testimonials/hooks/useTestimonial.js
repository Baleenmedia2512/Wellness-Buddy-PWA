/**
 * useTestimonial.js â€” State and lifecycle for the member testimonial form.
 * Handles image picking (file input â†’ base64), form state, submit, and edit mode.
 */
import { useState, useCallback, useEffect } from 'react';
import { submitTestimonial, editTestimonial, getMyTestimonial } from '../services/testimonialApi.js';
import {
  formatDurationText,
  parseDurationText,
  validateDurationFields,
  validateWeightKg,
} from '../services/testimonialFormUtils.js';
import { setCaptureFlowBusy } from '../../../shared/services/captureFlowBusy';
import { compressImage } from '../utils/compressTestimonialImage.js';
import { jpegDataUrlToObjectUrl, revokeBlobUrl } from '../utils/testimonialMediaUrl.js';

export { compressImage };

const INITIAL_FORM = {
  beforeWeightKg: '',
  afterWeightKg:  '',
  goalType:       'loss',
  durationUnit:   'months',
  durationValue:  '',
};

/**
 * @param {{ userId: number, healthIssues?: string[] }} opts
 */
export function useTestimonial({ userId, healthIssues = [] }) {
  const [form, setForm]               = useState(INITIAL_FORM);
  const [beforeImage, setBeforeImage] = useState(null); // { base64, preview }
  const [afterImage,  setAfterImage]  = useState(null);
  const [existing,    setExisting]    = useState(undefined); // undefined = loading, null = none
  // isEditMode: true when editing a verified/pending testimonial (full re-edit)
  // isCompletingMode: true when adding after photo to an incomplete testimonial
  const [isEditMode,       setIsEditMode]       = useState(false);
  const [isCompletingMode, setIsCompletingMode] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState(null);
  const [success,    setSuccess]    = useState(null);

  // â”€â”€ Load / reload existing testimonial â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const reload = useCallback(() => {
    if (!userId) return;
    getMyTestimonial(userId)
      .then((data) => setExisting(data))
      .catch(() => setExisting(null));
  }, [userId]);

  useEffect(() => { reload(); }, [reload]);

  // Populate form when entering edit / complete-after mode (keep existing photos until replaced)
  useEffect(() => {
    if ((isEditMode || isCompletingMode) && existing) {
      const duration = parseDurationText(existing.durationText);
      const hasExistingAfter =
        existing.status !== 'incomplete' && !!existing.afterWeightKg;
      setForm({
        beforeWeightKg: String(existing.beforeWeightKg ?? ''),
        afterWeightKg:  hasExistingAfter ? String(existing.afterWeightKg ?? '') : '',
        goalType:       existing.goalType ?? 'loss',
        durationUnit:   duration.durationUnit,
        durationValue:  duration.durationValue,
      });
      setBeforeImage(null);
      setAfterImage(null);
    }
  }, [isEditMode, isCompletingMode, existing]);

  // â”€â”€ Field handlers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const setField = useCallback((field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
    setError(null);
  }, []);

  /** Instant preview, then compress in background (same feel as Manual Log / Mine card). */
  const makeImageHandler = useCallback((setter) => (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const objectUrl = URL.createObjectURL(file);
    setter((prev) => {
      revokeBlobUrl(prev?.preview);
      return { base64: null, preview: objectUrl, compressing: true };
    });
    setError(null);
    setCaptureFlowBusy(true);
    void compressImage(file)
      .then((result) => {
        const compressedPreview = jpegDataUrlToObjectUrl(result.preview) || objectUrl;
        setter((prev) => {
          if (!prev) {
            if (compressedPreview !== objectUrl) revokeBlobUrl(compressedPreview);
            return prev;
          }
          if (compressedPreview !== objectUrl) revokeBlobUrl(objectUrl);
          return { ...result, preview: compressedPreview, compressing: false };
        });
      })
      .catch((err) => {
        revokeBlobUrl(objectUrl);
        setter(null);
        setError(err.message);
      })
      .finally(() => {
        setCaptureFlowBusy(false);
      });
  }, []);

  const handleBeforeImageChange = useCallback(makeImageHandler(setBeforeImage), [makeImageHandler]);
  const handleAfterImageChange  = useCallback(makeImageHandler(setAfterImage),  [makeImageHandler]);

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    setError(null);
    setSuccess(null);

    if (beforeImage?.compressing || afterImage?.compressing) {
      setError('Photo is still preparing — try again in a moment.');
      return false;
    }
    if (beforeImage && !beforeImage.base64) {
      setError('Before photo failed to prepare. Please pick it again.');
      return false;
    }
    if (afterImage && !afterImage.base64) {
      setError('After photo failed to prepare. Please pick it again.');
      return false;
    }

    const isCompleting = isCompletingMode;
    const isEditing    = isEditMode;
    const isBeforeOnlySubmit = !isCompleting && !afterImage;
    // Health issues required only when an after photo is being submitted (coach OTP flow).
    const willSendOtp  = isCompleting || !!afterImage;

    if (!isBeforeOnlySubmit && willSendOtp && (!Array.isArray(healthIssues) || healthIssues.length === 0)) {
      setError('Add at least one recovered health issue in the Health Issues section before submitting for verification.');
      return false;
    }

    // After photo slot: new upload or editing an existing after photo
    if (isCompleting) {
      const hasExistingAfter =
        existing?.status !== 'incomplete' && !!existing?.afterImageUrl;
      if (!afterImage && !hasExistingAfter) {
        setError('Please upload your After photo');
        return false;
      }
      const afterWeightErr = validateWeightKg(form.afterWeightKg, 'After weight');
      if (afterWeightErr) {
        setError(afterWeightErr);
        return false;
      }
    } else {
      // Before-only save: photo + weight + goal + duration only (health issues are a separate step).
      if (!beforeImage && !(isEditing && existing?.beforeImageUrl)) {
        setError('Please upload your Before photo');
        return false;
      }
      const beforeWeightErr = validateWeightKg(form.beforeWeightKg, 'Before weight');
      if (beforeWeightErr) {
        setError(beforeWeightErr);
        return false;
      }
      const durationErr = validateDurationFields(form.durationUnit, form.durationValue);
      if (durationErr) {
        setError(durationErr);
        return false;
      }
      // After photo is optional here — backend handles incomplete state
      if (afterImage) {
        const afterWeightErr = validateWeightKg(form.afterWeightKg, 'After weight');
        if (afterWeightErr) {
          setError(afterWeightErr);
          return false;
        }
      }
    }

    setSubmitting(true);
    try {
      const payload = { userId };

      if (Array.isArray(healthIssues) && healthIssues.length > 0 && !isBeforeOnlySubmit) {
        payload.recoveredHealthIssues = healthIssues;
      }

      if (isCompleting) {
        // Add / update after photo + weight; backend upgrades/resets status to pending when image changes
        if (afterImage) payload.afterImageBase64 = afterImage.base64;
        payload.afterWeightKg = parseFloat(form.afterWeightKg);
        await editTestimonial(payload);
      } else {
        // New or full edit
        if (beforeImage) payload.beforeImageBase64 = beforeImage.base64;
        payload.beforeWeightKg = parseFloat(form.beforeWeightKg);
        payload.goalType       = form.goalType;
        payload.durationText   = formatDurationText(form.durationUnit, form.durationValue);
        if (afterImage) {
          payload.afterImageBase64 = afterImage.base64;
          payload.afterWeightKg    = parseFloat(form.afterWeightKg);
        }
        const fn = isEditing ? editTestimonial : submitTestimonial;
        await fn(payload);
      }

      const updated = await getMyTestimonial(userId, { cacheBust: true });
      setExisting(updated);
      setBeforeImage(null);
      setAfterImage(null);
      setIsEditMode(false);
      setIsCompletingMode(false);

      if (updated?.status === 'pending') {
        setSuccess('Testimonial complete! Your sponsor received a verification email with the OTP.');
      } else if (updated?.status === 'incomplete') {
        setSuccess('Before photo saved! Add your after photo when you\'re ready.');
      } else {
        setSuccess('Testimonial updated.');
      }
      return true;
    } catch (err) {
      const raw = err?.message || '';
      console.error('[useTestimonial] submit failed:', raw);
      setError(raw || 'Submission failed. Please try again.');
      return false;
    } finally {
      setSubmitting(false);
    }
  }, [userId, form, beforeImage, afterImage, isEditMode, isCompletingMode, existing, healthIssues]);

  const startEdit = useCallback(() => {
    setSuccess(null);
    setError(null);
    setIsEditMode(true);
    setIsCompletingMode(false);
  }, []);

  const startCompleting = useCallback(() => {
    setSuccess(null);
    setError(null);
    setIsCompletingMode(true);
    setIsEditMode(false);
  }, []);

  const cancelEdit = useCallback(() => {
    setIsEditMode(false);
    setIsCompletingMode(false);
    setError(null);
  }, []);

  return {
    form,
    setField,
    beforeImage,
    afterImage,
    handleBeforeImageChange,
    handleAfterImageChange,
    existing,
    reload,
    isEditMode,
    isCompletingMode,
    submitting,
    error,
    success,
    handleSubmit,
    startEdit,
    startCompleting,
    cancelEdit,
  };
}
