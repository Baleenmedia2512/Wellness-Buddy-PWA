import React, { useState, useEffect } from 'react';
import { LogOut, User, LayoutDashboard, Shield, FileBarChart, Footprints, Timer, GraduationCap, TrendingUp, Map, Building2 } from 'lucide-react';
import APP_VERSION from '../config/version';
import UserProfileModal from './UserProfileModal';
import TouchFeedbackButton from './TouchFeedbackButton';
import wellnessValleyIcon from '../assets/wellness-valley-icon.png';

// const Header = ({ user, userRole = 'user', onSignOut, onShowBackgroundHistory, onShowAdminDashboard, onShowDisciplineReport, onShowWellnessEnrollment, onShowWellnessReport, onShowAttendanceReport, onShowClubAttendanceReport, onShowNutritionCentersMap, onShowRegisterCenter, onLeaderboardRefresh, onProfileSaved }) => {
const Header = ({ user, userRole = 'user', onSignOut, onShowBackgroundHistory, onShowAdminDashboard, onShowDisciplineReport, onShowStepCounter, onShowWellnessEnrollment, onShowWellnessReport, onShowAttendanceReport, onShowClubAttendanceReport, onShowNutritionCentersMap, onShowRegisterCenter, onLeaderboardRefresh, onProfileSaved }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [savedUserName, setSavedUserName] = useState(null);
  const [savedProfileImage, setSavedProfileImage] = useState(null);
  
  // Initialize showProfileModal from localStorage to persist across page refreshes
  const [showProfileModal, setShowProfileModal] = useState(() => {
    const saved = localStorage.getItem('showProfileModal');
    return saved === 'true';
  });

  // Persist modal state to localStorage
  useEffect(() => {
    localStorage.setItem('showProfileModal', showProfileModal.toString());
  }, [showProfileModal]);

  // Fetch saved user name from profile
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user?.email) return;
      
      try {
        const apiBaseUrl = process.env.REACT_APP_API_BASE_URL;
        const cacheBuster = Date.now();
        const response = await fetch(
          `${apiBaseUrl}/api/get-user-profile?email=${encodeURIComponent(user.email)}&_t=${cacheBuster}`,
          {
            cache: 'no-store',
            headers: {
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache'
            }
          }
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
        console.error('Error fetching user profile for header:', err);
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
      onProfileSaved();
    }
  };

  const toggleMenu = () => setMenuOpen(!menuOpen);
  const closeMenu = () => setMenuOpen(false);

  // Use saved user name from profile first, then fall back to auth displayName
  const userName = savedUserName || user?.displayName || user?.username || user?.email || 'User';
  const userEmail = user?.email || '';

  // Generate initial for avatar fallback
  const getInitial = () => {
    if (userName) return userName.charAt(0).toUpperCase();
    if (userEmail) return userEmail.charAt(0).toUpperCase();
    return 'U';
  };

  // Generate color based on name/email
  const getAvatarColor = () => {
    const colors = [
      'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-pink-500',
      'bg-indigo-500', 'bg-yellow-500', 'bg-red-500', 'bg-teal-500'
    ];
    const colorIndex = (userName || userEmail || '').length % colors.length;
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
                WebkitUserSelect: 'none', 
                userSelect: 'none', 
                WebkitTouchCallout: 'none',
                WebkitUserDrag: 'none',
                pointerEvents: 'none',
                WebkitTapHighlightColor: 'transparent'
              }}
            />
            <div className="flex-1 min-w-0 -ml-1">
              <h1 className="text-xl sm:text-2xl font-extrabold text-green-700 truncate flex items-baseline gap-1">
                Wellness Valley
                <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-3xl border border-gray-200 text-[10px] font-medium text-gray-500 bg-transparent relative top-[1px] w-12 h-4">
                  <span className="text-gray-500">V{APP_VERSION.VERSION.split('.')[0]}</span>
                  <span className="text-gray-400">.</span>
                  <span className="text-green-600">{APP_VERSION.VERSION.split('.')[1]}</span>
                  {/* <span className="text-gray-400">.</span>
                  <span className="text-green-600">{APP_VERSION.VERSION.split('.')[2]}</span> */}
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-green-600 truncate">
                Track your meals effortlessly 
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
              {savedProfileImage || user?.photoURL ? (
                <img
                  src={savedProfileImage || user.photoURL}
                  alt="User Avatar"
                  className="h-9 w-9 sm:h-10 sm:w-10 rounded-full border border-gray-300 shadow-sm"
                  loading="lazy"
                  decoding="async"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className={`h-9 w-9 sm:h-10 sm:w-10 rounded-full ${getAvatarColor()} flex items-center justify-center text-white font-bold text-base shadow-sm`}>
                  {getInitial()}
                </div>
              )}
            </TouchFeedbackButton>

            {menuOpen && (
              <>
                {/* Overlay for mobile */}
                <div 
                  className="fixed inset-0 z-40 bg-black/20 md:hidden"
                  onClick={closeMenu}
                />
                
                {/* Menu dropdown */}
                <div className="absolute right-0 w-64 sm:w-72 bg-white rounded-xl shadow-xl ring-1 ring-black/5 z-50 mt-2 flex flex-col max-h-[85vh]">
                {/* User info section - clickable to open profile */}
                <TouchFeedbackButton
                  onClick={() => {
                    setShowProfileModal(true);
                    closeMenu();
                  }}
                  className="w-full px-4 py-5 border-b border-gray-100 hover:bg-gray-50 transition-colors text-left rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    <User className="h-6 w-5 text-gray-400" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-800 truncate">
                          {userName}
                        </p>
                        {userRole === 'admin' && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-900 flex-shrink-0">Admin</span>
                        )}
                        {userRole === 'developer' && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-900 flex-shrink-0">Developer</span>
                        )}
                        {userRole === 'coach' && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-900 flex-shrink-0">Coach</span>
                        )}
                        {(!userRole || userRole === 'user') && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-900 flex-shrink-0">User</span>
                        )}
                      </div>
                      {userEmail && (
                        <p className="text-xs text-gray-500 truncate">
                          {userEmail}
                        </p>
                      )}
                    </div>
                  </div>
                </TouchFeedbackButton>

                {/* Menu items */}
                <div className="py-2 overflow-y-auto flex-1">
                  <TouchFeedbackButton
                    onClick={() => {
                      onShowBackgroundHistory();
                      closeMenu();
                    }}
                    className="w-full px-4 py-3 flex items-start space-x-3 hover:bg-gray-50 text-left transition-colors"
                    ariaLabel="View Dashboard"
                  >
                    <LayoutDashboard className="h-5 w-5 text-green-600 mt-1 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800">Dashboard</p>
                      <p className="text-xs text-gray-500">View nutrition & weight insights</p>
                    </div>
                  </TouchFeedbackButton>

                  {onShowStepCounter && (
                    <TouchFeedbackButton
                      onClick={() => {
                        onShowStepCounter();
                        closeMenu();
                      }}
                      className="w-full px-4 py-3 flex items-start space-x-3 hover:bg-teal-50 text-left transition-colors"
                      ariaLabel="View Step Counter"
                    >
                      <Footprints className="h-5 w-5 text-teal-600 mt-1 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800">Step Counter</p>
                        <p className="text-xs text-gray-500">Track your daily steps live</p>
                      </div>
                    </TouchFeedbackButton>
                  )}

                  {/* {onShowScreenTime && (
                    <TouchFeedbackButton
                      onClick={() => {
                        onShowScreenTime();
                        closeMenu();
                      }}
                      className="w-full px-4 py-3 flex items-start space-x-3 hover:bg-indigo-50 text-left transition-colors"
                      ariaLabel="View Screen Time"
                    >
                      <Timer className="h-5 w-5 text-indigo-500 mt-1 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800">Screen Time</p>
                        <p className="text-xs text-gray-500">View your digital wellbeing</p>
                      </div>
                    </TouchFeedbackButton>
                  )}  */}

                  {/* Admin Dashboard - shown for admin/developer roles only */}
                  {onShowAdminDashboard && (
                    <TouchFeedbackButton
                      onClick={() => {
                        onShowAdminDashboard();
                        closeMenu();
                      }}
                      className="w-full px-4 py-3 flex items-start space-x-3 hover:bg-blue-50 text-left transition-colors"
                      ariaLabel="Open AI Token Monitor"
                    >
                      <Shield className="h-5 w-5 text-blue-600 mt-1 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800">AI Token Monitor</p>
                        <p className="text-xs text-gray-500">Token usage analytics</p>
                      </div>
                    </TouchFeedbackButton>
                  )}

                  {/* Discipline Report - shown for coach/admin/developer roles only */}
                  {onShowDisciplineReport && (
                    <TouchFeedbackButton
                      onClick={() => {
                        onShowDisciplineReport();
                        closeMenu();
                      }}
                      className="w-full px-4 py-3 flex items-start space-x-3 hover:bg-purple-50 text-left transition-colors"
                      ariaLabel="View Discipline Report"
                    >
                      <FileBarChart className="h-5 w-5 text-purple-600 mt-1 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800">Discipline Report</p>
                        <p className="text-xs text-gray-500">Team performance insights</p>
                      </div>
                    </TouchFeedbackButton>
                  )}

                  {/* Wellness University Enrollment - shown for regular users only (not coaches/admins) */}
                  {onShowWellnessEnrollment && (
                    <TouchFeedbackButton
                      onClick={() => {
                        onShowWellnessEnrollment();
                        closeMenu();
                      }}
                      className="w-full px-4 py-3 flex items-start space-x-3 hover:bg-green-50 text-left transition-colors"
                      ariaLabel="Wellness University Enrollment"
                    >
                      <GraduationCap className="h-5 w-5 text-green-600 mt-1 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800">Wellness University</p>
                        <p className="text-xs text-gray-500">View or enroll in programs</p>
                      </div>
                    </TouchFeedbackButton>
                  )}

                  {/* Wellness University Report - shown for coaches/admins only */}
                  {onShowWellnessReport && (
                    <TouchFeedbackButton
                      onClick={() => {
                        onShowWellnessReport();
                        closeMenu();
                      }}
                      className="w-full px-4 py-3 flex items-start space-x-3 hover:bg-teal-50 text-left transition-colors"
                      ariaLabel="View Enrollment Reports"
                    >
                      <FileBarChart className="h-5 w-5 text-teal-600 mt-1 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800">Enrollment Reports</p>
                        <p className="text-xs text-gray-500">View program enrollments</p>
                      </div>
                    </TouchFeedbackButton>
                  )}

                  {/* My Club Attendance - shown for all users to see their own attendance */}
                  {onShowAttendanceReport && (
                    <TouchFeedbackButton
                      onClick={() => {
                        onShowAttendanceReport();
                        closeMenu();
                      }}
                      className="w-full px-4 py-3 flex items-start space-x-3 hover:bg-indigo-50 text-left transition-colors"
                      ariaLabel="View My Attendance"
                    >
                      <TrendingUp className="h-5 w-5 text-indigo-600 mt-1 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800">My Club Attendance</p>
                        <p className="text-xs text-gray-500">Your attendance history</p>
                      </div>
                    </TouchFeedbackButton>
                  )}

                  {/* Club Attendance Report - shown for coach/admin/developer roles only */}
                  {onShowClubAttendanceReport && (
                    <TouchFeedbackButton
                      onClick={() => {
                        onShowClubAttendanceReport();
                        closeMenu();
                      }}
                      className="w-full px-4 py-3 flex items-start space-x-3 hover:bg-blue-50 text-left transition-colors"
                      ariaLabel="View Club Attendance Report"
                    >
                      <FileBarChart className="h-5 w-5 text-blue-600 mt-1 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800">Club Attendance Report</p>
                        <p className="text-xs text-gray-500">Track club member attendance</p>
                      </div>
                    </TouchFeedbackButton>
                  )}

                  {/* Nutrition Centres Map - shown for all users */}
                  {onShowNutritionCentersMap && (
                    <TouchFeedbackButton
                      onClick={() => {
                        onShowNutritionCentersMap();
                        closeMenu();
                      }}
                      className="w-full px-4 py-3 flex items-start space-x-3 hover:bg-emerald-50 text-left transition-colors"
                      ariaLabel="View Nutrition Centres Map"
                    >
                      <Map className="h-5 w-5 text-emerald-600 mt-1 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800">Nutrition Centres Map</p>
                        <p className="text-xs text-gray-500">Find nearby nutrition clubs</p>
                      </div>
                    </TouchFeedbackButton>
                  )}

                  {/* Register Nutrition Centre - shown for coach/admin/developer roles only */}
                  {onShowRegisterCenter && (
                    <TouchFeedbackButton
                      onClick={() => {
                        onShowRegisterCenter();
                        closeMenu();
                      }}
                      className="w-full px-4 py-3 flex items-start space-x-3 hover:bg-amber-50 text-left transition-colors"
                      ariaLabel="Register Nutrition Centre"
                    >
                      <Building2 className="h-5 w-5 text-amber-600 mt-1 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800">Register Centre</p>
                        <p className="text-xs text-gray-500">Add a new nutrition club</p>
                      </div>
                    </TouchFeedbackButton>
                  )}
                  
                  <TouchFeedbackButton
                    onClick={() => {
                      onSignOut();
                      closeMenu();
                    }}
                    className="w-full px-4 py-3 flex items-start space-x-3 hover:bg-gray-50 text-left transition-colors"
                    ariaLabel="Sign Out"
                  >
                    <LogOut className="h-5 w-5 text-red-600 mt-1 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800">Sign Out</p>
                      <p className="text-xs text-gray-500">Logout from your account</p>
                    </div>
                  </TouchFeedbackButton>
                </div>

                {/* Version info at bottom */}
                <div className="px-4 py-2.5 border-t border-gray-200 bg-gray-50 rounded-b-xl">
                  <p className="text-[11px] font-medium text-gray-400 text-center tracking-wide">
                    Version {APP_VERSION.VERSION}
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