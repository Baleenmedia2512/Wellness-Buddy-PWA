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
    const { coachId, includeInactive } = req.query;
    
    // Validation
    if (!coachId) {
      res.status(400).json({ success: false, message: 'Coach ID required' });
      return;
    }
    
    const supabase = getSupabaseClient();
    const coachIdInt = parseInt(coachId);
    
    // Fetch all users in the hierarchy
    const { data: allUsers, error: usersError } = await supabase
      .from('team_table')
      .select('UserId, UserName, Email, Role, UplineCoachId, Status, CoachName, CoCoachName')
      .eq('Status', includeInactive === 'true' ? undefined : 'Active')
      .order('UserName');
    
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
    
    // Build user map for quick lookup
    const userMap = new Map();
    allUsers.forEach(user => {
      userMap.set(user.UserId, {
        userId: user.UserId,
        userName: user.UserName,
        email: user.Email || '',
        role: user.Role || 'user',
        uplineCoachId: user.UplineCoachId,
        status: user.Status,
        coachName: user.CoachName || '',
        coCoachName: user.CoCoachName || '',
        isCoCoach: (user.CoCoachName && user.CoCoachName.trim() !== ''),
        teamMembers: [],
        directMemberCount: 0,
        totalMemberCount: 0
      });
    });
    
    // Recursive function to build hierarchy
    const buildHierarchy = (userId) => {
      const user = userMap.get(userId);
      if (!user) return null;
      
      // Find all direct reports
      const directReports = allUsers.filter(u => u.UplineCoachId === userId);
      
      user.teamMembers = directReports.map(report => buildHierarchy(report.UserId)).filter(Boolean);
      user.directMemberCount = user.teamMembers.length;
      
      // Calculate total member count (recursive)
      user.totalMemberCount = user.directMemberCount + 
        user.teamMembers.reduce((sum, member) => sum + member.totalMemberCount, 0);
      
      return user;
    };
    
    // Find the logged-in coach
    const loggedInCoach = allUsers.find(u => u.UserId === coachIdInt);
    if (!loggedInCoach) {
      res.status(404).json({ success: false, message: 'Coach not found' });
      return;
    }
    
    // Build hierarchy starting from logged-in coach
    const hierarchy = buildHierarchy(coachIdInt);
    
    // Find all top-level coaches (coaches with no upline or upline is the logged-in coach)
    const topLevelCoaches = allUsers
      .filter(u => 
        (u.Role === 'coach' || u.Role === 'admin') && 
        (u.UplineCoachId === null || u.UplineCoachId === 0 || u.UplineCoachId === coachIdInt)
      )
      .map(coach => buildHierarchy(coach.UserId))
      .filter(Boolean);
    
    // Count statistics
    const coaches = allUsers.filter(u => u.Role === 'coach' || u.Role === 'admin');
    const totalMembers = allUsers.filter(u => u.Role === 'user');
    
    res.status(200).json({
      success: true,
      loggedInCoach: {
        userId: hierarchy.userId,
        userName: hierarchy.userName,
        email: hierarchy.email,
        role: hierarchy.role,
        totalMemberCount: hierarchy.totalMemberCount
      },
      hierarchy: hierarchy,
      topLevelCoaches: topLevelCoaches,
      stats: {
        totalCoaches: coaches.length,
        totalMembers: totalMembers.length,
        totalUsers: allUsers.length
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
