import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  RefreshCw,
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
              <div className="relative flex-shrink-0">
                <input
                  type="date"
                  max={formatDate(new Date())}
                  value={dateFilter === 'custom' && customDate ? formatDate(customDate) : ''}
                  onChange={(e) => {
                    if (e.target.value) {
                      const [year, month, day] = e.target.value.split('-').map(Number);
                      const selected = new Date(year, month - 1, day);
                      setCustomDate(selected);
                      setDateFilter('custom');
                    }
                  }}
                  className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 border-2 cursor-pointer bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-green-500 focus:outline-none focus:border-green-500"
                  style={{ minWidth: '140px' }}
                />
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
        ) : hierarchyData ? (
          <>
            {/* Team Club Ownership Hierarchy */}
            {hierarchyData && (
              <div className="bg-white rounded-lg shadow-md p-4">
                <h3 className="text-lg font-bold text-gray-800 mb-4">
                  Team Club Ownership
                </h3>
                
                {/* Statistics Cards */}
                <div className="mb-4 grid grid-cols-3 gap-2">
                  {/* Self Stats */}
                  <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-lg p-3 border-2 border-yellow-300 shadow-md">
                    <div className="flex items-center gap-1 mb-2">
                      <div className="w-6 h-6 rounded-full bg-yellow-400 flex items-center justify-center text-xs font-bold text-white">
                        {hierarchyData.userName?.charAt(0).toUpperCase() || 'Y'}
                      </div>
                      <p className="text-xs text-yellow-800 font-bold">Self</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <span className="text-2xl font-bold text-yellow-700">1</span>
                        <Users className="h-4 w-4 text-yellow-600" />
                        <span className="text-lg font-bold text-yellow-600">/</span>
                        <span className="text-2xl font-bold text-yellow-700">{hierarchyData.metrics?.totalClubs || 0}</span>
                        <Building2 className="h-5 w-5 text-yellow-600" />
                      </div>
                    </div>
                    <p className="text-[10px] text-yellow-700 font-medium mt-1">owner/clubs</p>
                  </div>
                  
                  {/* Direct Team Stats */}
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-3 border-2 border-blue-300 shadow-md">
                    <p className="text-xs text-blue-700 font-bold mb-2">Direct Team</p>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <span className="text-2xl font-bold text-blue-700">{hierarchyData.directTeamCount?.qualified || 0}</span>
                        <span className="text-lg text-blue-600">/</span>
                        <span className="text-xl font-semibold text-blue-600">{hierarchyData.directTeamCount?.total || 0}</span>
                        <Users className="h-4 w-4 text-blue-600" />
                      </div>
                    </div>
                    <p className="text-[10px] text-blue-700 font-medium mt-1">
                      {hierarchyData.directTeamCount?.totalClubs || 0} clubs owned
                    </p>
                  </div>
                  
                  {/* Full Team Stats */}
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-3 border-2 border-green-300 shadow-md">
                    <p className="text-xs text-green-700 font-bold mb-2">Full Team</p>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <span className="text-2xl font-bold text-green-700">{hierarchyData.fullTeamCount?.qualified || 0}</span>
                        <span className="text-lg text-green-600">/</span>
                        <span className="text-xl font-semibold text-green-600">{hierarchyData.fullTeamCount?.total || 0}</span>
                        <Users className="h-4 w-4 text-green-600" />
                      </div>
                    </div>
                    <p className="text-[10px] text-green-700 font-medium mt-1">
                      {hierarchyData.fullTeamCount?.totalClubs || 0} clubs owned
                    </p>
                  </div>
                </div>
                
                <ClubOwnershipHierarchy hierarchy={hierarchyData} date={getTargetDate()} />
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
};

// Club Ownership Hierarchy View Component
const ClubOwnershipHierarchy = ({ hierarchy, date }) => {
  return (
    <div className="space-y-3">
      <ClubOwnershipNode
        node={hierarchy}
        level={0}
        isLastChild={true}
        date={date}
      />
    </div>
  );
};

// Individual Node Component
const ClubOwnershipNode = ({
  node,
  level,
  isLastChild,
  date,
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const hasChildren = node.teamMembers && node.teamMembers.length > 0;
  
  // Access clubs from node.metrics
  const clubs = node.metrics?.clubs || [];
  const hasClubs = clubs.length > 0;
  const totalParticipants = hasClubs 
    ? clubs.reduce((sum, club) => sum + (club.totalParticipants || 0), 0)
    : 0;

  return (
    <div className="relative flex">
      {/* Tree Lines */}
      {level > 0 && (
        <div className="relative flex-shrink-0" style={{ width: '32px' }}>
          <div
            className="absolute top-[24px] left-0 h-[2px] bg-gray-300"
            style={{ width: '32px' }}
          />
          {!isLastChild && (
            <div
              className="absolute left-0 top-0 w-[2px] bg-gray-300"
              style={{ height: 'calc(100% + 12px)' }}
            />
          )}
          {isLastChild && (
            <div
              className="absolute left-0 top-0 w-[2px] bg-gray-300"
              style={{ height: '24px' }}
            />
          )}
        </div>
      )}

      {/* Node Content */}
      <div className="flex-1 mb-3 overflow-hidden">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`rounded-lg shadow-md border-2 overflow-hidden transition-all duration-200 ${
            level === 0 && hasClubs
              ? 'bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-400 hover:shadow-lg'
              : hasClubs
              ? 'bg-white border-green-300 hover:shadow-lg'
              : 'bg-gray-50 border-gray-300'
          }`}
        >
          {/* Header */}
          <div
            className="flex items-center gap-2 p-2.5 cursor-pointer active:bg-opacity-80"
            onClick={() => setShowDetails(!showDetails)}
          >
            {/* Avatar */}
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 shadow-sm flex-shrink-0 ${
                level === 0 && hasClubs
                  ? 'bg-yellow-400 border-yellow-500 text-white'
                  : hasClubs
                  ? 'bg-green-50 border-green-400 text-green-700'
                  : 'bg-gray-200 border-gray-400 text-gray-500'
              }`}
            >
              {node.userName.charAt(0).toUpperCase()}
            </div>

            {/* User Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1 flex-wrap">
                <h4 className={`font-bold text-sm truncate ${
                  level === 0 && hasClubs ? 'text-yellow-900' :
                  hasClubs ? 'text-gray-900' : 'text-gray-500'
                }`}>
                  {node.userName}
                </h4>
                {level === 0 && (
                  <span className="text-[9px] bg-yellow-300 text-yellow-900 border border-yellow-400 px-1.5 py-0.5 rounded-full font-bold uppercase shadow-sm">
                    YOU
                  </span>
                )}
              </div>
              {/* Team Statistics */}
              <div className="flex items-center gap-2 text-[10px] mt-0.5 flex-wrap">
                {node.teamMembers && node.teamMembers.length > 0 && (
                  <span className="text-gray-600">
                    {node.teamMembers.length} team
                  </span>
                )}
                {/* Self - Own Clubs */}
                <span className={`font-semibold px-1.5 py-0.5 rounded flex items-center gap-0.5 ${
                  hasClubs
                    ? level === 0
                      ? 'text-yellow-700 bg-yellow-100 border border-yellow-300'
                      : 'text-green-700 bg-green-100 border border-green-300'
                    : 'text-gray-500 bg-gray-100 border border-gray-300'
                }`}>
                  Self: {hasClubs ? 1 : 0}<Users className="h-3 w-3 inline" />/{hasClubs ? clubs.length : 0}<Building2 className="h-3 w-3 inline" />
                </span>
                {/* Direct Team */}
                <span className={`font-semibold px-1.5 py-0.5 rounded flex items-center gap-0.5 ${
                  level === 0
                    ? 'text-blue-700 bg-blue-100 border border-blue-300'
                    : 'text-blue-600 bg-blue-50 border border-blue-200'
                }`}>
                  Direct: {node.directTeamCount?.qualified || 0}/{node.directTeamCount?.total || 0}<Users className="h-3 w-3 inline" /> ({node.directTeamCount?.totalClubs || 0}<Building2 className="h-3 w-3 inline" />)
                </span>
                {/* Full Team */}
                <span className={`font-semibold px-1.5 py-0.5 rounded flex items-center gap-0.5 ${
                  level === 0
                    ? 'text-orange-700 bg-orange-100 border border-orange-300'
                    : 'text-green-600 bg-green-50 border border-green-200'
                }`}>
                  Full: {node.fullTeamCount?.qualified || 0}/{node.fullTeamCount?.total || 0}<Users className="h-3 w-3 inline" /> ({node.fullTeamCount?.totalClubs || 0}<Building2 className="h-3 w-3 inline" />)
                </span>
              </div>
            </div>

            {/* Club Stats */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {hasClubs ? (
                <>
                  <div className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full border shadow-sm ${
                    level === 0
                      ? 'bg-yellow-100 text-yellow-800 border-yellow-400'
                      : 'bg-green-100 text-green-700 border-green-300'
                  }`}>
                    <Building2 className="h-4 w-4" />
                    <span className="text-sm font-bold">{clubs.length}</span>
                  </div>
                  {showDetails ? (
                    <ChevronUp className={`h-4 w-4 ${
                      level === 0 ? 'text-yellow-600' : 'text-gray-400'
                    }`} />
                  ) : (
                    <ChevronDown className={`h-4 w-4 ${
                      level === 0 ? 'text-yellow-600' : 'text-gray-400'
                    }`} />
                  )}
                </>
              ) : (
                <div className="text-xs text-gray-400 font-medium px-2">No clubs</div>
              )}
            </div>
          </div>

          {/* Expanded Details - Show Clubs */}
          <AnimatePresence>
            {showDetails && hasClubs && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className={`border-t ${
                  level === 0
                    ? 'border-yellow-200 bg-gradient-to-r from-yellow-50 to-orange-50'
                    : 'border-gray-200 bg-gradient-to-r from-green-50 to-blue-50'
                }`}
              >
                <div className="p-3 space-y-2">
                  <p className={`text-xs font-semibold mb-2 ${
                    level === 0 ? 'text-yellow-800' : 'text-gray-700'
                  }`}>
                    Clubs Owned:
                  </p>
                  {clubs.map((club, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between bg-white rounded-lg p-2.5 border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Building2 className={`h-4 w-4 flex-shrink-0 ${
                          level === 0 ? 'text-yellow-600' : 'text-green-600'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">
                            {club.name}
                          </p>
                          {club.location && (
                            <p className="text-[10px] text-gray-500 truncate">
                              {club.location}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <div className="bg-blue-100 text-blue-700 px-2.5 py-1.5 rounded-lg border border-blue-200">
                          <div className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            <span className="text-sm font-bold">
                              {club.todayAttendance || 0}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Children */}
        <AnimatePresence>
          {hasChildren && (
            <motion.div
              initial={{ opacity: 1 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mt-3 ml-0 pl-0"
            >
              {node.teamMembers.map((child, index) => (
                <ClubOwnershipNode
                  key={child.userId}
                  node={child}
                  level={level + 1}
                  isLastChild={index === node.teamMembers.length - 1}
                  date={date}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default ClubAttendanceReport;
