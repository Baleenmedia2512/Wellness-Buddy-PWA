import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  RefreshCw,
  Calendar,
  Users,
  MapPin,
} from 'lucide-react';
import { motion } from 'framer-motion';
import TouchFeedbackButton from './TouchFeedbackButton';
import LoadingSpinner from './LoadingSpinner';

const ClubAttendanceReport = ({ user, onBack }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [clubs, setClubs] = useState([]);
  const [selectedClubId, setSelectedClubId] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [dateFilter, setDateFilter] = useState('today'); // today, yesterday, last-week, last-month, so-far

  const apiBaseUrl = process.env.REACT_APP_API_BASE_URL;

  // Calculate date range based on filter
  const getDateRange = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    let startDate, endDate;
    
    switch (dateFilter) {
      case 'today':
        startDate = today;
        endDate = today;
        break;
      case 'yesterday':
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        startDate = yesterday;
        endDate = yesterday;
        break;
      case 'last-week':
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        startDate = weekAgo;
        endDate = today;
        break;
      case 'last-month':
        const monthAgo = new Date(today);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        startDate = monthAgo;
        endDate = today;
        break;
      case 'so-far':
        startDate = new Date(2024, 0, 1); // Jan 1, 2024
        endDate = today;
        break;
      default:
        startDate = today;
        endDate = today;
    }

    return {
      start: formatDate(startDate),
      end: formatDate(endDate),
    };
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

  // Fetch user's clubs
  const fetchClubs = async () => {
    if (!user) return;

    try {
      const userId = await getUserId(user.email);

      const response = await fetch(
        `${apiBaseUrl}/api/get-nutrition-centers?userId=${userId}&scope=team`,
        {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
          },
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to fetch clubs');
      }

      // Filter to only show clubs owned by the user
      const userIdNum = parseInt(userId);
      const allCenters = result.data || [];
      const ownedClubs = allCenters.filter(
        (center) => center.owner_user_id === userIdNum
      );

      console.log('🏢 [ClubAttendanceReport] Owned clubs:', ownedClubs);

      setClubs(ownedClubs);

      // Auto-select first club if available
      if (ownedClubs.length > 0 && !selectedClubId) {
        setSelectedClubId(ownedClubs[0].id);
      }
    } catch (err) {
      console.error('Error fetching clubs:', err);
      setError(err.message);
    }
  };

  // Fetch attendance report for selected club
  const fetchReport = async () => {
    if (!user || !selectedClubId) {
      setReportData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const userId = await getUserId(user.email);
      const { start, end } = getDateRange();

      const response = await fetch(
        `${apiBaseUrl}/api/coach/club-attendance-report?userId=${userId}&clubId=${selectedClubId}&startDate=${start}&endDate=${end}`,
        {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
          },
        }
      );

      const result = await response.json();

      console.log('📥 [ClubAttendanceReport] API Response:', {
        success: result.success,
        attendeeCount: result.data?.attendees?.length || 0,
        clubInfo: result.data?.clubInfo,
      });

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to fetch attendance report');
      }

      setReportData(result.data);
    } catch (err) {
      console.error('Error fetching attendance report:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Initial load - fetch clubs
  useEffect(() => {
    if (user) {
      fetchClubs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Fetch report when club or date filter changes
  useEffect(() => {
    if (user && selectedClubId) {
      fetchReport();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClubId, dateFilter]);

  // Generate profile avatar from email or name
  const getAvatar = (email, userName, profileImage) => {
    // If profile image exists, use it with lazy loading
    if (profileImage) {
      return (
        <img
          src={profileImage}
          alt={userName || 'User'}
          className="w-12 h-12 rounded-full object-cover shadow-md border-2 border-white"
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
        />
      );
    }

    // Otherwise, generate initial-based avatar
    const initial = userName
      ? userName.charAt(0).toUpperCase()
      : email
      ? email.charAt(0).toUpperCase()
      : '?';

    // Generate color based on email/name
    const colors = [
      'bg-blue-500',
      'bg-green-500',
      'bg-purple-500',
      'bg-pink-500',
      'bg-indigo-500',
      'bg-yellow-500',
      'bg-red-500',
      'bg-teal-500',
    ];
    const colorIndex = (userName || email || '').length % colors.length;

    return (
      <div
        className={`w-12 h-12 rounded-full ${colors[colorIndex]} flex items-center justify-center text-white font-bold text-lg shadow-md`}
      >
        {initial}
      </div>
    );
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
                <h1 className="text-base sm:text-lg md:text-xl font-bold text-gray-800">Club Attendance Report</h1>
                <p className="text-[10px] sm:text-xs text-gray-500">Track attendance at your nutrition centers</p>
              </div>
            </div>
            <TouchFeedbackButton
              onClick={fetchReport}
              disabled={loading}
              className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-full disabled:opacity-50"
              ariaLabel="Refresh"
            >
              <RefreshCw className={`h-4 w-4 sm:h-5 sm:w-5 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
            </TouchFeedbackButton>
          </div>

          {/* Club Selector - Full width dropdown */}
          {clubs.length > 0 && (
            <div className="mt-2 sm:mt-3 mb-2">
              <select
                value={selectedClubId || ''}
                onChange={(e) => setSelectedClubId(parseInt(e.target.value))}
                className="w-full px-3 sm:px-4 py-2 sm:py-2.5 bg-white border border-gray-200 rounded-full text-xs sm:text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                {clubs.map((club) => (
                  <option key={club.id} value={club.id}>
                    {club.center_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Date Filter - Responsive Pills */}
          <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-2 scrollbar-hide items-center">
            {[
              { value: 'today', label: 'Today' },
              { value: 'yesterday', label: 'Yesterday' },
              { value: 'last-week', label: 'Week' },
              { value: 'last-month', label: 'Month' },
            ].map((filter) => (
              <TouchFeedbackButton
                key={filter.value}
                onClick={() => setDateFilter(filter.value)}
                className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 ${
                  dateFilter === filter.value
                    ? 'bg-green-600 text-white shadow-md shadow-green-200'
                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                {filter.label}
              </TouchFeedbackButton>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto p-3 sm:p-4">
        {clubs.length === 0 && !loading ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
            <MapPin className="h-12 w-12 text-yellow-600 mx-auto mb-3" />
            <p className="text-yellow-800 font-medium mb-2">No Clubs Found</p>
            <p className="text-yellow-600 text-sm">
              You don't have any registered clubs yet. Register a club to track attendance.
            </p>
          </div>
        ) : loading ? (
          <div className="flex flex-col items-center justify-center h-96">
            <LoadingSpinner />
            <p className="mt-4 text-gray-600">Loading attendance data...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <p className="text-red-600 font-medium">{error}</p>
            <TouchFeedbackButton
              onClick={fetchReport}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Try Again
            </TouchFeedbackButton>
          </div>
        ) : reportData ? (
          <>
            {/* Summary Stats */}
            <div className="bg-white rounded-lg shadow-md p-4 mb-4">
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="h-5 w-5 text-green-600" />
                <h2 className="text-lg font-bold text-gray-800">
                  {reportData.clubInfo?.name || 'Club Attendance'}
                </h2>
              </div>
              <div className="text-sm text-gray-600 mb-4">
                {reportData.dateRange.start === reportData.dateRange.end
                  ? `Date: ${reportData.dateRange.start}`
                  : `Period: ${reportData.dateRange.start} to ${reportData.dateRange.end}`}
              </div>
              
              {/* Total Attendees - Single Stat */}
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6 text-center shadow-sm">
                <Users className="h-8 w-8 text-blue-600 mx-auto mb-3" />
                <p className="text-4xl font-bold text-blue-600 mb-2">
                  {reportData.attendees.length}
                </p>
                <p className="text-sm text-gray-600 font-medium">Total Attendees</p>
              </div>
            </div>

            {/* Attendee List */}
            {reportData.attendees.length === 0 ? (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600 font-medium mb-2">No Attendance Records</p>
                <p className="text-gray-500 text-sm">
                  No one has attended this club during the selected period.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <h3 className="text-lg font-bold text-gray-800 mb-3">
                  Attendees ({reportData.attendees.length})
                </h3>
                {reportData.attendees.map((attendee, index) => (
                  <motion.div
                    key={attendee.userId}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="bg-white rounded-lg shadow-md p-4 flex items-center gap-4"
                  >
                    {/* Profile Picture */}
                    <div className="flex-shrink-0">
                      {getAvatar(attendee.email, attendee.userName, attendee.profileImage)}
                    </div>

                    {/* User Info */}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-gray-800 truncate">
                        {attendee.userName}
                      </h4>
                      {attendee.coachName && attendee.coachName !== 'No Coach' && (
                        <p className="text-sm text-gray-600 truncate">
                          Coach: {attendee.coachName}
                        </p>
                      )}
                    </div>

                    {/* Attendance Badge - only show if > 0 days */}
                    {attendee.attendanceDays > 0 && (
                      <div className="flex-shrink-0 text-center">
                        <div className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-semibold">
                          {attendee.attendanceDays} {attendee.attendanceDays === 1 ? 'day' : 'days'}
                        </div>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
};

export default ClubAttendanceReport;
