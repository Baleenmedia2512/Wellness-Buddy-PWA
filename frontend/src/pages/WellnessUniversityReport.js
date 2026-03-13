import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000';

const WellnessUniversityReport = ({ onClose, user, userRole }) => {
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedProgram, setExpandedProgram] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
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
        console.log('Initial enrollments loaded:', data.enrollments);
        if (data.enrollments && data.enrollments.length > 0) {
          console.log('Sample enrollment:', data.enrollments[0]);
        }
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

  // Group enrollments by programs and build hierarchy .
  const groupEnrollmentsByProgram = () => {
    const programGroups = {};
    
    enrollments.forEach((enrollment) => {
      const programs = JSON.parse(enrollment.EnrolledPrograms || '[]');
      programs.forEach((program) => {
        if (!programGroups[program]) {
          programGroups[program] = [];
        }
        programGroups[program].push(enrollment);
      });
    });

    return Object.entries(programGroups)
      .map(([programName, users]) => {
        // Build hierarchy for users
        const hierarchy = buildUserHierarchy(users);
        
        return {
          programName,
          count: users.length,
          users,
          hierarchy
        };
      })
      .filter((group) => {
        // Filter by search query - only check program names
        if (searchQuery) {
          return group.programName.toLowerCase().includes(searchQuery.toLowerCase());
        }
        return true;
      })
      .sort((a, b) => b.count - a.count); // Sort by count descending
  };

  // Build hierarchical tree structure based on referral/reporting relationships
  const buildUserHierarchy = (users) => {
    const userMap = new Map();
    const roots = [];
    
    // Create a map of all users
    users.forEach(user => {
      userMap.set(user.Email, { ...user, children: [] });
    });
    
    // Build the tree by finding parents
    users.forEach(user => {
      const currentUser = userMap.get(user.Email);
      const reportsTo = user.ReportsTo || user.ReferredBy || user.ParentEmail;
      
      if (reportsTo && userMap.has(reportsTo)) {
        // User has a parent in this list
        const parent = userMap.get(reportsTo);
        parent.children.push(currentUser);
      } else {
        // This is a root user (no parent in list)
        roots.push(currentUser);
      }
    });
    
    return roots;
  };

  const programGroups = groupEnrollmentsByProgram();

  // Get icon for program
  const getProgramIcon = (programName) => {
    const icons = {
      'Kids Nutrition': '🧒',
      'Weight Loss': '📉',
      'Weight Gain': '📈',
      'Family Healthy Breakfast Program': '🥗',
      'Sports Nutrition': '⚽',
      'Targeted Nutrition': '🎯',
      'How to Earn My Product Cost': '💰',
      'Extra Income Opportunity': '💵',
    };
    return icons[programName] || '✅';
  };

  // Recursive component to render user hierarchy
  const renderUserHierarchy = (user, level = 0, isLast = false) => {
    const hasChildren = user.children && user.children.length > 0;
    const leftMargin = level * 40; // 40px per level
    
    return (
      <div key={user.Email} className="relative">
        {/* Connecting lines */}
        {level > 0 && (
          <>
            {/* Horizontal line to the card */}
            <div 
              className="absolute top-1/2 bg-gray-300 h-0.5" 
              style={{ left: `${leftMargin - 20}px`, width: '20px' }}
            ></div>
            {/* Vertical line */}
            {!isLast && (
              <div 
                className="absolute top-1/2 bottom-0 bg-gray-300 w-0.5" 
                style={{ left: `${leftMargin - 20}px` }}
              ></div>
            )}
          </>
        )}
        
        {/* User Card */}
        <div 
          className="mb-3 bg-white rounded-lg p-3 border border-gray-200 shadow-sm" 
          style={{ marginLeft: `${leftMargin}px` }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex-shrink-0 bg-gradient-to-br from-green-400 to-teal-400 rounded-full flex items-center justify-center text-white font-bold text-base">
              {user.UserName?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-gray-800 text-sm truncate">{user.UserName}</h4>
              <p className="text-xs text-gray-600 truncate">{user.Email}</p>
            </div>
            <div className="text-xs text-gray-500">
              {new Date(user.LastUpdated || user.EnrollmentDate).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric'
              })}
            </div>
          </div>
        </div>
        
        {/* Render children recursively */}
        {hasChildren && (
          <div className="relative">
            {/* Vertical line for children */}
            <div 
              className="absolute bg-gray-300 w-0.5" 
              style={{ 
                left: `${leftMargin + 20}px`,
                top: '0',
                height: '100%'
              }}
            ></div>
            {user.children.map((child, index) => 
              renderUserHierarchy(child, level + 1, index === user.children.length - 1)
            )}
          </div>
        )}
      </div>
    );
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
                      placeholder="Search programs, members..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400 bg-gray-50"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Enrollments List */}
            {programGroups.length === 0 ? (
              <div className="bg-gray-50 rounded-xl p-12 text-center">
                <div className="text-6xl mb-4">📋</div>
                <p className="text-gray-600 text-lg">No enrollments found</p>
                <p className="text-gray-500 text-sm mt-2">
                  {searchQuery
                    ? 'Try adjusting your search'
                    : 'Be the first to enroll!'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {programGroups.map((programGroup) => {
                  const isExpanded = expandedProgram === programGroup.programName;
                  
                  return (
                    <div
                      key={programGroup.programName}
                      className="bg-white rounded-xl shadow-md overflow-hidden"
                    >
                      {/* Program Header - Clickable */}
                      <div
                        onClick={() => setExpandedProgram(isExpanded ? null : programGroup.programName)}
                        className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 flex-shrink-0 bg-white border-2 border-gray-200 rounded-xl flex items-center justify-center text-3xl">
                              {getProgramIcon(programGroup.programName)}
                            </div>
                            <div>
                              <h3 className="font-semibold text-gray-800 text-base">{programGroup.programName}</h3>
                              <p className="text-sm text-gray-600">
                                {programGroup.count} {programGroup.count === 1 ? 'member' : 'members'}
                              </p>
                            </div>
                          </div>
                          <svg 
                            className={`w-6 h-6 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} 
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>

                      {/* Expanded User List */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="border-t border-gray-200 bg-gray-50">
                              <div className="p-4">
                                {programGroup.hierarchy.map((rootUser) => 
                                  renderUserHierarchy(rootUser, 0, false)
                                )}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default WellnessUniversityReport;
