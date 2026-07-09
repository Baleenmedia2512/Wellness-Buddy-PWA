/**
 * CoachTestimonialsPage.jsx
 * Coach's read-only view of all direct-downline testimonials.
 * - Members with no testimonial are highlighted in red.
 * - Members with a pending testimonial show an amber badge + reminder to share the OTP.
 * - Members with a verified testimonial show a green badge + before/after photos.
 * OTP is entered by the MEMBER (not coach) after the coach shares it via WhatsApp/phone.
 */
import React, { useEffect, useCallback, useState, useMemo } from 'react';
import { AlertCircle, CheckCircle, Clock, RefreshCw, Users, Video } from 'lucide-react';
import TouchFeedbackButton from '../../../shared/components/TouchFeedbackButton';
import LoadingSpinner from '../../../shared/components/LoadingSpinner';
import { listForCoach, getMyTestimonial, getMyVideoTestimonial, getTestimonialVideoReport, getTeamTestimonialReport } from '../services/testimonialApi.js';
import TestimonialSearchBar from './TestimonialSearchBar.jsx';
import {
  STATUS_FILTERS,
  TEAM_SCOPES,
  filterRowsByStatus,
  filterVideoRowsByStatus,
  countRowsByStatus,
  countVideoRowsByStatus,
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

const TEAM_SCOPE_OPTIONS = [
  { value: TEAM_SCOPES.MINE, label: 'Mine', short: 'Mine' },
  { value: TEAM_SCOPES.DIRECT, label: 'Direct Team', short: 'Direct' },
  { value: TEAM_SCOPES.FULL, label: 'Full Team', short: 'Full' },
];

const STATUS_CHIP_STYLES = {
  [STATUS_FILTERS.VERIFIED]: {
    base: 'bg-green-100 text-green-800',
    active: 'bg-green-600 text-white shadow-sm ring-2 ring-green-300',
  },
  [STATUS_FILTERS.PENDING]: {
    base: 'bg-amber-100 text-amber-800',
    active: 'bg-amber-600 text-white shadow-sm ring-2 ring-amber-300',
  },
  [STATUS_FILTERS.MISSING]: {
    base: 'bg-red-100 text-red-800',
    active: 'bg-red-600 text-white shadow-sm ring-2 ring-red-300',
  },
};

function formatPercentage(value) {
  return Number(value ?? 0).toFixed(2);
}

function ComplianceScoreBadge({ teamStats }) {
  if (!teamStats?.totalMembers) return null;
  const scoreNum = Number(teamStats.uploadPercentage ?? 0);
  const colorClass = scoreNum >= 80
    ? 'text-green-700 border-green-200 bg-white'
    : scoreNum >= 50
      ? 'text-amber-700 border-amber-200 bg-white'
      : 'text-red-700 border-red-200 bg-white';

  return (
    <span className={`inline-flex items-center gap-1 border rounded-full px-2.5 py-1 font-medium ${colorClass}`}>
      Team Compliance: {formatPercentage(teamStats.uploadPercentage)}%
    </span>
  );
}

function UploadMemberList({ members, variant }) {
  if (!members?.length) {
    return (
      <p className="text-[11px] text-gray-400 mt-1.5 italic">
        {variant === 'uploaded' ? 'No uploaded members.' : 'No members without upload.'}
      </p>
    );
  }

  return (
    <ul
      className={`mt-1.5 rounded-lg border px-2.5 py-2 space-y-0.5 max-h-36 overflow-y-auto ${
        variant === 'uploaded'
          ? 'border-green-200 bg-green-50'
          : 'border-red-200 bg-red-50'
      }`}
    >
      {members.map((m) => (
        <li
          key={m.userId}
          className={`text-[11px] font-medium truncate ${
            variant === 'uploaded' ? 'text-green-800' : 'text-red-800'
          }`}
        >
          {m.userName}
        </li>
      ))}
    </ul>
  );
}

function ComplianceScoreLine({ teamStats }) {
  const [expanded, setExpanded] = useState(null);

  if (!teamStats?.totalMembers) return null;

  const toggle = (key) => setExpanded((prev) => (prev === key ? null : key));
  const uploadedActive = expanded === 'uploaded';
  const notUploadedActive = expanded === 'notUploaded';

  return (
    <div className="mt-1">
      <p className="text-xs font-medium flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
        <button
          type="button"
          onClick={() => toggle('uploaded')}
          aria-expanded={uploadedActive}
          className={`font-semibold cursor-pointer underline-offset-2 hover:underline ${
            uploadedActive ? 'text-green-800 underline' : 'text-green-600'
          }`}
        >
          Team Compliance {formatPercentage(teamStats.uploadPercentage)}%
        </button>
        <span className="text-gray-300">|</span>
        <button
          type="button"
          onClick={() => toggle('notUploaded')}
          aria-expanded={notUploadedActive}
          className={`font-semibold cursor-pointer underline-offset-2 hover:underline ${
            notUploadedActive ? 'text-red-800 underline' : 'text-red-600'
          }`}
        >
          Not Upload {formatPercentage(teamStats.notUploadPercentage)}%
        </button>
        <span className="text-gray-400">({teamStats.totalMembers} active)</span>
      </p>
      {uploadedActive && (
        <UploadMemberList members={teamStats.uploadedMembers} variant="uploaded" />
      )}
      {notUploadedActive && (
        <UploadMemberList members={teamStats.notUploadedMembers} variant="notUploaded" />
      )}
    </div>
  );
}

function StatusFilterChip({ filterKey, label, count, activeFilter, onToggle }) {
  const isActive = activeFilter === filterKey;
  const styles = STATUS_CHIP_STYLES[filterKey];

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

const VIDEO_STATUS_LABELS = {
  none:     { label: 'Not Uploaded', icon: AlertCircle, color: 'text-red-600',   bg: 'border-red-300 bg-red-50' },
  pending:  { label: 'Pending Verification', icon: Clock, color: 'text-amber-700', bg: 'border-amber-300 bg-amber-50' },
  verified: { label: 'Verified', icon: CheckCircle,  color: 'text-green-700', bg: 'border-green-300 bg-white' },
};

function VideoMemberRow({ user, videoStatus, hasHealthVideo, hasBusinessVideo, videoVerifiedAt, teamStats }) {
  const cfg   = VIDEO_STATUS_LABELS[videoStatus] || VIDEO_STATUS_LABELS.none;
  const Icon  = cfg.icon;

  return (
    <div className={`rounded-2xl border-2 p-4 space-y-2 transition-colors ${cfg.bg}`}>
      <div className="flex items-center gap-3">
        {user.profileImage ? (
          <img src={user.profileImage} alt={user.userName} className="h-10 w-10 rounded-full object-cover border border-gray-200" loading="lazy" />
        ) : (
          <div className="h-10 w-10 rounded-full bg-green-200 flex items-center justify-center text-green-800 font-bold text-sm">
            {(user.userName || '?').charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 text-sm truncate">{user.userName}</p>
          <span className={`inline-flex items-center gap-1 text-[11px] font-bold ${cfg.color}`}>
            <Icon className="h-3 w-3" /> {cfg.label}
          </span>
          <ComplianceScoreLine teamStats={teamStats} />
        </div>
      </div>

      {videoStatus !== 'none' && (
        <div className="flex gap-2 flex-wrap text-xs">
          <ComplianceScoreBadge teamStats={teamStats} />
          {hasHealthVideo && (
            <span className="flex items-center gap-1 bg-white border border-gray-200 rounded-full px-2.5 py-1 text-gray-700 font-medium">
              <Video className="h-3 w-3 text-green-600" /> Health Results
            </span>
          )}
          {hasBusinessVideo && (
            <span className="flex items-center gap-1 bg-white border border-gray-200 rounded-full px-2.5 py-1 text-gray-700 font-medium">
              <Video className="h-3 w-3 text-blue-600" /> Business Results
            </span>
          )}
          {!hasHealthVideo && (
            <span className="bg-gray-100 rounded-full px-2.5 py-1 text-gray-400 font-medium">
              No health video
            </span>
          )}
          {!hasBusinessVideo && (
            <span className="bg-gray-100 rounded-full px-2.5 py-1 text-gray-400 font-medium">
              No business video
            </span>
          )}
        </div>
      )}

      {videoStatus === 'pending' && (
        <p className="text-xs text-amber-700 font-medium bg-amber-100 rounded-xl px-3 py-2 text-center">
          OTP sent to your email — share it with {user.userName} to verify
        </p>
      )}

      {videoStatus === 'verified' && videoVerifiedAt && (
        <p className="text-xs text-green-600 font-medium">
          Verified {new Date(videoVerifiedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
      )}
    </div>
  );
}

function MemberRow({ user, testimonial, teamStats }) {
  const missing  = !testimonial;
  const pending  = testimonial?.status === 'pending';
  const verified = testimonial?.status === 'verified';

  const diff = testimonial
    ? Math.abs(testimonial.afterWeightKg - testimonial.beforeWeightKg).toFixed(1)
    : null;
  const arrow     = testimonial?.goalType === 'loss' ? '↓' : '↑';
  const goalLabel = testimonial?.goalType === 'loss' ? 'Weight Loss' : 'Weight Gain';

  return (
    <div
      className={`rounded-2xl border-2 p-4 space-y-3 transition-colors ${
        missing
          ? 'border-red-300 bg-red-50'
          : pending
            ? 'border-amber-300 bg-amber-50'
            : 'border-green-300 bg-white'
      }`}
    >
      {/* Member header */}
      <div className="flex items-center gap-3">
        {user.profileImage ? (
          <img
            src={user.profileImage}
            alt={user.userName}
            className="h-10 w-10 rounded-full object-cover border border-gray-200"
            loading="lazy"
          />
        ) : (
          <div className="h-10 w-10 rounded-full bg-green-200 flex items-center justify-center text-green-800 font-bold text-sm">
            {(user.userName || '?').charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 text-sm truncate">{user.userName}</p>
          <div className="mt-0.5">
            {missing && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-600">
                <AlertCircle className="h-3 w-3" /> Not Uploaded
              </span>
            )}
            {pending && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700">
                <Clock className="h-3 w-3" /> Awaiting Approval
              </span>
            )}
            {verified && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-green-700">
                <CheckCircle className="h-3 w-3" /> Verified
              </span>
            )}
          </div>
          <ComplianceScoreLine teamStats={teamStats} />
        </div>
      </div>

      {/* Testimonial details */}
      {testimonial && (
        <>
          {/* Photos */}
          {(testimonial.beforeImageUrl || testimonial.afterImageUrl) && (
            <div className="flex gap-2">
              {testimonial.beforeImageUrl && (
                <div className="flex-1 text-center">
                  <img
                    src={testimonial.beforeImageUrl}
                    alt="Before"
                    className={PORTRAIT_IMAGE_CLASS_SM}
                    loading="lazy"
                  />
                  <p className="text-[10px] text-gray-400 mt-1 font-semibold">BEFORE</p>
                </div>
              )}
              {testimonial.afterImageUrl && (
                <div className="flex-1 text-center">
                  <img
                    src={testimonial.afterImageUrl}
                    alt="After"
                    className={PORTRAIT_IMAGE_CLASS_SM}
                    loading="lazy"
                  />
                  <p className="text-[10px] text-gray-400 mt-1 font-semibold">AFTER</p>
                </div>
              )}
            </div>
          )}

          {/* Stats */}
          <div className="flex gap-2 flex-wrap text-xs">
            <ComplianceScoreBadge teamStats={teamStats} />
            <span className="bg-white border border-gray-200 rounded-full px-2.5 py-1 text-gray-700 font-medium">
              Before: {testimonial.beforeWeightKg} kg
            </span>
            <span className="bg-white border border-gray-200 rounded-full px-2.5 py-1 text-gray-700 font-medium">
              After: {testimonial.afterWeightKg} kg
            </span>
            <span className="bg-white border border-gray-200 rounded-full px-2.5 py-1 text-green-700 font-semibold">
              {arrow} {diff} kg
            </span>
            <span className="bg-white border border-gray-200 rounded-full px-2.5 py-1 text-gray-700 font-medium">
              {goalLabel}
            </span>
            <span className="bg-white border border-gray-200 rounded-full px-2.5 py-1 text-gray-700 font-medium">
              ⏱ {testimonial.durationText}
            </span>
          </div>

          {pending && (
            <p className="text-xs text-amber-700 font-medium bg-amber-100 rounded-xl px-3 py-2 text-center">
              📧 OTP sent to your email — share it with {user.userName} to verify
            </p>
          )}

          {verified && testimonial.verifiedAt && (
            <p className="text-xs text-green-600 font-medium">
              ✅ Verified {new Date(testimonial.verifiedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          )}
        </>
      )}

      {!testimonial && teamStats?.totalMembers > 0 && (
        <div className="flex gap-2 flex-wrap text-xs">
          <ComplianceScoreBadge teamStats={teamStats} />
        </div>
      )}
    </div>
  );
}

export default function CoachTestimonialsPage({ user, activeTab: activeTabProp, onTabChange }) {
  const [activeTabInternal, setActiveTabInternal] = useState('photos');
  const activeTab = activeTabProp ?? activeTabInternal;
  const setActiveTab = onTabChange ?? setActiveTabInternal;

  const [directRows, setDirectRows] = useState([]);
  const [fullRows, setFullRows] = useState([]);
  const [mineRow, setMineRow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState(STATUS_FILTERS.ALL);
  const [teamScope, setTeamScope] = useState(TEAM_SCOPES.DIRECT);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [highlightedSuggestion, setHighlightedSuggestion] = useState(-1);

  // Video report state
  const [videoDirectRows, setVideoDirectRows] = useState([]);
  const [videoFullRows,   setVideoFullRows]   = useState([]);
  const [mineVideoRow,    setMineVideoRow]    = useState(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoScope,   setVideoScope]   = useState(TEAM_SCOPES.DIRECT);
  const [videoError,   setVideoError]   = useState(null);
  const [videoStatusFilter, setVideoStatusFilter] = useState(STATUS_FILTERS.ALL);

  // Team upload percentage summary (photo + video, direct + full)
  const [teamPerformanceByUserId, setTeamPerformanceByUserId] = useState({});

  const coachId = user?.userId || user?.id;

  const buildMineRow = useCallback(async () => {
    if (!coachId) return null;
    try {
      const testimonial = await getMyTestimonial(coachId);
      return {
        user: {
          userId: coachId,
          userName: user?.userName || user?.displayName || user?.name || 'You',
          profileImage: user?.profileImage || user?.photoURL || null,
          phoneNumber: user?.phoneNumber || user?.PhoneNumber || null,
        },
        testimonial: testimonial || null,
      };
    } catch {
      return {
        user: {
          userId: coachId,
          userName: user?.userName || user?.displayName || user?.name || 'You',
          profileImage: user?.profileImage || user?.photoURL || null,
          phoneNumber: user?.phoneNumber || user?.PhoneNumber || null,
        },
        testimonial: null,
      };
    }
  }, [coachId, user]);

  const buildMineVideoRow = useCallback(async () => {
    if (!coachId) return null;
    try {
      const video = await getMyVideoTestimonial(coachId);
      return {
        user: {
          userId: coachId,
          userName: user?.userName || user?.displayName || user?.name || 'You',
          profileImage: user?.profileImage || user?.photoURL || null,
        },
        videoStatus:      video?.videoStatus      ?? 'none',
        hasHealthVideo:   video?.hasHealthVideo   ?? false,
        hasBusinessVideo: video?.hasBusinessVideo ?? false,
        videoVerifiedAt:  video?.videoVerifiedAt  ?? null,
      };
    } catch {
      return {
        user: {
          userId: coachId,
          userName: user?.userName || user?.displayName || user?.name || 'You',
          profileImage: user?.profileImage || user?.photoURL || null,
        },
        videoStatus: 'none',
        hasHealthVideo: false,
        hasBusinessVideo: false,
        videoVerifiedAt: null,
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
    setStatusFilter(STATUS_FILTERS.ALL);
  }, [teamScope]);

  useEffect(() => {
    setVideoScope(TEAM_SCOPES.DIRECT);
    setVideoStatusFilter(STATUS_FILTERS.ALL);
  }, [activeTab]);

  useEffect(() => {
    setVideoStatusFilter(STATUS_FILTERS.ALL);
  }, [videoScope]);

  // ── Video report load ─────────────────────────────────────────────────────
  const loadVideoReport = useCallback(async () => {
    if (!coachId) return;
    setVideoLoading(true);
    setVideoError(null);
    try {
      const [direct, full, mine] = await Promise.all([
        getTestimonialVideoReport(coachId, 'direct'),
        getTestimonialVideoReport(coachId, 'full'),
        buildMineVideoRow(),
      ]);
      setVideoDirectRows(direct || []);
      setVideoFullRows(full || []);
      setMineVideoRow(mine);
    } catch (err) {
      setVideoError(err.message || 'Failed to load video report');
    } finally {
      setVideoLoading(false);
    }
  }, [coachId, buildMineVideoRow]);

  useEffect(() => {
    if (activeTab === 'videos') loadVideoReport();
  }, [activeTab, loadVideoReport]);

  const videoScopeRows = useMemo(() => {
    if (videoScope === TEAM_SCOPES.MINE) {
      return mineVideoRow ? [mineVideoRow] : [];
    }
    if (videoScope === TEAM_SCOPES.FULL) {
      return videoFullRows;
    }
    return videoDirectRows;
  }, [videoScope, mineVideoRow, videoDirectRows, videoFullRows]);

  const videoScopeCounts = useMemo(() => ({
    [TEAM_SCOPES.MINE]: mineVideoRow ? 1 : 0,
    [TEAM_SCOPES.DIRECT]: videoDirectRows.length,
    [TEAM_SCOPES.FULL]: videoFullRows.length,
  }), [mineVideoRow, videoDirectRows, videoFullRows]);

  const videoStatusCounts = useMemo(
    () => countVideoRowsByStatus(videoScopeRows),
    [videoScopeRows],
  );

  const videoStatusFilteredRows = useMemo(
    () => filterVideoRowsByStatus(videoScopeRows, videoStatusFilter),
    [videoScopeRows, videoStatusFilter],
  );

  const scopeRows = useMemo(() => {
    if (teamScope === TEAM_SCOPES.MINE) {
      return mineRow ? [mineRow] : [];
    }
    if (teamScope === TEAM_SCOPES.FULL) {
      return fullRows;
    }
    return directRows;
  }, [teamScope, mineRow, directRows, fullRows]);

  const teamScopeCounts = useMemo(
    () => countRowsByTeamScope(mineRow, directRows, fullRows),
    [mineRow, directRows, fullRows],
  );

  const statusCounts = useMemo(() => countRowsByStatus(scopeRows), [scopeRows]);

  const statusFilteredRows = useMemo(
    () => filterRowsByStatus(scopeRows, statusFilter),
    [scopeRows, statusFilter],
  );

  const suggestions = useMemo(
    () => buildSearchSuggestions(statusFilteredRows, searchQuery),
    [statusFilteredRows, searchQuery],
  );

  const filteredRows = useMemo(
    () => filterRowsBySearch(statusFilteredRows, searchQuery),
    [statusFilteredRows, searchQuery],
  );

  const handleStatusToggle = useCallback((next) => {
    setStatusFilter((current) => toggleStatusFilter(current, next));
  }, []);

  const handleVideoStatusToggle = useCallback((next) => {
    setVideoStatusFilter((current) => toggleStatusFilter(current, next));
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
      if (suggestions.length === 0) return;
      setIsSearchOpen(true);
      setHighlightedSuggestion((prev) => (
        prev < suggestions.length - 1 ? prev + 1 : 0
      ));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (suggestions.length === 0) return;
      setIsSearchOpen(true);
      setHighlightedSuggestion((prev) => (
        prev > 0 ? prev - 1 : suggestions.length - 1
      ));
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

  const showScopeLoading = loading;
  const hasScopeData = scopeRows.length > 0;
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
          onClick={() => {
            if (activeTab === 'videos') {
              loadVideoReport();
            } else {
              load();
            }
            loadTeamReport();
          }}
          disabled={activeTab === 'videos' ? videoLoading : loading}
          className="p-2 rounded-full text-gray-500 hover:text-green-700 hover:bg-green-50 transition-colors"
          ariaLabel="Refresh"
        >
          <RefreshCw className={`h-4 w-4 ${(activeTab === 'videos' ? videoLoading : loading) ? 'animate-spin' : ''}`} />
        </TouchFeedbackButton>
      </div>

      {/* Tab switcher: Photos / Videos */}
      <div className="bg-white rounded-xl border border-gray-200 px-1 py-1 flex gap-1" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'photos'}
          onClick={() => setActiveTab('photos')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer ${
            activeTab === 'photos' ? 'bg-green-600 text-white shadow-sm' : 'text-green-800 hover:bg-green-50'
          }`}
        >
          <Users className="h-3.5 w-3.5" /> Photos Report
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'videos'}
          onClick={() => setActiveTab('videos')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer ${
            activeTab === 'videos' ? 'bg-green-600 text-white shadow-sm' : 'text-green-800 hover:bg-green-50'
          }`}
        >
          <Video className="h-3.5 w-3.5" /> Videos Report
        </button>
      </div>

      {/* ── VIDEO REPORT TAB ─────────────────────────────────────────────── */}
      {activeTab === 'videos' && (
        <>
          {/* Video scope filter */}
          {!videoLoading && (
            <div className="bg-white rounded-xl border border-gray-200 px-1 py-1 flex gap-1" role="group" aria-label="Video scope filter">
              {TEAM_SCOPE_OPTIONS.map(({ value, label, short }) => {
                const isActive = videoScope === value;
                const count = videoScopeCounts[value] ?? 0;
                const showCount = value !== TEAM_SCOPES.MINE;
                const desktopLabel = showCount ? `${label} (${count})` : label;
                const mobileLabel = showCount ? `${short} (${count})` : short;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setVideoScope(value)}
                    aria-pressed={isActive}
                    className={`flex-1 py-2 rounded-lg text-[11px] sm:text-xs font-semibold transition-all duration-150 cursor-pointer min-w-0 px-1 ${
                      isActive ? 'bg-green-600 text-white shadow-sm' : 'text-green-800 hover:bg-green-50'
                    }`}
                  >
                    <span className="hidden sm:inline">{desktopLabel}</span>
                    <span className="sm:hidden">{mobileLabel}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Video status filter chips */}
          {!videoLoading && videoScopeRows.length > 0 && (
            <div
              className="flex gap-1.5 overflow-x-auto scrollbar-hide sm:flex-wrap sm:gap-2 sm:overflow-visible"
              role="group"
              aria-label="Video status filter"
            >
              <StatusFilterChip
                filterKey={STATUS_FILTERS.VERIFIED}
                label="✅ Verified"
                count={videoStatusCounts.verified}
                activeFilter={videoStatusFilter}
                onToggle={handleVideoStatusToggle}
              />
              <StatusFilterChip
                filterKey={STATUS_FILTERS.PENDING}
                label="🕐 Pending"
                count={videoStatusCounts.pending}
                activeFilter={videoStatusFilter}
                onToggle={handleVideoStatusToggle}
              />
              <StatusFilterChip
                filterKey={STATUS_FILTERS.MISSING}
                label="⚠️ Not Uploaded"
                count={videoStatusCounts.missing}
                activeFilter={videoStatusFilter}
                onToggle={handleVideoStatusToggle}
              />
            </div>
          )}

          {videoLoading && <LoadingSpinner message="Loading video report…" />}

          {videoError && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-700">{videoError}</div>
          )}

          {!videoLoading && !videoError && videoScopeRows.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <Video className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No team members found</p>
            </div>
          )}

          {!videoLoading && !videoError && videoScopeRows.length > 0 && videoStatusFilteredRows.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              <p className="font-medium text-sm">No records match the selected filters.</p>
            </div>
          )}

          {!videoLoading && videoStatusFilteredRows.map((row) => (
            <VideoMemberRow
              key={row.user.userId}
              user={row.user}
              videoStatus={row.videoStatus}
              hasHealthVideo={row.hasHealthVideo}
              hasBusinessVideo={row.hasBusinessVideo}
              videoVerifiedAt={row.videoVerifiedAt}
              teamStats={resolveRowTeamUploadPerformance({
                row,
                teamScope: videoScope,
                loggedInCoachId: coachId,
                teamPerformanceByUserId,
                reportType: 'video',
              })}
            />
          ))}
        </>
      )}

      {/* ── PHOTOS REPORT TAB ────────────────────────────────────────────── */}
      {activeTab === 'photos' && (
        <>
      {/* Team scope filter */}
      {!loading && (
        <div
          className="bg-white rounded-xl border border-gray-200 px-1 py-1 flex gap-1"
          role="group"
          aria-label="Team scope filter"
        >
          {TEAM_SCOPE_OPTIONS.map(({ value, label, short }) => {
            const isActive = teamScope === value;
            const count = teamScopeCounts[value] ?? 0;
            const showCount = value !== TEAM_SCOPES.MINE;
            const desktopLabel = showCount ? `${label} (${count})` : label;
            const mobileLabel = showCount ? `${short} (${count})` : short;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setTeamScope(value)}
                aria-pressed={isActive}
                className={`flex-1 py-2 rounded-lg text-[11px] sm:text-xs font-semibold transition-all duration-150 cursor-pointer min-w-0 px-1 ${
                  isActive
                    ? 'bg-green-600 text-white shadow-sm'
                    : 'text-green-800 hover:bg-green-50'
                }`}
              >
                <span className="hidden sm:inline">{desktopLabel}</span>
                <span className="sm:hidden">{mobileLabel}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Smart search */}
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

      {/* Summary chips — clickable status filters */}
      {!loading && hasScopeData && (
        <div
          className="flex gap-1.5 overflow-x-auto scrollbar-hide sm:flex-wrap sm:gap-2 sm:overflow-visible"
          role="group"
          aria-label="Status filter"
        >
          <StatusFilterChip
            filterKey={STATUS_FILTERS.VERIFIED}
            label="✅ Verified"
            count={statusCounts.verified}
            activeFilter={statusFilter}
            onToggle={handleStatusToggle}
          />
          <StatusFilterChip
            filterKey={STATUS_FILTERS.PENDING}
            label="🕐 Awaiting Approval"
            count={statusCounts.pending}
            activeFilter={statusFilter}
            onToggle={handleStatusToggle}
          />
          <StatusFilterChip
            filterKey={STATUS_FILTERS.MISSING}
            label="⚠️ Not Uploaded"
            count={statusCounts.missing}
            activeFilter={statusFilter}
            onToggle={handleStatusToggle}
          />
        </div>
      )}

      {showScopeLoading && <LoadingSpinner message="Loading team testimonials…" />}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {!showScopeLoading && !error && !hasScopeData && (
        <div className="text-center py-12 text-gray-400">
          <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No team members found</p>
        </div>
      )}

      {!showScopeLoading && !error && hasScopeData && filteredRows.length === 0 && (
        <div className="text-center py-8 text-gray-400">
          <p className="font-medium text-sm">
            {hasActiveSearch ? 'No matching users found.' : 'No records match the selected filters.'}
          </p>
        </div>
      )}

      {!showScopeLoading && filteredRows.map((row) => (
        <MemberRow
          key={row.user.userId}
          user={row.user}
          testimonial={row.testimonial}
          teamStats={resolveRowTeamUploadPerformance({
            row,
            teamScope,
            loggedInCoachId: coachId,
            teamPerformanceByUserId,
            reportType: 'photo',
          })}
        />
      ))}
        </>
      )}
    </div>
  );
}
