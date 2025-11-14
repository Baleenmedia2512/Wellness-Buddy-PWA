// src/components/Dashboard.js
import React, { useState } from 'react';
import { ArrowLeft, Activity, Scale } from 'lucide-react';
import NutritionDashboard from './NutritionDashboard';
import WeightDashboard from './WeightDashboard';

/**
 * Unified Dashboard with tabs for Nutrition and Weight tracking
 * Replaces the separate Nutrition Dashboard and Weight Tracking pages
 */
const Dashboard = ({ user, onBack, apiBaseUrl, onMealDelete }) => {
  const [activeTab, setActiveTab] = useState(() => {
    // Restore last active tab from localStorage
    return localStorage.getItem('dashboard_activeTab') || 'nutrition';
  });

  // Save active tab to localStorage when it changes
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    localStorage.setItem('dashboard_activeTab', tab);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 -right-20 w-40 h-40 md:w-80 md:h-80 bg-gradient-to-br from-orange-200/20 to-pink-200/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-20 -left-20 w-40 h-40 md:w-80 md:h-80 bg-gradient-to-tr from-blue-200/20 to-purple-200/20 rounded-full blur-3xl"></div>
      </div>

      {/* Header with tabs */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
        <div className="w-full max-w-md mx-auto md:max-w-2xl lg:max-w-4xl">
          {/* Top bar with back button and title */}
          <div className="flex items-center justify-between p-4 md:p-6 pb-3">
            <button 
              onClick={onBack} 
              className="p-2 md:p-3 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <ArrowLeft className="h-5 w-5 text-gray-700" />
            </button>

            <div className="text-center">
              <h1 className="text-lg md:text-xl font-semibold text-gray-900">Dashboard</h1>
              <p className="text-xs text-gray-500">Track your wellness journey</p>
            </div>

            {/* Empty div for spacing balance */}
            <div className="w-10 md:w-12"></div>
          </div>

          {/* Tab navigation */}
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => handleTabChange('nutrition')}
              className={`flex-1 flex items-center justify-center space-x-2 py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'nutrition'
                  ? 'border-green-600 text-green-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Activity className="h-4 w-4" />
              <span>Nutrition</span>
            </button>

            <button
              onClick={() => handleTabChange('weight')}
              className={`flex-1 flex items-center justify-center space-x-2 py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'weight'
                  ? ' border-emerald-300  text-emerald-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Scale className="h-4 w-4" />
              <span>Weight</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tab content */}
      <div className="relative">
        {activeTab === 'nutrition' && (
          <NutritionDashboard
            user={user}
            onBack={onBack}
            apiBaseUrl={apiBaseUrl}
            onMealDelete={onMealDelete}
            hideHeader={true}
          />
        )}

        {activeTab === 'weight' && (
          <WeightDashboard
            user={user}
            onBack={onBack}
            apiBaseUrl={apiBaseUrl}
            hideHeader={true}
          />
        )}
      </div>
    </div>
  );
};

export default Dashboard;
