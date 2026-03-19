import React, { useState, useEffect, useRef } from "react";
import {
  ArrowLeft,
  RefreshCw,
  Download,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Check,
  Users,
  Target,
  Settings,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import TouchFeedbackButton from "../TouchFeedbackButton";

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
      className="absolute top-2 left-0 right-0 bg-white rounded-xl shadow-2xl border border-gray-100 p-4 z-[60] max-w-sm mx-auto"
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
            {currentMonth.toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
            })}
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            {selectingStart ? "Select start date" : "Select end date"}
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
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
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
                  ? "text-gray-300 cursor-not-allowed"
                  : isStart || isEnd
                  ? "bg-green-600 text-white font-bold shadow-md"
                  : inRange
                  ? "bg-green-100 text-green-700"
                  : "hover:bg-gray-100 text-gray-700"
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
export const LoadingSkeleton = () => {
  return (
    <div
      className="fixed inset-0 z-50 overflow-auto pb-20"
      style={{ backgroundColor: "#e8f5e9" }}
    >
      <div
        className="sticky top-0 z-40 backdrop-blur-sm shadow-md"
        style={{
          backgroundColor: "#a8dbb5",
          borderBottom: "1px solid #93c9a1",
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

/**
 * Common Hierarchical Report Layout
 * Reusable component for all hierarchy-based reports
 *
 * @param {Object} props
 * @param {string} props.title - Report title (e.g., "Discipline Report", "Attendance Report")
 * @param {string} props.subtitle - Subtitle showing counts (e.g., "4 Members • 11:19")
 * @param {Function} props.onBack - Back button handler
 * @param {Function} props.onRefresh - Refresh button handler
 * @param {Function} props.onDownload - Optional download/export handler
 * @param {boolean} props.loading - Loading state
 * @param {boolean} props.refreshing - Refreshing state
 * @param {string} props.error - Error message
 * @param {Function} props.onRetry - Retry handler for errors
 * @param {string} props.dateRange - Current date range selection
 * @param {Function} props.onDateRangeChange - Date range change handler
 * @param {Date} props.customStartDate - Custom start date
 * @param {Date} props.customEndDate - Custom end date
 * @param {Function} props.onCustomDateSelect - Custom date selection handler
 * @param {string} props.searchQuery - Search query
 * @param {Function} props.onSearchChange - Search change handler
 * @param {string} props.filter - Current filter value
 * @param {Array} props.filterOptions - Filter options array [{value, label, color}]
 * @param {Function} props.onFilterChange - Filter change handler
 * @param {Object} props.summaryStats - Summary statistics to display
 * @param {ReactNode} props.children - Hierarchy tree content
 */
const HierarchicalReportLayout = ({
  title,
  subtitle,
  onBack,
  onRefresh,
  onDownload,
  onSettings,
  sortOrder,
  onSortChange,
  loading,
  refreshing,
  error,
  onRetry,
  dateRange,
  onDateRangeChange,
  customStartDate,
  customEndDate,
  onCustomDateSelect,
  searchQuery,
  onSearchChange,
  filter,
  filterOptions,
  onFilterChange,
  summaryStats,
  onStatClick,
  topContent,
  children,
  allowedDateRanges, // Optional array to filter date range options (e.g., ["today", "yesterday"])
}) => {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterRef = useRef(null);

  // Close filter dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (filterRef.current && !filterRef.current.contains(event.target)) {
        setIsFilterOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getDateRangeLabel = () => {
    if (dateRange === "custom" && customStartDate && customEndDate) {
      return `${customStartDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })} - ${customEndDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })}`;
    }
    return "Custom";
  };

  const handleDateRangeSelect = (start, end) => {
    if (onCustomDateSelect) {
      onCustomDateSelect(start, end);
    }
    setShowDatePicker(false);
  };

  if (loading) {
    return <LoadingSkeleton />;
  }

  return (
    <div
      className="fixed inset-0 z-50 overflow-auto pb-20"
      style={{ backgroundColor: "#e8f5e9" }}
    >
      {/* Header */}
      <div
        className="sticky top-0 z-40 backdrop-blur-sm shadow-md"
        style={{
          backgroundColor: "#a8dbb5",
          borderBottom: "1px solid #93c9a1",
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
                <h1 className="text-base sm:text-lg md:text-xl font-bold text-gray-900">
                  {title}
                </h1>
                {subtitle && (
                  <p className="text-[10px] sm:text-xs text-gray-900">
                    {subtitle}
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-1 sm:gap-2">
              <TouchFeedbackButton
                onClick={onRefresh}
                disabled={refreshing}
                className="p-1.5 sm:p-2 hover:bg-white/20 rounded-full disabled:opacity-50 transition-colors"
                ariaLabel="Refresh"
              >
                <RefreshCw
                  className={`h-5 w-5 sm:h-6 sm:w-6 text-green-900 ${
                    refreshing ? "animate-spin" : ""
                  }`}
                />
              </TouchFeedbackButton>
              {onSettings && (
                <TouchFeedbackButton
                  onClick={onSettings}
                  className="p-1.5 sm:p-2 hover:bg-white/20 rounded-full transition-colors"
                  ariaLabel="Settings"
                >
                  <Settings className="h-5 w-5 sm:h-6 sm:w-6 text-green-900" />
                </TouchFeedbackButton>
              )}
              {onDownload && (
                <TouchFeedbackButton
                  onClick={onDownload}
                  className="p-1.5 sm:p-2 hover:bg-white/20 rounded-full transition-colors"
                  ariaLabel="Download"
                >
                  <Download className="h-5 w-5 sm:h-6 sm:w-6 text-green-900" />
                </TouchFeedbackButton>
              )}
            </div>
          </div>

          {/* Date Range Pills */}
          <div className="relative">
            <div
              className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-0 scrollbar-hide justify-center flex-wrap"
              style={{
                WebkitOverflowScrolling: "touch",
                scrollbarWidth: "none",
                msOverflowStyle: "none",
              }}
            >
              {[
                { value: "today", label: "Today" },
                { value: "yesterday", label: "Yesterday" },
                { value: "week", label: "Week" },
                { value: "month", label: "Month" },
              ]
                .filter(
                  (range) =>
                    !allowedDateRanges ||
                    allowedDateRanges.includes(range.value),
                )
                .map((range) => (
                  <TouchFeedbackButton
                    key={range.value}
                    id={`date-range-${range.value}`}
                    onClick={() => onDateRangeChange(range.value)}
                    className={`whitespace-nowrap px-3 sm:px-4 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all border ${
                      dateRange === range.value
                        ? "bg-green-700 text-white border-green-700 shadow-md"
                        : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    {range.label}
                  </TouchFeedbackButton>
                ))}

              {/* Custom Date Range Button */}
              <div className="relative">
                <TouchFeedbackButton
                  id="date-range-custom"
                  onClick={() => setShowDatePicker(!showDatePicker)}
                  className={`whitespace-nowrap px-3 sm:px-4 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all border flex items-center gap-1.5 ${
                    dateRange === "custom"
                      ? "bg-green-700 text-white border-green-700 shadow-md"
                      : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <CalendarIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  {getDateRangeLabel()}
                </TouchFeedbackButton>
              </div>
            </div>

            {/* Date Picker Dropdown - Outside scrollable container */}
            <AnimatePresence>
              {showDatePicker && (
                <div className="relative">
                  <DateRangePicker
                    startDate={customStartDate}
                    endDate={customEndDate}
                    onSelect={handleDateRangeSelect}
                    onClose={() => setShowDatePicker(false)}
                  />
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-sm sm:max-w-xl md:max-w-2xl lg:max-w-4xl xl:max-w-5xl mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {error ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <p className="text-red-600 font-medium">{error}</p>
            {onRetry && (
              <TouchFeedbackButton
                onClick={onRetry}
                className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
              >
                Try Again
              </TouchFeedbackButton>
            )}
          </div>
        ) : (
          <>
            {/* Top Content (e.g. stats card + toggles) */}
            {topContent && topContent}

            {/* Summary Stats */}
            {summaryStats && summaryStats.items?.length > 0 && (
              <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-sm border border-gray-100 mb-2 sm:mb-4">
                <h2 className="text-sm sm:text-base font-bold text-gray-800 mb-4 sm:mb-6 text-center">
                  {summaryStats.title || "Team Hierarchy"}
                </h2>
                {summaryStats.description && (
                  <div className="text-xs sm:text-sm text-gray-600 mb-3 text-center">
                    <p>{summaryStats.description}</p>
                  </div>
                )}
                <div className="grid grid-cols-3 gap-3 sm:gap-4">
                  {summaryStats.items?.map((item, index) => (
                    <div
                      key={index}
                      onClick={() => item.onClick && item.onClick()}
                      className={`rounded-lg sm:rounded-xl p-3 sm:p-4 border shadow-sm transition-all ${
                        item.isActive
                          ? "bg-gradient-to-br from-green-100 to-blue-100 border-green-500 shadow-md scale-105"
                          : "bg-gradient-to-br from-green-50 to-blue-50 border-gray-200"
                      } ${
                        item.onClick
                          ? "cursor-pointer hover:shadow-md hover:scale-105 active:scale-95"
                          : ""
                      }`}
                    >
                      <div className="flex flex-col items-center justify-center text-center h-full">
                        {item.icon}
                        <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-1 sm:mb-2">
                          {item.value}
                        </div>
                        <div className="text-[10px] sm:text-xs md:text-sm text-gray-600 font-medium">
                          {item.label}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notes Card */}
            {summaryStats?.note && (
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold text-gray-900">
                      Notes
                    </span>
                    <svg
                      className="w-4 h-4 text-gray-400"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <button className="text-gray-400 hover:text-gray-600 p-1">
                    <svg
                      className="w-5 h-5"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                    </svg>
                  </button>
                </div>

                {/* Three columns */}
                <div className="grid grid-cols-3 gap-2">
                  {summaryStats.note.split(" | ").map((s, i) => {
                    const [label, val] = s.split(": ");
                    const meta =
                      [
                        {
                          pill: "You",
                          subtitle: "Your own data",
                          active: true,
                        },
                        {
                          pill: "Direct Team",
                          subtitle: "Your direct members",
                          active: false,
                        },
                        {
                          pill: "Full Team",
                          subtitle: "Your full team members",
                          active: false,
                        },
                      ][i] || {};
                    return (
                      <div
                        key={i}
                        className="flex flex-col items-center gap-1.5"
                      >
                        <div
                          className={`w-full flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-xl font-semibold text-sm ${
                            meta.active
                              ? "bg-green-500 text-white shadow-sm"
                              : "bg-white border border-gray-200 text-gray-800"
                          }`}
                        >
                          <span>{meta.pill}</span>
                          <span
                            className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                              meta.active
                                ? "bg-white bg-opacity-25 text-white"
                                : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {val}
                          </span>
                        </div>
                        <span className="text-[10px] text-gray-400 text-center leading-tight">
                          {meta.subtitle}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Search and Filter */}
            {(onSearchChange ||
              (filterOptions && filterOptions.length > 0)) && (
              <div className="flex gap-2 sm:gap-3">
                {/* Search */}
                {onSearchChange && (
                  <div className="relative flex-1">
                    <Search className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search members..."
                      value={searchQuery}
                      onChange={(e) => onSearchChange(e.target.value)}
                      className="w-full pl-9 sm:pl-11 pr-3 sm:pr-4 py-2.5 sm:py-3 bg-white border border-gray-200 rounded-xl text-xs sm:text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                )}

                {/* Filter Dropdown */}
                {filterOptions && filterOptions.length > 0 && (
                  <div className="relative" ref={filterRef}>
                    <TouchFeedbackButton
                      onClick={() => setIsFilterOpen(!isFilterOpen)}
                      className={`px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl border transition-all flex items-center gap-2 ${
                        filter !== filterOptions[0]?.value
                          ? "bg-green-700 text-white border-green-700"
                          : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      <Filter className="h-4 w-4 sm:h-5 sm:w-5" />
                      <span className="text-xs sm:text-sm font-medium">
                        Filter
                      </span>
                      <ChevronDown
                        className={`h-3.5 w-3.5 sm:h-4 sm:w-4 transition-transform ${
                          isFilterOpen ? "rotate-180" : ""
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
                          {filterOptions.map((option) => (
                            <button
                              key={option.value}
                              onClick={() => {
                                onFilterChange(option.value);
                                setIsFilterOpen(false);
                              }}
                              className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 flex items-center justify-between transition-colors"
                            >
                              <span
                                className={`font-medium ${
                                  option.color || "text-gray-700"
                                }`}
                              >
                                {option.label}
                              </span>
                              {filter === option.value && (
                                <Check className="h-4 w-4 text-green-600" />
                              )}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {/* Sort Button */}
                {onSortChange && (
                  <TouchFeedbackButton
                    onClick={onSortChange}
                    className="px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl border bg-white text-gray-700 border-gray-200 hover:bg-gray-50 transition-all flex items-center justify-center"
                    ariaLabel="Toggle sort order"
                  >
                    {sortOrder === "desc" ? (
                      <ArrowDown className="h-4 w-4 sm:h-5 sm:w-5" />
                    ) : (
                      <ArrowUp className="h-4 w-4 sm:h-5 sm:w-5" />
                    )}
                  </TouchFeedbackButton>
                )}
              </div>
            )}

            {/* Hierarchy Tree Content */}
            <div className="space-y-0">{children}</div>
          </>
        )}
      </div>
    </div>
  );
};

export default HierarchicalReportLayout;
