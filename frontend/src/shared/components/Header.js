import React, { useState, useEffect, useRef } from "react";
import { Share2 } from "lucide-react";
import APP_VERSION from "../../config/version";
import { getApiBaseUrl } from "../../config/api.config";
import { cacheProfileUserName } from "../utils/shareUtils.js";
import TouchFeedbackButton from "./TouchFeedbackButton";
import AppNavTabs from "./AppNavTabs";
import wellnessValleyIcon from "../../assets/wellness-valley-icon.png";
import idealWeightBadge from "../../assets/ideal-weight-badge.jpg";
import { getCachedProfile, getProfile } from "../../features/user/services/user.api";
import {
  getAvatarDisplayVersion,
  resolveClientAvatarSrc,
  subscribeAvatarDisplayVersion,
} from "../../features/user/services/avatarDisplayVersion";
import { isFlagEnabled } from "../../config/featureFlags";
import { canAccessReportsModule } from "../../features/reports/domain/reportsAccess.rules.js";
import { hasValidProfileName } from "../../features/user/domain/profileCompleteness";
import { PremiumAvatarRing, PremiumCrownMark } from "../../features/payments/components/PremiumBadge";
import PremiumExpiryBanner from "../../features/payments/components/PremiumExpiryBanner";
import usePremiumStatus from "../../features/payments/hooks/usePremiumStatus";
import * as Session from "../services/sessionStorage";
import { shareAppInvite } from "../../features/user/services/appInviteShare.service";
import {
  communityPositionFromProfile,
  readSavedCommunityPosition,
} from "../../features/user/domain/communityPosition";

export function isIdealWeightProfile(profile) {
  if (!profile) return false;
  if (profile.weightGoalMode === 'maintain') return true;
  const h = parseFloat(profile.height);
  const w = parseFloat(
    profile.latestWeight != null
      ? profile.latestWeight
      : (profile.weightKg != null ? profile.weightKg : profile.lastWeight)
  );
  if (!h || h < 50 || h > 250 || !w || w <= 0) return false;
  const m = h / 100;
  const idealMin = 19 * m * m;
  const idealMax = 23 * m * m;
  return w >= idealMin - 0.5 && w <= idealMax + 0.5;
}

const Header = ({
  user,
  userRole = "user",
  isIdealWeight = undefined,
  onSignOut,
  onShowBackgroundHistory,
  onShowHome,
  onShowEvents,
  onShowWellnessEnrollment,
  onShowWellnessCounselling,
  onShowNutritionCentersMap,
  onShowActivityReport,
  onShowTestimonials,
  onShowBroadcast,
  onShowCreateEvent,
  onShowPaidFeatures,
  onShowMapBusiness,
  onShowEventCheckIn,
  onShowReports,
  onShowWellnessScoreSetup,
  wellnessScoreSetupEnabled = false,
  onShowRegisterCenter,
  onLeaderboardRefresh,
  onProfileSaved,
  onOpenProfile,     // new — navigates to inline UserProfilePage
  profileKey = 0,   // increment to force header to re-fetch profile display
  activePage = null,
  manualModeActive = false,
  onToggleManualMode,
  navOnly = false,
  /** null = fail-open (all tabs); object = DB role page map */
  allowedPages = null,
}) => {
  const [savedUserName, setSavedUserName] = useState(null);
  const [savedProfileImage, setSavedProfileImage] = useState(null);
  const [savedCommunityPosition, setSavedCommunityPosition] = useState(() => {
    const fromUser = user?.communityPosition?.code
      || (typeof user?.communityPosition === 'string' ? user.communityPosition : '')
      || user?.eventLevel
      || user?.EventLevel
      || '';
    if (fromUser) return String(fromUser).trim();
    const uid = user?.id || user?.UserId || user?.userId || Session.getDbUserId() || null;
    return readSavedCommunityPosition(uid) || '';
  });
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [avatarVersion, setAvatarVersion] = useState(getAvatarDisplayVersion);
  const [isSharingInvite, setIsSharingInvite] = useState(false);
  const [isAtIdealWeight, setIsAtIdealWeight] = useState(() => {
    const email = user?.email || user?.Email || null;
    const uid = user?.id || user?.UserId || user?.userId || Session.getDbUserId() || null;
    if (!email && !uid) return false;
    const cached = getCachedProfile({ email, userId: uid });
    return isIdealWeightProfile(cached?.data);
  });
  const prevProfileKeyRef = useRef(profileKey);

  // Premium members get a light blue header. Tab-only bars use the same check.
  const premiumUserId = user?.id || user?.UserId || user?.userId || Session.getDbUserId() || null;

  useEffect(() => {
    const fromUser = user?.communityPosition?.code
      || (typeof user?.communityPosition === 'string' ? user.communityPosition : '')
      || user?.eventLevel
      || user?.EventLevel
      || '';
    if (fromUser) {
      setSavedCommunityPosition(String(fromUser).trim());
    } else if (premiumUserId) {
      const fromSaved = readSavedCommunityPosition(premiumUserId);
      if (fromSaved) setSavedCommunityPosition(fromSaved);
    }
  }, [user?.communityPosition, user?.eventLevel, user?.EventLevel, premiumUserId]);

  useEffect(() => subscribeAvatarDisplayVersion(setAvatarVersion), []);
  useEffect(() => {
    setAvatarFailed(false);
  }, [avatarVersion, premiumUserId, savedProfileImage, user?.profileImage, user?.ProfileImage, user?.photoURL]);
  const {
    premium: isPremiumMember,
    daysLeft: premiumDaysLeft,
    expiresAtDisplay: premiumExpiresAtDisplay,
    showExpiryWarning,
    refresh: refreshPremium,
  } = usePremiumStatus(premiumUserId);

  // Reports: common module for every signed-in user when the flag is on.
  const reportsEnabled = isFlagEnabled('ff.reports-module')
    && canAccessReportsModule(userRole);

  // After profile photo save, App updates user.profileImage immediately —
  // apply it here so header does not keep a stale getProfile avatar until refetch.
  useEffect(() => {
    const fromUser = user?.profileImage || user?.ProfileImage || user?.photoURL;
    if (typeof fromUser === 'string' && fromUser.startsWith('data:image/')) {
      setSavedProfileImage(fromUser);
    }
  }, [user?.profileImage, user?.ProfileImage, user?.photoURL]);

  // Fetch saved user name + avatar for header display.
  // Re-runs when email/userId changes OR when profileKey is incremented (after a save).
  // Uses shared getProfile cache so Home / Diary / nutrition hooks do not re-hit the network.
  useEffect(() => {
    const fetchUserProfile = async () => {
      const email = user?.email || user?.Email || null;
      const userId = user?.id || user?.UserId || user?.userId || null;
      if (!email && !userId) return;
      try {
        const shouldBust = profileKey !== prevProfileKeyRef.current;
        prevProfileKeyRef.current = profileKey;
        const data = await getProfile(
          email
            ? { email, userId: userId || undefined, cacheBust: shouldBust }
            : { userId, cacheBust: shouldBust },
        );
        if (data.success && data.data) {
          const phoneNumber = data.data.phoneNumber || user?.phoneNumber || user?.phone;
          const profileEmail = data.data.email || email;
          if (hasValidProfileName(data.data.userName, { email: profileEmail, phoneNumber })) {
            setSavedUserName(data.data.userName);
            if (profileEmail) cacheProfileUserName(profileEmail, data.data.userName);
          } else {
            setSavedUserName(null);
          }
          // Profile avatar only — Centre transformation photo is independent.
          const nextImage = data.data.profileImage || null;
          if (nextImage) setSavedProfileImage(nextImage);
          else if (shouldBust) setSavedProfileImage(null);

          // Community position for header display below avatar
          const pos = communityPositionFromProfile(data.data, userId);
          const resolvedPos = pos
            || data.data.eventLevel
            || data.data.EventLevel
            || data.data.communityPosition?.code
            || (typeof data.data.communityPosition === 'string' ? data.data.communityPosition : '')
            || '';
          if (resolvedPos) {
            setSavedCommunityPosition(String(resolvedPos).trim());
          }

          setIsAtIdealWeight(isIdealWeightProfile(data.data));
        }
      } catch (err) {
        console.error("Error fetching user profile for header:", err);
      }
    };
    fetchUserProfile();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: profileKey drives force-refresh
  }, [user?.email, user?.Email, user?.id, user?.UserId, user?.userId, profileKey]);

  const phoneNumber = user?.phoneNumber || user?.PhoneNumber || user?.phone;
  const userEmail = user?.email || user?.Email || "";
  const userName = (() => {
    const candidates = [
      savedUserName,
      user?.userName,
      user?.username,
      user?.displayName,
    ];
    return candidates.find((n) => hasValidProfileName(n, { email: userEmail, phoneNumber }))
      || userEmail
      || "User";
  })();
  // Same-origin /api/user/avatar — raw Google/R2 URLs fail on iOS Safari (no-referrer).
  const headerAvatarSrc = resolveClientAvatarSrc({
    apiBaseUrl: getApiBaseUrl(),
    userId: premiumUserId,
    version: avatarVersion,
    optimisticSrc: savedProfileImage
      || user?.profileImage
      || user?.ProfileImage
      || user?.photoURL
      || null,
    failed: avatarFailed,
  });

  const getInitial = () => {
    if (userName) return userName.charAt(0).toUpperCase();
    if (userEmail) return userEmail.charAt(0).toUpperCase();
    return "U";
  };

  const getAvatarColor = () => {
    const colors = ["bg-blue-500", "bg-green-500", "bg-purple-500", "bg-pink-500", "bg-indigo-500", "bg-yellow-500", "bg-red-500", "bg-teal-500"];
    return colors[(userName || userEmail || "").length % colors.length];
  };

  const displayCommunityPosition = (savedCommunityPosition || '').trim() || 'Guest';

  const avatarNode = headerAvatarSrc ? (
    <img
      key={headerAvatarSrc}
      src={headerAvatarSrc}
      alt="User Avatar"
      className={`block h-9 w-9 sm:h-10 sm:w-10 aspect-square rounded-full object-cover pointer-events-none ${isPremiumMember ? '' : 'border border-gray-300 shadow-sm'}`}
      loading="eager"
      decoding="async"
      draggable="false"
      referrerPolicy="no-referrer"
      onError={() => setAvatarFailed(true)}
      style={{
        WebkitUserSelect: "none",
        userSelect: "none",
        WebkitTouchCallout: "none",
        WebkitUserDrag: "none",
        pointerEvents: "none",
        WebkitTapHighlightColor: "transparent",
      }}
    />
  ) : (
    <div
      className={`flex h-9 w-9 sm:h-10 sm:w-10 aspect-square items-center justify-center rounded-full ${getAvatarColor()} text-white font-bold text-base shadow-sm`}
    >
      {getInitial()}
    </div>
  );

  const handleShareInvite = async (e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
    if (isSharingInvite) return;
    setIsSharingInvite(true);
    try {
      const inviterCandidates = [
        savedUserName,
        user?.userName,
        user?.name,
        user?.displayName,
      ];
      const inviterName = inviterCandidates.find((n) => typeof n === 'string' && n.trim().length > 0 && n.trim() !== 'User') || '';
      await shareAppInvite({ inviterName });
    } catch (err) {
      console.warn('[Header] App invite share failed:', err);
    } finally {
      setIsSharingInvite(false);
    }
  };

  // navOnly mode: render only the tab navigation row (Row 2).
  // Used by full-page sub-views so they display the full nav without
  // duplicating the logo/settings row on top.
  if (navOnly) {
    return (
      <nav
        aria-label="App navigation"
        className="bg-white border-b-4 border-green-500 shadow-sm safe-top safe-left safe-right"
      >
        <AppNavTabs
          activePage={activePage}
          onShowHome={onShowHome}
          onShowEvents={onShowEvents}
          onShowBackgroundHistory={onShowBackgroundHistory}
          onShowActivityReport={onShowActivityReport}
          onShowWellnessEnrollment={onShowWellnessEnrollment}
          onShowWellnessCounselling={onShowWellnessCounselling}
          onShowNutritionCentersMap={onShowNutritionCentersMap}
          onShowTestimonials={onShowTestimonials}
          onShowBroadcast={onShowBroadcast}
          onShowCreateEvent={onShowCreateEvent}
          onShowPaidFeatures={onShowPaidFeatures}
          onShowMapBusiness={onShowMapBusiness}
          onShowEventCheckIn={onShowEventCheckIn}
          onShowReports={onShowReports}
          reportsEnabled={reportsEnabled}
          allowedPages={allowedPages}
        />
      </nav>
    );
  }

  const showIdealWeightLogo = isIdealWeight !== undefined ? Boolean(isIdealWeight) : isAtIdealWeight;

  return (
    <header className="bg-white shadow-lg border-b-4 border-green-500 safe-top safe-left safe-right">
      <div className="max-w-lg mx-auto pl-1 pr-2 xs:pl-1.5 xs:pr-2.5 py-1.5 sm:py-2 flex justify-between items-center">
        {/* Brand / Logo — aligned to left corner */}
        <div className="flex-1 min-w-0 pr-1">
          <div className="flex items-center space-x-1">
            <img
              src={wellnessValleyIcon}
              alt="Wellness Valley"
              className="h-9 w-9 xs:h-10 xs:w-10 sm:h-11 sm:w-11 object-contain flex-shrink-0 header-logo app-logo"
              draggable="false"
              role="presentation"
              aria-hidden="true"
              style={{
                WebkitUserSelect: "none",
                userSelect: "none",
                WebkitTouchCallout: "none",
                WebkitUserDrag: "none",
                pointerEvents: "none",
                WebkitTapHighlightColor: "transparent",
              }}
            />
            <div className="flex-1 min-w-0 -ml-0.5">
              <h1 className={`text-[13.5px] xs:text-[15px] sm:text-xl font-extrabold truncate flex items-baseline gap-1 ${isPremiumMember ? 'text-sky-800' : 'text-green-700'}`}>
                Wellness Valley
                <span className="inline-flex items-center justify-center px-1 py-0 rounded-2xl border border-gray-200 text-[8.5px] xs:text-[9.5px] font-medium text-gray-500 bg-transparent relative top-[0.5px] h-3.5 shrink-0 whitespace-nowrap">
                  <span className="text-gray-500">V{APP_VERSION.VERSION.split(".")[0]}</span>
                  <span className="text-gray-400">.</span>
                  <span className={isPremiumMember ? 'text-sky-600' : 'text-green-600'}>{APP_VERSION.VERSION.split(".")[1]}</span>
                  <span className="text-gray-400">.</span>
                  <span className={isPremiumMember ? 'text-sky-600' : 'text-green-600'}>{APP_VERSION.VERSION.split('.')[2]}</span>
                </span>
              </h1>
              <p className={`text-[10px] xs:text-[11px] sm:text-xs truncate ${isPremiumMember ? 'text-sky-600' : 'text-green-600'}`}>Tracking Wellness with Ease</p>
            </div>
          </div>
        </div>

        {/* Actions: Ideal Weight badge, WhatsApp invite share & Profile avatar */}
        <div className="flex items-center gap-1 xs:gap-1.5 sm:gap-2.5 flex-shrink-0">
          {showIdealWeightLogo && (
            <TouchFeedbackButton
              type="button"
              onClick={() => {
                if (typeof onOpenProfile === 'function') onOpenProfile();
              }}
              className="inline-flex items-center justify-center aspect-square h-8 w-8 xs:h-8.5 xs:w-8.5 sm:h-9.5 sm:w-9.5 shrink-0 p-0 rounded-full transition-transform active:scale-95 focus:outline-none"
              title="At Ideal Weight! Tap to view profile"
              ariaLabel="At Ideal Weight"
              data-testid="header-ideal-weight-badge"
            >
              <img
                src={idealWeightBadge}
                alt="At Ideal Weight"
                className="h-8 w-8 xs:h-8.5 xs:w-8.5 sm:h-9.5 sm:w-9.5 object-contain mix-blend-multiply"
                draggable="false"
              />
            </TouchFeedbackButton>
          )}

          <TouchFeedbackButton
            type="button"
            onClick={handleShareInvite}
            disabled={isSharingInvite}
            className={`inline-flex items-center justify-center aspect-square h-8.5 w-8.5 sm:h-10 sm:w-10 shrink-0 rounded-full border transition-all active:scale-95 disabled:opacity-60 ${
              isPremiumMember
                ? 'border-sky-200 text-sky-700 bg-sky-50 hover:bg-sky-100'
                : 'border-green-200 text-green-700 bg-green-50 hover:bg-green-100'
            }`}
            title="Share on WhatsApp"
            ariaLabel="Share on WhatsApp"
            data-testid="header-share-button"
          >
            <Share2 className="w-4 h-4 sm:w-5 sm:h-5" />
          </TouchFeedbackButton>

          <div className="relative flex flex-col items-center">
            <span className="relative inline-flex">
              <PremiumAvatarRing enabled={isPremiumMember}>
                <TouchFeedbackButton
                  type="button"
                  onClick={(e) => {
                    if (e && typeof e.preventDefault === 'function') e.preventDefault();
                    if (typeof onOpenProfile === 'function') onOpenProfile();
                  }}
                  className="block aspect-square h-9 w-9 sm:h-10 sm:w-10 shrink-0 overflow-hidden rounded-full p-0 leading-none focus:outline-none"
                  title="My Profile"
                  ariaLabel="My Profile"
                >
                  {avatarNode}
                </TouchFeedbackButton>
              </PremiumAvatarRing>
              {isPremiumMember ? <PremiumCrownMark /> : null}
            </span>
            <span
              className={`absolute -bottom-3 text-[8.5px] xs:text-[9px] font-bold text-center whitespace-nowrap leading-none select-none tracking-tight max-w-[64px] truncate cursor-pointer ${
                isPremiumMember ? 'text-sky-700' : 'text-green-700'
              }`}
              title={`Community Position: ${displayCommunityPosition}`}
              aria-label={`Community Position: ${displayCommunityPosition}`}
              data-testid="header-community-position"
              onClick={(e) => {
                if (e && typeof e.preventDefault === 'function') e.preventDefault();
                if (typeof onOpenProfile === 'function') onOpenProfile();
              }}
            >
              {displayCommunityPosition}
            </span>
          </div>
        </div>
      </div>

      {activePage === 'home' && showExpiryWarning ? (
        <PremiumExpiryBanner
          daysLeft={premiumDaysLeft}
          expiresAtDisplay={premiumExpiresAtDisplay}
          userId={premiumUserId}
          onPremiumCheck={refreshPremium}
          allowedPages={allowedPages}
        />
      ) : null}

      {/* ── Row 2: App top navigation bar — always 6 tabs, always uniform ── */}
      <nav aria-label="App navigation" className="border-t border-green-100 bg-white safe-left safe-right">
        <AppNavTabs
          activePage={activePage}
          onShowHome={onShowHome}
          onShowEvents={onShowEvents}
          onShowBackgroundHistory={onShowBackgroundHistory}
          onShowActivityReport={onShowActivityReport}
          onShowWellnessEnrollment={onShowWellnessEnrollment}
          onShowWellnessCounselling={onShowWellnessCounselling}
          onShowNutritionCentersMap={onShowNutritionCentersMap}
          onShowTestimonials={onShowTestimonials}
          onShowBroadcast={onShowBroadcast}
          onShowCreateEvent={onShowCreateEvent}
          onShowPaidFeatures={onShowPaidFeatures}
          onShowMapBusiness={onShowMapBusiness}
          onShowEventCheckIn={onShowEventCheckIn}
          onShowReports={onShowReports}
          reportsEnabled={reportsEnabled}
          allowedPages={allowedPages}
        />
      </nav>
    </header>
  );
};

export default Header;