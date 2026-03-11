import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000';

const PROGRAMS = [
  'Family Healthy Breakfast Program',
  'Weight Loss',
  'Weight Gain',
  'Kids Nutrition',
  'Sports Nutrition',
  'Targeted Nutrition',
  'How to Earn My Product Cost',
  'Extra Income Opportunity',
];

const WellnessUniversityReport = ({ onClose, user, userRole }) => {
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedEnrollment, setSelectedEnrollment] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [programFilter, setProgramFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('today');
  const [customDateRange, setCustomDateRange] = useState({ start: '', end: '' });
  const [showCustomDateModal, setShowCustomDateModal] = useState(false);
  const [selectingStartDate, setSelectingStartDate] = useState(true);
  // const [stats, setStats] = useState({
  //   totalEnrollments: 0,
  //   mostPopularProgram: '',
  //   mostPopularCount: 0,
  //   recentEnrollments: 0,
  // });

  // Stats calculation - commented out (stats removed)
  // const calculateStats = (data) => {
  //   const now = new Date();
  //   const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  //   const recentEnrollments = data.filter(
  //     (e) => new Date(e.LastUpdated || e.EnrollmentDate) >= weekAgo
  //   ).length;

  //   const programCounts = {};
  //   data.forEach((enrollment) => {
  //     const programs = JSON.parse(enrollment.EnrolledPrograms || '[]');
  //     programs.forEach((program) => {
  //       programCounts[program] = (programCounts[program] || 0) + 1;
  //     });
  //   });

  //   let mostPopular = '';
  //   let maxCount = 0;
  //   Object.entries(programCounts).forEach(([program, count]) => {
  //     if (count > maxCount) {
  //       maxCount = count;
  //       mostPopular = program;
  //     }
  //   });

  //   setStats({
  //     totalEnrollments: data.length,
  //     mostPopularProgram: mostPopular || 'N/A',
  //     mostPopularCount: maxCount,
  //     recentEnrollments,
  //   });
  // };

  const fetchEnrollments = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const cacheBuster = Date.now();
      const response = await fetch(
        `${API_BASE}/api/wellness-university/get-enrollments?email=${encodeURIComponent(user.email)}&_t=${cacheBuster}`
      );
      const data = await response.json();

      if (data.success) {
        setEnrollments(data.enrollments || []);
        // calculateStats(data.enrollments || []);
      } else {
        setError(data.message || 'Failed to load enrollments');
      }
    } catch (err) {
      console.error('Error fetching enrollments:', err);
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchEnrollments();
  }, [fetchEnrollments]);

  // Handler to open enrollment details with fresh data
  const handleViewEnrollmentDetails = async (enrollment) => {
    try {
      const cacheBuster = Date.now();
      const response = await fetch(
        `${API_BASE}/api/wellness-university/get-enrollments?email=${encodeURIComponent(enrollment.Email)}&userOnly=true&_t=${cacheBuster}`
      );
      const data = await response.json();
      
      if (data.success && data.enrollments && data.enrollments.length > 0) {
        const freshEnrollment = data.enrollments[0];
        setSelectedEnrollment(freshEnrollment);
        
        // Also update in the main list
        setEnrollments(prev => 
          prev.map(e => e.Email === freshEnrollment.Email ? freshEnrollment : e)
        );
      } else {
        // Fallback to the existing enrollment data
        setSelectedEnrollment(enrollment);
      }
    } catch (err) {
      console.error('Error fetching fresh enrollment:', err);
      // Fallback to the existing enrollment data
      setSelectedEnrollment(enrollment);
    }
  };

  const getDateFilterRange = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (dateFilter) {
      case 'today':
        return { start: today, end: new Date(today.getTime() + 24 * 60 * 60 * 1000) };
      case 'yesterday':
        const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
        return { start: yesterday, end: today };
      case 'week':
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return { start: weekAgo, end: now };
      case 'month':
        const monthAgo = new Date(now.getFullYear(), now.getMonth(), 1);
        return { start: monthAgo, end: now };
      case 'custom':
        if (customDateRange.start && customDateRange.end) {
          return {
            start: new Date(customDateRange.start),
            end: new Date(new Date(customDateRange.end).getTime() + 24 * 60 * 60 * 1000)
          };
        }
        return null;
      default:
        return null;
    }
  };

  const filteredEnrollments = enrollments.filter((enrollment) => {
    const matchesSearch =
      searchQuery === '' ||
      enrollment.UserName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      enrollment.Email?.toLowerCase().includes(searchQuery.toLowerCase());

    const enrolledPrograms = JSON.parse(enrollment.EnrolledPrograms || '[]');
    const matchesProgram =
      programFilter === 'all' || enrolledPrograms.includes(programFilter);

    // Date filtering
    const dateRange = getDateFilterRange();
    let matchesDate = true;
    if (dateRange) {
      const enrollmentDate = new Date(enrollment.LastUpdated || enrollment.EnrollmentDate);
      matchesDate = enrollmentDate >= dateRange.start && enrollmentDate < dateRange.end;
    }

    return matchesSearch && matchesProgram && matchesDate;
  });

  const exportToCSV = () => {
    const headers = ['Name', 'Email', 'Programs', 'Last Updated'];
    const rows = filteredEnrollments.map((e) => {
      const programs = JSON.parse(e.EnrolledPrograms || '[]').join('; ');
      const date = new Date(e.LastUpdated || e.EnrollmentDate).toLocaleDateString();
      return [e.UserName, e.Email, programs, date];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wellness-university-enrollments-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-gray-50 z-50 overflow-y-auto">
      {/* Header */}
      <div className="bg-green-200 sticky top-0 z-10 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={onClose}
              className="text-gray-700 hover:bg-white hover:bg-opacity-50 rounded-full p-2 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flex-1">
              <h1 className="text-lg font-bold text-gray-800">
                Enrollments Report
              </h1>
              <p className="text-gray-700 text-xs">
                {enrollments.length} {enrollments.length === 1 ? 'Report' : 'Reports'} • {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            <button
              onClick={fetchEnrollments}
              className="text-gray-700 hover:bg-white hover:bg-opacity-50 rounded-full p-2 transition-colors"
              title="Refresh"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Date Filter Buttons - Mobile View (below header) */}
      <div className="md:hidden bg-green-200 px-4 pb-4 sticky top-[72px] z-10">
        <style>{`
          .hide-scrollbar::-webkit-scrollbar {
            display: none;
          }
        `}</style>
        <div className="flex flex-nowrap gap-2 justify-start overflow-x-auto hide-scrollbar" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <button
            onClick={() => setDateFilter('today')}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
              dateFilter === 'today'
                ? 'bg-green-500 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Today
          </button>
          <button
            onClick={() => setDateFilter('yesterday')}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
              dateFilter === 'yesterday'
                ? 'bg-green-500 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Yesterday
          </button>
          <button
            onClick={() => setDateFilter('week')}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
              dateFilter === 'week'
                ? 'bg-green-500 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Week
          </button>
          <button
            onClick={() => setDateFilter('month')}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
              dateFilter === 'month'
                ? 'bg-green-500 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Month
          </button>
          <button
            onClick={() => {
              setShowCustomDateModal(true);
              setSelectingStartDate(true);
            }}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1 whitespace-nowrap ${
              dateFilter === 'custom'
                ? 'bg-green-500 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Custom
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-green-500 mb-4"></div>
            <p className="text-gray-600">Loading enrollments...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <p className="text-red-700">{error}</p>
            <button
              onClick={fetchEnrollments}
              className="mt-4 bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            {/* Date Filter Buttons - Desktop View (below header) */}
            <div className="hidden md:block bg-green-200 rounded-xl p-4 mb-6 shadow-sm">
              <div className="flex flex-wrap gap-3 justify-center">
                <button
                  onClick={() => setDateFilter('today')}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    dateFilter === 'today'
                      ? 'bg-green-500 text-white shadow-md'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Today
                </button>
                <button
                  onClick={() => setDateFilter('yesterday')}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    dateFilter === 'yesterday'
                      ? 'bg-green-500 text-white shadow-md'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Yesterday
                </button>
                <button
                  onClick={() => setDateFilter('week')}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    dateFilter === 'week'
                      ? 'bg-green-500 text-white shadow-md'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Week
                </button>
                <button
                  onClick={() => setDateFilter('month')}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    dateFilter === 'month'
                      ? 'bg-green-500 text-white shadow-md'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Month
                </button>
                <button
                  onClick={() => {
                    setShowCustomDateModal(true);
                    setSelectingStartDate(true);
                  }}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
                    dateFilter === 'custom'
                      ? 'bg-green-500 text-white shadow-md'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Custom
                </button>
              </div>
            </div>

            {/* Stats Cards - Removed per user request */}
            
            {/* Filters */}
            <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
              <div className="flex flex-col md:flex-row gap-4 items-center">
                <div className="flex-1 w-full md:w-auto">
                  <div className="relative">
                    <svg className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      type="text"
                      placeholder="Search members..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400 bg-gray-50"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Enrollments List */}
            {filteredEnrollments.length === 0 ? (
              <div className="bg-gray-50 rounded-xl p-12 text-center">
                <div className="text-6xl mb-4">📋</div>
                <p className="text-gray-600 text-lg">No enrollments found</p>
                <p className="text-gray-500 text-sm mt-2">
                  {searchQuery || programFilter !== 'all'
                    ? 'Try adjusting your filters'
                    : 'Be the first to enroll!'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredEnrollments.map((enrollment) => {
                  const enrolledPrograms = JSON.parse(enrollment.EnrolledPrograms || '[]');
                  const enrollmentDate = new Date(enrollment.LastUpdated || enrollment.EnrollmentDate).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  });

                  return (
                    <div
                      key={enrollment.Id}
                      onClick={() => handleViewEnrollmentDetails(enrollment)}
                      className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow p-3 sm:p-4 cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 flex-shrink-0 bg-gradient-to-br from-green-400 to-teal-400 rounded-full flex items-center justify-center text-white font-bold text-base">
                          {enrollment.UserName?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <h3 className="font-semibold text-gray-800 text-base truncate">{enrollment.UserName}</h3>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedEnrollment && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => setSelectedEnrollment(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl max-w-lg w-full"
            >
              <div className="bg-green-200 p-4 rounded-t-2xl">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-bold text-gray-800">Enrollment Details</h3>
                    <p className="text-xs text-gray-700 mt-0.5">
                      {new Date(selectedEnrollment.LastUpdated || selectedEnrollment.EnrollmentDate).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true
                      }).replace(',', '')}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedEnrollment(null)}
                    className="text-gray-700 hover:bg-white hover:bg-opacity-50 rounded-full p-1.5"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="p-4 space-y-3">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Name</p>
                  <p className="text-base font-semibold text-gray-800">{selectedEnrollment.UserName}</p>
                </div>

                <div>
                  <p className="text-sm text-gray-600 mb-1">Email</p>
                  <p className="text-gray-800">{selectedEnrollment.Email}</p>
                </div>

                <div>
                  <p className="text-sm text-gray-600 mb-2">Enrolled Programs</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {JSON.parse(selectedEnrollment.EnrolledPrograms || '[]').map((program, idx) => (
                      <div
                        key={idx}
                        className="bg-gradient-to-r from-green-50 to-teal-50 border border-green-200 p-3 rounded-lg text-center"
                      >
                        <span className="text-gray-800 font-medium text-sm">{program}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Custom Date Range Modal */}
      <AnimatePresence>
        {showCustomDateModal && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowCustomDateModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
            >
              <div className="mb-4">
                <h3 className="text-lg font-bold text-gray-800 text-center">March 2026</h3>
                <p className="text-sm text-gray-600 text-center mt-1">
                  {selectingStartDate ? 'Select start date' : 'Select end date'}
                </p>
              </div>

              {/* Calendar Grid */}
              <div className="mb-4">
                {/* Day Headers */}
                <div className="grid grid-cols-7 gap-2 mb-2">
                  {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
                    <div key={day} className="text-center text-xs font-medium text-gray-600">
                      {day}
                    </div>
                  ))}
                </div>

                {/* Calendar Days */}
                <div className="grid grid-cols-7 gap-2">
                  {[...Array(42)].map((_, index) => {
                    const dayNumber = index - 6 + 1; // March 2026 starts on Sunday (index 0)
                    const isValidDay = dayNumber > 0 && dayNumber <= 31;
                    const today = new Date().getDate();
                   const isToday = dayNumber === today;
                    const dateStr = isValidDay ? `2026-03-${String(dayNumber).padStart(2, '0')}` : '';
                    
                    return (
                      <button
                        key={index}
                        disabled={!isValidDay}
                        onClick={() => {
                          if (isValidDay) {
                            if (selectingStartDate) {
                              setCustomDateRange({ ...customDateRange, start: dateStr });
                              setSelectingStartDate(false);
                            } else {
                              setCustomDateRange({ ...customDateRange, end: dateStr });
                              setDateFilter('custom');
                              setShowCustomDateModal(false);
                            }
                          }
                        }}
                        className={`
                          aspect-square rounded-lg text-sm font-medium transition-colors
                          ${!isValidDay ? 'invisible' : ''}
                          ${isToday ? 'bg-green-100 text-green-700 hover:bg-green-200' : ''}
                          ${!isToday && isValidDay ? 'hover:bg-gray-100 text-gray-800' : ''}
                          ${customDateRange.start === dateStr || customDateRange.end === dateStr 
                            ? 'bg-green-500 text-white hover:bg-green-600' 
                            : ''}
                        `}
                      >
                        {isValidDay ? dayNumber : ''}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Selected Range Display */}
              {customDateRange.start && (
                <div className="mb-4 text-center text-sm text-gray-600">
                  <span className="font-medium">{customDateRange.start}</span>
                  {customDateRange.end && (
                    <>
                      <span className="mx-2">to</span>
                      <span className="font-medium">{customDateRange.end}</span>
                    </>
                  )}
                </div>
              )}

              {/* Footer Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowCustomDateModal(false);
                    setCustomDateRange({ start: '', end: '' });
                    setSelectingStartDate(true);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                {customDateRange.start && customDateRange.end && (
                  <button
                    onClick={() => {
                      setDateFilter('custom');
                      setShowCustomDateModal(false);
                    }}
                    className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                  >
                    Apply
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default WellnessUniversityReport;
