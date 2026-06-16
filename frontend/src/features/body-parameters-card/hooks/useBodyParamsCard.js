/**
 * useBodyParamsCard.js
 * Owns state + validation + submit lifecycle for the body-parameters card form.
 * Includes three auto-calculations:
 *   1. Height → ideal weight  (BMI 23 × heightM²)
 *   2. Height + Weight → BMI  (weight ÷ heightM²)
 *   3. Gender → fat% hint label
 * Also owns phone-prefix autocomplete state + member pre-fill logic.
 * Components only render — no fetch logic here.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CapacitorHttp } from '@capacitor/core';
import { createBodyParamsCard, updateBodyParamsCard } from '../services/bodyParamsCardApi.js';
import { teamHierarchyService } from '../../../shared/services/teamHierarchyService.js';
import { getApiBaseUrl } from '../../../config/api.config.js';
import { debugLog } from '../../../shared/utils/logger.js';

const EMPTY_FORM = {
  name:         '',
  phoneNumber:  '',
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
        phoneNumber:  '',
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
  const [coachUserId, setCoachUserId] = useState(() => user?.id || null);

  // ── Phone autocomplete state ──────────────────────────────────────────────
  const [phoneSuggestions, setPhoneSuggestions] = useState([]);
  // Filtering is now synchronous (client-side); always false. Kept for API compatibility.
  const phoneSearchLoading = false;
  const phoneDebounceRef    = useRef(null);
  // Stores the last prefix typed while coachUserId was still null, so we can
  // fire the search as soon as the coach ID resolves.
  const pendingPhonePrefixRef = useRef(null);

  // Flat list of all team members — loaded once when coachUserId is available.
  // Used for client-side phone prefix filtering (no backend round-trip needed).
  const [allTeamMembers, setAllTeamMembers] = useState([]);

  const targetUserId = selectedMember?.userId || selectedMember?.id || null;

  // Resolve coach database UserId (team_table.UserId) — required for createdBy + CoachId.
  useEffect(() => {
    if (coachUserId || !user?.email) return undefined;

    let cancelled = false;
    CapacitorHttp.get({
      url: `${getApiBaseUrl()}/api/user/lookup?email=${encodeURIComponent(user.email)}`,
      headers: { 'Cache-Control': 'no-cache' },
    })
      .then((response) => {
        const data = response.data;
        if (!cancelled && data?.success && data.userId) {
          setCoachUserId(data.userId);
        }
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [user?.email, coachUserId]);

  // ── Load team members once coachUserId resolves, then fire any pending search ──
  useEffect(() => {
    if (!coachUserId) return;
    let cancelled = false;
    teamHierarchyService.getFlatTeamList(coachUserId)
      .then((members) => {
        if (cancelled) return;
        setAllTeamMembers(members);
        // Fire pending search now that we have both coachUserId and members.
        const prefix = pendingPhonePrefixRef.current;
        if (!prefix) return;
        pendingPhonePrefixRef.current = null;
        const digits = prefix.replace(/\D/g, '');
        if (digits.length < 2) return;
        const results = members
          .filter((m) => {
            if (!m.phoneNumber) return false;
            return String(m.phoneNumber).replace(/\D/g, '').startsWith(digits);
          })
          .slice(0, 10)
          .map((m) => ({
            userId:      m.userId,
            userName:    m.userName,
            phoneNumber: m.phoneNumber,
            heightCm:    m.heightCm != null ? m.heightCm : null,
            bmr:         m.bmr      != null ? m.bmr      : null,
          }));
        setPhoneSuggestions(results);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [coachUserId]);

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

  /**
   * Called when the phone input changes. Updates form + triggers debounced prefix search.
   * Clears suggestions immediately when input is too short.
   */
  const setPhoneField = useCallback((value) => {
    setForm((prev) => ({ ...prev, phoneNumber: value }));

    const digits = value.replace(/\D/g, '');
    if (digits.length < 2) {
      setPhoneSuggestions([]);
      pendingPhonePrefixRef.current = null;
      if (phoneDebounceRef.current) clearTimeout(phoneDebounceRef.current);
      return;
    }

    if (phoneDebounceRef.current) clearTimeout(phoneDebounceRef.current);

    // coachUserId not yet resolved — park the prefix; the resolve useEffect will fire it.
    if (!coachUserId) {
      pendingPhonePrefixRef.current = digits;
      return;
    }

    pendingPhonePrefixRef.current = null;

    // allTeamMembers not yet loaded — park the prefix; load effect will fire it.
    if (allTeamMembers.length === 0) {
      pendingPhonePrefixRef.current = digits;
      return;
    }

    // Client-side filtering — instant, no network round-trip.
    phoneDebounceRef.current = setTimeout(() => {
      const results = allTeamMembers
        .filter((m) => {
          if (!m.phoneNumber) return false;
          return String(m.phoneNumber).replace(/\D/g, '').startsWith(digits);
        })
        .slice(0, 10)
        .map((m) => ({
          userId:      m.userId,
          userName:    m.userName,
          phoneNumber: m.phoneNumber,
          heightCm:    m.heightCm != null ? m.heightCm : null,
          bmr:         m.bmr      != null ? m.bmr      : null,
        }));
      setPhoneSuggestions(results);
    }, 150);
  }, [coachUserId, allTeamMembers]);

  /**
   * Called when the user selects a suggestion from the phone autocomplete.
   * Pre-fills Name, Height, BMR from the member's stored profile.
   * BMI auto-fill is NOT reset here — height will trigger it naturally.
   */
  const fillFromMember = useCallback((member) => {
    setForm((prev) => ({
      ...prev,
      phoneNumber: member.phoneNumber,
      ...(member.userName && String(member.userName).trim() ? { name: String(member.userName).trim() } : {}),
      ...(member.heightCm != null ? { heightCm: String(member.heightCm) } : {}),
      ...(member.bmr != null ? { bmr: String(member.bmr) } : {}),
    }));
    setPhoneSuggestions([]);
    debugLog('✅ [BodyParamsCard] pre-filled from member', member);
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

  const cleanPhone = (s) => s.trim().replace(/[\s\-()]/g, '');

  const isValid =
    form.name.trim().length > 0 &&
    form.phoneNumber.trim().length > 0 &&
    /^\+?[0-9]{10,15}$/.test(cleanPhone(form.phoneNumber));

  const handleSave = useCallback(async () => {
    if (!form.name.trim()) { setError('Name is required'); return; }
    if (!form.phoneNumber.trim()) { setError('Phone number is required'); return; }
    if (!/^\+?[0-9]{10,15}$/.test(cleanPhone(form.phoneNumber))) {
      setError('Please enter a valid phone number (10–15 digits)'); return;
    }
    if (!coachUserId) {
      setError('Could not resolve your coach account. Please refresh and try again.'); return;
    }
    const ageNum = form.age !== '' && form.age != null ? parseInt(form.age) : null;
    if (ageNum !== null && (isNaN(ageNum) || ageNum < 1 || ageNum > 120)) {
      setError('Age must be between 1 and 120'); return;
    }
    const bodyAgeNum = form.bodyAge !== '' && form.bodyAge != null ? parseInt(form.bodyAge) : null;
    if (bodyAgeNum !== null && (isNaN(bodyAgeNum) || bodyAgeNum < 1 || bodyAgeNum > 120)) {
      setError('Body Age must be between 1 and 120'); return;
    }
    setError('');
    setIsSaving(true);

    // ⚡ Notify parent immediately with form data so it can start
    // pre-rendering + pre-capturing the card image in parallel with the API call.
    if (onSaveStart) {
      onSaveStart({
        name:         form.name.trim(),
        phoneNumber:  form.phoneNumber.trim(),
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
        createdBy:   coachUserId,
        userId:      targetUserId,
        name:        form.name.trim(),
        phoneNumber: cleanPhone(form.phoneNumber),
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

      // Extract previousCard from API response (null for fresh users).
      const { previousCard: prevCard = null, ...cardCore } = card;

      const url = `${getApiBaseUrl()}/share/bpc/${cardCore.publicShareToken}`;

      // Merge API response with full form data so the card preview
      // has all fields (API only returns id/token/name).
      const fullCard = {
        ...cardCore,
        age:          form.age,
        phoneNumber:  form.phoneNumber,
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
      if (onSaveSuccess) onSaveSuccess(fullCard, url, prevCard);
    } catch (err) {
      setError(err.message || 'Failed to save. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [isValid, form, coachUserId, targetUserId, onSaveSuccess, onSaveStart, isEditMode, existingCard, user]);

  return {
    form, setField,
    setPhoneField, fillFromMember,
    phoneSuggestions, phoneSearchLoading,
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
