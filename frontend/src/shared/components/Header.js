import React, { useState, useEffect, useRef } from "react";
import {
  LogOut,
  LayoutDashboard,
  Clock3,
  Footprints,
  GraduationCap,
  TrendingUp,
  Map,
  Building2,
  Smartphone,
  Heart,
  X,
  Trash2,
  Share2,
  Trophy,
  Camera,
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
  onShowStepCounter,
  onShowScreenTime,
  onShowWellnessEnrollment,
  onShowWellnessCounselling,
  onShowNutritionCentersMap,
  onShowRegisterCenter,
  onShowMarathon,
  onLeaderboardRefresh,
  onProfileSaved,
  manualModeActive = false,
  onToggleManualMode,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [savedUserName, setSavedUserName] = useState(null);
  const [savedProfileImage, setSavedProfileImage] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [autoShareEnabled, setAutoShareEnabled] = useState(
    localStorage.getItem('autoShareOnCapture') !== 'false'
  );
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

  // Auto-scale menu panel to fit screen without scroll
  useEffect(() => {
    if (!menuOpen) return;
    const applyScale = () => {
      const el = menuPanelRef.current;
      if (!el) return;
      // Reset first so we measure natural size
      el.style.transform = "translateX(-50%)";
      el.style.transformOrigin = "top center";
      const panelH = el.scrollHeight;
      const available = window.innerHeight - 80;
      if (panelH > available) {
        const s = available / panelH;
        el.style.transform = `translateX(-50%) scale(${s})`;
      }
    };
    // Use rAF to ensure DOM has fully painted before measuring
    const raf = requestAnimationFrame(() => requestAnimationFrame(applyScale));
    window.addEventListener("resize", applyScale);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", applyScale);
    };
  }, [menuOpen]);

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
          {/* User Profile Menu */}
          <div className="relative">
            <div className="flex flex-col items-center gap-1">
              <TouchFeedbackButton
                onClick={toggleMenu}
                className="focus:outline-none rounded-full"
                title="User Menu"
                ariaLabel="User Menu"
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

              {/* AI/Manual mode indicator — FEATURE DISABLED */}
              {/* <div
                className="flex items-center gap-1 px-1.5 py-0.5 rounded-full border flex-shrink-0"
                style={{
                  background: manualModeActive ? "#fff7ed" : "#f0fdf4",
                  borderColor: manualModeActive ? "#f97316" : "#16a34a",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                  minWidth: 0,
                }}
              >
                <span
                  className="text-[9px] font-bold leading-none"
                  style={{ color: manualModeActive ? "#ea580c" : "#15803d" }}
                >
                  {manualModeActive ? "Manual" : "AI"}
                </span>
                <span
                  className="relative inline-flex flex-shrink-0 rounded-full transition-colors duration-200"
                  style={{
                    background: manualModeActive ? "#f97316" : "#16a34a",
                    height: "12px",
                    width: "22px",
                  }}
                >
                  <span
                    className="absolute rounded-full bg-white shadow-sm transition-transform duration-200"
                    style={{
                      top: "2px",
                      height: "8px",
                      width: "8px",
                      transform: manualModeActive ? "translateX(12px)" : "translateX(2px)",
                    }}
                  />
                </span>
              </div> */}
            </div>

            {menuOpen && (
              <>
                {/* Backdrop */}
                <div
                  className="fixed inset-0 z-40 bg-black/30"
                  onClick={closeMenu}
                />

                {/* Google-style fixed centered panel — no scroll */}
                <div ref={menuPanelRef} className="fixed top-[64px] xs:top-[68px] left-1/2 w-[min(320px,calc(100vw-20px))] xs:w-[min(300px,calc(100vw-24px))] bg-white rounded-2xl shadow-2xl ring-1 ring-black/10 z-50 flex flex-col" style={{ transform: "translateX(-50%)", transformOrigin: "top center" }}>
                  {/* ── PROFILE CARD ── */}
                  <div className="relative px-4 pt-3 pb-3 border-b border-gray-100 text-center">
                    {/* Close button */}
                    <TouchFeedbackButton
                      onClick={closeMenu}
                      className="absolute top-2 right-2 p-1.5 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
                      ariaLabel="Close menu"
                    >
                      <X className="h-4 w-4 text-gray-700" strokeWidth={2.5} />
                    </TouchFeedbackButton>

                    {/* Email */}
                    <p className="text-[11px] text-gray-500 mb-1.5 truncate px-6">
                      {userEmail}
                    </p>

                    {/* Avatar */}
                    <div className="flex justify-center mb-1.5">
                      {savedProfileImage || user?.photoURL ? (
                        <img
                          src={savedProfileImage || user.photoURL}
                          alt="User Avatar"
                          className="h-12 w-12 rounded-full border-2 border-gray-200 shadow-sm"
                          loading="lazy"
                          decoding="async"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div
                          className={`h-12 w-12 rounded-full ${getAvatarColor()} flex items-center justify-center text-white text-xl font-bold shadow-sm`}
                        >
                          {getInitial()}
                        </div>
                      )}
                    </div>

                    {/* Greeting */}
                    <p className="text-sm font-semibold text-gray-900 mb-1">
                      Hi, {userName.split(" ")[0]}!
                    </p>

                    {/* Role badge */}
                    <div className="flex justify-center mb-2">
                      {userRole === "admin" && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                          Admin
                        </span>
                      )}
                      {userRole === "developer" && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800">
                          Developer
                        </span>
                      )}
                      {userRole === "coach" && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-800">
                          Coach
                        </span>
                      )}
                      {(!userRole || userRole === "user") && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-700">
                          User
                        </span>
                      )}
                    </div>

                    {/* Manage Profile button */}
                    <TouchFeedbackButton
                      onClick={() => {
                        setShowProfileModal(true);
                        closeMenu();
                      }}
                      className="w-full py-1.5 px-4 rounded-full border border-gray-300 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                      ariaLabel="Manage your Profile"
                    >
                      Manage your Profile
                    </TouchFeedbackButton>
                  </div>

                  {/* ── APP GRID ── no scroll, compact tiles */}
                  <div className="p-2">
                    <div className="grid grid-cols-3 gap-0.5">
                      {/* Dashboard */}
                      <TouchFeedbackButton
                        onClick={() => {
                          onShowBackgroundHistory();
                          closeMenu();
                        }}
                        className="flex flex-col items-center py-2 px-1 rounded-xl hover:bg-gray-100 transition-colors gap-1"
                        ariaLabel="Dashboard"
                      >
                        <div className="h-10 w-10 rounded-2xl bg-green-100 flex items-center justify-center">
                          <LayoutDashboard className="h-5 w-5 text-green-700" />
                        </div>
                        <span className="text-[10px] font-medium text-gray-700 text-center leading-tight">
                          Diary
                        </span>
                      </TouchFeedbackButton>

                      {/* Step Counter — FEATURE DISABLED */}
                      {/* {onShowStepCounter && (
                        <TouchFeedbackButton
                          onClick={() => { onShowStepCounter(); closeMenu(); }}
                          className="flex flex-col items-center py-2 px-1 rounded-xl hover:bg-gray-100 transition-colors gap-1"
                          ariaLabel="Step Counter"
                        >
                          <div className="h-10 w-10 rounded-2xl bg-teal-100 flex items-center justify-center">
                            <Footprints className="h-5 w-5 text-teal-700" />
                          </div>
                          <span className="text-[10px] font-medium text-gray-700 text-center leading-tight">Step Counter</span>
                        </TouchFeedbackButton>
                      )} */}

                      {/* Screen Time — FEATURE DISABLED */}
                      {/* {onShowScreenTime && (
                        <TouchFeedbackButton
                          onClick={() => { onShowScreenTime(); closeMenu(); }}
                          className="flex flex-col items-center py-2 px-1 rounded-xl hover:bg-gray-100 transition-colors gap-1"
                          ariaLabel="Screen Time"
                        >
                          <div className="h-10 w-10 rounded-2xl bg-blue-100 flex items-center justify-center">
                            <Smartphone className="h-5 w-5 text-blue-700" />
                          </div>
                          <span className="text-[10px] font-medium text-gray-700 text-center leading-tight">Screen Time</span>
                        </TouchFeedbackButton>
                      )} */}

                      {/* Wellness University */}
                      {onShowWellnessEnrollment && (
                        <TouchFeedbackButton
                          onClick={() => {
                            onShowWellnessEnrollment();
                            closeMenu();
                          }}
                          className="flex flex-col items-center py-2 px-1 rounded-xl hover:bg-gray-100 transition-colors gap-1"
                          ariaLabel="Wellness University"
                        >
                          <div className="h-10 w-10 rounded-2xl bg-emerald-100 flex items-center justify-center">
                            <GraduationCap className="h-5 w-5 text-emerald-700" />
                          </div>
                          <span className="text-[10px] font-medium text-gray-700 text-center leading-tight">
                            University
                          </span>
                        </TouchFeedbackButton>
                      )}

                      {/* Wellness Counselling */}
                      {onShowWellnessCounselling && (
                        <TouchFeedbackButton
                          onClick={() => {
                            onShowWellnessCounselling();
                            closeMenu();
                          }}
                          className="flex flex-col items-center py-2 px-1 rounded-xl hover:bg-gray-100 transition-colors gap-1"
                          ariaLabel="Wellness Counselling"
                        >
                          <div className="h-10 w-10 rounded-2xl bg-pink-100 flex items-center justify-center">
                            <Heart className="h-5 w-5 text-pink-700" />
                          </div>
                          <span className="text-[10px] font-medium text-gray-700 text-center leading-tight">
                            Counselling
                          </span>
                        </TouchFeedbackButton>
                      )}

                      {/* Nutrition Centres Map */}
                      {onShowNutritionCentersMap && (
                        <TouchFeedbackButton
                          onClick={() => {
                            onShowNutritionCentersMap();
                            closeMenu();
                          }}
                          className="flex flex-col items-center py-2 px-1 rounded-xl hover:bg-gray-100 transition-colors gap-1"
                          ariaLabel="Nutrition Centres Map"
                        >
                          <div className="h-10 w-10 rounded-2xl bg-emerald-100 flex items-center justify-center">
                            <Map className="h-5 w-5 text-emerald-700" />
                          </div>
                          <span className="text-[10px] font-medium text-gray-700 text-center leading-tight">
                            Physical Club
                          </span>
                        </TouchFeedbackButton>
                      )}

                      {/* Marathon */}
                      {onShowMarathon && (
                        <TouchFeedbackButton
                          onClick={() => { onShowMarathon(); closeMenu(); }}
                          className="flex flex-col items-center py-2 px-1 rounded-xl hover:bg-gray-100 transition-colors gap-1"
                          ariaLabel="Marathon"
                        >
                          <div className="h-10 w-10 rounded-2xl bg-yellow-100 flex items-center justify-center">
                            <Trophy className="h-5 w-5 text-yellow-700" />
                          </div>
                          <span className="text-[10px] font-medium text-gray-700 text-center leading-tight">
                            Marathon
                          </span>
                        </TouchFeedbackButton>
                      )}

                      {/* Register Centre */}
                      {onShowRegisterCenter && (
                        <TouchFeedbackButton
                          onClick={() => {
                            onShowRegisterCenter();
                            closeMenu();
                          }}
                          className="flex flex-col items-center py-2 px-1 rounded-xl hover:bg-gray-100 transition-colors gap-1"
                          ariaLabel="Register Centre"
                        >
                          <div className="h-10 w-10 rounded-2xl bg-amber-100 flex items-center justify-center">
                            <Building2 className="h-5 w-5 text-amber-700" />
                          </div>
                          <span className="text-[10px] font-medium text-gray-700 text-center leading-tight">
                            Register
                          </span>
                        </TouchFeedbackButton>
                      )}
                    </div>
                  </div>

                  {/* ── AUTO SHARE TOGGLE ── */}
                  <div className="px-4 pt-2 pb-1 border-t border-gray-100">
                    <TouchFeedbackButton
                      onClick={() => {
                        const newValue = !autoShareEnabled;
                        setAutoShareEnabled(newValue);
                        localStorage.setItem('autoShareOnCapture', String(newValue));
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                      ariaLabel="Toggle Auto Share"
                    >
                      <div className="flex items-center gap-2">
                        <Share2 className={`h-4 w-4 ${autoShareEnabled ? 'text-blue-600' : 'text-gray-400'}`} />
                        <div className="text-left">
                          <div className="text-xs font-medium text-gray-900">
                            Auto Share
                          </div>
                          <div className="text-[10px] text-gray-500 leading-tight">
                            {autoShareEnabled
                              ? 'Opens share instantly'
                              : 'See results first, share manually'}
                          </div>
                        </div>
                      </div>
                      <div
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                          autoShareEnabled ? 'bg-blue-500' : 'bg-gray-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${
                            autoShareEnabled ? 'translate-x-5' : 'translate-x-0.5'
                          }`}
                        />
                      </div>
                    </TouchFeedbackButton>

                    {/* ── AUTO CAMERA TOGGLE ── */}
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
                          <div className="text-xs font-medium text-gray-900">
                            Auto Camera
                          </div>
                          <div className="text-[10px] text-gray-500 leading-tight">
                            {autoCameraOnResumeEnabled
                              ? 'Camera opens on app resume'
                              : 'Open camera manually'}
                          </div>
                        </div>
                      </div>
                      <div
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                          autoCameraOnResumeEnabled ? 'bg-green-500' : 'bg-gray-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${
                            autoCameraOnResumeEnabled ? 'translate-x-5' : 'translate-x-0.5'
                          }`}
                        />
                      </div>
                    </TouchFeedbackButton>
                  </div>

                  {/* ── FOOTER: Sign out + Delete Account + Version ── */}
                  <div className="border-t border-gray-100 px-4 py-2 flex items-center justify-between bg-gray-50 rounded-b-2xl">
                    <TouchFeedbackButton
                      onClick={() => {
                        onSignOut();
                        closeMenu();
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200 hover:bg-red-50 hover:border-red-200 transition-colors"
                      ariaLabel="Sign out"
                    >
                      <LogOut className="h-3.5 w-3.5 text-red-500" />
                      <span className="text-xs font-medium text-red-600">
                        Sign out
                      </span>
                    </TouchFeedbackButton>
                    <TouchFeedbackButton
                      onClick={() => {
                        setShowDeleteModal(true);
                        closeMenu();
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200 hover:bg-red-50 hover:border-red-200 transition-colors"
                      ariaLabel="Delete account"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-red-500" />
                      <span className="text-xs font-medium text-red-600">
                        Delete Account
                      </span>
                    </TouchFeedbackButton>
                    <p className="text-[10px] text-gray-400 font-medium">
                      v{APP_VERSION.VERSION}
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

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
