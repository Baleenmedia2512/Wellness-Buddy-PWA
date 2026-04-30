import React from 'react';

const LoadingSpinner = ({ context = 'analysis' }) => {
  const loadingMessages = {
    login: {
      title: "Signing you in...",
      subtitle: "We're securely connecting to your Google account",
      color: "blue"
    },
    analysis: {
      title: "Analyzing with AI...",
      subtitle: "Gemini AI is analyzing your food and calculating nutrition",
      color: "green"
    },
    steps: {
      title: "Loading Step Counter...",
      subtitle: "Fetching your activity data and syncing with your sensor",
      color: "green"
    },
    normal: {
      title: "Loading...",
      subtitle: "Your personal nutrition companion is getting ready",
      color: "green"
    }
  };

  const { title, subtitle } = loadingMessages[context] || loadingMessages.normal;

  const wellnessTaglines = [
    "Snap, Analyze, Nourish - Your health journey starts here",
    "Turning every meal into mindful nutrition",
    "Your pocket nutritionist powered by AI",
    "Smart food analysis for healthier choices",
    "Decode your meals, unlock your wellness",
    "From camera to clarity - nutrition made simple",
    "Your personal guide to better eating habits",
    "AI-powered insights for every bite"
  ];

  const randomTagline = wellnessTaglines[Math.floor(Math.random() * wellnessTaglines.length)];

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-50 via-green-50 to-emerald-50">
      <div className="relative w-full max-w-xs mx-auto">
        {/* Main loading card */}
        <div className="relative bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-white/30 p-5 overflow-hidden">
          <div className="relative z-10 text-center">
            {/* Spinner */}
            <div className="flex justify-center mb-4">
              {context === 'login' ? (
                <div
                  className="animate-spin rounded-full"
                  style={{ width: 36, height: 36, border: '3px solid #e5e7eb', borderTopColor: '#4285F4', borderRightColor: '#34A853', borderBottomColor: '#FBBC05', borderLeftColor: '#EA4335' }}
                ></div>
              ) : (
                <div
                  className="animate-spin rounded-full"
                  style={{ width: 36, height: 36, border: '3px solid #d1fae5', borderTopColor: '#10b981' }}
                ></div>
              )}
            </div>

            {/* Title */}
            <h3 className="text-base font-bold text-gray-800 mb-1">{title}</h3>

            {/* Subtitle */}
            <p className="text-gray-400 text-xs mb-4 leading-relaxed">{subtitle}</p>

            {/* Tagline */}
            <div className="bg-green-50 border border-green-100 rounded-xl px-3 py-2 mb-4">
              <p className="text-green-700 text-xs font-medium italic leading-relaxed">
                "{randomTagline}"
              </p>
            </div>

            {/* Loading dots */}
            <div className="flex justify-center space-x-1.5 mb-4">
              {context === 'login' ? (
                <>
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce"></div>
                  <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-bounce" style={{animationDelay:'0.1s'}}></div>
                  <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-bounce" style={{animationDelay:'0.2s'}}></div>
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-bounce" style={{animationDelay:'0.3s'}}></div>
                </>
              ) : (
                <>
                  <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-bounce"></div>
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-bounce" style={{animationDelay:'0.1s'}}></div>
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{animationDelay:'0.2s'}}></div>
                </>
              )}
            </div>

            {/* Branding */}
            <div className="border-t border-gray-100 pt-3 flex items-center justify-center space-x-2">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-r from-green-500 to-emerald-600 flex items-center justify-center">
                <span className="text-white text-xs">📱</span>
              </div>
              <div className="text-left">
                <h4 className="text-green-600 font-bold text-xs">Wellness Valley</h4>
                <p className="text-gray-400 text-xs">AI-Powered Nutrition Analysis</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoadingSpinner;