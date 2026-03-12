import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  RefreshCw,
  Calendar,
  MapPin,
} from 'lucide-react';
import { motion } from 'framer-motion';
import TouchFeedbackButton from './TouchFeedbackButton';
import LoadingSpinner from './LoadingSpinner';

const AttendanceReport = ({ user, onBack }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [dateFilter, setDateFilter] = useState('today'); // today, yesterday,last-week, last-month, so-far

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

  // Fetch attendance report
  const fetchReport = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const userId = await getUserId(user.email);
      const { start, end } = getDateRange();

      const response = await fetch(
        `${apiBaseUrl}/api/get-my-club-attendance?userId=${userId}&startDate=${start}&endDate=${end}`,
        {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
          },
        }
      );

      const result = await response.json();

      console.log('📥 [AttendanceReport] API Response:', {
        success: result.success,
        totalAttendance: result.data?.totalAttendance || 0,
        clubCount: result.data?.clubSummary?.length || 0,
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

  useEffect(() => {
    if (user) {
      fetchReport();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, dateFilter]);

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
                <h1 className="text-base sm:text-lg md:text-xl font-bold text-gray-800">My Club Attendance</h1>
                <p className="text-[10px] sm:text-xs text-gray-500">Your club education attendance history</p>
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

          {/* Date Filter - Responsive Pills */}
          <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-2 scrollbar-hide mt-2 sm:mt-3 items-center">
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
      <div className="max-w-4xl mx-auto p-4">
        {loading ? (
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
                  {reportData.dateRange.start === reportData.dateRange.end
                    ? `Date: ${reportData.dateRange.start}`
                    : `Period: ${reportData.dateRange.start} to ${reportData.dateRange.end}`}
                </h2>
              </div>
              
              {/* Clubs Attended - Single Stat */}
              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-6 text-center shadow-sm">
                <MapPin className="h-8 w-8 text-green-600 mx-auto mb-3" />
                <p className="text-4xl font-bold text-green-600 mb-2">
                  {reportData.clubSummary?.length || 0}
                </p>
                <p className="text-sm text-gray-600 font-medium">Clubs Attended</p>
              </div>
            </div>

            {/* Club Summary */}
            {reportData.clubSummary && reportData.clubSummary.length > 0 ? (
              <div className="space-y-3 mb-6">
                <h3 className="text-lg font-bold text-gray-800 mb-3">
                  Clubs
                </h3>
                {reportData.clubSummary.map((club, index) => (
                  <motion.div
                    key={club.clubId || index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="bg-white rounded-lg shadow-md p-4"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-1">
                        <MapPin className="h-5 w-5 text-green-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-gray-800 truncate mb-1">
                          {club.clubName}
                        </h4>
                        {club.clubOwnerName && (
                          <p className="text-sm text-gray-600 truncate">
                            <span className="text-gray-500">Club Representative: </span>
                            {club.clubOwnerName}
                          </p>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center mb-6">
                <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600 font-medium mb-2">No Club Attendance</p>
                <p className="text-gray-500 text-sm">
                  You haven't attended any clubs during this period.
                </p>
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
};

export default AttendanceReport;
