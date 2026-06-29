import React, { useState, useEffect, useRef } from "react";
import {
  LogOut,
  LayoutDashboard,
  GraduationCap,
  Map,
  Heart,
  Trash2,
  Camera,
  Settings,
  User,
} from "lucide-react";
import APP_VERSION from "../../config/version";
import { UserProfileModal } from "../../features/user";
import { DeleteAccountModal } from "../../features/user";
import TouchFeedbackButton from "./TouchFeedbackButton";
import wellnessValleyIcon from "../../assets/wellness-valley-icon.png";

const Header = ({
  user,
  userRole = "user",
  onSignOut,
  onShowBackgroundHistory,
  onShowWellnessEnrollment,
  onShowWellnessCounselling,
  onShowNutritionCentersMap,
  onShowRegisterCenter,
  onLeaderboardRefresh,
  onProfileSaved,
  manualModeActive = false,
  onToggleManualMode,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [savedUserName, setSavedUserName] = useState(null);
  const [savedProfileImage, setSavedProfileImage] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  // wv.autoCameraOnResume — controls whether the camera auto-opens every time
  // the user returns the app to the foreground (after completing their first share).
  // Default ON to preserve existing Snapchat-style behaviour.
  const [autoCameraOnResumeEnabled, setAutoCameraOnResumeEnabled] = useState(
    localStorage.getItem('wv.autoCameraOnResume') !== 'false'
  );
  const menuPanelRef = useRef(null);

  // ✅ Auto-reopen delete modal if user closed app mid-OTP flow
  useEffect(() => {
    try {
      const saved = localStorage.getItem('deleteAccountOtpPending');
      if (saved) {
        const { sentAt } = JSON.parse(saved);
        const age = Date.now() - sentAt;
        if (age < 10 * 60 * 1000) {
          // OTP still valid — reopen modal so user can enter it
          setShowDeleteModal(true);
        } else {
          localStorage.removeItem('deleteAccountOtpPending');
        }
      }
    } catch {
      localStorage.removeItem('deleteAccountOtpPending');
    }
  }, []);

  // Profile modal — only opens when user explicitly clicks "Manage your Profile"
  const [showProfileModal, setShowProfileModal] = useState(false);

  // Clear stale showProfileModal key from localStorage (old versions stored it)
  useEffect(() => {
    localStorage.removeItem("showProfileModal");
  }, []);

  // Fetch saved user name from profile
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user?.email) return;

      try {
        const apiBaseUrl = process.env.REACT_APP_API_BASE_URL;
        const cacheBuster = Date.now();
        const response = await fetch(
          `${apiBaseUrl}/api/user/profile?email=${encodeURIComponent(
            user.email,
          )}&_t=${cacheBuster}`,
          {
            cache: "no-store",
            headers: {
              "Cache-Control": "no-cache",
              Pragma: "no-cache",
            },
          },
        );

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data) {
            if (data.data.userName) {
              setSavedUserName(data.data.userName);
            }
            if (data.data.profileImage) {
              setSavedProfileImage(data.data.profileImage);
            }
          }
        }
      } catch (err) {
        console.error("Error fetching user profile for header:", err);
      }
    };

    fetchUserProfile();
  }, [user?.email]);

  // Callback to update display name when profile is updated
  const handleProfileUpdate = (profileData) => {
    if (profileData?.name) {
      setSavedUserName(profileData.name);
    }
    if (profileData?.profileImage) {
      setSavedProfileImage(profileData.profileImage);
      if (onLeaderboardRefresh) {
        onLeaderboardRefresh();
      }
    }
    // Re-check profile completion so the blocking gate is dismissed if now complete
    if (onProfileSaved) {
      onProfileSaved({ bmr: profileData?.bmr ?? null });
    }
  };

  const toggleMenu = () => setMenuOpen(!menuOpen);
  const closeMenu = () => setMenuOpen(false);

  // Use saved user name from profile first, then fall back to auth displayName
  const userName =
    savedUserName ||
    user?.displayName ||
    user?.username ||
    user?.email ||
    "User";
  const userEmail = user?.email || "";

  // Generate initial for avatar fallback
  const getInitial = () => {
    if (userName) return userName.charAt(0).toUpperCase();
    if (userEmail) return userEmail.charAt(0).toUpperCase();
    return "U";
  };

  // Generate color based on name/email
  const getAvatarColor = () => {
    const colors = [
      "bg-blue-500",
      "bg-green-500",
      "bg-purple-500",
      "bg-pink-500",
      "bg-indigo-500",
      "bg-yellow-500",
      "bg-red-500",
      "bg-teal-500",
    ];
    const colorIndex = (userName || userEmail || "").length % colors.length;
    return colors[colorIndex];
  };

  return (
    <header className="bg-white shadow-lg border-b-4 border-green-500" style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingLeft: 'env(safe-area-inset-left, 0px)', paddingRight: 'env(safe-area-inset-right, 0px)' }}>
      <div className="max-w-lg mx-auto px-3 xs:px-4 py-2 flex justify-between items-center">
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
                  <span className="text-gray-500">
                    V{APP_VERSION.VERSION.split(".")[0]}
                  </span>
                  <span className="text-gray-400">.</span>
                  <span className="text-green-600">
                    {APP_VERSION.VERSION.split(".")[1]}
                  </span>
                  <span className="text-gray-400">.</span>
                  <span className="text-green-600">{APP_VERSION.VERSION.split('.')[2]}</span>
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-green-600 truncate">
                Tracking Wellness with Ease
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          {/* Profile avatar — tap opens profile modal directly */}
          <TouchFeedbackButton
            onClick={() => setShowProfileModal(true)}
            className="focus:outline-none rounded-full"
            title="Manage Profile"
            ariaLabel="Manage Profile"
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

          {/* Settings gear — opens account/settings dropdown */}
          <div className="relative">
            <TouchFeedbackButton
              onClick={toggleMenu}
              className="focus:outline-none p-1.5 rounded-full hover:bg-gray-100 transition-colors"
              title="Settings"
              ariaLabel="Settings"
            >
              <Settings className="h-5 w-5 text-gray-600" />
            </TouchFeedbackButton>

            {menuOpen && (
              <>
                {/* Backdrop */}
                <div
                  className="fixed inset-0 z-40 bg-black/30"
                  onClick={closeMenu}
                />

                {/* Settings panel — compact, right-aligned */}
                <div ref={menuPanelRef} className="fixed top-[64px] xs:top-[68px] right-3 w-[min(260px,calc(100vw-24px))] bg-white rounded-2xl shadow-2xl ring-1 ring-black/10 z-50 flex flex-col" style={{ transformOrigin: "top right" }}>
                  {/* Profile summary */}
                  <div className="relative px-4 pt-3 pb-3 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                      {savedProfileImage || user?.photoURL ? (
                        <img
                          src={savedProfileImage || user.photoURL}
                          alt="User Avatar"
                          className="h-10 w-10 rounded-full border-2 border-gray-200 shadow-sm shrink-0"
                          loading="lazy"
                          decoding="async"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className={`h-10 w-10 rounded-full ${getAvatarColor()} flex items-center justify-center text-white text-base font-bold shadow-sm shrink-0`}>
                          {getInitial()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">Hi, {userName.split(" ")[0]}!</p>
                        <p className="text-[11px] text-gray-500 truncate">{userEmail}</p>
                      </div>
                    </div>
                    {/* Role badge */}
                    <div className="mt-2">
                      {userRole === "admin" && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">Admin</span>}
                      {userRole === "developer" && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800">Developer</span>}
                      {userRole === "coach" && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-800">Coach</span>}
                      {(!userRole || userRole === "user") && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-700">User</span>}
                    </div>
                    {/* Manage Profile shortcut */}
                    <TouchFeedbackButton
                      onClick={() => { setShowProfileModal(true); closeMenu(); }}
                      className="mt-2 w-full py-1.5 px-4 rounded-full border border-gray-300 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center gap-1.5"
                      ariaLabel="Manage your Profile"
                    >
                      <User className="h-3.5 w-3.5" />
                      Manage Profile
                    </TouchFeedbackButton>
                  </div>

                  {/* Auto Camera toggle */}
                  <div className="px-4 py-2 border-b border-gray-100">
                    <TouchFeedbackButton
                      onClick={() => {
                        const newValue = !autoCameraOnResumeEnabled;
                        setAutoCameraOnResumeEnabled(newValue);
                        localStorage.setItem('wv.autoCameraOnResume', String(newValue));
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                      ariaLabel="Toggle Auto Camera"
                    >
                      <div className="flex items-center gap-2">
                        <Camera className={`h-4 w-4 ${autoCameraOnResumeEnabled ? 'text-green-600' : 'text-gray-400'}`} />
                        <div className="text-left">
                          <div className="text-xs font-medium text-gray-900">Auto Camera</div>
                          <div className="text-[10px] text-gray-500 leading-tight">
                            {autoCameraOnResumeEnabled ? 'Opens on app resume' : 'Open manually'}
                          </div>
                        </div>
                      </div>
                      <div className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${autoCameraOnResumeEnabled ? 'bg-green-500' : 'bg-gray-300'}`}>
                        <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${autoCameraOnResumeEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                      </div>
                    </TouchFeedbackButton>
                  </div>

                  {/* Footer: Sign out + Delete + Version */}
                  <div className="border-t border-gray-100 px-4 py-2 flex items-center justify-between bg-gray-50 rounded-b-2xl">
                    <TouchFeedbackButton
                      onClick={() => { onSignOut(); closeMenu(); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200 hover:bg-red-50 hover:border-red-200 transition-colors"
                      ariaLabel="Sign out"
                    >
                      <LogOut className="h-3.5 w-3.5 text-red-500" />
                      <span className="text-xs font-medium text-red-600">Sign out</span>
                    </TouchFeedbackButton>
                    <TouchFeedbackButton
                      onClick={() => { setShowDeleteModal(true); closeMenu(); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200 hover:bg-red-50 hover:border-red-200 transition-colors"
                      ariaLabel="Delete account"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-red-500" />
                      <span className="text-xs font-medium text-red-600">Delete</span>
                    </TouchFeedbackButton>
                    <p className="text-[10px] text-gray-400 font-medium">v{APP_VERSION.VERSION}</p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Row 2: App top navigation bar ── */}
      <nav
        aria-label="App navigation"
        className="border-t border-green-100 bg-white"
        style={{ paddingLeft: 'env(safe-area-inset-left, 0px)', paddingRight: 'env(safe-area-inset-right, 0px)' }}
      >
        <div className="max-w-lg mx-auto px-2 flex items-center overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          <TouchFeedbackButton
            onClick={onShowBackgroundHistory}
            className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl hover:bg-green-50 transition-colors shrink-0 min-w-[56px]"
            ariaLabel="Diary"
          >
            <LayoutDashboard className="h-5 w-5 text-green-700" />
            <span className="text-[10px] font-semibold text-green-800">Diary</span>
          </TouchFeedbackButton>
          {onShowWellnessEnrollment && (
            <TouchFeedbackButton
              onClick={onShowWellnessEnrollment}
              className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl hover:bg-emerald-50 transition-colors shrink-0 min-w-[64px]"
              ariaLabel="Enrollment"
            >
              <GraduationCap className="h-5 w-5 text-emerald-700" />
              <span className="text-[10px] font-semibold text-emerald-800">Enrollment</span>
            </TouchFeedbackButton>
          )}
          {onShowWellnessCounselling && (
            <TouchFeedbackButton
              onClick={onShowWellnessCounselling}
              className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl hover:bg-pink-50 transition-colors shrink-0 min-w-[72px]"
              ariaLabel="Counselling"
            >
              <Heart className="h-5 w-5 text-pink-600" />
              <span className="text-[10px] font-semibold text-pink-800">Counselling</span>
            </TouchFeedbackButton>
          )}
          {onShowNutritionCentersMap && (
            <TouchFeedbackButton
              onClick={onShowNutritionCentersMap}
              className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl hover:bg-teal-50 transition-colors shrink-0 min-w-[72px]"
              ariaLabel="Physical Club"
            >
              <Map className="h-5 w-5 text-teal-600" />
              <span className="text-[10px] font-semibold text-teal-800">Physical Club</span>
            </TouchFeedbackButton>
          )}
        </div>
      </nav>

      {/* User Profile Modal */}
      <UserProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        user={user}
        userRole={userRole}
        onProfileUpdate={handleProfileUpdate}
      />

      {/* Delete Account Modal */}
      <DeleteAccountModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        userEmail={user?.email || ''}
        onSignOut={onSignOut}
        onAccountDeleted={() => {
          setShowDeleteModal(false);
          onSignOut();
        }}
      />
    </header>
  );
};

export default Header;
