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
      <div className="relative w-full max-w-sm mx-auto">
        {/* Floating background elements */}
        <div className="absolute -top-4 -right-4 w-24 h-24 bg-gradient-to-br from-green-200 to-emerald-300 rounded-full opacity-20 blur-xl"></div>
        <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-gradient-to-br from-teal-200 to-green-300 rounded-full opacity-15 blur-xl"></div>
        
        {/* Main loading card */}
        <div className="relative bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl border border-white/20 p-8 overflow-hidden">
          {/* Subtle animated gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -skew-x-12 animate-pulse"></div>
          
          <div className="relative z-10 text-center">
            {/* Modern spinner with glow effect */}
            <div className="flex justify-center mb-8">
              {context === 'login' ? (
                <div className="relative">
                  <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-400 to-purple-500 opacity-30 blur-md animate-pulse"></div>
                  <div className="relative h-16 w-16">
                    <div className="absolute inset-0 rounded-full border-4 border-gray-200"></div>
                    <div 
                      className="absolute inset-0 rounded-full border-4 border-transparent"
                      style={{
                        borderTopColor: '#4285F4',
                        borderRightColor: '#34A853',
                        borderBottomColor: '#FBBC05',
                        borderLeftColor: '#EA4335',
                        animation: 'spin 1.5s linear infinite'
                      }}
                    ></div>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <div className="absolute inset-0 rounded-full bg-gradient-to-r from-green-400 to-emerald-500 opacity-30 blur-md animate-pulse"></div>
                  <div className="relative inline-block animate-spin rounded-full h-16 w-16 border-4 border-green-100 border-t-green-500 shadow-lg"></div>
                </div>
              )}
            </div>

            {/* Title with modern typography */}
            <h3 className="text-xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent mb-3">
              {title}
            </h3>
            
            {/* Subtitle */}
            <p className="text-gray-500 text-sm mb-6 leading-relaxed">
              {subtitle}
            </p>
            
            {/* Tagline card with glassmorphism effect */}
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 backdrop-blur-sm border border-green-200/50 rounded-2xl p-4 mb-6 shadow-inner">
              <div className="flex items-center justify-center space-x-2 mb-2">
                <div className="w-6 h-6 rounded-full bg-gradient-to-r from-green-400 to-emerald-500 flex items-center justify-center">
                  <span className="text-white text-xs font-bold">💡</span>
                </div>
                <span className="text-green-700 font-semibold text-sm">Wellness Valley</span>
              </div>
              <p className="text-green-800 text-xs font-medium italic leading-relaxed">
                "{randomTagline}"
              </p>
            </div>
            
            {/* Modern loading dots with staggered animation */}
            <div className="flex justify-center space-x-2 mb-8">
              {context === 'login' ? (
                <>
                  <div className="w-2 h-2 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full animate-bounce shadow-lg"></div>
                  <div className="w-2 h-2 bg-gradient-to-r from-red-500 to-red-600 rounded-full animate-bounce shadow-lg" style={{animationDelay: '0.1s'}}></div>
                  <div className="w-2 h-2 bg-gradient-to-r from-yellow-500 to-yellow-600 rounded-full animate-bounce shadow-lg" style={{animationDelay: '0.2s'}}></div>
                  <div className="w-2 h-2 bg-gradient-to-r from-green-500 to-green-600 rounded-full animate-bounce shadow-lg" style={{animationDelay: '0.3s'}}></div>
                </>
              ) : (
                <>
                  <div className="w-2 h-2 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full animate-bounce shadow-lg"></div>
                  <div className="w-2 h-2 bg-gradient-to-r from-green-500 to-emerald-600 rounded-full animate-bounce shadow-lg" style={{animationDelay: '0.1s'}}></div>
                  <div className="w-2 h-2 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-full animate-bounce shadow-lg" style={{animationDelay: '0.2s'}}></div>
                </>
              )}
            </div>

            {/* App branding with modern styling */}
            <div className="border-t border-gray-100 pt-6">
              <div className="flex items-center justify-center space-x-3">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 flex items-center justify-center shadow-lg">
                  <span className="text-white font-bold text-sm">📱</span>
                </div>
                <div className="text-left">
                  <h4 className="text-green-600 font-bold text-sm">Wellness Valley</h4>
                  <p className="text-gray-400 text-xs">AI-Powered Nutrition Analysis</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoadingSpinner;