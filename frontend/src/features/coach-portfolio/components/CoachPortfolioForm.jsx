import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, MapPinned } from 'lucide-react';
import TouchFeedbackButton from '../../../shared/components/TouchFeedbackButton';
import PlaceMapPicker from '../../../shared/components/PlaceMapPicker';
import HoursPicker from './HoursPicker';
import { getApiBaseUrl } from '../../../config/api.config.js';
import {
  emptyPortfolioForm,
  mergePortfolioForm,
  validateAboutForm,
} from '../domain/formDefaults';
import {
  getFormSteps,
  includesOther,
  LANGUAGES,
  PROFESSIONAL_TITLES,
} from '../domain/formOptions';
import {
  checkPortfolioDisplayName,
  fetchMyPortfolioSubmission,
  requestPortfolioPublishOtp,
  savePortfolioDraft,
  uploadPortfolioIntroVideo,
  uploadPortfolioMedia,
} from '../services/portfolioApi';
import {
  FieldLabel,
  FormCard,
  MultiCheck,
  PhotoField,
  SelectInput,
  TextArea,
  TextInput,
  ValueSelectInput,
  VideoUploadField,
} from './formFields';
import { openPublicCoachUrl, resolvePublicCoachUrl } from '../utils/publicCoachUrl';
import { publicWebsiteUrl } from '../domain/publicWebsiteUrl';
import PublishOtpModal from './PublishOtpModal';
import SaveYourWebsiteReview from './SaveYourWebsiteReview';
import { buildPublicPathPreview } from '../domain/publicPathPreview';

async function uploadFormPhoto(userId, slot, file) {
  const data = await uploadPortfolioMedia({ userId, slot, file });
  return data?.url || null;
}

/** Absolute URL for app avatar / portfolio media shown in the form. */
function displayMediaUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('/api/')) return `${getApiBaseUrl()}${trimmed}`;
  return trimmed;
}

function setSection(form, section, patch) {
  return { ...form, [section]: { ...form[section], ...patch } };
}

function setSocialLink(form, key, value) {
  return setSection(form, 'mediaBrand', {
    social: {
      ...(form.mediaBrand?.social || {}),
      [key]: value,
    },
  });
}

/** Public website name = app profile name (no separate display-name field). */
function withProfileWebsiteName(form) {
  const name = String(form?.personal?.fullName || '').trim();
  if (!name) return form;
  if (String(form?.mediaBrand?.websiteDisplayName || '').trim() === name) return form;
  return setSection(form, 'mediaBrand', { websiteDisplayName: name });
}

function Progress({ stepIndex, steps }) {
  const total = steps.length || 1;
  const pct = Math.round(((stepIndex + 1) / total) * 100);
  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center justify-between text-[11px] font-medium text-slate-500">
        <span>Step {stepIndex + 1} of {total}</span>
        <span className="tabular-nums text-emerald-700">{pct}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex gap-1 overflow-x-auto pb-0.5">
        {steps.map((s, i) => (
          <span
            key={s.id}
            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              i === stepIndex
                ? 'bg-emerald-600 text-white'
                : i < stepIndex
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-slate-100 text-slate-500'
            }`}
          >
            {s.title}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * Coach website CMS form. Paid coaches can edit anytime (photos, copy, hours).
 */
export default function CoachPortfolioForm({
  userId,
  centerId,
  centerName = '',
  createMode = false,
  availableCenters = [],
  onClose,
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const [form, setForm] = useState(emptyPortfolioForm);
  const [submissionStatus, setSubmissionStatus] = useState('draft');
  const [adminNote, setAdminNote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [publicPath, setPublicPath] = useState(null);
  const [isPublished, setIsPublished] = useState(false);
  const [hasUnpublishedChanges, setHasUnpublishedChanges] = useState(false);
  const [hasClub, setHasClub] = useState(false);
  const [resolvedCenterId, setResolvedCenterId] = useState(centerId ?? null);
  const [resolvedCenterName, setResolvedCenterName] = useState(centerName || '');
  const [displayNameStatus, setDisplayNameStatus] = useState(''); // '', checking, available, taken, error
  const [otpOpen, setOtpOpen] = useState(false);
  const [maskedEmail, setMaskedEmail] = useState('');
  const [coachName, setCoachName] = useState('');
  const [pathPreview, setPathPreview] = useState('');
  const [otpResending, setOtpResending] = useState(false);
  const [otpKey, setOtpKey] = useState(null);
  const [placeMapOpen, setPlaceMapOpen] = useState(false);
  const [placeFromMap, setPlaceFromMap] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const defaultCenterAppliedRef = useRef(false);
  const fieldRefs = useRef({});
  const scrollRootRef = useRef(null);

  const setFieldRef = (key) => (el) => {
    if (el) fieldRefs.current[key] = el;
    else delete fieldRefs.current[key];
  };

  const clearFieldError = (key) => {
    setFieldErrors((prev) => {
      if (!prev?.[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const showFieldErrors = (keys) => {
    const list = (Array.isArray(keys) ? keys : [keys]).filter(Boolean);
    if (!list.length) return;
    const next = {};
    list.forEach((k) => { next[k] = true; });
    setFieldErrors(next);
    const first = list[0];
    const el = fieldRefs.current[first];
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const centers = useMemo(
    () => (Array.isArray(availableCenters) ? availableCenters : []),
    [availableCenters],
  );

  /** Create New: only centers without a website yet. Edit: all centers. */
  const selectableCenters = useMemo(() => {
    if (createMode) return centers.filter((c) => c.centerId != null && !c.hasWebsite);
    return centers.filter((c) => c.centerId != null);
  }, [centers, createMode]);

  const centerOptions = useMemo(() => (
    selectableCenters.map((c) => ({
      value: String(c.centerId),
      label: [c.centerName, c.city, c.locality].filter(Boolean).join(' · '),
    }))
  ), [selectableCenters]);

  const steps = getFormSteps({ hasClub: hasClub || Boolean(resolvedCenterId) });
  const step = steps[Math.min(stepIndex, steps.length - 1)] || steps[0];
  const canEdit = true;
  /** Save is always draft. Publish (first or changes) always requires coach OTP. */
  const publishButtonLabel = isPublished ? 'Publish changes' : 'Publish website';

  const loadCenterForm = async (nextCenterId, { fresh = false, placeFallback = null } = {}) => {
    if (nextCenterId == null) {
      setForm(emptyPortfolioForm());
      setSubmissionStatus('draft');
      setAdminNote(null);
      setPublicPath(null);
      setIsPublished(false);
      setHasClub(false);
      setResolvedCenterId(null);
      setResolvedCenterName('');
      return;
    }
    const data = await fetchMyPortfolioSubmission(userId, nextCenterId);
    const fallbackCity = String(placeFallback?.city || '').trim();
    const fallbackLocality = String(placeFallback?.locality || '').trim();
    const fallbackName = String(placeFallback?.centerName || '').trim();
    // Even in fresh create, hydrate place/contact from the selected center via a second merge of empty+server hydrate fields.
    if (fresh) {
      const hydrated = mergePortfolioForm(emptyPortfolioForm(), {
        personal: {
          fullName: data?.form?.personal?.fullName || '',
          profilePhoto: data?.form?.personal?.profilePhoto || null,
          professionalTitle: data?.form?.personal?.professionalTitle || 'Wellness Coach',
        },
        center: {
          centerName: data?.form?.center?.centerName || fallbackName || '',
          // Server GPS hydrate can fail; fall back to My Websites list city/area (already on the option label).
          city: data?.form?.center?.city || fallbackCity || '',
          locality: data?.form?.center?.locality || fallbackLocality || '',
          businessPhone: data?.form?.center?.businessPhone || '',
          whatsapp: data?.form?.center?.whatsapp || '',
          businessEmail: data?.form?.center?.businessEmail || '',
          mapsLink: data?.form?.center?.mapsLink || '',
          address: data?.form?.center?.address || '',
        },
        mediaBrand: {
          websiteDisplayName: data?.form?.personal?.fullName || '',
        },
        services: data?.form?.services || undefined,
      });
      setForm(hydrated);
      setSubmissionStatus('draft');
      setAdminNote(null);
      setPublicPath(null);
      setIsPublished(false);
      setHasUnpublishedChanges(false);
    } else {
      const merged = mergePortfolioForm(data?.form);
      if (!String(merged.center?.city || '').trim() && fallbackCity) {
        merged.center.city = fallbackCity;
      }
      if (!String(merged.center?.locality || '').trim() && fallbackLocality) {
        merged.center.locality = fallbackLocality;
      }
      if (!String(merged.center?.centerName || '').trim() && fallbackName) {
        merged.center.centerName = fallbackName;
      }
      setForm(merged);
      setSubmissionStatus(data?.status || 'draft');
      setAdminNote(data?.adminNote || null);
      setPublicPath(data?.publicPath || null);
      setIsPublished(data?.isPublished === true);
      setHasUnpublishedChanges(data?.hasUnpublishedChanges === true);
    }
    setHasClub(data?.hasClub === true);
    setResolvedCenterId(data?.centerId != null ? data.centerId : nextCenterId);
    setResolvedCenterName(data?.centerName || fallbackName || '');
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setMessage('');
      try {
        if (createMode && (centerId == null || String(centerId).trim() === '')) {
          // Hydrate name / phone / photo from app; City & Area stay blank for freestyle.
          const data = await fetchMyPortfolioSubmission(userId, null, { createNew: true });
          if (cancelled) return;
          setForm(mergePortfolioForm(data?.form || emptyPortfolioForm()));
          setSubmissionStatus('draft');
          setAdminNote(null);
          setPublicPath(null);
          setIsPublished(false);
          setHasUnpublishedChanges(false);
          setHasClub(false);
          setResolvedCenterId(null);
          setResolvedCenterName('');
          setStepIndex(0);
          setDisplayNameStatus('');
        } else if (!createMode && (centerId == null || String(centerId).trim() === '')) {
          // Legacy saved form (no CenterId yet) — load latest submission for this user.
          const data = await fetchMyPortfolioSubmission(userId);
          if (cancelled) return;
          setForm(mergePortfolioForm(data?.form));
          setSubmissionStatus(data?.status || 'draft');
          setAdminNote(data?.adminNote || null);
          setPublicPath(data?.publicPath || null);
          setIsPublished(data?.isPublished === true);
          setHasUnpublishedChanges(data?.hasUnpublishedChanges === true);
          setHasClub(data?.hasClub === true);
          if (data?.centerId != null) setResolvedCenterId(data.centerId);
          if (data?.centerName) setResolvedCenterName(data.centerName);
          setStepIndex(0);
          setDisplayNameStatus('');
        } else {
          await loadCenterForm(centerId, { fresh: false });
          if (cancelled) return;
          setStepIndex(0);
          setDisplayNameStatus('');
        }
      } catch (err) {
        if (!cancelled) setMessage(err?.message || 'Could not load form');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial open only for given center/createMode
  }, [userId, centerId, createMode]);

  const placeFromCenterOption = (meta, optionLabel) => {
    let city = String(meta?.city || '').trim();
    let locality = String(meta?.locality || '').trim();
    let centerName = String(meta?.centerName || '').trim();
    // Label format: "Demo Centre · Chennai · Kodambakkam"
    if ((!city || !locality) && optionLabel) {
      const parts = String(optionLabel).split('·').map((p) => p.trim()).filter(Boolean);
      if (parts.length >= 3) {
        if (!centerName) centerName = parts[0];
        if (!city) city = parts[1];
        if (!locality) locality = parts[2];
      } else if (parts.length === 2) {
        if (!city) city = parts[0];
        if (!locality) locality = parts[1];
      }
    }
    return { city, locality, centerName };
  };

  const onCenterChange = async (rawId) => {
    if (!rawId) {
      // Explicit "No center" — freestyle map (GPS on open).
      setResolvedCenterId(null);
      setResolvedCenterName('');
      setHasClub(false);
      setPlaceFromMap(false);
      setPlaceMapOpen(true);
      setMessage('No center — map opened at your current location');
      return;
    }
    const nextId = Number(rawId);
    if (!Number.isFinite(nextId) || nextId <= 0) return;
    const meta = selectableCenters.find((c) => Number(c.centerId) === nextId);
    const optionLabel = centerOptions.find((o) => Number(o.value) === nextId)?.label || '';
    const place = placeFromCenterOption(meta, optionLabel);
    setBusy(true);
    setMessage('');
    setPlaceMapOpen(false);
    setPlaceFromMap(false);
    try {
      await loadCenterForm(nextId, {
        fresh: createMode,
        placeFallback: place,
      });
      // Guarantee City/Area show even if a later merge left them blank.
      setForm((prev) => setSection(prev, 'center', {
        city: String(prev?.center?.city || '').trim() || place.city,
        locality: String(prev?.center?.locality || '').trim() || place.locality,
        centerName: String(prev?.center?.centerName || '').trim() || place.centerName,
      }));
      setResolvedCenterName(place.centerName || meta?.centerName || '');
      if (place.city || place.locality) clearFieldError('place');
      setMessage(
        place.city || place.locality
          ? 'Center loaded — City & Area filled from center'
          : 'Center linked',
      );
    } catch (err) {
      setMessage(err?.message || 'Could not load center');
    } finally {
      setBusy(false);
    }
  };

  // Must be a render helper (not an inner component) so City/Area inputs keep focus while typing.
  const onPlaceMapResolved = (place) => {
    if (!canEdit || !place) return;
    const city = String(place.city || '').trim();
    const locality = String(place.locality || '').trim();
    setForm((prev) => setSection(prev, 'center', {
      city: city || String(prev.center?.city || '').trim(),
      locality: locality || String(prev.center?.locality || '').trim(),
      mapsLink: place.mapsLink || prev.center?.mapsLink || '',
      address: [locality, city].filter(Boolean).join(', ') || prev.center?.address || '',
    }));
    if (city || locality) {
      setPlaceFromMap(true);
      setPlaceMapOpen(false);
      clearFieldError('place');
    }
  };

  const placeSummary = [form.center.locality, form.center.city].filter(Boolean).join(', ');
  const hasLinkedCenter = resolvedCenterId != null;
  const freestylePlace = !hasLinkedCenter;

  const renderPlaceFields = (title = 'City & area') => (
    <div className="space-y-3 rounded-2xl border border-emerald-100 bg-emerald-50/40 px-3.5 py-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-800">{title}</p>
      {selectableCenters.length > 0 ? (
        <div>
          <FieldLabel>Centre</FieldLabel>
          <ValueSelectInput
            options={centerOptions}
            value={resolvedCenterId != null ? String(resolvedCenterId) : ''}
            onChange={onCenterChange}
            placeholder="No center — pick on map"
            disabled={!canEdit || busy}
          />
        </div>
      ) : null}

      {freestylePlace && canEdit && !placeMapOpen ? (
        <TouchFeedbackButton
          type="button"
          disabled={busy}
          onClick={() => setPlaceMapOpen(true)}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-emerald-300 bg-white px-3.5 py-2.5 text-[13px] font-semibold text-emerald-800 shadow-sm disabled:opacity-50"
        >
          <MapPinned className="h-4 w-4" aria-hidden />
          Pick City & Area on map
        </TouchFeedbackButton>
      ) : null}

      {freestylePlace && placeMapOpen ? (
        <PlaceMapPicker
          open={placeMapOpen}
          disabled={!canEdit || busy}
          onClose={() => setPlaceMapOpen(false)}
          onResolved={onPlaceMapResolved}
        />
      ) : null}

      <div
        ref={setFieldRef('place')}
        className={`rounded-xl border bg-white px-3 py-2.5 ${
          fieldErrors.place ? 'border-rose-500 ring-2 ring-rose-400/40' : 'border-emerald-200'
        }`}
      >
        {placeSummary ? (
          <>
            <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-800">Place</p>
            <p className="mt-0.5 text-sm font-semibold text-slate-900">{placeSummary}</p>
            {placeFromMap ? (
              <p className="mt-1 text-[11px] font-medium text-emerald-700">From map</p>
            ) : null}
            {hasLinkedCenter ? (
              <p className="mt-1 text-[11px] text-slate-500">From linked centre</p>
            ) : null}
            {freestylePlace && canEdit && !placeMapOpen ? (
              <TouchFeedbackButton
                type="button"
                disabled={busy}
                onClick={() => setPlaceMapOpen(true)}
                className="mt-2 text-[12px] font-semibold text-emerald-800 underline"
              >
                Change on map
              </TouchFeedbackButton>
            ) : null}
          </>
        ) : (
          <p className={`text-[12px] font-medium ${fieldErrors.place ? 'text-rose-600' : 'text-amber-700'}`}>
            {fieldErrors.place
              ? 'Required — pick a center or set place on map'
              : (freestylePlace
                ? 'Pick on map to set City & Area'
                : 'Select a center to fill City & Area')}
          </p>
        )}
      </div>

      {hasLinkedCenter ? (
        <HoursPicker
          timings={form.timings}
          disabled={!canEdit || busy}
          onChange={(patch) => canEdit && setForm(setSection(form, 'timings', patch))}
        />
      ) : null}
    </div>
  );

  useEffect(() => {
    setStepIndex((i) => Math.min(i, Math.max(0, steps.length - 1)));
  }, [steps.length]);

  // Create website: default first available center; else open map at GPS.
  useEffect(() => {
    if (loading || !createMode || defaultCenterAppliedRef.current) return;
    if (centerId != null && String(centerId).trim() !== '') {
      defaultCenterAppliedRef.current = true;
      return;
    }
    if (resolvedCenterId != null) {
      defaultCenterAppliedRef.current = true;
      return;
    }
    if (selectableCenters.length > 0) {
      defaultCenterAppliedRef.current = true;
      const firstId = selectableCenters[0]?.centerId;
      if (firstId != null) {
        onCenterChange(String(firstId));
      }
      return;
    }
    defaultCenterAppliedRef.current = true;
    setPlaceMapOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot default after load
  }, [loading, createMode, centerId, resolvedCenterId, selectableCenters]);

  // Keep websiteDisplayName locked to Coach profile name for slug / uniqueness (not shown in UI).
  useEffect(() => {
    if (loading) return;
    setForm((prev) => withProfileWebsiteName(prev));
  }, [form.personal.fullName, loading]);

  useEffect(() => {
    const name = String(form.personal.fullName || form.mediaBrand.websiteDisplayName || '').trim();
    if (!name || loading) {
      setDisplayNameStatus('');
      return undefined;
    }
    let cancelled = false;
    setDisplayNameStatus('checking');
    const timer = setTimeout(async () => {
      try {
        const result = await checkPortfolioDisplayName({
          userId,
          name,
          centerId: resolvedCenterId,
        });
        if (cancelled) return;
        setDisplayNameStatus(result?.available === true ? 'available' : 'taken');
      } catch {
        if (!cancelled) setDisplayNameStatus('error');
      }
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [form.personal.fullName, form.mediaBrand.websiteDisplayName, userId, resolvedCenterId, loading]);

  const saveDraft = async () => {
    if (!String(form.center.city || '').trim() || !String(form.center.locality || '').trim()) {
      setMessage('Enter City and Area — use Pick on map, or type both fields');
      setPlaceMapOpen(true);
      return;
    }
    if (displayNameStatus === 'taken') {
      setMessage('Your Coach profile name is already used on another website in this City & Area — change City/Area or contact support');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const formToSave = withProfileWebsiteName(form);
      setForm(formToSave);
      const data = await savePortfolioDraft({
        userId,
        centerId: resolvedCenterId,
        form: formToSave,
        createNew: createMode && resolvedCenterId == null,
      });
      setSubmissionStatus(data?.status || submissionStatus || 'draft');
      setPublicPath(data?.publicPath || publicPath);
      setIsPublished(data?.isPublished === true);
      setHasUnpublishedChanges(
        data?.hasUnpublishedChanges === true
        || data?.isPublished === true,
      );
      if (data?.centerId != null) setResolvedCenterId(data.centerId);
      setMessage(
        data?.isPublished
          ? 'Draft saved — live page unchanged until you Publish changes (coach OTP)'
          : (data?.publicPath
            ? `Draft saved — ${data.publicPath}`
            : 'Draft saved — publish when ready'),
      );
    } catch (err) {
      setMessage(err?.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const goNext = () => {
    if (step.id === 'hero') {
      const missing = [];
      if (!String(form.center.city || '').trim() || !String(form.center.locality || '').trim()) {
        missing.push('place');
        if (freestylePlace) setPlaceMapOpen(true);
      }
      if (!String(form.personal.professionalTitle || '').trim()) missing.push('professionalTitle');
      if (
        includesOther(form.personal.professionalTitle)
        && !String(form.personal.professionalTitleOther || '').trim()
      ) {
        missing.push('professionalTitleOther');
      }
      if (missing.length) {
        showFieldErrors(missing);
        setMessage('');
        return;
      }
    }
    if (step.id === 'about') {
      const missing = [];
      if (!String(form.personal.yearsExperience || '').trim()) missing.push('yearsExperience');
      if (!String(form.personal.background || '').trim()) missing.push('background');
      if (!Array.isArray(form.personal.languages) || form.personal.languages.length === 0) {
        missing.push('languages');
      } else if (
        includesOther(form.personal.languages)
        && !String(form.personal.languagesOther || '').trim()
      ) {
        missing.push('languagesOther');
      }
      if (missing.length) {
        showFieldErrors(missing);
        setMessage('');
        return;
      }
    }
    setFieldErrors({});
    setMessage('');
    setStepIndex((i) => Math.min(steps.length - 1, i + 1));
  };

  const sendPublishOtp = async () => {
    if (!String(form.center.city || '').trim() || !String(form.center.locality || '').trim()) {
      setPlaceMapOpen(true);
      throw new Error('Enter City and Area before publishing — pick on map or type both');
    }
    const formToSave = withProfileWebsiteName(form);
    setForm(formToSave);
    const data = await requestPortfolioPublishOtp({
      userId,
      centerId: resolvedCenterId,
      form: formToSave,
      createNew: createMode && resolvedCenterId == null,
    });
    setSubmissionStatus(data?.status || 'approved');
    setMaskedEmail(data?.maskedEmail || '');
    setCoachName(data?.coachName || '');
    setOtpKey(data?.otpKey ?? data?.centerId ?? data?.id ?? null);
    // Prefer the City/Area the user typed — never fall back to another site's old path.
    const formPath = buildPublicPathPreview({
      websiteDisplayName: formToSave.mediaBrand?.websiteDisplayName,
      fullName: formToSave.personal?.fullName,
      city: formToSave.center?.city,
      locality: formToSave.center?.locality,
      userId,
    });
    setPathPreview(data?.publicPathPreview || formPath);
    if (data?.centerId != null) setResolvedCenterId(data.centerId);
    if (data?.isPublished === true && data?.publicPath) {
      setPublicPath(data.publicPath);
      setIsPublished(true);
    }
    setOtpOpen(true);
    setMessage(
      data?.coachName
        ? `OTP sent to your coach (${data.coachName}). Ask them for the code to publish.`
        : data?.maskedEmail
          ? `OTP sent to your coach at ${data.maskedEmail}. Ask them for the code to publish.`
          : 'OTP sent to your coach. Ask them for the code to publish.',
    );
    return data;
  };

  const onSubmit = async () => {
    if (!String(form.center.city || '').trim() || !String(form.center.locality || '').trim()) {
      setMessage('Enter City and Area before publishing — pick on map or type both');
      setPlaceMapOpen(true);
      return;
    }
    if (displayNameStatus === 'taken') {
      setMessage('Your Coach profile name is already used on another website in this City & Area — change City/Area or contact support');
      return;
    }
    const aboutErrors = validateAboutForm(form);
    if (aboutErrors.length) {
      setMessage(aboutErrors[0]);
      return;
    }
    if (!form.goalsConsent.accuracyConfirmed) {
      setMessage('Confirm that the information is accurate');
      return;
    }
    if (String(form.goalsConsent.publishAuthorized || '') !== 'yes') {
      setMessage('Authorize publishing your photos and content');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      await sendPublishOtp();
    } catch (err) {
      setMessage(err?.message || 'Could not send publish OTP');
    } finally {
      setBusy(false);
    }
  };

  const onOtpVerified = (data) => {
    setOtpOpen(false);
    setSubmissionStatus(data?.status || 'approved');
    setPublicPath(data?.publicPath || pathPreview || publicPath);
    setIsPublished(data?.isPublished === true || Boolean(data?.publicPath));
    setHasUnpublishedChanges(false);
    // After coach OTP verify, return to My Websites hub (live card + Edit).
    if (typeof onClose === 'function') {
      onClose({
        published: true,
        message: data?.publicPath
          ? `Published — ${data.publicPath}`
          : 'Published — live page updated',
      });
      return;
    }
    setMessage(data?.publicPath
      ? `Published — ${data.publicPath}`
      : 'Published — live page updated');
  };

  const onResendOtp = async () => {
    setOtpResending(true);
    setMessage('');
    try {
      await sendPublishOtp();
    } catch (err) {
      setMessage(err?.message || 'Could not resend OTP');
    } finally {
      setOtpResending(false);
    }
  };

  return (
    <div className={`fixed inset-0 z-50 flex flex-col ${step.id === 'review' ? 'bg-[#f3efe4]' : 'bg-[#eef3ef]'}`}>
      <header className="relative z-30 shrink-0 border-b border-slate-200/70 bg-white/95 backdrop-blur-md safe-top">
        <div className="mx-auto max-w-lg px-4 py-3">
          <div className="flex items-center gap-3">
            <TouchFeedbackButton
              onClick={onClose}
              ariaLabel="Go back"
              className="-ml-1 rounded-xl p-2 hover:bg-slate-100"
            >
              <ArrowLeft className="h-5 w-5 text-slate-700" />
            </TouchFeedbackButton>
            <div className="min-w-0 flex-1">
              <h1 className="text-[15px] font-bold tracking-tight text-slate-900">
                {resolvedCenterName ? `Website · ${resolvedCenterName}` : 'My website'}
              </h1>
              <p className="text-xs text-slate-500">{step.description}</p>
            </div>
          </div>
          <Progress stepIndex={stepIndex} steps={steps} />
        </div>
      </header>

      <div
        ref={scrollRootRef}
        className={`relative z-0 mx-auto w-full max-w-lg flex-1 overflow-y-auto px-4 py-4 space-y-4 ${
          step.id === 'review' ? 'pb-40' : 'pb-32'
        }`}
      >
        {loading ? <p className="text-sm text-slate-500">Loading your form…</p> : null}

        {!loading && adminNote ? (
          <div className="rounded-2xl border border-amber-200/80 bg-amber-50 px-3.5 py-3 text-sm text-amber-950">
            <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700">Admin note</p>
            <p className="mt-1 leading-relaxed">{adminNote}</p>
          </div>
        ) : null}

        {!loading && step.id === 'hero' ? (
          <FormCard title="Hero">
            {renderPlaceFields('City & area')}
            {displayNameStatus === 'taken' ? (
              <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] font-medium text-rose-700">
                Coach profile name is already used in this City & Area — pick another place or contact support
              </p>
            ) : null}
            <div ref={setFieldRef('professionalTitle')}>
              <FieldLabel required hint="Shown as “Meet Your …” on About">
                Professional Title
              </FieldLabel>
              <SelectInput
                options={PROFESSIONAL_TITLES}
                value={form.personal.professionalTitle}
                error={Boolean(fieldErrors.professionalTitle)}
                onChange={(v) => {
                  if (!canEdit) return;
                  clearFieldError('professionalTitle');
                  setForm(setSection(form, 'personal', { professionalTitle: v }));
                }}
              />
              {fieldErrors.professionalTitle ? (
                <p className="mt-1 text-[11px] font-medium text-rose-600">Required</p>
              ) : null}
            </div>
            {includesOther(form.personal.professionalTitle) ? (
              <div ref={setFieldRef('professionalTitleOther')}>
                <FieldLabel required>Please specify title</FieldLabel>
                <TextInput
                  value={form.personal.professionalTitleOther}
                  error={Boolean(fieldErrors.professionalTitleOther)}
                  onChange={(v) => {
                    if (!canEdit) return;
                    clearFieldError('professionalTitleOther');
                    setForm(setSection(form, 'personal', { professionalTitleOther: v }));
                  }}
                  placeholder="Type your professional title"
                />
                {fieldErrors.professionalTitleOther ? (
                  <p className="mt-1 text-[11px] font-medium text-rose-600">Required</p>
                ) : null}
              </div>
            ) : null}
            <div>
              <FieldLabel hint="Shown on your public website footer">Instagram</FieldLabel>
              <TextInput
                value={form.mediaBrand.social?.instagram || ''}
                onChange={(v) => canEdit && setForm(setSocialLink(form, 'instagram', v))}
                placeholder="https://instagram.com/your-handle"
              />
            </div>
            <div>
              <FieldLabel hint="Shown on your public website footer">YouTube</FieldLabel>
              <TextInput
                value={form.mediaBrand.social?.youtube || ''}
                onChange={(v) => canEdit && setForm(setSocialLink(form, 'youtube', v))}
                placeholder="https://youtube.com/@your-channel"
              />
            </div>
            <div>
              <FieldLabel hint="Shown on your public website footer">LinkedIn</FieldLabel>
              <TextInput
                value={form.mediaBrand.social?.linkedin || ''}
                onChange={(v) => canEdit && setForm(setSocialLink(form, 'linkedin', v))}
                placeholder="https://linkedin.com/in/your-profile"
              />
            </div>
          </FormCard>
        ) : null}

        {!loading && step.id === 'about' ? (
          <FormCard title="About">
            <div ref={setFieldRef('yearsExperience')}>
              <FieldLabel required hint="Shown exactly as typed under About (example: 8+ years of coaching)">
                Years of experience
              </FieldLabel>
              <TextInput
                value={form.personal.yearsExperience}
                error={Boolean(fieldErrors.yearsExperience)}
                onChange={(v) => {
                  if (!canEdit) return;
                  clearFieldError('yearsExperience');
                  setForm(setSection(form, 'personal', { yearsExperience: v }));
                }}
                placeholder="8+ years of coaching"
              />
              {fieldErrors.yearsExperience ? (
                <p className="mt-1 text-[11px] font-medium text-rose-600">Required</p>
              ) : null}
            </div>
            <div ref={setFieldRef('background')}>
              <FieldLabel required hint="Shown on your public About section">
                Who are you as a Wellness Professional
              </FieldLabel>
              <TextArea
                value={form.personal.background}
                error={Boolean(fieldErrors.background)}
                onChange={(v) => {
                  if (!canEdit) return;
                  clearFieldError('background');
                  setForm(setSection(form, 'personal', { background: v }));
                }}
                placeholder="Your story as a wellness professional — how you help people"
                rows={4}
              />
              {fieldErrors.background ? (
                <p className="mt-1 text-[11px] font-medium text-rose-600">Required</p>
              ) : null}
            </div>
            <div>
              <FieldLabel hint="Checklist line under About">
                Qualifications
              </FieldLabel>
              <TextInput
                value={form.personal.qualifications}
                onChange={(v) => canEdit && setForm(setSection(form, 'personal', { qualifications: v }))}
                placeholder="Certified nutrition coach · Habit coaching"
              />
            </div>
            <div ref={setFieldRef('languages')}>
              <FieldLabel required>Languages</FieldLabel>
              <MultiCheck
                options={LANGUAGES}
                value={form.personal.languages}
                error={Boolean(fieldErrors.languages)}
                onChange={(v) => {
                  if (!canEdit) return;
                  clearFieldError('languages');
                  setForm(setSection(form, 'personal', { languages: v }));
                }}
                disabled={!canEdit}
              />
              {fieldErrors.languages ? (
                <p className="mt-1 text-[11px] font-medium text-rose-600">Required</p>
              ) : null}
              {includesOther(form.personal.languages) ? (
                <div className="mt-2" ref={setFieldRef('languagesOther')}>
                  <FieldLabel required>Other language</FieldLabel>
                  <TextInput
                    value={form.personal.languagesOther}
                    error={Boolean(fieldErrors.languagesOther)}
                    onChange={(v) => {
                      if (!canEdit) return;
                      clearFieldError('languagesOther');
                      setForm(setSection(form, 'personal', { languagesOther: v }));
                    }}
                    placeholder="Type language"
                  />
                  {fieldErrors.languagesOther ? (
                    <p className="mt-1 text-[11px] font-medium text-rose-600">Required</p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </FormCard>
        ) : null}

        {!loading && step.id === 'photos' ? (
          <FormCard title="Photos">
            <PhotoField
              label="Centre Entrance Photo"
              value={form.mediaBrand.entrancePhoto}
              disabled={!canEdit}
              onUpload={(file) => uploadFormPhoto(userId, 'entrance', file)}
              onChange={(v) => canEdit && setForm(setSection(form, 'mediaBrand', { entrancePhoto: v }))}
            />
            <PhotoField
              label="Centre Interior Photos"
              multiple
              values={form.mediaBrand.interiorPhotos}
              disabled={!canEdit}
              onUpload={(file) => uploadFormPhoto(userId, 'interior', file)}
              onChangeMultiple={(v) => canEdit && setForm(setSection(form, 'mediaBrand', { interiorPhotos: v }))}
            />
            <PhotoField
              label="Centre Name Board Photo"
              value={form.mediaBrand.nameBoardPhoto}
              disabled={!canEdit}
              onUpload={(file) => uploadFormPhoto(userId, 'nameboard', file)}
              onChange={(v) => canEdit && setForm(setSection(form, 'mediaBrand', { nameBoardPhoto: v }))}
            />
            <PhotoField
              label="Wellness Activity Photos"
              multiple
              values={form.mediaBrand.activityPhotos}
              disabled={!canEdit}
              onUpload={(file) => uploadFormPhoto(userId, 'activity', file)}
              onChangeMultiple={(v) => canEdit && setForm(setSection(form, 'mediaBrand', { activityPhotos: v }))}
            />
            <VideoUploadField
              label="Introduction Videos"
              values={form.mediaBrand.introVideos || []}
              disabled={!canEdit}
              onUpload={async (file) => {
                const data = await uploadPortfolioIntroVideo({ userId, file });
                return data?.url || null;
              }}
              onChangeMultiple={(urls) => {
                if (!canEdit) return;
                const list = Array.isArray(urls) ? urls.filter(Boolean) : [];
                setForm(setSection(form, 'mediaBrand', {
                  introVideos: list,
                  introVideoUrl: list[0] || null,
                  introVideoLink: list[0] || '',
                  introVideoKey: list.length ? form.mediaBrand.introVideoKey : null,
                }));
              }}
            />
          </FormCard>
        ) : null}

        {!loading && step.id === 'review' ? (
          <SaveYourWebsiteReview
            form={form}
            centerDisplayName={resolvedCenterName || form.center.centerName || ''}
            profilePhotoUrl={displayMediaUrl(form.personal.profilePhoto)}
            canEdit={canEdit}
            isPublished={isPublished}
            publicPath={publicPath}
            hasUnpublishedChanges={hasUnpublishedChanges}
            livePageHref={
              isPublished && publicPath
                ? (resolvePublicCoachUrl(publicPath) || publicWebsiteUrl(publicPath))
                : undefined
            }
            onOpenLivePage={(e) => openPublicCoachUrl(publicPath, e)}
            onAccuracyChange={(checked) => {
              if (!canEdit) return;
              setForm(setSection(form, 'goalsConsent', { accuracyConfirmed: checked }));
            }}
            onAuthorizeChange={(v) => {
              if (!canEdit) return;
              setForm(setSection(form, 'goalsConsent', { publishAuthorized: v }));
            }}
          />
        ) : null}

        {message ? (
          <p className="rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700" role="status">
            {message}
          </p>
        ) : null}
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200/80 bg-white safe-bottom shadow-[0_-8px_24px_rgba(15,23,42,0.08)]">
        <div className="mx-auto flex max-w-lg gap-2 px-4 py-3">
          <TouchFeedbackButton
            onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
            disabled={stepIndex === 0 || busy}
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-800 disabled:opacity-40"
          >
            Previous
          </TouchFeedbackButton>
          <TouchFeedbackButton
            onClick={saveDraft}
            disabled={busy || loading}
            className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 disabled:opacity-40"
          >
            Save
          </TouchFeedbackButton>
          {step.id !== 'review' ? (
            <TouchFeedbackButton
              onClick={goNext}
              disabled={busy || loading}
              className="ml-auto flex-1 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm shadow-emerald-600/20 disabled:opacity-40"
            >
              Next
            </TouchFeedbackButton>
          ) : (
            <TouchFeedbackButton
              onClick={onSubmit}
              disabled={busy || loading}
              className="ml-auto flex-1 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm shadow-emerald-600/20 disabled:opacity-40"
            >
              {publishButtonLabel}
            </TouchFeedbackButton>
          )}
        </div>
      </div>

      {otpOpen ? (
        <PublishOtpModal
          userId={userId}
          centerId={resolvedCenterId}
          otpKey={otpKey}
          maskedEmail={maskedEmail}
          coachName={coachName}
          publicPathPreview={pathPreview}
          resending={otpResending}
          onVerified={onOtpVerified}
          onResend={onResendOtp}
          onClose={() => setOtpOpen(false)}
        />
      ) : null}
    </div>
  );
}
