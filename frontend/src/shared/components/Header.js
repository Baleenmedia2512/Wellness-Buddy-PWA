import React, { useState, useEffect, useRef } from "react";
import APP_VERSION from "../../config/version";
import { cacheProfileUserName } from "../utils/shareUtils.js";
import TouchFeedbackButton from "./TouchFeedbackButton";
import AppNavTabs from "./AppNavTabs";
import wellnessValleyIcon from "../../assets/wellness-valley-icon.png";
import { getProfile } from "../../features/user/services/user.api";
import { fetchHasTeamMembers } from "../../features/team/services/teamSearchService";
import { isFlagEnabled } from "../../config/featureFlags";

/** Roles that always see the Reports Dashboard nav tab (ff.reports-module). */
const REPORTS_TAB_ROLES = ['coach', 'coccoach', 'upline', 'admin', 'developer'];

function canAccessReportsTab(role, hasTeamMembers) {
  return REPORTS_TAB_ROLES.includes(role) || Boolean(hasTeamMembers);
}

const Header = ({
  user,
  userRole = "user",
  onSignOut,
  onShowBackgroundHistory,
  onShowHome,
  onShowWellnessEnrollment,
  onShowWellnessCounselling,
  onShowNutritionCentersMap,
  onShowActivityReport,
  onShowTestimonials,
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
}) => {
  const [savedUserName, setSavedUserName] = useState(null);
  const [savedProfileImage, setSavedProfileImage] = useState(null);
  const [hasTeamMembers, setHasTeamMembers] = useState(false);
  const prevProfileKeyRef = useRef(profileKey);

  const reportsEnabled = isFlagEnabled('ff.reports-module')
    && canAccessReportsTab(userRole, hasTeamMembers);

  // Grant report tab to downline leaders even when Role is still "user" (e.g. u2, a3).
  useEffect(() => {
    if (!user?.id || REPORTS_TAB_ROLES.includes(userRole)) {
      setHasTeamMembers(false);
      return undefined;
    }
    let cancelled = false;
    fetchHasTeamMembers(user.id)
      .then((has) => { if (!cancelled) setHasTeamMembers(has); })
      .catch(() => { if (!cancelled) setHasTeamMembers(false); });
    return () => { cancelled = true; };
  }, [user?.id, userRole]);

  // Fetch saved user name + avatar for header display.
  // Re-runs when email changes OR when profileKey is incremented (after a save).
  // Uses shared getProfile cache so Home / Diary / nutrition hooks do not re-hit the network.
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user?.email) return;
      try {
        const shouldBust = profileKey !== prevProfileKeyRef.current;
        prevProfileKeyRef.current = profileKey;
        const data = await getProfile(user.email, { cacheBust: shouldBust });
        if (data.success && data.data) {
          if (data.data.userName) {
            setSavedUserName(data.data.userName);
            cacheProfileUserName(user.email, data.data.userName);
          }
          if (data.data.profileImage) setSavedProfileImage(data.data.profileImage);
        }
      } catch (err) {
        console.error("Error fetching user profile for header:", err);
      }
    };
    fetchUserProfile();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: profileKey drives force-refresh
  }, [user?.email, profileKey]);

  const userName = savedUserName || user?.displayName || user?.username || user?.email || "User";
  const userEmail = user?.email || "";

  const getInitial = () => {
    if (userName) return userName.charAt(0).toUpperCase();
    if (userEmail) return userEmail.charAt(0).toUpperCase();
    return "U";
  };

  const getAvatarColor = () => {
    const colors = ["bg-blue-500", "bg-green-500", "bg-purple-500", "bg-pink-500", "bg-indigo-500", "bg-yellow-500", "bg-red-500", "bg-teal-500"];
    return colors[(userName || userEmail || "").length % colors.length];
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
          onShowBackgroundHistory={onShowBackgroundHistory}
          onShowActivityReport={onShowActivityReport}
          onShowWellnessEnrollment={onShowWellnessEnrollment}
          onShowWellnessCounselling={onShowWellnessCounselling}
          onShowNutritionCentersMap={onShowNutritionCentersMap}
          onShowTestimonials={onShowTestimonials}
          onShowReports={onShowReports}
          reportsEnabled={reportsEnabled}
        />
      </nav>
    );
  }

  return (
    <header className="bg-white shadow-lg border-b-4 border-green-500 safe-top safe-left safe-right">
      <div className="max-w-lg mx-auto px-3 xs:px-4 py-2 flex justify-between items-center">
        {/* Brand / Logo */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-1">
            <img
              src={wellnessValleyIcon}
              alt="Wellness Valley"
              className="h-12 w-12 sm:h-12 sm:w-12 object-contain flex-shrink-0 header-logo app-logo"
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
            <div className="flex-1 min-w-0 -ml-1">
              <h1 className="text-lg xs:text-xl sm:text-2xl font-extrabold text-green-700 truncate flex items-baseline gap-1">
                Wellness Valley
                <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-3xl border border-gray-200 text-[10px] font-medium text-gray-500 bg-transparent relative top-[1px] w-12 h-4">
                  <span className="text-gray-500">V{APP_VERSION.VERSION.split(".")[0]}</span>
                  <span className="text-gray-400">.</span>
                  <span className="text-green-600">{APP_VERSION.VERSION.split(".")[1]}</span>
                  <span className="text-gray-400">.</span>
                  <span className="text-green-600">{APP_VERSION.VERSION.split('.')[2]}</span>
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-green-600 truncate">Tracking Wellness with Ease</p>
            </div>
          </div>
        </div>

        {/* Profile avatar — tap to navigate to full profile page */}
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <TouchFeedbackButton
            onClick={onOpenProfile}
            className="focus:outline-none rounded-full"
            title="My Profile"
            ariaLabel="My Profile"
          >
            {savedProfileImage ? (
              <img
                src={savedProfileImage}
                alt="User Avatar"
                className="h-9 w-9 sm:h-10 sm:w-10 rounded-full border border-gray-300 shadow-sm"
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div
                className={`h-9 w-9 sm:h-10 sm:w-10 rounded-full ${getAvatarColor()} flex items-center justify-center text-white font-bold text-base shadow-sm`}
              >
                {getInitial()}
              </div>
            )}
          </TouchFeedbackButton>
        </div>
      </div>

      {/* ── Row 2: App top navigation bar — always 6 tabs, always uniform ── */}
      <nav aria-label="App navigation" className="border-t border-green-100 bg-white safe-left safe-right">
        <AppNavTabs
          activePage={activePage}
          onShowHome={onShowHome}
          onShowBackgroundHistory={onShowBackgroundHistory}
          onShowActivityReport={onShowActivityReport}
          onShowWellnessEnrollment={onShowWellnessEnrollment}
          onShowWellnessCounselling={onShowWellnessCounselling}
          onShowNutritionCentersMap={onShowNutritionCentersMap}
          onShowTestimonials={onShowTestimonials}
          onShowReports={onShowReports}
          reportsEnabled={reportsEnabled}
        />
      </nav>
    </header>
  );
};

export default Header;