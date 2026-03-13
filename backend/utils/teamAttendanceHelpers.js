/**
 * Team Attendance Helper Functions
 * Reusable utilities for calculating team attendance statistics in hierarchical structures
 */

/**
 * Calculate full team statistics (all descendants recursively)
 * @param {Array} children - Array of child nodes with attendance data
 * @param {Function} isAttendedFn - Function to check if a child has attended (receives child node)
 * @returns {{total: number, attended: number}} - Total count and attended count
 */
export function calculateFullTeamStats(children, isAttendedFn = (child) => child?.attendance?.attended) {
  let total = 0;
  let attended = 0;
  
  children.forEach(child => {
    total++; // Count this child
    if (isAttendedFn(child)) attended++;
    
    // Recursively count descendants
    if (child.teamMembers && child.teamMembers.length > 0) {
      const descendantStats = calculateFullTeamStats(child.teamMembers, isAttendedFn);
      total += descendantStats.total;
      attended += descendantStats.attended;
    }
  });
  
  return { total, attended };
}

/**
 * Add team attendance counts to a hierarchical node structure
 * This function processes a hierarchy and adds directTeamCount and fullTeamCount to each node
 * 
 * @param {Object} node - The node to process
 * @param {Map} attendanceMap - Map of userId -> attendance data
 * @param {Function} transformFn - Optional function to transform attendance data (receives userId, attendanceMap)
 * @returns {Object} - Node with added team counts and processed children
 * 
 * @example
 * const hierarchy = getDualCoachingTeamHierarchy(userId);
 * const nodeWithCounts = addTeamAttendanceCounts(hierarchy[0], attendanceMap);
 * console.log(nodeWithCounts.directTeamCount); // { total: 3, attended: 2 }
 * console.log(nodeWithCounts.fullTeamCount);   // { total: 10, attended: 7 }
 */
export function addTeamAttendanceCounts(node, attendanceMap, transformFn = null) {
  const attendance = attendanceMap.get(node.UserId);
  
  // Process children first
  const processedChildren = node.teamMembers 
    ? node.teamMembers.map(child => addTeamAttendanceCounts(child, attendanceMap, transformFn)) 
    : [];
  
  // Calculate direct team stats (immediate children only)
  const directTeamTotal = processedChildren.length;
  const directTeamAttended = processedChildren.filter(child => child.attendance?.attended).length;
  
  // Calculate full team stats (all descendants recursively)
  const fullTeamStats = calculateFullTeamStats(processedChildren);
  
  // Transform attendance data if custom function provided
  const attendanceData = transformFn 
    ? transformFn(node.UserId, attendanceMap, attendance)
    : (attendance ? {
        attended: true,
        data: attendance,
      } : {
        attended: false,
        data: null,
      });
  
  return {
    userId: node.UserId,
    userName: node.UserName,
    email: node.Email,
    role: node.Role,
    coachId: node.CoachId,
    coCoachId: node.CoCoachId,
    coachName: node.CoachName,
    coCoachName: node.CoCoachName,
    profileImage: node.ProfileImage || null,
    hierarchyLevel: node.HierarchyLevel,
    // Attendance data
    attendance: attendanceData,
    // Team attendance counts
    directTeamCount: {
      total: directTeamTotal,
      attended: directTeamAttended,
    },
    fullTeamCount: {
      total: fullTeamStats.total,
      attended: fullTeamStats.attended,
    },
    teamMembers: processedChildren,
  };
}

/**
 * Build hierarchical structure from flat team array with attendance counts
 * @param {Array} members - Flat array of team members
 * @param {Map} attendanceMap - Map of userId -> attendance data
 * @param {Function} transformFn - Optional function to transform attendance data
 * @returns {Object|null} - Root node of hierarchy with attendance counts, or null if no root found
 * 
 * @example
 * const teamHierarchy = await getDualCoachingTeamHierarchy(userId);
 * const attendanceMap = new Map([[123, { clubs: [...], timestamps: [...] }]]);
 * const hierarchy = buildHierarchyWithAttendanceCounts(teamHierarchy, attendanceMap);
 */
export function buildHierarchyWithAttendanceCounts(members, attendanceMap, transformFn = null) {
  // Create user map
  const userMap = new Map();
  members.forEach(member => {
    userMap.set(member.UserId, {
      ...member,
      teamMembers: [],
    });
  });

  // Build parent-child relationships
  members.forEach(member => {
    if (member.HierarchyParent && member.HierarchyLevel > 0) {
      const parent = userMap.get(member.HierarchyParent);
      const child = userMap.get(member.UserId);
      if (parent && child) {
        parent.teamMembers.push(child);
      }
    }
  });

  // Find root (logged-in user)
  const root = members.find(m => m.IsLoggedInCoach && m.HierarchyLevel === 0);
  if (!root) return null;

  return addTeamAttendanceCounts(userMap.get(root.UserId), attendanceMap, transformFn);
}

/**
 * Calculate attendance statistics for a hierarchy
 * @param {Object} hierarchy - Root node of hierarchy
 * @returns {{totalMembers: number, totalAttendees: number, attendanceRate: number}}
 */
export function calculateHierarchyStats(hierarchy) {
  if (!hierarchy) {
    return { totalMembers: 0, totalAttendees: 0, attendanceRate: 0 };
  }
  
  // Include the root user in the count
  const totalMembers = 1 + (hierarchy.fullTeamCount?.total || 0);
  const rootAttended = hierarchy.attendance?.attended ? 1 : 0;
  const totalAttendees = rootAttended + (hierarchy.fullTeamCount?.attended || 0);
  const attendanceRate = totalMembers > 0 ? (totalAttendees / totalMembers) * 100 : 0;
  
  return {
    totalMembers,
    totalAttendees,
    attendanceRate: Math.round(attendanceRate * 10) / 10, // Round to 1 decimal
  };
}
