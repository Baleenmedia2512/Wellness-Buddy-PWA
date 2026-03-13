import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  RefreshCw,
  Calendar,
  Users,
  ChevronDown,
  ChevronUp,
  Building2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import TouchFeedbackButton from './TouchFeedbackButton';
import LoadingSpinner from './LoadingSpinner';

const ClubAttendanceReport = ({ user, onBack }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hierarchyData, setHierarchyData] = useState(null);
  const [stats, setStats] = useState(null);
  const [dateFilter, setDateFilter] = useState('today'); // today, yesterday, custom
  const [customDate, setCustomDate] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const apiBaseUrl = process.env.REACT_APP_API_BASE_URL;

  // Get target date based on filter
  const getTargetDate = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    let targetDate;
    
    switch (dateFilter) {
      case 'today':
        targetDate = today;
        break;
      case 'yesterday':
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        targetDate = yesterday;
        break;
      case 'custom':
        targetDate = customDate || today;
        break;
      default:
        targetDate = today;
    }

    return formatDate(targetDate);
  };

  const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Get user ID helper
  const getUserId = async (email) => {
    const response = await fetch(
      `${apiBaseUrl}/api/lookup-user-id?email=${encodeURIComponent(email)}`
    );
    const data = await response.json();
    if (!data.success) throw new Error('User not found');
    return data.userId;
  };

  // Fetch hierarchical clubs overview
  const fetchClubsHierarchy = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const userId = await getUserId(user.email);
      const date = getTargetDate();

      const url = `${apiBaseUrl}/api/coach/hierarchical-clubs-overview?userId=${userId}&date=${date}`;

      const response = await fetch(url, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        },
      });

      const result = await response.json();

      console.log('📥 [ClubAttendanceReport] Clubs Overview Response:', {
        success: result.success,
        date: result.data?.date,
        totalClubs: result.data?.stats?.totalClubs,
        membersWithClubs: result.data?.stats?.membersWithClubs,
      });

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to fetch clubs overview');
      }

      setHierarchyData(result.data.hierarchy);
      setStats(result.data.stats);
    } catch (err) {
      console.error('Error fetching clubs overview:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch when user or date filter changes
  useEffect(() => {
    if (user) {
      fetchClubsHierarchy();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, dateFilter, customDate]);

  // Handle club click to show attendance details
  const handleClubClick = (club) => {
    console.log('Club clicked:', club);
    // TODO: Navigate to club attendance details or show modal
    alert(`View attendance for ${club.name}\nParticipants: ${club.totalParticipants}\nToday's Attendance: ${club.todayAttendance}`);
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-green-50 to-blue-50 z-50 overflow-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white shadow-md">
        <div className="max-w-4xl mx-auto px-3 sm:px-4 py-2 sm:py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 sm:gap-3">
              <TouchFeedbackButton
                onClick={onBack}
                className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-full"
                ariaLabel="Go back"
              >
                <ArrowLeft className="h-5 w-5 text-gray-600" />
              </TouchFeedbackButton>
              <div>
                <h1 className="text-base sm:text-lg md:text-xl font-bold text-gray-800">
                  Team Club Ownership
                </h1>
                <p className="text-[10px] sm:text-xs text-gray-500">
                  View clubs owned by your team
                </p>
              </div>
            </div>
            <TouchFeedbackButton
              onClick={fetchClubsHierarchy}
              disabled={loading}
              className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-full disabled:opacity-50"
              ariaLabel="Refresh"
            >
              <RefreshCw className={`h-4 w-4 sm:h-5 sm:w-5 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
            </TouchFeedbackButton>
          </div>

          {/* Date Filter */}
          <div className="mt-2 sm:mt-3">
            <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-2 scrollbar-hide items-center">
              {[
                { value: 'today', label: 'Today' },
                { value: 'yesterday', label: 'Yesterday' },
              ].map((filter) => (
                <TouchFeedbackButton
                  key={filter.value}
                  onClick={() => {
                    setDateFilter(filter.value);
                    setShowDatePicker(false);
                  }}
                  className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 ${
                    dateFilter === filter.value
                      ? 'bg-green-600 text-white shadow-md shadow-green-200'
                      : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {filter.label}
                </TouchFeedbackButton>
              ))}
              
              {/* Custom Date Picker */}
              <div className="relative">
                <TouchFeedbackButton
                  onClick={() => setShowDatePicker(!showDatePicker)}
                  className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 flex items-center gap-1 ${
                    dateFilter === 'custom'
                      ? 'bg-green-600 text-white shadow-md shadow-green-200'
                      : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <Calendar className="h-3 w-3 sm:h-4 sm:w-4" />
                  {dateFilter === 'custom' && customDate
                    ? formatDate(customDate)
                    : 'Custom Date'}
                  {showDatePicker ? (
                    <ChevronUp className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                </TouchFeedbackButton>
                
                {showDatePicker && (
                  <div className="absolute top-full mt-2 right-0 bg-white border border-gray-200 rounded-lg shadow-lg p-3 z-20">
                    <input
                      type="date"
                      max={formatDate(new Date())}
                      value={customDate ? formatDate(customDate) : ''}
                      onChange={(e) => {
                        const selected = new Date(e.target.value);
                        setCustomDate(selected);
                        setDateFilter('custom');
                        setShowDatePicker(false);
                      }}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Content */}
      <div className="max-w-4xl mx-auto p-3 sm:p-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-96">
            <LoadingSpinner />
            <p className="mt-4 text-gray-600">Loading club ownership data...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <p className="text-red-600 font-medium">{error}</p>
            <TouchFeedbackButton
              onClick={fetchClubsHierarchy}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Try Again
            </TouchFeedbackButton>
          </div>
        ) : stats && hierarchyData ? (
          <>
            {/* Summary Stats */}
            <div className="bg-white rounded-lg shadow-md p-4 mb-4">
              <div className="flex items-center gap-2 mb-3">
                <Building2 className="h-5 w-5 text-green-600" />
                <div>
                  <h2 className="text-lg font-bold text-gray-800">
                    Club Ownership Overview
                  </h2>
                  <p className="text-xs text-gray-500">
                    Participant counts as of {getTargetDate()}
                  </p>
                </div>
              </div>
              
              {/* Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <Building2 className="h-5 w-5 text-green-600 mx-auto mb-1" />
                  <p className="text-xl sm:text-2xl font-bold text-green-600">
                    {stats.totalClubs || 0}
                  </p>
                  <p className="text-xs text-gray-600">Total Clubs</p>
                </div>
                
                <div className="bg-blue-50 rounded-lg p-3 text-center">
                  <Users className="h-5 w-5 text-blue-600 mx-auto mb-1" />
                  <p className="text-xl sm:text-2xl font-bold text-blue-600">
                    {stats.membersWithClubs || 0}
                  </p>
                  <p className="text-xs text-gray-600">Members with Clubs</p>
                </div>
                
                <div className="bg-purple-50 rounded-lg p-3 text-center">
                  <Users className="h-5 w-5 text-purple-600 mx-auto mb-1" />
                  <p className="text-xl sm:text-2xl font-bold text-purple-600">
                    {stats.totalParticipants || 0}
                  </p>
                  <p className="text-xs text-gray-600">Total Participants</p>
                </div>
                
                <div className="bg-orange-50 rounded-lg p-3 text-center">
                  <Calendar className="h-5 w-5 text-orange-600 mx-auto mb-1" />
                  <p className="text-xl sm:text-2xl font-bold text-orange-600">
                    {stats.todayAttendance || 0}
                  </p>
                  <p className="text-xs text-gray-600">Today's Attendance</p>
                </div>
              </div>
            </div>

            {/* Team Members with Clubs */}
            {hierarchyData && (
              <div className="bg-white rounded-lg shadow-md p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">
                  Team Members with Clubs
                </h3>
                <div className="text-center py-8 text-gray-500">
                  <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-sm">
                    Club ownership data loaded successfully
                  </p>
                </div>
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
};

export default ClubAttendanceReport;
