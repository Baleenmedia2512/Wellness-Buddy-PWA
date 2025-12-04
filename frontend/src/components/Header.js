import React, { useState, useEffect } from 'react';
import { LogOut, User, LayoutDashboard } from 'lucide-react';
import { getVersionString } from '../config/version';
import UserProfileModal from './UserProfileModal';

const Header = ({ user, onSignOut, onShowBackgroundHistory }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [savedUserName, setSavedUserName] = useState(null);
  
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
        const response = await fetch(
          `${apiBaseUrl}/api/get-user-profile?email=${encodeURIComponent(user.email)}`
        );
        
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data?.userName) {
            setSavedUserName(data.data.userName);
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
  };

  const toggleMenu = () => setMenuOpen(!menuOpen);
  const closeMenu = () => setMenuOpen(false);

  const avatarUrl = user?.photoURL || 'https://www.gravatar.com/avatar/?d=mp';
  // Use saved user name from profile first, then fall back to auth displayName
  const userName = savedUserName || user?.displayName || user?.username || user?.email || 'User';
  const userEmail = user?.email || '';

  return (
    <header className="bg-white shadow-lg border-b-4 border-green-500">
      <div className="max-w-md mx-auto px-4 py-4 flex justify-between items-start">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-extrabold text-green-700 flex items-center space-x-2">
            <span className="text-xl sm:text-2xl">🌿</span>
            <span className="truncate">Wellness Valley</span>
          </h1>
          <p className="text-xs sm:text-sm text-green-600 mt-1 ml-9 sm:ml-10 truncate">
            Track your meals effortlessly
          </p>
        </div>

        <div className="relative pt-1 flex-shrink-0">
          <button
            onClick={toggleMenu}
            className="focus:outline-none"
            title="User Menu"
          >
            <img
              src={avatarUrl}
              alt="User Avatar"
              className="h-9 w-9 sm:h-10 sm:w-10 rounded-full border border-gray-300 shadow-sm"
            />
          </button>

          {menuOpen && (
            <>
              {/* Overlay for mobile */}
              <div 
                className="fixed inset-0 z-40 bg-black/20 md:hidden"
                onClick={closeMenu}
              />
              
              {/* Menu dropdown */}
              <div className="absolute right-0 w-64 sm:w-72 bg-white rounded-xl shadow-xl ring-1 ring-black/5 z-50 mt-2">
                {/* User info section - clickable to open profile */}
                <button
                  onClick={() => {
                    setShowProfileModal(true);
                    closeMenu();
                  }}
                  className="w-full px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="flex items-center space-x-3">
                    <User className="h-5 w-5 text-gray-400" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">
                        {userName}
                      </p>
                      {userEmail && (
                        <p className="text-xs text-gray-500 truncate">
                          {userEmail}
                        </p>
                      )}
                    </div>
                  </div>
                </button>

                {/* Menu items */}
                <div className="py-2">
                  <button
                    onClick={() => {
                      onShowBackgroundHistory();
                      closeMenu();
                    }}
                    className="w-full px-4 py-3 flex items-start space-x-3 hover:bg-gray-50 text-left transition-colors"
                  >
                    <LayoutDashboard className="h-5 w-5 text-green-600 mt-1 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800">Dashboard</p>
                      <p className="text-xs text-gray-500">View nutrition & weight insights</p>
                    </div>
                  </button>
                  
                  <button
                    onClick={() => {
                      onSignOut();
                      closeMenu();
                    }}
                    className="w-full px-4 py-3 flex items-start space-x-3 hover:bg-gray-50 text-left transition-colors"
                  >
                    <LogOut className="h-5 w-5 text-red-600 mt-1 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800">Sign Out</p>
                      <p className="text-xs text-gray-500">Logout from your account</p>
                    </div>
                  </button>
                </div>

                {/* Version info at bottom */}
                <div className="px-4 py-2.5 border-t border-gray-200 bg-gray-50 rounded-b-xl">
                  <p className="text-[11px] font-medium text-gray-400 text-center tracking-wide">
                    {getVersionString()}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* User Profile Modal */}
      <UserProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        user={user}
        onProfileUpdate={handleProfileUpdate}
      />
    </header>
  );
};

export default Header;