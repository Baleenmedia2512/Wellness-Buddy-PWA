import React, { useState } from 'react';
import { LogOut, Camera, User, History } from 'lucide-react';

const Header = ({ user, onTestCamera, onSignOut, onShowBackgroundHistory }) => {
  const [menuOpen, setMenuOpen] = useState(false);

  const toggleMenu = () => setMenuOpen(!menuOpen);
  const closeMenu = () => setMenuOpen(false);

  const avatarUrl = user?.photoURL || 'https://www.gravatar.com/avatar/?d=mp';
  const userName = user?.displayName || user?.username || user?.email || 'User';
  const userEmail = user?.email || '';

  return (
    <header className="bg-white shadow-lg border-b-4 border-green-500">
      <div className="max-w-md mx-auto px-4 py-4 flex justify-between items-start">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-extrabold text-green-700 flex items-center space-x-2">
            <span className="text-xl sm:text-2xl">🌿</span>
            <span className="truncate">Wellness Buddy</span>
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
                {/* User info section */}
                <div className="px-4 py-3 border-b border-gray-100">
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
                </div>

                {/* Menu items */}
                <div className="py-2">
                  <button
                    onClick={() => {
                      onShowBackgroundHistory();
                      closeMenu();
                    }}
                    className="w-full px-4 py-3 flex items-start space-x-3 hover:bg-gray-50 text-left transition-colors"
                  >
                    <History className="h-5 w-5 text-green-600 mt-1 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800">Nutrition Dashboard</p>
                      <p className="text-xs text-gray-500">View daily nutrition overview</p>
                    </div>
                  </button>
                  
                  <button
                    onClick={() => {
                      onTestCamera();
                      closeMenu();
                    }}
                    className="w-full px-4 py-3 flex items-start space-x-3 hover:bg-gray-50 text-left transition-colors"
                  >
                    <Camera className="h-5 w-5 text-blue-600 mt-1 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800">Test Camera</p>
                      <p className="text-xs text-gray-500">Check your device camera</p>
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
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;