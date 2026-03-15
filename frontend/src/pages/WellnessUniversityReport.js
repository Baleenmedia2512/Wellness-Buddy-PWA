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
  const [showNotEnrolled, setShowNotEnrolled] = useState(true); // Toggle for showing non-enrolled members

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

      // Fetch team hierarchy FIRST to get proper CoachId/CoCoachId relationships
      let teamMembers = [];
      let myDirectTeamIds = []; // Track who reports directly to you
      
      try {
        // Use coachId if available, otherwise fall back to email
        const userId = userProfileData.data?.userId;
        const teamUrl = userId 
          ? `${API_BASE}/api/coach/team-hierarchy?coachId=${userId}&_t=${cacheBuster}`
          : `${API_BASE}/api/coach/team-hierarchy?email=${encodeURIComponent(user.email)}&_t=${cacheBuster}`;
        
        console.log('📡 Fetching team hierarchy:', teamUrl);
        
        const teamResponse = await fetch(teamUrl);
        
        if (!teamResponse.ok) {
          const errorText = await teamResponse.text();
          console.error('❌ Team hierarchy API failed:', teamResponse.status, errorText);
          throw new Error(`API returned ${teamResponse.status}: ${errorText}`);
        }
        
        const teamData = await teamResponse.json();
        
        if (teamData.success && teamData.allMembers && teamData.allMembers.length > 0) {
          console.log('✅ Team hierarchy loaded:', teamData.allMembers?.length, 'members');
          console.log('👥 All team members from API:', teamData.allMembers.map(m => ({
            name: m.UserName || m.Email,
            userId: m.UserId,
            coachId: m.CoachId,
            reportsTo: m.coachName
          })));
          
          // Get current user ID as number for filtering
          const currentUserIdNum = Number(userProfileData.data?.userId);
          console.log('🔍 Current User ID:', currentUserIdNum);
          
          // IMPORTANT: Only show members who DIRECTLY report to YOU (not entire downline)
          // Filter to only members where YOU are their CoachId or CoCoachId
          teamMembers = teamData.allMembers.filter(member => {
            const memberUserId = Number(member.UserId);
            const memberCoachId = Number(member.CoachId);
            const memberCoCoachId = Number(member.CoCoachId);
            
            // Include only if YOU are their direct coach or co-coach
            const isDirectReport = (memberCoachId === currentUserIdNum || memberCoCoachId === currentUserIdNum) 
                                    && memberUserId !== currentUserIdNum;
            
            console.log(`Checking member: ${member.UserName || member.Email}`, {
              userId: memberUserId,
              coachId: memberCoachId,
              coCoachId: memberCoCoachId,
              currentUserId: currentUserIdNum,
              coachMatch: memberCoachId === currentUserIdNum,
              coCoachMatch: memberCoCoachId === currentUserIdNum,
              isDirectReport: isDirectReport
            });
            
            if (!isDirectReport && memberUserId !== currentUserIdNum) {
              console.warn('⚠️ EXCLUDING (not direct report):', member.UserName, 
                          '| CoachId:', member.CoachId,
                          '| CoCoachId:', member.CoCoachId,
                          '| Coach:', member.coachName);
            } else if (isDirectReport) {
              console.log('✅ INCLUDING direct report:', member.UserName);
            }
            
            return isDirectReport;
          });
          
          console.log('✅ Final filtered team members:', teamMembers.length);
          console.log('👥 Your direct reports:', teamMembers.map(m => m.UserName || m.Email));
          
          console.log('✅ Filtered team members:', teamMembers.length);
          console.log('👥 Your team:', teamMembers.map(m => ({
            name: m.UserName || m.Email,
            coachId: m.CoachId
          })));
          
          setAllTeamMembers(teamMembers);
        } else {
          console.warn('⚠️ Team hierarchy returned no members');
        }
      } catch (teamErr) {
        console.error('❌ Team hierarchy API failed:', teamErr);
      }

      // Fetch enrollments
      const response = await fetch(
        `${API_BASE}/api/wellness-university/get-enrollments?email=${encodeURIComponent(user.email)}&_t=${cacheBuster}`
      );
      const data = await response.json();

      if (data.success) {
        console.log('✅ Enrollments loaded:', data.enrollments?.length, 'enrollments');
        console.log('Sample enrollment data:', data.enrollments[0]);
        setEnrollments(data.enrollments || []);
        
        // If team hierarchy failed, use enrollments as fallback
        if (teamMembers.length === 0) {
          console.warn('⚠️ Using enrollments as team members (fallback)');
          setAllTeamMembers(data.enrollments || []);
        }
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

      console.log(`[${programName}] Program enrollments:`, programEnrollments.length);

      // Mine: Check if current user enrolled
      const myEnrollment = programEnrollments.find(e => e.UserId === currentUserId);
      const mine = myEnrollment ? 1 : 0;

      // If we have team hierarchy data, use it
      if (allTeamMembers.length > 0) {
        console.log(`[${programName}] Using team members path. Total members:`, allTeamMembers.length);
        console.log(`[${programName}] Current user ID:`, currentUserId, 'Type:', typeof currentUserId);
        console.log(`[${programName}] Sample member:`, allTeamMembers[0]);
        
        // Convert currentUserId to number for comparison
        const currentUserIdNum = Number(currentUserId);
        
        // Get all direct team members (CoachId or CoCoachId = currentUserId)
        const allDirectMembers = allTeamMembers.filter(member => {
          const memberUserId = Number(member.UserId);
          const memberCoachId = Number(member.CoachId);
          const memberCoCoachId = Number(member.CoCoachId);
          
          const coachIdMatch = memberCoachId === currentUserIdNum;
          const coCoachIdMatch = memberCoCoachId === currentUserIdNum;
          const notSelf = memberUserId !== currentUserIdNum;
          const isDirect = (coachIdMatch || coCoachIdMatch) && notSelf;
          
          if (!notSelf || isDirect) {
            console.log(`[${programName}] Member:`, member.UserName || member.Email, 
                       '| UserId:', memberUserId,
                       '| CoachId:', memberCoachId,
                       '| CoCoachId:', memberCoCoachId,
                       '| CoachMatch:', coachIdMatch,
                       '| CoCoachMatch:', coCoachIdMatch,
                       '| NotSelf:', notSelf,
                       '| ✅ IsDirect:', isDirect);
          }
          
          return isDirect;
        });
        
        console.log(`[${programName}] ✅ Direct members found:`, allDirectMembers.length);
        console.log(`[${programName}] ✅ Direct members:`, allDirectMembers.map(m => m.UserName || m.Email));

        // Build FULL TEAM recursively - all members in downline hierarchy
        // IMPORTANT: Use allTeamMembers (ALL team members) not just enrolled ones
        const buildFullTeam = (startMembers, allMembers) => {
          const fullTeam = new Map(); // Use Map to avoid duplicates
          const queue = [...startMembers];
          
          console.log(`[${programName}] 🔧 Building full team from ${startMembers.length} direct members`);
          console.log(`[${programName}] 🔧 Using ${allMembers.length} total members for hierarchy traversal`);
          
          while (queue.length > 0) {
            const current = queue.shift();
            const currentUserId = Number(current.UserId);
            
            // Add current member to full team
            if (!fullTeam.has(currentUserId)) {
              fullTeam.set(currentUserId, current);
              console.log(`[${programName}] ➕ Added to full team:`, current.UserName || current.Email, '(UserId:', currentUserId, ')');
              
              // Find all members who report to this person
              const subTeam = allMembers.filter(m => {
                const mCoachId = Number(m.CoachId);
                const mCoCoachId = Number(m.CoCoachId);
                const isSubTeamMember = (mCoachId === currentUserId || mCoCoachId === currentUserId) && 
                       Number(m.UserId) !== currentUserId;
                
                if (isSubTeamMember) {
                  console.log(`[${programName}] 👤 Found sub-team member:`, m.UserName || m.Email, 
                             'reports to', current.UserName || current.Email);
                }
                
                return isSubTeamMember;
              });
              
              console.log(`[${programName}] 📋 ${current.UserName || current.Email} has ${subTeam.length} direct reports`);
              
              // Add sub-team members to queue for processing
              subTeam.forEach(member => {
                if (!fullTeam.has(Number(member.UserId))) {
                  queue.push(member);
                }
              });
            }
          }
          
          return Array.from(fullTeam.values());
        };
        
        // Use allTeamMembers (from team-hierarchy API) for building full hierarchy
        // This includes ALL team members regardless of enrollment status
        const allFullMembers = buildFullTeam(allDirectMembers, allTeamMembers);
        
        console.log(`[${programName}] 📊 Full team members (entire downline):`, allFullMembers.length);
        console.log(`[${programName}] 📊 Full team:`, allFullMembers.map(m => m.UserName || m.Email));

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
              CoachName: enrollment.CoachName || member.coachName || ''
            });
          } else {
            directNotEnrolled.push({ 
              ...member, 
              isEnrolled: false,
              CoachName: member.coachName || '',
              UserName: member.UserName || 'Unknown'
            });
          }
        });

        // Split into enrolled and not enrolled for full team
        const fullEnrolled = [];
        const fullNotEnrolled = [];
        
        console.log(`[${programName}] 🔍 Processing full team members:`, allFullMembers.length);
        allFullMembers.forEach(member => {
          console.log(`[${programName}] Full team member:`, member.UserName, '| UserId:', member.UserId, '| CoachId:', member.CoachId);
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
        
        console.log(`[${programName}] 📊 Full enrolled:`, fullEnrolled.length, fullEnrolled.map(m => m.UserName));
        console.log(`[${programName}] 📊 Full not enrolled:`, fullNotEnrolled.length, fullNotEnrolled.map(m => m.UserName));

        // Combine: enrolled first, then not enrolled
        const directTeamMembers = [...directEnrolled, ...directNotEnrolled];
        const fullTeamMembers = [...fullEnrolled, ...fullNotEnrolled];

        stats[programName] = {
          mine,
          directTeam: directEnrolled.length,
          fullTeam: fullEnrolled.length,
          directTeamMembers,
          fullTeamMembers,
          directEnrolledCount: directEnrolled.length,
          fullEnrolledCount: fullEnrolled.length,
        };
      } else {
        // Fallback: Use enrollment data with CoachId/CoCoachId to determine hierarchy
        console.log(`[${programName}] Using fallback - CurrentUserId:`, currentUserId);
        console.log(`[${programName}] Sample enrollment:`, programEnrollments[0]);
        
        // Convert to numbers for comparison
        const currentUserIdNum = Number(currentUserId);
        
        const directEnrolledMembers = programEnrollments
          .filter(e => {
            const memberUserId = Number(e.UserId);
            const memberCoachId = Number(e.CoachId);
            const memberCoCoachId = Number(e.CoCoachId);
            
            const isDirect = memberUserId !== currentUserIdNum && 
                           (memberCoachId === currentUserIdNum || memberCoCoachId === currentUserIdNum);
            if (isDirect) {
              console.log(`[${programName}] Direct member found:`, e.UserName, 'CoachId:', memberCoachId, 'CoCoachId:', memberCoCoachId);
            }
            return isDirect;
          })
          .map(e => ({
            ...e,
            isEnrolled: true,
            CoachName: e.CoachName || '',
            UserName: e.UserName || 'Unknown'
          }));

        const fullEnrolledMembers = programEnrollments
          .filter(e => Number(e.UserId) !== currentUserIdNum)
          .map(e => ({
            ...e,
            isEnrolled: true,
            CoachName: e.CoachName || '',
            UserName: e.UserName || 'Unknown'
          }));

        console.log(`[${programName}] Direct enrolled:`, directEnrolledMembers.length, 'Full enrolled:', fullEnrolledMembers.length);

        stats[programName] = {
          mine,
          directTeam: directEnrolledMembers.length,
          fullTeam: fullEnrolledMembers.length,
          directTeamMembers: directEnrolledMembers,
          fullTeamMembers: fullEnrolledMembers,
          directEnrolledCount: directEnrolledMembers.length,
          fullEnrolledCount: fullEnrolledMembers.length,
        };
      }
    });

    console.log('Program stats calculated:', stats);
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
        <div className="text-center py-6 sm:py-8 text-gray-500 text-sm sm:text-base">
          No members found
        </div>
      );
    }

    // Filter members based on showNotEnrolled toggle
    const filteredMembers = showNotEnrolled 
      ? members 
      : members.filter(m => m.isEnrolled !== false);

    if (filteredMembers.length === 0) {
      return (
        <div className="text-center py-6 sm:py-8 text-gray-500 text-sm sm:text-base">
          No enrolled members found
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {filteredMembers.map((member, index) => {
          const isEnrolled = member.isEnrolled !== false;
          
          return (
            <div
              key={`${member.Email}-${index}`}
              className={`rounded-lg p-2.5 sm:p-3 border shadow-sm transition-all ${
                isEnrolled 
                  ? 'bg-white border-gray-200' 
                  : 'bg-gray-50 border-gray-300 opacity-50'
              }`}
            >
              <div className="flex items-center gap-2 sm:gap-3">
                <div className={`w-9 h-9 sm:w-10 sm:h-10 flex-shrink-0 rounded-full flex items-center justify-center text-white font-bold text-sm sm:text-base ${
                  isEnrolled 
                    ? 'bg-gradient-to-br from-green-400 to-teal-400' 
                    : 'bg-gray-400'
                }`}>
                  {member.UserName?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className={`font-semibold text-xs sm:text-sm truncate ${
                    isEnrolled ? 'text-gray-800' : 'text-gray-500'
                  }`}>
                    {member.UserName}
                  </h4>
                  <p className={`text-[10px] sm:text-xs truncate ${
                    isEnrolled ? 'text-gray-600' : 'text-gray-400'
                  }`}>
                    {member.Email}
                  </p>
                  {member.CoachName && (
                    <p className={`text-[10px] sm:text-xs ${
                      isEnrolled ? 'text-gray-500' : 'text-gray-400'
                    }`}>
                      Reports to: {member.CoachName}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  {isEnrolled && member.LastUpdated && (
                    <div className="text-[10px] sm:text-xs text-gray-500">
                      {new Date(member.LastUpdated || member.EnrollmentDate).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric'
                      })}
                    </div>
                  )}
                  {!isEnrolled && (
                    <div className="text-[10px] sm:text-xs text-gray-400 font-medium px-1.5 sm:px-2 py-0.5 sm:py-1 bg-gray-200 rounded whitespace-nowrap">
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
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={onClose}
              className="text-gray-700 hover:bg-white hover:bg-opacity-50 rounded-full p-1.5 sm:p-2 transition-colors flex-shrink-0"
            >
              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-base sm:text-lg font-bold text-gray-800 truncate">
                Wellness University Enrollments
              </h1>
              <p className="text-gray-700 text-xs hidden sm:block">
                Track program enrollments across your team
              </p>
            </div>
            <button
              onClick={fetchEnrollments}
              className="text-gray-700 hover:bg-white hover:bg-opacity-50 rounded-full p-1.5 sm:p-2 transition-colors flex-shrink-0"
              title="Refresh"
            >
              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 sm:py-20">
            <div className="animate-spin rounded-full h-12 w-12 sm:h-16 sm:w-16 border-b-2 border-green-500 mb-4"></div>
            <p className="text-gray-600 text-sm sm:text-base">Loading enrollments...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 sm:p-6 text-center">
            <p className="text-red-700 text-sm sm:text-base">{error}</p>
            <button
              onClick={fetchEnrollments}
              className="mt-4 bg-red-600 text-white px-4 sm:px-6 py-2 rounded-lg hover:bg-red-700 text-sm sm:text-base"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            {/* Programs List */}
            <div className="space-y-3 sm:space-y-4">
              {PROGRAMS.filter(program => {
                const stats = programStats[program.name] || { mine: 0, directTeam: 0, fullTeam: 0 };
                return stats.mine > 0 || stats.directTeam > 0 || stats.fullTeam > 0;
              }).length === 0 ? (
                <div className="bg-gray-50 rounded-xl p-8 sm:p-12 text-center">
                  <div className="text-5xl sm:text-6xl mb-4">📋</div>
                  <p className="text-gray-600 text-base sm:text-lg">No enrollments found</p>
                  <p className="text-gray-500 text-xs sm:text-sm mt-2">
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
                    {/* Program Header - Responsive Layout */}
                    <div className="p-3 sm:p-4">
                      {/* Mobile: Stacked Layout (< 640px) */}
                      <div className="sm:hidden space-y-3">
                        {/* Program Name */}
                        <div className="flex items-center gap-2">
                          <div className="w-10 h-10 flex-shrink-0 bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-200 rounded-xl flex items-center justify-center text-2xl">
                            {program.icon}
                          </div>
                          <h3 className="font-semibold text-gray-800 text-sm flex-1 min-w-0">{program.name}</h3>
                        </div>

                        {/* Metrics in 3 columns */}
                        <div className="grid grid-cols-3 gap-2">
                          {/* Mine */}
                          <div
                            onClick={() => stats.mine > 0 && handleViewClick(program.name, 'mine')}
                            className={`px-2 py-2 rounded-lg border transition-all ${
                              stats.mine > 0
                                ? 'bg-blue-50 border-blue-200 cursor-pointer active:bg-blue-100'
                                : 'bg-gray-50 border-gray-200'
                            } ${isExpanded && viewType === 'mine' ? 'ring-2 ring-blue-400' : ''}`}
                          >
                            <div className="text-center">
                              <div className={`text-2xl font-bold ${stats.mine > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
                                {stats.mine}
                              </div>
                              <div className="text-[10px] text-gray-600 font-medium leading-tight">
                                MY SCORE
                              </div>
                            </div>
                          </div>

                          {/* Direct Team */}
                          <div
                            onClick={() => stats.directTeamMembers.length > 0 && handleViewClick(program.name, 'direct')}
                            className={`px-2 py-2 rounded-lg border transition-all ${
                              stats.directTeamMembers.length > 0
                                ? 'bg-green-50 border-green-200 cursor-pointer active:bg-green-100'
                                : 'bg-gray-50 border-gray-200'
                            } ${isExpanded && viewType === 'direct' ? 'ring-2 ring-green-400' : ''}`}
                          >
                            <div className="text-center">
                              <div className={`text-2xl font-bold ${stats.directTeamMembers.length > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                                {stats.directTeam}
                              </div>
                              <div className="text-[10px] text-gray-600 font-medium leading-tight">
                                DIRECT TEAM
                              </div>
                            </div>
                          </div>

                          {/* Full Team */}
                          <div
                            onClick={() => stats.fullTeamMembers.length > 0 && handleViewClick(program.name, 'full')}
                            className={`px-2 py-2 rounded-lg border transition-all ${
                              stats.fullTeamMembers.length > 0
                                ? 'bg-purple-50 border-purple-200 cursor-pointer active:bg-purple-100'
                                : 'bg-gray-50 border-gray-200'
                            } ${isExpanded && viewType === 'full' ? 'ring-2 ring-purple-400' : ''}`}
                          >
                            <div className="text-center">
                              <div className={`text-2xl font-bold ${stats.fullTeamMembers.length > 0 ? 'text-purple-600' : 'text-gray-400'}`}>
                                {stats.fullTeam}
                              </div>
                              <div className="text-[10px] text-gray-600 font-medium leading-tight">
                                FULL TEAM
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Desktop: One Row Layout (>= 640px) */}
                      <div className="hidden sm:flex items-center justify-between gap-4">
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
                          <div className="border-t border-gray-200 bg-gray-50 p-3 sm:p-4">
                            {/* Header with Toggle */}
                            <div className="flex items-center justify-between mb-3 gap-2">
                              <h4 className="text-xs sm:text-sm font-semibold text-gray-700">
                                {viewType === 'mine' && 'My Enrollment'}
                                {viewType === 'direct' && `Direct Team (${stats.directEnrolledCount} / ${stats.directTeamMembers.length})`}
                                {viewType === 'full' && `Full Team (${stats.fullEnrolledCount} / ${stats.fullTeamMembers.length})`}
                              </h4>
                              
                              {/* Toggle button for non-enrolled members (only show for team views) */}
                              {viewType !== 'mine' && (
                                <button
                                  onClick={() => setShowNotEnrolled(!showNotEnrolled)}
                                  className={`flex items-center gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-medium transition-all ${
                                    showNotEnrolled
                                      ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                      : 'bg-green-100 text-green-700 hover:bg-green-200'
                                  }`}
                                >
                                  {showNotEnrolled ? (
                                    <>
                                      <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                      </svg>
                                      <span className="hidden sm:inline">Hide</span> Not Enrolled
                                    </>
                                  ) : (
                                    <>
                                      <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                      </svg>
                                      <span className="hidden sm:inline">Show</span> Not Enrolled
                                    </>
                                  )}
                                </button>
                              )}
                            </div>
                            
                            {viewType === 'mine' && stats.mine > 0 && (
                              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4 text-center">
                                <div className="text-3xl sm:text-4xl mb-2">✅</div>
                                <p className="text-blue-800 font-semibold text-sm sm:text-base">You're enrolled in this program!</p>
                              </div>
                            )}
                            {viewType === 'mine' && stats.mine === 0 && (
                              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 sm:p-4 text-center">
                                <div className="text-3xl sm:text-4xl mb-2">📋</div>
                                <p className="text-gray-600 font-semibold text-sm sm:text-base">You're not enrolled in this program</p>
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
