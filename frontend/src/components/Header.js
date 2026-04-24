import React, { useState, useEffect, useRef } from "react";
import {
  LogOut,
  LayoutDashboard,
  Shield,
  FileBarChart,
  Clock3,
  Footprints,
  GraduationCap,
  TrendingUp,
  Map,
  Building2,
  Smartphone,
  Bell,
  Heart,
  X,
} from "lucide-react";
import APP_VERSION from "../config/version";
import UserProfileModal from "./UserProfileModal";
import TouchFeedbackButton from "./TouchFeedbackButton";
import wellnessValleyIcon from "../assets/wellness-valley-icon.png";

// const Header = ({ user, userRole = 'user', onSignOut, onShowBackgroundHistory, onShowAdminDashboard, onShowDisciplineReport, onShowWellnessEnrollment, onShowWellnessReport, onShowAttendanceReport, onShowClubAttendanceReport, onShowNutritionCentersMap, onShowRegisterCenter, onLeaderboardRefresh, onProfileSaved }) => {
const Header = ({
  user,
  userRole = "user",
  onSignOut,
  onShowBackgroundHistory,
  onShowAdminDashboard,
  onShowDisciplineReport,
  onShowActivityTimeReport,
  onShowStepCounter,
  onShowScreenTime,
  onShowReminders,
  onShowWellnessEnrollment,
  onShowWellnessCounselling,
  onShowWellnessReport,
  onShowAttendanceReport,
  onShowClubAttendanceReport,
  onShowNutritionCentersMap,
  onShowRegisterCenter,
  onLeaderboardRefresh,
  onProfileSaved,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [savedUserName, setSavedUserName] = useState(null);
  const [savedProfileImage, setSavedProfileImage] = useState(null);
  const menuPanelRef = useRef(null);

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

  // Initialize showProfileModal from localStorage to persist across page refreshes
  const [showProfileModal, setShowProfileModal] = useState(() => {
    const saved = localStorage.getItem("showProfileModal");
    return saved === "true";
  });

  // Persist modal state to localStorage
  useEffect(() => {
    localStorage.setItem("showProfileModal", showProfileModal.toString());
  }, [showProfileModal]);

  // Fetch saved user name from profile
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user?.email) return;

      try {
        const apiBaseUrl = process.env.REACT_APP_API_BASE_URL;
        const cacheBuster = Date.now();
        const response = await fetch(
          `${apiBaseUrl}/api/get-user-profile?email=${encodeURIComponent(
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
    <header className="bg-white shadow-lg border-b-4 border-green-500">
      <div className="max-w-md mx-auto px-2 py-2 flex justify-between items-center">
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
              <h1 className="text-xl sm:text-2xl font-extrabold text-green-700 truncate flex items-baseline gap-1">
                Wellness Valley
                <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-3xl border border-gray-200 text-[10px] font-medium text-gray-500 bg-transparent relative top-[1px] w-12 h-4">
                  <span className="text-gray-500">
                    V{APP_VERSION.VERSION.split(".")[0]}
                  </span>
                  <span className="text-gray-400">.</span>
                  <span className="text-green-600">
                    {APP_VERSION.VERSION.split(".")[1]}
                  </span>
                  {/* <span className="text-gray-400">.</span>
                  <span className="text-green-600">{APP_VERSION.VERSION.split('.')[2]}</span> */}
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

            {menuOpen && (
              <>
                {/* Backdrop */}
                <div
                  className="fixed inset-0 z-40 bg-black/30"
                  onClick={closeMenu}
                />

                {/* Google-style fixed centered panel — no scroll */}
                <div ref={menuPanelRef} className="fixed top-[68px] left-1/2 w-[min(300px,calc(100vw-24px))] bg-white rounded-2xl shadow-2xl ring-1 ring-black/10 z-50 flex flex-col" style={{ transform: "translateX(-50%)", transformOrigin: "top center" }}>
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
                          Dashboard
                        </span>
                      </TouchFeedbackButton>

                      {/* Step Counter */}
                      {onShowStepCounter && (
                        <TouchFeedbackButton
                          onClick={() => {
                            onShowStepCounter();
                            closeMenu();
                          }}
                          className="flex flex-col items-center py-2 px-1 rounded-xl hover:bg-gray-100 transition-colors gap-1"
                          ariaLabel="Step Counter"
                        >
                          <div className="h-10 w-10 rounded-2xl bg-teal-100 flex items-center justify-center">
                            <Footprints className="h-5 w-5 text-teal-700" />
                          </div>
                          <span className="text-[10px] font-medium text-gray-700 text-center leading-tight">
                            Step Counter
                          </span>
                        </TouchFeedbackButton>
                      )}

                      {/* Screen Time */}
                      {onShowScreenTime && (
                        <TouchFeedbackButton
                          onClick={() => {
                            onShowScreenTime();
                            closeMenu();
                          }}
                          className="flex flex-col items-center py-2 px-1 rounded-xl hover:bg-gray-100 transition-colors gap-1"
                          ariaLabel="Screen Time"
                        >
                          <div className="h-10 w-10 rounded-2xl bg-blue-100 flex items-center justify-center">
                            <Smartphone className="h-5 w-5 text-blue-700" />
                          </div>
                          <span className="text-[10px] font-medium text-gray-700 text-center leading-tight">
                            Screen Time
                          </span>
                        </TouchFeedbackButton>
                      )}

                      {/* Reminders */}
                      {onShowReminders && (
                        <TouchFeedbackButton
                          onClick={() => {
                            onShowReminders();
                            closeMenu();
                          }}
                          className="flex flex-col items-center py-2 px-1 rounded-xl hover:bg-gray-100 transition-colors gap-1"
                          ariaLabel="Reminders"
                        >
                          <div className="h-10 w-10 rounded-2xl bg-green-100 flex items-center justify-center">
                            <Bell className="h-5 w-5 text-green-700" />
                          </div>
                          <span className="text-[10px] font-medium text-gray-700 text-center leading-tight">
                            Reminders
                          </span>
                        </TouchFeedbackButton>
                      )}

                      {/* AI Token Monitor */}
                      {onShowAdminDashboard && (
                        <TouchFeedbackButton
                          onClick={() => {
                            onShowAdminDashboard();
                            closeMenu();
                          }}
                          className="flex flex-col items-center py-2 px-1 rounded-xl hover:bg-gray-100 transition-colors gap-1"
                          ariaLabel="AI Token Monitor"
                        >
                          <div className="h-10 w-10 rounded-2xl bg-blue-100 flex items-center justify-center">
                            <Shield className="h-5 w-5 text-blue-700" />
                          </div>
                          <span className="text-[10px] font-medium text-gray-700 text-center leading-tight">
                            AI Token Monitor
                          </span>
                        </TouchFeedbackButton>
                      )}

                      {/* Discipline Report */}
                      {onShowDisciplineReport && (
                        <TouchFeedbackButton
                          onClick={() => {
                            onShowDisciplineReport();
                            closeMenu();
                          }}
                          className="flex flex-col items-center py-2 px-1 rounded-xl hover:bg-gray-100 transition-colors gap-1"
                          ariaLabel="Discipline Report"
                        >
                          <div className="h-10 w-10 rounded-2xl bg-purple-100 flex items-center justify-center">
                            <FileBarChart className="h-5 w-5 text-purple-700" />
                          </div>
                          <span className="text-[10px] font-medium text-gray-700 text-center leading-tight">
                            Discipline
                          </span>
                        </TouchFeedbackButton>
                      )}

                      {/* Activity Time Report */}
                      {onShowActivityTimeReport && (
                        <TouchFeedbackButton
                          onClick={() => {
                            onShowActivityTimeReport();
                            closeMenu();
                          }}
                          className="flex flex-col items-center py-2 px-1 rounded-xl hover:bg-gray-100 transition-colors gap-1"
                          ariaLabel="Activity Time Report"
                        >
                          <div className="h-10 w-10 rounded-2xl bg-amber-100 flex items-center justify-center">
                            <Clock3 className="h-5 w-5 text-amber-700" />
                          </div>
                          <span className="text-[10px] font-medium text-gray-700 text-center leading-tight">
                            Activity Report
                          </span>
                        </TouchFeedbackButton>
                      )}

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

                      {/* Enrollment Reports */}
                      {onShowWellnessReport && (
                        <TouchFeedbackButton
                          onClick={() => {
                            onShowWellnessReport();
                            closeMenu();
                          }}
                          className="flex flex-col items-center py-2 px-1 rounded-xl hover:bg-gray-100 transition-colors gap-1"
                          ariaLabel="Enrollment Reports"
                        >
                          <div className="h-10 w-10 rounded-2xl bg-teal-100 flex items-center justify-center">
                            <FileBarChart className="h-5 w-5 text-teal-700" />
                          </div>
                          <span className="text-[10px] font-medium text-gray-700 text-center leading-tight">
                            Enrollments
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

                      {/* My Attendance */}
                      {onShowAttendanceReport && (
                        <TouchFeedbackButton
                          onClick={() => {
                            onShowAttendanceReport();
                            closeMenu();
                          }}
                          className="flex flex-col items-center py-2 px-1 rounded-xl hover:bg-gray-100 transition-colors gap-1"
                          ariaLabel="My Attendance"
                        >
                          <div className="h-10 w-10 rounded-2xl bg-indigo-100 flex items-center justify-center">
                            <TrendingUp className="h-5 w-5 text-indigo-700" />
                          </div>
                          <span className="text-[10px] font-medium text-gray-700 text-center leading-tight">
                            My Attendance
                          </span>
                        </TouchFeedbackButton>
                      )}

                      {/* Club Attendance Report */}
                      {onShowClubAttendanceReport && (
                        <TouchFeedbackButton
                          onClick={() => {
                            onShowClubAttendanceReport();
                            closeMenu();
                          }}
                          className="flex flex-col items-center py-2 px-1 rounded-xl hover:bg-gray-100 transition-colors gap-1"
                          ariaLabel="Club Attendance Report"
                        >
                          <div className="h-10 w-10 rounded-2xl bg-blue-100 flex items-center justify-center">
                            <FileBarChart className="h-5 w-5 text-blue-700" />
                          </div>
                          <span className="text-[10px] font-medium text-gray-700 text-center leading-tight">
                            Virtual Club
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

                  {/* ── FOOTER: Sign out + Version ── */}
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
    </header>
  );
};

export default Header;
