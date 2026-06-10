/**
 * useBodyParamsCard.js
 * Owns state + validation + submit lifecycle for the body-parameters card form.
 * Includes three auto-calculations:
 *   1. Height → ideal weight  (BMI 23 × heightM²)
 *   2. Height + Weight → BMI  (weight ÷ heightM²)
 *   3. Gender → fat% hint label
 * Components only render — no fetch logic here.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createBodyParamsCard, updateBodyParamsCard } from '../services/bodyParamsCardApi.js';
import { getApiBaseUrl } from '../../../config/api.config.js';
import { debugLog } from '../../../shared/utils/logger.js';

const EMPTY_FORM = {
  name:         '',
  age:          '',
  gender:       '',
  heightCm:     '',
  weightKg:     '',
  bmi:          '',
  fatPercent:   '',
  bmr:          '',
  bodyAge:      '',
  recordedDate: new Date().toISOString().substring(0, 10),
  locationName: '',
};

/**
 * @param {{ user: object, selectedMember: object|null, onSaveSuccess: function, existingCard: object|null, onSaveStart: function|null }} opts
 */
export function useBodyParamsCard({ user, selectedMember, onSaveSuccess, existingCard = null, onSaveStart = null } = {}) {
  const isEditMode = Boolean(existingCard?.id);

  const [form, setForm] = useState(() => {
    if (existingCard) {
      return {
        name:         existingCard.name         ?? '',
        age:          existingCard.age          != null ? String(existingCard.age)         : '',
        gender:       existingCard.gender        ?? '',
        heightCm:     existingCard.heightCm     != null ? String(existingCard.heightCm)    : '',
        weightKg:     existingCard.weightKg     != null ? String(existingCard.weightKg)    : '',
        bmi:          existingCard.bmi          != null ? String(existingCard.bmi)         : '',
        fatPercent:   existingCard.fatPercent   != null ? String(existingCard.fatPercent)  : '',
        bmr:          existingCard.bmr          != null ? String(existingCard.bmr)         : '',
        bodyAge:      existingCard.bodyAge      != null ? String(existingCard.bodyAge)     : '',
        recordedDate: existingCard.recordedDate ?? new Date().toISOString().substring(0, 10),
        locationName: existingCard.locationName ?? '',
      };
    }
    return EMPTY_FORM;
  });
  const [isSaving, setIsSaving]           = useState(false);
  const [error, setError]                 = useState('');
  const [savedCard, setSavedCard]         = useState(null);
  const [shareUrl, setShareUrl]           = useState('');

  // Track whether the user manually typed in the BMI field.
  // When true, BMI auto-fill is disabled.
  const [bmiUserEdited, setBmiUserEdited] = useState(false);

  const targetUserId = selectedMember?.userId || selectedMember?.id || null;

  // ── Derived calculations ──────────────────────────────────────────────────

  /** Ideal weight: BMI-23 upper bound from height. null when height invalid. */
  const derivedIdealWeight = useMemo(() => {
    const h = parseFloat(form.heightCm);
    if (!h || h < 50 || h > 250) return null;
    const m = h / 100;
    return Math.round(23 * m * m * 10) / 10;
  }, [form.heightCm]);

  /** BMI computed from current height + weight. null when either invalid. */
  const derivedBmi = useMemo(() => {
    const h = parseFloat(form.heightCm);
    const w = parseFloat(form.weightKg);
    if (!h || h < 50 || !w || w < 20) return null;
    const m = h / 100;
    return Math.round((w / (m * m)) * 10) / 10;
  }, [form.heightCm, form.weightKg]);

  /** Fat% healthy-range hint based on selected gender. */
  const fatHint = useMemo(() => {
    if (form.gender === 'Male')   return '10–20%';
    if (form.gender === 'Female') return '20–30%';
    return 'Male: 10–20 / Female: 20–30';
  }, [form.gender]);

  /** Short range string used as placeholder inside the Fat% input field. */
  const fatPlaceholder = useMemo(() => {
    if (form.gender === 'Male')   return '10–20%';
    if (form.gender === 'Female') return '20–30%';
    return '%';
  }, [form.gender]);

  // ── Auto-fill effects ─────────────────────────────────────────────────────

  // Weight auto-fill intentionally removed — ideal weight is shown as a label hint only.
  // The user must enter their own weight value.

  // Auto-fill BMI whenever height or weight changes — only if user has not manually typed BMI.
  useEffect(() => {
    if (bmiUserEdited || derivedBmi === null) return;
    setForm((prev) => ({ ...prev, bmi: String(derivedBmi) }));
  }, [derivedBmi, bmiUserEdited]);

  // ── Setters ───────────────────────────────────────────────────────────────

  const setField = useCallback((field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  /** Called when user manually types in the Weight field. */
  const setWeightManually = useCallback((value) => {
    setForm((prev) => ({ ...prev, weightKg: value }));
  }, []);

  /** Called when user manually types in the BMI field. Disables auto-fill for BMI. */
  const setBmiManually = useCallback((value) => {
    setBmiUserEdited(true);
    setForm((prev) => ({ ...prev, bmi: value }));
  }, []);

  const resetForm = useCallback(() => {
    setForm(EMPTY_FORM);
    setError('');
    setSavedCard(null);
    setShareUrl('');
    setBmiUserEdited(false);
  }, []);

  const isValid = form.name.trim().length > 0;

  const handleSave = useCallback(async () => {
    if (!isValid) { setError('Name is required'); return; }
    setError('');
    setIsSaving(true);

    // ⚡ Notify parent immediately with form data so it can start
    // pre-rendering + pre-capturing the card image in parallel with the API call.
    if (onSaveStart) {
      onSaveStart({
        name:         form.name.trim(),
        age:          form.age,
        gender:       form.gender,
        heightCm:     form.heightCm,
        weightKg:     form.weightKg,
        bmi:          form.bmi,
        fatPercent:   form.fatPercent,
        bmr:          form.bmr,
        bodyAge:      form.bodyAge,
        recordedDate: form.recordedDate,
        locationName: form.locationName,
      });
    }

    try {
      const payload = {
        createdBy:   user?.id,
        userId:      targetUserId,
        name:        form.name.trim(),
        age:         form.age          || undefined,
        gender:      form.gender       || undefined,
        heightCm:    form.heightCm     || undefined,
        weightKg:    form.weightKg     || undefined,
        bmi:         form.bmi          || undefined,
        fatPercent:  form.fatPercent   || undefined,
        bmr:         form.bmr          || undefined,
        bodyAge:     form.bodyAge      || undefined,
        recordedDate: form.recordedDate || undefined,
        locationName: form.locationName || undefined,
      };

      const card = isEditMode
        ? await updateBodyParamsCard(existingCard.id, payload)
        : await createBodyParamsCard(payload);
      const url = `${getApiBaseUrl()}/share/bpc/${card.publicShareToken}`;

      // Merge API response with full form data so the card preview
      // has all fields (API only returns id/token/name).
      const fullCard = {
        ...card,
        age:          form.age,
        gender:       form.gender,
        heightCm:     form.heightCm,
        weightKg:     form.weightKg,
        bmi:          form.bmi,
        fatPercent:   form.fatPercent,
        bmr:          form.bmr,
        bodyAge:      form.bodyAge,
        recordedDate: form.recordedDate,
        locationName: form.locationName,
      };

      setSavedCard(fullCard);
      setShareUrl(url);
      debugLog('✅ [BodyParamsCard] Created:', fullCard);
      if (onSaveSuccess) onSaveSuccess(fullCard, url);
    } catch (err) {
      setError(err.message || 'Failed to save. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [isValid, form, user, targetUserId, onSaveSuccess]);

  return {
    form, setField,
    setWeightManually, setBmiManually,
    fatHint, fatPlaceholder,
    derivedIdealWeight, derivedBmi,
    bmiUserEdited,
    isSaving, error,
    isValid,
    isEditMode,
    savedCard, shareUrl,
    handleSave, resetForm,
  };
}
