import React, { useState, useEffect, useRef } from 'react';
import { Settings, Trophy } from 'lucide-react';
import TouchFeedbackButton from '../../../shared/components/TouchFeedbackButton';

/**
 * Leaderboard Settings Dropdown
 * Quick access dropdown for changing leaderboard display mode
 */
const LeaderboardSettingsDropdown = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [topN, setTopN] = useState(3);
  const [useDemoData, setUseDemoData] = useState(true);
  const dropdownRef = useRef(null);

  // Load current settings
  useEffect(() => {
    const savedTopN = localStorage.getItem('leaderboard_topN');
    if (savedTopN) setTopN(parseInt(savedTopN));
    
    const savedDemo = localStorage.getItem('leaderboard_useDemoData');
    setUseDemoData(savedDemo === null ? true : savedDemo === 'true');
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (value) => {
    localStorage.setItem('leaderboard_topN', value.toString());
    setTopN(value);
    setIsOpen(false);
    
    // Show toast notification
    const toast = document.createElement('div');
    toast.className = 'fixed top-20 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-[10000] text-sm font-medium';
    toast.textContent = `Leaderboard set to Top ${value}`;
    document.body.appendChild(toast);
    
    // Reload after showing toast
    setTimeout(() => {
      window.location.reload();
    }, 800);
  };

  const toggleDemoData = () => {
    const newValue = !useDemoData;
    localStorage.setItem('leaderboard_useDemoData', newValue.toString());
    setUseDemoData(newValue);
    
    // Show toast notification
    const toast = document.createElement('div');
    toast.className = 'fixed top-20 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-[10000] text-sm font-medium';
    toast.textContent = newValue ? 'Demo data enabled' : 'Using real database data';
    document.body.appendChild(toast);
    
    // Reload after showing toast
    setTimeout(() => {
      window.location.reload();
    }, 800);
  };

  const options = [
    { value: 1, label: 'Top 1', icon: 'ðŸ†', desc: 'Scrolling' },
    { value: 3, label: 'Top 3', icon: '🥈', desc: 'Balanced' },
    { value: 7, label: 'Top 7', icon: '📊', desc: 'Extended' }
  ];

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Settings Icon Button */}
      <TouchFeedbackButton
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors"
        ariaLabel="Leaderboard Settings"
      >
        <Settings 
          className={`w-5 h-5 text-gray-600 transition-transform ${isOpen ? 'rotate-90' : ''}`} 
        />
        {/* Indicator badge showing current setting */}
        <span className="absolute -top-1 -right-1 bg-green-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
          {topN}
        </span>
      </TouchFeedbackButton>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop for mobile */}
          <div 
            className="fixed inset-0 z-[9998] md:hidden"
            onClick={() => setIsOpen(false)}
            style={{ backgroundColor: 'transparent' }}
          />
          
          {/* Dropdown content */}
          <div className="absolute right-0 top-full mt-2 w-60 sm:w-64 bg-white rounded-lg shadow-xl border border-gray-200 z-[9999] overflow-hidden animate-slideDown">
            {/* Header */}
            <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-3 sm:px-4 py-2 sm:py-3">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4" />
                <span className="font-semibold text-xs sm:text-sm">Leaderboard Display</span>
              </div>
              <p className="text-[10px] sm:text-xs text-green-100 mt-1">Choose how many top performers to show</p>
            </div>

            {/* Options */}
            <div className="py-2">
              {options.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleSelect(option.value)}
                  className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 active:bg-gray-100 transition-colors ${
                    topN === option.value ? 'bg-green-50' : ''
                  }`}
                >
                  <span className="text-2xl">{option.icon}</span>
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-800">{option.label}</span>
                      {topN === option.value && (
                        <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded-full">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">{option.desc} view</p>
                  </div>
                  {topN === option.value && (
                    <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              ))}
            </div>

            {/* Demo Data Toggle */}
            <div className="border-t border-gray-200 px-4 py-3 bg-blue-50">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-800">Real Data</span>
                    {!useDemoData && (
                      <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 mt-0.5">
                    {useDemoData ? 'Using demo data for testing' : 'Using actual weight records'}
                  </p>
                </div>
                <button
                  onClick={toggleDemoData}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 ${
                    useDemoData ? 'bg-gray-300' : 'bg-green-600'
                  }`}
                  role="switch"
                  aria-checked={!useDemoData}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      useDemoData ? 'translate-x-1' : 'translate-x-6'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Footer note */}
            <div className="bg-gray-50 px-4 py-2 border-t border-gray-200">
              <p className="text-xs text-gray-600 text-center">
                Page will reload after selection
              </p>
            </div>
          </div>
        </>
      )}

      <style jsx>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-slideDown {
          animation: slideDown 0.2s ease-out;
        }
      `}</style>
    </div>
  );
};

export default LeaderboardSettingsDropdown;
