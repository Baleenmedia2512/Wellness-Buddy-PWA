import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { Trophy, Share2, Loader2, Calendar } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import {
  captureAndShare,
  precaptureShareImage,
  shareCachedDataUrl,
} from '../../../shared/utils/shareUtils.js';
import { debugLog } from '../../../shared/utils/logger.js';
import { resolveSponsorCoachNames } from '../../../shared/utils/sponsorCoachLabels.js';
import { setVisibilityAwareInterval } from '../../../shared/utils/visibilityAwareInterval.js';
import { useAutoScrollStrip } from '../../../shared/hooks/useAutoScrollStrip.js';
import TeamMemberProfileModal from '../../../shared/components/TeamMemberProfileModal';
import DateRangePicker from '../../../shared/components/common/DateRangePicker';
import LeaderboardAvatar from './LeaderboardAvatar.js';
import LeaderboardAvatarViewer from './LeaderboardAvatarViewer.js';
import LeaderboardRankBadge from './LeaderboardRankBadge.js';
import {
  buildUserAvatarUrl,
  getAvatarDisplayVersion,
} from '../../user/services/avatarDisplayVersion';
import { sortLeaderboardByRankAsc } from '../utils/leaderboardOrder.js';
import {
  hasValidProfileName,
  isPlaceholderUserName,
} from '../../user/domain/profileCompleteness';
import { subscribeDailyWellnessScoreSeed } from '../../wellness-score-sheet/services/dailyWellnessScoreCache';
import { LEADERBOARD_CONFIG } from '../../../config/leaderboardConfig.js';
import { useRaceLeaderboardRealtime } from '../hooks/useRaceLeaderboardRealtime.js';
import {
  LB_DATE_FILTER_OPTIONS,
  LB_DATE_PRESETS,
  LB_MAX_WINDOW_DAYS,
  resolveLbDateFilter,
} from '../domain/leaderboardDateFilter.js';

const CACHE_TTL = 15 * 1000;
// Keep a short poll even when Realtime is configured — subscribe can fail
// silently (missing env / blocked WS), and a 60s backup felt "not live".
const POLL_MS = LEADERBOARD_CONFIG.REFRESH_INTERVAL;
// v6: overlay chosen display name when DB still has user_<phone>
const CACHE_KEY_PREFIX = 'wv.lb.wellness.v7.';
const LEGACY_CACHE_KEYS = [
  'wv.lb.wellness',
  'wv.lb.wellness.v2',
  'wv.lb.wellness.v3',
  'wv.lb.wellness.v4',
  'wv.lb.wellness.v5',
  'wv.lb.wellness.v6',
];

function getLogoSrc() {
  try {
    if (typeof window !== 'undefined' && window.location?.origin) {
      return new URL('/logo.png', window.location.origin).href;
    }
  } catch {
    /* fallback */
  }
  return '/logo.png';
}

function getShareCardHeight(count) {
  const n = Number(count) || 0;
  if (n <= 0) return 1024;
  if (n >= 10) return 1024;
  // Fixed vertical overhead: padding-top(16) + header(~104) + border(2) + list-pt(4) + list-pb(24) + padding-bottom(40) = 190px
  // Row slot height with comfortable row gaps: ~83.4px
  return Math.round(190 + n * 83.4);
}

function displayLeaderboardName(entry, viewerUserId, viewerName) {
  const stored = String(entry?.userName || '').trim();
  const isViewer = Number(entry?.userId) === Number(viewerUserId);
  if (
    isViewer
    && hasValidProfileName(viewerName)
    && isPlaceholderUserName(stored)
  ) {
    return String(viewerName).trim();
  }
  return stored || 'Unknown';
}

const cacheKeyFor = (userId) => `${CACHE_KEY_PREFIX}${userId || 'anon'}`;

const stripAvatars = (data) =>
  (data || []).map(({ profileImage, ...rest }) => rest);

/** Home strip order: #1, #2, … #N (best first). */
const toAscendingRankOrder = (data) => sortLeaderboardByRankAsc(data);

const readCache = (userId) => {
  try {
    LEGACY_CACHE_KEYS.forEach((k) => localStorage.removeItem(k));
    const raw = localStorage.getItem(cacheKeyFor(userId));
    if (!raw) return null;
    const c = JSON.parse(raw);
    return Date.now() - c.ts < CACHE_TTL ? toAscendingRankOrder(c.data) : null;
  } catch { return null; }
};
const writeCache = (userId, data) => {
  try {
    // Do not cache base64 avatars — quota blows and leaves stale null-avatar data.
    localStorage.setItem(
      cacheKeyFor(userId),
      JSON.stringify({ data: stripAvatars(toAscendingRankOrder(data)), ts: Date.now() }),
    );
  } catch {
    try { localStorage.removeItem(cacheKeyFor(userId)); } catch { /* ignore */ }
  }
};

/**
 * Top wellness scores for today (IST).
 * @param {'strip'|'tile'} variant - strip = auto-scroll headline (legacy); tile = static card list
 */
const WellnessScoreLeaderboard = forwardRef(({ apiBaseUrl, topN = 10, userId, viewerName, email, variant = 'strip' }, ref) => {
  const [leaderboardData, setLeaderboardData] = useState(() => readCache(userId) ?? []);
  const [isVisible, setIsVisible] = useState(() => (readCache(userId)?.length ?? 0) > 0);
  const [hasEntered, setHasEntered] = useState(() => (readCache(userId)?.length ?? 0) > 0);
  const [expandedAvatar, setExpandedAvatar] = useState(null);
  const [profileMember, setProfileMember] = useState(null);
  const isTile = variant === 'tile';
  const cardRef = useRef(null);
  const shareCardRef = useRef(null);
  const cachedDataUrlRef = useRef(null);
  const [isSharing, setIsSharing] = useState(false);
  const todayFilter = resolveLbDateFilter(LB_DATE_PRESETS.TODAY);
  const [filterPreset, setFilterPreset] = useState(LB_DATE_PRESETS.TODAY);
  const [filterMeta, setFilterMeta] = useState(todayFilter);
  const [rangeData, setRangeData] = useState([]);
  const [rangeStatus, setRangeStatus] = useState('idle');
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [customStartDate, setCustomStartDate] = useState(null);
  const [customEndDate, setCustomEndDate] = useState(null);
  const [rangeError, setRangeError] = useState(null);
  const filterRef = useRef({
    preset: LB_DATE_PRESETS.TODAY,
    days: 1,
    dateYmd: null,
  });
  const { viewportRef, trackRef, interactionHandlers } = useAutoScrollStrip({
    enabled: !isTile && isVisible && leaderboardData.length > 0,
  });

  const fetchInFlightRef = useRef({});

  const isTodayFilter = filterPreset === LB_DATE_PRESETS.TODAY;
  const tileRows = isTodayFilter ? leaderboardData : rangeData;
  const shareHeight = getShareCardHeight(tileRows.length);

  const fetchLeaderboard = useCallback(async (days = 1, dateYmd = null) => {
    const windowDays = Number(days) >= 2 && Number(days) <= LB_MAX_WINDOW_DAYS
      ? Number(days)
      : 1;
    const endYmd = typeof dateYmd === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateYmd)
      ? dateYmd
      : null;
    const isTodayBoard = windowDays === 1 && !endYmd;
    const flightKey = endYmd
      ? `d${windowDays}:${endYmd}`
      : `d${windowDays}:today`;
    const emailTrim = String(email || '').trim();
    if ((userId == null || userId === '') && !emailTrim) {
      if (isTodayBoard) {
        setLeaderboardData([]);
        setIsVisible(false);
      } else {
        setRangeData([]);
        setRangeStatus('empty');
      }
      return;
    }
    if (fetchInFlightRef.current[flightKey]) return;
    fetchInFlightRef.current[flightKey] = true;
    try {
      const params = new URLSearchParams({
        topN: String(topN),
      });
      if (windowDays >= 2) params.set('days', String(windowDays));
      if (endYmd) params.set('date', endYmd);
      if (userId != null && userId !== '') params.set('userId', String(userId));
      if (emailTrim) params.set('email', emailTrim);
      const response = await fetch(
        `${apiBaseUrl}/api/leaderboard/get-wellness-score-leaderboard?${params}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );

      const result = await response.json();

      if (!isTodayBoard) {
        if (result.success && result.data?.length > 0) {
          setRangeData(toAscendingRankOrder(result.data));
          setRangeStatus('ready');
        } else {
          debugLog('[WELLNESS-LB] No filtered data:', result.message || 'Empty');
          setRangeData([]);
          setRangeStatus(result.success ? 'empty' : 'error');
        }
        return;
      }

      if (result.success && result.data?.length > 0) {
        const ordered = toAscendingRankOrder(result.data);
        setLeaderboardData(ordered);
        setIsVisible(true);
        writeCache(userId, ordered);
      } else {
        debugLog('[WELLNESS-LB] No data:', result.message || 'Empty');
        setLeaderboardData([]);
        setIsVisible(false);
      }
    } catch (error) {
      console.error('[WELLNESS-LB] Error fetching data:', error);
      if (isTodayBoard) {
        setLeaderboardData([]);
        setIsVisible(false);
      } else {
        setRangeData([]);
        setRangeStatus('error');
      }
    } finally {
      fetchInFlightRef.current[flightKey] = false;
    }
  }, [apiBaseUrl, topN, userId, email]);

  const applyFilter = useCallback((resolved) => {
    if (!resolved?.ok) return;
    const prev = filterRef.current;
    const sameQuery = prev.preset === resolved.preset
      && prev.days === resolved.days
      && prev.dateYmd === resolved.dateYmd;
    filterRef.current = {
      preset: resolved.preset,
      days: resolved.days,
      dateYmd: resolved.dateYmd,
    };
    setFilterPreset(resolved.preset);
    setFilterMeta(resolved);
    setRangeError(null);
    setShowFilterPanel(false);

    if (resolved.preset === LB_DATE_PRESETS.TODAY) {
      setShowCustomPicker(false);
      setRangeStatus('idle');
      // Keep today rows on screen; refresh quietly in the background.
      if (!sameQuery) fetchLeaderboard(1);
      return;
    }

    setShowCustomPicker(false);
    // Keep previous rows visible while the next filter loads (feels faster).
    if (!sameQuery) {
      setRangeStatus('loading');
      fetchLeaderboard(resolved.days, resolved.dateYmd);
    }
  }, [fetchLeaderboard]);

  const refreshBoards = useCallback(() => {
    fetchLeaderboard(1);
    const active = filterRef.current;
    if (active.preset !== LB_DATE_PRESETS.TODAY) {
      fetchLeaderboard(active.days, active.dateYmd);
    }
  }, [fetchLeaderboard]);

  const openDateFilter = useCallback(() => {
    setShowFilterPanel((open) => {
      const next = !open;
      if (!next) setShowCustomPicker(false);
      return next;
    });
    setRangeError(null);
  }, []);

  const selectPreset = useCallback((preset) => {
    if (preset === LB_DATE_PRESETS.CUSTOM) {
      setFilterPreset(LB_DATE_PRESETS.CUSTOM);
      setShowCustomPicker(true);
      setRangeError(null);
      return;
    }
    const resolved = resolveLbDateFilter(preset);
    if (!resolved.ok) return;
    setShowCustomPicker(false);
    applyFilter(resolved);
  }, [applyFilter]);

  const selectCustomRange = useCallback((start, end) => {
    const resolved = resolveLbDateFilter(
      LB_DATE_PRESETS.CUSTOM,
      start,
      end || start,
    );
    if (!resolved.ok) {
      setRangeError(
        resolved.error === 'range_too_long'
          ? `Select up to ${LB_MAX_WINDOW_DAYS} days only`
          : 'Invalid date range',
      );
      return;
    }
    setCustomStartDate(start);
    setCustomEndDate(end || start);
    setShowCustomPicker(false);
    applyFilter(resolved);
  }, [applyFilter]);

  useImperativeHandle(ref, () => ({
    refresh: refreshBoards,
  }));

  useRaceLeaderboardRealtime(refreshBoards);

  useEffect(() => {
    const cached = readCache(userId);
    if (cached?.length) {
      setLeaderboardData(cached);
      setIsVisible(true);
    }
    fetchLeaderboard(1);
    const retryEmpty = setTimeout(() => {
      if (userId == null || userId === '') return;
      if (!readCache(userId)?.length) fetchLeaderboard(1);
    }, 1600);
    const stopInterval = setVisibilityAwareInterval(refreshBoards, POLL_MS);
    return () => {
      clearTimeout(retryEmpty);
      stopInterval();
    };
  }, [fetchLeaderboard, refreshBoards, userId]);

  useEffect(() => {
    return subscribeDailyWellnessScoreSeed(() => {
      // Any local score seed — refresh Top 10 immediately (race scoreboard).
      refreshBoards();
    });
  }, [refreshBoards]);

  // Smooth enter once data is ready
  useEffect(() => {
    if (!isVisible || leaderboardData.length === 0) {
      setHasEntered(false);
      return undefined;
    }
    const id = requestAnimationFrame(() => setHasEntered(true));
    return () => cancelAnimationFrame(id);
  }, [isVisible, leaderboardData.length]);

  // Pre-capture card image off the click path to preserve browser user gesture
  useEffect(() => {
    cachedDataUrlRef.current = null;
    const target = shareCardRef.current || cardRef.current;
    if (!isTile || !target || !hasEntered) return undefined;
    let cancelled = false;
    const currentShareHeight = getShareCardHeight(tileRows.length);
    const timer = setTimeout(() => {
      precaptureShareImage(target, {
        scale: 2,
        quality: 0.95,
        targetWidth: 768,
        targetHeight: currentShareHeight,
        width: 768,
        height: currentShareHeight,
      }).then((dataUrl) => {
        if (!cancelled && dataUrl) {
          cachedDataUrlRef.current = dataUrl;
        }
      });
    }, 600);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isTile, leaderboardData, rangeData, filterPreset, hasEntered, tileRows.length]);

  const getRankColor = (rank) => {
    // Gold / silver / bronze by place (1 / 2 / 3), not by score %.
    if (rank === 1) return 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-white';
    if (rank === 2) return 'bg-gradient-to-br from-gray-300 to-gray-500 text-gray-900';
    if (rank === 3) return 'bg-gradient-to-br from-orange-400 to-orange-600 text-white';
    return 'bg-gradient-to-br from-green-500 to-green-700 text-white';
  };

  if (!isVisible || leaderboardData.length === 0) {
    return null;
  }

  const handleShareCard = async () => {
    const target = shareCardRef.current || cardRef.current;
    if (isSharing || !target) return;
    setIsSharing(true);
    try {
      const modeSuffix = isTodayFilter
        ? 'today'
        : `${filterPreset}-${filterMeta?.endYmd || filterMeta?.days || 'range'}`;
      const fileName = `top-${topN}-wellness-score-${modeSuffix}-${Date.now()}.jpg`;
      const currentShareHeight = getShareCardHeight(tileRows.length);
      const shareOpts = {
        title: `Top ${topN} Wellness Score`,
        text: `Top ${topN} Wellness Score - Wellness Valley`,
        fileName,
        scale: 2,
        quality: 0.95,
        targetWidth: 768,
        targetHeight: currentShareHeight,
        width: 768,
        height: currentShareHeight,
      };

      const cached = cachedDataUrlRef.current;
      if (cached) {
        const ok = await shareCachedDataUrl(cached, shareOpts);
        if (ok) return;
      }

      await captureAndShare(target, shareOpts);
    } catch (err) {
      if (!err?.message?.toLowerCase().includes('cancel')) {
        console.error('Share failed:', err);
      }
    } finally {
      setIsSharing(false);
    }
  };

  const openExpandedAvatar = (user, shownName) => {
    setExpandedAvatar({
      src: buildUserAvatarUrl(apiBaseUrl, user.userId, getAvatarDisplayVersion()),
      name: shownName,
      email: user.email,
      userId: user.userId,
    });
  };

  const openProfile = (user) => {
    const memberEmail = String(user?.email || '').trim();
    const memberUserId = user?.userId ?? user?.UserId;
    if (memberEmail || memberUserId != null) {
      setProfileMember({ email: memberEmail || null, userId: memberUserId ?? null });
    }
  };

  const renderTappableAvatar = (user, shownName) => (
    <button
      type="button"
      className="flex-shrink-0 rounded-full p-0 m-0 border-0 bg-transparent cursor-pointer appearance-none leading-none"
      onClick={(e) => {
        e.stopPropagation();
        openExpandedAvatar(user, shownName);
      }}
      aria-label={`View ${shownName}'s photo`}
    >
      <LeaderboardAvatar
        apiBaseUrl={apiBaseUrl}
        userId={user.userId}
        email={user.email}
        userName={shownName}
        profileImage={user.profileImage}
        interactive={false}
      />
    </button>
  );

  const avatarViewer = (
    <LeaderboardAvatarViewer
      isOpen={Boolean(expandedAvatar)}
      src={expandedAvatar?.src}
      name={expandedAvatar?.name}
      onClose={() => setExpandedAvatar(null)}
      onViewProfile={(expandedAvatar?.email || expandedAvatar?.userId != null) ? () => {
        setExpandedAvatar(null);
        openProfile(expandedAvatar);
      } : undefined}
    />
  );

  const profileViewer = (
    <TeamMemberProfileModal
      isOpen={Boolean(profileMember)}
      onClose={() => setProfileMember(null)}
      memberEmail={profileMember?.email}
      memberUserId={profileMember?.userId}
      apiBaseUrl={apiBaseUrl}
    />
  );

  const renderLeaderboardCard = (user, key) => {
    const shownName = displayLeaderboardName(user, userId, viewerName);
    return (
    <div
      key={key}
      className="inline-flex items-center gap-1.5 sm:gap-2 md:gap-3 mx-2 sm:mx-3 md:mx-4 flex-shrink-0"
    >
      <LeaderboardRankBadge
        rank={user.rank}
        colorClass={getRankColor(user.rank)}
      />

      <div className="flex-shrink-0">
        {renderTappableAvatar(user, shownName)}
      </div>

      <div className="flex flex-col justify-center flex-shrink-0 min-w-0 max-w-[120px] sm:max-w-[150px] md:max-w-[180px]">
        <button
          type="button"
          className="truncate text-left font-bold text-gray-800 text-xs sm:text-sm md:text-base leading-tight hover:underline focus:outline-none focus-visible:underline"
          onClick={(event) => {
            event.stopPropagation();
            openProfile(user);
          }}
          disabled={!user.email && user.userId == null}
          aria-label={`View ${shownName}'s profile`}
        >
          {shownName}
        </button>
        {(() => {
          const { sponsorName, idealCoachName } = resolveSponsorCoachNames(user);
          if (!sponsorName && !idealCoachName) return null;
          return (
            <div className="text-[10px] sm:text-xs md:text-sm text-gray-600 leading-tight min-w-0">
              {sponsorName && (
                <span className="block truncate">Sponsor: {sponsorName}</span>
              )}
              {idealCoachName && (
                <span className="block truncate">Coach: {idealCoachName}</span>
              )}
            </div>
          );
        })()}
      </div>

      <div className="flex items-center gap-0.5 bg-white px-1.5 sm:px-2 md:px-2.5 py-1 sm:py-1.5 rounded-lg shadow-sm flex-shrink-0">
        <span className="font-bold text-purple-600 text-xs sm:text-sm md:text-base whitespace-nowrap">
          {Math.round(user.totalEarned ?? 0)}/{Math.round(user.totalPossible ?? 0)}
        </span>
      </div>
    </div>
    );
  };

  const renderTileRow = (user) => {
    const shownName = displayLeaderboardName(user, userId, viewerName);
    const { sponsorName, idealCoachName } = resolveSponsorCoachNames(user);
    const sponsorCoachText = [
      sponsorName && `Sponsor: ${sponsorName}`,
      idealCoachName && `Coach: ${idealCoachName}`,
    ]
      .filter(Boolean)
      .join(' · ');

    return (
      <li key={user.userId} className="flex items-center gap-2.5 py-2">
        <LeaderboardRankBadge
          rank={user.rank}
          colorClass={getRankColor(user.rank)}
        />
        {renderTappableAvatar(user, shownName)}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1.5">
            <button
              type="button"
              className="min-w-0 truncate text-left text-sm font-semibold text-gray-800 hover:underline focus:outline-none focus-visible:underline leading-tight"
              onClick={() => openProfile(user)}
              disabled={!user.email && user.userId == null}
              aria-label={`View ${shownName}'s profile`}
            >
              {shownName}
            </button>
            <span className="inline-flex items-center justify-center shrink-0 rounded-md bg-violet-50 px-2 py-0.5 text-xs font-bold text-violet-700 leading-none">
              {Math.round(user.totalEarned ?? 0)}/{Math.round(user.totalPossible ?? 0)}
            </span>
          </div>
          {sponsorCoachText && (
            <p className="mt-0.5 text-[11px] leading-normal text-gray-500 break-words pb-0.5">
              {sponsorCoachText}
            </p>
          )}
        </div>
      </li>
    );
  };

  const renderShareTileRow = (user, index, total) => {
    const shownName = displayLeaderboardName(user, userId, viewerName);
    const { sponsorName, idealCoachName } = resolveSponsorCoachNames(user);
    const sponsorCoachText = [
      sponsorName && `Sponsor: ${sponsorName}`,
      idealCoachName && `Coach: ${idealCoachName}`,
    ]
      .filter(Boolean)
      .join(' · ');
    const isLast = index != null && total != null ? index === total - 1 : false;

    return (
      <li
        key={`share-${user.userId}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          padding: '8px 12px',
          borderBottom: isLast ? 'none' : '1px solid #f5f3ff',
          boxSizing: 'border-box',
          overflow: 'visible',
        }}
      >
        <LeaderboardRankBadge
          rank={user.rank}
          colorClass={getRankColor(user.rank)}
          className="w-11 h-11 shrink-0 select-none drop-shadow-sm pointer-events-none"
        />
        <div className="shrink-0" style={{ overflow: 'visible' }}>
          <LeaderboardAvatar
            apiBaseUrl={apiBaseUrl}
            userId={user.userId}
            email={user.email}
            userName={shownName}
            profileImage={user.profileImage}
            interactive={false}
            sizeClass="w-12 h-12"
          />
        </div>
        <div
          style={{
            flex: 1,
            minWidth: 0,
            overflow: 'visible',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              overflow: 'visible',
            }}
          >
            <div
              style={{
                fontSize: '18px',
                fontWeight: 700,
                color: '#111827',
                lineHeight: 1.35,
                margin: 0,
                padding: '2px 0',
                overflow: 'visible',
                whiteSpace: 'nowrap',
              }}
            >
              {shownName}
            </div>
            <div
              style={{
                flexShrink: 0,
                backgroundColor: '#f5f3ff',
                color: '#6d28d9',
                fontWeight: 800,
                fontSize: '26px',
                letterSpacing: '-0.02em',
                lineHeight: 1.15,
                padding: '7px 16px',
                borderRadius: '12px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                whiteSpace: 'nowrap',
              }}
            >
              {Math.round(user.totalEarned ?? 0)}/{Math.round(user.totalPossible ?? 0)}
            </div>
          </div>
          {sponsorCoachText ? (
            <div
              style={{
                fontSize: '13px',
                color: '#6b7280',
                lineHeight: 1.35,
                marginTop: '3px',
                margin: 0,
                padding: '2px 0 0 0',
                overflow: 'visible',
                whiteSpace: 'nowrap',
              }}
            >
              {sponsorCoachText}
            </div>
          ) : null}
        </div>
      </li>
    );
  };

  if (isTile) {
    const tileSubtitle = filterMeta?.subtitle || "Today's ranking";
    const buttonLabel = filterMeta?.buttonLabel || 'Today';
    const ariaPeriod = isTodayFilter ? null : (filterMeta?.subtitle || filterPreset);
    return (
      <>
        <section
          ref={cardRef}
          className={`mx-1 rounded-2xl border border-violet-100 bg-white p-3 shadow-sm transition-opacity duration-500 ease-out ${
            hasEntered ? 'opacity-100' : 'opacity-0'
          }`}
          aria-label={ariaPeriod ? `Top ${topN} Wellness Score, ${ariaPeriod}` : `Top ${topN} Wellness Score`}
        >
          <header className="mb-1 flex items-center gap-2 border-b border-violet-50 pb-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100" aria-hidden>
              <Trophy className="h-4 w-4 text-violet-700" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-bold text-violet-900">Top {topN} Wellness Score</h3>
                <button
                  type="button"
                  className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-violet-600 hover:bg-violet-100 hover:text-violet-800 transition-colors focus:outline-none disabled:opacity-50"
                  onClick={handleShareCard}
                  disabled={isSharing}
                  data-html2canvas-ignore="true"
                  aria-label={`Share Top ${topN} Wellness Score as image`}
                  title="Share as image"
                >
                  {isSharing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Share2 className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
              <p className="text-[11px] text-violet-700/80">{tileSubtitle}</p>
            </div>
            <button
              type="button"
              className={`ml-auto inline-flex shrink-0 items-center justify-center gap-1 rounded-lg px-2.5 py-1.5 text-center text-[11px] font-semibold leading-tight ${
                showFilterPanel || !isTodayFilter
                  ? 'bg-violet-600 text-white'
                  : 'bg-violet-50 text-violet-700'
              }`}
              onClick={openDateFilter}
              aria-expanded={showFilterPanel}
              aria-label="Open wellness score date filter"
              data-html2canvas-ignore="true"
            >
              <Calendar className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="truncate max-w-[6.5rem]">{buttonLabel}</span>
            </button>
          </header>

          {showFilterPanel && (
            <div
              className="mb-2 rounded-xl border border-violet-100 bg-violet-50/60 p-2"
              data-html2canvas-ignore="true"
            >
              <div className="flex gap-1.5 overflow-x-auto pb-0.5 no-scrollbar" role="group" aria-label="Date filter">
                {LB_DATE_FILTER_OPTIONS.map((option) => {
                  const selected = filterPreset === option.value
                    || (option.value === LB_DATE_PRESETS.CUSTOM && showCustomPicker);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => selectPreset(option.value)}
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold transition-colors ${
                        selected
                          ? 'bg-violet-700 text-white'
                          : 'bg-white text-violet-800 border border-violet-200'
                      }`}
                      aria-pressed={selected}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
              {rangeError && (
                <p className="mt-1.5 text-[10px] font-medium text-red-600">{rangeError}</p>
              )}
              <AnimatePresence>
                {showCustomPicker && (
                  <div className="mt-2">
                    <DateRangePicker
                      startDate={customStartDate}
                      endDate={customEndDate}
                      onSelect={selectCustomRange}
                      onClose={() => setShowCustomPicker(false)}
                    />
                  </div>
                )}
              </AnimatePresence>
            </div>
          )}

          <ul className="divide-y divide-violet-50">
            {!isTodayFilter && rangeStatus === 'loading' && tileRows.length === 0 && (
              <li className="py-3 text-center text-xs text-violet-700">Loading ranking…</li>
            )}
            {!isTodayFilter && rangeStatus === 'empty' && tileRows.length === 0 && (
              <li className="py-3 text-center text-xs text-gray-500">No scores for this date filter.</li>
            )}
            {!isTodayFilter && rangeStatus === 'error' && tileRows.length === 0 && (
              <li className="py-3 text-center text-xs text-gray-500">Could not load this date filter.</li>
            )}
            {tileRows.map(renderTileRow)}
          </ul>
          {avatarViewer}
          {profileViewer}
        </section>

        {/* Off-screen card used exclusively for sharing with dynamic poster height */}
        <div
          ref={shareCardRef}
          aria-hidden="true"
          style={{
            position: 'fixed',
            left: '-9999px',
            top: 0,
            width: 768,
            height: shareHeight,
            boxSizing: 'border-box',
            overflow: 'hidden',
            backgroundColor: '#ffffff',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              width: 768,
              height: shareHeight,
              padding: '16px 36px 40px 36px',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: '#ffffff',
              fontFamily:
                "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
            }}
          >
            <header
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '16px',
                paddingBottom: '8px',
                borderBottom: '2px solid #ede9fe',
                flexShrink: 0,
                boxSizing: 'border-box',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <span
                  style={{
                    display: 'flex',
                    width: '60px',
                    height: '60px',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '16px',
                    backgroundColor: '#ede9fe',
                    flexShrink: 0,
                  }}
                  aria-hidden
                >
                  <Trophy style={{ width: '36px', height: '36px', color: '#6d28d9' }} />
                </span>
                <div>
                  <h3
                    style={{
                      fontSize: '26px',
                      fontWeight: 800,
                      color: '#4c1d95',
                      letterSpacing: '-0.02em',
                      margin: 0,
                      lineHeight: 1.2,
                    }}
                  >
                    Top {topN} Wellness Score
                  </h3>
                  <p
                    style={{
                      fontSize: '15px',
                      fontWeight: 600,
                      color: '#6d28d9',
                      opacity: 0.85,
                      margin: '4px 0 0 0',
                      lineHeight: 1.2,
                    }}
                  >
                    {tileSubtitle}
                  </p>
                </div>
              </div>
              <img
                src={getLogoSrc()}
                alt="Wellness Valley"
                style={{
                  width: '96px',
                  height: '96px',
                  objectFit: 'contain',
                  flexShrink: 0,
                }}
                crossOrigin="anonymous"
              />
            </header>
            <ul
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: tileRows.length > 1 ? 'space-between' : 'flex-start',
                padding: '4px 0 24px 0',
                margin: 0,
                listStyle: 'none',
              }}
            >
              {tileRows.map((user, idx) => renderShareTileRow(user, idx, tileRows.length))}
            </ul>
          </div>
        </div>
      </>
    );
  }

  return (
    <div
      className={`w-full bg-gradient-to-r from-purple-50 via-indigo-50 to-purple-50 shadow-sm transition-opacity duration-500 ease-out ${
        hasEntered ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className="py-0 px-0">
        <div className="relative h-[76px] sm:h-[84px] overflow-hidden">
          <div className="absolute inset-y-0 left-0 z-10 pointer-events-none flex items-stretch">
            <div
              className="flex h-full w-[60px] sm:w-[64px] items-center justify-center rounded-r-md bg-white px-1 py-2 text-center text-[9px] sm:text-[10px] font-semibold leading-[1.2] text-purple-700 shadow-sm"
              aria-label={`Top ${topN} Wellness Score`}
            >
              Top {topN}<br />Wellness<br />Score
            </div>
          </div>

          <div
            ref={viewportRef}
            className="h-full overflow-hidden pl-[58px] sm:pl-[62px] cursor-pointer"
            style={{ touchAction: 'pan-y' }}
            {...interactionHandlers}
          >
            <div
              ref={trackRef}
              className="whitespace-nowrap inline-flex items-center h-full will-change-transform"
              style={{ transform: 'translate3d(0,0,0)', backfaceVisibility: 'hidden' }}
            >
              {leaderboardData.map((user) =>
                renderLeaderboardCard(user, `first-${user.userId}`),
              )}
              {leaderboardData.map((user) =>
                renderLeaderboardCard(user, `second-${user.userId}`),
              )}
            </div>
          </div>
        </div>
      </div>
      {avatarViewer}
      {profileViewer}
    </div>
  );
});

export default WellnessScoreLeaderboard;
