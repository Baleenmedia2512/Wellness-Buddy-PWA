import React, { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import TouchFeedbackButton from '../../../shared/components/TouchFeedbackButton';
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
  savePortfolioDraft,
  submitPortfolioForm,
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
  VideoUploadField,
  YesNo,
} from './formFields';
import { openPublicCoachUrl, resolvePublicCoachUrl } from '../utils/publicCoachUrl';

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
export default function CoachPortfolioForm({ userId, onClose }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [form, setForm] = useState(emptyPortfolioForm);
  const [submissionStatus, setSubmissionStatus] = useState('draft');
  const [adminNote, setAdminNote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [publicPath, setPublicPath] = useState(null);
  const [isPublished, setIsPublished] = useState(false);
  const [hasClub, setHasClub] = useState(false);
  const [displayNameStatus, setDisplayNameStatus] = useState(''); // '', checking, available, taken, error

  const steps = getFormSteps({ hasClub });
  const step = steps[Math.min(stepIndex, steps.length - 1)] || steps[0];
  const canEdit = true;
  const isFirstSubmit = submissionStatus === 'draft' || submissionStatus === 'information_required';
  const placeFromClub = hasClub && Boolean(
    String(form.center.city || '').trim() || String(form.center.locality || '').trim(),
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setMessage('');
      try {
        const data = await fetchMyPortfolioSubmission(userId);
        if (cancelled) return;
        setForm(mergePortfolioForm(data?.form));
        setSubmissionStatus(data?.status || 'draft');
        setAdminNote(data?.adminNote || null);
        setPublicPath(data?.publicPath || null);
        setIsPublished(data?.isPublished === true);
        setHasClub(data?.hasClub === true);
        setStepIndex(0);
        setDisplayNameStatus('');
      } catch (err) {
        if (!cancelled) setMessage(err?.message || 'Could not load form');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  useEffect(() => {
    setStepIndex((i) => Math.min(i, Math.max(0, steps.length - 1)));
  }, [steps.length]);

  useEffect(() => {
    const name = String(form.mediaBrand.websiteDisplayName || '').trim();
    if (!name || loading) {
      setDisplayNameStatus('');
      return undefined;
    }
    let cancelled = false;
    setDisplayNameStatus('checking');
    const timer = setTimeout(async () => {
      try {
        const result = await checkPortfolioDisplayName({ userId, name });
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
  }, [form.mediaBrand.websiteDisplayName, userId, loading]);

  const saveDraft = async () => {
    if (displayNameStatus === 'taken') {
      setMessage('Website display name already exists — choose another');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const data = await savePortfolioDraft({ userId, form });
      setSubmissionStatus(data?.status || submissionStatus || 'draft');
      setPublicPath(data?.publicPath || publicPath);
      setIsPublished(data?.isPublished === true);
      setMessage(data?.publicPath
        ? `Saved — link ${data.publicPath}`
        : 'Saved — you can keep editing anytime');
    } catch (err) {
      setMessage(err?.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const goNext = () => {
    if (step.id === 'about') {
      const aboutErrors = validateAboutForm(form);
      if (aboutErrors.length) {
        setMessage(aboutErrors[0]);
        return;
      }
    }
    setMessage('');
    setStepIndex((i) => Math.min(steps.length - 1, i + 1));
  };

  const onSubmit = async () => {
    if (displayNameStatus === 'taken') {
      setMessage('Website display name already exists — choose another');
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
      const data = await submitPortfolioForm({ userId, form });
      setSubmissionStatus(data?.status || 'approved');
      setPublicPath(data?.publicPath || publicPath);
      setIsPublished(data?.isPublished === true || Boolean(data?.publicPath));
      setMessage(data?.publicPath
        ? `Published — ${data.publicPath}`
        : 'Published — you can keep editing anytime');
    } catch (err) {
      setMessage(err?.message || 'Submit failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#eef3ef]">
      <header className="sticky top-0 z-10 border-b border-slate-200/70 bg-white/90 backdrop-blur-md safe-top">
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
                My website
              </h1>
              <p className="text-xs text-slate-500">{step.description}</p>
            </div>
          </div>
          <Progress stepIndex={stepIndex} steps={steps} />
        </div>
      </header>

      <div className="mx-auto w-full max-w-lg flex-1 overflow-y-auto px-4 py-4 pb-32 space-y-4">
        {loading ? <p className="text-sm text-slate-500">Loading your form…</p> : null}

        {!loading && adminNote ? (
          <div className="rounded-2xl border border-amber-200/80 bg-amber-50 px-3.5 py-3 text-sm text-amber-950">
            <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700">Admin note</p>
            <p className="mt-1 leading-relaxed">{adminNote}</p>
          </div>
        ) : null}

        {!loading && step.id === 'hero' ? (
          <FormCard title="Hero" subtitle="Name, title, and place shown on your website">
            <div>
              <FieldLabel required hint="Must be unique — checked against other coach websites">
                Website Display Name
              </FieldLabel>
              <TextInput
                value={form.mediaBrand.websiteDisplayName}
                onChange={(v) => canEdit && setForm(setSection(form, 'mediaBrand', { websiteDisplayName: v }))}
                placeholder="Shown as the big name on the site"
              />
              {displayNameStatus === 'checking' ? (
                <p className="mt-1 text-[11px] text-slate-500">Checking name…</p>
              ) : null}
              {displayNameStatus === 'available' ? (
                <p className="mt-1 text-[11px] font-medium text-emerald-700">Name is available</p>
              ) : null}
              {displayNameStatus === 'taken' ? (
                <p className="mt-1 text-[11px] font-medium text-rose-600">
                  This name already exists — choose another
                </p>
              ) : null}
              {displayNameStatus === 'error' ? (
                <p className="mt-1 text-[11px] text-amber-700">Could not verify name right now</p>
              ) : null}
            </div>
            <div>
              <FieldLabel required hint="Shown as “Meet Your …” on About">
                Professional Title
              </FieldLabel>
              <SelectInput options={PROFESSIONAL_TITLES} value={form.personal.professionalTitle} onChange={(v) => canEdit && setForm(setSection(form, 'personal', { professionalTitle: v }))} />
            </div>
            {includesOther(form.personal.professionalTitle) ? (
              <div>
                <FieldLabel required>Please specify title</FieldLabel>
                <TextInput
                  value={form.personal.professionalTitleOther}
                  onChange={(v) => canEdit && setForm(setSection(form, 'personal', { professionalTitleOther: v }))}
                  placeholder="Type your professional title"
                />
              </div>
            ) : null}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <FieldLabel hint={placeFromClub ? 'From your club location' : 'Used in your public website URL'}>
                  City
                </FieldLabel>
                <TextInput
                  value={form.center.city}
                  disabled={placeFromClub || !canEdit}
                  onChange={(v) => canEdit && !placeFromClub && setForm(setSection(form, 'center', { city: v }))}
                  placeholder={hasClub ? 'Fetched from club GPS' : 'e.g. Coimbatore'}
                />
              </div>
              <div>
                <FieldLabel hint={placeFromClub ? 'Short area from club GPS (e.g. Adyar)' : 'Short area name only'}>
                  Area
                </FieldLabel>
                <TextInput
                  value={form.center.locality}
                  disabled={placeFromClub || !canEdit}
                  onChange={(v) => canEdit && !placeFromClub && setForm(setSection(form, 'center', { locality: v }))}
                  placeholder={hasClub ? 'e.g. Adyar' : 'e.g. Vadapalani'}
                />
              </div>
            </div>
            {hasClub && !placeFromClub ? (
              <p className="text-[11px] text-amber-700">
                Club found, but city/area could not be resolved from GPS yet. Save again later or check club location.
              </p>
            ) : null}
          </FormCard>
        ) : null}

        {!loading && step.id === 'about' ? (
          <FormCard title="About" subtitle="All fields required — shown on your public website">
            <div>
              <FieldLabel required hint="Shown exactly as typed under About (example: 8+ years coaching)">
                Years of experience
              </FieldLabel>
              <TextInput
                value={form.personal.yearsExperience}
                onChange={(v) => canEdit && setForm(setSection(form, 'personal', { yearsExperience: v }))}
                placeholder="8+ years coaching"
              />
            </div>
            <div>
              <FieldLabel required hint="Shown on your public About section">
                Who are you as a Wellness Professional
              </FieldLabel>
              <TextArea
                value={form.personal.background}
                onChange={(v) => canEdit && setForm(setSection(form, 'personal', { background: v }))}
                placeholder="Your story as a wellness professional — how you help people"
                rows={4}
              />
            </div>
            <div>
              <FieldLabel required hint="Shown on your public About section">
                What do you believe in
              </FieldLabel>
              <TextArea
                value={form.personal.uniqueApproach}
                onChange={(v) => canEdit && setForm(setSection(form, 'personal', { uniqueApproach: v }))}
                placeholder="The beliefs that guide your coaching"
                rows={3}
              />
            </div>
            <div>
              <FieldLabel required hint="Checklist line under About">
                Qualifications
              </FieldLabel>
              <TextInput
                value={form.personal.qualifications}
                onChange={(v) => canEdit && setForm(setSection(form, 'personal', { qualifications: v }))}
                placeholder="Certified nutrition coach · Habit coaching"
              />
            </div>
            <div>
              <FieldLabel required>Languages</FieldLabel>
              <MultiCheck
                options={LANGUAGES}
                value={form.personal.languages}
                onChange={(v) => canEdit && setForm(setSection(form, 'personal', { languages: v }))}
                disabled={!canEdit}
              />
              {includesOther(form.personal.languages) ? (
                <div className="mt-2">
                  <FieldLabel required>Other language</FieldLabel>
                  <TextInput
                    value={form.personal.languagesOther}
                    onChange={(v) => canEdit && setForm(setSection(form, 'personal', { languagesOther: v }))}
                    placeholder="Type language"
                  />
                </div>
              ) : null}
            </div>
          </FormCard>
        ) : null}

        {!loading && step.id === 'photos' ? (
          <FormCard title="Photos" subtitle="Albums visitors open on your site (Entrance, Interior, Activity)">
            <PhotoField
              label="Center Entrance Photo"
              value={form.mediaBrand.entrancePhoto}
              disabled={!canEdit}
              onUpload={(file) => uploadFormPhoto(userId, 'entrance', file)}
              onChange={(v) => canEdit && setForm(setSection(form, 'mediaBrand', { entrancePhoto: v }))}
            />
            <PhotoField
              label="Center Interior Photos"
              multiple
              values={form.mediaBrand.interiorPhotos}
              disabled={!canEdit}
              onUpload={(file) => uploadFormPhoto(userId, 'interior', file)}
              onChangeMultiple={(v) => canEdit && setForm(setSection(form, 'mediaBrand', { interiorPhotos: v }))}
            />
            <PhotoField
              label="Center Name Board Photo"
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

        {!loading && step.id === 'center' ? (
          <FormCard title="Hours" subtitle="Opening hours shown on your website">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <FieldLabel>Opening Time</FieldLabel>
                <TextInput type="time" value={form.timings.openingTime} onChange={(v) => canEdit && setForm(setSection(form, 'timings', { openingTime: v }))} />
              </div>
              <div>
                <FieldLabel>Closing Time</FieldLabel>
                <TextInput type="time" value={form.timings.closingTime} onChange={(v) => canEdit && setForm(setSection(form, 'timings', { closingTime: v }))} />
              </div>
            </div>
          </FormCard>
        ) : null}

        {!loading && step.id === 'review' ? (
          <FormCard
            title="Save your website"
            subtitle={hasClub ? 'Edit anytime — photos, hours, copy' : 'Edit anytime — photos and copy'}
          >
            <div className="space-y-3 text-sm text-slate-800">
              <div className="rounded-2xl bg-slate-50 px-3.5 py-3 space-y-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">From your app</p>
                {displayMediaUrl(form.personal.profilePhoto) ? (
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line jsx-a11y/alt-text -- decorative publish preview */}
                    <img
                      src={displayMediaUrl(form.personal.profilePhoto)}
                      alt=""
                      className="h-14 w-14 shrink-0 rounded-full border border-slate-200 object-cover bg-white"
                    />
                    <p className="text-xs font-semibold text-emerald-700">Profile photo</p>
                  </div>
                ) : (
                  <p className="text-xs text-amber-700">No profile photo in app yet</p>
                )}
                <div className="space-y-1">
                  <p><span className="font-semibold text-slate-900">Name:</span> {form.personal.fullName || '—'}</p>
                  <p><span className="font-semibold text-slate-900">Phone / WhatsApp:</span> {form.center.businessPhone || form.center.whatsapp || '—'}</p>
                  {hasClub ? (
                    <p><span className="font-semibold text-slate-900">Club:</span> {form.center.centerName || '—'}</p>
                  ) : null}
                </div>
              </div>
              <div className="rounded-2xl bg-slate-50 px-3.5 py-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Hero</p>
                <p className="mt-1 font-semibold">{form.mediaBrand.websiteDisplayName || form.personal.fullName || '—'}</p>
                <p className="text-slate-600">{form.personal.professionalTitle || '—'}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-3.5 py-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">About</p>
                <p className="mt-1 text-slate-600">{form.personal.yearsExperience || '—'}</p>
                <p className="mt-1 line-clamp-2 text-slate-600">
                  {form.personal.background || form.personal.uniqueApproach || 'No About copy yet'}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-3.5 py-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Programs</p>
                <p className="mt-1 text-slate-600">
                  {(form.services.offerings || []).length} default program(s)
                </p>
              </div>
              {publicPath ? (
                <a
                  href={isPublished ? (resolvePublicCoachUrl(publicPath) || publicPath) : undefined}
                  target={isPublished ? '_blank' : undefined}
                  rel={isPublished ? 'noreferrer' : undefined}
                  className="block rounded-2xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm font-semibold text-emerald-800"
                  onClick={isPublished
                    ? (e) => openPublicCoachUrl(publicPath, e)
                    : (e) => e.preventDefault()}
                >
                  {isPublished ? 'Live page: ' : 'Your link: '}{publicPath}
                </a>
              ) : null}
              {isFirstSubmit ? (
                <>
                  <label className="flex items-start gap-2.5 rounded-2xl border border-slate-200 bg-slate-50/80 px-3.5 py-3 text-sm text-slate-800">
                    <input
                      type="checkbox"
                      checked={form.goalsConsent.accuracyConfirmed === true}
                      onChange={(e) => canEdit && setForm(setSection(form, 'goalsConsent', { accuracyConfirmed: e.target.checked }))}
                      className="mt-0.5"
                    />
                    <span>I confirm that the information provided is accurate. *</span>
                  </label>
                  <div>
                    <FieldLabel required>Authorize use of photos and content for publication?</FieldLabel>
                    <YesNo value={form.goalsConsent.publishAuthorized} onChange={(v) => canEdit && setForm(setSection(form, 'goalsConsent', { publishAuthorized: v }))} />
                  </div>
                </>
              ) : (
                <p className="text-xs text-slate-500">
                  Live already. Save updates your public page anytime — no admin needed.
                </p>
              )}
            </div>
          </FormCard>
        ) : null}

        {message ? (
          <p className="rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700" role="status">
            {message}
          </p>
        ) : null}
      </div>

      <div className="fixed bottom-0 left-0 right-0 border-t border-slate-200/80 bg-white/95 backdrop-blur-md safe-bottom">
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
              onClick={isFirstSubmit ? onSubmit : saveDraft}
              disabled={busy || loading}
              className="ml-auto flex-1 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm shadow-emerald-600/20 disabled:opacity-40"
            >
              {isFirstSubmit ? 'Publish website' : 'Save changes'}
            </TouchFeedbackButton>
          )}
        </div>
      </div>
    </div>
  );
}
