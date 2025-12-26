// src/components/DisciplineReport.js
import React, { useState, useEffect, useRef } from 'react';
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
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { disciplineReportService } from '../services/disciplineReportService';
// Removed LoadingSpinner import as we are using custom skeleton

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
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-8 w-24 bg-gray-50 rounded-full shrink-0 animate-pulse border border-gray-100"></div>
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
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center justify-between animate-pulse">
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
const DisciplineReport = ({ user, onBack }) => {
  const [teamData, setTeamData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dateRange, setDateRange] = useState('last7days');
  const [searchQuery, setSearchQuery] = useState('');
  const [disciplineFilter, setDisciplineFilter] = useState('all');
  const [expandedMemberId, setExpandedMemberId] = useState(null);
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

  // Load discipline report
  useEffect(() => {
    if (user?.id) {
      loadDisciplineReport();
    } else {
      setLoading(false);
      setError('User ID not found. Please login again.');
    }
  }, [user?.id, dateRange]);

  async function loadDisciplineReport() {
    setLoading(true);
    setError(null);
    try {
      const data = await disciplineReportService.getDisciplineReport(user.id, dateRange);
      setTeamData(data);
    } catch (err) {
      console.error('Failed to load discipline report:', err);
      setError(`Failed to load report: ${err.response?.data?.message || err.message}`);
    } finally {
      setLoading(false);
    }
  }

  function handleExportCSV() {
    if (teamData) {
      disciplineReportService.exportToCSV(teamData, dateRange);
    }
  }

  // Helper to get color based on percentage
  const getScoreColor = (score) => {
    if (score >= 80) return 'text-green-700 bg-green-50 border-green-200';
    if (score >= 60) return 'text-yellow-700 bg-yellow-50 border-yellow-200';
    return 'text-red-700 bg-red-50 border-red-200';
  };

  const getScoreColorText = (score) => {
    if (score >= 80) return 'text-green-700';
    if (score >= 60) return 'text-yellow-700';
    return 'text-red-700';
  };

  // Filter team members
  const filteredMembers = teamData?.teamMembers.filter(member => {
    const matchesSearch = member.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.email.toLowerCase().includes(searchQuery.toLowerCase());
    
    const discipline = member.periodDiscipline.percentage;
    let matchesDiscipline = true;
    if (disciplineFilter === 'high') matchesDiscipline = discipline >= 80;
    if (disciplineFilter === 'medium') matchesDiscipline = discipline >= 60 && discipline < 80;
    if (disciplineFilter === 'low') matchesDiscipline = discipline < 60;

    return matchesSearch && matchesDiscipline;
  }) || [];

  // Activity Icons Map
  const activityIcons = {
    weight: <Scale className="w-4 h-4" />,
    education: <BookOpen className="w-4 h-4" />,
    breakfast: <Coffee className="w-4 h-4" />,
    lunch: <Utensils className="w-4 h-4" />,
    dinner: <Moon className="w-4 h-4" />
  };

  const filterOptions = [
    { id: 'all', label: 'All Scores', color: 'text-gray-700' },
    { id: 'high', label: 'High (80%+)', color: 'text-green-700' },
    { id: 'medium', label: 'Medium (60-79%)', color: 'text-yellow-700' },
    { id: 'low', label: 'Low (<60%)', color: 'text-red-700' }
  ];

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
            onClick={loadDisciplineReport}
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
              <button
                onClick={onBack}
                className="p-2 -ml-2 hover:bg-gray-50 rounded-full transition-colors"
              >
                <ArrowLeft className="h-6 w-6 text-gray-700" />
              </button>
              <div>
                <h1 className="text-lg font-bold text-gray-900 leading-tight">
                  Discipline Report
                </h1>
                <p className="text-xs text-gray-500 font-medium">
                  {teamData?.teamSummary.totalMembers} Members • {new Date(teamData?.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={loadDisciplineReport}
                className="p-2 hover:bg-gray-50 rounded-full transition-colors text-gray-600"
              >
                <RefreshCw className="h-5 w-5" />
              </button>
              <button
                onClick={handleExportCSV}
                className="p-2 hover:bg-gray-50 rounded-full transition-colors text-gray-600"
              >
                <Download className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Date Range Selector (Scrollable Pills) */}
          <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {[
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: 'last7days', label: 'Last 7 Days' },
              { id: 'last30days', label: 'Last 30 Days' }
            ].map((range) => (
              <button
                key={range.id}
                onClick={() => setDateRange(range.id)}
                className={`whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-medium transition-all border ${
                  dateRange === range.id
                    ? 'bg-green-600 text-white border-green-600 shadow-md shadow-green-100'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 relative z-10 space-y-6">
        {/* Summary Stats - Compact Dashboard Strip */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="grid grid-cols-3 divide-x divide-gray-50">
            {/* Average & Posts */}
            <div className="p-4 flex flex-col items-center justify-center text-center">
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Avg Score</div>
              <div className="flex items-baseline gap-0.5">
                <span className="text-2xl font-bold text-gray-900">
                  {teamData?.teamSummary.averagePeriodDiscipline.toFixed(0)}
                </span>
                <span className="text-xs text-gray-400">%</span>
              </div>
              <div className="text-[10px] text-green-600 font-medium mt-1 bg-green-50 px-2 py-0.5 rounded-full">
                {Math.round((teamData?.teamMembers.reduce((acc, m) => acc + m.periodDiscipline.onTimePosts, 0) / Math.max(1, teamData?.teamMembers.reduce((acc, m) => acc + m.periodDiscipline.expectedPosts, 0))) * 100)}% Posts
              </div>
            </div>

            {/* Top Performer (Middle) */}
            <div className="p-4 flex flex-col items-center justify-center text-center">
              <div className="text-[10px] font-bold text-green-600 uppercase tracking-wider mb-1">Top Star</div>
              {teamData?.teamSummary.topPerformer ? (
                <>
                  <div className="flex items-baseline gap-0.5">
                    <span className="text-2xl font-bold text-gray-900">
                      {teamData.teamSummary.topPerformer.discipline}
                    </span>
                    <span className="text-xs text-gray-400">%</span>
                  </div>
                  <div className="text-xs text-gray-500 font-medium truncate w-full px-1 mt-1">
                    {teamData.teamSummary.topPerformer.userName.split(' ')[0]}
                  </div>
                </>
              ) : (
                <span className="text-gray-300">-</span>
              )}
            </div>

            {/* At Risk (Right) */}
            <div className="p-4 flex flex-col items-center justify-center text-center">
              <div className="text-[10px] font-bold text-red-400 uppercase tracking-wider mb-1">At Risk</div>
              <div className="flex items-baseline gap-0.5">
                <span className="text-2xl font-bold text-red-600">
                  {teamData?.teamSummary.needsAttention.length}
                </span>
              </div>
              <div className="text-[10px] text-gray-400 font-medium mt-1">
                of {teamData?.teamSummary.totalMembers} Members
              </div>
            </div>
          </div>
          
          {/* Team Avg Progress Bar */}
          <div className="h-1 w-full bg-gray-50">
            <div 
               className="h-full bg-green-500 transition-all duration-500"
               style={{ width: `${teamData?.teamSummary.averagePeriodDiscipline}%` }}
            />
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex gap-3 items-center z-30 relative">
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
                disciplineFilter !== 'all' 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Filter className="h-4 w-4" />
              <span>{disciplineFilter === 'all' ? 'Filter' : filterOptions.find(o => o.id === disciplineFilter)?.label.split(' ')[0]}</span>
              <ChevronDown className={`h-3 w-3 transition-transform ${isFilterOpen ? 'rotate-180' : ''}`} />
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
                        <span className={`${option.color} font-medium`}>{option.label}</span>
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
        </div>

        {/* Member List */}
        <div className="space-y-3">
          <AnimatePresence>
            {filteredMembers.map((member) => (
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
                  onClick={() => setExpandedMemberId(expandedMemberId === member.userId ? null : member.userId)}
                  className="p-4 flex items-center justify-between cursor-pointer active:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {/* Avatar / Initials */}
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold border-2 ${getScoreColor(member.periodDiscipline.percentage).replace('bg-', 'bg-opacity-10 bg-')}`}>
                      {member.userName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 text-base">{member.userName}</h3>
                      <p className="text-xs text-gray-500">{member.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className={`text-xl font-bold ${getScoreColorText(member.periodDiscipline.percentage)}`}>
                        {member.periodDiscipline.percentage}%
                      </div>
                      <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                        Score
                      </div>
                    </div>
                    {expandedMemberId === member.userId ? (
                      <ChevronUp className="h-5 w-5 text-gray-300" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-gray-300" />
                    )}
                  </div>
                </div>

                {/* Expanded Details */}
                <AnimatePresence>
                  {expandedMemberId === member.userId && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-gray-50 bg-gray-50/30"
                    >
                      <div className="p-4 grid grid-cols-5 gap-2">
                        {['weight', 'education', 'breakfast', 'lunch', 'dinner'].map((activityKey) => {
                          const activity = member.activities[activityKey];
                          return (
                            <div key={activityKey} className="flex flex-col items-center gap-2">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm border ${
                                activity.percentage >= 80 ? 'bg-green-50 border-green-200 text-green-700' :
                                activity.percentage >= 60 ? 'bg-yellow-50 border-yellow-200 text-yellow-700' :
                                'bg-red-50 border-red-200 text-red-700'
                              }`}>
                                {activityIcons[activityKey]}
                              </div>
                              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">
                                {activityKey.slice(0, 3)}
                              </span>
                              <span className={`text-xs font-bold ${getScoreColorText(activity.percentage)}`}>
                                {activity.percentage}%
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      <div className="px-4 pb-4 pt-0 text-center">
                        <p className="text-xs text-gray-400 font-medium">
                          {member.periodDiscipline.onTimePosts} on-time posts out of {member.periodDiscipline.expectedPosts} expected
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </AnimatePresence>

          {filteredMembers.length === 0 && (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="h-8 w-8 text-gray-300" />
              </div>
              <h3 className="text-gray-900 font-medium">No members found</h3>
              <p className="text-gray-500 text-sm mt-1">Try adjusting your search or filters</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DisciplineReport;
