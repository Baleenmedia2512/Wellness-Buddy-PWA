import React, {
  useState,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
  useRef,
} from "react";
import { Scale, Share2, Loader2, Calendar } from "lucide-react";
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
import LeaderboardAvatar from '../../leaderboard/components/LeaderboardAvatar.js';
import LeaderboardAvatarViewer from '../../leaderboard/components/LeaderboardAvatarViewer.js';
import LeaderboardRankBadge from '../../leaderboard/components/LeaderboardRankBadge.js';
import {
  buildUserAvatarUrl,
  getAvatarDisplayVersion,
} from '../../user/services/avatarDisplayVersion';
import { sortLeaderboardByRankAsc } from '../../leaderboard/utils/leaderboardOrder.js';
import { LEADERBOARD_CONFIG } from '../../../config/leaderboardConfig.js';
import { useRaceLeaderboardRealtime } from '../../leaderboard/hooks/useRaceLeaderboardRealtime.js';
import {
  LB_DATE_FILTER_OPTIONS,
  LB_DATE_PRESETS,
  LB_MAX_WINDOW_DAYS,
  resolveLbDateFilter,
} from '../../leaderboard/domain/leaderboardDateFilter.js';

const WEIGHT_FILTER_LABELS = Object.freeze({
  todaySubtitle: 'Today vs Yesterday',
  todayButtonLabel: 'Today',
});

const resolveWeightFilter = (preset, customStart = null, customEnd = null) => (
  resolveLbDateFilter(preset, customStart, customEnd, new Date(), undefined, WEIGHT_FILTER_LABELS)
);

// ---------------------------------------------------------------------------
// SWR cache — hierarchy-scoped (per logged-in user).
// Stale data shows instantly on back-navigation; fresh data arrives quietly.
// ---------------------------------------------------------------------------
const WEIGHT_LB_CACHE_TTL = 15 * 1000;
// Keep a short poll even when Realtime is configured (WS can fail silently).
const POLL_MS = LEADERBOARD_CONFIG.REFRESH_INTERVAL;
// v4: hierarchy-scoped Top N (per logged-in user)
const WEIGHT_LB_CACHE_KEY_PREFIX = 'wv.lb.weight.v5.';
const WEIGHT_LB_LEGACY_KEYS = ['wv.lb.weight', 'wv.lb.weight.v2', 'wv.lb.weight.v3', 'wv.lb.weight.v4'];

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

const cacheKeyFor = (userId) => `${WEIGHT_LB_CACHE_KEY_PREFIX}${userId || 'anon'}`;

const stripWeightAvatars = (data) =>
  (data || []).map(({ profileImage, ...rest }) => rest);

const readWeightLBCache = (userId) => {
  try {
    WEIGHT_LB_LEGACY_KEYS.forEach((k) => localStorage.removeItem(k));
    const raw = localStorage.getItem(cacheKeyFor(userId));
    if (!raw) return null;
    const c = JSON.parse(raw);
    return Date.now() - c.ts < WEIGHT_LB_CACHE_TTL ? sortLeaderboardByRankAsc(c.data) : null;
  } catch { return null; }
};
const writeWeightLBCache = (userId, data) => {
  try {
    // Do not cache base64 avatars — quota blows and leaves stale null-avatar data.
    localStorage.setItem(
      cacheKeyFor(userId),
      JSON.stringify({ data: stripWeightAvatars(sortLeaderboardByRankAsc(data)), ts: Date.now() }),
    );
  } catch {
    try { localStorage.removeItem(cacheKeyFor(userId)); } catch { /* ignore */ }
  }
};

/**
 * WeightLossLeaderboard Component
 * Hierarchy-scoped weight loss leaderboard (Today vs Yesterday by default).
 * Tile variant uses the same IST date filter as Top 10 Wellness Score.
 *
 * @param {'strip'|'tile'} variant - strip = auto-scroll headline (legacy); tile = static card list
 */
const WeightLossLeaderboard = forwardRef(({ apiBaseUrl, topN = 10, userId, email, variant = 'strip' }, ref) => {
  const [leaderboardData, setLeaderboardData] = useState(() => readWeightLBCache(userId) ?? []);
  const [isVisible, setIsVisible] = useState(() => (readWeightLBCache(userId)?.length ?? 0) > 0);
  const [hasEntered, setHasEntered] = useState(() => (readWeightLBCache(userId)?.length ?? 0) > 0);
  const [expandedAvatar, setExpandedAvatar] = useState(null);
  const [profileMember, setProfileMember] = useState(null);
  const isTile = variant === 'tile';
  const cardRef = useRef(null);
  const shareCardRef = useRef(null);
  const cachedDataUrlRef = useRef(null);
  const [isSharing, setIsSharing] = useState(false);
  const todayFilter = resolveWeightFilter(LB_DATE_PRESETS.TODAY);
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
  const fetchInFlightRef = useRef({});
  const { viewportRef, trackRef, interactionHandlers } = useAutoScrollStrip({
    enabled: !isTile && isVisible && leaderboardData.length > 0,
  });

  const isTodayFilter = filterPreset === LB_DATE_PRESETS.TODAY;

  const fetchLeaderboard = useCallback(async (days = 1, dateYmd = null) => {
    const windowDays = Number(days) >= 2 && Number(days) <= LB_MAX_WINDOW_DAYS
      ? Number(days)
      : 1;
    const endYmd = typeof dateYmd === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateYmd)
      ? dateYmd
      : null;
    const isTodayBoard = windowDays === 1 && !endYmd;
    const flightKey = endYmd ? `d${windowDays}:${endYmd}` : `d${windowDays}:today`;
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
        `${apiBaseUrl}/api/leaderboard/get-global-leaderboard?${params}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) {
        debugLog("[LEADERBOARD] API returned", response.status);
        if (isTodayBoard) return;
        setRangeData([]);
        setRangeStatus('error');
        return;
      }

      const result = await response.json();

      if (!isTodayBoard) {
        if (result.success && result.data?.length > 0) {
          setRangeData(sortLeaderboardByRankAsc(result.data));
          setRangeStatus('ready');
        } else {
          debugLog('[LEADERBOARD] No filtered data:', result.message || 'Empty');
          setRangeData([]);
          setRangeStatus(result.success ? 'empty' : 'error');
        }
        return;
      }

      if (result.success && result.data && result.data.length > 0) {
        const ordered = sortLeaderboardByRankAsc(result.data);
        setLeaderboardData(ordered);
        setIsVisible(true);
        writeWeightLBCache(userId, ordered);
      } else {
        debugLog(
          "⚠ [LEADERBOARD] No data available:",
          result.message || "Empty data",
        );
        setLeaderboardData([]);
        setIsVisible(false);
      }
    } catch (error) {
      debugLog("[LEADERBOARD] Error fetching data:", error?.message || error);
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
      if (!sameQuery) fetchLeaderboard(1);
      return;
    }

    setShowCustomPicker(false);
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
    const resolved = resolveWeightFilter(preset);
    if (!resolved.ok) return;
    setShowCustomPicker(false);
    applyFilter(resolved);
  }, [applyFilter]);

  const selectCustomRange = useCallback((start, end) => {
    const resolved = resolveWeightFilter(
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

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    // refresh: re-fetches from server (retries after 4s for DB propagation)
    refresh: refreshBoards,
    // injectEntry: instantly show the current user's entry in the strip
    // without waiting for any API call. The next refresh will replace with real data.
    injectEntry: ({ userId: entryUserId, userName, email, weightLoss, profileImage, coachName }) => {
      // Match API: loss-only and ≤ 3 kg for Weight Loss Today vs Yesterday strip
      if (!weightLoss || weightLoss <= 0 || weightLoss > 3) return;
      setLeaderboardData((prev) => {
        // Remove any existing entry for this user, then add new one at top
        const filtered = prev.filter((u) => u.userId !== entryUserId);
        const injected = [{
          userId: entryUserId,
          userName: userName || "You",
          email: email || "",
          coachName: coachName || "",
          profileImage: profileImage || null,
          weightLoss: parseFloat(weightLoss.toFixed(2)),
          rank: 1,
          todayWeight: null,
          yesterdayWeight: null,
        }, ...filtered];
        // Re-rank after injection
        return injected.map((u, i) => ({ ...u, rank: i + 1 }));
      });
      setIsVisible(true);
    },
  }));

  useRaceLeaderboardRealtime(refreshBoards);

  // Instant paint from SWR cache; Realtime pings + slower poll backup
  useEffect(() => {
    const cached = readWeightLBCache(userId);
    if (cached?.length) {
      setLeaderboardData(cached);
      setIsVisible(true);
    }
    fetchLeaderboard(1);
    return setVisibilityAwareInterval(refreshBoards, POLL_MS);
  }, [fetchLeaderboard, refreshBoards, userId]);

  // Smooth fade-in when the strip becomes visible
  useEffect(() => {
    if (!isVisible || leaderboardData.length === 0) {
      setHasEntered(false);
      return undefined;
    }
    const id = requestAnimationFrame(() => setHasEntered(true));
    return () => cancelAnimationFrame(id);
  }, [isVisible, leaderboardData.length]);

  // Format weight loss display (grams for < 1kg, kg for >= 1kg)
  const formatWeightLoss = (weightLoss) => {
    if (weightLoss < 1) {
      const grams = Math.round(weightLoss * 1000);
      return { value: grams, unit: "g" };
    }
    // Round to 1 decimal place for kg
    const kg = Math.round(weightLoss * 10) / 10;
    return { value: kg, unit: "kg" };
  };

  // Get rank badge color
  const getRankColor = (rank) => {
    if (rank === 1)
      return "bg-gradient-to-br from-yellow-400 to-yellow-600 text-white";
    if (rank === 2)
      return "bg-gradient-to-br from-gray-300 to-gray-500 text-gray-900";
    if (rank === 3)
      return "bg-gradient-to-br from-orange-400 to-orange-600 text-white";
    return "bg-gradient-to-br from-green-500 to-green-700 text-white";
  };

  // Pre-capture card image off the click path to preserve browser user gesture
  useEffect(() => {
    cachedDataUrlRef.current = null;
    const target = shareCardRef.current || cardRef.current;
    if (!isTile || !target || !hasEntered) return undefined;
    let cancelled = false;
    const timer = setTimeout(() => {
      precaptureShareImage(target, {
        scale: 2,
        quality: 0.95,
        targetWidth: 768,
        targetHeight: 1024,
        width: 768,
        height: 1024,
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
  }, [isTile, leaderboardData, rangeData, filterPreset, hasEntered]);

  // Don't render if no data or loading failed
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
      const fileName = `top-${topN}-weight-loss-${modeSuffix}-${Date.now()}.jpg`;
      const shareOpts = {
        title: `Top ${topN} Weight Loss`,
        text: `Top ${topN} Weight Loss - Wellness Valley`,
        fileName,
        scale: 2,
        quality: 0.95,
        targetWidth: 768,
        targetHeight: 1024,
        width: 768,
        height: 1024,
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

  const openProfile = (user) => {
    const memberEmail = String(user?.email || user?.Email || '').trim();
    const memberUserId = user?.userId ?? user?.UserId ?? user?.userID ?? user?.id;
    if (memberEmail || memberUserId != null) {
      setProfileMember({ email: memberEmail || null, userId: memberUserId ?? null });
    }
  };

  const openExpandedAvatar = (user) => {
    const memberUserId = user?.userId ?? user?.UserId ?? user?.userID ?? user?.id;
    setExpandedAvatar({
      src: buildUserAvatarUrl(apiBaseUrl, memberUserId, getAvatarDisplayVersion()),
      name: user?.userName || user?.UserName || 'User',
      email: user?.email || user?.Email,
      userId: memberUserId,
    });
  };

  const renderTappableAvatar = (user) => (
    <button
      type="button"
      className="flex-shrink-0 rounded-full p-0 m-0 border-0 bg-transparent cursor-pointer appearance-none leading-none"
      onClick={(event) => {
        event.stopPropagation();
        openExpandedAvatar(user);
      }}
      aria-label={`View ${user.userName || 'user'}'s photo`}
    >
      <LeaderboardAvatar
        apiBaseUrl={apiBaseUrl}
        userId={user.userId ?? user.UserId ?? user.userID ?? user.id}
        email={user.email || user.Email}
        userName={user.userName || user.UserName}
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
      onViewProfile={() => {
        const member = expandedAvatar;
        setExpandedAvatar(null);
        openProfile(member);
      }}
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

  // Render leaderboard card (strip row)
  const renderLeaderboardCard = (user, key) => (
    <div
      key={key}
      className="inline-flex items-center gap-1.5 sm:gap-2 md:gap-3 mx-2 sm:mx-3 md:mx-4 flex-shrink-0"
    >
      <LeaderboardRankBadge
        rank={user.rank}
        colorClass={getRankColor(user.rank)}
      />

      {/* Profile Avatar */}
      <div className="flex-shrink-0">
        {renderTappableAvatar(user)}
      </div>

      {/* User Details */}
      <div className="flex flex-col justify-center flex-shrink-0 min-w-0 max-w-[120px] sm:max-w-[150px] md:max-w-[180px]">
        <button
          type="button"
          className="truncate text-left font-bold text-gray-800 text-xs sm:text-sm md:text-base leading-tight hover:underline focus:outline-none focus-visible:underline"
          onClick={(event) => {
            event.stopPropagation();
            openProfile(user);
          }}
          disabled={!user.email && user.userId == null}
          aria-label={`View ${user.userName || 'user'}'s profile`}
        >
          {user.userName}
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

      {/* Weight Loss Badge */}
      <div className="flex items-center gap-0.5 bg-white px-1.5 sm:px-2 md:px-2.5 py-1 sm:py-1.5 rounded-lg shadow-sm flex-shrink-0">
        <span className="font-bold text-green-600 text-xs sm:text-sm md:text-base whitespace-nowrap">
          -{formatWeightLoss(user.weightLoss).value}{" "}
          <span className="font-medium text-[10px] sm:text-xs md:text-sm">
            {formatWeightLoss(user.weightLoss).unit}
          </span>
        </span>
      </div>
    </div>
  );

  const renderTileRow = (user) => {
    const formatted = formatWeightLoss(user.weightLoss);
    const { sponsorName, idealCoachName } = resolveSponsorCoachNames(user);
    const sponsorCoachText = [
      sponsorName && `Sponsor: ${sponsorName}`,
      idealCoachName && `Coach: ${idealCoachName}`,
    ]
      .filter(Boolean)
      .join(' · ');

    return (
      <li
        key={user.userId}
        className="flex items-center gap-2.5 py-2"
      >
        <LeaderboardRankBadge
          rank={user.rank}
          colorClass={getRankColor(user.rank)}
        />
        {renderTappableAvatar(user)}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1.5">
            <button
              type="button"
              className="min-w-0 truncate text-left text-sm font-semibold text-gray-800 hover:underline focus:outline-none focus-visible:underline leading-tight"
              onClick={() => openProfile(user)}
              disabled={!user.email && user.userId == null}
              aria-label={`View ${user.userName || 'user'}'s profile`}
            >
              {user.userName}
            </button>
            <span className="inline-flex items-center justify-center shrink-0 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700 leading-none">
              -{formatted.value} {formatted.unit}
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

  const renderShareTileRow = (user) => {
    const formatted = formatWeightLoss(user.weightLoss);
    const { sponsorName, idealCoachName } = resolveSponsorCoachNames(user);
    const sponsorCoachText = [
      sponsorName && `Sponsor: ${sponsorName}`,
      idealCoachName && `Coach: ${idealCoachName}`,
    ]
      .filter(Boolean)
      .join(' · ');

    return (
      <li
        key={`share-${user.userId}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          padding: '8px 12px',
          borderBottom: '1px solid #ecfdf5',
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
            userName={user.userName}
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
              {user.userName}
            </div>
            <div
              style={{
                flexShrink: 0,
                backgroundColor: '#ecfdf5',
                color: '#047857',
                fontWeight: 700,
                fontSize: '15px',
                lineHeight: 1.2,
                padding: '5px 12px',
                borderRadius: '8px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                whiteSpace: 'nowrap',
              }}
            >
              -{formatted.value} {formatted.unit}
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
    const tileRows = isTodayFilter ? leaderboardData : rangeData;
    const tileSubtitle = filterMeta?.subtitle || 'Today vs Yesterday';
    const buttonLabel = filterMeta?.buttonLabel || 'Today';
    const ariaPeriod = isTodayFilter ? null : (filterMeta?.subtitle || filterPreset);
    return (
      <>
        <section
          ref={cardRef}
          className={`mx-1 rounded-2xl border border-emerald-100 bg-white p-3 shadow-sm transition-opacity duration-500 ease-out ${
            hasEntered ? 'opacity-100' : 'opacity-0'
          }`}
          aria-label={ariaPeriod ? `Top ${topN} Weight Loss, ${ariaPeriod}` : 'Weight Loss Today vs Yesterday'}
        >
          <header className="mb-1 flex items-center gap-2 border-b border-emerald-50 pb-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100" aria-hidden>
              <Scale className="h-4 w-4 text-emerald-700" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-bold text-emerald-900">Top {topN} Weight Loss</h3>
                <button
                  type="button"
                  className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-emerald-600 hover:bg-emerald-100 hover:text-emerald-800 transition-colors focus:outline-none disabled:opacity-50"
                  onClick={handleShareCard}
                  disabled={isSharing}
                  data-html2canvas-ignore="true"
                  aria-label={`Share Top ${topN} Weight Loss as image`}
                  title="Share as image"
                >
                  {isSharing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Share2 className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
              <p className="text-[11px] text-emerald-700/80">{tileSubtitle}</p>
            </div>
            <button
              type="button"
              className={`ml-auto inline-flex shrink-0 items-center justify-center gap-1 rounded-lg px-2.5 py-1.5 text-center text-[11px] font-semibold leading-tight ${
                showFilterPanel || !isTodayFilter
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-50 text-emerald-700'
              }`}
              onClick={openDateFilter}
              aria-expanded={showFilterPanel}
              aria-label="Open weight loss date filter"
              data-html2canvas-ignore="true"
            >
              <Calendar className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="truncate max-w-[6.5rem]">{buttonLabel}</span>
            </button>
          </header>

          {showFilterPanel && (
            <div
              className="mb-2 rounded-xl border border-emerald-100 bg-emerald-50/60 p-2"
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
                          ? 'bg-emerald-700 text-white'
                          : 'bg-white text-emerald-800 border border-emerald-200'
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

          <ul className="divide-y divide-emerald-50">
            {!isTodayFilter && rangeStatus === 'loading' && tileRows.length === 0 && (
              <li className="py-3 text-center text-xs text-emerald-700">Loading ranking…</li>
            )}
            {!isTodayFilter && rangeStatus === 'empty' && tileRows.length === 0 && (
              <li className="py-3 text-center text-xs text-gray-500">No weight loss for this date filter.</li>
            )}
            {!isTodayFilter && rangeStatus === 'error' && tileRows.length === 0 && (
              <li className="py-3 text-center text-xs text-gray-500">Could not load this date filter.</li>
            )}
            {tileRows.map(renderTileRow)}
          </ul>
          {avatarViewer}
          {profileViewer}
        </section>

        {/* Off-screen card used exclusively for sharing with exact 768x1024 poster resolution */}
        <div
          ref={shareCardRef}
          aria-hidden="true"
          style={{
            position: 'fixed',
            left: '-9999px',
            top: 0,
            width: 768,
            height: 1024,
            boxSizing: 'border-box',
            overflow: 'hidden',
            backgroundColor: '#ffffff',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              width: 768,
              height: 1024,
              padding: '32px 36px 28px 36px',
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
                paddingBottom: '16px',
                borderBottom: '2px solid #d1fae5',
                flexShrink: 0,
                boxSizing: 'border-box',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <span
                  style={{
                    display: 'flex',
                    width: '56px',
                    height: '56px',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '16px',
                    backgroundColor: '#d1fae5',
                    flexShrink: 0,
                  }}
                  aria-hidden
                >
                  <Scale style={{ width: '32px', height: '32px', color: '#047857' }} />
                </span>
                <div>
                  <h3
                    style={{
                      fontSize: '24px',
                      fontWeight: 800,
                      color: '#064e3b',
                      letterSpacing: '-0.02em',
                      margin: 0,
                      lineHeight: 1.2,
                    }}
                  >
                    Top {topN} Weight Loss
                  </h3>
                  <p
                    style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      color: '#047857',
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
                justifyContent: 'space-between',
                padding: '12px 0 0 0',
                margin: 0,
                listStyle: 'none',
              }}
            >
              {tileRows.map((user) => renderShareTileRow(user))}
            </ul>
          </div>
        </div>
      </>
    );
  }

  return (
    <div
      className={`w-full bg-white shadow-sm transition-opacity duration-500 ease-out ${
        hasEntered ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className="py-0 px-0">
        <div className="relative h-[76px] sm:h-[84px] overflow-hidden">
          <div className="absolute inset-y-0 left-0 z-10 pointer-events-none flex items-stretch">
            <div
              className="flex h-full w-[60px] sm:w-[64px] items-center justify-center rounded-r-md bg-white px-1 py-2 text-center text-[9px] sm:text-[10px] font-semibold leading-[1.2] text-green-700 shadow-sm"
              aria-label="Weight Loss Today vs Yesterday"
            >
              Weight Loss<br />Today vs<br />Yesterday
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

export default WeightLossLeaderboard;
