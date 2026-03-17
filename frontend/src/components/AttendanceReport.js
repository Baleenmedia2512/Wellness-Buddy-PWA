import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  RefreshCw,
  Calendar,
  MapPin,
  Wifi,
  XCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import TouchFeedbackButton from './TouchFeedbackButton';
import LoadingSpinner from './LoadingSpinner';

const AttendanceReport = ({ user, onBack }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hierarchyData, setHierarchyData] = useState(null);
  const [dateFilter, setDateFilter] = useState('today');
  const [customDate, setCustomDate] = useState(null);

  const apiBaseUrl = process.env.REACT_APP_API_BASE_URL;

  const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getTargetDate = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (dateFilter === 'yesterday') {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return formatDate(yesterday);
    }
    if (dateFilter === 'custom') {
      return customDate ? formatDate(customDate) : formatDate(today);
    }
    return formatDate(today);
  };

  const getDisplayDate = () => {
    if (dateFilter === 'today') return 'Today';
    if (dateFilter === 'yesterday') return 'Yesterday';
    return getTargetDate();
  };

  const getUserId = async (email) => {
    const response = await fetch(
      `${apiBaseUrl}/api/lookup-user-id?email=${encodeURIComponent(email)}`
    );
    const data = await response.json();
    if (!data.success) throw new Error('User not found');
    return data.userId;
  };

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
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
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, dateFilter, customDate]);

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-50 to-green-50 z-50 overflow-auto">
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
                <h1 className="text-base sm:text-lg font-bold text-gray-800">
                  Attendance Report
                </h1>
                <p className="text-[10px] sm:text-xs text-gray-500">
                  Team education attendance hierarchy
                </p>
              </div>
            </div>
            <TouchFeedbackButton
              onClick={fetchData}
              disabled={loading}
              className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-full disabled:opacity-50"
              ariaLabel="Refresh"
            >
              <RefreshCw
                className={`h-4 w-4 sm:h-5 sm:w-5 text-gray-600 ${loading ? 'animate-spin' : ''}`}
              />
            </TouchFeedbackButton>
          </div>

          {/* Date Filter */}
          <div className="mt-2 sm:mt-3">
            <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-1 scrollbar-hide items-center">
              {[
                { value: 'today', label: 'Today' },
                { value: 'yesterday', label: 'Yesterday' },
              ].map((filter) => (
                <TouchFeedbackButton
                  key={filter.value}
                  onClick={() => setDateFilter(filter.value)}
                  className={`px-3 sm:px-4 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 ${
                    dateFilter === filter.value
                      ? 'bg-green-600 text-white shadow-md'
                      : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {filter.label}
                </TouchFeedbackButton>
              ))}
              <input
                type="date"
                max={formatDate(new Date())}
                value={dateFilter === 'custom' && customDate ? formatDate(customDate) : ''}
                onChange={(e) => {
                  if (e.target.value) {
                    const [year, month, day] = e.target.value.split('-').map(Number);
                    setCustomDate(new Date(year, month - 1, day));
                    setDateFilter('custom');
                  }
                }}
                className={`px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all flex-shrink-0 border-2 cursor-pointer focus:outline-none ${
                  dateFilter === 'custom'
                    ? 'bg-green-600 text-white border-green-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-green-400'
                }`}
                style={{ minWidth: '130px' }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto p-3 sm:p-4 space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-96">
            <LoadingSpinner />
            <p className="mt-4 text-gray-500 text-sm">Loading attendance...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <p className="text-red-600 font-medium">{error}</p>
            <TouchFeedbackButton
              onClick={fetchData}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
            >
              Try Again
            </TouchFeedbackButton>
          </div>
        ) : hierarchyData ? (
          <>
            {/* Date label */}
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-green-600" />
              <span className="text-sm font-semibold text-gray-600">{getDisplayDate()}</span>
            </div>

            {/* Hierarchy Tree */}
            <div className="space-y-0">
              <AttendanceNode node={hierarchyData} level={0} isLastChild={true} />
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

/* ── Status badge component ── */
const AttendanceBadge = ({ clubs, remoteCount, attended }) => {
  if (!attended) {
    return (
      <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-red-50 border border-red-200 text-red-500">
        <XCircle className="h-3.5 w-3.5 flex-shrink-0" />
        <span className="text-[11px] font-semibold whitespace-nowrap">Not Attended</span>
      </div>
    );
  }

  const items = [];

  clubs.forEach((club, idx) => {
    items.push(
      <div key={`club-${idx}`} className="flex items-center gap-1 px-2 py-1 rounded-full bg-green-50 border border-green-300 text-green-700">
        <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
        <span className="text-[11px] font-semibold whitespace-nowrap max-w-[120px] truncate">{club.name}</span>
      </div>
    );
  });

  if (remoteCount > 0) {
    items.push(
      <div key="remote" className="flex items-center gap-1 px-2 py-1 rounded-full bg-blue-50 border border-blue-300 text-blue-600">
        <Wifi className="h-3.5 w-3.5 flex-shrink-0" />
        <span className="text-[11px] font-semibold whitespace-nowrap">Remote</span>
      </div>
    );
  }

  // If attended but no specific club or remote info
  if (items.length === 0) {
    items.push(
      <div key="present" className="flex items-center gap-1 px-2 py-1 rounded-full bg-green-50 border border-green-300 text-green-700">
        <span className="text-[11px] font-semibold">Present</span>
      </div>
    );
  }

  return <div className="flex items-center gap-1 flex-wrap justify-end">{items}</div>;
};

/* ── Individual tree node ── */
const AttendanceNode = ({ node, level, isLastChild }) => {
  const [expanded, setExpanded] = useState(true);

  const hasChildren = node.teamMembers && node.teamMembers.length > 0;
  const attended = node.metrics?.attended === true;
  const clubs = node.metrics?.clubs || [];
  const remoteCount = node.metrics?.remoteCount || 0;

  const attendedDirect = node.directTeamCount?.qualified || 0;
  const totalDirect = node.directTeamCount?.total || 0;
  const attendedFull = node.fullTeamCount?.qualified || 0;
  const totalFull = node.fullTeamCount?.total || 0;

  return (
    <div className="relative flex" style={{ marginLeft: level > 0 ? 0 : 0 }}>
      {/* Vertical + Horizontal tree lines */}
      {level > 0 && (
        <div className="relative flex-shrink-0" style={{ width: '28px' }}>
          {/* horizontal connector */}
          <div className="absolute top-[22px] left-0 h-[2px] bg-gray-200 w-full" />
          {/* vertical line from parent */}
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
          <div className="flex items-center gap-2 px-3 py-2.5">
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

            {/* Name + sub-info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span
                  className={`text-sm font-bold truncate ${
                    level === 0 && attended ? 'text-yellow-900' : attended ? 'text-gray-900' : 'text-gray-500'
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
            </div>

            {/* Attendance badge — prominent on right */}
            <div className="flex-shrink-0 flex items-center gap-1">
              <AttendanceBadge clubs={clubs} remoteCount={remoteCount} attended={attended} />

              {/* Expand/collapse toggle if has children */}
              {hasChildren && (
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="ml-1 p-1 rounded-full hover:bg-black/5 text-gray-400"
                >
                  {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
              )}
            </div>
          </div>

          {/* Stats strip — You / Direct / Full for every node */}
          <div className={`flex items-center divide-x px-3 py-2 border-t ${
            level === 0
              ? attended ? 'border-yellow-200 divide-yellow-200' : 'border-gray-100 divide-gray-100'
              : attended ? 'border-green-100 divide-green-100' : 'border-gray-100 divide-gray-100'
          }`}>
            {/* Self attendance */}
            <div className="flex-1 flex flex-col items-center pr-2">
              <span className="text-[9px] font-bold uppercase tracking-wide text-gray-400 mb-0.5">
                {level === 0 ? 'You' : 'Self'}
              </span>
              {attended ? (
                <>
                  {clubs.length > 0 && remoteCount > 0 ? (
                    <>
                      <span className="text-sm sm:text-base font-bold leading-none text-green-600">
                        {clubs.length + remoteCount}
                      </span>
                      <span className="text-[9px] font-semibold mt-0.5 text-green-500">
                        Club + Remote
                      </span>
                    </>
                  ) : clubs.length > 0 ? (
                    <>
                      <span className="text-sm sm:text-base font-bold leading-none text-green-600">
                        {clubs.length}
                      </span>
                      <span className="text-[9px] font-semibold mt-0.5 text-green-500">
                        Club{clubs.length > 1 ? 's' : ''}
                      </span>
                    </>
                  ) : remoteCount > 0 ? (
                    <>
                      <span className="text-sm sm:text-base font-bold leading-none text-blue-600">
                        {remoteCount}
                      </span>
                      <span className="text-[9px] font-semibold mt-0.5 text-blue-500">
                        Remote
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-sm sm:text-base font-bold leading-none text-green-600">
                        ✓
                      </span>
                      <span className="text-[9px] font-semibold mt-0.5 text-green-500">
                        Attended
                      </span>
                    </>
                  )}
                </>
              ) : (
                <>
                  <span className="text-sm sm:text-base font-bold leading-none text-gray-400">
                    ✗
                  </span>
                  <span className="text-[9px] font-semibold mt-0.5 text-gray-400">
                    Not Attended
                  </span>
                </>
              )}
            </div>
            {/* Direct Team */}
            <div className="flex-1 flex flex-col items-center px-2">
              <span className="text-[9px] font-bold uppercase tracking-wide text-blue-400 mb-0.5">Direct</span>
              <span className="text-sm sm:text-base font-bold text-blue-700 leading-none">
                {attendedDirect}<span className="text-[10px] sm:text-xs font-normal text-blue-400">/{totalDirect}</span>
              </span>
              <span className="text-[9px] font-semibold text-blue-400 mt-0.5">attended</span>
            </div>
            {/* Full Team */}
            <div className="flex-1 flex flex-col items-center pl-2">
              <span className="text-[9px] font-bold uppercase tracking-wide text-green-500 mb-0.5">Full Team</span>
              <span className="text-sm sm:text-base font-bold text-green-700 leading-none">
                {attendedFull}<span className="text-[10px] sm:text-xs font-normal text-green-400">/{totalFull}</span>
              </span>
              <span className="text-[9px] font-semibold text-green-500 mt-0.5">attended</span>
            </div>
          </div>
        </div>

        {/* Children */}
        <AnimatePresence>
          {hasChildren && expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-2 ml-4 pl-0 space-y-0"
            >
              {node.teamMembers.map((child, index) => (
                <AttendanceNode
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

export default AttendanceReport;

