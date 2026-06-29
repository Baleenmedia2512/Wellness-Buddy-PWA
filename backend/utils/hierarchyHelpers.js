/**
 * Hierarchy Helper Functions
 * Generic reusable utilities for calculating team statistics in hierarchical structures
 * Works for ANY metric: attendance, discipline, weight loss, activity counts, etc.
 */

/**
 * Calculate full team statistics (all descendants recursively)
 * Generic function that works with any condition/metric
 * 
 * @param {Array} children - Array of child nodes
 * @param {Function} conditionFn - Function to check if condition is met (receives child node)
 *                                 Examples:
 *                                 - (child) => child?.attendance?.attended  // For attendance
 *                                 - (child) => child?.discipline?.score >= 80  // For discipline
 *                                 - (child) => child?.metrics?.weightLoss > 0  // For weight loss
 * @returns {{total: number, qualified: number}} - Total count and qualified count
 * 
 * @example
 * // For attendance
 * const stats = calculateFullTeamStats(children, (child) => child?.attendance?.attended);
 * 
 * // For discipline score >= 80
 * const stats = calculateFullTeamStats(children, (child) => child?.discipline?.score >= 80);
 */
export function calculateFullTeamStats(children, conditionFn = (child) => false) {
  let total = 0;
  let qualified = 0;
  
  children.forEach(child => {
    total++; // Count this child
    if (conditionFn(child)) qualified++;
    
    // Recursively count descendants
    if (child.teamMembers && child.teamMembers.length > 0) {
      const descendantStats = calculateFullTeamStats(child.teamMembers, conditionFn);
      total += descendantStats.total;
      qualified += descendantStats.qualified;
    }
  });
  
  return { total, qualified };
}

/**
 * Add team metric counts to a hierarchical node structure
 * Generic function that works for any metric/condition
 * 
 * @param {Object} node - The node to process (from getDualCoachingTeamHierarchy)
 * @param {Map} dataMap - Map of userId -> metric data (can be attendance, discipline, etc.)
 * @param {Function} transformFn - Function to transform data for this node
 *                                 Receives: (userId, dataMap, nodeData)
 *                                 Returns: Object with your custom structure
 * @param {Function} conditionFn - Function to check if condition is met
 *                                 Receives: (processedChild)
 *                                 Returns: boolean
 * @returns {Object} - Node with added team counts and processed children
 * 
 * @example
 * // For club attendance
 * const node = addTeamMetricCounts(
 *   rawNode,
 *   attendanceMap,
 *   (userId, map, data) => data ? { attended: true, clubs: data.clubs } : { attended: false },
 *   (child) => child.metrics?.attended === true
 * );
 * 
 * // For discipline score
 * const node = addTeamMetricCounts(
 *   rawNode,
 *   disciplineMap,
 *   (userId, map, data) => ({ score: data?.score || 0, grade: data?.grade || 'F' }),
 *   (child) => child.metrics?.score >= 80
 * );
 */
export function addTeamMetricCounts(node, dataMap, transformFn = null, conditionFn = null) {
  const nodeData = dataMap.get(node.UserId);
  
  // Process children first
  const processedChildren = node.teamMembers 
    ? node.teamMembers.map(child => addTeamMetricCounts(child, dataMap, transformFn, conditionFn)) 
    : [];
  
  // Default condition function: check if metrics exists and has data
  const defaultConditionFn = conditionFn || ((child) => {
    return child.metrics && Object.keys(child.metrics).length > 0;
  });
  
  // Calculate direct team stats (immediate children only)
  const directTeamTotal = processedChildren.length;
  const directTeamQualified = processedChildren.filter(child => defaultConditionFn(child)).length;
  
  // Calculate direct team clubs count (for club ownership report)
  const directTeamClubs = processedChildren.reduce((sum, child) => {
    return sum + (child.metrics?.totalClubs || 0);
  }, 0);
  
  // Calculate full team stats (all descendants recursively)
  const fullTeamStats = calculateFullTeamStats(processedChildren, defaultConditionFn);
  
  // Calculate full team clubs count recursively
  const fullTeamClubs = calculateFullTeamClubs(processedChildren);
  
  // Transform data using custom function or use default structure
  const metricsData = transformFn 
    ? transformFn(node.UserId, dataMap, nodeData)
    : (nodeData ? { hasData: true, data: nodeData } : { hasData: false, data: null });
  
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
    isCoCoach: node.IsCoCoach || false,
    hierarchyLevel: node.HierarchyLevel,
    // Generic metrics data (structure depends on transformFn)
    metrics: metricsData,
    // Team metric counts
    directTeamCount: {
      total: directTeamTotal,
      qualified: directTeamQualified,
      totalClubs: directTeamClubs,
    },
    fullTeamCount: {
      total: fullTeamStats.total,
      qualified: fullTeamStats.qualified,
      totalClubs: fullTeamClubs,
    },
    teamMembers: processedChildren,
  };
}

/**
 * Calculate total clubs owned by full team recursively
 * @param {Array} children - Array of child nodes
 * @returns {number} - Total clubs count
 */
function calculateFullTeamClubs(children) {
  let totalClubs = 0;
  
  children.forEach(child => {
    totalClubs += (child.metrics?.totalClubs || 0);
    
    // Recursively count descendant clubs
    if (child.teamMembers && child.teamMembers.length > 0) {
      totalClubs += calculateFullTeamClubs(child.teamMembers);
    }
  });
  
  return totalClubs;
}

/**
 * Build hierarchical structure from flat team array with metric counts
 * Generic function that works for any type of report
 * 
 * @param {Array} members - Flat array of team members from getDualCoachingTeamHierarchy()
 * @param {Map} dataMap - Map of userId -> metric data (attendance, discipline, etc.)
 * @param {Function} transformFn - Function to transform data for each node
 * @param {Function} conditionFn - Function to check if condition is met for counting
 * @returns {Object|null} - Root node of hierarchy with metric counts, or null if no root found
 * 
 * @example
 * // For attendance report
 * const hierarchy = buildHierarchyWithMetricCounts(
 *   teamHierarchy,
 *   attendanceMap,
 *   (userId, map, data) => data ? { 
 *     attended: true, 
 *     clubs: data.clubs 
 *   } : { 
 *     attended: false 
 *   },
 *   (child) => child.metrics?.attended === true
 * );
 * 
 * // For weight loss report
 * const hierarchy = buildHierarchyWithMetricCounts(
 *   teamHierarchy,
 *   weightMap,
 *   (userId, map, data) => ({
 *     currentWeight: data?.current,
 *     previousWeight: data?.previous,
 *     loss: data?.loss
 *   }),
 *   (child) => child.metrics?.loss > 0
 * );
 */
export function buildHierarchyWithMetricCounts(members, dataMap, transformFn = null, conditionFn = null) {
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

  return addTeamMetricCounts(userMap.get(root.UserId), dataMap, transformFn, conditionFn);
}

/**
 * Calculate overall statistics for a hierarchy
 * Works with any metric type
 * 
 * @param {Object} hierarchy - Root node of hierarchy (from buildHierarchyWithMetricCounts)
 * @param {Function} conditionFn - Function to check if root user meets condition
 * @returns {{totalMembers: number, qualifiedMembers: number, qualificationRate: number}}
 * 
 * @example
 * const stats = calculateHierarchyStats(
 *   hierarchy,
 *   (root) => root.metrics?.attended === true
 * );
 * // Returns: { totalMembers: 21, qualifiedMembers: 15, qualificationRate: 71.4 }
 */
export function calculateHierarchyStats(hierarchy, conditionFn = null) {
  if (!hierarchy) {
    return { totalMembers: 0, qualifiedMembers: 0, qualificationRate: 0 };
  }
  
  // Include the root user in the count
  const totalMembers = 1 + (hierarchy.fullTeamCount?.total || 0);
  
  // Check if root meets condition
  const defaultConditionFn = conditionFn || ((root) => {
    return root.metrics && Object.keys(root.metrics).length > 0;
  });
  
  const rootQualified = defaultConditionFn(hierarchy) ? 1 : 0;
  const qualifiedMembers = rootQualified + (hierarchy.fullTeamCount?.qualified || 0);
  const qualificationRate = totalMembers > 0 ? (qualifiedMembers / totalMembers) * 100 : 0;
  
  return {
    totalMembers,
    qualifiedMembers,
    qualificationRate: Math.round(qualificationRate * 10) / 10, // Round to 1 decimal
  };
}

/**
 * Helper: Build a simple data map from an array of records
 * Useful for quickly creating maps from database query results
 * 
 * @param {Array} records - Array of records from database
 * @param {string} userIdField - Field name for user ID (default: 'UserId')
 * @param {Function} transformFn - Optional function to transform each record
 * @returns {Map} - Map of userId -> transformed data
 * 
 * @example
 * // Simple map with full records
 * const map = buildDataMap(attendanceLogs);
 * 
 * // Map with transformed data
 * const map = buildDataMap(
 *   disciplineRecords,
 *   'UserId',
 *   (record) => ({ score: record.Score, grade: record.Grade })
 * );
 */
export function buildDataMap(records, userIdField = 'UserId', transformFn = null) {
  const map = new Map();
  records.forEach(record => {
    const userId = record[userIdField];
    const data = transformFn ? transformFn(record) : record;
    map.set(userId, data);
  });
  return map;
}

/**
 * Resolves the effective coach for a user, handling inactive coaches.
 * 
 * Business Logic:
 * - If the user's coach is Active, return that coach
 * - If the user's coach is Inactive, recursively find the first Active coach up the chain
 * - If no Active coach is found, return null
 * 
 * This keeps the database hierarchy intact but resolves to active coaches at runtime.
 * 
 * @param {string} userId - The user's UserId
 * @param {Object} supabase - Supabase client instance
 * @returns {Promise<{coachId: string|null, coachName: string|null, isOriginalCoach: boolean}>}
 * 
 * @example
 * // Member1's coach is Ramesh (inactive), Ramesh's coach is Yasheer (active)
 * const result = await resolveActiveCoach('member1_id', supabase);
 * // => { coachId: 'yasheer_id', coachName: 'Yasheer', isOriginalCoach: false }
 */
export async function resolveActiveCoach(userId, supabase) {
  const MAX_DEPTH = 10; // Prevent infinite loops
  let currentUserId = userId;
  let depth = 0;
  
  while (depth < MAX_DEPTH) {
    // Get the coach for the current user
    const { data, error } = await supabase
      .from('team_table')
      .select('CoachId, Status, UserName')
      .eq('UserId', currentUserId)
      .single();
    
    if (error || !data || !data.CoachId) {
      // No coach found or reached top of hierarchy
      return { coachId: null, coachName: null, isOriginalCoach: depth === 0 };
    }
    
    // Get the coach's details
    const { data: coachData, error: coachError } = await supabase
      .from('team_table')
      .select('UserId, Status, UserName')
      .eq('UserId', data.CoachId)
      .single();
    
    if (coachError || !coachData) {
      return { coachId: null, coachName: null, isOriginalCoach: depth === 0 };
    }
    
    // If coach is Active, return them
    if (coachData.Status === 'Active') {
      return {
        coachId: coachData.UserId,
        coachName: coachData.UserName,
        isOriginalCoach: depth === 0,
      };
    }
    
    // Coach is Inactive, move up the hierarchy
    currentUserId = coachData.UserId;
    depth++;
  }
  
  // Max depth reached, return null
  return { coachId: null, coachName: null, isOriginalCoach: false };
}
