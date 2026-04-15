import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  RefreshCw,
  Download,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  Calendar as CalendarIcon,
  MapPin,
  Wifi,
  XCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  Users,
  Target,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import TouchFeedbackButton from './TouchFeedbackButton';
import { Capacitor } from '@capacitor/core';

// --- DateRangePicker Component ---
const DateRangePicker = ({ startDate, endDate, onSelect, onClose }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectingStart, setSelectingStart] = useState(true);
  const [tempStart, setTempStart] = useState(startDate);
  const [tempEnd, setTempEnd] = useState(endDate);

  const daysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const handleDateClick = (day) => {
    const clickedDate = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      day,
    );

    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (clickedDate > today) {
      return;
    }

    if (selectingStart) {
      setTempStart(clickedDate);
      setTempEnd(null);
      setSelectingStart(false);
    } else {
      if (clickedDate < tempStart) {
        setTempEnd(tempStart);
        setTempStart(clickedDate);
      } else {
        const finalEnd = clickedDate < tempStart ? tempStart : clickedDate;
        const finalStart = clickedDate < tempStart ? clickedDate : tempStart;
        setTempEnd(finalEnd);
        onSelect(finalStart, finalEnd);
      }
    }
  };

  const isInRange = (day) => {
    if (!tempStart || !tempEnd) return false;
    const date = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      day,
    );
    return date >= tempStart && date <= tempEnd;
  };

  const isStartDate = (day) => {
    if (!tempStart) return false;
    const date = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      day,
    );
    return date.toDateString() === tempStart.toDateString();
  };

  const isEndDate = (day) => {
    if (!tempEnd) return false;
    const date = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      day,
    );
    return date.toDateString() === tempEnd.toDateString();
  };

  const isFutureDate = (day) => {
    const date = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      day,
    );
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    return date > today;
  };

  const prevMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1),
    );
  };

  const nextMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1),
    );
  };

  const blanks = Array(getFirstDayOfMonth(currentMonth)).fill(null);
  const dayNumbers = Array.from(
    { length: daysInMonth(currentMonth) },
    (_, i) => i + 1,
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-gray-100 p-4 z-50"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={prevMonth}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="text-center">
          <h3 className="font-semibold text-gray-800">
            {currentMonth.toLocaleDateString('en-US', {
              month: 'long',
              year: 'numeric',
            })}
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            {selectingStart ? 'Select start date' : 'Select end date'}
          </p>
        </div>
        <button
          onClick={nextMonth}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ChevronRight className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      {/* Weekday Headers */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
          <div
            key={day}
            className="text-center text-xs font-medium text-gray-500 py-2"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1">
        {blanks.map((_, i) => (
          <div key={`blank-${i}`} className="aspect-square" />
        ))}
        {dayNumbers.map((day) => {
          const isStart = isStartDate(day);
          const isEnd = isEndDate(day);
          const inRange = isInRange(day);
          const isFuture = isFutureDate(day);

          return (
            <button
              key={day}
              onClick={() => handleDateClick(day)}
              disabled={isFuture}
              className={`aspect-square flex items-center justify-center text-sm rounded-lg transition-all ${
                isFuture
                  ? 'text-gray-300 cursor-not-allowed'
                  : isStart || isEnd
                  ? 'bg-green-600 text-white font-bold shadow-md'
                  : inRange
                  ? 'bg-green-100 text-green-700'
                  : 'hover:bg-gray-100 text-gray-700'
              }`}
            >
              {day}
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          Cancel
        </button>
      </div>
    </motion.div>
  );
};

// --- Loading Skeleton ---
const LoadingSkeleton = () => {
  return (
    <div className="fixed inset-0 z-50 overflow-auto pb-20" style={{ backgroundColor: '#e8f5e9' }}>
      <div
        className="sticky top-0 z-40 backdrop-blur-sm shadow-md"
        style={{
          backgroundColor: '#a8dbb5',
          borderBottom: '1px solid #93c9a1',
        }}
      >
        <div className="max-w-sm sm:max-w-xl md:max-w-2xl lg:max-w-4xl xl:max-w-5xl mx-auto px-3 sm:px-4 md:px-6 py-2 sm:py-3">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-6 h-6 sm:w-8 sm:h-8 bg-green-400 rounded-full animate-pulse"></div>
              <div>
                <div className="h-4 w-28 sm:h-5 sm:w-32 bg-green-400 rounded animate-pulse mb-1"></div>
                <div className="h-2.5 w-20 sm:h-3 sm:w-24 bg-green-300 rounded animate-pulse"></div>
              </div>
            </div>
            <div className="flex gap-1 sm:gap-2">
              <div className="w-6 h-6 sm:w-8 sm:h-8 bg-green-400 rounded-full animate-pulse"></div>
              <div className="w-6 h-6 sm:w-8 sm:h-8 bg-green-400 rounded-full animate-pulse"></div>
            </div>
          </div>
          <div className="flex gap-1.5 sm:gap-2 overflow-hidden">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-7 w-20 sm:h-8 sm:w-24 bg-gray-50 rounded-full shrink-0 animate-pulse border border-gray-100"
              ></div>
            ))}
          </div>
        </div>
      </div>
      <div className="max-w-sm sm:max-w-xl md:max-w-2xl lg:max-w-4xl xl:max-w-5xl mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        <div className="bg-white rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow-sm border border-gray-100 h-20 sm:h-24 flex items-center justify-between animate-pulse">
          <div className="flex-1 flex flex-col items-center gap-2 border-r border-gray-50">
            <div className="h-3 w-12 bg-gray-100 rounded"></div>
            <div className="h-6 w-16 bg-gray-100 rounded"></div>
          </div>
          <div className="flex-1 flex flex-col items-center gap-2">
            <div className="h-3 w-12 bg-gray-100 rounded"></div>
            <div className="h-6 w-8 bg-gray-100 rounded"></div>
          </div>
        </div>
        <div className="flex gap-3">
          <div className="h-12 bg-gray-50 rounded-xl flex-1 animate-pulse border border-gray-100"></div>
          <div className="h-12 w-24 bg-gray-50 rounded-xl animate-pulse border border-gray-100"></div>
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center justify-between animate-pulse"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gray-100"></div>
                <div>
                  <div className="h-4 w-32 bg-gray-100 rounded mb-2"></div>
                  <div className="h-3 w-20 bg-gray-50 rounded"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const AttendanceReport = ({ user, onBack }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hierarchyData, setHierarchyData] = useState(null);
  const [dateRange, setDateRange] = useState('today');
  const [customStartDate, setCustomStartDate] = useState(null);
  const [customEndDate, setCustomEndDate] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [attendanceFilter, setAttendanceFilter] = useState('all');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [sortOrder, setSortOrder] = useState('desc');
  
  const filterRef = useRef(null);
  const apiBaseUrl = process.env.REACT_APP_API_BASE_URL;

  // Close filter dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (filterRef.current && !filterRef.current.contains(event.target)) {
        setIsFilterOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getTargetDate = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    if (dateRange === 'yesterday') {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return formatDate(yesterday);
    }
    if (dateRange === 'week') {
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return formatDate(weekAgo);
    }
    if (dateRange === 'month') {
      const monthAgo = new Date(today);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      return formatDate(monthAgo);
    }
    if (dateRange === 'custom' && customStartDate) {
      return formatDate(customStartDate);
    }
    return formatDate(today);
  };

  const getDateRangeLabel = () => {
    if (dateRange === 'custom' && customStartDate && customEndDate) {
      return `${customStartDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })} - ${customEndDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })}`;
    }
    return 'Custom';
  };

  const getUserId = async (email) => {
    const response = await fetch(
      `${apiBaseUrl}/api/lookup-user-id?email=${encodeURIComponent(email)}`
    );
    const data = await response.json();
    if (!data.success) throw new Error('User not found');
    return data.userId;
  };

  const fetchData = async (isBackground = false) => {
    if (!user) return;
    
    if (!isBackground) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    setError(null);
    
    try {
      const userId = await getUserId(user.email);
      const date = getTargetDate();
      const response = await fetch(
        `${apiBaseUrl}/api/coach/hierarchical-club-attendance?userId=${userId}&date=${date}`,
        { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } }
      );
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to fetch attendance data');
      }
      setHierarchyData(result.data.hierarchy);
    } catch (err) {
      console.error('Error fetching attendance:', err);
      setError(err.message);
    } finally {
      if (!isBackground) {
        setLoading(false);
      } else {
        setRefreshing(false);
      }
    }
  };

  useEffect(() => {
    fetchData();
  }, [user, dateRange, customStartDate, customEndDate]);

  // Filter members based on attendance status
  const filterNodeByAttendance = (node) => {
    if (attendanceFilter === 'all') return true;
    const attended = node.metrics?.attended === true;
    if (attendanceFilter === 'attended') return attended;
    if (attendanceFilter === 'notAttended') return !attended;
    return true;
  };

  // Check if node or any descendant matches search
  const nodeOrDescendantMatchesSearch = (node, query) => {
    if (!query) return true;
    const lowerQuery = query.toLowerCase();
    
    // Check current node
    if (
      node.userName?.toLowerCase().includes(lowerQuery) ||
      node.userEmail?.toLowerCase().includes(lowerQuery)
    ) {
      return true;
    }
    
    // Check descendants
    if (node.teamMembers && node.teamMembers.length > 0) {
      return node.teamMembers.some(child => 
        nodeOrDescendantMatchesSearch(child, query)
      );
    }
    
    return false;
  };

  // Get total coaches and members count
  const getTeamCounts = (node) => {
    if (!node) return { coaches: 0, members: 0 };
    
    let coaches = 0;
    let members = 0;
    
    const countNode = (n) => {
      if (n.teamMembers && n.teamMembers.length > 0) {
        coaches++;
        n.teamMembers.forEach(child => countNode(child));
      } else {
        members++;
      }
    };
    
    countNode(node);
    return { coaches, members };
  };

  const teamCounts = hierarchyData ? getTeamCounts(hierarchyData) : { coaches: 0, members: 0 };

  const handleDateRangeSelect = (start, end) => {
    setCustomStartDate(start);
    setCustomEndDate(end);
    setDateRange('custom');
    setShowDatePicker(false);
  };

  const handleManualRefresh = () => {
    fetchData(true);
  };

  if (loading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="fixed inset-0 z-50 overflow-auto pb-20" style={{ backgroundColor: '#e8f5e9' }}>
      {/* Header */}
      <div
        className="sticky top-0 z-40 backdrop-blur-sm shadow-md"
        style={{
          backgroundColor: '#a8dbb5',
          borderBottom: '1px solid #93c9a1',
        }}
      >
        <div className="max-w-sm sm:max-w-xl md:max-w-2xl lg:max-w-4xl xl:max-w-5xl mx-auto px-3 sm:px-4 md:px-6 py-2 sm:py-3">
          {/* Top Bar */}
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <TouchFeedbackButton
                onClick={onBack}
                className="p-1.5 sm:p-2 hover:bg-white/20 rounded-full transition-colors"
                ariaLabel="Go back"
              >
                <ArrowLeft className="h-5 w-5 sm:h-6 sm:w-6 text-green-900" />
              </TouchFeedbackButton>
              <div>
                <h1 className="text-base sm:text-lg md:text-xl font-bold text-green-900">
                  Attendance Report
                </h1>
                <p className="text-[10px] sm:text-xs text-green-800">
                  {teamCounts.coaches} Coaches • {teamCounts.members} Members
                </p>
              </div>
            </div>
            <div className="flex gap-1 sm:gap-2">
              <TouchFeedbackButton
                onClick={handleManualRefresh}
                disabled={refreshing}
                className="p-1.5 sm:p-2 hover:bg-white/20 rounded-full disabled:opacity-50 transition-colors"
                ariaLabel="Refresh"
              >
                <RefreshCw
                  className={`h-5 w-5 sm:h-6 sm:w-6 text-green-900 ${
                    refreshing ? 'animate-spin' : ''
                  }`}
                />
              </TouchFeedbackButton>
            </div>
          </div>

          {/* Date Range Pills */}
          <div className="relative">
            <div
              className="flex gap-1.5 sm:gap-2 overflow-x-scroll pb-2 scrollbar-hide"
              style={{
                WebkitOverflowScrolling: 'touch',
                scrollbarWidth: 'thin',
              }}
            >
              {[
                { value: 'today', label: 'Today' },
                { value: 'yesterday', label: 'Yesterday' },
                { value: 'week', label: 'Week' },
                { value: 'month', label: 'Month' },
              ].map((filter) => (
                <TouchFeedbackButton
                  key={filter.value}
                  id={`date-range-${filter.value}`}
                  onClick={() => setDateRange(filter.value)}
                  className={`whitespace-nowrap px-3 sm:px-4 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all border ${
                    dateRange === filter.value
                      ? 'bg-green-700 text-white border-green-700 shadow-md'
                      : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {filter.label}
                </TouchFeedbackButton>
              ))}

              {/* Custom Date Range Button */}
              <div className="relative">
                <TouchFeedbackButton
                  id="date-range-custom"
                  onClick={() => setShowDatePicker(!showDatePicker)}
                  className={`whitespace-nowrap px-3 sm:px-4 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all border flex items-center gap-1.5 ${
                    dateRange === 'custom'
                      ? 'bg-green-700 text-white border-green-700 shadow-md'
                      : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <CalendarIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  {getDateRangeLabel()}
                </TouchFeedbackButton>

                <AnimatePresence>
                  {showDatePicker && (
                    <DateRangePicker
                      startDate={customStartDate}
                      endDate={customEndDate}
                      onSelect={handleDateRangeSelect}
                      onClose={() => setShowDatePicker(false)}
                    />
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-sm sm:max-w-xl md:max-w-2xl lg:max-w-4xl xl:max-w-5xl mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {error ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <p className="text-red-600 font-medium">{error}</p>
            <TouchFeedbackButton
              onClick={() => fetchData()}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
            >
              Try Again
            </TouchFeedbackButton>
          </div>
        ) : hierarchyData ? (
          <>
            {/* Team Hierarchy Summary */}
            <div className="bg-white rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow-sm border border-gray-100">
              <h2 className="text-sm sm:text-base font-bold text-gray-800 mb-3 sm:mb-4">
                Team Hierarchy
              </h2>
              <div className="text-xs sm:text-sm text-gray-600">
                <p>View your team structure and attendance status</p>
              </div>
              <div className="mt-3 sm:mt-4 flex items-center gap-4 sm:gap-6">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                  <div>
                    <div className="text-lg sm:text-xl font-bold text-gray-900">
                      {teamCounts.coaches}
                    </div>
                    <div className="text-[10px] sm:text-xs text-gray-500">Coaches</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
                  <div>
                    <div className="text-lg sm:text-xl font-bold text-gray-900">
                      {teamCounts.members}
                    </div>
                    <div className="text-[10px] sm:text-xs text-gray-500">Members</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Search and Filter */}
            <div className="flex gap-2 sm:gap-3">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search members..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 sm:pl-11 pr-3 sm:pr-4 py-2.5 sm:py-3 bg-white border border-gray-200 rounded-xl text-xs sm:text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              {/* Filter Dropdown */}
              <div className="relative" ref={filterRef}>
                <TouchFeedbackButton
                  onClick={() => setIsFilterOpen(!isFilterOpen)}
                  className={`px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl border transition-all flex items-center gap-2 ${
                    attendanceFilter !== 'all'
                      ? 'bg-green-700 text-white border-green-700'
                      : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <Filter className="h-4 w-4 sm:h-5 sm:w-5" />
                  <span className="text-xs sm:text-sm font-medium hidden sm:inline">
                    Filter
                  </span>
                  <ChevronDown
                    className={`h-3.5 w-3.5 sm:h-4 sm:w-4 transition-transform ${
                      isFilterOpen ? 'rotate-180' : ''
                    }`}
                  />
                </TouchFeedbackButton>

                <AnimatePresence>
                  {isFilterOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute right-0 mt-2 w-48 sm:w-56 bg-white rounded-xl shadow-2xl border border-gray-100 py-2 z-50"
                    >
                      <button
                        onClick={() => {
                          setAttendanceFilter('all');
                          setIsFilterOpen(false);
                        }}
                        className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 flex items-center justify-between transition-colors"
                      >
                        <span className="font-medium text-gray-700">All Members</span>
                        {attendanceFilter === 'all' && (
                          <Check className="h-4 w-4 text-green-600" />
                        )}
                      </button>
                      <button
                        onClick={() => {
                          setAttendanceFilter('attended');
                          setIsFilterOpen(false);
                        }}
                        className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 flex items-center justify-between transition-colors"
                      >
                        <span className="font-medium text-green-700">Attended</span>
                        {attendanceFilter === 'attended' && (
                          <Check className="h-4 w-4 text-green-600" />
                        )}
                      </button>
                      <button
                        onClick={() => {
                          setAttendanceFilter('notAttended');
                          setIsFilterOpen(false);
                        }}
                        className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 flex items-center justify-between transition-colors"
                      >
                        <span className="font-medium text-red-700">Not Attended</span>
                        {attendanceFilter === 'notAttended' && (
                          <Check className="h-4 w-4 text-green-600" />
                        )}
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Hierarchy Tree */}
            <div className="space-y-0">
              <AttendanceNode
                node={hierarchyData}
                level={0}
                isLastChild={true}
                searchQuery={searchQuery}
                attendanceFilter={attendanceFilter}
                filterNodeByAttendance={filterNodeByAttendance}
                nodeOrDescendantMatchesSearch={nodeOrDescendantMatchesSearch}
              />
            </div>
          </>
        ) : (
          <div className="text-center py-16 text-gray-400">
            <p className="text-sm">No data available</p>
          </div>
        )}
      </div>
    </div>
  );
};

/* ── Individual tree node with filtering ── */
const AttendanceNode = ({
  node,
  level,
  isLastChild,
  searchQuery,
  attendanceFilter,
  filterNodeByAttendance,
  nodeOrDescendantMatchesSearch,
}) => {
  const [showClubDetails, setShowClubDetails] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const hasChildren = node.teamMembers && node.teamMembers.length > 0;
  const attended = node.metrics?.attended === true;
  const clubs = node.metrics?.clubs || [];
  const remoteCount = node.metrics?.remoteCount || 0;
  const hasMultipleLocations = attended && clubs.length + remoteCount > 1;

  const attendedDirect = node.directTeamCount?.qualified || 0;
  const totalDirect = node.directTeamCount?.total || 0;
  const attendedFull = node.fullTeamCount?.qualified || 0;
  const totalFull = node.fullTeamCount?.total || 0;

  // Check if this node matches filters
  const matchesSearch = nodeOrDescendantMatchesSearch(node, searchQuery);
  const matchesAttendanceFilter = filterNodeByAttendance(node);

  if (!matchesSearch || !matchesAttendanceFilter) {
    // Check if any children match
    if (hasChildren) {
      const matchingChildren = node.teamMembers.filter((child) =>
        nodeOrDescendantMatchesSearch(child, searchQuery) &&
        filterNodeByAttendance(child)
      );
      if (matchingChildren.length === 0) {
        return null;
      }
    } else {
      return null;
    }
  }

  return (
    <div className="relative flex" style={{ marginLeft: level > 0 ? 0 : 0 }}>
      {/* Tree lines */}
      {level > 0 && (
        <div className="relative flex-shrink-0" style={{ width: '28px' }}>
          <div className="absolute top-[22px] left-0 h-[2px] bg-gray-200 w-full" />
          <div
            className="absolute left-0 top-0 w-[2px] bg-gray-200"
            style={{ height: isLastChild ? '22px' : 'calc(100% + 12px)' }}
          />
        </div>
      )}

      {/* Node body */}
      <div className="flex-1 mb-2 min-w-0">
        <div
          className={`rounded-xl border-2 overflow-hidden transition-all ${
            level === 0
              ? attended
                ? 'bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-300 shadow-md'
                : 'bg-white border-gray-200 shadow-md'
              : attended
                ? 'bg-white border-green-200 shadow-sm'
                : 'bg-gray-50 border-gray-200'
          }`}
        >
          {/* Row */}
          <div
            className={`flex items-center gap-2 px-3 py-2.5 ${
              hasMultipleLocations ? 'cursor-pointer hover:bg-black/5' : ''
            }`}
            onClick={() => hasMultipleLocations && setShowClubDetails(!showClubDetails)}
          >
            {/* Avatar */}
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2 flex-shrink-0 ${
                level === 0 && attended
                  ? 'bg-yellow-400 border-yellow-500 text-white'
                  : attended
                    ? 'bg-green-100 border-green-400 text-green-700'
                    : 'bg-gray-200 border-gray-300 text-gray-500'
              }`}
            >
              {node.userName?.charAt(0).toUpperCase() || '?'}
            </div>

            {/* Name + info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span
                  className={`text-sm font-bold truncate ${
                    level === 0 && attended
                      ? 'text-yellow-900'
                      : attended
                        ? 'text-gray-900'
                        : 'text-gray-500'
                  }`}
                >
                  {node.userName}
                </span>
                {level === 0 && (
                  <span className="text-[9px] bg-yellow-300 text-yellow-900 border border-yellow-400 px-1.5 py-0.5 rounded-full font-bold uppercase">
                    YOU
                  </span>
                )}
              </div>
              {/* Reports to */}
              {node.uplineCoachName && level > 0 && (
                <div className="text-[10px] text-gray-500 mt-0.5">
                  Reports to:{' '}
                  <span className="font-medium text-gray-700">{node.uplineCoachName}</span>
                </div>
              )}
              {/* Team member count */}
              {hasChildren && (
                <div className="flex items-center gap-1 mt-1">
                  <Users className="h-3 w-3 text-blue-600" />
                  <span className="text-[10px] text-blue-600 font-medium">
                    {node.teamMembers.length} team member{node.teamMembers.length !== 1 ? 's' : ''}
                  </span>
                </div>
              )}
            </div>

            {/* Status */}
            <div className="flex-shrink-0 flex items-center gap-1">
              {!attended ? (
                <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-red-50 border border-red-200 text-red-500">
                  <XCircle className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="text-[11px] font-semibold whitespace-nowrap">
                    Not Attended
                  </span>
                </div>
              ) : hasMultipleLocations ? (
                <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-green-50 border border-green-300 text-green-700">
                  <MapPin className="h-3.5 w-3.5" />
                  <span className="text-[11px] font-semibold">
                    {clubs.length + remoteCount} locations
                  </span>
                  {showClubDetails ? (
                    <ChevronUp className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                </div>
              ) : clubs.length === 1 ? (
                <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-green-50 border border-green-300 text-green-700">
                  <MapPin className="h-3.5 w-3.5" />
                  <span className="text-[11px] font-semibold">{clubs[0].name}</span>
                </div>
              ) : remoteCount === 1 ? (
                <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-blue-50 border border-blue-300 text-blue-600">
                  <Wifi className="h-3.5 w-3.5" />
                  <span className="text-[11px] font-semibold">Remote</span>
                </div>
              ) : null}
            </div>
          </div>

          {/* Expanded Club Details */}
          <AnimatePresence>
            {showClubDetails && hasMultipleLocations && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className={`border-t overflow-hidden ${
                  level === 0
                    ? 'border-yellow-200 bg-yellow-50'
                    : 'border-green-200 bg-green-50'
                }`}
              >
                <div className="px-3 py-2 space-y-1.5">
                  {clubs.map((club, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white border border-green-200"
                    >
                      <MapPin className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
                      <span className="text-xs font-medium text-gray-800">{club.name}</span>
                    </div>
                  ))}
                  {remoteCount > 0 && (
                    <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white border border-blue-200">
                      <Wifi className="h-3.5 w-3.5 text-blue-600 flex-shrink-0" />
                      <span className="text-xs font-medium text-gray-800">Remote</span>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Stats strip */}
          <div
            className={`flex items-center divide-x px-3 py-2 border-t ${
              level === 0
                ? attended
                  ? 'border-yellow-200 divide-yellow-200'
                  : 'border-gray-100 divide-gray-100'
                : attended
                  ? 'border-green-100 divide-green-100'
                  : 'border-gray-100 divide-gray-100'
            }`}
          >
            {/* Self */}
            <div className="flex-1 flex flex-col items-center pr-2">
              <span className="text-[9px] font-bold uppercase tracking-wide text-gray-400 mb-0.5">
                {level === 0 ? 'You' : 'Self'}
              </span>
              {attended ? (
                <div className="flex flex-wrap gap-1 justify-center mt-0.5">
                  {clubs.length > 0 && (
                    <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-green-100 border border-green-300">
                      <MapPin className="h-2.5 w-2.5 text-green-700" />
                      <span className="text-[9px] font-semibold text-green-700">
                        {clubs.length}
                      </span>
                    </div>
                  )}
                  {remoteCount > 0 && (
                    <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-blue-100 border border-blue-300">
                      <Wifi className="h-2.5 w-2.5 text-blue-700" />
                      <span className="text-[9px] font-semibold text-blue-700">
                        {remoteCount}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <span className="text-lg font-bold text-red-500">0%</span>
              )}
            </div>

            {/* Direct Team */}
            <div className="flex-1 flex flex-col items-center px-2">
              <span className="text-[9px] font-bold uppercase tracking-wide text-gray-400 mb-0.5">
                Direct
              </span>
              <div className="flex items-baseline gap-0.5">
                <span className="text-base font-bold text-gray-900">
                  {totalDirect > 0
                    ? Math.round((attendedDirect / totalDirect) * 100)
                    : 0}
                  %
                </span>
              </div>
              <span className="text-[9px] text-gray-500">
                {attendedDirect}/{totalDirect}
              </span>
            </div>

            {/* Full Team */}
            <div className="flex-1 flex flex-col items-center pl-2">
              <span className="text-[9px] font-bold uppercase tracking-wide text-gray-400 mb-0.5">
                Full Team
              </span>
              <div className="flex items-baseline gap-0.5">
                <span className="text-base font-bold text-gray-900">
                  {totalFull > 0 ? Math.round((attendedFull / totalFull) * 100) : 0}%
                </span>
              </div>
              <span className="text-[9px] text-gray-500">
                {attendedFull}/{totalFull}
              </span>
            </div>
          </div>

          {/* Expand/Collapse Children */}
          {hasChildren && (
            <div className="border-t border-gray-100">
              <TouchFeedbackButton
                onClick={() => setExpanded(!expanded)}
                className="w-full py-2 flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors"
              >
                <span className="text-xs font-medium text-gray-600">
                  {expanded ? 'Hide' : 'Show'} {node.teamMembers.length} team member
                  {node.teamMembers.length !== 1 ? 's' : ''}
                </span>
                {expanded ? (
                  <ChevronUp className="h-3.5 w-3.5 text-gray-600" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 text-gray-600" />
                )}
              </TouchFeedbackButton>
            </div>
          )}
        </div>

        {/* Children */}
        {hasChildren && expanded && (
          <div className="mt-2 space-y-0">
            {node.teamMembers.map((child, index) => (
              <AttendanceNode
                key={child.userId}
                node={child}
                level={level + 1}
                isLastChild={index === node.teamMembers.length - 1}
                searchQuery={searchQuery}
                attendanceFilter={attendanceFilter}
                filterNodeByAttendance={filterNodeByAttendance}
                nodeOrDescendantMatchesSearch={nodeOrDescendantMatchesSearch}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AttendanceReport;
