/**
 * ActivityReport.js ΓÇö Main Activity Report Component
 * 
 * Displays date filter, activity badges, and detailed grids for each activity type.
 * This component replaces the old Education Report and consolidates all activity tracking.
 */
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, RefreshCw, Download, Search, ChevronDown, ChevronUp,
  Scale, BookOpen, Coffee, Utensils, Moon, Droplets, Flame,
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, Check,
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import TouchFeedbackButton from '../../../shared/components/TouchFeedbackButton';

// Activity type metadata
const ACTIVITY_TYPES = [
  { id: 'weight', label: 'Weight', icon: Scale, color: 'blue', bgColor: 'bg-blue-50', borderColor: 'border-blue-200', textColor: 'text-blue-700' },
  { id: 'education', label: 'Education Attendance', icon: BookOpen, color: 'indigo', bgColor: 'bg-indigo-50', borderColor: 'border-indigo-200', textColor: 'text-indigo-700' },
  { id: 'breakfast', label: 'Breakfast', icon: Coffee, color: 'orange', bgColor: 'bg-orange-50', borderColor: 'border-orange-200', textColor: 'text-orange-700' },
  { id: 'lunch', label: 'Lunch', icon: Utensils, color: 'green', bgColor: 'bg-green-50', borderColor: 'border-green-200', textColor: 'text-green-700' },
  { id: 'dinner', label: 'Dinner', icon: Moon, color: 'purple', bgColor: 'bg-purple-50', borderColor: 'border-purple-200', textColor: 'text-purple-700' },
  { id: 'water', label: 'Water', icon: Droplets, color: 'cyan', bgColor: 'bg-cyan-50', borderColor: 'border-cyan-200', textColor: 'text-cyan-700' },
  { id: 'calories', label: 'Calories', icon: Flame, color: 'red', bgColor: 'bg-red-50', borderColor: 'border-red-200', textColor: 'text-red-700' },
];

const DATE_RANGES = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last7days', label: 'Last 7 Days' },
  { value: 'last30days', label: 'Last 30 Days' },
  { value: 'custom', label: 'Custom Range' },
];

// Date Picker Component
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
    const clickedDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (clickedDate > today) return;

    if (selectingStart) {
      setTempStart(clickedDate);
      setTempEnd(null);
      setSelectingStart(false);
    } else {
      if (clickedDate < tempStart) {
        setTempEnd(tempStart);
        setTempStart(clickedDate);
      } else {
        setTempEnd(clickedDate);
      }
      onSelect(clickedDate < tempStart ? clickedDate : tempStart, clickedDate < tempStart ? tempStart : clickedDate);
    }
  };

  const isInRange = (day) => {
    if (!tempStart || !tempEnd) return false;
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    return date >= tempStart && date <= tempEnd;
  };

  const isStartDate = (day) => {
    if (!tempStart) return false;
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    return date.toDateString() === tempStart.toDateString();
  };

  const isEndDate = (day) => {
    if (!tempEnd) return false;
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    return date.toDateString() === tempEnd.toDateString();
  };

  const renderCalendar = () => {
    const days = [];
    const totalDays = daysInMonth(currentMonth);
    const firstDay = getFirstDayOfMonth(currentMonth);

    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-10" />);
    }

    const today = new Date();
    today.setHours(23, 59, 59, 999);

    for (let day = 1; day <= totalDays; day++) {
      const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
      const isFuture = date > today;
      const inRange = isInRange(day);
      const isStart = isStartDate(day);
      const isEnd = isEndDate(day);

      days.push(
        <button
          key={day}
          onClick={() => !isFuture && handleDateClick(day)}
          disabled={isFuture}
          className={`h-10 flex items-center justify-center text-sm rounded-lg transition-colors ${
            isFuture
              ? 'text-gray-300 cursor-not-allowed'
              : isStart || isEnd
              ? 'bg-green-600 text-white font-bold'
              : inRange
              ? 'bg-green-100 text-green-800'
              : 'hover:bg-gray-100'
          }`}
        >
          {day}
        </button>
      );
    }

    return days;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="bg-white rounded-xl shadow-lg p-4 border border-gray-200"
    >
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h3 className="text-lg font-semibold">
          {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </h3>
        <button
          onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-2">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
          <div key={day} className="h-8 flex items-center justify-center text-xs font-semibold text-gray-600">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">{renderCalendar()}</div>

      <div className="mt-4 flex justify-between items-center">
        <p className="text-xs text-gray-600">
          {selectingStart ? 'Select start date' : 'Select end date'}
        </p>
        <button
          onClick={onClose}
          className="px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors"
        >
          Done
        </button>
      </div>
    </motion.div>
  );
};

// Activity Badge Component
const ActivityBadge = ({ activity, count, onClick, isSelected }) => {
  const Icon = activity.icon;
  
  return (
    <TouchFeedbackButton
      onClick={onClick}
      className={`relative p-4 rounded-xl border-2 transition-all ${
        isSelected
          ? `${activity.bgColor} ${activity.borderColor} shadow-md scale-105`
          : 'bg-white border-gray-200 hover:border-gray-300 shadow-sm'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`p-3 rounded-full ${activity.bgColor}`}>
          <Icon className={`w-6 h-6 ${activity.textColor}`} />
        </div>
        <div className="flex-1 text-left">
          <p className="text-sm font-medium text-gray-600">{activity.label}</p>
          <p className={`text-2xl font-bold ${activity.textColor}`}>{count}</p>
        </div>
      </div>
    </TouchFeedbackButton>
  );
};

/** Returns 'ΓÇö' for null, undefined, empty string, or the literal string "N/A" */
const display = (val) => (!val || val === 'N/A') ? 'ΓÇö' : val;

// Main Component
const ActivityReport = ({ user, userRole, apiBaseUrl, onBack }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dateRange, setDateRange] = useState('today');
  const [customStartDate, setCustomStartDate] = useState(null);
  const [customEndDate, setCustomEndDate] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [summary, setSummary] = useState(null);
  const [selectedActivity, setSelectedActivity] = useState('education');
  const [detailRecords, setDetailRecords] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortColumn, setSortColumn] = useState('date');
  const [sortDirection, setSortDirection] = useState('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // Member summary (education attendance per member ΓÇö shown on mount)
  const [memberSummaries, setMemberSummaries] = useState([]);
  const [memberStats, setMemberStats] = useState(null);
  const [memberSummaryLoading, setMemberSummaryLoading] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');

  const formatDateForApi = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const fetchSummary = useCallback(async () => {
    if (!user?.id || !apiBaseUrl) return;

    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams({
        userId: String(user.id),
        activityType: 'summary',
        dateRange,
        role: userRole || 'member',
      });

      if (dateRange === 'custom' && customStartDate && customEndDate) {
        params.set('startDate', formatDateForApi(customStartDate));
        params.set('endDate', formatDateForApi(customEndDate));
      }

      const response = await fetch(`${apiBaseUrl}/api/activity/report?${params}`, {
        cache: 'no-store',
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to fetch activity summary');
      }

      setSummary(data.summary);
    } catch (err) {
      setError(err.message || 'Failed to load activity summary');
    } finally {
      setLoading(false);
    }
  }, [user?.id, apiBaseUrl, userRole, dateRange, customStartDate, customEndDate]);

  const fetchDetails = useCallback(async (activityType) => {
    if (!user?.id || !apiBaseUrl || !activityType) return;

    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams({
        userId: String(user.id),
        activityType,
        dateRange,
        role: userRole || 'member',
      });

      if (dateRange === 'custom' && customStartDate && customEndDate) {
        params.set('startDate', formatDateForApi(customStartDate));
        params.set('endDate', formatDateForApi(customEndDate));
      }

      const response = await fetch(`${apiBaseUrl}/api/activity/report?${params}`, {
        cache: 'no-store',
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to fetch activity details');
      }

      setDetailRecords(data.records || []);
      setCurrentPage(1);
    } catch (err) {
      setError(err.message || 'Failed to load activity details');
    } finally {
      setLoading(false);
    }
  }, [user?.id, apiBaseUrl, userRole, dateRange, customStartDate, customEndDate]);

  const fetchMemberSummary = useCallback(async () => {
    if (!user?.id || !apiBaseUrl) return;

    setMemberSummaryLoading(true);
    try {
      const params = new URLSearchParams({
        userId: String(user.id),
        activityType: 'member-summary',
        dateRange,
        role: userRole || 'member',
      });

      if (dateRange === 'custom' && customStartDate && customEndDate) {
        params.set('startDate', formatDateForApi(customStartDate));
        params.set('endDate', formatDateForApi(customEndDate));
      }

      const response = await fetch(`${apiBaseUrl}/api/activity/report?${params}`, {
        cache: 'no-store',
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to fetch member summaries');
      }

      setMemberSummaries(data.members || []);
      setMemberStats(data.stats || null);
    } catch (err) {
      // Non-critical: silently log; summary tiles remain visible
      console.warn('Member summary fetch failed:', err.message);
    } finally {
      setMemberSummaryLoading(false);
    }
  }, [user?.id, apiBaseUrl, userRole, dateRange, customStartDate, customEndDate]);

  useEffect(() => {
    fetchSummary();
    fetchMemberSummary();
    // Also load detail records for the default pre-selected activity on mount.
    // fetchDetails is the stable useCallback instance; selectedActivity is read
    // via closure so it is NOT added as a dependency ΓÇö we only want this to
    // re-run when the API params change (i.e. when fetchDetails is recreated).
    if (selectedActivity) fetchDetails(selectedActivity); // eslint-disable-line react-hooks/exhaustive-deps
  }, [fetchSummary, fetchMemberSummary, fetchDetails]);

  const handleActivityClick = (activityId) => {
    setSelectedActivity(activityId);
    fetchDetails(activityId);
  };

  const handleDateRangeChange = (range) => {
    setDateRange(range);
    setDetailRecords([]);
    setMemberSummaries([]);
    setMemberStats(null);
    if (range === 'custom') {
      setShowDatePicker(true);
    } else {
      setShowDatePicker(false);
    }
  };

  const handleCustomDateSelect = (start, end) => {
    setCustomStartDate(start);
    setCustomEndDate(end);
    setShowDatePicker(false);
    setDetailRecords([]);
    setMemberSummaries([]);
    setMemberStats(null);
  };

  // Filter member summaries by search query
  const filteredMemberSummaries = useMemo(() => {
    if (!memberSearchQuery) return memberSummaries;
    const q = memberSearchQuery.toLowerCase();
    return memberSummaries.filter(m =>
      (m.memberName || '').toLowerCase().includes(q) ||
      (m.coachName || '').toLowerCase().includes(q)
    );
  }, [memberSummaries, memberSearchQuery]);

  // Filter and sort records
  const filteredRecords = useMemo(() => {
    let filtered = detailRecords;

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(record =>
        (record.memberName || '').toLowerCase().includes(query) ||
        (record.phone || '').toLowerCase().includes(query) ||
        (record.coachName || '').toLowerCase().includes(query) ||
        (record.city || '').toLowerCase().includes(query) ||
        (record.village || '').toLowerCase().includes(query)
      );
    }

    // Apply sorting
    filtered = [...filtered].sort((a, b) => {
      let aVal = a[sortColumn];
      let bVal = b[sortColumn];

      if (sortColumn === 'date' || sortColumn === 'time') {
        aVal = aVal || '';
        bVal = bVal || '';
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [detailRecords, searchQuery, sortColumn, sortDirection]);

  // Paginate records
  const paginatedRecords = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredRecords.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredRecords, currentPage]);

  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const handleDownload = async () => {
    if (filteredRecords.length === 0) {
      alert('No records to export');
      return;
    }

    try {
      const selectedActivityMeta = ACTIVITY_TYPES.find(a => a.id === selectedActivity);
      const activityLabel = selectedActivityMeta?.label || 'Activity';

      // Build CSV header based on activity type
      let headers = ['Member Name', 'City', 'Village', 'Phone Number', 'Coach Name', 'Reg. Date', 'Reg. Time', 'Club Name'];
      
      if (selectedActivity === 'weight') {
        headers.push('Weight (kg)');
      } else if (selectedActivity === 'education') {
        headers.push('Attendance Type', 'Topic');
      } else if (['breakfast', 'lunch', 'dinner'].includes(selectedActivity)) {
        headers.push('Meal Type', 'Calories');
      } else if (selectedActivity === 'water') {
        headers.push('Water (L)');
      } else if (selectedActivity === 'calories') {
        headers.push('Steps', 'Calories Burned');
      }

      const csvRows = [headers.join(',')];

      filteredRecords.forEach((record) => {
        const baseRow = [
          `"${record.memberName || 'N/A'}"`,
          `"${record.city || 'N/A'}"`,
          `"${record.village || 'N/A'}"`,
          `"${record.phone || 'N/A'}"`,
          `"${record.coachName || 'N/A'}"`,
          record.date || 'N/A',
          record.time || 'N/A',
          `"${record.clubName || 'N/A'}"`,
        ];

        if (selectedActivity === 'weight') {
          baseRow.push(record.weight || 'N/A');
        } else if (selectedActivity === 'education') {
          const attendanceLabel = record.attendanceType && record.attendanceType !== 'N/A'
            ? record.attendanceType.charAt(0).toUpperCase() + record.attendanceType.slice(1)
            : 'N/A';
          baseRow.push(`"${attendanceLabel}"`, `"${record.topic && record.topic !== 'N/A' ? record.topic : 'ΓÇö'}"`);
        } else if (['breakfast', 'lunch', 'dinner'].includes(selectedActivity)) {
          baseRow.push(`"${record.mealType || 'N/A'}"`, record.calories || 0);
        } else if (selectedActivity === 'water') {
          baseRow.push(record.waterLiters || 0);
        } else if (selectedActivity === 'calories') {
          baseRow.push(record.steps || 0, record.caloriesBurned || 0);
        }

        csvRows.push(baseRow.join(','));
      });

      const csv = csvRows.join('\n');
      const fileName = `activity-report-${activityLabel.toLowerCase().replace(/\s+/g, '-')}-${dateRange}-${new Date().toISOString().slice(0, 10)}.csv`;

      const isNative = Capacitor.isNativePlatform();

      if (isNative) {
        const result = await Filesystem.writeFile({
          path: fileName,
          data: csv,
          directory: Directory.Cache,
          encoding: Encoding.UTF8,
        });

        const canShare = await Share.canShare().catch(() => ({ value: false }));
        if (canShare.value) {
          await Share.share({
            title: 'Activity Report',
            text: 'Save or share your activity report',
            files: [result.uri],
            dialogTitle: 'Save or Share Report',
          });
        } else {
          alert(`File saved to: ${result.uri}`);
        }
      } else {
        // Web fallback
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Export failed:', err);
      alert('Failed to export report. Please try again.');
    }
  };

  const getCustomRangeLabel = () => {
    if (!customStartDate || !customEndDate) return 'Select Dates';
    const formatDate = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${formatDate(customStartDate)} - ${formatDate(customEndDate)}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100 pb-20">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <TouchFeedbackButton onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg">
                <ArrowLeft className="w-6 h-6" />
              </TouchFeedbackButton>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Attendance Report</h1>
              </div>
            </div>
            <TouchFeedbackButton
              onClick={() => { fetchSummary(); fetchMemberSummary(); }}
              className="p-2 hover:bg-gray-100 rounded-lg"
              disabled={loading || memberSummaryLoading}
            >
              <RefreshCw className={`w-5 h-5 ${(loading || memberSummaryLoading) ? 'animate-spin' : ''}`} />
            </TouchFeedbackButton>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Date Range Filter ΓÇö single horizontal scrollable row */}
        <div className="mb-6">
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {DATE_RANGES.map((range) => (
              <TouchFeedbackButton
                key={range.value}
                onClick={() => handleDateRangeChange(range.value)}
                className={`px-4 py-2 rounded-full text-sm font-semibold transition-all whitespace-nowrap flex-shrink-0 ${
                  dateRange === range.value
                    ? 'bg-green-600 text-white shadow-md'
                    : 'bg-white text-gray-700 border border-gray-200 hover:border-green-400'
                }`}
              >
                {range.value === 'custom' ? getCustomRangeLabel() : range.label}
              </TouchFeedbackButton>
            ))}
          </div>

          <AnimatePresence>
            {showDatePicker && (
              <div className="mt-4">
                <DateRangePicker
                  startDate={customStartDate}
                  endDate={customEndDate}
                  onSelect={handleCustomDateSelect}
                  onClose={() => setShowDatePicker(false)}
                />
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {/* Activity Type Tabs ΓÇö always visible, highlights the active type */}
        {summary && (
          <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar mb-5">
            {ACTIVITY_TYPES.map((activity) => {
              const Icon = activity.icon;
              const isActive = selectedActivity === activity.id;
              return (
                <TouchFeedbackButton
                  key={activity.id}
                  onClick={() => handleActivityClick(activity.id)}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full border shadow-sm active:scale-95 transition-all ${
                    isActive
                      ? `${activity.bgColor} ${activity.borderColor}`
                      : 'bg-white border-gray-200'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? activity.textColor : 'text-gray-400'}`} />
                  <span className={`text-sm font-bold ${isActive ? activity.textColor : 'text-gray-500'}`}>
                    {summary[activity.id] || 0}
                  </span>
                  <span className={`text-xs font-medium whitespace-nowrap ${isActive ? 'text-gray-600' : 'text-gray-400'}`}>
                    {activity.label}
                  </span>
                </TouchFeedbackButton>
              );
            })}
          </div>
        )}

        {/* Detail Grid */}
        {selectedActivity && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900">
                  {ACTIVITY_TYPES.find(a => a.id === selectedActivity)?.label} Records
                </h2>
                <div className="flex items-center gap-2">
                  {filteredRecords.length > 0 && (
                    <TouchFeedbackButton
                      onClick={handleDownload}
                      className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700"
                    >
                      <Download className="w-4 h-4" />
                      Export
                    </TouchFeedbackButton>
                  )}
                </div>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name, phone, coach, city, or village..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>

            <div className="overflow-x-auto overflow-y-auto max-h-[65vh]">
              <table className="w-full">
                <thead className="border-b border-gray-200 sticky top-0 z-20">
                  <tr>
                    <th
                      className="sticky left-0 z-30 bg-gray-50 px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase min-w-[130px] cursor-pointer hover:bg-gray-100 shadow-[2px_0_5px_-1px_rgba(0,0,0,0.08)]"
                      onClick={() => handleSort('memberName')}
                    >
                      Member Name {sortColumn === 'memberName' && (sortDirection === 'asc' ? 'Γåæ' : 'Γåô')}
                    </th>
                    <th className="bg-gray-50 px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">City</th>
                    <th className="bg-gray-50 px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Village</th>
                    <th className="bg-gray-50 px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Phone</th>
                    <th className="bg-gray-50 px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Coach</th>
                    <th
                      className="bg-gray-50 px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('date')}
                    >
                      Reg. Date {sortColumn === 'date' && (sortDirection === 'asc' ? 'Γåæ' : 'Γåô')}
                    </th>
                    <th className="bg-gray-50 px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">Reg. Time</th>
                    <th className="bg-gray-50 px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Club</th>
                    
                    {selectedActivity === 'weight' && (
                      <th className="bg-gray-50 px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Weight (kg)</th>
                    )}
                    {selectedActivity === 'education' && (
                      <>
                        <th className="bg-gray-50 px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Type</th>
                        <th className="bg-gray-50 px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Topic</th>
                      </>
                    )}
                    {['breakfast', 'lunch', 'dinner'].includes(selectedActivity) && (
                      <>
                        <th className="bg-gray-50 px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Meal</th>
                        <th className="bg-gray-50 px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Calories</th>
                      </>
                    )}
                    {selectedActivity === 'water' && (
                      <th className="bg-gray-50 px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Water (L)</th>
                    )}
                    {selectedActivity === 'calories' && (
                      <>
                        <th className="bg-gray-50 px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Steps</th>
                        <th className="bg-gray-50 px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Calories Burned</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {paginatedRecords.map((record, index) => (
                    <tr key={`${record.userId}-${record.date}-${record.time}-${index}`} className="hover:bg-gray-50">
                      <td className="sticky left-0 z-10 bg-white px-4 py-3 text-sm font-medium text-gray-900 min-w-[130px] shadow-[2px_0_5px_-1px_rgba(0,0,0,0.08)]">{display(record.memberName)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{display(record.city)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{display(record.village)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{display(record.phone)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{display(record.coachName)}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{display(record.date)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{display(record.time)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {record.clubName && record.clubName !== 'N/A'
                          ? <span className="text-green-700 font-medium">{record.clubName}</span>
                          : <span className="text-gray-400 italic">Remote</span>
                        }
                      </td>
                      
                      {selectedActivity === 'weight' && (
                        <td className="px-4 py-3 text-sm font-semibold text-blue-600">{record.weight}</td>
                      )}
                      {selectedActivity === 'education' && (
                        <>
                          <td className="px-4 py-3 text-sm capitalize text-gray-600">
                            {record.attendanceType && record.attendanceType !== 'N/A'
                              ? record.attendanceType.charAt(0).toUpperCase() + record.attendanceType.slice(1)
                              : 'N/A'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {record.topic && record.topic !== 'N/A' ? record.topic : 'ΓÇö'}
                          </td>
                        </>
                      )}
                      {['breakfast', 'lunch', 'dinner'].includes(selectedActivity) && (
                        <>
                          <td className="px-4 py-3 text-sm capitalize text-gray-600">{record.mealType}</td>
                          <td className="px-4 py-3 text-sm font-semibold text-orange-600">{record.calories}</td>
                        </>
                      )}
                      {selectedActivity === 'water' && (
                        <td className="px-4 py-3 text-sm font-semibold text-cyan-600">{record.waterLiters}</td>
                      )}
                      {selectedActivity === 'calories' && (
                        <>
                          <td className="px-4 py-3 text-sm text-gray-600">{record.steps}</td>
                          <td className="px-4 py-3 text-sm font-semibold text-red-600">{record.caloriesBurned}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-gray-200 flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredRecords.length)} of {filteredRecords.length} records
                </p>
                <div className="flex items-center gap-2">
                  <TouchFeedbackButton
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </TouchFeedbackButton>
                  <span className="text-sm text-gray-600">
                    Page {currentPage} of {totalPages}
                  </span>
                  <TouchFeedbackButton
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </TouchFeedbackButton>
                </div>
              </div>
            )}

            {paginatedRecords.length === 0 && !loading && (
              <div className="p-12 text-center">
                <p className="text-gray-500">No records found</p>
              </div>
            )}
          </div>
        )}

        {/* Loading State */}
        {loading && !summary && (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 text-green-600 animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivityReport;
