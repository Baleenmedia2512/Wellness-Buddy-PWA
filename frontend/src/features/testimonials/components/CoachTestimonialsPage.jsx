/**
 * CoachTestimonialsPage.jsx
 * World-class unified testimonials management for coaches.
 *
 * Unified per-member card shows ALL 5 slots:
 *   â€¢ Before photo Â· After photo Â· Health video Â· Business video Â· Recovered health issues
 *
 * Three upload-completeness filters (no photo/video split):
 *   âœ… Fully Uploaded | ðŸ”¶ Partial Upload | â¬œ Not Uploaded
 *
 * Team scope: Mine | Direct | Full  (unchanged)
 * Search bar (unchanged)
 *
 * Video playback: Instagram-style tap-to-play inline modal.
 */
import React, { useEffect, useCallback, useState, useMemo, useRef } from 'react';
import {
  AlertCircle, ArrowLeft, CheckCircle, Clock, RefreshCw, Users, Video,
  Play, X, HeartPulse, Maximize2,
} from 'lucide-react';
import TouchFeedbackButton from '../../../shared/components/TouchFeedbackButton';
import LoadingSpinner from '../../../shared/components/LoadingSpinner';
import { listForCoach, getMyTestimonial, getTeamTestimonialReport } from '../services/testimonialApi.js';
import TestimonialSearchBar from './TestimonialSearchBar.jsx';
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

const UPLOAD_CHIP_STYLES = {
  [UPLOAD_FILTERS.FULLY_UPLOADED]: {
    base:   'bg-green-100 text-green-800',
    active: 'bg-green-600 text-white shadow-sm ring-2 ring-green-300',
  },
  [UPLOAD_FILTERS.PARTIAL]: {
    base:   'bg-amber-100 text-amber-800',
    active: 'bg-amber-600 text-white shadow-sm ring-2 ring-amber-300',
  },
  [UPLOAD_FILTERS.NOT_UPLOADED]: {
    base:   'bg-gray-100 text-gray-600',
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
        <Video className="h-3 w-3" /> {label} â€“ not uploaded
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
  const cfg =
    level === UPLOAD_FILTERS.FULLY_UPLOADED
      ? { label: `âœ… Fully Uploaded (${filledCount}/${totalSlots})`, cls: 'bg-green-100 text-green-800 border-green-200' }
      : level === UPLOAD_FILTERS.PARTIAL
      ? { label: `ðŸ”¶ Partial (${filledCount}/${totalSlots})`,        cls: 'bg-amber-100 text-amber-800 border-amber-200' }
      : { label: `â¬œ Not Uploaded`,                                   cls: 'bg-gray-100 text-gray-500 border-gray-200'   };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${cfg.cls}`}>
      {cfg.label}
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

function UploadFilterChip({ filterKey, label, count, activeFilter, onToggle }) {
  const isActive = activeFilter === filterKey;
  const styles   = UPLOAD_CHIP_STYLES[filterKey];
  return (
    <button
      type="button"
      onClick={() => onToggle(filterKey)}
      aria-pressed={isActive}
      className={`flex-shrink-0 rounded-full px-3 py-1 text-xs font-bold transition-all duration-150 cursor-pointer whitespace-nowrap ${
        isActive ? styles.active : styles.base
      }`}
    >
      {label} ({count})
    </button>
  );
}

// â”€â”€ Per-member unified card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function MemberCard({ row, teamStats }) {
  const { user, testimonial } = row;
  const { level, filledCount, totalSlots } = computeMemberCompleteness(row);

  const [expandedPhoto, setExpandedPhoto] = useState(null);
  const hasAfter  = testimonial?.afterImageUrl  && testimonial?.status !== 'incomplete';
  const diff      = testimonial ? Math.abs((testimonial.afterWeightKg ?? 0) - (testimonial.beforeWeightKg ?? 0)).toFixed(1) : null;
  const goalArrow = testimonial?.goalType === 'loss' ? 'â†“' : 'â†‘';
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

      {/* Photos */}
      {testimonial && (testimonial.beforeImageUrl || (hasAfter && testimonial.afterImageUrl)) && (
        <div className="flex gap-2">
          {testimonial.beforeImageUrl && (
            <div className="flex-1 text-center">
              <button
                type="button"
                onClick={() => setExpandedPhoto({ url: testimonial.beforeImageUrl, label: `${user.userName} â€” Before (${testimonial.beforeWeightKg} kg)` })}
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
              <div className="mt-1 space-y-0.5">
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wide">BEFORE</p>
                <p className="text-[11px] text-gray-700 font-semibold">{testimonial.beforeWeightKg} kg</p>
              </div>
            </div>
          )}
          {hasAfter && testimonial.afterImageUrl && (
            <div className="flex-1 text-center">
              <button
                type="button"
                onClick={() => setExpandedPhoto({ url: testimonial.afterImageUrl, label: `${user.userName} â€” After (${testimonial.afterWeightKg} kg)` })}
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
              <div className="mt-1 space-y-0.5">
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wide">AFTER</p>
                <p className="text-[11px] text-gray-700 font-semibold">{testimonial.afterWeightKg} kg</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Stats chips */}
      {testimonial && (
        <div className="flex gap-1.5 flex-wrap">
          {testimonial.goalType && (
            <span className="bg-white border border-gray-200 rounded-full px-2 py-0.5 text-[11px] text-gray-700 font-medium">
              {testimonial.goalType === 'loss' ? 'â¬‡ï¸ Loss' : 'â¬†ï¸ Gain'}
            </span>
          )}
          {testimonial.beforeWeightKg && (
            <span className="bg-white border border-gray-200 rounded-full px-2 py-0.5 text-[11px] text-gray-700 font-medium">
              {testimonial.beforeWeightKg} â†’ {hasAfter ? testimonial.afterWeightKg : '?'} kg
            </span>
          )}
          {diff && hasAfter && (
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold border ${testimonial.goalType === 'loss' ? 'bg-green-100 text-green-800 border-green-200' : 'bg-blue-100 text-blue-800 border-blue-200'}`}>
              {goalArrow} {diff} kg
            </span>
          )}
          {testimonial.durationText && (
            <span className="bg-white border border-gray-200 rounded-full px-2 py-0.5 text-[11px] text-gray-700 font-medium">
              â± {testimonial.durationText}
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

      {/* Videos */}
      {testimonial && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide flex items-center gap-1">
            <Video className="h-3 w-3" /> Result Videos
          </p>
          <div className="flex flex-wrap gap-2">
            <VideoThumbnailBtn
              url={testimonial.healthVideoUrl ?? null}
              label="Health Results"
              iconColor="text-green-600"
            />
            <VideoThumbnailBtn
              url={testimonial.businessVideoUrl ?? null}
              label="Business Results"
              iconColor="text-blue-600"
            />
          </div>
          {testimonial.videoStatus === 'verified' && (
            <p className="text-[11px] text-green-700 font-medium flex items-center gap-1">
              <CheckCircle className="h-3 w-3" /> Videos verified
            </p>
          )}
          {testimonial.videoStatus === 'pending' && (
            <p className="text-[11px] text-amber-700 font-medium flex items-center gap-1">
              <Clock className="h-3 w-3" /> Videos pending â€” share OTP with {user.userName}
            </p>
          )}
        </div>
      )}

      {/* Recovered health issues */}
      {testimonial && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide flex items-center gap-1">
            <HeartPulse className="h-3 w-3" /> Recovered Health Issues
          </p>
          {issues.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {issues.map((issue) => (
                <span key={issue} className="inline-flex items-center px-2 py-0.5 bg-rose-50 border border-rose-200 rounded-full text-[11px] font-medium text-rose-800">
                  {issue}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-gray-400 italic">Not added yet</p>
          )}
        </div>
      )}

      {/* OTP hint */}
      {testimonial?.status === 'pending' && (
        <p className="text-xs text-amber-700 font-medium bg-amber-100 rounded-xl px-3 py-2 text-center">
          ðŸ“§ OTP sent to your email â€” share it with {user.userName} to verify
        </p>
      )}

      {/* No testimonial */}
      {!testimonial && (
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


export default function CoachTestimonialsPage({ user }) {
  const [directRows, setDirectRows]   = useState([]);
  const [fullRows,   setFullRows]     = useState([]);
  const [mineRow,    setMineRow]      = useState(null);
  const [loading,    setLoading]      = useState(true);
  const [error,      setError]        = useState(null);

  const [uploadFilter,          setUploadFilter]          = useState(UPLOAD_FILTERS.ALL);
  const [teamScope,             setTeamScope]             = useState(TEAM_SCOPES.DIRECT);
  const [searchQuery,           setSearchQuery]           = useState('');
  const [isSearchOpen,          setIsSearchOpen]          = useState(false);
  const [highlightedSuggestion, setHighlightedSuggestion] = useState(-1);

  const [teamPerformanceByUserId, setTeamPerformanceByUserId] = useState({});

  const coachId = user?.userId || user?.id;

  const buildMineRow = useCallback(async () => {
    if (!coachId) return null;
    try {
      const testimonial = await getMyTestimonial(coachId);
      return {
        user: {
          userId:       coachId,
          userName:     user?.userName || user?.displayName || user?.name || 'You',
          profileImage: user?.profileImage || user?.photoURL || null,
          phoneNumber:  user?.phoneNumber || user?.PhoneNumber || null,
        },
        testimonial: testimonial || null,
      };
    } catch {
      return {
        user: {
          userId:       coachId,
          userName:     user?.userName || user?.displayName || user?.name || 'You',
          profileImage: user?.profileImage || user?.photoURL || null,
          phoneNumber:  user?.phoneNumber || user?.PhoneNumber || null,
        },
        testimonial: null,
      };
    }
  }, [coachId, user]);

  const load = useCallback(async () => {
    if (!coachId) return;
    setLoading(true);
    setError(null);
    try {
      const [direct, mine, full] = await Promise.all([
        listForCoach(coachId, TEAM_SCOPES.DIRECT),
        buildMineRow(),
        listForCoach(coachId, TEAM_SCOPES.FULL),
      ]);
      setDirectRows(direct || []);
      setMineRow(mine);
      setFullRows(full || []);
    } catch (err) {
      setError(err.message || 'Failed to load testimonials');
    } finally {
      setLoading(false);
    }
  }, [coachId, buildMineRow]);

  useEffect(() => { load(); }, [load]);

  const loadTeamReport = useCallback(async () => {
    if (!coachId) return;
    try {
      const report = await getTeamTestimonialReport(coachId);
      setTeamPerformanceByUserId(report.teamPerformanceByUserId ?? {});
    } catch {
      setTeamPerformanceByUserId({});
    }
  }, [coachId]);

  useEffect(() => { loadTeamReport(); }, [loadTeamReport]);

  useEffect(() => {
    setSearchQuery('');
    setIsSearchOpen(false);
    setHighlightedSuggestion(-1);
    setUploadFilter(UPLOAD_FILTERS.ALL);
  }, [teamScope]);

  // â”€â”€ Derived state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const scopeRows = useMemo(() => {
    if (teamScope === TEAM_SCOPES.MINE)   return mineRow ? [mineRow] : [];
    if (teamScope === TEAM_SCOPES.FULL)   return fullRows;
    return directRows;
  }, [teamScope, mineRow, directRows, fullRows]);

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

  // â”€â”€ Handlers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

  return (
    <div className="max-w-lg mx-auto px-4 pt-4 pb-24 space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-green-700" />
          <h1 className="text-lg font-bold text-gray-900">Team Testimonials</h1>
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

      {/* Team scope */}
      {!loading && (
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

      {/* Search */}
      {!loading && hasScopeData && (
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
      )}

      {/* Upload completeness filter chips */}
      {!loading && hasScopeData && (
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide sm:flex-wrap sm:gap-2 sm:overflow-visible" role="group" aria-label="Upload completeness filter">
          <UploadFilterChip
            filterKey={UPLOAD_FILTERS.FULLY_UPLOADED}
            label="âœ… Fully Uploaded"
            count={uploadCounts.fully_uploaded}
            activeFilter={uploadFilter}
            onToggle={handleUploadToggle}
          />
          <UploadFilterChip
            filterKey={UPLOAD_FILTERS.PARTIAL}
            label="ðŸ”¶ Partial"
            count={uploadCounts.partial_upload}
            activeFilter={uploadFilter}
            onToggle={handleUploadToggle}
          />
          <UploadFilterChip
            filterKey={UPLOAD_FILTERS.NOT_UPLOADED}
            label="â¬œ Not Uploaded"
            count={uploadCounts.not_uploaded}
            activeFilter={uploadFilter}
            onToggle={handleUploadToggle}
          />
        </div>
      )}

      {/* States */}
      {loading && <LoadingSpinner message="Loading team testimonialsâ€¦" />}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-700">{error}</div>
      )}

      {!loading && !error && !hasScopeData && (
        <div className="text-center py-12 text-gray-400">
          <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No team members found</p>
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
            teamScope,
            loggedInCoachId: coachId,
            teamPerformanceByUserId,
            reportType: 'photo',
          })}
        />
      ))}
    </div>
  );
}


