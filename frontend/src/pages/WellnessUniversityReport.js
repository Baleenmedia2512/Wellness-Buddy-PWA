import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000';

const PROGRAMS = [
  { id: 'family-breakfast', name: 'Family Healthy Breakfast Program', icon: '🥗' },
  { id: 'weight-loss', name: 'Weight Loss', icon: '📉' },
  { id: 'weight-gain', name: 'Weight Gain', icon: '📈' },
  { id: 'kids-nutrition', name: 'Kids Nutrition', icon: '🧒' },
  { id: 'sports-nutrition', name: 'Sports Nutrition', icon: '🏃' },
  { id: 'targeted-nutrition', name: 'Targeted Nutrition', icon: '🎯' },
  { id: 'earn-product-cost', name: 'How to Earn My Product Cost', icon: '💰' },
  { id: 'extra-income', name: 'Extra Income Opportunity', icon: '💼' },
];

const WellnessUniversityReport = ({ onClose, user, userRole }) => {
  const [enrollments, setEnrollments] = useState([]);
  const [allTeamMembers, setAllTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedProgram, setExpandedProgram] = useState(null);
  const [viewType, setViewType] = useState(null); // 'mine', 'direct', 'full'
  const [currentUserId, setCurrentUserId] = useState(null);

  const fetchEnrollments = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const cacheBuster = Date.now();
      
      // Get current user ID first
      const userProfileResponse = await fetch(
        `${API_BASE}/api/get-user-profile?email=${encodeURIComponent(user.email)}&_t=${cacheBuster}`
      );
      const userProfileData = await userProfileResponse.json();
      
      if (userProfileData.success && userProfileData.data?.userId) {
        setCurrentUserId(userProfileData.data.userId);
      }

      // Fetch all team members (for showing non-enrolled members)
      const teamResponse = await fetch(
        `${API_BASE}/api/coach/team-hierarchy?email=${encodeURIComponent(user.email)}&_t=${cacheBuster}`
      );
      const teamData = await teamResponse.json();
      
      if (teamData.success) {
        console.log('All team members loaded:', teamData.allMembers?.length);
        setAllTeamMembers(teamData.allMembers || []);
      }

      // Fetch enrollments
      const response = await fetch(
        `${API_BASE}/api/wellness-university/get-enrollments?email=${encodeURIComponent(user.email)}&_t=${cacheBuster}`
      );
      const data = await response.json();

      if (data.success) {
        console.log('Enrollments loaded:', data.enrollments);
        setEnrollments(data.enrollments || []);
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

  // Calculate program statistics
  const calculateProgramStats = () => {
    const stats = {};

    PROGRAMS.forEach((program) => {
      const programName = program.name;
      
      // Filter enrollments for this program
      const programEnrollments = enrollments.filter((enrollment) => {
        const programs = JSON.parse(enrollment.EnrolledPrograms || '[]');
        return programs.includes(programName);
      });

      // Mine: Check if current user enrolled
      const myEnrollment = programEnrollments.find(e => e.UserId === currentUserId);
      const mine = myEnrollment ? 1 : 0;

      // Get all direct team members (CoachId or CoCoachId = currentUserId)
      const allDirectMembers = allTeamMembers.filter(member => 
        (member.CoachId === currentUserId || member.CoCoachId === currentUserId) && 
        member.UserId !== currentUserId
      );

      // Get all full team members (everyone except current user)
      const allFullMembers = allTeamMembers.filter(member => member.UserId !== currentUserId);

      // Split into enrolled and not enrolled for direct team
      const directEnrolled = [];
      const directNotEnrolled = [];
      
      allDirectMembers.forEach(member => {
        const enrollment = programEnrollments.find(e => e.UserId === member.UserId);
        if (enrollment) {
          directEnrolled.push({ 
            ...member, 
            ...enrollment, 
            isEnrolled: true,
            // Use enrollment's CoachName if available, otherwise use member's
            CoachName: enrollment.CoachName || member.coachName || ''
          });
        } else {
          directNotEnrolled.push({ 
            ...member, 
            isEnrolled: false,
            // For non-enrolled, use member's coachName from team hierarchy
            CoachName: member.coachName || '',
            UserName: member.UserName || 'Unknown'
          });
        }
      });

      // Split into enrolled and not enrolled for full team
      const fullEnrolled = [];
      const fullNotEnrolled = [];
      
      allFullMembers.forEach(member => {
        const enrollment = programEnrollments.find(e => e.UserId === member.UserId);
        if (enrollment) {
          fullEnrolled.push({ 
            ...member, 
            ...enrollment, 
            isEnrolled: true,
            CoachName: enrollment.CoachName || member.coachName || ''
          });
        } else {
          fullNotEnrolled.push({ 
            ...member, 
            isEnrolled: false,
            CoachName: member.coachName || '',
            UserName: member.UserName || 'Unknown'
          });
        }
      });

      // Combine: enrolled first, then not enrolled
      const directTeamMembers = [...directEnrolled, ...directNotEnrolled];
      const fullTeamMembers = [...fullEnrolled, ...fullNotEnrolled];

      stats[programName] = {
        mine,
        directTeam: directEnrolled.length, // Count only enrolled
        fullTeam: fullEnrolled.length, // Count only enrolled
        directTeamMembers, // All members (enrolled + not enrolled)
        fullTeamMembers, // All members (enrolled + not enrolled)
        directEnrolledCount: directEnrolled.length,
        fullEnrolledCount: fullEnrolled.length,
      };
    });

    return stats;
  };

  const programStats = calculateProgramStats();

  // Handle view type click
  const handleViewClick = (programName, type) => {
    if (expandedProgram === programName && viewType === type) {
      // Close if clicking the same view
      setExpandedProgram(null);
      setViewType(null);
    } else {
      setExpandedProgram(programName);
      setViewType(type);
    }
  };

  // Render member list
  const renderMemberList = (members) => {
    if (!members || members.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          No members found
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {members.map((member, index) => {
          const isEnrolled = member.isEnrolled !== false;
          
          return (
            <div
              key={`${member.Email}-${index}`}
              className={`rounded-lg p-3 border shadow-sm transition-all ${
                isEnrolled 
                  ? 'bg-white border-gray-200' 
                  : 'bg-gray-100 border-gray-300 opacity-60'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 flex-shrink-0 rounded-full flex items-center justify-center text-white font-bold text-base ${
                  isEnrolled 
                    ? 'bg-gradient-to-br from-green-400 to-teal-400' 
                    : 'bg-gray-400'
                }`}>
                  {member.UserName?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className={`font-semibold text-sm truncate ${
                    isEnrolled ? 'text-gray-800' : 'text-gray-500'
                  }`}>
                    {member.UserName}
                  </h4>
                  <p className={`text-xs truncate ${
                    isEnrolled ? 'text-gray-600' : 'text-gray-400'
                  }`}>
                    {member.Email}
                  </p>
                  {member.CoachName && (
                    <p className={`text-xs ${
                      isEnrolled ? 'text-gray-500' : 'text-gray-400'
                    }`}>
                      Reports to: {member.CoachName}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  {isEnrolled && member.LastUpdated && (
                    <div className="text-xs text-gray-500">
                      {new Date(member.LastUpdated || member.EnrollmentDate).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric'
                      })}
                    </div>
                  )}
                  {!isEnrolled && (
                    <div className="text-xs text-gray-400 font-medium px-2 py-1 bg-gray-200 rounded">
                      Not enrolled
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
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
                Wellness University Enrollments
              </h1>
              <p className="text-gray-700 text-xs">
                Track program enrollments across your team
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
            {/* Programs List */}
            <div className="space-y-4">
              {PROGRAMS.filter(program => {
                const stats = programStats[program.name] || { mine: 0, directTeam: 0, fullTeam: 0 };
                return stats.mine > 0 || stats.directTeam > 0 || stats.fullTeam > 0;
              }).length === 0 ? (
                <div className="bg-gray-50 rounded-xl p-12 text-center">
                  <div className="text-6xl mb-4">📋</div>
                  <p className="text-gray-600 text-lg">No enrollments found</p>
                  <p className="text-gray-500 text-sm mt-2">
                    Be the first to enroll in a program!
                  </p>
                </div>
              ) : (
                <>
                  {PROGRAMS.map((program) => {
                    const stats = programStats[program.name] || { mine: 0, directTeam: 0, fullTeam: 0, directTeamMembers: [], fullTeamMembers: [] };
                    
                    // Hide programs with no enrollments
                    if (stats.mine === 0 && stats.directTeam === 0 && stats.fullTeam === 0) {
                      return null;
                    }
                    
                    const isExpanded = expandedProgram === program.name;
                
                return (
                  <div
                    key={program.id}
                    className="bg-white rounded-xl shadow-md overflow-hidden"
                  >
                    {/* Program Header - One Row Layout */}
                    <div className="p-4">
                      <div className="flex items-center justify-between gap-4">
                        {/* Left: Icon + Name */}
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-12 h-12 flex-shrink-0 bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-200 rounded-xl flex items-center justify-center text-3xl">
                            {program.icon}
                          </div>
                          <h3 className="font-semibold text-gray-800 text-base truncate">{program.name}</h3>
                        </div>

                        {/* Right: Metrics in horizontal row */}
                        <div className="flex items-center gap-2">
                          {/* Mine */}
                          <div
                            onClick={() => stats.mine > 0 && handleViewClick(program.name, 'mine')}
                            className={`px-3 py-2 rounded-lg border transition-all ${
                              stats.mine > 0
                                ? 'bg-blue-50 border-blue-200 cursor-pointer hover:bg-blue-100'
                                : 'bg-gray-50 border-gray-200'
                            } ${isExpanded && viewType === 'mine' ? 'ring-2 ring-blue-400' : ''}`}
                          >
                            <div className="text-center">
                              <div className={`text-lg font-bold ${stats.mine > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
                                {stats.mine}
                              </div>
                              <div className="text-xs text-gray-600 font-medium whitespace-nowrap">
                                MY SCORE
                              </div>
                            </div>
                          </div>

                          {/* Direct Team */}
                          <div
                            onClick={() => stats.directTeamMembers.length > 0 && handleViewClick(program.name, 'direct')}
                            className={`px-3 py-2 rounded-lg border transition-all ${
                              stats.directTeamMembers.length > 0
                                ? 'bg-green-50 border-green-200 cursor-pointer hover:bg-green-100'
                                : 'bg-gray-50 border-gray-200'
                            } ${isExpanded && viewType === 'direct' ? 'ring-2 ring-green-400' : ''}`}
                          >
                            <div className="text-center">
                              <div className={`text-lg font-bold ${stats.directTeamMembers.length > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                                {stats.directTeam}
                              </div>
                              <div className="text-xs text-gray-600 font-medium whitespace-nowrap">
                                DIRECT TEAM
                              </div>
                            </div>
                          </div>

                          {/* Full Team */}
                          <div
                            onClick={() => stats.fullTeamMembers.length > 0 && handleViewClick(program.name, 'full')}
                            className={`px-3 py-2 rounded-lg border transition-all ${
                              stats.fullTeamMembers.length > 0
                                ? 'bg-purple-50 border-purple-200 cursor-pointer hover:bg-purple-100'
                                : 'bg-gray-50 border-gray-200'
                            } ${isExpanded && viewType === 'full' ? 'ring-2 ring-purple-400' : ''}`}
                          >
                            <div className="text-center">
                              <div className={`text-lg font-bold ${stats.fullTeamMembers.length > 0 ? 'text-purple-600' : 'text-gray-400'}`}>
                                {stats.fullTeam}
                              </div>
                              <div className="text-xs text-gray-600 font-medium whitespace-nowrap">
                                FULL TEAM
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Expanded Member List */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="border-t border-gray-200 bg-gray-50 p-4">
                            <h4 className="text-sm font-semibold text-gray-700 mb-3">
                              {viewType === 'mine' && 'My Enrollment'}
                              {viewType === 'direct' && `Direct Team Members (${stats.directEnrolledCount} enrolled / ${stats.directTeamMembers.length} total)`}
                              {viewType === 'full' && `Full Team Members (${stats.fullEnrolledCount} enrolled / ${stats.fullTeamMembers.length} total)`}
                            </h4>
                            {viewType === 'mine' && stats.mine > 0 && (
                              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                                <div className="text-4xl mb-2">✅</div>
                                <p className="text-blue-800 font-semibold">You're enrolled in this program!</p>
                              </div>
                            )}
                            {viewType === 'direct' && renderMemberList(stats.directTeamMembers)}
                            {viewType === 'full' && renderMemberList(stats.fullTeamMembers)}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default WellnessUniversityReport;
