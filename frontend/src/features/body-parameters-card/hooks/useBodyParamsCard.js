/**
 * useBodyParamsCard.js
 * Owns state + validation + submit lifecycle for the body-parameters card form.
 * Includes auto-calculations:
 *   1. Height → ideal weight  (BMI 23 × heightM²)
 *   2. Height + Weight → BMI  (weight ÷ heightM²)
 *   3. Weight + Fat% → BMR   (Katch-McArdle)
 *   4. Gender → fat% hint label
 * Also owns phone-prefix autocomplete state + member pre-fill logic.
 * Components only render — no fetch logic here.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { computeKatchMcArdleBmr } from '../../../shared/utils/bmrCalculations.js';
import { createBodyParamsCard, updateBodyParamsCard, fetchMemberPrefill, fetchPhoneBcmStatus } from '../services/bodyParamsCardApi.js';
import { upsertBcmMemberToDeviceContacts } from '../utils/bcmDeviceContact.js';
import { teamHierarchyService } from '../../../shared/services/teamHierarchyService.js';
import { getApiBaseUrl } from '../../../config/api.config.js';
import { buildOnboardingShareUrl } from '../domain/platform-store.rules.js';
import { debugLog } from '../../../shared/utils/logger.js';
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { getAppVersionHeaders } from '../../../shared/services/apiFetch.js';
import * as PermissionManager from '../../../shared/services/permissionManager.js';

/**
 * Normalise any phone string to a 10-digit Indian national number for prefix
 * matching. Handles: "9876543210", "+919876543210", "919876543210", "09876543210".
 */
function toNationalDigits(phone) {
  const d = String(phone || '').replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) return d.slice(2);
  if (d.length === 11 && d.startsWith('0'))  return d.slice(1);
  return d;
}

function toOptionalNum(val) {
  if (val === '' || val == null) return undefined;
  const n = parseFloat(val);
  return Number.isNaN(n) ? undefined : n;
}

function pickSavedField(apiVal, formVal) {
  return apiVal != null && apiVal !== '' ? apiVal : formVal;
}

function normalizeName(value) {
  return String(value || '').toUpperCase();
}

const BCM_PHONE_EXISTS_MESSAGE = 'User already exists';

function isActivatedPhoneErrorMessage(msg) {
  return /user already exists/i.test(String(msg || ''));
}

/** Map hierarchy / API member row into phone suggestion + prefill payload. */
function toPhoneSuggestion(m) {
  if (!m) return null;
  return {
    userId:      m.userId,
    userName:    m.userName,
    phoneNumber: m.phoneNumber,
    heightCm:    m.heightCm != null ? m.heightCm : null,
    bmr:         m.bmr != null ? m.bmr : null,
    gender:      m.gender ?? null,
    age:         m.age != null ? m.age : null,
    visceralFat: m.visceralFat != null ? m.visceralFat : null,
    bodyAge:     m.bodyAge != null ? m.bodyAge : null,
    chestCm:     m.chestCm != null ? m.chestCm : null,
    waistCm:     m.waistCm != null ? m.waistCm : null,
    hipCm:       m.hipCm != null ? m.hipCm : null,
    fatPercent:  m.fatPercent != null ? m.fatPercent : null,
    bmi:         m.bmi != null ? m.bmi : null,
    weightKg:    m.weightKg != null ? m.weightKg : null,
  };
}

function applyMemberPrefillToForm(prev, member) {
  const next = { ...prev, phoneNumber: member.phoneNumber || prev.phoneNumber };
  if (member.userName && String(member.userName).trim()) {
    next.name = normalizeName(member.userName);
  }
  if (member.heightCm != null && member.heightCm !== '') next.heightCm = String(member.heightCm);
  if (member.bmr != null && member.bmr !== '') next.bmr = String(member.bmr);
  if (member.gender === 'Male' || member.gender === 'Female' || member.gender === 'Other') {
    next.gender = member.gender;
  }
  const copy = (src, dest = src) => {
    if (member[src] != null && member[src] !== '') next[dest] = String(member[src]);
  };
  copy('age');
  copy('visceralFat');
  copy('bodyAge');
  copy('chestCm');
  copy('waistCm');
  copy('hipCm');
  copy('fatPercent');
  copy('bmi');
  copy('weightKg');
  if (Array.isArray(member.recoveredHealthIssues) && member.recoveredHealthIssues.length) {
    next.recoveredHealthIssues = member.recoveredHealthIssues.filter(Boolean);
  }
  return next;
}

/**
 * Restore a previous BCM card onto the form (same phone, not yet activated).
 * Keeps today's date unless the stored card has one; always keeps the typed phone.
 */
function applyExistingBcmCardToForm(prev, card) {
  if (!card || typeof card !== 'object') return prev;
  const str = (v) => (v != null && v !== '' ? String(v) : '');
  const next = { ...prev };
  if (card.phoneNumber) next.phoneNumber = String(card.phoneNumber);
  if (card.name && String(card.name).trim()) next.name = normalizeName(card.name);
  if (card.gender === 'Male' || card.gender === 'Female' || card.gender === 'Other') {
    next.gender = card.gender;
  }
  if (card.locationName != null && String(card.locationName).trim()) {
    next.locationName = String(card.locationName).trim();
  }
  if (card.recordedDate) next.recordedDate = String(card.recordedDate).substring(0, 10);
  ['age', 'heightCm', 'weightKg', 'bmi', 'fatPercent', 'bmr', 'visceralFat', 'bodyAge', 'chestCm', 'waistCm', 'hipCm']
    .forEach((key) => {
      if (card[key] != null && card[key] !== '') next[key] = str(card[key]);
    });
  if (Array.isArray(card.recoveredHealthIssues) && card.recoveredHealthIssues.length) {
    next.recoveredHealthIssues = card.recoveredHealthIssues.filter(Boolean);
  }
  return next;
}

function mergePrefillFields(member, prefill) {
  if (!prefill || typeof prefill !== 'object') return member;
  const merged = { ...member };
  for (const [key, value] of Object.entries(prefill)) {
    if (value != null && value !== '') merged[key] = value;
  }
  if (member.phoneNumber) merged.phoneNumber = member.phoneNumber;
  return merged;
}

const EMPTY_FORM = {
  name:         '',  phoneNumber:  '',
  age:          '',
  gender:       '',
  heightCm:     '',
  weightKg:     '',
  bmi:          '',
  fatPercent:   '',
  bmr:          '',
  visceralFat:  '',
  bodyAge:      '',
  chestCm:      '',
  waistCm:      '',
  hipCm:        '',
  recordedDate: new Date().toISOString().substring(0, 10),
  locationName: '',
  recoveredHealthIssues: [],
};

function cardToFormState(card) {
  if (!card?.id) return EMPTY_FORM;
  const issues = Array.isArray(card.recoveredHealthIssues)
    ? card.recoveredHealthIssues.filter(Boolean)
    : [];
  return {
    name:         card.name ? normalizeName(card.name) : '',
    phoneNumber:  card.phoneNumber  ?? '',
    age:          card.age          != null ? String(card.age)         : '',
    gender:       card.gender        ?? '',
    heightCm:     card.heightCm     != null ? String(card.heightCm)    : '',
    weightKg:     card.weightKg     != null ? String(card.weightKg)    : '',
    bmi:          card.bmi          != null ? String(card.bmi)         : '',
    fatPercent:   card.fatPercent   != null ? String(card.fatPercent)  : '',
    bmr:          card.bmr          != null ? String(card.bmr)         : '',
    visceralFat:  card.visceralFat  != null ? String(card.visceralFat) : '',
    bodyAge:      card.bodyAge      != null ? String(card.bodyAge)     : '',
    chestCm:      card.chestCm      != null ? String(card.chestCm)     : '',
    waistCm:      card.waistCm      != null ? String(card.waistCm)     : '',
    hipCm:        card.hipCm        != null ? String(card.hipCm)       : '',
    recordedDate: card.recordedDate ?? new Date().toISOString().substring(0, 10),
    locationName: card.locationName ?? '',
    recoveredHealthIssues: issues,
  };
}

/**
 * @param {{ user: object, selectedMember: object|null, onSaveSuccess: function, existingCard: object|null, onSaveStart: function|null, isOpen: boolean, externalVenue?: string|null }} opts
 */
export function useBodyParamsCard({
  user, selectedMember, onSaveSuccess, existingCard = null, onSaveStart = null, isOpen = false,
  externalVenue = null,
} = {}) {
  const isEditMode = Boolean(existingCard?.id);

  const [form, setForm] = useState(() => cardToFormState(existingCard));
  const [isSaving, setIsSaving]           = useState(false);
  const [error, setError]                 = useState('');
  const [phoneFieldError, setPhoneFieldError] = useState('');
  const [phoneStatusNonce, setPhoneStatusNonce] = useState(0);
  const [savedCard, setSavedCard]         = useState(null);
  const [shareUrl, setShareUrl]           = useState('');

  // Track whether the user manually typed in the BMI field.
  // When true, BMI auto-fill is disabled.
  const [bmiUserEdited, setBmiUserEdited] = useState(false);
  const [bmrUserEdited, setBmrUserEdited] = useState(false);
  const [coachUserId, setCoachUserId] = useState(() => user?.id || null);

  // ── Phone autocomplete state ──────────────────────────────────────────────
  const [phoneSuggestions, setPhoneSuggestions] = useState([]);
  // Filtering is now synchronous (client-side); always false. Kept for API compatibility.
  const phoneSearchLoading = false;
  const phoneDebounceRef    = useRef(null);
  const phoneStatusDebounceRef = useRef(null);
  const phoneStatusRequestIdRef = useRef(0);
  /** Avoid re-applying the same BCM prefill on every status poll for one phone. */
  const lastBcmPrefillPhoneRef = useRef('');
  // Stores the last prefix typed while coachUserId was still null, so we can
  // fire the search as soon as the coach ID resolves.
  const pendingPhonePrefixRef = useRef(null);
  const fillFromMemberRef = useRef(null);

  // Flat list of all team members — loaded once when coachUserId is available.
  // Used for client-side phone prefix filtering (no backend round-trip needed).
  const [allTeamMembers, setAllTeamMembers] = useState([]);
  /** Always-current Venue string — avoids stale form state on Save. */
  const venueRef = useRef('');

  const targetUserId = selectedMember?.userId || selectedMember?.id || null;

  /**
   * Immediate phone activation check — runs as soon as digits are complete AND
   * coachUserId is resolved (lookup may finish after the user finished typing).
   */
  useEffect(() => {
    if (!isOpen) return undefined;

    const clean = String(form.phoneNumber || '').trim().replace(/[\s\-()]/g, '');
    if (!/^\+?[0-9]{10,15}$/.test(clean)) {
      setPhoneFieldError((prev) => (isActivatedPhoneErrorMessage(prev) ? '' : prev));
      lastBcmPrefillPhoneRef.current = '';
      return undefined;
    }

    const coachIdNum = parseInt(coachUserId, 10);
    if (!Number.isFinite(coachIdNum) || coachIdNum < 1) {
      return undefined;
    }

    let cancelled = false;
    const requestId = ++phoneStatusRequestIdRef.current;
    const timer = setTimeout(() => {
      debugLog('📱 [PhoneStatus] checking', { phone: clean, coachId: coachIdNum });
      fetchPhoneBcmStatus({ phoneNumber: clean, coachId: coachIdNum })
        .then((status) => {
          if (cancelled || requestId !== phoneStatusRequestIdRef.current) return;
          debugLog('📱 [PhoneStatus] result', status);
          if (status.activated) {
            lastBcmPrefillPhoneRef.current = '';
            setPhoneFieldError(status.message || BCM_PHONE_EXISTS_MESSAGE);
            setPhoneSuggestions([]);
            setError((prev) => (isActivatedPhoneErrorMessage(prev) ? '' : prev));
            return;
          }

          setPhoneFieldError((prev) => (
            isActivatedPhoneErrorMessage(prev) ? '' : prev
          ));

          // Restore prior BCM card (not activated) so name/venue/height/etc. are not lost.
          if (
            status.existingCard
            && lastBcmPrefillPhoneRef.current !== clean
          ) {
            lastBcmPrefillPhoneRef.current = clean;
            setForm((prev) => {
              const next = applyExistingBcmCardToForm(prev, status.existingCard);
              venueRef.current = String(next.locationName || '').trim();
              return next;
            });
            if (status.existingCard.bmi != null && status.existingCard.bmi !== '') {
              setBmiUserEdited(true);
            }
            if (status.existingCard.bmr != null && status.existingCard.bmr !== '') {
              setBmrUserEdited(true);
            }
          }
        })
        .catch((err) => {
          if (cancelled || requestId !== phoneStatusRequestIdRef.current) return;
          console.warn('[BodyParamsCard] phone status check failed', err?.message || err);
        });
    }, 150);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [form.phoneNumber, coachUserId, isOpen, phoneStatusNonce]);

  const recheckPhoneStatus = useCallback(() => {
    setPhoneStatusNonce((n) => n + 1);
  }, []);


  // Fingerprint of persisted card fields so a late-arriving detail fetch
  // (same id, more values) hydrates the form without waiting for a remount.
  const existingCardSnapshot = useMemo(() => {
    if (!existingCard?.id) return '';
    return [
      existingCard.id,
      existingCard.name,
      existingCard.phoneNumber,
      existingCard.age,
      existingCard.gender,
      existingCard.heightCm,
      existingCard.weightKg,
      existingCard.bmi,
      existingCard.fatPercent,
      existingCard.bmr,
      existingCard.visceralFat,
      existingCard.bodyAge,
      existingCard.chestCm,
      existingCard.waistCm,
      existingCard.hipCm,
      existingCard.locationName,
      existingCard.recordedDate,
      JSON.stringify(existingCard.recoveredHealthIssues || []),
    ].map((v) => (v == null ? '' : String(v))).join('\u0001');
  }, [existingCard]);

  // Reload form when the modal opens or the card values actually change.
  // useLayoutEffect so saved / fetched values paint on the first open frame.
  // Create: prefill Venue from header. Edit: use the card's saved Venue.
  useLayoutEffect(() => {
    if (!isOpen) return;
    const next = cardToFormState(existingCard);
    if (!isEditMode) {
      const fromHeader = externalVenue != null ? String(externalVenue).trim() : '';
      if (fromHeader) next.locationName = fromHeader;
    }
    venueRef.current = String(next.locationName || '').trim();
    setForm(next);
    setBmiUserEdited(false);
    setBmrUserEdited(false);
    setError('');
    setPhoneFieldError('');
    lastBcmPrefillPhoneRef.current = '';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, existingCardSnapshot, isEditMode]);

  // Create flow: keep form Venue in sync with the header Venue immediately.
  useLayoutEffect(() => {
    if (!isOpen || isEditMode) return;
    const fromHeader = externalVenue != null ? String(externalVenue).trim() : '';
    setForm((prev) => {
      if (String(prev.locationName || '').trim() === fromHeader) return prev;
      venueRef.current = fromHeader;
      return { ...prev, locationName: fromHeader };
    });
  }, [isOpen, isEditMode, externalVenue]);

  // Always resolve numeric team_table UserId via email (user.id may be wrong/non-DB).
  useEffect(() => {
    if (!user?.email) return undefined;

    let cancelled = false;
    CapacitorHttp.get({
      url: `${getApiBaseUrl()}/api/user/lookup?email=${encodeURIComponent(user.email)}`,
      headers: { 'Cache-Control': 'no-cache', ...getAppVersionHeaders() },
    })
      .then((response) => {
        const data = response.data;
        if (!cancelled && data?.success && data.userId) {
          setCoachUserId(data.userId);
        }
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [user?.email]);

  // ── Load team members once coachUserId resolves, then fire any pending search ──
  useEffect(() => {
    if (!coachUserId) return;
    let cancelled = false;
    teamHierarchyService.getFlatTeamList(coachUserId)
      .then((members) => {
        if (cancelled) return;
        debugLog('📱 [PhoneSearch] loaded members:', members.length,
          members.slice(0, 5).map(m => ({ id: m.userId, phone: m.phoneNumber }))
        );
        setAllTeamMembers(members);
        // Fire pending search now that we have both coachUserId and members.
        const prefix = pendingPhonePrefixRef.current;
        if (!prefix) return;
        pendingPhonePrefixRef.current = null;
        const digits = prefix.replace(/\D/g, '');
        if (digits.length < 1) return;
        const results = members
          .filter((m) => {
            if (!m.phoneNumber) return false;
            // Allow coaches to create cards for themselves (removed coach exclusion)yes
            return toNationalDigits(m.phoneNumber).startsWith(toNationalDigits(digits));
          })
          .slice(0, 10)
          .map((m) => toPhoneSuggestion(m))
          .filter(Boolean);
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

  /** BMR from Katch-McArdle when weight + fat% are valid. */
  const derivedBmr = useMemo(() => {
    return computeKatchMcArdleBmr(form.weightKg, form.fatPercent);
  }, [form.weightKg, form.fatPercent]);

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

  // Auto-fill BMR whenever weight or body fat % changes (Katch-McArdle).
  useEffect(() => {
    if (bmrUserEdited || derivedBmr === null) return;
    setForm((prev) => ({ ...prev, bmr: String(derivedBmr) }));
  }, [derivedBmr, bmrUserEdited]);

  // ── Setters ───────────────────────────────────────────────────────────────

  const setField = useCallback((field, value) => {
    const nextValue = field === 'name' ? normalizeName(value) : value;
    if (field === 'locationName') {
      venueRef.current = String(nextValue || '').trim();
    }
    setForm((prev) => ({ ...prev, [field]: nextValue }));
    if (field === 'weightKg' || field === 'fatPercent') {
      setBmrUserEdited(false);
    }
  }, []);

  /**
   * Called when the phone input changes. Updates form + triggers debounced prefix search.
   * Activation / "User already exists" is handled by the phoneNumber + coachUserId effect.
   */
  const setPhoneField = useCallback((value) => {
    setForm((prev) => ({ ...prev, phoneNumber: value }));
    if (isActivatedPhoneErrorMessage(error)) setError('');

    const digits = value.replace(/\D/g, '');
    // Clear activated-phone error while the number is incomplete; effect re-sets when complete.
    if (digits.length < 10) {
      setPhoneFieldError((prev) => (isActivatedPhoneErrorMessage(prev) ? '' : prev));
    }

    if (digits.length < 1) {
      setPhoneSuggestions([]);
      pendingPhonePrefixRef.current = null;
      if (phoneDebounceRef.current) clearTimeout(phoneDebounceRef.current);
      return;
    }

    if (phoneDebounceRef.current) clearTimeout(phoneDebounceRef.current);

    // coachUserId not yet resolved — park the prefix; the resolve useEffect will fire it.
    if (!coachUserId) {
      pendingPhonePrefixRef.current = digits;
    } else if (allTeamMembers.length === 0) {
      pendingPhonePrefixRef.current = digits;
    } else {
      pendingPhonePrefixRef.current = null;

      // Client-side filtering — instant, no network round-trip.
      phoneDebounceRef.current = setTimeout(() => {
        debugLog('📱 [PhoneSearch] Searching for:', digits, 'in', allTeamMembers.length, 'members');
        const results = allTeamMembers
          .filter((m) => {
            if (!m.phoneNumber) return false;
            const normalizedMemberPhone = toNationalDigits(m.phoneNumber);
            const normalizedSearchDigits = toNationalDigits(digits);
            const matches = normalizedMemberPhone.startsWith(normalizedSearchDigits);
            if (matches) {
              debugLog('📱 [PhoneSearch] Match found:', m.phoneNumber, 'normalized:', normalizedMemberPhone, 'search:', normalizedSearchDigits);
            }
            return matches;
          })
          .slice(0, 10)
          .map((m) => toPhoneSuggestion(m))
          .filter(Boolean);
        debugLog('📱 [PhoneSearch] Results:', results.length, 'matches');
        setPhoneSuggestions(results);

        if (results.length === 1) {
          const exactMatch = results[0];
          const normalizedMatch = toNationalDigits(exactMatch.phoneNumber);
          const normalizedSearch = toNationalDigits(digits);
          if (normalizedMatch === normalizedSearch) {
            debugLog('🎯 [PhoneSearch] EXACT MATCH - Auto-filling:', exactMatch);
            fillFromMemberRef.current?.(exactMatch);
            setPhoneSuggestions([]);
          }
        }
      }, 150);
    }
  }, [coachUserId, allTeamMembers, error]);

  /**
   * Called when the user selects a suggestion from the phone autocomplete.
   * Prefills all filled profile metrics (team_table + latest weight) for BCM.
   */
  const fillFromMember = useCallback(async (member) => {
    if (!member) return;

    if (member.phoneNumber && coachUserId) {
      try {
        const status = await fetchPhoneBcmStatus({
          phoneNumber: String(member.phoneNumber).trim(),
          coachId: coachUserId,
        });
        if (status.activated) {
          setPhoneFieldError(status.message || BCM_PHONE_EXISTS_MESSAGE);
          setPhoneSuggestions([]);
          setForm((prev) => ({
            ...prev,
            phoneNumber: member.phoneNumber || prev.phoneNumber,
          }));
          return;
        }
      } catch (err) {
        console.warn('[BodyParamsCard] phone status before prefill failed', err?.message || err);
      }
    }

    // Apply suggestion fields immediately (may already include weight from team hierarchy).
    setForm((prev) => applyMemberPrefillToForm(prev, member));
    setPhoneSuggestions([]);
    setPhoneFieldError('');

    let enriched = member;
    if (member.userId && coachUserId) {
      try {
        const prefill = await fetchMemberPrefill({
          userId: member.userId,
          coachId: coachUserId,
        });
        enriched = mergePrefillFields(member, prefill);
        debugLog('📦 [BodyParamsCard] member-prefill response', {
          weightKg: enriched.weightKg,
          fatPercent: enriched.fatPercent,
          bmi: enriched.bmi,
          raw: prefill,
        });
        setForm((prev) => applyMemberPrefillToForm(prev, enriched));
      } catch (err) {
        const msg = err?.message || '';
        if (isActivatedPhoneErrorMessage(msg)) {
          setPhoneFieldError(BCM_PHONE_EXISTS_MESSAGE);
          setPhoneSuggestions([]);
          return;
        }
        console.warn('[BodyParamsCard] member prefill failed', msg || err);
      }
    }

    if (enriched.bmi != null && enriched.bmi !== '') {
      setBmiUserEdited(true);
    } else {
      setBmiUserEdited(false);
    }
    if (enriched.bmr != null && enriched.bmr !== '') {
      setBmrUserEdited(true);
    } else {
      setBmrUserEdited(false);
    }
    debugLog('✅ [BodyParamsCard] pre-filled from member', enriched);
  }, [coachUserId]);

  fillFromMemberRef.current = fillFromMember;

  /** Called when user manually types in the Weight field. */
  const setWeightManually = useCallback((value) => {
    setBmrUserEdited(false);
    setForm((prev) => ({ ...prev, weightKg: value }));
  }, []);

  /** Called when user manually types in the BMI field. Disables auto-fill for BMI. */
  const setBmiManually = useCallback((value) => {
    setBmiUserEdited(true);
    setForm((prev) => ({ ...prev, bmi: value }));
  }, []);

  /** Called when user manually types in the BMR field. Disables auto-fill for BMR. */
  const setBmrManually = useCallback((value) => {
    setBmrUserEdited(true);
    setForm((prev) => ({ ...prev, bmr: value }));
  }, []);

  const resetForm = useCallback(() => {
    setForm(EMPTY_FORM);
    setError('');
    setPhoneFieldError('');
    setSavedCard(null);
    setShareUrl('');
    setBmiUserEdited(false);
    setBmrUserEdited(false);
  }, []);

  const cleanPhone = (s) => s.trim().replace(/[\s\-()]/g, '');

  const isValid =
    form.name.trim().length > 0 &&
    form.phoneNumber.trim().length > 0 &&
    /^\+?[0-9]{10,15}$/.test(cleanPhone(form.phoneNumber)) &&
    !phoneFieldError;

  const handleSave = useCallback(async () => {
    if (!form.name.trim()) { setError('Name is required'); return; }
    if (!form.phoneNumber.trim()) {
      setPhoneFieldError('Phone number is required');
      return;
    }
    if (!/^\+?[0-9]{10,15}$/.test(cleanPhone(form.phoneNumber))) {
      setPhoneFieldError('Please enter a valid phone number (10–15 digits)');
      return;
    }
    if (phoneFieldError) return;
    if (!coachUserId) {
      setError('Could not resolve your sponsor account. Please refresh and try again.'); return;
    }
    const ageNum = form.age !== '' && form.age != null ? parseInt(form.age) : null;
    if (ageNum !== null && (isNaN(ageNum) || ageNum < 1 || ageNum > 120)) {
      setError('Age must be between 1 and 120'); return;
    }
    const bodyAgeNum = form.bodyAge !== '' && form.bodyAge != null ? parseInt(form.bodyAge) : null;
    if (bodyAgeNum !== null && (isNaN(bodyAgeNum) || bodyAgeNum < 1 || bodyAgeNum > 120)) {
      setError('Body Age must be between 1 and 120'); return;
    }
    for (const [field, label] of [
      ['chestCm', 'Chest'],
      ['waistCm', 'Waist'],
      ['hipCm', 'Hip'],
    ]) {
      const n = toOptionalNum(form[field]);
      if (n != null && (n < 20 || n > 250)) {
        setError(`${label} must be between 20 and 250 cm`); return;
      }
    }
    setError('');
    setPhoneFieldError('');
    setIsSaving(true);

    // Venue from form ref (typed in modal), else header Venue — never drop on save.
    const locationNameToSave = (
      String(venueRef.current || '').trim()
      || String(form.locationName || '').trim()
      || String(externalVenue || '').trim()
      || null
    );

    // ⚡ Notify parent immediately with form data so it can start
    // pre-rendering + pre-capturing the card image in parallel with the API call.
    const creatorName = String(
      user?.userName || user?.name || user?.username || user?.displayName || ''
    ).trim();
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
        visceralFat:  form.visceralFat,
        bodyAge:      form.bodyAge,
        chestCm:      toOptionalNum(form.chestCm),
        waistCm:      toOptionalNum(form.waistCm),
        hipCm:        toOptionalNum(form.hipCm),
        recordedDate: form.recordedDate,
        locationName: locationNameToSave || '',
        creatorName,
        // Required for WhatsApp pre-capture — share sheet prefers preCapCard over API card
        recoveredHealthIssues: Array.isArray(form.recoveredHealthIssues)
          ? form.recoveredHealthIssues
          : [],
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
        bmrManualOverride: bmrUserEdited,
        visceralFat: form.visceralFat  || undefined,
        bodyAge:     form.bodyAge      || undefined,
        chestCm:     toOptionalNum(form.chestCm),
        waistCm:     toOptionalNum(form.waistCm),
        hipCm:       toOptionalNum(form.hipCm),
        recordedDate: form.recordedDate || undefined,
        locationName: locationNameToSave,
        recoveredHealthIssues: Array.isArray(form.recoveredHealthIssues)
          ? form.recoveredHealthIssues
          : [],
      };

      debugLog('📍 [BodyParamsCard] saving Venue:', locationNameToSave);

      const card = isEditMode
        ? await updateBodyParamsCard(existingCard.id, payload)
        : await createBodyParamsCard(payload);

      // Extract previousCard from API response (null for fresh users).
      const { previousCard: prevCard = null, ...cardCore } = card;

      const url = buildOnboardingShareUrl(getApiBaseUrl());

      // Merge API response with form fallbacks so the share card always has
      // the saved measurements (API is source of truth after persist).
      const fullCard = {
        ...cardCore,
        age:          pickSavedField(cardCore.age, form.age),
        phoneNumber:  pickSavedField(cardCore.phoneNumber, form.phoneNumber),
        gender:       pickSavedField(cardCore.gender, form.gender),
        heightCm:     pickSavedField(cardCore.heightCm, form.heightCm),
        weightKg:     pickSavedField(cardCore.weightKg, form.weightKg),
        bmi:          pickSavedField(cardCore.bmi, form.bmi),
        fatPercent:   pickSavedField(cardCore.fatPercent, form.fatPercent),
        bmr:          pickSavedField(cardCore.bmr, form.bmr),
        visceralFat:  pickSavedField(cardCore.visceralFat, form.visceralFat),
        bodyAge:      pickSavedField(cardCore.bodyAge, form.bodyAge),
        chestCm:      pickSavedField(cardCore.chestCm, form.chestCm),
        waistCm:      pickSavedField(cardCore.waistCm, form.waistCm),
        hipCm:        pickSavedField(cardCore.hipCm, form.hipCm),
        recordedDate: pickSavedField(cardCore.recordedDate, form.recordedDate),
        // Prefer the Venue the user just entered so the share card updates immediately.
        locationName: locationNameToSave || pickSavedField(cardCore.locationName, locationNameToSave),
        // Prefer API when it has values; else keep form selection (empty API
        // array must not erase chips the coach just picked).
        recoveredHealthIssues: (() => {
          const fromApi = Array.isArray(cardCore.recoveredHealthIssues)
            ? cardCore.recoveredHealthIssues.filter(Boolean)
            : [];
          const fromForm = Array.isArray(form.recoveredHealthIssues)
            ? form.recoveredHealthIssues.filter(Boolean)
            : [];
          return fromApi.length > 0 ? fromApi : fromForm;
        })(),
        creatorName,
      };

      setSavedCard(fullCard);
      setShareUrl(url);
      // Keep the just-saved values in the form immediately (do not wait for remount).
      setForm(cardToFormState(fullCard));
      venueRef.current = String(fullCard.locationName || '').trim();
      debugLog('✅ [BodyParamsCard] Created:', fullCard);

      // Always ask if not granted (do not gate on canRequest — Android first
      // install often reports denied). Must run before WhatsApp share sheet.
      if (fullCard.phoneNumber && Capacitor.isNativePlatform()) {
        try {
          const { granted } = await PermissionManager.checkPermission('contacts');
          if (!granted) {
            await PermissionManager.requestPermission('contacts');
          }
        } catch (err) {
          console.warn('[BodyParamsCard] contacts pre-prompt failed', err?.message || err);
        }
      }

      // Share first — never block WhatsApp on contact write itself.
      if (onSaveSuccess) onSaveSuccess(fullCard, url, prevCard);

      // Upsert device contact after share presents (create or overwrite venue/name/date).
      // Denial / missing plugin skips save without affecting share.
      if (fullCard.phoneNumber) {
        const contactPayload = {
          name: fullCard.name,
          venue: fullCard.locationName,
          recordedDate: fullCard.recordedDate,
          phoneNumber: fullCard.phoneNumber,
        };
        setTimeout(() => {
          void upsertBcmMemberToDeviceContacts(contactPayload).then((result) => {
            if (result?.ok) return;
            if (result?.reason === 'plugin-missing') {
              console.error('[BodyParamsCard] Contact not saved — rebuild iOS with Contacts pod');
            } else if (result?.reason === 'permission') {
              console.warn('[BodyParamsCard] Contact not saved — enable Contacts in Settings');
            }
          });
        }, 1200);
      }

      return true;
    } catch (err) {
      const msg = err.message || 'Failed to save. Please try again.';
      if (isActivatedPhoneErrorMessage(msg)) {
        setPhoneFieldError(BCM_PHONE_EXISTS_MESSAGE);
        setError('');
      } else {
        setError(msg);
      }
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [isValid, form, coachUserId, targetUserId, onSaveSuccess, onSaveStart, isEditMode, existingCard, user, bmrUserEdited, externalVenue, phoneFieldError]);

  return {
    form, setField,
    setPhoneField, fillFromMember,
    phoneSuggestions, phoneSearchLoading,
    phoneFieldError,
    recheckPhoneStatus,
    setWeightManually, setBmiManually, setBmrManually,
    fatHint, fatPlaceholder,
    derivedIdealWeight, derivedBmi, derivedBmr,
    bmiUserEdited, bmrUserEdited,
    isSaving, error,
    isValid,
    isEditMode,
    savedCard, shareUrl,
    handleSave, resetForm,
  };
}
