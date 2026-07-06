/**
 * useTestimonial.js — State and lifecycle for the member testimonial form.
 * Handles image picking (file input → base64), form state, submit, and edit mode.
 */
import { useState, useCallback, useEffect } from 'react';
import { submitTestimonial, editTestimonial, getMyTestimonial } from '../services/testimonialApi.js';

const INITIAL_FORM = {
  beforeWeightKg: '',
  afterWeightKg:  '',
  goalType:       'loss',
  durationText:   '',
};

const MAX_IMAGE_BYTES = 1 * 1024 * 1024; // 1 MB

/**
 * @param {{ userId: number }} opts
 */
export function useTestimonial({ userId }) {
  const [form, setForm]             = useState(INITIAL_FORM);
  const [beforeImage, setBeforeImage] = useState(null); // { base64: string, preview: string }
  const [afterImage,  setAfterImage]  = useState(null);
  const [existing,   setExisting]   = useState(undefined); // undefined = loading, null = none
  const [isEditMode, setIsEditMode] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState(null);
  const [success,    setSuccess]    = useState(null);

  // ── Load existing testimonial on mount ──────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    getMyTestimonial(userId)
      .then((data) => { if (!cancelled) setExisting(data); })
      .catch(() => { if (!cancelled) setExisting(null); });
    return () => { cancelled = true; };
  }, [userId]);

  // Populate form when entering edit mode
  useEffect(() => {
    if (isEditMode && existing) {
      setForm({
        beforeWeightKg: String(existing.beforeWeightKg ?? ''),
        afterWeightKg:  String(existing.afterWeightKg  ?? ''),
        goalType:       existing.goalType  ?? 'loss',
        durationText:   existing.durationText ?? '',
      });
      // Clear image previews so user can re-upload if they want
      setBeforeImage(null);
      setAfterImage(null);
    }
  }, [isEditMode, existing]);

  // ── Field handlers ───────────────────────────────────────────────────────────
  const setField = useCallback((field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
    setError(null);
  }, []);

  /**
   * Read a File from an <input type="file"> change event into base64.
   * @param {File} file
   * @returns {Promise<{ base64: string, preview: string }>}
   */
  const fileToBase64 = (file) =>
    new Promise((resolve, reject) => {
      if (file.size > MAX_IMAGE_BYTES) {
        reject(new Error('Image must be 1 MB or less'));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result; // data:image/jpeg;base64,...
        const base64  = dataUrl.split(',')[1];
        resolve({ base64, preview: dataUrl });
      };
      reader.onerror = () => reject(new Error('Failed to read image file'));
      reader.readAsDataURL(file);
    });

  const handleBeforeImageChange = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await fileToBase64(file);
      setBeforeImage(result);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  const handleAfterImageChange = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await fileToBase64(file);
      setAfterImage(result);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  // ── Submit ───────────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    setError(null);
    setSuccess(null);

    if (!beforeImage) { setError('Please upload your Before photo'); return; }
    if (!afterImage)  { setError('Please upload your After photo');  return; }
    if (!form.beforeWeightKg || isNaN(parseFloat(form.beforeWeightKg))) {
      setError('Enter a valid before weight'); return;
    }
    if (!form.afterWeightKg || isNaN(parseFloat(form.afterWeightKg))) {
      setError('Enter a valid after weight'); return;
    }
    if (!form.durationText.trim()) { setError('Enter the duration'); return; }

    setSubmitting(true);
    try {
      const fn = isEditMode ? editTestimonial : submitTestimonial;
      await fn({
        userId:              userId,
        beforeImageBase64:   beforeImage.base64,
        afterImageBase64:    afterImage.base64,
        beforeWeightKg:      parseFloat(form.beforeWeightKg),
        afterWeightKg:       parseFloat(form.afterWeightKg),
        goalType:            form.goalType,
        durationText:        form.durationText.trim(),
      });
      setSuccess(isEditMode
        ? 'Testimonial updated! A new verification email has been sent to your coach.'
        : 'Testimonial submitted! Your coach will receive a verification email.'
      );
      setIsEditMode(false);
      // Reload the testimonial so status card reflects changes
      const updated = await getMyTestimonial(userId);
      setExisting(updated);
    } catch (err) {
      setError(err.message || 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [userId, form, beforeImage, afterImage, isEditMode]);

  const startEdit = useCallback(() => {
    setSuccess(null);
    setError(null);
    setIsEditMode(true);
  }, []);

  const cancelEdit = useCallback(() => {
    setIsEditMode(false);
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
    isEditMode,
    submitting,
    error,
    success,
    handleSubmit,
    startEdit,
    cancelEdit,
  };
}
