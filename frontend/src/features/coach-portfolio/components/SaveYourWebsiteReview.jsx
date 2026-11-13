/**
 * Publish-step overview — visual match for the botanical "Save your website" reference.
 * Data is dynamic from the coach portfolio form; Save / Publish stay in the parent footer.
 */
import React, { useEffect } from 'react';
import {
  Briefcase,
  Building2,
  Check,
  CheckCircle2,
  Clock3,
  Globe2,
  MapPin,
  Phone,
  Send,
  ShieldCheck,
  Star,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import { includesOther } from '../domain/formOptions';
import {
  formatOpeningHoursSummary,
  resolveMapsUrls,
} from '../utils/reviewLocation';

const FONT_HREF =
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=Source+Sans+3:wght@400;500;600;700&display=swap';

function ensureReviewFonts() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('portfolio-review-fonts')) return;
  const link = document.createElement('link');
  link.id = 'portfolio-review-fonts';
  link.rel = 'stylesheet';
  link.href = FONT_HREF;
  document.head.appendChild(link);
}

function LeafMotif({ className = '', flip = false }) {
  return (
    <svg
      className={className}
      viewBox="0 0 120 140"
      fill="none"
      aria-hidden
      style={flip ? { transform: 'scaleX(-1)' } : undefined}
    >
      <path
        d="M58 132c-18-28-34-52-38-86 22 8 40 28 52 52-8 12-12 24-14 34z"
        fill="#2f6b4f"
        opacity="0.22"
      />
      <path
        d="M62 128c8-30 28-54 52-74-6 34-22 58-40 78-4-2-8-2-12-4z"
        fill="#3d8f68"
        opacity="0.28"
      />
      <path
        d="M54 118c-4-36 6-64 28-96-26 18-40 48-36 88-4 4-4 6 8 8z"
        fill="#1f5a42"
        opacity="0.18"
      />
      <path
        d="M60 20c2 28 2 56 0 98"
        stroke="#2f6b4f"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.35"
      />
    </svg>
  );
}

function WaveFooter({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 400 48" preserveAspectRatio="none" aria-hidden>
      <path
        d="M0 28c40-16 80-16 120 0s80 16 120 0 80-16 120 0v20H0V28z"
        fill="#2f6b4f"
        opacity="0.18"
      />
      <path
        d="M0 34c48-14 96-14 144 0s96 14 144 0 72-12 112 0v14H0V34z"
        fill="#3d8f68"
        opacity="0.22"
      />
    </svg>
  );
}

function MiniLeaves({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 36 16" fill="none" aria-hidden>
      <path d="M10 14c-4-6-6-10-4-14 6 2 8 6 8 12-2 1-3 2-4 2z" fill="#2f6b4f" opacity="0.55" />
      <path d="M18 14c0-8 4-12 10-14-2 8-4 12-8 14h-2z" fill="#3d8f68" opacity="0.55" />
      <path d="M14 14c-1-7 1-11 6-14-1 6-2 10-4 14h-2z" fill="#1f5a42" opacity="0.4" />
    </svg>
  );
}

/**
 * @param {{
 *   form: object,
 *   centerDisplayName?: string,
 *   profilePhotoUrl?: string | null,
 *   canEdit?: boolean,
 *   isPublished?: boolean,
 *   publicPath?: string | null,
 *   hasUnpublishedChanges?: boolean,
 *   onAccuracyChange: (checked: boolean) => void,
 *   onAuthorizeChange: (value: 'yes' | 'no') => void,
 *   onOpenLivePage?: (e: React.MouseEvent) => void,
 *   livePageHref?: string,
 * }} props
 */
export default function SaveYourWebsiteReview({
  form,
  centerDisplayName = '',
  profilePhotoUrl = null,
  canEdit = true,
  isPublished = false,
  publicPath = null,
  hasUnpublishedChanges = false,
  onAccuracyChange,
  onAuthorizeChange,
  onOpenLivePage,
  livePageHref,
}) {
  useEffect(() => {
    ensureReviewFonts();
  }, []);

  const personal = form?.personal || {};
  const center = form?.center || {};
  const timings = form?.timings || {};
  const consent = form?.goalsConsent || {};

  const coachName = String(personal.fullName || '').trim() || '—';
  const phone = String(center.businessPhone || center.whatsapp || '').trim() || '—';
  const clubName = String(center.centerName || centerDisplayName || '').trim() || '—';
  const centreName = String(centerDisplayName || center.centerName || '').trim() || '—';
  const city = String(center.city || '').trim() || '—';
  const area = String(center.locality || '').trim() || '—';

  const titleRaw = String(personal.professionalTitle || '').trim();
  const designation = includesOther(titleRaw)
    ? (String(personal.professionalTitleOther || '').trim() || 'Other')
    : (titleRaw || '—');
  const years = String(personal.yearsExperience || '').trim() || '—';
  const about = String(personal.background || '').trim() || '—';
  const hoursLabel = formatOpeningHoursSummary(timings);

  const maps = resolveMapsUrls({
    mapsLink: center.mapsLink,
    googleBusinessLink: center.googleBusinessLink,
    centerName: centreName !== '—' ? centreName : '',
    locality: area !== '—' ? area : '',
    city: city !== '—' ? city : '',
    address: center.address,
  });

  const authorized = String(consent.publishAuthorized || '');

  return (
    <div
      className="relative overflow-hidden rounded-[22px] border border-[#d7e5dc] shadow-[0_10px_30px_rgba(15,23,42,0.04)]"
      style={{
        background: 'linear-gradient(180deg, #f7f3ea 0%, #f3efe4 55%, #eef6f0 100%)',
        fontFamily: "'Source Sans 3', 'Segoe UI', sans-serif",
        color: '#1f3b2e',
      }}
    >
      <LeafMotif className="pointer-events-none absolute -left-2 -top-1 h-16 w-14 opacity-80" />
      <LeafMotif className="pointer-events-none absolute -right-1 top-6 h-14 w-12 opacity-70" flip />
      <LeafMotif className="pointer-events-none absolute -left-3 bottom-12 h-14 w-12 opacity-55" />
      <WaveFooter className="pointer-events-none absolute inset-x-0 bottom-0 h-7 w-full" />

      <div className="relative z-[1] space-y-3 px-3.5 pb-5 pt-4">
        <header className="flex flex-col items-center text-center">
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-[#2f6b4f] shadow-sm shadow-[#2f6b4f]/30">
            <span className="relative inline-flex">
              <Globe2 className="h-5 w-5 text-[#f7f3ea]" strokeWidth={1.75} />
              <CheckCircle2 className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-[#2f6b4f] text-[#b7e4c7]" />
            </span>
          </div>
          <h2
            className="text-[26px] leading-tight tracking-tight text-[#1f5a42]"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 700 }}
          >
            Save your website
          </h2>
          <p className="mt-1.5 max-w-[18rem] text-[13px] leading-snug text-[#5f7268]">
            Review your details before publishing your professional website
          </p>
          <MiniLeaves className="mt-1.5 h-3 w-7" />
        </header>

        {/* Developer / coach information */}
        <section className="rounded-2xl border border-[#e4ebe4] bg-white p-3.5 shadow-sm">
          <div className="flex gap-3">
            <div className="shrink-0">
              {profilePhotoUrl ? (
                <img
                  src={profilePhotoUrl}
                  alt=""
                  className="h-14 w-14 rounded-full border-2 border-[#dceadf] object-cover"
                />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-[#dceadf] bg-[#eef5f0]">
                  <UserRound className="h-6 w-6 text-[#2f6b4f]" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h3
                className="text-[17px] font-semibold text-[#1f5a42]"
                style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
              >
                Developer Information
              </h3>
              <ul className="mt-1.5 space-y-1.5 text-[14px] text-[#31453c]">
                <li className="flex items-start gap-2">
                  <UserRound className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#2f6b4f]" />
                  <span><span className="font-semibold">Name</span> {coachName}</span>
                </li>
                <li className="flex items-start gap-2">
                  <Phone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#2f6b4f]" />
                  <span><span className="font-semibold">Phone / WhatsApp</span> {phone}</span>
                </li>
                <li className="flex items-start gap-2">
                  <Users className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#2f6b4f]" />
                  <span><span className="font-semibold">Club</span> {clubName}</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-3 flex gap-2.5 rounded-xl bg-[#e7f0e8] px-3 py-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#2f6b4f] text-white">
              <Briefcase className="h-4 w-4" />
            </div>
            <div className="min-w-0 space-y-0.5">
              <p className="text-[15px] font-bold text-[#1f3b2e]">{coachName}</p>
              <p className="text-[14px] font-semibold text-[#2f6b4f]">{designation}</p>
              <p className="flex items-center gap-1.5 text-[13px] font-medium text-[#3d5c4d]">
                <Star className="h-3.5 w-3.5 fill-[#2f6b4f] text-[#2f6b4f]" />
                {years}
              </p>
              <p className="pt-0.5 text-[13px] leading-snug text-[#4a5f54] line-clamp-3">
                {about}
              </p>
            </div>
          </div>
        </section>

        {/* Location — below developer card */}
        <section className="rounded-2xl border border-[#e4ebe4] bg-white p-3.5 shadow-sm">
          <div className="mb-2.5 flex items-center gap-2 border-b border-[#e7efe9] pb-2">
            <h3
              className="flex-1 text-[17px] font-semibold text-[#1f5a42]"
              style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
            >
              Location Details
            </h3>
            <MiniLeaves className="h-3.5 w-8 shrink-0" />
          </div>

          <div className="space-y-2.5">
            <div className="space-y-2">
              <p className="flex items-start gap-2 text-[14px] text-[#31453c]">
                <Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#2f6b4f]" />
                <span><span className="font-semibold">Centre :</span> {centreName}</span>
              </p>
              <p className="flex items-start gap-2 text-[14px] text-[#31453c]">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#2f6b4f]" />
                <span><span className="font-semibold">City :</span> {city}</span>
              </p>
              <p className="flex items-start gap-2 text-[14px] text-[#31453c]">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#2f6b4f]" />
                <span><span className="font-semibold">Area :</span> {area}</span>
              </p>

              {hoursLabel ? (
                <div className="flex items-center gap-2 rounded-xl bg-[#f3f6f3] px-3 py-2.5 text-[13px] font-medium text-[#31453c]">
                  <Clock3 className="h-3.5 w-3.5 shrink-0 text-[#2f6b4f]" />
                  <span>{hoursLabel}</span>
                </div>
              ) : null}
            </div>

            <div className="overflow-hidden rounded-xl border border-[#dce6df] bg-[#eef3ef]">
              {maps.embedUrl ? (
                <iframe
                  title="Centre location map"
                  src={maps.embedUrl}
                  className="h-[140px] w-full border-0"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  allowFullScreen
                />
              ) : (
                <div className="flex h-[120px] flex-col items-center justify-center gap-1.5 px-3 text-center text-[13px] text-[#5f7268]">
                  <MapPin className="h-5 w-5 text-[#2f6b4f]" />
                  <span>Map preview appears after City & Area are set</span>
                </div>
              )}
            </div>

            {maps.openUrl ? (
              <a
                href={maps.openUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#2f6b4f] px-3 py-3 text-[14px] font-semibold text-white"
              >
                <Send className="h-3.5 w-3.5" />
                View on Google Maps →
              </a>
            ) : (
              <p className="rounded-xl bg-amber-50 px-3 py-2 text-[13px] font-medium text-amber-800">
                Map link not set yet — pick City & Area on the earlier step
              </p>
            )}
          </div>
        </section>

        {isPublished && publicPath && livePageHref ? (
          <a
            href={livePageHref}
            target="_blank"
            rel="noreferrer"
            onClick={onOpenLivePage}
            className="block rounded-2xl border border-[#b7d7c4] bg-[#e7f4ec] px-3 py-3 text-center text-[14px] font-semibold text-[#1f5a42]"
          >
            Open live page
          </a>
        ) : null}

        {isPublished && hasUnpublishedChanges ? (
          <p className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[13px] font-medium text-amber-900">
            Unpublished changes — live page still shows the last published version until you Publish changes.
          </p>
        ) : null}

        {/* Confirmation */}
        <section className="space-y-2.5">
          <label
            className={`flex cursor-pointer items-start gap-2.5 rounded-2xl border px-3.5 py-3 ${
              consent.accuracyConfirmed
                ? 'border-[#9fcdb4] bg-[#e7f4ec]'
                : 'border-[#d7e2da] bg-[#f4f7f4]'
            }`}
          >
            <span
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                consent.accuracyConfirmed
                  ? 'border-[#2f6b4f] bg-[#2f6b4f] text-white'
                  : 'border-[#9aaf9f] bg-white'
              }`}
            >
              {consent.accuracyConfirmed ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : null}
            </span>
            <input
              type="checkbox"
              className="sr-only"
              checked={consent.accuracyConfirmed === true}
              disabled={!canEdit}
              onChange={(e) => onAccuracyChange?.(e.target.checked)}
            />
            <span className="text-[14px] leading-snug text-[#31453c]">
              I confirm that the information provided is accurate.
              <span className="ml-0.5 text-rose-500">*</span>
            </span>
          </label>

          <div>
            <p className="mb-2 text-[14px] font-semibold text-[#1f3b2e]">
              Authorize use of photos and content for publication?
              <span className="ml-0.5 text-rose-500">*</span>
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={!canEdit}
                onClick={() => onAuthorizeChange?.('yes')}
                className={`inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-3 text-[14px] font-semibold transition ${
                  authorized === 'yes'
                    ? 'bg-[#2f6b4f] text-white shadow-sm shadow-[#2f6b4f]/25'
                    : 'border border-[#cfd9d3] bg-white text-[#6b7c73]'
                } disabled:opacity-60`}
              >
                <Check className="h-4 w-4" strokeWidth={2.5} />
                Yes
              </button>
              <button
                type="button"
                disabled={!canEdit}
                onClick={() => onAuthorizeChange?.('no')}
                className={`inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-3 text-[14px] font-semibold transition ${
                  authorized === 'no'
                    ? 'bg-[#5b6a62] text-white'
                    : 'border border-[#cfd9d3] bg-white text-[#6b7c73]'
                } disabled:opacity-60`}
              >
                <X className="h-4 w-4" strokeWidth={2.5} />
                No
              </button>
            </div>
          </div>
        </section>

        <p className="flex items-start justify-center gap-1.5 px-1 text-center text-[12px] leading-snug text-[#5f7268]">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#2f6b4f]" />
          <span>
            Save keeps a draft only. Publish emails a verification OTP to your coach.
          </span>
        </p>
      </div>
    </div>
  );
}
