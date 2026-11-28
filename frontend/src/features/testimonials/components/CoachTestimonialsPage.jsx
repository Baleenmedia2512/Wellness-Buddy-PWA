/**
 * CoachTestimonialsPage.jsx
 * Unified testimonials card view for every user.
 *
 * Per-member card:
 *   • Mine: edit slots + video upload → divider → branded card → Share Image → videos
 *   • Direct/Full: header → divider → branded card → Share Image → videos → Share Video
 *     (no duplicate video block above the branded card)
 *
 * With downline: own card by default + search (no Mine/Direct/Full tabs).
 * Without downline: own card only.
 */
import React, { useEffect, useCallback, useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle, ArrowLeft, CheckCircle, CircleDot, Clock, Crop,
  Images, Mail, Pencil, Plus, RefreshCw, Save, Share2, ShieldCheck, Trash2,
  Upload, Users, Video, X, TrendingDown, TrendingUp,
} from 'lucide-react';
import CustomAlertModal from '../../../shared/components/CustomAlertModal';
import TouchFeedbackButton from '../../../shared/components/TouchFeedbackButton';
import ProfilePhotoThumbnail from '../../../shared/components/ProfilePhotoThumbnail.jsx';
import FullscreenProfilePhotoViewer from '../../../shared/components/FullscreenProfilePhotoViewer.jsx';
import { TeamMemberProfileModal } from '../../../shared/components/TeamMemberProfileModal';
import NativeInput from '../../../shared/components/NativeInput.jsx';
import LoadingSpinner from '../../../shared/components/LoadingSpinner';
import {
  listForCoach, getMyTestimonial, getMyVideoTestimonial, getTeamTestimonialReport,
  getTestimonialDetail, submitAllEdits, verifyUnifiedOtp, resendUnifiedOtp, cancelUnifiedOtp,
  prepareTestimonialVideoUpload, deleteTestimonialPhoto,
} from '../services/testimonialApi.js';
import { getProfile } from '../../user/services/user.api.js';
import { uploadTestimonialVideoInChunks } from '../services/testimonialVideoUpload.js';
import TestimonialSearchBar from './TestimonialSearchBar.jsx';
import OtpInline from './OtpInline.jsx';
import {
  EMAIL_OTP_LENGTH,
  extractOtpFromText,
  isValidEmailOtp,
} from '../../user/domain/otpLength';
import VideoThumbnailCard from './VideoThumbnailCard.jsx';
import {
  TransformationCardContent,
  TransformationShareActions,
} from './TransformationShareCard.jsx';

import { CARD_W, CARD_H } from '../utils/shareCardLayout.js';
import { getCachedVideoThumbnail } from '../utils/videoThumbnailCache.js';
import { jpegDataUrlToObjectUrl, revokeBlobUrl, withTestimonialMediaCacheBust } from '../utils/testimonialMediaUrl.js';
import { useRevocableImageSrc } from '../hooks/useRevocableImageSrc.js';
import { resolveResultVideoUrl, prefetchNativeResultVideos } from '../utils/downloadVideo.js';
import { MAX_HEALTH_VIDEO_MB, isVideoOverSizeLimit, videoTooLargeMessage, maxVideoMbForSlot } from '../utils/videoLimits.js';
import { compressVideoToMaxBytes } from '../utils/compressTestimonialVideo.js';
import { normalizeVideoUploadFile } from '../utils/normalizeVideoUploadFile.js';
import { isCaptureFlowBusy, setCaptureFlowBusy } from '../../../shared/services/captureFlowBusy';
import usePortraitCoverCrop from '../../user/hooks/usePortraitCoverCrop';
import { shouldShowTestimonialsPageSkeleton } from '../utils/testimonialsPageLoad.js';
import {
  UPLOAD_FILTERS,
  TEAM_SCOPES,
  computeMemberCompleteness,
  toggleStatusFilter,
  resolveTeamScopeCount,
} from '../utils/testimonialFilters.js';
import {
  buildSearchSuggestions,
  normalizeSearchQuery,
} from '../utils/testimonialSearch.js';
import {
  PORTRAIT_IMAGE_CLASS_SM,
  parseDurationText,
  formatDurationText,
  sanitizeDurationDigits,
  sanitizeWeightTyping,
  parseWeightKg,
  validateDurationFields,
  isUsableDurationText,
  liveWeightDiffKg,
  isTransformationWeightLoss,
  canShareTransformationPhoto,


  hasApprovalReadyBeforePhoto,
  hasDistinctTransformationAfter,
  hasStoredTransformationBefore,
  hasStoredTransformationPhotoCard,
  isProfileSeededTransformation,
} from '../services/testimonialFormUtils.js';
import { resolveRowTeamUploadPerformance } from '../utils/testimonialTeamPerformance.js';
import { getApiBaseUrl } from '../../../config/api.config.js';
import {
  buildUserAvatarUrl,
  getAvatarDisplayVersion,
  subscribeAvatarDisplayVersion,
} from '../../user/services/avatarDisplayVersion.js';
import { seedMineTestimonialFromProfileSlots } from '../../user/domain/transformationBeforeAfter';
import WebsiteDisplayConsentCard from './WebsiteDisplayConsentCard.jsx';
import { isFlagEnabled } from '../../../config/featureFlags.js';
import { compressImage } from '../utils/compressTestimonialImage.js';
import {
  buildCollageChatGptPrompt,
  copyTransformCollagePrompt,
} from '../utils/transformationCollagePrompt.js';
import ChatGptCollageGuideModal from './ChatGptCollageGuideModal.jsx';
const COLLAGE_IMAGE_CLASS =
  'w-full h-auto max-h-[70vh] object-contain block overflow-hidden rounded-xl border border-gray-200 bg-white';

// â”€â”€ Constants â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const TEAM_PAGE_SIZE = 5;

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

function mergeUniqueMemberRows(prevRows, nextRows) {
  const seen = new Set();
  const merged = [];
  for (const row of [...(Array.isArray(prevRows) ? prevRows : []), ...(Array.isArray(nextRows) ? nextRows : [])]) {
    const uid = row?.user?.userId;
    if (uid != null && seen.has(uid)) continue;
    if (uid != null) seen.add(uid);
    merged.push(row);
  }
  return merged;
}

function teamComplianceColorClass(scoreNum) {
  if (scoreNum >= 80) return 'text-green-700';
  if (scoreNum >= 50) return 'text-amber-700';
  return 'text-red-700';
}

// â”€â”€ Instagram-style Video Player Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function VideoPlayerModal({ url, title, onClose }) {
  const videoRef = useRef(null);

  useEffect(() => {
    videoRef.current?.play().catch(() => {/* autoplay blocked */ });
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

/**
 * On-screen branded Transformation Results card (scaled to card width).
 * Share capture still uses a full-size hidden clone so html2canvas stays sharp.
 */
function VisibleTransformationCard({ testimonial, userName }) {
  const wrapRef = useRef(null);
  const innerRef = useRef(null);
  const [scale, setScale] = useState(0);
  const [contentHeight, setContentHeight] = useState(CARD_H);
  const isCollageCard = Boolean(testimonial?.shareAsCollage);

  useEffect(() => {
    const el = wrapRef.current;
    const innerEl = innerRef.current;
    if (!el) return undefined;
    const update = () => {
      const w = el.clientWidth;
      if (w > 0) setScale(w / CARD_W);
      if (innerEl) {
        const measured = Math.ceil(innerEl.offsetHeight || CARD_H);
        if (measured > 0) setContentHeight(measured);
      }
    };
    update();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    ro?.observe(el);
    if (innerEl) ro?.observe(innerEl);
    window.addEventListener('resize', update);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [isCollageCard, testimonial]);

  const effectiveHeight = isCollageCard ? contentHeight : CARD_H;

  return (
    <div
      ref={wrapRef}
      className="w-full overflow-hidden rounded-2xl border border-emerald-100 shadow-sm bg-white"
      style={{
        height: scale > 0 ? Math.round(effectiveHeight * scale) : undefined,
        aspectRatio: scale > 0 ? undefined : `${CARD_W} / ${effectiveHeight}`,
      }}
      aria-label="Transformation results card"
    >
      <div
        ref={innerRef}
        style={{
          width: CARD_W,
          height: isCollageCard ? 'auto' : CARD_H,
          transform: scale > 0 ? `scale(${scale})` : undefined,
          transformOrigin: 'top left',
        }}
      >
        <TransformationCardContent testimonial={testimonial} userName={userName} />
      </div>
    </div>
  );
}

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

function TeamComplianceInline({ userName, teamStats, onComplianceClick, onProfileClick }) {
  const memberName = onProfileClick ? (
    <button
      type="button"
      onClick={onProfileClick}
      className="font-semibold text-gray-900 truncate text-left hover:underline"
    >
      {userName}
    </button>
  ) : <span className="font-semibold text-gray-900 truncate">{userName}</span>;
  if (!teamStats?.totalMembers) {
    return <p className="text-sm">{memberName}</p>;
  }
  const scoreNum = Number(teamStats.uploadPercentage ?? 0);
  const colorClass = teamComplianceColorClass(scoreNum);
  const uploaded = teamStats.uploaded ?? teamStats.uploadedMembers?.length ?? 0;
  return (
    <p className="text-sm font-medium flex items-baseline gap-2 min-w-0 flex-wrap">
      {memberName}
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

function TeamComplianceModal({ userName, teamStats, onClose, onMemberProfile }) {
  const scoreColor = teamComplianceColorClass(Number(teamStats.uploadPercentage ?? 0));
  const uploaded = teamStats.uploaded ?? teamStats.uploadedMembers?.length ?? 0;
  const total = teamStats.totalMembers ?? 0;
  const notUploaded = total - uploaded;

  // Portal to body so iOS WKWebView does not trap `fixed` inside `.ios-scroll-body`
  // (header was clipped; only cards showed under Transformation tabs).
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[80] ios-full-page bg-white"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tc-title"
    >
      <header className="flex-shrink-0 bg-white border-b border-gray-200 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
        <div className="flex items-center gap-3">
          <TouchFeedbackButton onClick={onClose} className="p-2 -ml-2 rounded-full text-gray-600 hover:text-gray-900" ariaLabel="Back">
            <ArrowLeft className="h-5 w-5" />
          </TouchFeedbackButton>
          <div className="min-w-0 flex-1">
            <h2 id="tc-title" className="text-base font-bold text-gray-800 truncate">Team Compliance</h2>
            <p className="text-xs text-gray-500 truncate uppercase tracking-wide">{userName}</p>
          </div>
        </div>
      </header>
      <div className="ios-scroll-body px-4 py-4 space-y-3">
        <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-1">
          <p className={`text-2xl font-bold ${scoreColor}`}>{formatPercentage(teamStats.uploadPercentage)}%</p>
          <p className="text-sm text-gray-500">
            Team upload rate {'\u00b7'} {uploaded}/{total} members
          </p>
        </div>
        {(teamStats.uploadedMembers?.length > 0) && (
          <div className="bg-white rounded-2xl border border-green-200 p-3">
            <p className="text-xs font-bold text-green-800 mb-2">Uploaded ({uploaded})</p>
            <ul className="space-y-0.5">
              {teamStats.uploadedMembers.map((m) => (
                <li key={m.userId} className="text-xs text-green-700 font-medium truncate">
                  {m.userId != null ? (
                    <button
                      type="button"
                      onClick={() => onMemberProfile(m.userId)}
                      className="text-left hover:underline"
                    >
                      {m.userName}
                    </button>
                  ) : m.userName}
                </li>
              ))}
            </ul>
          </div>
        )}
        {(teamStats.notUploadedMembers?.length > 0) && (
          <div className="bg-white rounded-2xl border border-red-200 p-3">
            <p className="text-xs font-bold text-red-800 mb-2">Not Uploaded ({notUploaded})</p>
            <ul className="space-y-0.5">
              {teamStats.notUploadedMembers.map((m) => (
                <li key={m.userId} className="text-xs text-red-700 font-medium truncate">
                  {m.userId != null ? (
                    <button
                      type="button"
                      onClick={() => onMemberProfile(m.userId)}
                      className="text-left hover:underline"
                    >
                      {m.userName}
                    </button>
                  ) : m.userName}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

function TeamComplianceSection({ userName, teamStats, onProfileClick }) {
  const [open, setOpen] = useState(false);
  const [profileUserId, setProfileUserId] = useState(null);
  return (
    <>
      <TeamComplianceInline
        userName={userName}
        teamStats={teamStats}
        onComplianceClick={() => setOpen(true)}
        onProfileClick={onProfileClick}
      />
      {open && !profileUserId && teamStats?.totalMembers && (
        <TeamComplianceModal
          userName={userName}
          teamStats={teamStats}
          onClose={() => setOpen(false)}
          onMemberProfile={(userId) => {
            setOpen(false);
            setProfileUserId(userId);
          }}
        />
      )}
      <TeamMemberProfileModal
        isOpen={Boolean(profileUserId)}
        onClose={() => setProfileUserId(null)}
        memberUserId={profileUserId}
        apiBaseUrl={getApiBaseUrl()}
      />
    </>
  );
}

/** Avatar via dedicated endpoint — keeps list-for-coach JSON tiny. */
function MemberAvatar({ user, onViewProfile }) {
  const [avatarVersion, setAvatarVersion] = useState(getAvatarDisplayVersion);
  useEffect(() => subscribeAvatarDisplayVersion(setAvatarVersion), []);

  const userId = user?.userId;
  const inline = user?.profileImage;
  let remote = null;
  try {
    if (userId != null && !inline) {
      remote = buildUserAvatarUrl(getApiBaseUrl(), userId, avatarVersion, { profileOnly: true });
    }
  } catch {
    remote = null;
  }
  const src = inline || remote;

  if (src) {
    return (
      <ProfilePhotoThumbnail
        src={src}
        alt={user?.userName || 'User'}
        onViewProfile={onViewProfile}
        className="h-11 w-11 rounded-full flex-shrink-0"
        imageClassName="h-11 w-11 rounded-full object-cover border-2 border-white shadow"
        fallbackClassName="h-11 w-11 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center text-white font-bold text-base shadow flex-shrink-0"
        fallback={(user?.userName || '?').charAt(0).toUpperCase()}
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

// â”€â”€ Upload completeness filter chip â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function UploadFilterChip({ filterKey, count, activeFilter, onToggle }) {
  const isActive = activeFilter === filterKey;
  const { label, Icon, base, active } = UPLOAD_FILTER_CFG[filterKey];
  return (
    <button
      type="button"
      onClick={() => onToggle(filterKey)}
      aria-pressed={isActive}
      className={`flex-shrink-0 rounded-full px-3 py-1 text-xs font-bold transition-all duration-150 cursor-pointer whitespace-nowrap ${isActive ? active : base
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

const OTP_VALIDITY_HOURS_DEFAULT = 24;

function isOtpExpiredClient(otpExpiresAt) {
  if (!otpExpiresAt) return false;
  // Match backend: compare IST-shifted "now" to stored expiry wall clock.
  const istNow = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  return istNow > new Date(otpExpiresAt);
}

function UnifiedOtpInline({
  userId,
  sponsorName = null,
  otpExpiresAt = null,
  otpValidityHours = OTP_VALIDITY_HOURS_DEFAULT,
  otpExpired: otpExpiredProp = null,
  onVerified,
  onOtpMetaUpdate,
  onClose,
}) {
  const [otp, setOtp] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [resending, setResending] = React.useState(false);
  const [closing, setClosing] = React.useState(false);
  const [dismissed, setDismissed] = React.useState(false);
  const [err, setErr] = React.useState(null);
  const [info, setInfo] = React.useState(null);
  const [expiresAt, setExpiresAt] = React.useState(otpExpiresAt);
  const [tick, setTick] = React.useState(0);

  React.useEffect(() => {
    setDismissed(false);
  }, [userId, otpExpiresAt]);

  React.useEffect(() => {
    setExpiresAt(otpExpiresAt);
  }, [otpExpiresAt]);

  React.useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const expired = otpExpiredProp === true
    || (otpExpiredProp !== false && isOtpExpiredClient(expiresAt));
  void tick; // re-render on interval for expiry flip

  const sponsorLabel = (sponsorName && String(sponsorName).trim()) || 'your sponsor';
  const hours = Number(otpValidityHours) > 0 ? Number(otpValidityHours) : OTP_VALIDITY_HOURS_DEFAULT;

  const handleOtpInput = (raw) => {
    const extracted = extractOtpFromText(raw, EMAIL_OTP_LENGTH);
    setOtp(extracted ?? String(raw ?? '').replace(/\D/g, '').slice(0, EMAIL_OTP_LENGTH));
    setErr(null);
  };

  const handleClose = () => {
    if (dismissed || closing || loading || resending) return;
    setDismissed(true);
    setClosing(true);
    try {
      void Promise.resolve(onClose?.()).finally(() => {
        setClosing(false);
      });
    } catch {
      setClosing(false);
    }
  };

  const submit = async () => {
    setErr(null);
    setInfo(null);
    if (expired) {
      setErr('OTP has expired. Resend a new code to your sponsor.');
      return;
    }
    if (!isValidEmailOtp(otp.trim())) {
      setErr(`Enter the 4-digit OTP from ${sponsorLabel}`);
      return;
    }
    setLoading(true);
    try {
      const result = await verifyUnifiedOtp({ userId, otp: otp.trim() });
      setDismissed(true);
      onVerified?.(result?.testimonial || result?.data);
    } catch (e) {
      const msg = e.message || `Invalid OTP. Please check with ${sponsorLabel}.`;
      setErr(msg);
      if (/expired/i.test(msg)) {
        onOtpMetaUpdate?.({ otpExpired: true });
      }
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    setErr(null);
    setInfo(null);
    setResending(true);
    try {
      const result = await resendUnifiedOtp({ userId });
      setOtp('');
      setExpiresAt(result?.otpExpiresAt ?? null);
      setInfo(result?.message || `New OTP sent to ${sponsorLabel}. Valid for ${hours} hours.`);
      onOtpMetaUpdate?.({
        otpExpiresAt: result?.otpExpiresAt ?? null,
        otpExpired: false,
        sponsorName: result?.sponsorName ?? sponsorName,
        testimonial: result?.testimonial,
      });
    } catch (e) {
      setErr(e.message || 'Could not resend OTP. Please try again.');
    } finally {
      setResending(false);
    }
  };

  if (dismissed) {
    return null;
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3 relative">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-amber-600 shrink-0" />
        <p className="text-sm font-semibold text-amber-800">
          Enter the 4-digit approval code sent to your sponsor {sponsorLabel} through email
        </p>
      </div>
      <p className="text-xs text-amber-700 leading-relaxed">
        Ask them to share the code. The OTP is valid for{' '}
        <span className="font-semibold">{hours} hours</span>.
      </p>
      {expired && (
        <p className="text-xs font-semibold text-red-600">
          This OTP has expired. Resend a new code to {sponsorLabel}.
        </p>
      )}
      {!expired && (
        <NativeInput
          otp
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="one-time-code"
          maxLength={EMAIL_OTP_LENGTH}
          placeholder="_ _ _ _"
          value={otp}
          onChange={(e) => handleOtpInput(e.target.value)}
          onPaste={(e) => {
            e.preventDefault();
            handleOtpInput(e.clipboardData?.getData('text') ?? '');
          }}
          className="w-full text-center text-2xl font-bold tracking-[0.4em] border-2 border-amber-300 rounded-xl py-3 focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
        />
      )}
      {err && <p className="text-xs text-red-600 text-center">{err}</p>}
      {info && <p className="text-xs text-emerald-700 text-center">{info}</p>}
      {!expired ? (
        <div className="flex items-center gap-3 w-full">
          {onClose && (
            <TouchFeedbackButton
              type="button"
              onClick={handleClose}
              disabled={closing || loading || resending}
              className="flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-600 active:bg-red-700 text-white text-sm font-bold disabled:opacity-60 transition-colors text-center"
              aria-label="Close OTP verification and revert changes"
            >
              {closing ? 'Closing\u2026' : 'Close'}
            </TouchFeedbackButton>
          )}
          <TouchFeedbackButton
            type="button"
            onClick={submit}
            disabled={loading || otp.length !== EMAIL_OTP_LENGTH}
            className={`${onClose ? 'flex-1' : 'w-full'} py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-sm font-bold disabled:opacity-60 transition-colors text-center`}
          >
            {loading ? 'Verifying\u2026' : 'Verify with OTP'}
          </TouchFeedbackButton>
        </div>
      ) : (
        <div className="flex items-center gap-3 w-full">
          {onClose && (
            <TouchFeedbackButton
              type="button"
              onClick={handleClose}
              disabled={closing || loading || resending}
              className="flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-600 active:bg-red-700 text-white text-sm font-bold disabled:opacity-60 transition-colors text-center"
              aria-label="Close OTP verification and revert changes"
            >
              {closing ? 'Closing\u2026' : 'Close'}
            </TouchFeedbackButton>
          )}
          <TouchFeedbackButton
            type="button"
            onClick={resend}
            disabled={resending}
            className={`${onClose ? 'flex-1' : 'w-full'} py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-sm font-bold disabled:opacity-60 transition-colors text-center`}
          >
            {resending ? 'Sending\u2026' : `Resend OTP to ${sponsorLabel}`}
          </TouchFeedbackButton>
        </div>
      )}
    </div>
  );
}

function afterWeightDiffers(beforeKg, afterKg) {
  const before = Number(beforeKg);
  const after = Number(afterKg);
  if (!Number.isFinite(before) || !Number.isFinite(after)) return false;
  return before !== after;
}

function DurationEditor({
  valueText,
  unit,
  onValueChange,
  onUnitChange,
  onCommit,
  onCancel,
}) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <NativeInput
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        autoFocus
        placeholder="e.g. 3"
        value={valueText ?? ''}
        onChange={(e) => onValueChange(sanitizeDurationDigits(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onCommit();
          }
          if (e.key === 'Escape') onCancel();
        }}
        className="w-16 border border-gray-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-green-400"
      />
      <select
        value={unit}
        onChange={(e) => onUnitChange(e.target.value)}
        className="border border-gray-300 rounded-lg px-1.5 py-1 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-green-400"
      >
        <option value="days">days</option>
        <option value="months">months</option>
      </select>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onCommit}
        className="text-green-600 hover:text-green-800 text-[11px] font-bold"
      >
        Save
      </button>
      <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-600">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function MemberCard({
  row,
  teamStats,
  editable = false,
  userId = null,
  coachId = null,
  onMineRefresh,
  onOtpVerified,
}) {
  const { user } = row;
  const [detailTestimonial, setDetailTestimonial] = useState(null);
  const detailInFlightRef = useRef(null);
  // Mine card: always prefer parent row after server refresh (photos + signed URLs).
  const testimonial = editable ? row.testimonial : (detailTestimonial || row.testimonial);
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

  // Download result videos to cache in the background so Share Video is instant.
  useEffect(() => {
    if (!testimonial?.healthVideoUrl && !testimonial?.businessVideoUrl) return undefined;
    void prefetchNativeResultVideos(testimonial);
    return undefined;
  }, [testimonial?.healthVideoUrl, testimonial?.businessVideoUrl]);

  const [expandedPhoto, setExpandedPhoto] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  // After is shown only when it is a different file from Before.
  const hasAfterImage = hasDistinctTransformationAfter(testimonial);
  const hasAfter = hasAfterImage
    && (
      testimonial?.status !== 'incomplete'
      || afterWeightDiffers(testimonial?.beforeWeightKg, testimonial?.afterWeightKg)
    );
  // ── Inline editing state (Mine card only) ────────────────────────────────
  const [expandedSlots, setExpandedSlots] = useState(new Set());
  const [draftBefore, setDraftBefore] = useState(null); // { imageBase64, previewUrl, weightKg, goalType, durationText }
  const [draftAfter, setDraftAfter] = useState(null); // { imageBase64, previewUrl, weightKg }
  const [draftHealthPath, setDraftHealthPath] = useState(null);
  const [draftBusinessPath, setDraftBusinessPath] = useState(null);
  const [draftHealthPreview, setDraftHealthPreview] = useState(null);
  const [draftBusinessPreview, setDraftBusinessPreview] = useState(null);

  // Baseline snapshot before unverified / pending edits were applied
  const baselineKey = userId ? `transformation_baseline_${userId}` : null;
  const baselineTestimonialRef = useRef(null);

  useEffect(() => {
    if (testimonial && testimonial.status !== 'pending' && !testimonial.hasPendingOtp && !testimonial.otpPending) {
      const snap = {
        status: testimonial.status,
        beforeImagePath: testimonial.beforeImagePath,
        afterImagePath: testimonial.afterImagePath,
        beforeWeightKg: testimonial.beforeWeightKg,
        afterWeightKg: testimonial.afterWeightKg,
        goalType: testimonial.goalType,
        durationText: testimonial.durationText,
        videoStatus: testimonial.videoStatus,
        healthVideoPath: testimonial.healthVideoPath,
        businessVideoPath: testimonial.businessVideoPath,
        beforeImageUrl: testimonial.beforeImageUrl,
        afterImageUrl: testimonial.afterImageUrl,
        healthVideoUrl: testimonial.healthVideoUrl,
        businessVideoUrl: testimonial.businessVideoUrl,
        verifiedAt: testimonial.verifiedAt,
      };
      baselineTestimonialRef.current = snap;
      if (baselineKey) {
        try {
          localStorage.setItem(baselineKey, JSON.stringify(snap));
        } catch { }
      }
    }
  }, [testimonial, baselineKey]);

  const clearDrafts = useCallback(() => {
    setDraftBefore((prev) => { revokeBlobUrl(prev?.previewUrl); return null; });
    setDraftAfter((prev) => { revokeBlobUrl(prev?.previewUrl); return null; });
    setDraftHealthPath(null);
    setDraftBusinessPath(null);
    setDraftHealthPreview((prev) => { revokeBlobUrl(prev); return null; });
    setDraftBusinessPreview((prev) => { revokeBlobUrl(prev); return null; });
    setBeforeWeightText(null);
    setAfterWeightText(null);
    setDurationValueText(null);
    setExpandedSlots(new Set());
  }, []);
  // Local text while weight/duration fields are open — needed for Android WebView typing
  const [beforeWeightText, setBeforeWeightText] = useState(null);
  const [afterWeightText, setAfterWeightText] = useState(null);
  const [durationValueText, setDurationValueText] = useState(null);
  const [durationUnitDraft, setDurationUnitDraft] = useState('months');
  const [uploadingHealth, setUploadingHealth] = useState(false);
  const [uploadingBusiness, setUploadingBusiness] = useState(false);
  const [pickerSlot, setPickerSlot] = useState(null); // 'collage' | 'before' | 'after' | null
  const [promptCopied, setPromptCopied] = useState(false);
  const [collageMetaOpen, setCollageMetaOpen] = useState(false);
  const [collageMetaError, setCollageMetaError] = useState(null);
  const [collageImageBroken, setCollageImageBroken] = useState(false);
  const [collageGuideOpen, setCollageGuideOpen] = useState(false);
  const [chatGptFlowActive, setChatGptFlowActive] = useState(false);
  const [chatGptModalOpen, setChatGptModalOpen] = useState(false);
  /** True only after user Saves the Transformation details form this session. */
  const [collageMetaSaved, setCollageMetaSaved] = useState(false);
  const collageGalRef = useRef(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingCollage, setDeletingCollage] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [videoUploadError, setVideoUploadError] = useState(null);
  const [videoSizeAlert, setVideoSizeAlert] = useState(null);
  const [submitDone, setSubmitDone] = useState(false);
  const [unifiedOtpVerified, setUnifiedOtpVerified] = useState(false);
  const [unifiedOtpDismissed, setUnifiedOtpDismissed] = useState(false);
  const [mediaEpoch, setMediaEpoch] = useState(0);

  useEffect(() => {
    setUnifiedOtpDismissed(false);
  }, [userId, testimonial?.id]);
  const shareCardRef = useRef(null);
  const compressBusyRef = useRef(false);
  const cropSlotRef = useRef('before');
  const coverCrop = usePortraitCoverCrop({
    onApply: (dataUrl, key) => {
      const slot = key === 'after' || key === 'before' ? key : cropSlotRef.current;
      const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
      const previewUrl = jpegDataUrlToObjectUrl(dataUrl) || dataUrl;
      const beforeBase = {
        weightKg: testimonial?.beforeWeightKg,
        goalType: testimonial?.goalType,
        durationText: testimonial?.durationText,
      };
      const afterBase = { weightKg: testimonial?.afterWeightKg };
      if (slot === 'before') {
        setDraftBefore((prev) => {
          revokeBlobUrl(prev?.previewUrl);
          return {
            ...(prev || beforeBase),
            previewUrl,
            imageBase64: base64,
            compressing: false,
          };
        });
      } else {
        setDraftAfter((prev) => {
          revokeBlobUrl(prev?.previewUrl);
          return {
            ...(prev || afterBase),
            previewUrl,
            imageBase64: base64,
            compressing: false,
          };
        });
      }
    },
    onError: (msg) => setSubmitError(msg || 'Could not read that photo. Please try another.'),
  });

  const healthVidRef = useRef(null);
  const businessVidRef = useRef(null);

  // dirtySlots: only include 'before'/'after' when new IMAGE was selected
  // weight/goal/duration-only changes still trigger Submit but don't appear in email photo diff
  const dirtySlots = [
    draftBefore?.imageBase64 && 'before',
    draftAfter?.imageBase64 && 'after',
    draftHealthPath && 'health',
    draftBusinessPath && 'business',
  ].filter(Boolean);
  // hasDirtySlots: true for ANY pending change including weight-only edits or video drafts
  const hasDirtySlots = dirtySlots.length > 0
    || (draftBefore != null && draftBefore.cleared !== true)
    || (draftAfter != null && draftAfter.cleared !== true)
    || !!draftHealthPreview
    || !!draftBusinessPreview
    || !!draftHealthPath
    || !!draftBusinessPath;
  const changedCount = Math.max(dirtySlots.length, hasDirtySlots ? 1 : 0);
  const anyVideoUploading = uploadingHealth || uploadingBusiness;

  // Prefer draft edits so the "Lost/Gained X kgs" badge updates live while editing
  const shownBeforeKg = draftBefore?.weightKg
    ?? testimonial?.beforeWeightKg
    ?? (editable ? user?.latestWeightKg : null);
  const displayBeforeKg = Number(shownBeforeKg ?? 0);
  const shownAfterKg = draftAfter?.weightKg
    ?? (hasAfter ? testimonial?.afterWeightKg : null)
    ?? testimonial?.afterWeightKg
    ?? shownBeforeKg;
  const displayAfterKg = Number(shownAfterKg ?? 0);
  const displayDuration = draftBefore?.durationText ?? testimonial?.durationText;
  const usableDuration = isUsableDurationText(displayDuration);
  const liveDiff = liveWeightDiffKg(displayBeforeKg, displayAfterKg);
  const diff = liveDiff;
  const weightIsLoss = isTransformationWeightLoss(displayBeforeKg, displayAfterKg);
  const collageClearedLocally = draftBefore?.cleared === true || draftAfter?.cleared === true;
  const hasAfterWeightKg = Number(draftAfter?.weightKg ?? testimonial?.afterWeightKg) > 0;
  const hasCollageMeta = !collageClearedLocally
    && displayBeforeKg > 0
    && hasAfterWeightKg
    && usableDuration;
  // Collage slot must not treat profile-seed Left photo as a ChatGPT collage.
  const hasUploadedCollageDraft = Boolean(
    draftBefore?.previewUrl
    || draftBefore?.imageBase64
    || draftAfter?.previewUrl
    || draftAfter?.imageBase64,
  );
  const hasStoredCollagePhoto = (
    (!isProfileSeededTransformation(testimonial) && hasStoredTransformationBefore(testimonial))
    || hasDistinctTransformationAfter(testimonial)
  );
  const hasCollageImage = !collageClearedLocally
    && !collageImageBroken
    && (hasUploadedCollageDraft || hasStoredCollagePhoto);

  const mediaVersion = `${testimonial?.updatedAt ?? testimonial?.id ?? ''}-${mediaEpoch}`;
  const beforeRaw = draftBefore?.previewUrl
    || withTestimonialMediaCacheBust(testimonial?.beforeImageUrl, mediaVersion);
  // New users: Profile Left fills Before, and After shows the same Left until
  // they upload a real After (product: Left in both frames by default).
  const afterRaw = draftAfter?.previewUrl
    || (hasAfterImage
      ? withTestimonialMediaCacheBust(testimonial?.afterImageUrl, mediaVersion)
      : null)
    || beforeRaw;
  const beforeImageSrc = useRevocableImageSrc(beforeRaw);
  const afterImageSrc = useRevocableImageSrc(afterRaw);

  // Photo-only drafts — weight/duration edits must NOT open this strip (Android focus loss)
  const hasPhotoDraft = Boolean(
    draftBefore?.previewUrl || draftBefore?.imageBase64
    || draftAfter?.previewUrl || draftAfter?.imageBase64
  );

  const parseWeightInput = useCallback((raw) => parseWeightKg(raw), []);

  const commitBeforeWeight = useCallback((raw) => {
    const v = parseWeightInput(raw);
    if (v == null) return;
    setDraftBefore((prev) => ({
      ...(prev || { goalType: testimonial?.goalType, durationText: testimonial?.durationText }),
      weightKg: v,
    }));
  }, [parseWeightInput, testimonial?.goalType, testimonial?.durationText]);

  const commitAfterWeight = useCallback((raw) => {
    const v = parseWeightInput(raw);
    if (v == null) return;
    setDraftAfter((prev) => ({ ...(prev || {}), weightKg: v }));
  }, [parseWeightInput]);

  const openBeforeWeightEdit = useCallback(() => {
    setBeforeWeightText(String(draftBefore?.weightKg ?? testimonial?.beforeWeightKg ?? user?.latestWeightKg ?? ''));
    setExpandedSlots((prev) => {
      const next = new Set(prev);
      next.add('beforeWeight');
      return next;
    });
  }, [draftBefore?.weightKg, testimonial?.beforeWeightKg, user?.latestWeightKg]);

  const closeBeforeWeightEdit = useCallback((raw) => {
    if (raw != null) commitBeforeWeight(raw);
    setBeforeWeightText(null);
    setExpandedSlots((prev) => {
      const next = new Set(prev);
      next.delete('beforeWeight');
      return next;
    });
  }, [commitBeforeWeight]);

  const openAfterWeightEdit = useCallback(() => {
    setAfterWeightText(String(draftAfter?.weightKg ?? testimonial?.afterWeightKg ?? user?.latestWeightKg ?? ''));
    setExpandedSlots((prev) => {
      const next = new Set(prev);
      next.add('afterWeight');
      return next;
    });
  }, [draftAfter?.weightKg, testimonial?.afterWeightKg, user?.latestWeightKg]);

  const closeAfterWeightEdit = useCallback((raw) => {
    if (raw != null) commitAfterWeight(raw);
    setAfterWeightText(null);
    setExpandedSlots((prev) => {
      const next = new Set(prev);
      next.delete('afterWeight');
      return next;
    });
  }, [commitAfterWeight]);

  const toggleSlot = useCallback((slot) => {
    setExpandedSlots(prev => {
      const next = new Set(prev);
      if (next.has(slot)) next.delete(slot); else next.add(slot);
      return next;
    });
  }, []);

  const openDurationEdit = useCallback(() => {
    const parsed = parseDurationText(draftBefore?.durationText ?? testimonial?.durationText);
    setDurationValueText(parsed.durationValue);
    setDurationUnitDraft(parsed.durationUnit);
    setExpandedSlots((prev) => {
      const next = new Set(prev);
      next.add('duration');
      return next;
    });
  }, [draftBefore?.durationText, testimonial?.durationText]);

  const closeDurationEdit = useCallback(() => {
    setDurationValueText(null);
    setExpandedSlots((prev) => {
      const next = new Set(prev);
      next.delete('duration');
      return next;
    });
  }, []);

  const commitDurationEdit = useCallback(() => {
    const err = validateDurationFields(durationUnitDraft, durationValueText);
    if (err) {
      setSubmitError(err);
      return;
    }
    const text = formatDurationText(durationUnitDraft, durationValueText);
    setDraftBefore((prev) => ({
      ...(prev || {
        weightKg: testimonial?.beforeWeightKg,
        goalType: testimonial?.goalType || 'loss',
      }),
      durationText: text,
    }));
    setSubmitError(null);
    closeDurationEdit();
  }, [closeDurationEdit, durationUnitDraft, durationValueText, testimonial?.beforeWeightKg, testimonial?.goalType]);

  const openCollageMetaForm = useCallback(({ forChatGpt = false } = {}) => {
    setCollageMetaError(null);
    setBeforeWeightText(String(
      draftBefore?.weightKg ?? testimonial?.beforeWeightKg ?? user?.latestWeightKg ?? '',
    ));
    setAfterWeightText(String(
      draftAfter?.weightKg ?? testimonial?.afterWeightKg ?? '',
    ));
    const rawBefore = draftBefore?.weightKg ?? testimonial?.beforeWeightKg ?? user?.latestWeightKg;
    const rawAfter = draftAfter?.weightKg ?? testimonial?.afterWeightKg;
    setBeforeWeightText(Number(rawBefore) > 0 ? String(rawBefore) : '');
    setAfterWeightText(Number(rawAfter) > 0 ? String(rawAfter) : '');
    const parsed = parseDurationText(draftBefore?.durationText ?? testimonial?.durationText);
    setDurationValueText(parsed.durationValue);
    setDurationUnitDraft(parsed.durationUnit);
    setChatGptFlowActive(Boolean(forChatGpt));
    setCollageGuideOpen(false);
    setCollageMetaOpen(true);
    setPickerSlot(null);
  }, [
    draftAfter?.weightKg,
    draftBefore?.durationText,
    draftBefore?.weightKg,
    testimonial?.afterWeightKg,
    testimonial?.beforeWeightKg,
    testimonial?.durationText,
    user?.latestWeightKg,
  ]);

  const closeCollageMetaForm = useCallback(() => {
    setCollageMetaOpen(false);
    setChatGptFlowActive(false);
    setCollageMetaError(null);
  }, []);

  const submitCollageMetaForm = useCallback(async () => {
    const beforeKg = parseWeightInput(beforeWeightText);
    const afterKg = parseWeightInput(afterWeightText);
    if (beforeKg == null) {
      setCollageMetaError('Enter a valid before weight.');
      return;
    }
    if (afterKg == null) {
      setCollageMetaError('Enter a valid after weight.');
      return;
    }
    const durationErr = validateDurationFields(durationUnitDraft, durationValueText);
    if (durationErr) {
      setCollageMetaError(durationErr);
      return;
    }
    const durationText = formatDurationText(durationUnitDraft, durationValueText);
    const goalType = beforeKg >= afterKg ? 'loss' : 'gain';
    setDraftBefore((prev) => {
      const { cleared: _cleared, ...rest } = prev || {};
      return {
        ...rest,
        weightKg: beforeKg,
        durationText,
        goalType,
      };
    });
    setDraftAfter((prev) => {
      const { cleared: _cleared, ...rest } = prev || {};
      return {
        ...rest,
        weightKg: afterKg,
      };
    });
    setSubmitError(null);
    setCollageMetaError(null);
    setCollageMetaOpen(false);
    setCollageImageBroken(false);
    setCollageMetaSaved(true);
    setPromptCopied(false);
    setCollageGuideOpen(!hasCollageImage);
    setCollageGuideOpen(chatGptFlowActive || !hasCollageImage);
    setChatGptFlowActive(false);
    setPickerSlot(null);
  }, [
    afterWeightText,
    beforeWeightText,
    chatGptFlowActive,
    durationUnitDraft,
    durationValueText,
    hasCollageImage,
    parseWeightInput,
  ]);

  const clearCollageSlot = useCallback(async () => {
    if (deletingCollage) return;
    setSubmitError(null);
    const hasPersistedRow = Boolean(testimonial?.id && userId);
    if (hasPersistedRow) {
      setDeletingCollage(true);
      try {
        const res = await deleteTestimonialPhoto({ userId });
        baselineTestimonialRef.current = null;
        if (baselineKey) {
          try {
            localStorage.removeItem(baselineKey);
          } catch {
            // ignore storage errors
          }
        }
        setDraftBefore((prev) => {
          revokeBlobUrl(prev?.previewUrl);
          return null;
        });
        setDraftAfter((prev) => {
          revokeBlobUrl(prev?.previewUrl);
          return null;
        });
        setBeforeWeightText(null);
        setAfterWeightText(null);
        setDurationValueText(null);
        setUnifiedOtpVerified(false);
        setUnifiedOtpDismissed(true);
        setSubmitDone(false);
        if (typeof onMineRefresh === 'function') {
          const nextRow = res?.testimonial
            ? { ...res.testimonial, photosFromProfileSeed: false }
            : {
              id: null,
              beforeImageUrl: null,
              afterImageUrl: null,
              beforeWeightKg: 0,
              afterWeightKg: 0,
              durationText: '—',
              status: 'incomplete',
              hasPendingOtp: false,
              otpPending: false,
              otpExpired: false,
              otpExpiresAt: null,
              recoveredHealthIssues: [],
              healthVideoPath: null,
              businessVideoPath: null,
              healthVideoUrl: null,
              businessVideoUrl: null,
              videoStatus: 'none',
              photosFromProfileSeed: false,
            };
          await onMineRefresh(nextRow);
        }
      } catch (err) {
        setSubmitError(err?.message || 'Could not delete transformation. Please try again.');
        setDeletingCollage(false);
        return;
      } finally {
        setDeletingCollage(false);
      }
    } else {
      setDraftBefore((prev) => {
        revokeBlobUrl(prev?.previewUrl);
        return { cleared: true };
      });
      setDraftAfter((prev) => {
        revokeBlobUrl(prev?.previewUrl);
        return { cleared: true };
      });
      setBeforeWeightText(null);
      setAfterWeightText(null);
      setDurationValueText(null);
    }
    setPickerSlot(null);
    setCollageMetaOpen(false);
    setCollageGuideOpen(false);
    setCollageImageBroken(false);
    setCollageMetaSaved(false);
    setPromptCopied(false);
  }, [baselineKey, deletingCollage, onMineRefresh, testimonial?.id, userId]);

  const openPhotoPicker = useCallback((inputRef) => {
    setCaptureFlowBusy(true);
    setPickerSlot(null);
    inputRef?.current?.click();
    const onFocus = () => {
      window.removeEventListener('focus', onFocus);
      window.setTimeout(() => {
        if (!compressBusyRef.current) setCaptureFlowBusy(false);
      }, 400);
    };
    window.addEventListener('focus', onFocus);
  }, []);

  const handleImageFile = useCallback((slot, file) => {
    if (!file) return;
    cropSlotRef.current = slot;
    setPickerSlot(null);
    setSubmitError(null);
    void coverCrop.pickFile(file, slot);
  }, [coverCrop]);

  /** ChatGPT Before|After|Now collage → one slot; stored as before+after for existing save/OTP. */
  const handleCollageFile = useCallback(async (file) => {
    if (!file) return;
    setPickerSlot(null);
    setSubmitError(null);
    setCollageImageBroken(false);
    setCollageGuideOpen(false);
    setCaptureFlowBusy(true);
    const beforeBase = {
      weightKg: testimonial?.beforeWeightKg,
      goalType: testimonial?.goalType,
      durationText: testimonial?.durationText,
    };
    const afterBase = { weightKg: testimonial?.afterWeightKg };
    setDraftBefore((prev) => {
      const { cleared: _cleared, ...rest } = prev || beforeBase;
      return { ...rest, compressing: true };
    });
    setDraftAfter((prev) => {
      const { cleared: _cleared, ...rest } = prev || afterBase;
      return { ...rest, compressing: true };
    });
    try {
      const { base64, preview } = await compressImage(file, {
        allowLandscape: true,
        maxDim: 1920,
      });
      const previewBefore = jpegDataUrlToObjectUrl(preview) || preview;
      const previewAfter = jpegDataUrlToObjectUrl(preview) || preview;
      setDraftBefore((prev) => {
        revokeBlobUrl(prev?.previewUrl);
        const { cleared: _cleared, ...rest } = prev || beforeBase;
        return {
          ...rest,
          previewUrl: previewBefore,
          imageBase64: base64,
          compressing: false,
        };
      });
      setDraftAfter((prev) => {
        revokeBlobUrl(prev?.previewUrl);
        const { cleared: _cleared, ...rest } = prev || afterBase;
        return {
          ...rest,
          previewUrl: previewAfter,
          imageBase64: base64,
          compressing: false,
        };
      });
    } catch (err) {
      setSubmitError(err?.message || 'Could not read that collage. Please try another image.');
      setDraftBefore((prev) => (prev ? { ...prev, compressing: false } : null));
      setDraftAfter((prev) => (prev ? { ...prev, compressing: false } : null));
    } finally {
      setCaptureFlowBusy(false);
    }
  }, [testimonial?.afterWeightKg, testimonial?.beforeWeightKg, testimonial?.durationText, testimonial?.goalType]);

  const handleAdjustExisting = useCallback((slot) => {
    const src = slot === 'after'
      ? (draftAfter?.previewUrl || testimonial?.afterImageUrl)
      : (draftBefore?.previewUrl || testimonial?.beforeImageUrl);
    if (!src) return;
    cropSlotRef.current = slot;
    setPickerSlot(null);
    setSubmitError(null);
    void coverCrop.recrop(src, slot);
  }, [coverCrop, draftAfter?.previewUrl, draftBefore?.previewUrl, testimonial?.afterImageUrl, testimonial?.beforeImageUrl]);

  const handleVideoFile = useCallback(async (slot, file) => {
    const numericUserId = Number(userId);
    if (!numericUserId) {
      setVideoUploadError('Cannot upload video: user ID is missing. Please refresh the page.');
      return;
    }
    setVideoUploadError(null);

    // Restrict photos / non-video files: only video files are allowed
    const isImage = file.type?.startsWith('image/') || /\.(jpe?g|png|gif|webp|bmp|heic|heif|svg)$/i.test(file.name || '');
    const isVideo = file.type?.startsWith('video/') || /\.(mp4|mov|webm|3gp|mkv|avi|m4v)$/i.test(file.name || '');
    if (isImage || !isVideo) {
      setVideoUploadError('Only video files are allowed for results. Photos and images are not allowed.');
      return;
    }

    setCaptureFlowBusy(true);
    const localUrl = URL.createObjectURL(file);
    if (slot === 'health') {
      setDraftHealthPreview((prev) => { revokeBlobUrl(prev); return localUrl; });
      setDraftHealthPath(null);
      setUploadingHealth(true);
    } else {
      setDraftBusinessPreview((prev) => { revokeBlobUrl(prev); return localUrl; });
      setDraftBusinessPath(null);
      setUploadingBusiness(true);
    }
    try {
      const normalized = await normalizeVideoUploadFile(file);
      const maxBytes = maxVideoMbForSlot(slot) * 1024 * 1024;
      const compressed = await compressVideoToMaxBytes(normalized, maxBytes);
      if (isVideoOverSizeLimit(compressed, slot)) {
        setVideoSizeAlert(videoTooLargeMessage(slot));
        if (slot === 'health') {
          setDraftHealthPreview((prev) => { revokeBlobUrl(prev); return null; });
          setDraftHealthPath(null);
        } else {
          setDraftBusinessPreview((prev) => { revokeBlobUrl(prev); return null; });
          setDraftBusinessPath(null);
        }
        return;
      }
      const prep = await prepareTestimonialVideoUpload({
        userId: numericUserId,
        uploadHealth: slot === 'health',
        uploadBusiness: slot === 'business',
      });
      const info = slot === 'health' ? prep?.health : prep?.business;
      if (!info?.path || !info?.sessionId) {
        throw new Error('Server did not return a valid upload path. Please try again.');
      }
      const uploadPromise = uploadTestimonialVideoInChunks(compressed, info, slot, numericUserId);
      uploadPromise.catch(() => { });
      const path = await Promise.race([
        uploadPromise,
        new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error('Video upload timed out. Please try a smaller MP4 file.'));
          }, 180000);
        }),
      ]);
      if (slot === 'health') setDraftHealthPath(path);
      else setDraftBusinessPath(path);
    } catch (err) {
      const msg = err?.message || '';
      const isTooLarge = /max of \d+ MB|exceeds \d+ MB/i.test(msg);
      if (isTooLarge) {
        setVideoSizeAlert(videoTooLargeMessage(slot));
      } else {
        const isNoCoach = msg.toLowerCase().includes('no coach');
        setVideoUploadError(
          isNoCoach
            ? 'You do not have a sponsor assigned yet. Please ask your admin to assign a sponsor before uploading videos.'
            : (msg || 'Video upload failed. Please try again.')
        );
      }
      if (slot === 'health') {
        setDraftHealthPreview((prev) => { revokeBlobUrl(prev); return null; });
        setDraftHealthPath(null);
      } else {
        setDraftBusinessPreview((prev) => { revokeBlobUrl(prev); return null; });
        setDraftBusinessPath(null);
      }
    } finally {
      setCaptureFlowBusy(false);
      if (slot === 'health') setUploadingHealth(false);
      else setUploadingBusiness(false);
    }
  }, [userId]);

  const handleSubmitAll = useCallback(() => {
    if (testimonial && (testimonial.status === 'verified' || testimonial.verifiedAt || hasAfter)) {
      const snap = {
        status: testimonial.status || 'verified',
        verifiedAt: testimonial.verifiedAt || new Date().toISOString(),
        beforeImagePath: testimonial.beforeImagePath,
        afterImagePath: testimonial.afterImagePath,
        beforeWeightKg: testimonial.beforeWeightKg,
        afterWeightKg: testimonial.afterWeightKg,
        goalType: testimonial.goalType,
        durationText: testimonial.durationText,
        recoveredHealthIssues: testimonial.recoveredHealthIssues,
        videoStatus: testimonial.videoStatus,
        healthVideoPath: testimonial.healthVideoPath,
        businessVideoPath: testimonial.businessVideoPath,
        beforeImageUrl: testimonial.beforeImageUrl,
        afterImageUrl: testimonial.afterImageUrl,
        healthVideoUrl: testimonial.healthVideoUrl,
        businessVideoUrl: testimonial.businessVideoUrl,
      };
      baselineTestimonialRef.current = snap;
      if (baselineKey) {
        try {
          localStorage.setItem(baselineKey, JSON.stringify(snap));
        } catch { }
      }
    }

    const photoOrVideoChanged = dirtySlots.some((s) => ['before', 'after', 'health', 'business'].includes(s));
    const hasResultVideo = Boolean(
      testimonial?.healthVideoPath || testimonial?.businessVideoPath
      || testimonial?.healthVideoUrl || testimonial?.businessVideoUrl,
    );
    // Profile-seeded URLs look like Before/After but are not on the testimonial row.
    const hasVisiblePhotoCard = hasStoredTransformationPhotoCard(testimonial);
    const afterWeightDirty = draftAfter?.weightKg !== undefined
      && afterWeightDiffers(testimonial?.beforeWeightKg, draftAfter.weightKg);
    const isSilentSave = !photoOrVideoChanged && !afterWeightDirty
      && !hasVisiblePhotoCard;
    // Photos still compressing — wait so we do not submit without image bytes.
    if (draftBefore?.compressing || draftAfter?.compressing || coverCrop.isPreparing) {
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

    const durationForSubmit = String(draftBefore?.durationText ?? testimonial?.durationText ?? '').trim();
    const usableDurationForSubmit = isUsableDurationText(durationForSubmit)
      ? durationForSubmit
      : '';

    const payload = {
      userId,
      dirtySlots,
      submitForApproval: !isSilentSave,
      ...(draftBefore ? {
        ...(draftBefore.imageBase64 ? { beforeImageBase64: draftBefore.imageBase64 } : {}),
        ...(draftBefore.weightKg !== undefined ? { beforeWeightKg: draftBefore.weightKg } : {}),
        // Always send goal on drafts — UI may show "Weight Loss" without writing state
        goalType: draftBefore.goalType || testimonial?.goalType || 'loss',
        ...(usableDurationForSubmit ? { durationText: usableDurationForSubmit } : {}),
      } : {}),
      ...(draftAfter ? {
        ...(draftAfter.imageBase64 ? { afterImageBase64: draftAfter.imageBase64 } : {}),
        ...(draftAfter.weightKg !== undefined ? { afterWeightKg: draftAfter.weightKg } : {}),
      } : {}),
      ...(draftHealthPath ? { healthVideoPath: draftHealthPath } : {}),
      ...(draftBusinessPath ? { businessVideoPath: draftBusinessPath } : {}),
      ...(!draftBefore && usableDurationForSubmit ? { durationText: usableDurationForSubmit } : {}),
    };
    const visibleBeforeUrl = draftBefore?.previewUrl && /^https?:\/\//i.test(draftBefore.previewUrl)
      ? draftBefore.previewUrl
      : testimonial?.beforeImageUrl;
    // Default Left-in-both: After display may reuse Before until a real After upload.
    const visibleAfterUrl = draftAfter?.previewUrl && /^https?:\/\//i.test(draftAfter.previewUrl)
      ? draftAfter.previewUrl
      : (hasAfterImage ? testimonial?.afterImageUrl : visibleBeforeUrl);
    if (!draftBefore?.imageBase64 && typeof visibleBeforeUrl === 'string') {
      payload.displayedBeforeUrl = visibleBeforeUrl;
    }
    if (!draftAfter?.imageBase64 && typeof visibleAfterUrl === 'string') {
      payload.displayedAfterUrl = visibleAfterUrl;
    }
    if (
      payload.beforeWeightKg === undefined
      && (payload.afterWeightKg !== undefined || payload.durationText)
    ) {
      const beforeKg = Number(testimonial?.beforeWeightKg ?? displayBeforeKg);
      if (Number.isFinite(beforeKg) && beforeKg > 0) {
        payload.beforeWeightKg = beforeKg;
      }
    }

    const approvalReadyBefore = hasApprovalReadyBeforePhoto({ testimonial, draftBefore });
    // New users / profile-seeded cards must upload Transformation Before so OTP can start.
    if (!isSilentSave && !approvalReadyBefore) {
      setSubmitError('Add a Before photo on this Transformation card, then submit for approval.');
      return;
    }

    // Visible Before+After (stored Transformation photos or drafts) needs duration + OTP.
    const willComplete =
      Boolean(draftBefore?.imageBase64 || (hasVisiblePhotoCard && testimonial?.beforeImageUrl))
      && Boolean(draftAfter?.imageBase64 || (hasVisiblePhotoCard && testimonial?.afterImageUrl) || hasAfter);
    const submittingPhotoCard = Boolean(hasVisiblePhotoCard || willComplete || afterWeightDirty || approvalReadyBefore);
    if (submittingPhotoCard && !usableDurationForSubmit) {
      setSubmitError('Add a duration in days or months (e.g. 3 months) before submitting.');
      return;
    }

    // First-time submit needs the before image bytes in the payload.
    if (!testimonial?.id && dirtySlots.includes('before') && !draftBefore?.imageBase64) {
      setSubmitError('Before photo failed to prepare. Please pick it again.');
      return;
    }

    setSubmitError(null);

    const reloadMine = async (patchedTestimonial) => {
      if (typeof onMineRefresh === 'function') {
        await onMineRefresh(patchedTestimonial || null);
      }
      setMediaEpoch((n) => n + 1);
    };

    const finishSubmit = async (result) => {
      // Prefer explicit otpSent from API; fall back to pending OTP fields if older responses omit it.
      const otpSent = result?.otpSent === true
        || (result?.otpSent == null && Boolean(
          result?.testimonial?.hasPendingOtp
          || result?.testimonial?.otpPending
          || result?.otpExpiresAt,
        ));
      const patched = result?.testimonial
        ? {
          ...result.testimonial,
          sponsorName: result.sponsorName ?? result.testimonial.sponsorName ?? null,
          otpExpiresAt: result.otpExpiresAt ?? result.testimonial.otpExpiresAt ?? null,
          otpValidityHours: result.otpValidityHours ?? result.testimonial.otpValidityHours ?? 24,
          otpExpired: false,
          hasPendingOtp: otpSent || Boolean(
            result.testimonial.hasPendingOtp || result.testimonial.otpPending,
          ),
        }
        : null;
      if (!isSilentSave && !otpSent) {
        const saved = result?.testimonial;
        const waitingForOtherPhoto = Boolean(saved) && !hasDistinctTransformationAfter(saved);
        if (waitingForOtherPhoto && (hasStoredTransformationBefore(saved) || saved.beforeImageUrl || saved.afterImageUrl)) {
          const cleared = hasStoredTransformationBefore(saved)
            ? { ...patched, photosFromProfileSeed: false }
            : patched;
          clearDrafts();
          void reloadMine(cleared);
          setSubmitError(
            'Add a different After photo (change the right photo), then tap Submit for Approval again.',
          );
          return;
        }
        const hasDuration = Boolean(usableDurationForSubmit);
        setSubmitError(
          hasDuration
            ? 'Coach approval did not start. Change the After photo (right side), then tap Submit again.'
            : 'Coach approval did not start. Add a duration in days or months, then submit again.',
        );
        return;
      }
      clearDrafts();
      // Show OTP immediately from submit response; refresh media/profile in background.
      if (otpSent || patched?.hasPendingOtp) {
        setUnifiedOtpDismissed(false);
        setUnifiedOtpVerified(false);
        setSubmitDone(true);
      }
      void reloadMine(patched);
      if (userId) {
        void getProfile({ userId, cacheBust: true }).catch(() => {
          // Non-fatal — Profile reloads on next open with cache bust.
        });
      }
    };

    // Weight / issues only — still show OTP when the server emailed a code.
    if (isSilentSave) {
      void submitAllEdits(payload)
        .then(finishSubmit)
        .catch((err) => {
          setSubmitError(err?.message || 'Failed to save. Please try again.');
        });
      return;
    }

    // Photo / video changes — return OTP as soon as the API responds.
    // Server composes the share card + emails the coach after the response (waitUntil).
    // Skip client html2canvas here so Submit is not blocked on card capture.
    setIsSubmitting(true);
    setCaptureFlowBusy(true);
    void submitAllEdits(payload)
      .then(finishSubmit)
      .catch((err) => {
        setSubmitError(err?.message || 'Failed to submit. Please try again.');
      })
      .finally(() => {
        setIsSubmitting(false);
        setCaptureFlowBusy(false);
      });
  }, [userId, dirtySlots, draftBefore, draftAfter, draftHealthPath, draftBusinessPath, onMineRefresh, hasAfter, displayBeforeKg, coverCrop.isPreparing, testimonial?.id, testimonial?.beforeImageUrl, testimonial?.afterImageUrl, testimonial?.beforeWeightKg, testimonial?.afterWeightKg, testimonial?.goalType, testimonial?.durationText, testimonial?.healthVideoPath, testimonial?.businessVideoPath, testimonial?.healthVideoUrl, testimonial?.businessVideoUrl]);

  const anyPhotoCompressing = Boolean(
    draftBefore?.compressing || draftAfter?.compressing || coverCrop.isPreparing,
  );

  const showUnifiedOtp = editable
    && !unifiedOtpDismissed
    && !unifiedOtpVerified
    && (submitDone
      || Boolean(testimonial?.hasPendingOtp)
      || Boolean(testimonial?.otpPending));

  const handleUnifiedOtpVerified = useCallback((verifiedTestimonial = null) => {
    setUnifiedOtpDismissed(true);
    setSubmitDone(false);
    setUnifiedOtpVerified(true);
    if (typeof onMineRefresh === 'function') {
      void onMineRefresh({
        ...(testimonial || {}),
        ...(verifiedTestimonial || {}),
        status: 'verified',
        hasPendingOtp: false,
        otpPending: false,
        otpExpired: false,
        otpExpiresAt: null,
      });
    }
    onOtpVerified?.();
  }, [onOtpVerified, onMineRefresh, testimonial]);

  const handleUnifiedOtpClose = useCallback(async () => {
    setUnifiedOtpDismissed(true);
    clearDrafts();
    setSubmitDone(false);
    setUnifiedOtpVerified(true);
    setSubmitError(null);

    let baseline = baselineTestimonialRef.current;
    if (!baseline && baselineKey) {
      try {
        const stored = localStorage.getItem(baselineKey);
        if (stored) baseline = JSON.parse(stored);
      } catch { }
    }

    if (typeof onMineRefresh === 'function') {
      void onMineRefresh({
        ...(testimonial || {}),
        ...(baseline || {}),
        status: baseline?.status || 'verified',
        hasPendingOtp: false,
        otpPending: false,
        otpExpired: false,
        otpExpiresAt: null,
      });
    }

    try {
      const result = await cancelUnifiedOtp({
        userId,
        restoreData: baseline || undefined,
      });
      const reverted = result?.testimonial || baseline;
      if (reverted && typeof onMineRefresh === 'function') {
        await onMineRefresh({
          ...(testimonial || {}),
          ...reverted,
          status: reverted.status || 'verified',
          hasPendingOtp: false,
          otpPending: false,
          otpExpired: false,
          otpExpiresAt: null,
        });
      }
    } catch {
      if (typeof onMineRefresh === 'function') {
        await onMineRefresh({
          ...(testimonial || {}),
          ...(baseline || {}),
          status: baseline?.status || 'verified',
          hasPendingOtp: false,
          otpPending: false,
          otpExpired: false,
          otpExpiresAt: null,
        });
      }
    }
  }, [userId, clearDrafts, onMineRefresh, testimonial, baselineKey]);

  const handleUnifiedOtpMetaUpdate = useCallback(async (meta) => {
    if (!meta) return;
    if (meta.testimonial && typeof onMineRefresh === 'function') {
      await onMineRefresh({
        ...meta.testimonial,
        sponsorName: meta.sponsorName ?? meta.testimonial.sponsorName ?? null,
        otpExpiresAt: meta.otpExpiresAt ?? meta.testimonial.otpExpiresAt ?? null,
        otpExpired: meta.otpExpired ?? meta.testimonial.otpExpired ?? false,
        hasPendingOtp: true,
      });
      return;
    }
    if (typeof onMineRefresh === 'function' && testimonial) {
      await onMineRefresh({
        ...testimonial,
        ...meta,
        hasPendingOtp: true,
      });
    }
  }, [onMineRefresh, testimonial]);

  const prepareShareCard = useCallback(async () => {
    const full = await ensureDetail();
    return full;
  }, [ensureDetail]);

  const isVerified = testimonial?.status === 'verified';
  const resultVideoUrl = resolveResultVideoUrl(testimonial);
  const healthVideoThumb = getCachedVideoThumbnail(testimonial?.healthVideoUrl);
  const businessVideoThumb = getCachedVideoThumbnail(testimonial?.businessVideoUrl);

  const loadHealthVideoUrl = useCallback(async () => {
    const full = await ensureDetail();
    return full?.healthVideoUrl || testimonial?.healthVideoUrl || null;
  }, [ensureDetail, testimonial?.healthVideoUrl]);

  const loadBusinessVideoUrl = useCallback(async () => {
    const full = await ensureDetail();
    return full?.businessVideoUrl || testimonial?.businessVideoUrl || null;
  }, [ensureDetail, testimonial?.businessVideoUrl]);


  const borderCls =
    level === UPLOAD_FILTERS.FULLY_UPLOADED ? 'border-green-300'
      : level === UPLOAD_FILTERS.PARTIAL ? 'border-amber-300'
        : 'border-gray-200';

  const bgCls =
    level === UPLOAD_FILTERS.FULLY_UPLOADED ? 'bg-gradient-to-b from-green-50/60 to-white'
      : level === UPLOAD_FILTERS.PARTIAL ? 'bg-gradient-to-b from-amber-50/50 to-white'
        : 'bg-white';

  const shareCardTestimonial = testimonial ? {
    ...testimonial,
    beforeImageUrl: beforeImageSrc,
    afterImageUrl: afterImageSrc,
    beforeWeightKg: displayBeforeKg || testimonial.beforeWeightKg,
    afterWeightKg: displayAfterKg || testimonial.afterWeightKg,
    goalType: draftBefore?.goalType || testimonial.goalType,
    durationText: (
      isUsableDurationText(draftBefore?.durationText)
        ? draftBefore.durationText
        : testimonial.durationText
    ),
    // Mine collage slot: one ChatGPT Before|After|Now image in share card.
    shareAsCollage: true,
  } : null;
  const shareCardUserName = user?.userName || user?.displayName || user?.name || null;
  const showBrandedCard = Boolean(shareCardTestimonial && (beforeImageSrc || afterImageSrc));
  // Share only after coach approval. Hide while Mine has unsaved edits or OTP in flight.
  const canSharePhoto =
    canShareTransformationPhoto(testimonial)
    && !(editable && (hasDirtySlots || showUnifiedOtp));
  const canShareVideo = Boolean(
    testimonial?.videoStatus === 'verified'
    && Boolean(resultVideoUrl || testimonial?.healthVideoPath || testimonial?.businessVideoPath)
  );

  return (
    <div className={`rounded-3xl border ${borderCls} ${bgCls} shadow-md overflow-visible`}>
      {coverCrop.overlay}
      {/* Header strip — Direct/Full photo share top-right (Mine uses Transformation card row) */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <MemberAvatar
          user={user}
          onViewProfile={user?.userId != null ? () => setProfileOpen(true) : undefined}
        />
        <div className="flex-1 min-w-0">
          <TeamComplianceSection
            userName={user.userName}
            teamStats={teamStats}
            onProfileClick={user?.userId != null ? () => setProfileOpen(true) : undefined}
          />
          <div className="mt-0.5">
            <CompletenessBadge level={level} filledCount={filledCount} totalSlots={totalSlots} />
          </div>
        </div>
        {!editable && canSharePhoto && (
          <TransformationShareActions
            variant="icon"
            kind="photo"
            cardRef={shareCardRef}
            userName={user.userName}
            testimonial={shareCardTestimonial}
            onBeforeAction={prepareShareCard}
          />
        )}
      </div>
      <div className="px-4 pb-4 space-y-3">

        {/* Transformation collage — + → weight form → ChatGPT prompt → upload */}
        {(editable || (!showBrandedCard && testimonial && (testimonial.beforeImageUrl || testimonial.afterImageUrl))) && (
          <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
            <div className="flex items-center justify-between px-3 pt-3 pb-2 gap-2">
              <div className="w-20 shrink-0 flex items-center justify-start">
                {isVerified && hasCollageImage ? (
                  <span
                    className="h-7 w-7 rounded-full bg-green-500 text-white shadow flex items-center justify-center"
                    aria-label="Verified"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                ) : null}
              </div>
              <p className="min-w-0 text-sm font-bold text-gray-900 text-center">
                Transformation
              </p>
              <div className="w-20 shrink-0 flex items-center justify-end gap-1.5">
                {editable && (hasCollageMeta || hasCollageImage) ? (
                  <>
                    <button
                      type="button"
                      onClick={() => openCollageMetaForm({ forChatGpt: false })}
                      disabled={deletingCollage}
                      className="h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-full bg-gray-800 text-white disabled:opacity-50"
                      aria-label="Edit transformation details"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => { void clearCollageSlot(); }}
                      disabled={deletingCollage}
                      className="h-8 w-8 shrink-0 inline-flex items-center justify-center rounded-full bg-red-50 text-red-600 border border-red-100 disabled:opacity-50"
                      aria-label="Delete transformation"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </>
                ) : null}
              </div>
            </div>

            <div className="relative px-3 pb-3">
              {hasCollageImage ? (
                <button
                  type="button"
                  onClick={() => setExpandedPhoto({
                    url: beforeImageSrc || afterImageSrc,
                    label: `${user.userName} — Transformation`,
                  })}
                  className="w-full overflow-hidden rounded-xl"
                >
                  <img
                    key={`collage-${beforeImageSrc || afterImageSrc}`}
                    src={beforeImageSrc || afterImageSrc}
                    alt=""
                    className={`${COLLAGE_IMAGE_CLASS} w-full cursor-zoom-in`}
                    onError={() => setCollageImageBroken(true)}
                    onLoad={() => setCollageImageBroken(false)}
                  />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={editable ? () => openPhotoPicker(collageGalRef) : undefined}
                  className={`${COLLAGE_IMAGE_CLASS} w-full min-h-[9rem] flex flex-col items-center justify-center gap-1 border-2 border-dashed ${editable ? 'border-green-300 hover:bg-green-50' : 'border-gray-200'} transition-colors`}
                >
                  {editable ? (
                    <>
                      <Plus className="h-7 w-7 text-green-400" />
                      <span className="text-[10px] font-bold text-green-700 px-2">
                        {promptCopied ? 'Prompt copied — tap to upload collage' : 'Tap to add photo'}
                      </span>
                    </>
                  ) : (
                    <AlertCircle className="h-5 w-5 text-gray-300" />
                  )}
                </button>
              )}

              {(draftBefore?.compressing || draftAfter?.compressing) && (
                <div className="absolute inset-3 bg-black/50 rounded-xl flex items-center justify-center z-10">
                  <div className="flex flex-col items-center gap-1">
                    <div className="h-5 w-5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                    <span className="text-white text-[10px] font-bold">Preparing…</span>
                  </div>
                </div>
              )}
            </div>

            {editable && !collageMetaOpen && (
              <div className="px-3 pb-3">
                <button
                  type="button"
                  onClick={() => openCollageMetaForm({ forChatGpt: true })}
                  className="w-full py-2.5 px-3 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Images className="h-3.5 w-3.5 shrink-0" />
                  Create transformation image through ChatGPT
                </button>
              </div>
            )}

            {editable && hasCollageImage && collageMetaOpen && (
              <div className="px-3 pb-3 flex justify-center">
                <button
                  type="button"
                  onClick={() => openPhotoPicker(collageGalRef)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-green-300 bg-green-50 text-green-800 text-xs font-bold"
                >
                  <Images className="h-3.5 w-3.5" /> Change photo
                </button>
              </div>
            )}

            {editable && pickerSlot === 'collage' && (
              <div className="px-3 pb-3 flex flex-wrap gap-1.5 justify-center">
                <button
                  type="button"
                  onClick={() => openPhotoPicker(collageGalRef)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-green-600 text-white text-[10px] font-bold"
                >
                  <Images className="h-3 w-3" /> Gallery / Paste
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const prompt = buildCollageChatGptPrompt({
                        beforeWeightKg: shownBeforeKg,
                        afterWeightKg: shownAfterKg,
                        durationText: usableDuration ? displayDuration : '',
                      });
                      const ok = await copyTransformCollagePrompt(prompt);
                      if (!ok) throw new Error('Clipboard unavailable');
                      setPromptCopied(true);
                      window.setTimeout(() => setPromptCopied(false), 2500);
                    } catch {
                      setSubmitError('Could not copy prompt.');
                    }
                  }}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-green-300 text-green-800 text-[10px] font-bold"
                >
                  <Share2 className="h-3 w-3" /> {promptCopied ? 'Copied' : 'Copy prompt'}
                </button>
                <button
                  type="button"
                  onClick={() => setPickerSlot(null)}
                  className="px-2 py-1.5 rounded-xl border border-gray-200 text-gray-500 text-[10px] font-bold"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}

            {hasCollageMeta && (
              <div className="px-3 pb-3 flex items-center justify-center gap-4 text-center">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Before</p>
                  <p className="text-base font-bold text-gray-900">
                    {Number(draftBefore?.weightKg ?? testimonial?.beforeWeightKg).toFixed(1)}
                    <span className="text-xs font-normal text-gray-400"> kg</span>
                  </p>
                </div>
                <div className="text-gray-300 text-lg font-light" aria-hidden="true">→</div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">After</p>
                  <p className="text-base font-bold text-gray-900">
                    {Number(draftAfter?.weightKg ?? testimonial?.afterWeightKg).toFixed(1)}
                    <span className="text-xs font-normal text-gray-400"> kg</span>
                  </p>
                </div>
                {usableDuration && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">In</p>
                    <p className="text-sm font-bold text-gray-700">{displayDuration}</p>
                  </div>
                )}
              </div>
            )}

            {editable && collageMetaOpen && (
              <div className="mx-3 mb-3 rounded-2xl border border-green-200 bg-green-50/70 p-3 space-y-2.5 text-left">
                <p className="text-xs font-bold text-green-900">Transformation details</p>
                <label className="block">
                  <span className="text-[10px] font-semibold text-gray-500 uppercase">Before weight (kg)</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    value={beforeWeightText ?? ''}
                    onChange={(e) => setBeforeWeightText(sanitizeWeightTyping(e.target.value))}
                    className="mt-1 w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                    placeholder="e.g. 82"
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-semibold text-gray-500 uppercase">After weight (kg)</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    value={afterWeightText ?? ''}
                    onChange={(e) => setAfterWeightText(sanitizeWeightTyping(e.target.value))}
                    className="mt-1 w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                    placeholder="e.g. 74"
                  />
                </label>
                <div>
                  <span className="text-[10px] font-semibold text-gray-500 uppercase">Time to achieve</span>
                  <div className="mt-1 flex gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      autoComplete="off"
                      value={durationValueText ?? ''}
                      onChange={(e) => setDurationValueText(sanitizeDurationDigits(e.target.value))}
                      className="w-24 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                      placeholder="e.g. 3"
                    />
                    <select
                      value={durationUnitDraft}
                      onChange={(e) => setDurationUnitDraft(e.target.value)}
                      className="flex-1 border border-gray-300 rounded-xl px-2 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-400"
                    >
                      <option value="days">days</option>
                      <option value="months">months</option>
                    </select>
                  </div>
                </div>
                {collageMetaError && (
                  <p className="text-[11px] text-red-600 font-medium">{collageMetaError}</p>
                )}
                <div className="flex gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={closeCollageMetaForm}
                    className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-700 text-xs font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => { void submitCollageMetaForm(); }}
                    className="flex-1 py-2.5 rounded-xl bg-green-600 text-white text-xs font-bold"
                  >
                    Save
                  </button>
                </div>
              </div>
            )}

            {editable && collageGuideOpen && !collageMetaOpen && (
              <div className="mx-3 mb-3 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-3 space-y-2.5 text-left">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-bold text-emerald-900 leading-snug">
                    Ready to create your 3-panel collage in ChatGPT
                  </p>
                  <button
                    type="button"
                    onClick={() => setCollageGuideOpen(false)}
                    className="text-emerald-700/70 hover:text-emerald-900 p-0.5"
                    aria-label="Close ChatGPT prompt box"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="text-[11px] text-emerald-800">
                  Prompt uses your saved details: Before {shownBeforeKg} kg → After {shownAfterKg} kg
                  {usableDuration ? ` (${displayDuration})` : ''}.
                </p>
                <button
                  type="button"
                  onClick={async () => {
                    const dynamicPrompt = buildCollageChatGptPrompt({
                      beforeWeightKg: shownBeforeKg,
                      afterWeightKg: shownAfterKg,
                      durationText: usableDuration ? displayDuration : '',
                    });
                    let copied = false;
                    try {
                      copied = await copyTransformCollagePrompt(dynamicPrompt);
                    } catch {
                      copied = false;
                    }
                    setPromptCopied(Boolean(copied));
                    setChatGptModalOpen(true);
                  }}
                  className="w-full py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-xs font-bold transition-colors"
                >
                  {promptCopied ? 'Prompt & link copied — view steps' : 'Copy and open ChatGPT'}
                </button>
              </div>
            )}
            <ChatGptCollageGuideModal
              isOpen={editable && chatGptModalOpen}
              onClose={() => setChatGptModalOpen(false)}
              onOpenedChatGpt={() => {
                setChatGptModalOpen(false);
                setCollageGuideOpen(false);
              }}
              beforeWeightKg={shownBeforeKg}
              afterWeightKg={shownAfterKg}
              durationText={usableDuration ? displayDuration : ''}
              promptCopied={promptCopied}
              onPromptCopiedChange={setPromptCopied}
            />

            <input
              ref={collageGalRef}
              type="file"
              accept="image/*"
              className="hidden"
              aria-label="Collage gallery upload"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) { void handleCollageFile(file); setPickerSlot(null); }
              }}
            />
          </div>
        )}

            {/* Unified OTP — after submit, or when a pending OTP is still open */}
            {showUnifiedOtp && (
              <UnifiedOtpInline
                userId={userId}
                sponsorName={testimonial?.sponsorName}
                otpExpiresAt={testimonial?.otpExpiresAt}
                otpValidityHours={testimonial?.otpValidityHours}
                otpExpired={testimonial?.otpExpired}
                onVerified={handleUnifiedOtpVerified}
                onOtpMetaUpdate={handleUnifiedOtpMetaUpdate}
                onClose={handleUnifiedOtpClose}
              />
            )}

            {/* Legacy per-slot OTP — only when no unified OTP is pending */}
            {editable && !showUnifiedOtp && !unifiedOtpDismissed && testimonial?.status === 'pending' && testimonial?.id && (
              <OtpInline
                testimonialId={testimonial.id}
                type="photo"
                onVerified={onOtpVerified}
              />
            )}

            {/* Stats — Mine always; team only when branded card is not shown (redundant with card) */}
            {testimonial && (editable || !showBrandedCard) && (
              <div className="space-y-1.5">
                {/* "Lost X kgs in Y duration" — uses live draft weights, not persisted hasAfter */}
                {diff && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border ${weightIsLoss ? 'bg-green-50 text-green-700 border-green-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                      {weightIsLoss
                        ? <TrendingDown className="h-3 w-3 shrink-0" />
                        : <TrendingUp className="h-3 w-3 shrink-0" />
                      }
                      {weightIsLoss ? 'Lost' : 'Gained'} {diff} kgs
                      {usableDuration ? ` in ${displayDuration}` : ''}
                    </span>
                    {editable && (
                      expandedSlots.has('duration') ? (
                        <DurationEditor
                          valueText={durationValueText}
                          unit={durationUnitDraft}
                          onValueChange={setDurationValueText}
                          onUnitChange={setDurationUnitDraft}
                          onCommit={commitDurationEdit}
                          onCancel={closeDurationEdit}
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={openDurationEdit}
                          className="p-1 rounded-full border border-gray-200 text-gray-400 hover:text-green-700 hover:border-green-300 transition-colors"
                          aria-label="Edit duration"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                      )
                    )}
                  </div>
                )}
                {/* No diff yet — show before weight or add prompt + duration */}
                {!diff && displayBeforeKg > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-full px-3 py-1 text-[11px] text-gray-600 font-medium">
                      {displayBeforeKg} kg → ?
                      {usableDuration ? ` · ${displayDuration}` : ''}
                    </span>
                    {editable && (
                      expandedSlots.has('duration') ? (
                        <DurationEditor
                          valueText={durationValueText}
                          unit={durationUnitDraft}
                          onValueChange={setDurationValueText}
                          onUnitChange={setDurationUnitDraft}
                          onCommit={commitDurationEdit}
                          onCancel={closeDurationEdit}
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={openDurationEdit}
                          className="p-1 rounded-full border border-gray-200 text-gray-400 hover:text-green-700 hover:border-green-300 transition-colors"
                          aria-label={usableDuration ? 'Edit duration' : 'Add duration'}
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                      )
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Result Video above divider — Mine upload only.
          Direct/Full with branded card: videos live under the card (no duplicate). */}
            {(editable || (testimonial && !showBrandedCard)) && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide flex items-center gap-1 flex-1 min-w-0">
                    <Video className="h-3 w-3 shrink-0" /> Result Video
                    <span className="font-normal normal-case tracking-normal">· max {MAX_HEALTH_VIDEO_MB} MB each</span>
                  </p>
                  {!showBrandedCard && canShareVideo && (
                    <TransformationShareActions
                      variant="icon"
                      kind="video"
                      userName={user.userName}
                      testimonial={testimonial}
                      onBeforeAction={prepareShareCard}
                    />
                  )}
                </div>
                {editable && videoUploadError && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 flex items-start gap-2">
                    <ShieldCheck className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-amber-800 leading-relaxed">{videoUploadError}</p>
                  </div>
                )}
                <div className="flex flex-col gap-3">
                  <div className="space-y-1">
                    <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Health Result</p>
                    {editable ? (
                      <div className="relative">
                        {draftHealthPreview || testimonial?.healthVideoUrl ? (
                          <>
                            <VideoThumbnailCard
                              url={testimonial?.healthVideoUrl ?? null}
                              localPreviewUrl={draftHealthPreview}
                              label="Health Results"
                              accentColor="bg-green-600"
                              onNeedUrl={!testimonial?.healthVideoUrl && testimonial?.healthVideoPath ? loadHealthVideoUrl : undefined}
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
                            className="w-full flex items-center justify-center bg-gray-50 border-2 border-dashed border-green-300 rounded-xl py-8 hover:bg-green-50 transition-colors"
                            aria-label="Add health result video">
                            <Plus className="h-7 w-7 text-green-400" />
                          </button>
                        )}
                        {uploadingHealth && (
                          <div className="absolute inset-0 bg-black/60 rounded-xl flex items-center justify-center z-10">
                            <div className="flex flex-col items-center gap-1">
                              <Upload className="h-5 w-5 text-white animate-bounce" />
                              <span className="text-white text-[10px] font-bold">Preparing…</span>
                            </div>
                          </div>
                        )}
                        <input ref={healthVidRef} type="file" accept="video/mp4,video/webm,video/quicktime,video/3gpp,video/*" className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            e.target.value = '';
                            if (file) handleVideoFile('health', file);
                          }} />
                      </div>
                    ) : (
                      <VideoThumbnailCard
                        url={testimonial?.healthVideoUrl ?? null}
                        label="Health Results"
                        accentColor="bg-green-600"
                        onNeedUrl={!testimonial?.healthVideoUrl && testimonial?.healthVideoPath ? loadHealthVideoUrl : undefined}
                      />
                    )}
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Business Result</p>
                    {editable ? (
                      <div className="relative">
                        {draftBusinessPreview || testimonial?.businessVideoUrl ? (
                          <>
                            <VideoThumbnailCard
                              url={testimonial?.businessVideoUrl ?? null}
                              localPreviewUrl={draftBusinessPreview}
                              label="Business Results"
                              accentColor="bg-blue-600"
                              onNeedUrl={!testimonial?.businessVideoUrl && testimonial?.businessVideoPath ? loadBusinessVideoUrl : undefined}
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
                            className="w-full flex items-center justify-center bg-gray-50 border-2 border-dashed border-blue-300 rounded-xl py-8 hover:bg-blue-50 transition-colors"
                            aria-label="Add business result video">
                            <Plus className="h-7 w-7 text-blue-400" />
                          </button>
                        )}
                        {uploadingBusiness && (
                          <div className="absolute inset-0 bg-black/60 rounded-xl flex items-center justify-center z-10">
                            <div className="flex flex-col items-center gap-1">
                              <Upload className="h-5 w-5 text-white animate-bounce" />
                              <span className="text-white text-[10px] font-bold">Preparing…</span>
                            </div>
                          </div>
                        )}
                        <input ref={businessVidRef} type="file" accept="video/mp4,video/webm,video/quicktime,video/3gpp,video/*" className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            e.target.value = '';
                            if (file) handleVideoFile('business', file);
                          }} />
                      </div>
                    ) : (
                      <VideoThumbnailCard
                        url={testimonial?.businessVideoUrl ?? null}
                        label="Business Results"
                        accentColor="bg-blue-600"
                        onNeedUrl={!testimonial?.businessVideoUrl && testimonial?.businessVideoPath ? loadBusinessVideoUrl : undefined}
                      />
                    )}
                  </div>
                </div>
                {testimonial?.videoStatus === 'verified' && (
                  <p className="text-[11px] text-green-700 font-medium flex items-center gap-1">
                    <CheckCircle className="h-3 w-3 shrink-0" /> Videos verified
                  </p>
                )}

                {/* Upline website consent — directly under Result Video / Videos verified */}
                {editable
                  && isFlagEnabled('ff.testimonial-upline-display-consent')
                  && testimonial
                  && (testimonial.status === 'verified' || testimonial.videoStatus === 'verified') ? (
                  <WebsiteDisplayConsentCard
                    userId={userId}
                    testimonial={testimonial}
                    onChanged={() => {
                      if (typeof onMineRefresh === 'function') void onMineRefresh();
                      else if (typeof onOtpVerified === 'function') onOtpVerified();
                    }}
                  />
                ) : null}

                {editable && !showUnifiedOtp && !unifiedOtpDismissed && testimonial?.videoStatus === 'pending' && testimonial?.id && (
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

            {/* ── Submit for Approval (Mine, dirty edits) — above Transformation card so it is not buried under the preview ── */}
            {editable && submitError && (
              <p className="text-xs text-red-600 text-center bg-red-50 rounded-xl px-3 py-2">{submitError}</p>
            )}
            {editable && hasDirtySlots && !submitDone && (
              <div className="space-y-2 pt-1">
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
                  {changedCount} item{changedCount === 1 ? '' : 's'} changed — your sponsor will receive one verification email
                </p>
              </div>
            )}

            {/* Branded Transformation Results card + videos.
          Mine: divider + share next to TRANSFORMATION CARD.
          Direct/Full: no divider; photo share stays in the member header. */}
            {showBrandedCard && (
              <div className="space-y-3 pt-1">
                {editable && (
                  <div className="flex items-center gap-2" role="separator" aria-label="Transformation card">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="flex-1 border-t border-gray-200" />
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide whitespace-nowrap">
                        Transformation card
                      </p>
                      <div className="flex-1 border-t border-gray-200" />
                    </div>
                    {canSharePhoto && (
                      <TransformationShareActions
                        variant="icon"
                        kind="photo"
                        cardRef={shareCardRef}
                        userName={user.userName}
                        testimonial={shareCardTestimonial}
                      />
                    )}
                  </div>
                )}
                <VisibleTransformationCard
                  testimonial={shareCardTestimonial}
                  userName={shareCardUserName}
                />

                {/* Health + Business videos under the branded card (tap → preview) */}
                {(draftHealthPreview || draftBusinessPreview
                  || testimonial?.healthVideoUrl || testimonial?.businessVideoUrl
                  || testimonial?.healthVideoPath || testimonial?.businessVideoPath) && (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide flex items-center gap-1 flex-1 min-w-0">
                          <Video className="h-3 w-3 shrink-0" /> Result Video
                        </p>
                        {canShareVideo && (
                          <TransformationShareActions
                            variant="icon"
                            kind="video"
                            userName={user.userName}
                            testimonial={testimonial}
                            onBeforeAction={prepareShareCard}
                          />
                        )}
                      </div>
                      <div className="flex gap-3">
                        <div className="flex-1 space-y-1">
                          <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Health</p>
                          <VideoThumbnailCard
                            url={testimonial?.healthVideoUrl ?? null}
                            localPreviewUrl={draftHealthPreview}
                            label="Health Results"
                            accentColor="bg-green-600"
                            onNeedUrl={!testimonial?.healthVideoUrl && testimonial?.healthVideoPath ? loadHealthVideoUrl : undefined}
                          />
                        </div>
                        <div className="flex-1 space-y-1">
                          <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Business</p>
                          <VideoThumbnailCard
                            url={testimonial?.businessVideoUrl ?? null}
                            localPreviewUrl={draftBusinessPreview}
                            label="Business Results"
                            accentColor="bg-blue-600"
                            onNeedUrl={!testimonial?.businessVideoUrl && testimonial?.businessVideoPath ? loadBusinessVideoUrl : undefined}
                          />
                        </div>
                      </div>
                      {testimonial?.videoStatus === 'verified' && (
                        <p className="text-[11px] text-green-700 font-medium flex items-center gap-1">
                          <CheckCircle className="h-3 w-3 shrink-0" /> Videos verified
                        </p>
                      )}
                    </div>
                  )}
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
              <FullscreenProfilePhotoViewer
                isOpen
                src={expandedPhoto.url}
                alt={expandedPhoto.label}
                title={expandedPhoto.label}
                onClose={() => setExpandedPhoto(null)}
                onViewProfile={user?.userId != null ? () => {
                  setExpandedPhoto(null);
                  setProfileOpen(true);
                } : undefined}
              />
            )}
            <TeamMemberProfileModal
              isOpen={profileOpen}
              onClose={() => setProfileOpen(false)}
              memberEmail={user?.email || user?.Email}
              memberUserId={user?.userId}
              apiBaseUrl={getApiBaseUrl()}
            />
            <CustomAlertModal
              isOpen={Boolean(videoSizeAlert)}
              onClose={() => setVideoSizeAlert(null)}
              title="Video too large"
              message={videoSizeAlert}
              type="warning"
              confirmText="OK"
            />

            {/* Hidden full-size share card for sharp html2canvas capture (preview above is scaled). */}
            {shareCardTestimonial && (
              <div
                aria-hidden="true"
                style={{
                  position: 'fixed',
                  left: -10000,
                  top: 0,
                  width: CARD_W,
                  height: shareCardTestimonial?.shareAsCollage ? 'auto' : CARD_H,
                  opacity: 0,
                  pointerEvents: 'none',
                  zIndex: -1,
                  overflow: 'hidden',
                }}
              >
                <TransformationCardContent
                  ref={shareCardRef}
                  testimonial={shareCardTestimonial}
                  userName={shareCardUserName}
                />
              </div>
            )}
          </div>
    </div>
      );
}

      export default function CoachTestimonialsPage({user, reloadSignal = 0, tabVisitKey = 0}) {
  const [teamRows, setTeamRows] = useState([]);
      const [mineRow, setMineRow] = useState(null);
      const [loading, setLoading] = useState(true);
      const [error, setError] = useState(null);
      const [hasDownline, setHasDownline] = useState(false);

      const [uploadFilter, setUploadFilter] = useState(UPLOAD_FILTERS.ALL);
      const [searchQuery, setSearchQuery] = useState('');
      const [isSearchOpen, setIsSearchOpen] = useState(false);
      const [listReloadKey, setListReloadKey] = useState(0);
      const [highlightedSuggestion, setHighlightedSuggestion] = useState(-1);

      const [teamPerformanceByUserId, setTeamPerformanceByUserId] = useState({ });
      /** Unfiltered unified Team size for tab badge — never overwritten by filters. */
      const [teamMemberCount, setTeamMemberCount] = useState(null);
      const [teamLoading, setTeamLoading] = useState(false);
      const [teamPagination, setTeamPagination] = useState({
        page: 1, totalPages: 1, hasMore: false, hasPrevious: false, total: 0,
  });
      const [teamUploadCounts, setTeamUploadCounts] = useState({
        fully_uploaded: 0, partial_upload: 0, not_uploaded: 0,
  });
      const [loadingMore, setLoadingMore] = useState(false);
      const loadMoreSentinelRef = useRef(null);
      const scrollArmedRef = useRef(false);
      const sentinelVisibleRef = useRef(false);
      const batchSettledAtRef = useRef(0);
      const loadGenerationRef = useRef(0);
      const pageCacheRef = useRef(new Map());
      const inFlightRef = useRef(new Map());
      const mineRowRef = useRef(null);

      const coachId = user?.userId || user?.id || null;
      const userName = user?.userName || user?.displayName || user?.name || null;
      const profileImage = user?.profileImage || user?.photoURL || null;
      const phoneNumber = user?.phoneNumber || user?.PhoneNumber || null;
      mineRowRef.current = mineRow;

  const buildMineRow = useCallback(async () => {
    if (!coachId) return null;
      const userPayload = {
        userId: coachId,
      userName,
      profileImage,
      phoneNumber,
    };
      try {
      const [testimonial, video, profileResult] = await Promise.all([
      getMyTestimonial(coachId),
        getMyVideoTestimonial(coachId).catch(() => null),
      getProfile({userId: coachId, cacheBust: true }).catch(() => null),
      ]);
      const latestWeightKg = profileResult?.success && profileResult?.data?.latestWeight != null
      ? Number(profileResult.data.latestWeight)
      : NaN;
      if (Number.isFinite(latestWeightKg) && latestWeightKg > 0) {
        userPayload.latestWeightKg = latestWeightKg;
      }
      // New users with Left/Centre/Right: Left defaults into Before and After until a real After upload.
      const leftUrl = profileResult?.success
      ? profileResult?.data?.transformationPhotos?.left
      : null;
      const seeded = seedMineTestimonialFromProfileSlots(testimonial, {
        leftUrl,
        weightKg: Number.isFinite(latestWeightKg) ? latestWeightKg : null,
      });
      if (!seeded && !video) {
        return {user: userPayload, testimonial: null };
      }
      const merged = {
        ...(seeded || {
          healthVideoUrl: null,
          businessVideoUrl: null,
          status: 'incomplete',
          recoveredHealthIssues: [],
        }),
        id: seeded?.id ?? testimonial?.id ?? video?.testimonialId ?? null,
      videoStatus: video?.videoStatus ?? seeded?.videoStatus ?? testimonial?.videoStatus ?? 'none',
      videoVerifiedAt: video?.videoVerifiedAt ?? seeded?.videoVerifiedAt ?? testimonial?.videoVerifiedAt ?? null,
      };
      return {user: userPayload, testimonial: merged };
    } catch {
      return {user: userPayload, testimonial: null };
    }
  }, [coachId, userName, profileImage, phoneNumber]);

  /** Refresh Mine card only — no full-page loading skeleton (used after photo/video save). */
  const refreshMineRow = useCallback(async (patchedTestimonial = null) => {
    if (!coachId) return;
      if (patchedTestimonial) {
        setMineRow((prev) => ({
          user: prev?.user || {
            userId: coachId,
            userName,
            profileImage,
            phoneNumber,
          },
          testimonial: (() => {
            const merged = { ...(prev?.testimonial || {}), ...patchedTestimonial };
            if (hasStoredTransformationBefore(merged) || !merged.beforeImageUrl) {
              merged.photosFromProfileSeed = false;
            }
            return merged;
          })(),
        }));
      return;
    }
      try {
      const mine = await buildMineRow();
      setMineRow(mine);
    } catch {
        // Keep existing card if refresh fails.
      }
  }, [coachId, buildMineRow, userName, profileImage, phoneNumber]);

  const loadDirectAndMine = useCallback(async () => {
    if (!coachId) return;
      if (isCaptureFlowBusy()) return;
      const generation = loadGenerationRef.current + 1;
      loadGenerationRef.current = generation;
      const isFirstLoad = mineRowRef.current == null;
      if (isFirstLoad) {
        setLoading(true);
      setError(null);
    }
      pageCacheRef.current.clear();
      setTeamMemberCount(null);
    setListReloadKey((key) => key + 1);
      try {
      // First page only (limit 5): all direct members first, then full-team members.
      // Mine must still load if team list fails (e.g. pending DB migration).
      const [teamOutcome, mineOutcome] = await Promise.allSettled([
      listForCoach(coachId, {scope: 'team', page: 1, limit: TEAM_PAGE_SIZE }),
      buildMineRow(),
      ]);
      if (generation !== loadGenerationRef.current) return;

      if (mineOutcome.status === 'fulfilled') {
        setMineRow(mineOutcome.value);
      }

      if (teamOutcome.status === 'fulfilled') {
        const teamResult = teamOutcome.value;
      const team = Array.isArray(teamResult?.data) ? teamResult.data : [];
      pageCacheRef.current.set(`team||${UPLOAD_FILTERS.ALL}|1`, teamResult);
      setTeamRows(team);
      setTeamPagination(teamResult?.pagination || {
        page: 1, totalPages: 1, hasMore: false, hasPrevious: false, total: team.length,
        });
      setTeamUploadCounts(teamResult?.uploadCounts || {
        fully_uploaded: 0, partial_upload: 0, not_uploaded: 0,
        });
      const total = teamResult?.pagination?.total ?? team.length;
      setTeamMemberCount(total);
        setHasDownline(total > 0);
      } else {
        setTeamRows([]);
      setTeamPagination({page: 1, totalPages: 1, hasMore: false, hasPrevious: false, total: 0 });
      setTeamMemberCount(0);
      setHasDownline(false);
      if (isFirstLoad && mineOutcome.status !== 'fulfilled') {
        setError(teamOutcome.reason?.message || 'Failed to load testimonials');
        }
      }
    } catch (err) {
      if (generation !== loadGenerationRef.current) return;
      if (isFirstLoad) setError(err.message || 'Failed to load testimonials');
    } finally {
      if (generation === loadGenerationRef.current) {
        setLoading(false);
      }
    }

      // Deferred: per-coach team compliance badges from team-report
      getTeamTestimonialReport(coachId)
      .then((teamReport) => {
        if (generation !== loadGenerationRef.current || !teamReport) return;
      setTeamPerformanceByUserId(teamReport.teamPerformanceByUserId ?? { });
      })
      .catch(() => { });
  }, [coachId, buildMineRow]);

  useEffect(() => {loadDirectAndMine(); }, [loadDirectAndMine, tabVisitKey]);

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
          .catch(() => { });
        }
      } catch {
        // keep existing card data if soft refresh fails
      }
    })();
    return () => {cancelled = true; };
  }, [reloadSignal, buildMineRow, hasDownline, coachId]);

  const resetTeamSearch = useCallback(() => {
        setSearchQuery('');
      setIsSearchOpen(false);
      setHighlightedSuggestion(-1);
      setUploadFilter(UPLOAD_FILTERS.ALL);
  }, []);

      // ── Derived state ──────────────────────────────────────────────────────────

      const uploadCounts = teamUploadCounts;
      const filteredRows = teamRows;

      const nameSuggestions = useMemo(
    () => buildSearchSuggestions(teamRows, searchQuery),
      [teamRows, searchQuery],
      );

      const activePagination = teamPagination;

  const loadMoreTeam = useCallback(async () => {
    if (!hasDownline || loadingMore || loading || teamLoading) return;
      if (!activePagination.hasMore) return;
      scrollArmedRef.current = false;
      const nextPage = (activePagination.page || 1) + 1;
      const cacheKey = `team|${normalizeSearchQuery(searchQuery)}|${uploadFilter}|${nextPage}`;
      if (pageCacheRef.current.has(cacheKey)) {
      const cached = pageCacheRef.current.get(cacheKey);
      setTeamRows((prev) => mergeUniqueMemberRows(prev, cached.data));
      setTeamPagination(cached.pagination);
      batchSettledAtRef.current = Date.now();
      return;
    }
      if (inFlightRef.current.has(cacheKey)) return;

      setLoadingMore(true);
      const promise = listForCoach(coachId, {
        scope: 'team',
      page: nextPage,
      limit: TEAM_PAGE_SIZE,
      search: normalizeSearchQuery(searchQuery),
      uploadFilter,
    });
      inFlightRef.current.set(cacheKey, promise);
      try {
      const result = await promise;
      pageCacheRef.current.set(cacheKey, result);
      const pageData = Array.isArray(result?.data) ? result.data : [];
      setTeamRows((prev) => mergeUniqueMemberRows(prev, pageData));
      setTeamPagination(result.pagination || {page: nextPage, totalPages: nextPage, hasMore: false, hasPrevious: nextPage > 1 });
      if (result.uploadCounts) setTeamUploadCounts(result.uploadCounts);
    } catch (err) {
        setError(err.message || 'Failed to load more');
    } finally {
        inFlightRef.current.delete(cacheKey);
      batchSettledAtRef.current = Date.now();
      scrollArmedRef.current = false;
      setLoadingMore(false);
    }
  }, [
      hasDownline, loadingMore, loading, teamLoading, activePagination,
      searchQuery, uploadFilter, coachId,
      ]);

      // Refetch page 1 when search or upload filter changes.
      const prevTeamFetchRef = useRef({listReloadKey, searchQuery, uploadFilter});
      const teamRowsCountRef = useRef(0);
      teamRowsCountRef.current = teamRows.length;
  useEffect(() => {
      if (!coachId || !hasDownline) {
        prevTeamFetchRef.current = { listReloadKey, searchQuery, uploadFilter };
      return undefined;
      }
      const prev = prevTeamFetchRef.current;
      const reloadChanged = prev.listReloadKey !== listReloadKey;
      const queryUnchanged = prev.searchQuery === searchQuery && prev.uploadFilter === uploadFilter;
      prevTeamFetchRef.current = {listReloadKey, searchQuery, uploadFilter};

        if (!reloadChanged && queryUnchanged && teamRowsCountRef.current > 0) {
          return undefined;
        }

      const normalizedSearch = normalizeSearchQuery(searchQuery);
      const cacheKey = `team|${normalizedSearch}|${uploadFilter}|1`;
      if (pageCacheRef.current.has(cacheKey) && !reloadChanged) {
            const cached = pageCacheRef.current.get(cacheKey);
      setTeamRows(Array.isArray(cached?.data) ? cached.data : []);
      setTeamPagination(cached.pagination || {page: 1, totalPages: 1, hasMore: false, hasPrevious: false, total: 0 });
      if (cached.uploadCounts) setTeamUploadCounts(cached.uploadCounts);
      return undefined;
          }

      let cancelled = false;
      const delay = reloadChanged ? 0 : 300;
      if (teamRowsCountRef.current === 0 || !queryUnchanged) {
        setTeamLoading(true);
          }

  const timer = setTimeout(async () => {
    try {
      const result = await listForCoach(coachId, {
        scope: 'team',
      page: 1,
      limit: TEAM_PAGE_SIZE,
      search: normalizedSearch,
      uploadFilter,
      });
      if (cancelled) return;
      pageCacheRef.current.set(cacheKey, result);
      const pageData = Array.isArray(result?.data) ? result.data : [];
      const pagination = result.pagination || {page: 1, totalPages: 1, hasMore: false, hasPrevious: false, total: 0 };
      const isUnfilteredList = (!uploadFilter || uploadFilter === UPLOAD_FILTERS.ALL)
      && !normalizedSearch;
      setTeamRows(pageData);
      setTeamPagination(pagination);
      if (result.uploadCounts) setTeamUploadCounts(result.uploadCounts);
      if (isUnfilteredList && Number.isFinite(pagination.total)) {
        setTeamMemberCount(pagination.total);
      }
    } catch (err) {
      if (!cancelled) setError(err?.message || 'Failed to load team');
    } finally {
      if (!cancelled) setTeamLoading(false);
    }
  }, delay);
  return () => {
        cancelled = true;
      clearTimeout(timer);
  };
}, [
      searchQuery, uploadFilter, coachId,
      hasDownline, listReloadKey,
      ]);

// Strict 5-member batch scroll pagination:
// Stops at every 5 members and waits for a real scroll past the 450ms settle window
// before loading the next batch of 5 (never cascades on momentum or tall screens).
useEffect(() => {
      if (!hasDownline || loading) {
        scrollArmedRef.current = false;
      sentinelVisibleRef.current = false;
      return undefined;
      }
      scrollArmedRef.current = false;
      batchSettledAtRef.current = Date.now();

      const onUserScroll = () => {
        if (Date.now() - batchSettledAtRef.current < 450) return;
      scrollArmedRef.current = true;
      if (sentinelVisibleRef.current && activePagination.hasMore && !loadingMore && !teamLoading) {
        scrollArmedRef.current = false;
      void loadMoreTeam();
        }
      };

      window.addEventListener('scroll', onUserScroll, {passive: true, capture: true });
      window.addEventListener('touchmove', onUserScroll, {passive: true });
      window.addEventListener('wheel', onUserScroll, {passive: true });
      return () => {
        window.removeEventListener('scroll', onUserScroll, { capture: true });
      window.removeEventListener('touchmove', onUserScroll);
      window.removeEventListener('wheel', onUserScroll);
      };
    }, [hasDownline, loading, activePagination.hasMore, loadingMore, teamLoading, loadMoreTeam]);

    useEffect(() => {
      if (!hasDownline || loading || !activePagination.hasMore) {
        sentinelVisibleRef.current = false;
      return undefined;
      }
      const node = loadMoreSentinelRef.current;
      if (!node) return undefined;
      const observer = new IntersectionObserver((entries) => {
        const visible = Boolean(entries[0]?.isIntersecting);
      sentinelVisibleRef.current = visible;
      if (!visible) return;
      if (!scrollArmedRef.current) return;
      if (Date.now() - batchSettledAtRef.current < 450) return;
      scrollArmedRef.current = false;
      void loadMoreTeam();
      }, {rootMargin: '0px', threshold: 0.25 });
      observer.observe(node);
      return () => observer.disconnect();
  }, [hasDownline, loading, activePagination.hasMore, loadMoreTeam, filteredRows.length]);

// ── Handlers ───────────────────────────────────────────────────────────────

const handleUploadToggle = useCallback((next) => {
        setUploadFilter((current) => toggleStatusFilter(current, next));
}, []);

const handleSearchChange = useCallback((value) => {
        setSearchQuery(value);
      setIsSearchOpen(true);
      setHighlightedSuggestion(-1);
}, []);

const handleSelectNameSuggestion = useCallback((row) => {
  const name = row?.user?.userName || '';
      setSearchQuery(name);
      setIsSearchOpen(false);
      setHighlightedSuggestion(-1);
}, []);

  const handleSearchKeyDown = useCallback((event) => {
    const hasQuery = normalizeSearchQuery(searchQuery).length > 0;
      if (!hasQuery) return;

      if (event.key === 'ArrowDown') {
        event.preventDefault();
      if (!nameSuggestions.length) return;
      setIsSearchOpen(true);
          setHighlightedSuggestion((prev) => (prev < nameSuggestions.length - 1 ? prev + 1 : 0));
      return;
        }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
      if (!nameSuggestions.length) return;
      setIsSearchOpen(true);
          setHighlightedSuggestion((prev) => (prev > 0 ? prev - 1 : nameSuggestions.length - 1));
      return;
        }
      if (event.key === 'Enter') {
        event.preventDefault();
          if (highlightedSuggestion >= 0 && nameSuggestions[highlightedSuggestion]) {
        handleSelectNameSuggestion(nameSuggestions[highlightedSuggestion]);
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
}, [searchQuery, nameSuggestions, highlightedSuggestion, handleSelectNameSuggestion]);

const hasActiveSearch = normalizeSearchQuery(searchQuery).length > 0;
      const hasActiveUploadFilter = uploadFilter && uploadFilter !== UPLOAD_FILTERS.ALL;
      const showTeamChrome = hasDownline;
      const showPageSkeleton = shouldShowTestimonialsPageSkeleton(loading, mineRow);
      const showSearchLoading = teamLoading;
      const totalMembers = activePagination.total ?? filteredRows.length;

      return (
      <div className="max-w-lg mx-auto px-4 pt-4 pb-24 space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-green-700" />
            <h1 className="text-lg font-bold text-gray-900">Transformation</h1>
          </div>
          <TouchFeedbackButton
            onClick={() => { loadDirectAndMine(); }}
            disabled={loading || teamLoading}
            className="p-2 rounded-full text-gray-500 hover:text-green-700 hover:bg-green-50 transition-colors"
            ariaLabel="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${loading || teamLoading ? 'animate-spin' : ''}`} />
          </TouchFeedbackButton>
        </div>

        {/* States */}
        {showPageSkeleton && (
          <div className="space-y-3 animate-pulse">
            <div className="h-32 bg-gray-100 rounded-2xl" />
            <div className="h-6 bg-gray-100 rounded-xl w-3/4" />
            <div className="h-6 bg-gray-100 rounded-xl w-1/2" />
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-700">{error}</div>
        )}

        {/* Mine card (editable) */}
        {!showPageSkeleton && mineRow && (
          <MemberCard
            key={mineRow.user.userId}
            row={mineRow}
            teamStats={resolveRowTeamUploadPerformance({
              row: mineRow,
              teamScope: TEAM_SCOPES.MINE,
              loggedInCoachId: coachId,
              teamPerformanceByUserId,
              reportType: 'photo',
            })}
            editable
            userId={mineRow.user.userId}
            coachId={coachId}
            onMineRefresh={refreshMineRow}
            onOtpVerified={() => loadDirectAndMine()}
          />
        )}

        {!showPageSkeleton && !error && !mineRow && !showTeamChrome && (
          <div className="text-center py-12 text-gray-400">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Unable to load your transformation</p>
          </div>
        )}

        {/* Team Members right after Mine (only when downline members exist) */}
        {!showPageSkeleton && showTeamChrome && (
          <div className="pt-2 space-y-3">
            <div className="flex items-center justify-between border-t border-gray-200 pt-4">
              <div>
                <h2 className="text-base font-bold text-gray-900">
                  Team Members{teamMemberCount != null ? ` (${teamMemberCount})` : ''}
                </h2>
                <p className="text-[11px] text-gray-400 leading-snug">
                  Direct team members first, followed by full team members.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="relative">
                <p className="text-xs font-semibold text-gray-600 mb-1.5">Search user name</p>
                <TestimonialSearchBar
                  variant="name"
                  value={searchQuery}
                  onChange={handleSearchChange}
                  suggestions={nameSuggestions}
                  isOpen={isSearchOpen}
                  onOpenChange={setIsSearchOpen}
                  highlightedIndex={highlightedSuggestion}
                  onHighlightChange={setHighlightedSuggestion}
                  onSelectSuggestion={handleSelectNameSuggestion}
                  onKeyDown={handleSearchKeyDown}
                />
              </div>
              {hasActiveSearch && (
                <button
                  type="button"
                  onClick={resetTeamSearch}
                  className="text-xs font-semibold text-green-700 hover:text-green-800"
                >
                  Clear search
                </button>
              )}
            </div>

            {showSearchLoading && (
              <div className="py-6">
                <LoadingSpinner context="normal" />
                <p className="text-center text-sm text-gray-500 mt-2">Searching team…</p>
              </div>
            )}

            {!showSearchLoading && !error && filteredRows.length === 0 && (
              <div className="text-center py-10 text-gray-400">
                <Users className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="font-medium text-sm">
                  {hasActiveSearch
                    ? 'No matching members found.'
                    : hasActiveUploadFilter
                      ? 'No records match the selected filter.'
                      : 'No team members found.'}
                </p>
                {hasActiveSearch ? (
                  <button
                    type="button"
                    onClick={resetTeamSearch}
                    className="mt-3 text-sm font-semibold text-green-700 hover:text-green-800"
                  >
                    Clear search
                  </button>
                ) : null}
              </div>
            )}

            {!showSearchLoading && filteredRows.map((row) => (
              <MemberCard
                key={row.user.userId}
                row={row}
                teamStats={resolveRowTeamUploadPerformance({
                  row,
                  teamScope: TEAM_SCOPES.TEAM,
                  loggedInCoachId: coachId,
                  teamPerformanceByUserId,
                  reportType: 'photo',
                })}
                editable={false}
                userId={row.user.userId}
                coachId={coachId}
              />
            ))}

            {!showSearchLoading && activePagination.hasMore && (
              <div ref={loadMoreSentinelRef} className="py-4 flex flex-col items-center gap-1 text-center">
                {loadingMore ? (
                  <>
                    <LoadingSpinner context="normal" />
                    <p className="text-xs text-gray-500">Loading next 5 members…</p>
                  </>
                ) : (
                  <p className="text-xs font-medium text-gray-400">
                    Showing {filteredRows.length} of {totalMembers} · scroll down for next {Math.min(TEAM_PAGE_SIZE, Math.max(1, totalMembers - filteredRows.length))}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      );
}
