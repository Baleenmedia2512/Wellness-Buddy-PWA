// src/components/DisciplineReport.js
import React, { useState, useEffect, useRef } from "react";
import {
  ArrowLeft,
  RefreshCw,
  Download,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  Scale,
  BookOpen,
  Coffee,
  Utensils,
  Moon,
  Check,
  Settings,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  Target,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { disciplineReportService } from "../services/disciplineReportService";
import TimeWindowSettingsModal from "./TimeWindowSettingsModal";
import TouchFeedbackButton from "./TouchFeedbackButton";
// Removed LoadingSpinner import as we are using custom skeleton

// --- DateRangePicker Component (Exact Copy from AI Token Monitor) ---
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

    // Prevent selecting future dates
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
        // Auto-confirm immediately after selecting both dates
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
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1),
    );
  };

  const nextMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1),
    );
  };

  const days = daysInMonth(currentMonth);
  const firstDay = getFirstDayOfMonth(currentMonth);
  const blanks = Array(firstDay).fill(null);
  const dayNumbers = Array.from({ length: days }, (_, i) => i + 1);

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="bg-white rounded-2xl shadow-lg border border-gray-100 p-4 mb-4"
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

// --- TeamFilterPills Component ---
const TeamFilterPills = ({ filters, activeFilter, onChange }) => {
  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
      <button
        onClick={() => onChange("all")}
        className={`whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-medium transition-all border ${
          activeFilter === "all"
            ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-100"
            : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
        }`}
      >
        All Teams
      </button>
      {filters.map((filter) => (
        <button
          key={filter.coachId}
          onClick={() =>
            onChange(filter.isMyTeam ? "myTeam" : filter.coachId.toString())
          }
          className={`whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-medium transition-all border ${
            activeFilter ===
            (filter.isMyTeam ? "myTeam" : filter.coachId.toString())
              ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-100"
              : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
          }`}
        >
          {filter.coachName} ({filter.memberCount})
        </button>
      ))}
    </div>
  );
};

const LoadingSkeleton = () => {
  return (
    <div className="min-h-screen bg-white pb-20">
      {/* Header Skeleton */}
      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-gray-100 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gray-100 rounded-full animate-pulse"></div>
              <div>
                <div className="h-5 w-32 bg-gray-100 rounded animate-pulse mb-1"></div>
                <div className="h-3 w-24 bg-gray-50 rounded animate-pulse"></div>
              </div>
            </div>
            <div className="flex gap-2">
              <div className="w-8 h-8 bg-gray-100 rounded-full animate-pulse"></div>
              <div className="w-8 h-8 bg-gray-100 rounded-full animate-pulse"></div>
            </div>
          </div>
          <div className="flex gap-2 overflow-hidden">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-8 w-24 bg-gray-50 rounded-full shrink-0 animate-pulse border border-gray-100"
              ></div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Summary Stats Skeleton - Compact */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 h-24 flex items-center justify-between animate-pulse">
          <div className="flex-1 flex flex-col items-center gap-2 border-r border-gray-50">
            <div className="h-3 w-12 bg-gray-100 rounded"></div>
            <div className="h-6 w-16 bg-gray-100 rounded"></div>
          </div>
          <div className="flex-1 flex flex-col items-center gap-2 border-r border-gray-50">
            <div className="h-3 w-12 bg-gray-100 rounded"></div>
            <div className="h-6 w-8 bg-gray-100 rounded"></div>
          </div>
          <div className="flex-1 flex flex-col items-center gap-2">
            <div className="h-3 w-12 bg-gray-100 rounded"></div>
            <div className="h-6 w-16 bg-gray-100 rounded"></div>
          </div>
        </div>

        {/* Search Bar Skeleton */}
        <div className="flex gap-3">
          <div className="h-12 bg-gray-50 rounded-xl flex-1 animate-pulse border border-gray-100"></div>
          <div className="h-12 w-24 bg-gray-50 rounded-xl animate-pulse border border-gray-100"></div>
        </div>

        {/* Member List Skeleton */}
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
              <div className="flex flex-col items-end gap-1">
                <div className="h-6 w-12 bg-gray-100 rounded"></div>
                <div className="h-3 w-8 bg-gray-50 rounded"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/**
 * Discipline Report Dashboard for Coaches
 * Mobile-first, clean, modern UI
 * Theme: Light Green & White (No Gradients)
 */
const DisciplineReport = ({ user, onBack, userRole }) => {
  const [teamData, setTeamData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dateRange, setDateRange] = useState("today");
  const [searchQuery, setSearchQuery] = useState("");
  const [disciplineFilter, setDisciplineFilter] = useState("all");
  const [expandedMemberId, setExpandedMemberId] = useState(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [showTimeWindowModal, setShowTimeWindowModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [customStartDate, setCustomStartDate] = useState(null);
  const [customEndDate, setCustomEndDate] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [teamFilter, setTeamFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState("desc");
  const [adminView, setAdminView] = useState("allMembers"); // 'myTeam' or 'allMembers' - start with All Teams for admin
  const [allMembersData, setAllMembersData] = useState(null); // Store all members data for admin
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

  // Load discipline report
  const loadDisciplineReportCallback = React.useCallback(
    async (isBackground = false) => {
      if (!user?.id) {
        // User not loaded yet, keep loading state
        if (!isBackground) {
          setLoading(true);
        }
        return;
      }

      if (!isBackground) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setError(null);
      try {
        // Format custom dates if available
        let customRange = null;
        if (dateRange === "custom" && customStartDate && customEndDate) {
          customRange = {
            start: customStartDate.toISOString().split("T")[0],
            end: customEndDate.toISOString().split("T")[0],
          };
        }

        // For admin/developer, fetch both team and all members data
        if (userRole === 'admin' || userRole === 'developer') {
          // Fetch coach team data (My Team)
          const teamDataResponse = await disciplineReportService.getDisciplineReport(
            user.id,
            dateRange,
            customRange,
          );
          
          // Fetch all members data (All Teams)
          const allMembersResponse = await disciplineReportService.getAllMembersDisciplineReport(
            user.id,
            dateRange,
            customRange,
          );
          
          setTeamData(teamDataResponse);
          setAllMembersData(allMembersResponse);
        } else {
          // Regular coach - only fetch their team
          const data = await disciplineReportService.getDisciplineReport(
            user.id,
            dateRange,
            customRange,
          );
          setTeamData(data);
        }
      } catch (err) {
        console.error("Failed to load discipline report:", err);
        setError(
          `Failed to load report: ${
            err.response?.data?.message || err.message
          }`,
        );
      } finally {
        if (!isBackground) {
          setLoading(false);
        } else {
          setRefreshing(false);
        }
      }
    },
    [user?.id, userRole, dateRange, customStartDate, customEndDate],
  );

  useEffect(() => {
    loadDisciplineReportCallback();
  }, [loadDisciplineReportCallback]);

  // Scroll active date range button into view after data loads
  useEffect(() => {
    if (!loading && dateRange) {
      const buttonId =
        dateRange === "custom"
          ? "date-range-custom"
          : `date-range-${dateRange}`;
      const button = document.getElementById(buttonId);
      if (button) {
        setTimeout(() => {
          button.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
            inline: "center",
          });
        }, 100);
      }
    }
  }, [loading, dateRange]);

  const handleDateRangeSelect = (start, end) => {
    setCustomStartDate(start);
    setCustomEndDate(end);
    setDateRange("custom");
    setShowDatePicker(false);
  };

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

  function handleExportCSV() {
    // For admin/developer viewing All Teams, export all members data
    if ((userRole === 'admin' || userRole === 'developer') && adminView === 'allMembers' && allMembersData) {
      disciplineReportService.exportToCSV(allMembersData, dateRange);
    } else if (teamData) {
      disciplineReportService.exportToCSV(teamData, dateRange);
    }
  }

  // Helper to get color based on percentage
  const getScoreColor = (score) => {
    if (score >= 80) return "text-green-700 bg-green-50 border-green-200";
    if (score >= 60) return "text-yellow-700 bg-yellow-50 border-yellow-200";
    return "text-red-700 bg-red-50 border-red-200";
  };

  const getScoreColorText = (score) => {
    if (score >= 80) return "text-green-700";
    if (score >= 60) return "text-yellow-700";
    return "text-red-700";
  };

  // Filter and sort team members (including coach)
  const allMembers = React.useMemo(() => {
    // For admin/developer viewing All Teams
    if ((userRole === 'admin' || userRole === 'developer') && adminView === 'allMembers' && allMembersData) {
      return allMembersData.allMembers || [];
    }

    // For admin/developer viewing My Team OR regular coach
    if (!teamData) return [];
    
    const combined = [];
    if (teamData.coachPerformance) {
      combined.push(teamData.coachPerformance);
    }
    if (teamData.teamMembers) {
      combined.push(...teamData.teamMembers);
    }
    return combined;
  }, [teamData, allMembersData, userRole, adminView] );

  const filteredAndSortedMembers = React.useMemo(() => {
    if (!user?.id) return [];

    // For admin/developer viewing All Teams, use simpler filtering (no team filters)
    if ((userRole === 'admin' || userRole === 'developer') && adminView === 'allMembers') {
      return allMembers
        .filter((member) => {
          // Skip members without discipline data
          if (!member.periodDiscipline) return false;

          // Search filter
          const matchesSearch =
            (member.userName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (member.email || '').toLowerCase().includes(searchQuery.toLowerCase());

          // Discipline score filter
          const discipline = member.periodDiscipline.percentage || 0;
          let matchesDiscipline = true;
          if (disciplineFilter === "high") matchesDiscipline = discipline >= 80;
          if (disciplineFilter === "medium")
            matchesDiscipline = discipline >= 60 && discipline < 80;
          if (disciplineFilter === "low") matchesDiscipline = discipline < 60;

          return matchesSearch && matchesDiscipline;
        })
        .sort((a, b) => {
          const scoreA = a.periodDiscipline.percentage;
          const scoreB = b.periodDiscipline.percentage;
          return sortOrder === "desc" ? scoreB - scoreA : scoreA - scoreB;
        });
    }

    // For admin viewing My Team OR regular coach, use existing team filtering logic
    return allMembers
      .filter((member) => {
        // Skip members without discipline data
        if (!member.periodDiscipline) return false;

        // Search filter
        const matchesSearch =
          (member.userName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
          (member.email || '').toLowerCase().includes(searchQuery.toLowerCase());

        // Discipline score filter
        const discipline = member.periodDiscipline.percentage || 0;
        let matchesDiscipline = true;
        if (disciplineFilter === "high") matchesDiscipline = discipline >= 80;
        if (disciplineFilter === "medium")
          matchesDiscipline = discipline >= 60 && discipline < 80;
        if (disciplineFilter === "low") matchesDiscipline = discipline < 60;

        // Team filter - simple logic
        let matchesTeam = true;
        if (teamFilter === "all") {
          // Show all members - coaches, co-coaches, and members
          matchesTeam = true;
        } else if (teamFilter === "myTeam") {
          // For coach, they manage their own team
          if (member.isLoggedInCoach) {
            matchesTeam = true;
          } else {
            matchesTeam = member.uplineCoachId === user.id;
          }
        } else {
          // For specific coach filter
          if (member.isLoggedInCoach) {
            matchesTeam = false; // Don't show logged-in coach in other coach filters
          } else {
            matchesTeam = member.uplineCoachId === parseInt(teamFilter);
          }
        }

        return matchesSearch && matchesDiscipline && matchesTeam;
      })
      .sort((a, b) => {
        // Sort by discipline score (highest to lowest by default)
        const scoreA = a.periodDiscipline.percentage;
        const scoreB = b.periodDiscipline.percentage;
        return sortOrder === "desc" ? scoreB - scoreA : scoreA - scoreB;
      });
  }, [
    allMembers,
    searchQuery,
    disciplineFilter,
    teamFilter,
    sortOrder,
    user?.id,
    userRole,
    adminView,
  ]);

  // Activity Icons Map
  const activityIcons = {
    weight: <Scale className="w-4 h-4" />,
    education: <BookOpen className="w-4 h-4" />,
    breakfast: <Coffee className="w-4 h-4" />,
    lunch: <Utensils className="w-4 h-4" />,
    dinner: <Moon className="w-4 h-4" />,
  };

  const filterOptions = [
    { id: "all", label: "All Scores", color: "text-gray-700" },
    { id: "high", label: "High (80%+)", color: "text-green-700" },
    { id: "medium", label: "Medium (60-79%)", color: "text-yellow-700" },
    { id: "low", label: "Low (<60%)", color: "text-red-700" },
  ];

  // Helper to get summary data (handles both admin and coach responses)
  const getSummary = () => {
    // For admin/developer viewing All Teams
    if ((userRole === 'admin' || userRole === 'developer') && adminView === 'allMembers' && allMembersData) {
      return allMembersData.summary || {};
    }
    
    // For admin/developer viewing My Team or regular coach
    if (!teamData) return null;
    return teamData.teamSummary || {};
  };

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-xl border border-gray-100">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <p className="text-gray-800 mb-6 font-medium">{error}</p>
          <button
            onClick={() => loadDisciplineReportCallback()}
            className="w-full py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-colors shadow-lg shadow-green-200"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-20">
      {/* Sticky Header */}
      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-gray-100 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <TouchFeedbackButton
                onClick={onBack}
                className="p-2 -ml-2 hover:bg-gray-50 rounded-full transition-colors"
                ariaLabel="Go back"
              >
                <ArrowLeft className="h-6 w-6 text-gray-700" />
              </TouchFeedbackButton>
              <div>
                <h1 className="text-lg font-bold text-gray-900 leading-tight">
                  {userRole === 'admin' && adminView === 'allMembers' ? 'All Members Report' : 'Discipline Report'}
                </h1>
                <p className="text-xs text-gray-500 font-medium">
                  {getSummary()?.totalMembers || 0} Members •{" "}
                  {new Date(
                    (userRole === 'admin' && adminView === 'allMembers' && allMembersData) 
                      ? allMembersData?.lastUpdated 
                      : teamData?.lastUpdated
                  ).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <TouchFeedbackButton
                onClick={() => loadDisciplineReportCallback(true)}
                disabled={refreshing}
                className="p-2 hover:bg-gray-50 rounded-full transition-colors text-gray-600 disabled:opacity-50"
                ariaLabel="Refresh"
              >
                <RefreshCw
                  className={`h-5 w-5 ${refreshing ? "animate-spin" : ""}`}
                />
              </TouchFeedbackButton>
              <TouchFeedbackButton
                onClick={handleExportCSV}
                className="p-2 hover:bg-gray-50 rounded-full transition-colors text-gray-600"
                ariaLabel="Export CSV"
              >
                <Download className="h-5 w-5" />
              </TouchFeedbackButton>
              {(userRole === "admin" || userRole === "developer") && (
                <TouchFeedbackButton
                  onClick={() => setShowTimeWindowModal(!showTimeWindowModal)}
                  className="p-2 hover:bg-gray-50 rounded-full transition-colors text-gray-600"
                  ariaLabel="Configure Time Windows"
                >
                  <Settings className="h-5 w-5" />
                </TouchFeedbackButton>
              )}
            </div>
          </div>

          {/* Date Range Selector (Pills) */}
          <div
            className="flex gap-2 overflow-x-auto sm:overflow-visible pb-2 scrollbar-hide mt-3 items-center sm:justify-center"
            id="date-range-container"
          >
            {[
              { id: "today", label: "Today" },
              { id: "yesterday", label: "Yesterday" },
              { id: "last7days", label: "Week" },
              { id: "last30days", label: "Month" },
            ].map((range) => (
              <TouchFeedbackButton
                key={range.id}
                id={`date-range-${range.id}`}
                onClick={() => {
                  setDateRange(range.id);
                  setShowDatePicker(false);
                  setCustomStartDate(null);
                  setCustomEndDate(null);
                }}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 ${
                  dateRange === range.id
                    ? "bg-green-600 text-white shadow-md shadow-green-200"
                    : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                }`}
              >
                {range.label}
              </TouchFeedbackButton>
            ))}
            <TouchFeedbackButton
              id="date-range-custom"
              onClick={() => {
                setShowDatePicker(!showDatePicker);
              }}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap flex items-center gap-1.5 flex-shrink-0 ${
                dateRange === "custom"
                  ? "bg-green-600 text-white shadow-md shadow-green-200"
                  : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
              }`}
            >
              <CalendarIcon className="w-4 h-4" />
              <span>Custom</span>
            </TouchFeedbackButton>
          </div>

          {/* Date Range Picker */}
          <AnimatePresence>
            {showDatePicker && (
              <div className="mt-3">
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

      <div className="max-w-3xl mx-auto px-4 py-6 relative z-10">
        {/* Summary Stats - Compact Dashboard Strip */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-4">
          <div className="grid grid-cols-3 divide-x divide-gray-50">
            {/* Average & Posts */}
            <div className="p-3 sm:p-4 flex flex-col items-center justify-between text-center min-h-[110px]">
              <div className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider">
                Avg Score
              </div>
              <div className="flex items-baseline justify-center gap-0.5 my-1">
                <span className="text-xl sm:text-2xl font-bold text-gray-900">
                  {(getSummary()?.averagePeriodDiscipline || getSummary()?.averageDiscipline || 0).toFixed(0)}
                </span>
                <span className="text-xs text-gray-400">%</span>
              </div>
              <div className="text-[10px] sm:text-xs text-green-600 font-medium bg-green-50 px-2 py-0.5 rounded-full">
                {(() => {
                  const allMembers = [...(teamData?.teamMembers || [])];
                  if (teamData?.coachPerformance) {
                    allMembers.push(teamData.coachPerformance);
                  }
                  const totalOnTime = allMembers.reduce(
                    (acc, m) => acc + m.periodDiscipline.onTimePosts,
                    0,
                  );
                  const totalExpected = allMembers.reduce(
                    (acc, m) => acc + m.periodDiscipline.expectedPosts,
                    0,
                  );
                  return Math.round(
                    (totalOnTime / Math.max(1, totalExpected)) * 100,
                  );
                })()}
                % Posts
              </div>
            </div>

            {/* Top Performer (Middle) */}
            <div className="p-3 sm:p-4 flex flex-col items-center justify-between text-center min-h-[110px]">
              <div className="text-[10px] sm:text-xs font-bold text-green-600 uppercase tracking-wider">
                Top Star
              </div>
              {getSummary()?.topPerformer ? (
                <>
                  <div className="flex items-baseline justify-center gap-0.5 my-1">
                    <span className="text-xl sm:text-2xl font-bold text-gray-900">
                      {getSummary().topPerformer.discipline}
                    </span>
                    <span className="text-xs text-gray-400">%</span>
                  </div>
                  <div className="text-[10px] sm:text-xs text-gray-500 font-medium truncate max-w-[90%]">
                    {getSummary().topPerformer.userName.split(" ")[0]}
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-baseline justify-center gap-0.5 my-1">
                    <span className="text-gray-300">-</span>
                  </div>
                  <div className="text-[10px] sm:text-xs text-gray-300">
                    N/A
                  </div>
                </>
              )}
            </div>

            {/* At Risk (Right) */}
            <div className="p-3 sm:p-4 flex flex-col items-center justify-between text-center min-h-[110px]">
              <div className="text-[10px] sm:text-xs font-bold text-red-400 uppercase tracking-wider">
                At Risk
              </div>
              <div className="flex items-baseline justify-center gap-0.5 my-1">
                <span className="text-xl sm:text-2xl font-bold text-red-600">
                  {getSummary()?.needsAttention?.length || 0}
                </span>
              </div>
              <div className="text-[10px] sm:text-xs text-gray-400 font-medium">
                of {getSummary()?.totalMembers || 0} Members
              </div>
            </div>
          </div>

          {/* Team Avg Progress Bar */}
          <div className="h-1 w-full bg-gray-50">
            <div
              className="h-full bg-green-500 transition-all duration-500"
              style={{
                width: `${getSummary()?.averagePeriodDiscipline || getSummary()?.averageDiscipline || 0}%`,
              }}
            />
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex gap-3 items-center z-30 relative mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search members..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-green-500 focus:bg-white transition-all"
            />
          </div>

          {/* Custom Filter Dropdown */}
          <div className="relative" ref={filterRef}>
            <button
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                disciplineFilter !== "all"
                  ? "bg-green-100 text-green-800"
                  : "bg-gray-50 text-gray-700 hover:bg-gray-100"
              }`}
            >
              <Filter className="h-4 w-4" />
              <span>
                {disciplineFilter === "all"
                  ? "Filter"
                  : filterOptions
                      .find((o) => o.id === disciplineFilter)
                      ?.label.split(" ")[0]}
              </span>
              <ChevronDown
                className={`h-3 w-3 transition-transform ${
                  isFilterOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            <AnimatePresence>
              {isFilterOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.1 }}
                  className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50"
                >
                  <div className="py-1">
                    {filterOptions.map((option) => (
                      <button
                        key={option.id}
                        onClick={() => {
                          setDisciplineFilter(option.id);
                          setIsFilterOpen(false);
                        }}
                        className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 flex items-center justify-between group"
                      >
                        <span className={`${option.color} font-medium`}>
                          {option.label}
                        </span>
                        {disciplineFilter === option.id && (
                          <Check className="h-4 w-4 text-green-600" />
                        )}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Sort Button */}
          <TouchFeedbackButton
            onClick={() => setSortOrder(sortOrder === "desc" ? "asc" : "desc")}
            className="p-3 rounded-xl bg-gray-50 text-gray-700 hover:bg-gray-100 transition-colors"
            ariaLabel={sortOrder === "desc" ? "Highest First" : "Lowest First"}
          >
            {sortOrder === "desc" ? (
              <ArrowDown className="h-4 w-4" />
            ) : (
              <ArrowUp className="h-4 w-4" />
            )}
          </TouchFeedbackButton>
        </div>

        {/* Admin View Tabs - My Team vs All Teams */}
        {(userRole === 'admin' || userRole === 'developer') && (
          <div className="mb-4 flex gap-2">
            <TouchFeedbackButton
              onClick={() => setAdminView('allMembers')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                adminView === 'allMembers'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              All Teams
            </TouchFeedbackButton>
            <TouchFeedbackButton
              onClick={() => setAdminView('myTeam')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                adminView === 'myTeam'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              My Team ({teamData?.teamSummary?.totalMembers || 0})
            </TouchFeedbackButton>
          </div>
        )}

        {/* Member List */}
        <div className="space-y-3">
          <AnimatePresence>
            {filteredAndSortedMembers.map((member) => (
              <motion.div
                key={member.userId}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                layout
                className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow"
              >
                {/* Card Header / Main Info */}
                <div
                  onClick={() =>
                    setExpandedMemberId(
                      expandedMemberId === member.userId ? null : member.userId,
                    )
                  }
                  className="p-4 flex items-center justify-between cursor-pointer active:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {/* Avatar / Initials */}
                    <div
                      className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-sm font-bold border-2 ${getScoreColor(
                        member.periodDiscipline?.percentage || 0,
                      ).replace("bg-", "bg-opacity-10 bg-")}`}
                    >
                      {member.userName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-gray-900 text-sm sm:text-[15px]">
                          {member.userName}
                        </h3>
                        {member.isLoggedInCoach && (
                          <span className="text-[9px] sm:text-[10px] bg-green-50 text-green-700 border border-green-200 px-1.5 py-0.5 rounded font-bold tracking-wide">
                            YOU
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] sm:text-xs text-gray-500 mt-0.5">
                        {member.email}
                      </p>

                      {/* Coach Badge - Don't show for logged-in coach */}
                      {!member.isLoggedInCoach && member.uplineCoachName && (
                        <p className="text-[11px] text-gray-400 mt-1">
                          Coach:{" "}
                          <span className="text-gray-600 font-medium">
                            {member.uplineCoachName}
                            {member.uplineCoachId === user.id ? " (You)" : ""}
                          </span>
                        </p>
                      )}

                      {member.isLoggedInCoach && (
                        <p className="text-[11px] text-green-600 font-medium mt-1.5 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                          My Performance
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 sm:gap-4">
                    <div className="text-right">
                      <div
                        className={`text-lg sm:text-xl font-bold ${getScoreColorText(
                          member.periodDiscipline?.percentage || 0,
                        )}`}
                      >
                        {member.periodDiscipline?.percentage ?? 0}%
                      </div>
                      <div className="text-[9px] sm:text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                        Score
                      </div>
                    </div>
                    {expandedMemberId === member.userId ? (
                      <ChevronUp className="h-4 w-4 sm:h-5 sm:w-5 text-gray-300" />
                    ) : (
                      <ChevronDown className="h-4 w-4 sm:h-5 sm:w-5 text-gray-300" />
                    )}
                  </div>
                </div>

                {/* Expanded Details */}
                <AnimatePresence>
                  {expandedMemberId === member.userId && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-gray-50 bg-gray-50/30"
                    >
                      <div className="p-4 grid grid-cols-3 sm:grid-cols-5 gap-3 sm:gap-2">
                        {[
                          "weight",
                          "education",
                          "breakfast",
                          "lunch",
                          "dinner",
                        ].map((activityKey) => {
                          const activity = member.activities?.[activityKey] || { percentage: 0 };
                          const percentage = activity.percentage ?? 0;
                          return (
                            <div
                              key={activityKey}
                              className="flex flex-col items-center gap-2"
                            >
                              <div
                                className={`w-10 h-10 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shadow-sm border ${
                                  percentage >= 80
                                    ? "bg-green-50 border-green-200 text-green-700"
                                    : percentage >= 60
                                    ? "bg-yellow-50 border-yellow-200 text-yellow-700"
                                    : "bg-red-50 border-red-200 text-red-700"
                                }`}
                              >
                                {activityIcons[activityKey]}
                              </div>
                              <span className="text-[9px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-wide">
                                {activityKey.slice(0, 3)}
                              </span>
                              <span
                                className={`text-xs sm:text-xs font-bold ${getScoreColorText(
                                  percentage,
                                )}`}
                              >
                                {percentage}%
                              </span>
                            </div>
                          );
                        })}  
                      </div>
                      <div className="px-4 pb-4 pt-0 text-center">
                        <p className="text-[11px] sm:text-xs text-gray-400 font-medium">
                          {member.periodDiscipline?.onTimePosts ?? 0} on-time posts
                          out of {member.periodDiscipline?.expectedPosts ?? 0}{" "}
                          expected
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </AnimatePresence>

          {filteredAndSortedMembers.length === 0 && (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="h-8 w-8 text-gray-300" />
              </div>
              <h3 className="text-gray-900 font-medium">No members found</h3>
              <p className="text-gray-500 text-sm mt-1">
                Try adjusting your search or filters
              </p>
            </div>
          )}
        </div>

        {/* Time Window Settings Modal - Admin Only */}
        <TimeWindowSettingsModal
          isOpen={showTimeWindowModal}
          onClose={() => setShowTimeWindowModal(false)}
          onUpdate={loadDisciplineReportCallback}
          userEmail={user?.email}
        />
      </div>
    </div>
  );
};

export default DisciplineReport;
