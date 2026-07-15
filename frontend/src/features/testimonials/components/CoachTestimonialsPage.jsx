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
  AlertCircle, ArrowLeft, ArrowRight, CheckCircle, CircleDot, Clock, Mail, Pencil, RefreshCw, ShieldCheck, Users, Video,
  Play, X, HeartPulse, Maximize2, TrendingDown, TrendingUp,
} from 'lucide-react';
import TouchFeedbackButton from '../../../shared/components/TouchFeedbackButton';
import LoadingSpinner from '../../../shared/components/LoadingSpinner';
import { listForCoach, getMyTestimonial, getMyVideoTestimonial, getTeamTestimonialReport } from '../services/testimonialApi.js';
import TestimonialSearchBar from './TestimonialSearchBar.jsx';
import OtpInline from './OtpInline.jsx';
import {
  UPLOAD_FILTERS,
  TEAM_SCOPES,
  computeMemberCompleteness,
  filterRowsByUpload,
  countRowsByUpload,
  countRowsByTeamScope,
  toggleStatusFilter,
} from '../utils/testimonialFilters.js';
import {
  buildSearchSuggestions,
  filterRowsBySearch,
  normalizeSearchQuery,
} from '../utils/testimonialSearch.js';
import { PORTRAIT_IMAGE_CLASS_SM } from '../services/testimonialFormUtils.js';
import { resolveRowTeamUploadPerformance } from '../utils/testimonialTeamPerformance.js';

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

function VideoThumbnailBtn({ url, label, iconColor = 'text-green-600' }) {
  const [playing, setPlaying] = useState(false);

  if (!url) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 rounded-full text-[11px] text-gray-400 font-medium">
        <Video className="h-3 w-3 shrink-0" /> {label} · not uploaded
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setPlaying(true)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-white border border-gray-200 text-[11px] font-semibold shadow-sm hover:shadow transition-all active:scale-95 ${iconColor} hover:border-green-300`}
      >
        <Play className="h-3 w-3 fill-current" /> {label}
      </button>
      {playing && <VideoPlayerModal url={url} title={label} onClose={() => setPlaying(false)} />}
    </>
  );
}

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

function MemberCard({
  row,
  teamStats,
  editable = false,
  onEditBefore,
  onEditAfter,
  onEditHealth,
  onEditBusiness,
  onEditIssues,
  onOtpVerified,
}) {
  const { user, testimonial } = row;
  const { level, filledCount, totalSlots } = computeMemberCompleteness(row);

  const [expandedPhoto, setExpandedPhoto] = useState(null);
  const hasAfter  = testimonial?.afterImageUrl  && testimonial?.status !== 'incomplete';
  const diff      = testimonial ? Math.abs((testimonial.afterWeightKg ?? 0) - (testimonial.beforeWeightKg ?? 0)).toFixed(1) : null;
  const issues    = testimonial?.recoveredHealthIssues ?? [];

  const borderCls =
    level === UPLOAD_FILTERS.FULLY_UPLOADED ? 'border-green-300'
    : level === UPLOAD_FILTERS.PARTIAL      ? 'border-amber-300'
    :                                          'border-gray-200';

  const bgCls =
    level === UPLOAD_FILTERS.FULLY_UPLOADED ? 'bg-green-50/30'
    : level === UPLOAD_FILTERS.PARTIAL      ? 'bg-amber-50/30'
    :                                          'bg-white';

  return (
    <div className={`rounded-2xl border-2 ${borderCls} ${bgCls} p-4 space-y-3 shadow-sm`}>
      {/* Header */}
      <div className="flex items-start gap-3">
        {user.profileImage ? (
          <img src={user.profileImage} alt={user.userName}
            className="h-10 w-10 rounded-full object-cover border border-gray-200 flex-shrink-0" loading="lazy" />
        ) : (
          <div className="h-10 w-10 rounded-full bg-green-200 flex items-center justify-center text-green-800 font-bold text-sm flex-shrink-0">
            {(user.userName || '?').charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <TeamComplianceSection userName={user.userName} teamStats={teamStats} />
          <div className="mt-1">
            <CompletenessBadge level={level} filledCount={filledCount} totalSlots={totalSlots} />
          </div>
        </div>
      </div>

      {/* Photos — always show before/after slots when editable (Mine) */}
      {(editable || (testimonial && (testimonial.beforeImageUrl || (hasAfter && testimonial.afterImageUrl)))) && (
        <div className="flex gap-2">
          <div className="flex-1 text-center">
            {testimonial?.beforeImageUrl ? (
              <button
                type="button"
                onClick={() => setExpandedPhoto({ url: testimonial.beforeImageUrl, label: `${user.userName} — Before (${testimonial.beforeWeightKg} kg)` })}
                className="w-full group relative"
              >
                <img
                  src={testimonial.beforeImageUrl}
                  alt="Before"
                  className={`${PORTRAIT_IMAGE_CLASS_SM} w-full group-hover:brightness-90 transition-all cursor-zoom-in`}
                  loading="lazy"
                />
                <span className="absolute top-1.5 right-1.5 p-0.5 rounded-full bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                  <Maximize2 className="h-3 w-3" />
                </span>
              </button>
            ) : (
              <div className={`${PORTRAIT_IMAGE_CLASS_SM} w-full flex items-center justify-center bg-gray-50 border border-dashed border-gray-200`}>
                <AlertCircle className="h-5 w-5 text-gray-300" />
              </div>
            )}
            <div className="mt-1 space-y-0.5">
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wide">BEFORE</p>
              {testimonial?.beforeWeightKg != null && (
                <p className="text-[11px] text-gray-700 font-semibold">{testimonial.beforeWeightKg} kg</p>
              )}
              {editable && onEditBefore && (
                <button
                  type="button"
                  onClick={onEditBefore}
                  className="mt-1 inline-flex items-center gap-1 mx-auto px-2.5 py-1 rounded-full border border-gray-200 bg-white text-[10px] font-bold text-gray-600 hover:border-green-400 hover:text-green-700 transition-colors"
                >
                  <Pencil className="h-3 w-3" /> {testimonial?.beforeImageUrl ? 'Edit' : 'Add'}
                </button>
              )}
            </div>
          </div>
          <div className="flex-1 text-center">
            {hasAfter && testimonial?.afterImageUrl ? (
              <button
                type="button"
                onClick={() => setExpandedPhoto({ url: testimonial.afterImageUrl, label: `${user.userName} — After (${testimonial.afterWeightKg} kg)` })}
                className="w-full group relative"
              >
                <img
                  src={testimonial.afterImageUrl}
                  alt="After"
                  className={`${PORTRAIT_IMAGE_CLASS_SM} w-full group-hover:brightness-90 transition-all cursor-zoom-in`}
                  loading="lazy"
                />
                <span className="absolute top-1.5 right-1.5 p-0.5 rounded-full bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                  <Maximize2 className="h-3 w-3" />
                </span>
              </button>
            ) : (
              <div className={`${PORTRAIT_IMAGE_CLASS_SM} w-full flex items-center justify-center bg-gray-50 border border-dashed border-gray-200`}>
                <AlertCircle className="h-5 w-5 text-gray-300" />
              </div>
            )}
            <div className="mt-1 space-y-0.5">
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wide">AFTER</p>
              {hasAfter && testimonial?.afterWeightKg != null && (
                <p className="text-[11px] text-gray-700 font-semibold">{testimonial.afterWeightKg} kg</p>
              )}
              {editable && onEditAfter && (
                <button
                  type="button"
                  onClick={onEditAfter}
                  className="mt-1 inline-flex items-center gap-1 mx-auto px-2.5 py-1 rounded-full border border-gray-200 bg-white text-[10px] font-bold text-gray-600 hover:border-purple-400 hover:text-purple-700 transition-colors"
                >
                  <Pencil className="h-3 w-3" /> {hasAfter && testimonial?.afterImageUrl ? 'Edit' : 'Add'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Photo OTP — directly under Before/After images (Mine, when pending) */}
      {editable && testimonial?.status === 'pending' && testimonial?.id && (
        <OtpInline
          testimonialId={testimonial.id}
          type="photo"
          onVerified={onOtpVerified}
        />
      )}

      {/* Stats chips */}
      {testimonial && (
        <div className="flex gap-1.5 flex-wrap">
          {testimonial.goalType && (
            <span className="inline-flex items-center gap-0.5 bg-white border border-gray-200 rounded-full px-2 py-0.5 text-[11px] text-gray-700 font-medium">
              {testimonial.goalType === 'loss' ? (
                <>
                  <TrendingDown className="h-2.5 w-2.5 text-green-600 shrink-0" />
                  Loss
                </>
              ) : (
                <>
                  <TrendingUp className="h-2.5 w-2.5 text-blue-600 shrink-0" />
                  Gain
                </>
              )}
            </span>
          )}
          {testimonial.beforeWeightKg && (
            <span className="inline-flex items-center gap-0.5 bg-white border border-gray-200 rounded-full px-2 py-0.5 text-[11px] text-gray-700 font-medium">
              {testimonial.beforeWeightKg}
              <ArrowRight className="h-2.5 w-2.5 text-gray-400 shrink-0" />
              {hasAfter ? testimonial.afterWeightKg : '?'} kg
            </span>
          )}
          {diff && hasAfter && (
            <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-bold border ${testimonial.goalType === 'loss' ? 'bg-green-100 text-green-800 border-green-200' : 'bg-blue-100 text-blue-800 border-blue-200'}`}>
              {testimonial.goalType === 'loss' ? (
                <TrendingDown className="h-2.5 w-2.5 shrink-0" />
              ) : (
                <TrendingUp className="h-2.5 w-2.5 shrink-0" />
              )}
              {diff} kg
            </span>
          )}
          {testimonial.durationText && (
            <span className="inline-flex items-center gap-0.5 bg-white border border-gray-200 rounded-full px-2 py-0.5 text-[11px] text-gray-700 font-medium">
              <Clock className="h-2.5 w-2.5 text-gray-400 shrink-0" />
              {testimonial.durationText}
            </span>
          )}
          {testimonial.status === 'verified' && (
            <span className="bg-green-100 border border-green-200 rounded-full px-2 py-0.5 text-[11px] text-green-800 font-bold flex items-center gap-0.5">
              <CheckCircle className="h-2.5 w-2.5" /> Photo Verified
            </span>
          )}
          {testimonial.status === 'pending' && (
            <span className="bg-amber-100 border border-amber-200 rounded-full px-2 py-0.5 text-[11px] text-amber-800 font-bold flex items-center gap-0.5">
              <Clock className="h-2.5 w-2.5" /> Awaiting OTP
            </span>
          )}
        </div>
      )}

      {/* Videos — always show on Mine so Edit/Add is available */}
      {(editable || testimonial) && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide flex items-center gap-1">
            <Video className="h-3 w-3" /> Result Videos
          </p>
          <div className="flex flex-wrap gap-2 items-center">
            <div className="inline-flex items-center gap-1">
              <VideoThumbnailBtn
                url={testimonial?.healthVideoUrl ?? null}
                label="Health Results"
                iconColor="text-green-600"
              />
              {editable && onEditHealth && (
                <button
                  type="button"
                  onClick={onEditHealth}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-full border border-gray-200 bg-white text-[10px] font-bold text-gray-600 hover:border-green-400 hover:text-green-700 transition-colors"
                >
                  <Pencil className="h-3 w-3" /> {testimonial?.healthVideoUrl ? 'Edit' : 'Add'}
                </button>
              )}
            </div>
            <div className="inline-flex items-center gap-1">
              <VideoThumbnailBtn
                url={testimonial?.businessVideoUrl ?? null}
                label="Business Results"
                iconColor="text-blue-600"
              />
              {editable && onEditBusiness && (
                <button
                  type="button"
                  onClick={onEditBusiness}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-full border border-gray-200 bg-white text-[10px] font-bold text-gray-600 hover:border-blue-400 hover:text-blue-700 transition-colors"
                >
                  <Pencil className="h-3 w-3" /> {testimonial?.businessVideoUrl ? 'Edit' : 'Add'}
                </button>
              )}
            </div>
          </div>
          {testimonial?.videoStatus === 'verified' && (
            <p className="text-[11px] text-green-700 font-medium flex items-center gap-1">
              <CheckCircle className="h-3 w-3 shrink-0" /> Videos verified
            </p>
          )}
          {/* Video OTP under Result Videos (Mine) — same block as Verify Your Videos */}
          {editable && testimonial?.videoStatus === 'pending' && testimonial?.id && (
            <div className="bg-white rounded-2xl border border-amber-200 shadow-sm px-4 py-4 space-y-1 mt-1">
              <p className="text-xs font-bold text-amber-700 uppercase tracking-wide flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5" /> Verify Your Videos
              </p>
              <p className="text-xs text-gray-500 pb-1">
                One OTP covers both uploaded videos. Ask your coach for the code they received by email.
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
            {editable && onEditIssues && (
              <button
                type="button"
                onClick={onEditIssues}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-gray-200 bg-white text-[10px] font-bold text-gray-600 hover:border-rose-400 hover:text-rose-700 transition-colors shrink-0"
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
    </div>
  );
}


export default function CoachTestimonialsPage({ user, onEditOwnSlot, reloadSignal = 0 }) {
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

  const load = useCallback(async () => {
    if (!coachId) return;
    setLoading(true);
    setError(null);
    try {
      const [directResult, mine, fullResult] = await Promise.all([
        listForCoach(coachId, TEAM_SCOPES.DIRECT).catch(() => []),
        buildMineRow(),
        listForCoach(coachId, TEAM_SCOPES.FULL).catch(() => []),
      ]);
      const direct = Array.isArray(directResult) ? directResult : [];
      const full   = Array.isArray(fullResult) ? fullResult : [];
      const downline = direct.length > 0 || full.length > 0;
      setDirectRows(direct);
      setMineRow(mine);
      setFullRows(full);
      setHasDownline(downline);
      // Members with no team stay on Mine; coaches with downline keep current scope
      // unless we just learned they have no downline.
      if (!downline) setTeamScope(TEAM_SCOPES.MINE);
    } catch (err) {
      setError(err.message || 'Failed to load testimonials');
    } finally {
      setLoading(false);
    }
  }, [coachId, buildMineRow]);

  useEffect(() => { load(); }, [load]);

  const loadTeamReport = useCallback(async () => {
    if (!coachId || !hasDownline) {
      setTeamPerformanceByUserId({});
      return;
    }
    try {
      const report = await getTeamTestimonialReport(coachId);
      setTeamPerformanceByUserId(report.teamPerformanceByUserId ?? {});
    } catch {
      setTeamPerformanceByUserId({});
    }
  }, [coachId, hasDownline]);

  useEffect(() => { loadTeamReport(); }, [loadTeamReport]);

  // Soft-refresh Mine after edit modal so pending OTP UI appears (no full loading flash)
  useEffect(() => {
    if (!reloadSignal) return;
    let cancelled = false;
    (async () => {
      try {
        const mine = await buildMineRow();
        if (!cancelled) setMineRow(mine);
        loadTeamReport();
      } catch {
        // keep existing card data if soft refresh fails
      }
    })();
    return () => { cancelled = true; };
  }, [reloadSignal, buildMineRow, loadTeamReport]);

  useEffect(() => {
    setSearchQuery('');
    setIsSearchOpen(false);
    setHighlightedSuggestion(-1);
    setUploadFilter(UPLOAD_FILTERS.ALL);
  }, [teamScope]);

  // ── Derived state ──────────────────────────────────────────────────────────

  const scopeRows = useMemo(() => {
    if (!hasDownline || teamScope === TEAM_SCOPES.MINE) return mineRow ? [mineRow] : [];
    if (teamScope === TEAM_SCOPES.FULL) return fullRows;
    return directRows;
  }, [hasDownline, teamScope, mineRow, directRows, fullRows]);

  const teamScopeCounts = useMemo(
    () => countRowsByTeamScope(mineRow, directRows, fullRows),
    [mineRow, directRows, fullRows],
  );

  const uploadCounts = useMemo(() => countRowsByUpload(scopeRows), [scopeRows]);

  const uploadFilteredRows = useMemo(
    () => filterRowsByUpload(scopeRows, uploadFilter),
    [scopeRows, uploadFilter],
  );

  const suggestions = useMemo(
    () => buildSearchSuggestions(uploadFilteredRows, searchQuery),
    [uploadFilteredRows, searchQuery],
  );

  const filteredRows = useMemo(
    () => filterRowsBySearch(uploadFilteredRows, searchQuery),
    [uploadFilteredRows, searchQuery],
  );

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

  const hasScopeData    = scopeRows.length > 0;
  const hasActiveSearch = normalizeSearchQuery(searchQuery).length > 0;
  const showTeamChrome  = hasDownline;
  const isMineScope     = !hasDownline || teamScope === TEAM_SCOPES.MINE;

  return (
    <div className="max-w-lg mx-auto px-4 pt-4 pb-24 space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-green-700" />
          <h1 className="text-lg font-bold text-gray-900">
            {showTeamChrome ? 'Team Testimonials' : 'My Transformation'}
          </h1>
        </div>
        <TouchFeedbackButton
          onClick={() => { load(); loadTeamReport(); }}
          disabled={loading}
          className="p-2 rounded-full text-gray-500 hover:text-green-700 hover:bg-green-50 transition-colors"
          ariaLabel="Refresh"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
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
      {loading && <LoadingSpinner message="Loading testimonials…" />}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-700">{error}</div>
      )}

      {!loading && !error && !hasScopeData && (
        <div className="text-center py-12 text-gray-400">
          <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">
            {showTeamChrome ? 'No team members found' : 'Unable to load your transformation'}
          </p>
        </div>
      )}

      {!loading && !error && hasScopeData && filteredRows.length === 0 && (
        <div className="text-center py-8 text-gray-400">
          <p className="font-medium text-sm">
            {hasActiveSearch ? 'No matching members found.' : 'No records match the selected filter.'}
          </p>
        </div>
      )}

      {/* Member cards */}
      {!loading && filteredRows.map((row) => (
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
          editable={isMineScope && typeof onEditOwnSlot === 'function'}
          onEditBefore={isMineScope ? () => onEditOwnSlot?.('before') : undefined}
          onEditAfter={isMineScope ? () => onEditOwnSlot?.('after') : undefined}
          onEditHealth={isMineScope ? () => onEditOwnSlot?.('health') : undefined}
          onEditBusiness={isMineScope ? () => onEditOwnSlot?.('business') : undefined}
          onEditIssues={isMineScope ? () => onEditOwnSlot?.('issues') : undefined}
          onOtpVerified={isMineScope ? () => { load(); loadTeamReport(); } : undefined}
        />
      ))}
    </div>
  );
}



