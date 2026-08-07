/**
 * CoachTestimonialsPage.jsx
 * Unified testimonials card view for every user.
 *
 * Unified per-member card shows ALL 5 slots:
 *   • Before photo · After photo · Health video · Business video · Recovered health issues
 *
 * With downline: Mine | Direct | Full + search + upload filters.
 * Without downline: own card only (no Direct/Full/search/filters).
 *
 * Video playback: Instagram-style tap-to-play inline modal.
 */
import React, { useEffect, useCallback, useState, useMemo, useRef } from 'react';
import {
  AlertCircle, ArrowLeft, Camera, CheckCircle, CircleDot, Clock,
  Images, Mail, Pencil, Plus, RefreshCw, Save, Share2, ShieldCheck, Upload, Users, Video,
  Play, X, HeartPulse, Maximize2, TrendingDown, TrendingUp,
} from 'lucide-react';
import TouchFeedbackButton from '../../../shared/components/TouchFeedbackButton';
import NativeInput from '../../../shared/components/NativeInput.jsx';
import LoadingSpinner from '../../../shared/components/LoadingSpinner';
import {
  listForCoach, getMyTestimonial, getMyVideoTestimonial, getTeamTestimonialReport,
  getTestimonialDetail, submitAllEdits, verifyUnifiedOtp, prepareTestimonialVideoUpload,
} from '../services/testimonialApi.js';
import { uploadTestimonialVideoInChunks } from '../services/testimonialVideoUpload.js';
import TestimonialSearchBar from './TestimonialSearchBar.jsx';
import OtpInline from './OtpInline.jsx';
import VideoThumbnailCard from './VideoThumbnailCard.jsx';
import DiseaseMultiSelect from './DiseaseMultiSelect.jsx';
import TransformationShareCard from './TransformationShareCard.jsx';
import { compressImage } from '../hooks/useTestimonial.js';
import { setCaptureFlowBusy } from '../../../shared/services/captureFlowBusy';
import {
  UPLOAD_FILTERS,
  TEAM_SCOPES,
  computeMemberCompleteness,
  toggleStatusFilter,
} from '../utils/testimonialFilters.js';
import {
  buildSearchSuggestions,
  normalizeSearchQuery,
} from '../utils/testimonialSearch.js';
import { PORTRAIT_IMAGE_CLASS_SM } from '../services/testimonialFormUtils.js';
import { resolveRowTeamUploadPerformance } from '../utils/testimonialTeamPerformance.js';
import { getApiBaseUrl } from '../../../config/api.config.js';

// â”€â”€ Constants â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const TEAM_SCOPE_OPTIONS = [
  { value: TEAM_SCOPES.MINE,   label: 'Mine',        short: 'Mine'   },
  { value: TEAM_SCOPES.DIRECT, label: 'Direct Team', short: 'Direct' },
  { value: TEAM_SCOPES.FULL,   label: 'Full Team',   short: 'Full'   },
];

const UPLOAD_FILTER_CFG = {
  [UPLOAD_FILTERS.FULLY_UPLOADED]: {
    label: 'Fully Uploaded',
    Icon: CheckCircle,
    badgeCls: 'bg-green-100 text-green-800 border-green-200',
    base: 'bg-green-100 text-green-800',
    active: 'bg-green-600 text-white shadow-sm ring-2 ring-green-300',
  },
  [UPLOAD_FILTERS.PARTIAL]: {
    label: 'Partial',
    Icon: CircleDot,
    badgeCls: 'bg-amber-100 text-amber-800 border-amber-200',
    base: 'bg-amber-100 text-amber-800',
    active: 'bg-amber-600 text-white shadow-sm ring-2 ring-amber-300',
  },
  [UPLOAD_FILTERS.NOT_UPLOADED]: {
    label: 'Not Uploaded',
    Icon: AlertCircle,
    badgeCls: 'bg-gray-100 text-gray-500 border-gray-200',
    base: 'bg-gray-100 text-gray-600',
    active: 'bg-gray-700 text-white shadow-sm ring-2 ring-gray-400',
  },
};

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function formatPercentage(value) { return Number(value ?? 0).toFixed(1); }

function teamComplianceColorClass(scoreNum) {
  if (scoreNum >= 80) return 'text-green-700';
  if (scoreNum >= 50) return 'text-amber-700';
  return 'text-red-700';
}

// â”€â”€ Instagram-style Video Player Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function VideoPlayerModal({ url, title, onClose }) {
  const videoRef = useRef(null);

  useEffect(() => {
    videoRef.current?.play().catch(() => {/* autoplay blocked */});
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[90] bg-black flex flex-col"
      role="dialog"
      aria-label={`Playing ${title}`}
      onClick={onClose}
    >
      <div
        className="flex items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-3 z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-white text-sm font-semibold truncate flex-1">{title}</p>
        <button
          type="button"
          onClick={onClose}
          className="ml-3 p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
          aria-label="Close video"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div
        className="flex-1 flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          ref={videoRef}
          src={url}
          controls
          playsInline
          autoPlay
          className="max-h-full max-w-full object-contain rounded-xl"
          style={{ maxHeight: 'calc(100vh - 120px)' }}
        />
      </div>
      <div className="pb-[max(1.5rem,env(safe-area-inset-bottom))]" />
    </div>
  );
}

// â”€â”€ Video play button â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// VideoThumbnailBtn replaced by VideoThumbnailCard (imported above)
// â”€â”€ Upload completeness badge â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function CompletenessBadge({ level, filledCount, totalSlots }) {
  const cfg = UPLOAD_FILTER_CFG[level] ?? UPLOAD_FILTER_CFG[UPLOAD_FILTERS.NOT_UPLOADED];
  const { label, Icon, badgeCls } = cfg;
  const text =
    level === UPLOAD_FILTERS.NOT_UPLOADED ? label : `${label} (${filledCount}/${totalSlots})`;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${badgeCls}`}>
      <Icon className="h-3 w-3 shrink-0" />
      {text}
    </span>
  );
}

// â”€â”€ Team compliance â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function TeamComplianceInline({ userName, teamStats, onComplianceClick }) {
  if (!teamStats?.totalMembers) {
    return <p className="font-semibold text-gray-900 text-sm truncate">{userName}</p>;
  }
  const scoreNum   = Number(teamStats.uploadPercentage ?? 0);
  const colorClass = teamComplianceColorClass(scoreNum);
  const uploaded   = teamStats.uploaded ?? teamStats.uploadedMembers?.length ?? 0;
  return (
    <p className="text-sm font-medium flex items-baseline gap-2 min-w-0 flex-wrap">
      <span className="font-semibold text-gray-900 truncate">{userName}</span>
      <button
        type="button"
        onClick={onComplianceClick}
        className={`text-[11px] whitespace-nowrap flex-shrink-0 cursor-pointer underline-offset-2 hover:underline ${colorClass}`}
      >
        Team {formatPercentage(teamStats.uploadPercentage)}% ({uploaded}/{teamStats.totalMembers})
      </button>
    </p>
  );
}

function TeamComplianceModal({ userName, teamStats, onClose }) {
  const scoreColor  = teamComplianceColorClass(Number(teamStats.uploadPercentage ?? 0));
  const uploaded    = teamStats.uploaded    ?? teamStats.uploadedMembers?.length ?? 0;
  const total       = teamStats.totalMembers ?? 0;
  const notUploaded = total - uploaded;

  return (
    <div className="fixed inset-0 z-[70] ios-full-page bg-gray-50" role="dialog" aria-labelledby="tc-title">
      <header className="flex-shrink-0 bg-white border-b border-gray-200 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
        <div className="flex items-center gap-3">
          <TouchFeedbackButton onClick={onClose} className="p-2 -ml-2 rounded-full text-gray-600 hover:text-gray-900" ariaLabel="Back">
            <ArrowLeft className="h-5 w-5" />
          </TouchFeedbackButton>
          <div className="min-w-0 flex-1">
            <h2 id="tc-title" className="text-base font-bold text-gray-800 truncate">Team Compliance</h2>
            <p className="text-xs text-gray-500 truncate">{userName}</p>
          </div>
        </div>
      </header>
      <div className="ios-scroll-body px-4 py-4 space-y-3">
        <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-1">
          <p className={`text-2xl font-bold ${scoreColor}`}>{formatPercentage(teamStats.uploadPercentage)}%</p>
          <p className="text-sm text-gray-500">Team upload rate Â· {uploaded}/{total} members</p>
        </div>
        {(teamStats.uploadedMembers?.length > 0) && (
          <div className="bg-white rounded-2xl border border-green-200 p-3">
            <p className="text-xs font-bold text-green-800 mb-2">Uploaded ({uploaded})</p>
            <ul className="space-y-0.5">
              {teamStats.uploadedMembers.map((m) => (
                <li key={m.userId} className="text-xs text-green-700 font-medium truncate">{m.userName}</li>
              ))}
            </ul>
          </div>
        )}
        {(teamStats.notUploadedMembers?.length > 0) && (
          <div className="bg-white rounded-2xl border border-red-200 p-3">
            <p className="text-xs font-bold text-red-800 mb-2">Not Uploaded ({notUploaded})</p>
            <ul className="space-y-0.5">
              {teamStats.notUploadedMembers.map((m) => (
                <li key={m.userId} className="text-xs text-red-700 font-medium truncate">{m.userName}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function TeamComplianceSection({ userName, teamStats }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <TeamComplianceInline userName={userName} teamStats={teamStats} onComplianceClick={() => setOpen(true)} />
      {open && teamStats?.totalMembers && (
        <TeamComplianceModal userName={userName} teamStats={teamStats} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

/** Avatar via dedicated endpoint — keeps list-for-coach JSON tiny. */
function MemberAvatar({ user }) {
  const [failed, setFailed] = useState(false);
  const userId = user?.userId;
  const inline = user?.profileImage;
  let remote = null;
  try {
    if (userId != null && !failed && !inline) {
      remote = `${getApiBaseUrl()}/api/user/avatar?userId=${encodeURIComponent(userId)}`;
    }
  } catch {
    remote = null;
  }
  const src = !failed ? (inline || remote) : null;

  if (src) {
    return (
      <img
        src={src}
        alt={user?.userName || 'User'}
        className="h-11 w-11 rounded-full object-cover border-2 border-white shadow flex-shrink-0"
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div className="h-11 w-11 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center text-white font-bold text-base shadow flex-shrink-0">
      {(user?.userName || '?').charAt(0).toUpperCase()}
    </div>
  );
}

// â”€â”€ Photo viewer modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function PhotoModal({ url, label, onClose }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[80] bg-black/90 flex flex-col items-center justify-center"
      onClick={onClose}
    >
      <div className="relative" onClick={(e) => e.stopPropagation()}>
        <img src={url} alt={label} className="max-h-[85vh] max-w-[95vw] object-contain rounded-xl" />
        <button
          type="button"
          onClick={onClose}
          className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 text-white hover:bg-black/70"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
        <p className="text-center text-white text-xs font-semibold mt-2 px-2">{label}</p>
      </div>
    </div>
  );
}

// â”€â”€ Upload completeness filter chip â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function UploadFilterChip({ filterKey, count, activeFilter, onToggle }) {
  const isActive = activeFilter === filterKey;
  const { label, Icon, base, active } = UPLOAD_FILTER_CFG[filterKey];
  return (
    <button
      type="button"
      onClick={() => onToggle(filterKey)}
      aria-pressed={isActive}
      className={`flex-shrink-0 rounded-full px-3 py-1 text-xs font-bold transition-all duration-150 cursor-pointer whitespace-nowrap ${
        isActive ? active : base
      }`}
    >
      <span className="inline-flex items-center gap-1">
        <Icon className="h-3 w-3 shrink-0" />
        {label} ({count})
      </span>
    </button>
  );
}

// â”€â”€ Per-member unified card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€


// ── Unified OTP entry (after submit-all-edits) ────────────────────────────────

function UnifiedOtpInline({ userId, onVerified }) {
  const [otp,     setOtp]     = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [err,     setErr]     = React.useState(null);

  const submit = async () => {
    setErr(null);
    if (!/^\d{6}$/.test(otp.trim())) { setErr('Enter the 6-digit OTP from your sponsor'); return; }
    setLoading(true);
    try {
      await verifyUnifiedOtp({ userId, otp: otp.trim() });
      onVerified();
    } catch (e) {
      setErr(e.message || 'Invalid OTP. Please check with your sponsor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-amber-600 shrink-0" />
        <p className="text-sm font-semibold text-amber-800">Enter OTP from your sponsor</p>
      </div>
      <p className="text-xs text-amber-700 leading-relaxed">
        Your sponsor received a single 6-digit OTP covering all your changes. Ask them to share it.
      </p>
      <NativeInput
        otp
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        maxLength={6}
        placeholder="_ _ _ _ _ _"
        value={otp}
        onChange={(e) => { setOtp(e.target.value.replace(/\D/g, '').slice(0, 6)); setErr(null); }}
        className="w-full text-center text-2xl font-bold tracking-[0.4em] border-2 border-amber-300 rounded-xl py-3 focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
      />
      {err && <p className="text-xs text-red-600 text-center">{err}</p>}
      <TouchFeedbackButton
        onClick={submit}
        disabled={loading || otp.length !== 6}
        className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold disabled:opacity-60 transition-colors"
      >
        {loading ? 'Verifying\u2026' : 'Verify with OTP'}
      </TouchFeedbackButton>
    </div>
  );
}

function MemberCard({
  row,
  teamStats,
  editable = false,
  userId = null,
  coachId = null,
  onOtpVerified,
}) {
  const { user } = row;
  const [detailTestimonial, setDetailTestimonial] = useState(null);
  const detailInFlightRef = useRef(null);
  const testimonial = detailTestimonial || row.testimonial;
  const { level, filledCount, totalSlots } = computeMemberCompleteness({
    ...row,
    testimonial,
  });

  const ensureDetail = useCallback(async () => {
    if (detailTestimonial) return detailTestimonial;
    if (editable) return row.testimonial; // Mine already has full my-testimonial payload
    const memberId = row.user?.userId;
    if (!memberId) return row.testimonial;
    if (detailInFlightRef.current) return detailInFlightRef.current;
    const promise = getTestimonialDetail(memberId, coachId)
      .then((data) => {
        const full = data?.testimonial || null;
        setDetailTestimonial(full);
        return full;
      })
      .finally(() => {
        detailInFlightRef.current = null;
      });
    detailInFlightRef.current = promise;
    return promise;
  }, [detailTestimonial, editable, row, coachId]);

  // Lazy-load full media when list row only has thumbs / video paths.
  useEffect(() => {
    if (editable) return undefined;
    const t = row.testimonial;
    if (!t) return undefined;
    const needsVideo = (t.healthVideoPath || t.businessVideoPath)
      && !t.healthVideoUrl && !t.businessVideoUrl;
    if (needsVideo) {
      void ensureDetail();
    }
    return undefined;
  }, [editable, row.testimonial, ensureDetail]);

  const [expandedPhoto, setExpandedPhoto] = useState(null);
  const hasAfter  = testimonial?.afterImageUrl  && testimonial?.status !== 'incomplete';
  const issues    = testimonial?.recoveredHealthIssues ?? [];

  // ── Inline editing state (Mine card only) ────────────────────────────────
  const [expandedSlots, setExpandedSlots] = useState(new Set());
  const [draftBefore,   setDraftBefore]   = useState(null); // { imageBase64, previewUrl, weightKg, goalType, durationText }
  const [draftAfter,    setDraftAfter]    = useState(null); // { imageBase64, previewUrl, weightKg }
  const [draftHealthPath,    setDraftHealthPath]    = useState(null);
  const [draftBusinessPath,  setDraftBusinessPath]  = useState(null);
  const [draftHealthPreview,   setDraftHealthPreview]   = useState(null);
  const [draftBusinessPreview, setDraftBusinessPreview] = useState(null);
  const [draftIssues,   setDraftIssues]   = useState(null);
  const [uploadingHealth,   setUploadingHealth]   = useState(false);
  const [uploadingBusiness, setUploadingBusiness] = useState(false);
  const [pickerSlot,        setPickerSlot]         = useState(null); // 'before' | 'after' | null
  const [isSubmitting,    setIsSubmitting]    = useState(false);
  const [submitError,     setSubmitError]     = useState(null);
  const [videoUploadError,setVideoUploadError]= useState(null);
  const [submitDone,      setSubmitDone]      = useState(false);
  const [unifiedOtpVerified, setUnifiedOtpVerified] = useState(false);
  const [showShareCard,   setShowShareCard]   = useState(false);

  const beforeCamRef   = useRef(null);
  const beforeGalRef   = useRef(null);
  const afterCamRef    = useRef(null);
  const afterGalRef    = useRef(null);
  const healthVidRef   = useRef(null);
  const businessVidRef = useRef(null);

  // dirtySlots: only include 'before'/'after' when new IMAGE was selected
  // weight/goal/duration-only changes still trigger Submit but don't appear in email photo diff
  const dirtySlots = [
    draftBefore?.imageBase64 && 'before',
    draftAfter?.imageBase64  && 'after',
    draftHealthPath          && 'health',
    draftBusinessPath        && 'business',
    draftIssues !== null     && 'issues',
  ].filter(Boolean);
  // hasDirtySlots: true for ANY pending change including weight-only edits
  const hasDirtySlots = dirtySlots.length > 0 || !!draftBefore || !!draftAfter;
  const anyVideoUploading = uploadingHealth || uploadingBusiness;

  // Prefer draft edits so the "Lost/Gained X kgs" badge updates live while editing
  const displayBeforeKg = Number(draftBefore?.weightKg ?? testimonial?.beforeWeightKg ?? 0);
  const displayAfterKg  = Number(draftAfter?.weightKg ?? (hasAfter ? testimonial?.afterWeightKg : 0) ?? 0);
  const displayGoalType = draftBefore?.goalType ?? testimonial?.goalType;
  const displayDuration = draftBefore?.durationText ?? testimonial?.durationText;
  const diff = testimonial && hasAfter && displayBeforeKg > 0 && displayAfterKg > 0
    ? Math.abs(displayAfterKg - displayBeforeKg).toFixed(1)
    : null;

  const toggleSlot = useCallback((slot) => {
    setExpandedSlots(prev => {
      const next = new Set(prev);
      if (next.has(slot)) next.delete(slot); else next.add(slot);
      return next;
    });
  }, []);

  const handleImageFile = useCallback((slot, file) => {
    if (!file) return;
    // Instant local preview — do not wait for FileReader / compression.
    const objectUrl = URL.createObjectURL(file);
    const beforeBase = {
      weightKg: testimonial?.beforeWeightKg,
      goalType: testimonial?.goalType,
      durationText: testimonial?.durationText,
    };
    const afterBase = { weightKg: testimonial?.afterWeightKg };

    if (slot === 'before') {
      setDraftBefore((prev) => ({
        ...(prev || beforeBase),
        previewUrl: objectUrl,
        imageBase64: null,
        compressing: true,
      }));
    } else {
      setDraftAfter((prev) => ({
        ...(prev || afterBase),
        previewUrl: objectUrl,
        imageBase64: null,
        compressing: true,
      }));
    }
    setPickerSlot(null);
    setSubmitError(null);
    setCaptureFlowBusy(true);

    void compressImage(file)
      .then(({ base64, preview }) => {
        if (slot === 'before') {
          setDraftBefore((prev) => {
            if (!prev) return prev;
            return { ...prev, imageBase64: base64, previewUrl: preview, compressing: false };
          });
        } else {
          setDraftAfter((prev) => {
            if (!prev) return prev;
            return { ...prev, imageBase64: base64, previewUrl: preview, compressing: false };
          });
        }
        URL.revokeObjectURL(objectUrl);
      })
      .catch((err) => {
        URL.revokeObjectURL(objectUrl);
        if (slot === 'before') setDraftBefore(null);
        else setDraftAfter(null);
        setSubmitError(err?.message || 'Could not read that photo. Please try another.');
      })
      .finally(() => {
        setCaptureFlowBusy(false);
      });
  }, [testimonial]);

  const handleVideoFile = useCallback(async (slot, file) => {
    const numericUserId = Number(userId);
    if (!numericUserId) {
      setVideoUploadError('Cannot upload video: user ID is missing. Please refresh the page.');
      return;
    }
    setVideoUploadError(null);
    const localUrl = URL.createObjectURL(file);
    if (slot === 'health')    { setDraftHealthPreview(localUrl);   setUploadingHealth(true);   }
    else                      { setDraftBusinessPreview(localUrl); setUploadingBusiness(true); }
    try {
      const prep = await prepareTestimonialVideoUpload({
        userId:         numericUserId,
        uploadHealth:   slot === 'health',
        uploadBusiness: slot === 'business',
      });
      const info = slot === 'health' ? prep?.health : prep?.business;
      if (!info?.path || !info?.sessionId) {
        throw new Error('Server did not return a valid upload path. Please try again.');
      }
      const path = await uploadTestimonialVideoInChunks(file, info, slot, numericUserId);
      if (slot === 'health') setDraftHealthPath(path);
      else                   setDraftBusinessPath(path);
    } catch (err) {
      const msg = err?.message || '';
      const isNoCoach = msg.toLowerCase().includes('no coach');
      setVideoUploadError(
        isNoCoach
          ? 'You do not have a sponsor assigned yet. Please ask your admin to assign a sponsor before uploading videos.'
          : (msg || 'Video upload failed. Please try again.')
      );
      if (slot === 'health') { setDraftHealthPreview(null); setDraftHealthPath(null); }
      else                   { setDraftBusinessPreview(null); setDraftBusinessPath(null); }
    } finally {
      if (slot === 'health') setUploadingHealth(false);
      else                   setUploadingBusiness(false);
    }
  }, [userId]);

  const handleSubmitAll = useCallback(() => {
    const needsOtp = dirtySlots.some((s) => ['before', 'after', 'health', 'business'].includes(s));
    // Photos still compressing — wait so we do not submit without image bytes.
    if (draftBefore?.compressing || draftAfter?.compressing) {
      setSubmitError('Photo is still preparing — try Submit again in a moment.');
      return;
    }
    if (draftBefore?.previewUrl && draftBefore.imageBase64 == null && !draftBefore.compressing) {
      setSubmitError('Before photo failed to prepare. Please pick it again.');
      return;
    }
    if (draftAfter?.previewUrl && draftAfter.imageBase64 == null && !draftAfter.compressing) {
      setSubmitError('After photo failed to prepare. Please pick it again.');
      return;
    }

    const payload = {
      userId,
      dirtySlots,
      ...(draftBefore ? {
        ...(draftBefore.imageBase64 ? { beforeImageBase64: draftBefore.imageBase64 } : {}),
        ...(draftBefore.weightKg !== undefined ? { beforeWeightKg: draftBefore.weightKg } : {}),
        ...(draftBefore.goalType ? { goalType: draftBefore.goalType } : {}),
        ...(draftBefore.durationText ? { durationText: draftBefore.durationText } : {}),
      } : {}),
      ...(draftAfter ? {
        ...(draftAfter.imageBase64 ? { afterImageBase64: draftAfter.imageBase64 } : {}),
        ...(draftAfter.weightKg !== undefined ? { afterWeightKg: draftAfter.weightKg } : {}),
      } : {}),
      ...(draftHealthPath ? { healthVideoPath: draftHealthPath } : {}),
      ...(draftBusinessPath ? { businessVideoPath: draftBusinessPath } : {}),
      ...(draftIssues !== null ? { recoveredHealthIssues: draftIssues } : {}),
    };

    const clearDrafts = () => {
      setDraftBefore(null);
      setDraftAfter(null);
      setDraftHealthPath(null);
      setDraftBusinessPath(null);
      setDraftHealthPreview(null);
      setDraftBusinessPreview(null);
      setDraftIssues(null);
      setExpandedSlots(new Set());
    };

    setSubmitError(null);

    // Weight / issues only — close dirty UI immediately; save in background.
    if (!needsOtp) {
      clearDrafts();
      void submitAllEdits(payload)
        .then(() => {
          onOtpVerified?.();
        })
        .catch((err) => {
          setSubmitError(err?.message || 'Failed to save. Please try again.');
        });
      return;
    }

    // Photo / video changes need server ack before OTP UI.
    setIsSubmitting(true);
    setCaptureFlowBusy(true);
    void submitAllEdits(payload)
      .then(() => {
        clearDrafts();
        setSubmitDone(true);
      })
      .catch((err) => {
        setSubmitError(err?.message || 'Failed to submit. Please try again.');
      })
      .finally(() => {
        setIsSubmitting(false);
        setCaptureFlowBusy(false);
      });
  }, [userId, dirtySlots, draftBefore, draftAfter, draftHealthPath, draftBusinessPath, draftIssues, onOtpVerified]);

  const anyPhotoCompressing = Boolean(draftBefore?.compressing || draftAfter?.compressing);

  const handleUnifiedOtpVerified = useCallback(() => {
    setSubmitDone(false);
    setUnifiedOtpVerified(true);
    onOtpVerified?.();
  }, [onOtpVerified]);


  const borderCls =
    level === UPLOAD_FILTERS.FULLY_UPLOADED ? 'border-green-300'
    : level === UPLOAD_FILTERS.PARTIAL      ? 'border-amber-300'
    :                                          'border-gray-200';

  const bgCls =
    level === UPLOAD_FILTERS.FULLY_UPLOADED ? 'bg-gradient-to-b from-green-50/60 to-white'
    : level === UPLOAD_FILTERS.PARTIAL      ? 'bg-gradient-to-b from-amber-50/50 to-white'
    :                                          'bg-white';

  return (
    <div className={`rounded-3xl border ${borderCls} ${bgCls} shadow-md`}>
      {/* Header strip */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <MemberAvatar user={user} />
        <div className="flex-1 min-w-0">
          <TeamComplianceSection userName={user.userName} teamStats={teamStats} />
          <div className="mt-0.5">
            <CompletenessBadge level={level} filledCount={filledCount} totalSlots={totalSlots} />
          </div>
        </div>
      </div>
      <div className="px-4 pb-4 space-y-3">

      {/* Photos — always show before/after slots when editable (Mine) */}
      {(editable || (testimonial && (testimonial.beforeImageUrl || (hasAfter && testimonial.afterImageUrl)))) && (
        <div className="flex gap-2">
          <div className="flex-1 text-center">
            <div className="relative">
              {draftBefore?.previewUrl || testimonial?.beforeImageUrl ? (
                <button
                  type="button"
                  onClick={() => setExpandedPhoto({ url: draftBefore?.previewUrl || testimonial.beforeImageUrl, label: `${user.userName} — Before` })}
                  className="w-full"
                >
                  <img
                    src={draftBefore?.previewUrl || testimonial.beforeImageUrl}
                    alt="Before"
                    className={`${PORTRAIT_IMAGE_CLASS_SM} w-full cursor-zoom-in`}
                    loading="lazy"
                  />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={editable ? () => setPickerSlot('before') : undefined}
                  className={`${PORTRAIT_IMAGE_CLASS_SM} w-full flex items-center justify-center bg-gray-50 border-2 border-dashed ${editable ? 'border-green-300 hover:bg-green-50' : 'border-gray-200'} transition-colors`}
                >
                  {editable ? <Plus className="h-7 w-7 text-green-400" /> : <AlertCircle className="h-5 w-5 text-gray-300" />}
                </button>
              )}
              {editable && (draftBefore?.previewUrl || testimonial?.beforeImageUrl) && (
                <button
                  type="button"
                  onClick={() => setPickerSlot(pickerSlot === 'before' ? null : 'before')}
                  className="absolute top-1.5 right-1.5 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
                  aria-label="Edit before photo"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              )}
            </div>
            {editable && pickerSlot === 'before' && (
              <div className="flex gap-1.5 mt-1.5 justify-center">
                <button type="button" onClick={() => { beforeCamRef.current?.click(); setPickerSlot(null); }}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-green-600 text-white text-[10px] font-bold">
                  <Camera className="h-3 w-3" /> Camera
                </button>
                <button type="button" onClick={() => { beforeGalRef.current?.click(); setPickerSlot(null); }}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-gray-300 text-gray-700 text-[10px] font-bold">
                  <Images className="h-3 w-3" /> Gallery
                </button>
                <button type="button" onClick={() => setPickerSlot(null)}
                  className="px-2 py-1.5 rounded-xl border border-gray-200 text-gray-500 text-[10px] font-bold">
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            <input ref={beforeCamRef} type="file" accept="image/*" capture="environment" className="hidden"
              onChange={(e) => { if (e.target.files?.[0]) { handleImageFile('before', e.target.files[0]); setPickerSlot(null); } }} />
            <input ref={beforeGalRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => { if (e.target.files?.[0]) { handleImageFile('before', e.target.files[0]); setPickerSlot(null); } }} />
            <div className="mt-1 space-y-0.5">
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">BEFORE</p>
              {editable && expandedSlots.has('beforeWeight') ? (
                <div className="flex items-center justify-center gap-1 mt-1">
                  <input
                    type="text" inputMode="decimal" pattern="[0-9]*" step="0.1" min="1" max="500" autoFocus
                    defaultValue={draftBefore?.weightKg ?? testimonial?.beforeWeightKg ?? ''}
                    onBlur={(e) => {
                      const v = parseFloat(e.target.value);
                      if (v > 0) setDraftBefore(prev => ({ ...(prev || { goalType: testimonial?.goalType, durationText: testimonial?.durationText }), weightKg: v }));
                      toggleSlot('beforeWeight');
                    }}
                    onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') toggleSlot('beforeWeight'); }}
                    className="w-20 border border-gray-300 rounded-xl px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-green-400"
                  />
                  <span className="text-xs text-gray-400">kg</span>
                  <button type="button" onClick={() => toggleSlot('beforeWeight')} className="text-gray-400 hover:text-gray-600">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-1">
                  <p className="text-sm font-bold text-gray-800">
                    {draftBefore?.weightKg ?? testimonial?.beforeWeightKg ?? '—'}
                    {(draftBefore?.weightKg ?? testimonial?.beforeWeightKg) && <span className="text-xs font-normal text-gray-400"> kg</span>}
                  </p>
                  {editable && (
                    <button type="button" onClick={() => toggleSlot('beforeWeight')}
                      className="p-0.5 rounded-full text-gray-300 hover:text-green-600 transition-colors" aria-label="Edit before weight">
                      <Pencil className="h-2.5 w-2.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="flex-1 text-center">
            <div className="relative">
              {draftAfter?.previewUrl || (hasAfter && testimonial?.afterImageUrl) ? (
                <button
                  type="button"
                  onClick={() => setExpandedPhoto({ url: draftAfter?.previewUrl || testimonial.afterImageUrl, label: `${user.userName} — After` })}
                  className="w-full"
                >
                  <img
                    src={draftAfter?.previewUrl || testimonial.afterImageUrl}
                    alt="After"
                    className={`${PORTRAIT_IMAGE_CLASS_SM} w-full cursor-zoom-in`}
                    loading="lazy"
                  />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={editable ? () => setPickerSlot('after') : undefined}
                  className={`${PORTRAIT_IMAGE_CLASS_SM} w-full flex items-center justify-center bg-gray-50 border-2 border-dashed ${editable ? 'border-purple-300 hover:bg-purple-50' : 'border-gray-200'} transition-colors`}
                >
                  {editable ? <Plus className="h-7 w-7 text-purple-400" /> : <AlertCircle className="h-5 w-5 text-gray-300" />}
                </button>
              )}
              {editable && (draftAfter?.previewUrl || (hasAfter && testimonial?.afterImageUrl)) && (
                <button
                  type="button"
                  onClick={() => setPickerSlot(pickerSlot === 'after' ? null : 'after')}
                  className="absolute top-1.5 right-1.5 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
                  aria-label="Edit after photo"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              )}
            </div>
            {editable && pickerSlot === 'after' && (
              <div className="flex gap-1.5 mt-1.5 justify-center">
                <button type="button" onClick={() => { afterCamRef.current?.click(); setPickerSlot(null); }}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-purple-600 text-white text-[10px] font-bold">
                  <Camera className="h-3 w-3" /> Camera
                </button>
                <button type="button" onClick={() => { afterGalRef.current?.click(); setPickerSlot(null); }}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-gray-300 text-gray-700 text-[10px] font-bold">
                  <Images className="h-3 w-3" /> Gallery
                </button>
                <button type="button" onClick={() => setPickerSlot(null)}
                  className="px-2 py-1.5 rounded-xl border border-gray-200 text-gray-500 text-[10px] font-bold">
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            <input ref={afterCamRef} type="file" accept="image/*" capture="environment" className="hidden"
              onChange={(e) => { if (e.target.files?.[0]) { handleImageFile('after', e.target.files[0]); setPickerSlot(null); } }} />
            <input ref={afterGalRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => { if (e.target.files?.[0]) { handleImageFile('after', e.target.files[0]); setPickerSlot(null); } }} />
            <div className="mt-1 space-y-0.5">
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">AFTER</p>
              {editable && expandedSlots.has('afterWeight') ? (
                <div className="flex items-center justify-center gap-1 mt-1">
                  <input
                    type="text" inputMode="decimal" pattern="[0-9]*" step="0.1" min="1" max="500" autoFocus
                    defaultValue={draftAfter?.weightKg ?? (hasAfter ? testimonial?.afterWeightKg : '') ?? ''}
                    onBlur={(e) => {
                      const v = parseFloat(e.target.value);
                      if (v > 0) setDraftAfter(prev => ({ ...(prev || {}), weightKg: v }));
                      toggleSlot('afterWeight');
                    }}
                    onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') toggleSlot('afterWeight'); }}
                    className="w-20 border border-purple-300 rounded-xl px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-purple-400"
                  />
                  <span className="text-xs text-gray-400">kg</span>
                  <button type="button" onClick={() => toggleSlot('afterWeight')} className="text-gray-400 hover:text-gray-600">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-1">
                  <p className="text-sm font-bold text-gray-800">
                    {draftAfter?.weightKg ?? (hasAfter ? testimonial?.afterWeightKg : null) ?? '—'}
                    {(draftAfter?.weightKg ?? (hasAfter ? testimonial?.afterWeightKg : null)) && <span className="text-xs font-normal text-gray-400"> kg</span>}
                  </p>
                  {editable && (
                    <button type="button" onClick={() => toggleSlot('afterWeight')}
                      className="p-0.5 rounded-full text-gray-300 hover:text-purple-600 transition-colors" aria-label="Edit after weight">
                      <Pencil className="h-2.5 w-2.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Compact metadata strip — visible when editable and photos are being edited */}
      {editable && (draftBefore || draftAfter) && (
        <div className="grid grid-cols-2 gap-2 px-1">
          {draftBefore && (
            <>
              <div>
                <label className="block text-[10px] font-medium text-gray-400 mb-1">Before weight (kg)</label>
                <input type="text" inputMode="decimal" pattern="[0-9]*" step="0.1" min="1" max="500"
                  placeholder={String(testimonial?.beforeWeightKg ?? '')}
                  value={draftBefore?.weightKg ?? ''}
                  onChange={(e) => setDraftBefore(prev => ({ ...prev, weightKg: parseFloat(e.target.value) || undefined }))}
                  className="w-full border border-gray-200 rounded-xl px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-400 mb-1">Goal</label>
                <select value={draftBefore?.goalType || testimonial?.goalType || 'loss'}
                  onChange={(e) => setDraftBefore(prev => ({ ...prev, goalType: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400">
                  <option value="loss">Weight Loss</option>
                  <option value="gain">Weight Gain</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-[10px] font-medium text-gray-400 mb-1">Duration (e.g. "3 months")</label>
                <input type="text" placeholder={testimonial?.durationText || 'e.g. 3 months'}
                  value={draftBefore?.durationText ?? ''}
                  onChange={(e) => setDraftBefore(prev => ({ ...prev, durationText: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
              </div>
            </>
          )}
          {draftAfter && (
            <div className={draftBefore ? '' : 'col-span-2'}>
              <label className="block text-[10px] font-medium text-gray-400 mb-1">After weight (kg)</label>
              <input type="text" inputMode="decimal" pattern="[0-9]*" step="0.1" min="1" max="500"
                placeholder={String(hasAfter ? (testimonial?.afterWeightKg ?? '') : '')}
                value={draftAfter?.weightKg ?? ''}
                onChange={(e) => setDraftAfter(prev => ({ ...prev, weightKg: parseFloat(e.target.value) || undefined }))}
                className="w-full border border-gray-200 rounded-xl px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
            </div>
          )}
        </div>
      )}

      {/* Unified OTP — after submitting all edits */}
      {editable && submitDone && (
        <UnifiedOtpInline userId={userId} onVerified={handleUnifiedOtpVerified} />
      )}

      {/* Existing pending OTP (from old per-slot flow) — only show if not yet in new submit flow */}
      {editable && !submitDone && testimonial?.status === 'pending' && testimonial?.id && (
        <OtpInline
          testimonialId={testimonial.id}
          type="photo"
          onVerified={onOtpVerified}
        />
      )}

      {/* Stats — single summary line + status badge */}
      {testimonial && (
        <div className="space-y-1.5">
          {/* "Lost X kgs in Y duration" sentence */}
          {diff && hasAfter && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-bold border-2 ${displayGoalType === 'loss' ? 'bg-green-600 text-white border-green-700' : 'bg-blue-600 text-white border-blue-700'} shadow-sm`}>
                {displayGoalType === 'loss'
                  ? <TrendingDown className="h-3 w-3 shrink-0" />
                  : <TrendingUp   className="h-3 w-3 shrink-0" />
                }
                {displayGoalType === 'loss' ? 'Lost' : 'Gained'} {diff} kgs
                {displayDuration ? ` in ${displayDuration}` : ''}
              </span>
              {/* Pencil/Plus for duration edit (Mine only) */}
              {editable && (
                expandedSlots.has('duration') ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      autoFocus
                      placeholder="e.g. 3 months"
                      defaultValue={draftBefore?.durationText ?? testimonial?.durationText ?? ''}
                      onBlur={(e) => {
                        const val = e.target.value.trim();
                        if (val) setDraftBefore(prev => ({ ...(prev || { weightKg: testimonial?.beforeWeightKg, goalType: testimonial?.goalType }), durationText: val }));
                        toggleSlot('duration');
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.target.blur(); }
                        if (e.key === 'Escape') { toggleSlot('duration'); }
                      }}
                      className="w-28 border border-gray-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-green-400"
                    />
                    <button type="button" onClick={() => toggleSlot('duration')} className="text-gray-400 hover:text-gray-600">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => toggleSlot('duration')}
                    className="p-1 rounded-full border border-gray-200 text-gray-400 hover:text-green-700 hover:border-green-300 transition-colors"
                    aria-label="Edit duration"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                )
              )}
            </div>
          )}
          {/* No diff yet — show before weight or add prompt */}
          {(!diff || !hasAfter) && displayBeforeKg > 0 && (
            <span className="inline-flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-full px-3 py-1 text-[11px] text-gray-600 font-medium">
              {displayBeforeKg} kg → ?
            </span>
          )}
          {/* Status badge */}
          <div className="flex gap-1.5 flex-wrap items-center">
            {testimonial.status === 'verified' && (
              <>
                <span className="bg-green-100 border border-green-200 rounded-full px-2 py-0.5 text-[11px] text-green-800 font-bold flex items-center gap-0.5">
                  <CheckCircle className="h-2.5 w-2.5" /> Photo Verified
                </span>
                {/* Share card — only for Mine (editable) */}
                {editable && hasAfter && (
                  <button
                    type="button"
                    onClick={() => setShowShareCard(true)}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-green-600 text-white text-[11px] font-bold hover:bg-green-700 transition-colors"
                  >
                    <Share2 className="h-2.5 w-2.5" /> Share Card
                  </button>
                )}
              </>
            )}
            {testimonial.status === 'pending' && (
              <span className="bg-amber-100 border border-amber-200 rounded-full px-2 py-0.5 text-[11px] text-amber-800 font-bold flex items-center gap-0.5">
                <Clock className="h-2.5 w-2.5" /> Awaiting OTP
              </span>
            )}
          </div>
        </div>
      )}

      {/* Videos — always show on Mine so Edit/Add is available */}
      {(editable || testimonial) && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide flex items-center gap-1">
            <Video className="h-3 w-3" /> Result Videos
          </p>
          {editable && videoUploadError && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 flex items-start gap-2">
              <ShieldCheck className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-800 leading-relaxed">{videoUploadError}</p>
            </div>
          )}
          {/* Health video — pencil/plus overlay, clicking directly opens file picker */}
          <div className="flex gap-3">
            <div className="flex-1 space-y-1">
              <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Health</p>
              {editable ? (
                <div className="relative">
                  {draftHealthPreview || testimonial?.healthVideoUrl ? (
                    <>
                      <VideoThumbnailCard
                        url={testimonial?.healthVideoUrl ?? null}
                        localPreviewUrl={draftHealthPreview}
                        label="Health Results"
                        accentColor="bg-green-600"
                      />
                      {!uploadingHealth && (
                        <button type="button" onClick={() => healthVidRef.current?.click()}
                          className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors z-10"
                          aria-label="Replace health video">
                          <Pencil className="h-3 w-3" />
                        </button>
                      )}
                    </>
                  ) : (
                    <button type="button" onClick={() => healthVidRef.current?.click()}
                      className="w-full flex flex-col items-center justify-center gap-1.5 bg-gray-50 border-2 border-dashed border-green-300 rounded-xl py-5 hover:bg-green-50 transition-colors">
                      <Plus className="h-6 w-6 text-green-400" />
                      <span className="text-[10px] font-semibold text-green-600">Add video</span>
                    </button>
                  )}
                  {uploadingHealth && (
                    <div className="absolute inset-0 bg-black/60 rounded-xl flex items-center justify-center z-10">
                      <div className="flex flex-col items-center gap-1">
                        <Upload className="h-5 w-5 text-white animate-bounce" />
                        <span className="text-white text-[10px] font-bold">Uploading…</span>
                      </div>
                    </div>
                  )}
                  <input ref={healthVidRef} type="file" accept="video/*" className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleVideoFile('health', e.target.files[0])} />
                </div>
              ) : (
                <VideoThumbnailCard
                  url={testimonial?.healthVideoUrl ?? null}
                  label="Health Results"
                  accentColor="bg-green-600"
                />
              )}
            </div>
            <div className="flex-1 space-y-1">
              <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Business</p>
              {editable ? (
                <div className="relative">
                  {draftBusinessPreview || testimonial?.businessVideoUrl ? (
                    <>
                      <VideoThumbnailCard
                        url={testimonial?.businessVideoUrl ?? null}
                        localPreviewUrl={draftBusinessPreview}
                        label="Business Results"
                        accentColor="bg-blue-600"
                      />
                      {!uploadingBusiness && (
                        <button type="button" onClick={() => businessVidRef.current?.click()}
                          className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors z-10"
                          aria-label="Replace business video">
                          <Pencil className="h-3 w-3" />
                        </button>
                      )}
                    </>
                  ) : (
                    <button type="button" onClick={() => businessVidRef.current?.click()}
                      className="w-full flex flex-col items-center justify-center gap-1.5 bg-gray-50 border-2 border-dashed border-blue-300 rounded-xl py-5 hover:bg-blue-50 transition-colors">
                      <Plus className="h-6 w-6 text-blue-400" />
                      <span className="text-[10px] font-semibold text-blue-600">Add video</span>
                    </button>
                  )}
                  {uploadingBusiness && (
                    <div className="absolute inset-0 bg-black/60 rounded-xl flex items-center justify-center z-10">
                      <div className="flex flex-col items-center gap-1">
                        <Upload className="h-5 w-5 text-white animate-bounce" />
                        <span className="text-white text-[10px] font-bold">Uploading…</span>
                      </div>
                    </div>
                  )}
                  <input ref={businessVidRef} type="file" accept="video/*" className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleVideoFile('business', e.target.files[0])} />
                </div>
              ) : (
                <VideoThumbnailCard
                  url={testimonial?.businessVideoUrl ?? null}
                  label="Business Results"
                  accentColor="bg-blue-600"
                />
              )}
            </div>
          </div>
          {testimonial?.videoStatus === 'verified' && (
            <p className="text-[11px] text-green-700 font-medium flex items-center gap-1">
              <CheckCircle className="h-3 w-3 shrink-0" /> Videos verified
            </p>
          )}

          {/* Existing video OTP (old per-slot flow, not yet migrated) */}
          {editable && !submitDone && testimonial?.videoStatus === 'pending' && testimonial?.id && (
            <div className="bg-white rounded-2xl border border-amber-200 shadow-sm px-4 py-4 space-y-1 mt-1">
              <p className="text-xs font-bold text-amber-700 uppercase tracking-wide flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5" /> Verify Your Videos
              </p>
              <p className="text-xs text-gray-500 pb-1">
                Ask your sponsor for the OTP they received by email.
              </p>
              <OtpInline
                testimonialId={testimonial.id}
                type="video"
                onVerified={onOtpVerified}
              />
            </div>
          )}
          {!editable && testimonial?.videoStatus === 'pending' && (
            <p className="text-[11px] text-amber-700 font-medium flex items-center gap-1">
              <Clock className="h-3 w-3 shrink-0" /> Videos pending — share OTP with {user.userName}
            </p>
          )}
        </div>
      )}

      {/* Recovered health issues — always show on Mine */}
      {(editable || testimonial) && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide flex items-center gap-1">
              <HeartPulse className="h-3 w-3" /> Recovered Health Issues
            </p>
            {editable && (
              <button
                type="button"
                onClick={() => toggleSlot('issues')}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border bg-white text-[10px] font-bold transition-colors shrink-0 ${expandedSlots.has('issues') ? 'border-rose-400 text-rose-700 bg-rose-50' : 'border-gray-200 text-gray-600 hover:border-rose-400 hover:text-rose-700'}`}
              >
                <Pencil className="h-3 w-3" /> {issues.length > 0 ? 'Edit' : 'Add'}
              </button>
            )}
          </div>
          {issues.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {issues.map((issue) => (
                <span key={issue} className="inline-flex items-center max-w-full px-2 py-0.5 bg-rose-50 border border-rose-200 rounded-full text-[10px] sm:text-[11px] font-medium text-rose-800">
                  <span className="truncate">{issue}</span>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-gray-400 italic">Not added yet</p>
          )}

          {/* Issues inline — opens immediately on pencil tap */}
          {editable && expandedSlots.has('issues') && (
            <DiseaseMultiSelect
              value={draftIssues ?? issues}
              onChange={(val) => setDraftIssues(val)}
              autoFocus
            />
          )}
        </div>
      )}

      {/* ── Submit for Approval button (Mine, when any slot has draft changes) ── */}
      {editable && hasDirtySlots && !submitDone && (
        <div className="space-y-2 pt-1">
          {submitError && (
            <p className="text-xs text-red-600 text-center bg-red-50 rounded-xl px-3 py-2">{submitError}</p>
          )}
          <button
            type="button"
            onClick={handleSubmitAll}
            disabled={isSubmitting || anyVideoUploading || anyPhotoCompressing}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-green-600 hover:bg-green-700 text-white text-sm font-bold shadow-sm disabled:opacity-60 transition-colors"
          >
            {anyPhotoCompressing
              ? <><div className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" /> Preparing photo…</>
              : isSubmitting
              ? <><div className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" /> Submitting…</>
              : anyVideoUploading
              ? <><Upload className="h-4 w-4 animate-bounce" /> Uploading video…</>
              : <><Save className="h-4 w-4" /> Submit for Approval</>
            }
          </button>
          <p className="text-[10px] text-gray-400 text-center">
            {dirtySlots.length} item{dirtySlots.length > 1 ? 's' : ''} changed — your sponsor will receive one verification email
          </p>
        </div>
      )}

      {/* OTP hint — team members only (Mine uses inline OTP under Before) */}
      {!editable && testimonial?.status === 'pending' && (
        <p className="text-xs text-amber-700 font-medium bg-amber-100 rounded-xl px-3 py-2 text-center flex items-center justify-center gap-1.5">
          <Mail className="h-3.5 w-3.5 shrink-0" />
          OTP sent to your email — share it with {user.userName} to verify
        </p>
      )}

      {/* No testimonial — team view only (Mine always has Add slots above) */}
      {!editable && !testimonial && (
        <div className="flex items-center gap-2 py-1">
          <AlertCircle className="h-4 w-4 text-gray-400 flex-shrink-0" />
          <p className="text-xs text-gray-500 italic">No testimonial uploaded yet</p>
        </div>
      )}

      {expandedPhoto && (
        <PhotoModal url={expandedPhoto.url} label={expandedPhoto.label} onClose={() => setExpandedPhoto(null)} />
      )}
      {showShareCard && testimonial && (
        <TransformationShareCard
          testimonial={testimonial}
          userName={user.userName}
          hasAfter={hasAfter}
          onClose={() => setShowShareCard(false)}
        />
      )}
      </div>
    </div>
  );
}


export default function CoachTestimonialsPage({ user, reloadSignal = 0, tabVisitKey = 0 }) {
  const [directRows, setDirectRows]   = useState([]);
  const [fullRows,   setFullRows]     = useState([]);
  const [mineRow,    setMineRow]      = useState(null);
  const [loading,    setLoading]      = useState(true);
  const [error,      setError]        = useState(null);
  const [hasDownline, setHasDownline] = useState(false);

  const [uploadFilter,          setUploadFilter]          = useState(UPLOAD_FILTERS.ALL);
  const [teamScope,             setTeamScope]             = useState(TEAM_SCOPES.MINE);
  const [searchQuery,           setSearchQuery]           = useState('');
  const [isSearchOpen,          setIsSearchOpen]          = useState(false);
  const [highlightedSuggestion, setHighlightedSuggestion] = useState(-1);

  const [teamPerformanceByUserId, setTeamPerformanceByUserId] = useState({});
  const [fullTeamMemberCount, setFullTeamMemberCount] = useState(null);
  const [fullLoading, setFullLoading] = useState(false);
  const [fullLoaded, setFullLoaded] = useState(false);
  const [directPagination, setDirectPagination] = useState({ page: 1, hasMore: false, total: 0 });
  const [fullPagination, setFullPagination] = useState({ page: 1, hasMore: false, total: 0 });
  const [directUploadCounts, setDirectUploadCounts] = useState({
    fully_uploaded: 0, partial_upload: 0, not_uploaded: 0,
  });
  const [fullUploadCounts, setFullUploadCounts] = useState({
    fully_uploaded: 0, partial_upload: 0, not_uploaded: 0,
  });
  const [loadingMore, setLoadingMore] = useState(false);
  const loadMoreSentinelRef = useRef(null);
  const loadGenerationRef = useRef(0);
  const pageCacheRef = useRef(new Map());
  const inFlightRef = useRef(new Map());

  const coachId = user?.userId || user?.id;

  const buildMineRow = useCallback(async () => {
    if (!coachId) return null;
    const userPayload = {
      userId:       coachId,
      userName:     user?.userName || user?.displayName || user?.name || 'You',
      profileImage: user?.profileImage || user?.photoURL || null,
      phoneNumber:  user?.phoneNumber || user?.PhoneNumber || null,
    };
    try {
      const [testimonial, video] = await Promise.all([
        getMyTestimonial(coachId),
        getMyVideoTestimonial(coachId).catch(() => null),
      ]);
      if (!testimonial && !video) {
        return { user: userPayload, testimonial: null };
      }
      // Merge video verification fields so Mine can show "Videos verified"
      const merged = {
        ...(testimonial || {
          healthVideoUrl: null,
          businessVideoUrl: null,
          status: 'incomplete',
          recoveredHealthIssues: [],
        }),
        id:              testimonial?.id ?? video?.testimonialId ?? null,
        videoStatus:     video?.videoStatus ?? testimonial?.videoStatus ?? 'none',
        videoVerifiedAt: video?.videoVerifiedAt ?? testimonial?.videoVerifiedAt ?? null,
      };
      return { user: userPayload, testimonial: merged };
    } catch {
      return { user: userPayload, testimonial: null };
    }
  }, [coachId, user]);

  const loadDirectAndMine = useCallback(async () => {
    if (!coachId) return;
    const generation = loadGenerationRef.current + 1;
    loadGenerationRef.current = generation;
    setLoading(true);
    setError(null);
    setFullRows([]);
    setFullLoaded(false);
    setFullTeamMemberCount(null);
    try {
      // First page only (limit 10) — never hydrate the full team on open.
      const [directResult, mine] = await Promise.all([
        listForCoach(coachId, { scope: 'direct', page: 1, limit: 10 }),
        buildMineRow(),
      ]);
      if (generation !== loadGenerationRef.current) return;

      const direct = Array.isArray(directResult?.data) ? directResult.data : [];
      setDirectRows(direct);
      setDirectPagination(directResult?.pagination || { page: 1, hasMore: false, total: direct.length });
      setDirectUploadCounts(directResult?.uploadCounts || {
        fully_uploaded: 0, partial_upload: 0, not_uploaded: 0,
      });
      setMineRow(mine);
      const total = directResult?.pagination?.total ?? direct.length;
      setHasDownline(total > 0);
      if (total === 0) setTeamScope(TEAM_SCOPES.MINE);
    } catch (err) {
      if (generation !== loadGenerationRef.current) return;
      setError(err.message || 'Failed to load testimonials');
    } finally {
      if (generation === loadGenerationRef.current) {
        setLoading(false);
      }
    }

    // Deferred: badges + Full tab count from team-report
    getTeamTestimonialReport(coachId)
      .then((teamReport) => {
        if (generation !== loadGenerationRef.current || !teamReport) return;
        setTeamPerformanceByUserId(teamReport.teamPerformanceByUserId ?? {});
        const fullStats = teamReport.photoReport?.fullTeam ?? {};
        const fullCount =
          fullStats.totalMembers
          ?? ((fullStats.uploaded ?? 0) + (fullStats.notUploaded ?? 0));
        if (Number.isFinite(fullCount) && fullCount > 0) {
          setFullTeamMemberCount(fullCount);
          setHasDownline(true);
        } else {
          const directStats = teamReport.photoReport?.directTeam ?? {};
          const directCount =
            directStats.totalMembers
            ?? ((directStats.uploaded ?? 0) + (directStats.notUploaded ?? 0));
          if (directCount > 0) setHasDownline(true);
        }
      })
      .catch(() => {});
  }, [coachId, buildMineRow]);

  const loadFullTeam = useCallback(async () => {
    if (!coachId || fullLoaded || fullLoading) return;
    const generation = loadGenerationRef.current;
    setFullLoading(true);
    setError(null);
    try {
      const fullResult = await listForCoach(coachId, {
        scope: 'full',
        page: 1,
        limit: 10,
        search: normalizeSearchQuery(searchQuery),
        uploadFilter,
      });
      if (generation !== loadGenerationRef.current) return;
      setFullRows(Array.isArray(fullResult?.data) ? fullResult.data : []);
      setFullPagination(fullResult?.pagination || { page: 1, hasMore: false, total: 0 });
      setFullUploadCounts(fullResult?.uploadCounts || {
        fully_uploaded: 0, partial_upload: 0, not_uploaded: 0,
      });
      setFullLoaded(true);
    } catch (err) {
      if (generation !== loadGenerationRef.current) return;
      setError(err.message || 'Failed to load full team');
    } finally {
      if (generation === loadGenerationRef.current) {
        setFullLoading(false);
      }
    }
  }, [coachId, fullLoaded, fullLoading, searchQuery, uploadFilter]);

  useEffect(() => { loadDirectAndMine(); }, [loadDirectAndMine, tabVisitKey]);

  useEffect(() => {
    if (teamScope === TEAM_SCOPES.FULL && hasDownline && !fullLoaded && !fullLoading) {
      loadFullTeam();
    }
  }, [teamScope, hasDownline, fullLoaded, fullLoading, loadFullTeam]);

  // Soft-refresh Mine after edit modal so pending OTP UI appears (no full loading flash)
  useEffect(() => {
    if (!reloadSignal) return;
    let cancelled = false;
    (async () => {
      try {
        const mine = await buildMineRow();
        if (!cancelled) setMineRow(mine);
        if (!cancelled && hasDownline) {
          getTeamTestimonialReport(coachId)
            .then((report) => {
              if (!cancelled) {
                setTeamPerformanceByUserId(report.teamPerformanceByUserId ?? {});
              }
            })
            .catch(() => {});
        }
      } catch {
        // keep existing card data if soft refresh fails
      }
    })();
    return () => { cancelled = true; };
  }, [reloadSignal, buildMineRow, hasDownline, coachId]);

  useEffect(() => {
    setSearchQuery('');
    setIsSearchOpen(false);
    setHighlightedSuggestion(-1);
    setUploadFilter(UPLOAD_FILTERS.ALL);
  }, [teamScope]);

  // ── Derived state ──────────────────────────────────────────────────────────

  const isMineScope = !hasDownline || teamScope === TEAM_SCOPES.MINE;

  const scopeRows = useMemo(() => {
    if (!hasDownline || teamScope === TEAM_SCOPES.MINE) return mineRow ? [mineRow] : [];
    if (teamScope === TEAM_SCOPES.FULL) return fullRows;
    return directRows;
  }, [hasDownline, teamScope, mineRow, directRows, fullRows]);

  const teamScopeCounts = useMemo(() => ({
    [TEAM_SCOPES.MINE]: mineRow ? 1 : 0,
    [TEAM_SCOPES.DIRECT]: directPagination.total || directRows.length,
    [TEAM_SCOPES.FULL]: fullTeamMemberCount ?? fullPagination.total ?? fullRows.length,
  }), [mineRow, directPagination.total, directRows.length, fullTeamMemberCount, fullPagination.total, fullRows.length]);

  // Server-provided completeness counts (search-scoped); avoid recounting only the loaded page.
  const uploadCounts = teamScope === TEAM_SCOPES.FULL ? fullUploadCounts : directUploadCounts;

  // Server already filtered — use scopeRows as filteredRows for team scopes.
  const filteredRows = scopeRows;

  const suggestions = useMemo(
    () => buildSearchSuggestions(filteredRows, searchQuery),
    [filteredRows, searchQuery],
  );

  const activePagination = teamScope === TEAM_SCOPES.FULL ? fullPagination : directPagination;

  const loadMoreTeam = useCallback(async () => {
    if (isMineScope || loadingMore || loading || fullLoading) return;
    if (!activePagination.hasMore) return;
    const scope = teamScope === TEAM_SCOPES.FULL ? 'full' : 'direct';
    const nextPage = (activePagination.page || 1) + 1;
    const cacheKey = `${scope}|${normalizeSearchQuery(searchQuery)}|${uploadFilter}|${nextPage}`;
    if (pageCacheRef.current.has(cacheKey)) {
      const cached = pageCacheRef.current.get(cacheKey);
      if (scope === 'full') {
        setFullRows((prev) => [...prev, ...cached.data]);
        setFullPagination(cached.pagination);
      } else {
        setDirectRows((prev) => [...prev, ...cached.data]);
        setDirectPagination(cached.pagination);
      }
      return;
    }
    if (inFlightRef.current.has(cacheKey)) return;

    setLoadingMore(true);
    const promise = listForCoach(coachId, {
      scope,
      page: nextPage,
      limit: 10,
      search: normalizeSearchQuery(searchQuery),
      uploadFilter,
    });
    inFlightRef.current.set(cacheKey, promise);
    try {
      const result = await promise;
      pageCacheRef.current.set(cacheKey, result);
      const pageData = Array.isArray(result?.data) ? result.data : [];
      if (scope === 'full') {
        setFullRows((prev) => [...prev, ...pageData]);
        setFullPagination(result.pagination || { page: nextPage, hasMore: false });
        if (result.uploadCounts) setFullUploadCounts(result.uploadCounts);
      } else {
        setDirectRows((prev) => [...prev, ...pageData]);
        setDirectPagination(result.pagination || { page: nextPage, hasMore: false });
        if (result.uploadCounts) setDirectUploadCounts(result.uploadCounts);
      }
    } catch (err) {
      setError(err.message || 'Failed to load more');
    } finally {
      inFlightRef.current.delete(cacheKey);
      setLoadingMore(false);
    }
  }, [
    isMineScope, loadingMore, loading, fullLoading, activePagination,
    teamScope, searchQuery, uploadFilter, coachId,
  ]);

  // Refetch page 1 when search / upload filter changes (server-side).
  // Skip the first run — bootstrap / loadFullTeam already loaded page 1.
  const skipFilterFetchRef = useRef(true);
  useEffect(() => {
    if (!coachId || !hasDownline || isMineScope) return undefined;
    if (skipFilterFetchRef.current) {
      skipFilterFetchRef.current = false;
      return undefined;
    }
    const scope = teamScope === TEAM_SCOPES.FULL ? 'full' : 'direct';
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const result = await listForCoach(coachId, {
          scope,
          page: 1,
          limit: 10,
          search: normalizeSearchQuery(searchQuery),
          uploadFilter,
        });
        if (cancelled) return;
        const pageData = Array.isArray(result?.data) ? result.data : [];
        if (scope === 'full') {
          setFullRows(pageData);
          setFullPagination(result.pagination || { page: 1, hasMore: false, total: 0 });
          if (result.uploadCounts) setFullUploadCounts(result.uploadCounts);
          setFullLoaded(true);
        } else {
          setDirectRows(pageData);
          setDirectPagination(result.pagination || { page: 1, hasMore: false, total: 0 });
          if (result.uploadCounts) setDirectUploadCounts(result.uploadCounts);
        }
      } catch {
        // keep current rows
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: refetch on search/filter/scope
  }, [searchQuery, uploadFilter, teamScope, coachId, hasDownline, isMineScope]);

  // Reset skip flag when leaving Mine so Direct/Full get a clean first paint from their loaders.
  useEffect(() => {
    if (!isMineScope) skipFilterFetchRef.current = true;
  }, [teamScope]);

  // Infinite scroll sentinel
  useEffect(() => {
    if (isMineScope || !activePagination.hasMore) return undefined;
    const node = loadMoreSentinelRef.current;
    if (!node) return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) void loadMoreTeam();
    }, { rootMargin: '240px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [isMineScope, activePagination.hasMore, loadMoreTeam, filteredRows.length]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleUploadToggle = useCallback((next) => {
    setUploadFilter((current) => toggleStatusFilter(current, next));
  }, []);

  const handleSearchChange = useCallback((value) => {
    setSearchQuery(value);
    setIsSearchOpen(true);
    setHighlightedSuggestion(-1);
  }, []);

  const handleSelectSuggestion = useCallback((row) => {
    setSearchQuery(row.user?.userName || '');
    setIsSearchOpen(false);
    setHighlightedSuggestion(-1);
  }, []);

  const handleSearchKeyDown = useCallback((event) => {
    const hasQuery = normalizeSearchQuery(searchQuery).length > 0;
    if (!hasQuery) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!suggestions.length) return;
      setIsSearchOpen(true);
      setHighlightedSuggestion((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!suggestions.length) return;
      setIsSearchOpen(true);
      setHighlightedSuggestion((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (highlightedSuggestion >= 0 && suggestions[highlightedSuggestion]) {
        handleSelectSuggestion(suggestions[highlightedSuggestion]);
      } else {
        setIsSearchOpen(false);
        setHighlightedSuggestion(-1);
      }
      return;
    }
    if (event.key === 'Escape') {
      setIsSearchOpen(false);
      setHighlightedSuggestion(-1);
    }
  }, [searchQuery, suggestions, highlightedSuggestion, handleSelectSuggestion]);

  const hasScopeData    = scopeRows.length > 0 || (activePagination.total > 0 && !isMineScope);
  const hasActiveSearch = normalizeSearchQuery(searchQuery).length > 0;
  const showTeamChrome  = hasDownline;

  return (
    <div className="max-w-lg mx-auto px-4 pt-4 pb-24 space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-green-700" />
          <h1 className="text-lg font-bold text-gray-900">
            {showTeamChrome ? 'Team Transformation' : 'My Transformation'}
          </h1>
        </div>
        <TouchFeedbackButton
          onClick={() => { loadDirectAndMine(); }}
          disabled={loading || fullLoading}
          className="p-2 rounded-full text-gray-500 hover:text-green-700 hover:bg-green-50 transition-colors"
          ariaLabel="Refresh"
        >
          <RefreshCw className={`h-4 w-4 ${loading || fullLoading ? 'animate-spin' : ''}`} />
        </TouchFeedbackButton>
      </div>

      {/* Team scope — only when user has a downline */}
      {!loading && showTeamChrome && (
        <div className="bg-white rounded-xl border border-gray-200 px-1 py-1 flex gap-1" role="group" aria-label="Team scope">
          {TEAM_SCOPE_OPTIONS.map(({ value, label, short }) => {
            const isActive  = teamScope === value;
            const count     = teamScopeCounts[value] ?? 0;
            const showCount = value !== TEAM_SCOPES.MINE;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setTeamScope(value)}
                aria-pressed={isActive}
                className={`flex-1 py-2 rounded-lg text-[11px] sm:text-xs font-semibold transition-all duration-150 cursor-pointer min-w-0 px-1 ${
                  isActive ? 'bg-green-600 text-white shadow-sm' : 'text-green-800 hover:bg-green-50'
                }`}
              >
                <span className="hidden sm:inline">{showCount ? `${label} (${count})` : label}</span>
                <span className="sm:hidden">{showCount ? `${short} (${count})` : short}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Search + upload filters — team scopes only (not Mine / not leaf members) */}
      {!loading && showTeamChrome && hasScopeData && !isMineScope && (
        <>
          <TestimonialSearchBar
            value={searchQuery}
            onChange={handleSearchChange}
            suggestions={suggestions}
            isOpen={isSearchOpen}
            onOpenChange={setIsSearchOpen}
            highlightedIndex={highlightedSuggestion}
            onHighlightChange={setHighlightedSuggestion}
            onSelectSuggestion={handleSelectSuggestion}
            onKeyDown={handleSearchKeyDown}
          />

          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide sm:flex-wrap sm:gap-2 sm:overflow-visible" role="group" aria-label="Upload completeness filter">
            <UploadFilterChip
              filterKey={UPLOAD_FILTERS.FULLY_UPLOADED}
              count={uploadCounts.fully_uploaded}
              activeFilter={uploadFilter}
              onToggle={handleUploadToggle}
            />
            <UploadFilterChip
              filterKey={UPLOAD_FILTERS.PARTIAL}
              count={uploadCounts.partial_upload}
              activeFilter={uploadFilter}
              onToggle={handleUploadToggle}
            />
            <UploadFilterChip
              filterKey={UPLOAD_FILTERS.NOT_UPLOADED}
              count={uploadCounts.not_uploaded}
              activeFilter={uploadFilter}
              onToggle={handleUploadToggle}
            />
          </div>
        </>
      )}

      {/* States */}
      {loading && (
        <div className="space-y-3 animate-pulse">
          <div className="h-32 bg-gray-100 rounded-2xl" />
          <div className="h-6 bg-gray-100 rounded-xl w-3/4" />
          <div className="h-6 bg-gray-100 rounded-xl w-1/2" />
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-700">{error}</div>
      )}

      {fullLoading && teamScope === TEAM_SCOPES.FULL && (
        <div className="py-6">
          <LoadingSpinner context="normal" />
          <p className="text-center text-sm text-gray-500 mt-2">Loading full team…</p>
        </div>
      )}

      {!loading && !fullLoading && !error && !hasScopeData && (
        <div className="text-center py-12 text-gray-400">
          <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">
            {showTeamChrome ? 'No team members found' : 'Unable to load your transformation'}
          </p>
        </div>
      )}

      {!loading && !fullLoading && !error && hasScopeData && filteredRows.length === 0 && (
        <div className="text-center py-8 text-gray-400">
          <p className="font-medium text-sm">
            {hasActiveSearch ? 'No matching members found.' : 'No records match the selected filter.'}
          </p>
        </div>
      )}

      {/* Member cards */}
      {!loading && !fullLoading && filteredRows.map((row) => (
        <MemberCard
          key={row.user.userId}
          row={row}
          teamStats={resolveRowTeamUploadPerformance({
            row,
            teamScope: isMineScope ? TEAM_SCOPES.MINE : teamScope,
            loggedInCoachId: coachId,
            teamPerformanceByUserId,
            reportType: 'photo',
          })}
          editable={isMineScope}
          userId={isMineScope ? coachId : null}
          coachId={coachId}
          onOtpVerified={isMineScope ? () => { loadDirectAndMine(); } : undefined}
        />
      ))}

      {!loading && !fullLoading && !isMineScope && activePagination.hasMore && (
        <div ref={loadMoreSentinelRef} className="py-4 flex justify-center">
          {loadingMore ? (
            <LoadingSpinner context="normal" />
          ) : (
            <p className="text-xs text-gray-400">Scroll for more</p>
          )}
        </div>
      )}
    </div>
  );
}



