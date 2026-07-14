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

const INITIAL_FORM = {
  beforeWeightKg: '',
  afterWeightKg:  '',
  goalType:       'loss',
  durationUnit:   'months',
  durationValue:  '',
};

// Target binary size after compression: 900 KB (leaves headroom for base64 overhead)
const TARGET_BYTES = 900 * 1024;
// Max canvas dimension â€” keeps resolution reasonable while shrinking file size
const MAX_DIM = 1200;

/**
 * Compress a File using HTML5 Canvas.
 * Scales the image down if wider/taller than MAX_DIM, then encodes as JPEG
 * at progressively lower quality until the result fits within TARGET_BYTES.
 * @param {File} file
 * @returns {Promise<{ base64: string, preview: string }>}
 */
function compressImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;
      if (height <= width) {
        reject(new Error('Please upload a portrait photo (vertical orientation). Landscape photos are not allowed.'));
        return;
      }
      // Scale down large images proportionally
      if (width > MAX_DIM || height > MAX_DIM) {
        const ratio = Math.min(MAX_DIM / width, MAX_DIM / height);
        width  = Math.round(width  * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width  = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);

      // base64 string length Ã— 0.75 â‰ˆ binary bytes (base64 overhead is ~33%)
      const maxBase64Len = Math.ceil(TARGET_BYTES / 0.75);
      let quality = 0.85;
      let dataUrl;

      do {
        dataUrl = canvas.toDataURL('image/jpeg', quality);
        quality -= 0.1;
      } while (dataUrl.length > maxBase64Len && quality > 0.15);

      const base64 = dataUrl.split(',')[1];
      resolve({ base64, preview: dataUrl });
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to read image. Please try a different photo.'));
    };

    img.src = objectUrl;
  });
}

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

  // Populate form when entering edit mode
  useEffect(() => {
    if ((isEditMode || isCompletingMode) && existing) {
      const duration = parseDurationText(existing.durationText);
      setForm({
        beforeWeightKg: String(existing.beforeWeightKg ?? ''),
        afterWeightKg:  '',
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

  /** Shared handler for any image input change event */
  const makeImageHandler = useCallback((setter) => async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so the same file can be re-selected after retake
    e.target.value = '';
    try {
      const result = await compressImage(file);
      setter(result);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  const handleBeforeImageChange = useCallback(makeImageHandler(setBeforeImage), [makeImageHandler]);
  const handleAfterImageChange  = useCallback(makeImageHandler(setAfterImage),  [makeImageHandler]);

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    setError(null);
    setSuccess(null);

    const isCompleting = isCompletingMode;
    const isEditing    = isEditMode;
    const isBeforeOnlySubmit = !isCompleting && !afterImage;
    // Health issues required only when an after photo is being submitted (coach OTP flow).
    const willSendOtp  = isCompleting || !!afterImage;

    if (!isBeforeOnlySubmit && willSendOtp && (!Array.isArray(healthIssues) || healthIssues.length === 0)) {
      setError('Add at least one recovered health issue in the Health Issues section before submitting for verification.');
      return false;
    }

    // When completing an incomplete testimonial, only after fields are required
    if (isCompleting) {
      if (!afterImage) {
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
        // Completing: send after image + weight; backend upgrades status to pending
        payload.afterImageBase64 = afterImage.base64;
        payload.afterWeightKg    = parseFloat(form.afterWeightKg);
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

      const updated = await getMyTestimonial(userId);
      setExisting(updated);
      setIsEditMode(false);
      setIsCompletingMode(false);

      if (updated?.status === 'pending') {
        setSuccess('Testimonial complete! Your coach received a verification email with the OTP.');
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
