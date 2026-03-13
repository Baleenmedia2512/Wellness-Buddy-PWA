import { getSupabaseClient } from '../../../utils/supabaseClient.js';

/**
 * API: Get Hierarchical Team Structure
 * Returns nested team hierarchy for the All Teams view
 * Supports multi-level Coach → Co-Coach → Members structure
 */
export default async function handler(req, res) {
  // Prevent caching
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  // Handle CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ success: false, message: 'Method not allowed' });
    return;
  }
  
  try {
    const { coachId, email, includeInactive } = req.query;
    
    console.log('📊 [team-hierarchy] Request:', { coachId, email, includeInactive });
    
    const supabase = getSupabaseClient();
    let coachIdInt;
    
    // If email is provided, look up the coach ID
    if (email) {
      console.log('🔍 [team-hierarchy] Looking up coach by email:', email);
      const { data: coach, error: coachError } = await supabase
        .from('team_table')
        .select('UserId')
        .eq('Email', email)
        .maybeSingle();
      
      if (coachError) {
        console.error('❌ [team-hierarchy] Email lookup error:', coachError);
        res.status(500).json({ success: false, message: 'Database error: ' + coachError.message });
        return;
      }
      
      if (!coach) {
        console.error('❌ [team-hierarchy] Coach not found for email:', email);
        res.status(404).json({ success: false, message: 'Coach not found' });
        return;
      }
      
      coachIdInt = coach.UserId;
      console.log('✅ [team-hierarchy] Found coach ID:', coachIdInt);
    } else if (coachId) {
      coachIdInt = parseInt(coachId);
      console.log('✅ [team-hierarchy] Using provided coach ID:', coachIdInt);
    } else {
      console.error('❌ [team-hierarchy] No coach ID or email provided');
      res.status(400).json({ success: false, message: 'Coach ID or email required' });
      return;
    }
    
    // Fetch all users in the hierarchy
    let query = supabase
      .from('team_table')
      .select('UserId, UserName, Email, Role, CoachId, CoCoachId, Status');
    
    // Only filter by Active status if includeInactive is not true
    if (includeInactive !== 'true') {
      query = query.eq('Status', 'Active');
    }
    
    const { data: allUsers, error: usersError } = await query.order('UserName');
    
    if (usersError) {
      console.error('Error fetching users:', usersError);
      res.status(500).json({ success: false, message: 'Failed to fetch team data' });
      return;
    }
    
    if (!allUsers || allUsers.length === 0) {
      res.status(200).json({
        success: true,
        hierarchy: [],
        totalCoaches: 0,
        totalMembers: 0
      });
      return;
    }
    
    // Get all coach names for CoachId and CoCoachId
    const allCoachIds = new Set();
    allUsers.forEach(user => {
      if (user.CoachId) allCoachIds.add(user.CoachId);
      if (user.CoCoachId) allCoachIds.add(user.CoCoachId);
    });
    
    const coachNameMap = {};
    if (allCoachIds.size > 0) {
      const { data: coaches } = await supabase
        .from('team_table')
        .select('UserId, UserName')
        .in('UserId', Array.from(allCoachIds));
      
      if (coaches) {
        coaches.forEach(c => {
          coachNameMap[c.UserId] = c.UserName;
        });
      }
    }
    
    // Build user map for quick lookup
    const userMap = new Map();
    allUsers.forEach(user => {
      userMap.set(user.UserId, {
        userId: user.UserId,
        userName: user.UserName,
        email: user.Email || '',
        role: user.Role || 'user',
        coachId: user.CoachId,
        coCoachId: user.CoCoachId,
        coachName: coachNameMap[user.CoachId] || '',
        coCoachName: coachNameMap[user.CoCoachId] || '',
        status: user.Status,
        teamMembers: [],
        directMemberCount: 0,
        totalMemberCount: 0
      });
    });
    
    // Recursive function to build hierarchy (creates duplicate entries for dual reporting)
    const buildHierarchy = (userId, parentCoachId = null, visited = new Set()) => {
      const user = userMap.get(userId);
      if (!user) return null;
      
      // Prevent circular references - check if we've already visited this user in current path
      if (visited.has(userId)) {
        console.warn(`Circular reference detected for userId: ${userId}`);
        return null;
      }
      
      // Add to visited set for this path
      const newVisited = new Set(visited);
      newVisited.add(userId);
      
      // Clone user data for this specific relationship path
      const userNode = {
        ...user,
        parentCoachId, // Track which coach this entry reports through
        teamMembers: []
      };
      
      // Find all direct reports (where CoachId OR CoCoachId matches userId)
      const directReports = allUsers.filter(u => 
        (u.CoachId === userId || u.CoCoachId === userId) && u.UserId !== userId
      );
      
      // For each direct report, create entries for BOTH coach and co-coach relationships
      directReports.forEach(report => {
        // Skip if report is the same as current user (self-reference)
        if (report.UserId === userId) return;
        
        // If this user reports through CoachId
        if (report.CoachId === userId) {
          const childNode = buildHierarchy(report.UserId, userId, newVisited);
          if (childNode) {
            childNode.isCoachRelationship = true;
            userNode.teamMembers.push(childNode);
          }
        }
        
        // If this user reports through CoCoachId (and it's different from CoachId)
        if (report.CoCoachId === userId && report.CoCoachId !== report.CoachId) {
          const childNode = buildHierarchy(report.UserId, userId, newVisited);
          if (childNode) {
            childNode.isCoachRelationship = false;
            userNode.teamMembers.push(childNode);
          }
        }
      });
      
      userNode.directMemberCount = userNode.teamMembers.length;
      
      // Calculate total member count (recursive)
      userNode.totalMemberCount = userNode.directMemberCount + 
        userNode.teamMembers.reduce((sum, member) => sum + member.totalMemberCount, 0);
      
      return userNode;
    };
    
    // Find the logged-in coach
    const loggedInCoach = allUsers.find(u => u.UserId === coachIdInt);
    if (!loggedInCoach) {
      res.status(404).json({ success: false, message: 'Coach not found' });
      return;
    }
    
    // Build hierarchy starting from logged-in coach
    const hierarchy = buildHierarchy(coachIdInt);
    
    // Flatten hierarchy to get all members (for enrollment reports)
    // Use Set to avoid duplicates from dual reporting relationships
    const flattenHierarchy = (node, result = new Map()) => {
      if (!node) return result;
      
      // Add current node (excluding the root coach for allMembers)
      // Use Map to ensure unique users by UserId
      if (node.userId !== coachIdInt && !result.has(node.userId)) {
        result.set(node.userId, {
          UserId: node.userId,
          UserName: node.userName,
          Email: node.email,
          Role: node.role,
          CoachId: node.coachId,
          CoCoachId: node.coCoachId,
          coachName: node.coachName,
          coCoachName: node.coCoachName,
          Status: node.status,
        });
      }
      
      // Recursively flatten children
      if (node.teamMembers && node.teamMembers.length > 0) {
        node.teamMembers.forEach(child => flattenHierarchy(child, result));
      }
      
      return result;
    };
    
    const memberMap = flattenHierarchy(hierarchy);
    const allMembers = Array.from(memberMap.values());
    
    console.log(`✅ Team hierarchy built for coach ${coachIdInt}: ${allMembers.length} unique members`);
    
    // Count statistics (use unique users)
    const uniqueUserIds = new Set(allUsers.map(u => u.UserId));
    const coaches = allUsers.filter(u => u.Role === 'coach' || u.Role === 'admin');
    const totalMembers = allUsers.filter(u => u.Role === 'user');
    
    res.status(200).json({
      success: true,
      loggedInCoach: {
        userId: hierarchy.userId,
        userName: hierarchy.userName,
        email: hierarchy.email,
        role: hierarchy.role,
        coachId: hierarchy.coachId,
        coCoachId: hierarchy.coCoachId,
        coachName: hierarchy.coachName,
        coCoachName: hierarchy.coCoachName,
        totalMemberCount: hierarchy.totalMemberCount
      },
      hierarchy: hierarchy,
      allMembers: allMembers, // Flat array of all unique team members
      stats: {
        totalCoaches: coaches.length,
        totalMembers: totalMembers.length,
        totalUsers: uniqueUserIds.size
      }
    });
    
  } catch (error) {
    console.error('Team hierarchy error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error',
      error: error.message 
    });
  }
}
