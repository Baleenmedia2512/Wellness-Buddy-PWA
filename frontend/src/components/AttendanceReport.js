import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  RefreshCw,
  Calendar,
  Users,
  MapPin,
  Home,
  TrendingUp,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import TouchFeedbackButton from './TouchFeedbackButton';
import LoadingSpinner from './LoadingSpinner';

const AttendanceReport = ({ user, onBack }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [dateFilter, setDateFilter] = useState('today'); // today, yesterday, last-week, last-month, so-far
  const [expandedNodes, setExpandedNodes] = useState(new Set());

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
        `${apiBaseUrl}/api/coach/attendance-report?userId=${userId}&startDate=${start}&endDate=${end}`,
        {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
          },
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to fetch attendance report');
      }

      setReportData(result.data);
      
      // Auto-expand logged-in coach
      const loggedInCoach = result.data.members.find(m => m.isLoggedInCoach);
      if (loggedInCoach) {
        setExpandedNodes(new Set([loggedInCoach.userId]));
      }
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

  // Build hierarchical structure
  const buildHierarchy = (members) => {
    const memberMap = {};
    members.forEach(m => {
      memberMap[m.userId] = { ...m, teamMembers: [] };
    });

    const rootNodes = [];
    members.forEach(m => {
      if (m.uplineCoachId && memberMap[m.uplineCoachId]) {
        memberMap[m.uplineCoachId].teamMembers.push(memberMap[m.userId]);
      } else {
        rootNodes.push(memberMap[m.userId]);
      }
    });

    return rootNodes;
  };

  const toggleNode = (userId) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(userId)) {
      newExpanded.delete(userId);
    } else {
      newExpanded.add(userId);
    }
    setExpandedNodes(newExpanded);
  };

  // Render hierarchical team node
  const TeamNode = ({ node, level = 0, isLastChild = false }) => {
    const isExpanded = expandedNodes.has(node.userId);
    const hasChildren = node.teamMembers && node.teamMembers.length > 0;

    const getScoreColor = (percentage) => {
      if (percentage >= 80) return 'bg-green-50 border-green-300 text-green-700';
      if (percentage >= 60) return 'bg-yellow-50 border-yellow-300 text-yellow-700';
      return 'bg-red-50 border-red-300 text-red-700';
    };

    return (
      <div className="relative flex">
        {/* Tree Connector Lines */}
        {level > 0 && (
          <div className="relative flex-shrink-0" style={{ width: '32px' }}>
            <div
              className="absolute top-[32px] sm:top-[40px] left-0 h-[3px] bg-gray-600"
              style={{ width: '32px' }}
            />
            {!isLastChild && (
              <div
                className="absolute left-0 top-0 w-[3px] bg-gray-600"
                style={{ height: 'calc(100% + 12px)' }}
              />
            )}
            {isLastChild && (
              <div
                className="absolute left-0 top-0 w-[3px] bg-gray-600"
                style={{ height: '32px' }}
              />
            )}
          </div>
        )}

        {/* Node Content */}
        <div className="flex-1 mb-3">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-lg shadow-md border-2 border-gray-100 overflow-hidden hover:shadow-lg hover:border-blue-200 transition-all"
          >
            {/* Card Header */}
            <div className="flex items-center gap-3 p-3">
              {/* Avatar */}
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold border-2 shadow-sm flex-shrink-0 ${getScoreColor(
                  node.attendancePercentage
                )}`}
              >
                {node.userName.charAt(0).toUpperCase()}
              </div>

              {/* User Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-gray-900 text-sm truncate">
                    {node.userName}
                  </h3>
                  {node.isLoggedInCoach && (
                    <span className="text-[10px] bg-blue-100 text-blue-700 border border-blue-300 px-2 py-0.5 rounded-full font-bold">
                      YOU
                    </span>
                  )}
                  {node.role === 'coach' && level === 0 && (
                    <span className="text-[10px] bg-purple-100 text-purple-700 border border-purple-300 px-2 py-0.5 rounded-full font-bold">
                      COACH
                    </span>
                  )}
                </div>

                {/* Attendance Stats */}
                <div className="mt-1 flex gap-3 text-xs text-gray-600">
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    <span className="font-medium">{node.clubAttendance} club</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Home className="h-3 w-3" />
                    <span>{node.remoteAttendance} remote</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    <span className="font-bold">{node.attendancePercentage}%</span>
                  </div>
                </div>
              </div>

              {/* Expand/Collapse Button */}
              {hasChildren && (
                <TouchFeedbackButton
                  onClick={() => toggleNode(node.userId)}
                  className="p-2 hover:bg-gray-100 rounded-lg flex-shrink-0"
                >
                  {isExpanded ? (
                    <ChevronUp className="h-5 w-5 text-gray-600" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-gray-600" />
                  )}
                </TouchFeedbackButton>
              )}
            </div>

            {/* Team Summary (for coaches) */}
            {hasChildren && (
              <div className="px-3 pb-3 border-t border-gray-100">
                <div className="flex items-center gap-2 text-xs text-gray-600 mt-2">
                  <Users className="h-4 w-4" />
                  <span className="font-medium">
                    Direct Team: {node.teamMembers.length} members
                  </span>
                </div>
              </div>
            )}
          </motion.div>

          {/* Children */}
          <AnimatePresence>
            {hasChildren && isExpanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="ml-8 mt-2"
              >
                {node.teamMembers.map((child, index) => (
                  <TeamNode
                    key={child.userId}
                    node={child}
                    level={level + 1}
                    isLastChild={index === node.teamMembers.length - 1}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-green-50 to-blue-50 z-50 overflow-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white shadow-md">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <TouchFeedbackButton
              onClick={onBack}
              className="p-2 hover:bg-gray-100 rounded-full"
              ariaLabel="Go back"
            >
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </TouchFeedbackButton>
            <div>
              <h1 className="text-xl font-bold text-gray-800">Attendance Report</h1>
              <p className="text-xs text-gray-500">Club vs Remote attendance</p>
            </div>
          </div>
          <TouchFeedbackButton
            onClick={fetchReport}
            disabled={loading}
            className="p-2 hover:bg-gray-100 rounded-full disabled:opacity-50"
            ariaLabel="Refresh"
          >
            <RefreshCw className={`h-5 w-5 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
          </TouchFeedbackButton>
        </div>

        {/* Date Filter */}
        <div className="max-w-4xl mx-auto px-4 pb-3">
          <div className="flex gap-2 overflow-x-auto">
            {[
              { value: 'today', label: 'Today' },
              { value: 'yesterday', label: 'Yesterday' },
              { value: 'last-week', label: 'Last Week' },
              { value: 'last-month', label: 'Last Month' },
              { value: 'so-far', label: 'So Far' },
            ].map((filter) => (
              <TouchFeedbackButton
                key={filter.value}
                onClick={() => setDateFilter(filter.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  dateFilter === filter.value
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
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
                    ? `${reportData.dateRange.start}`
                    : `${reportData.dateRange.start} to ${reportData.dateRange.end}`}
                </h2>
              </div>
              <div className="grid grid-cols-2 gap-4 text-center">
                <div className="bg-blue-50 rounded-lg p-3">
                  <p className="text-2xl font-bold text-blue-600">{reportData.teamSize}</p>
                  <p className="text-xs text-gray-600">Team Members</p>
                </div>
                <div className="bg-green-50 rounded-lg p-3">
                  <p className="text-2xl font-bold text-green-600">
                    {Math.round(
                      reportData.members.reduce((sum, m) => sum + m.attendancePercentage, 0) /
                        reportData.members.length
                    )}
                    %
                  </p>
                  <p className="text-xs text-gray-600">Avg Attendance</p>
                </div>
              </div>
            </div>

            {/* Hierarchical Team View */}
            <div className="space-y-2">
              {buildHierarchy(reportData.members).map((node) => (
                <TeamNode key={node.userId} node={node} />
              ))}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
};

export default AttendanceReport;
