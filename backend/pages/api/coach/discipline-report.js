import { getPool } from '../../utils/dbPool.js';
import { calculateTeamDiscipline } from '../../../utils/disciplineCalculations.js';
import { 
  parseDateRange, 
  calculateExpectedPosts,
  calculateDisciplinePercentage,
  getDaysBetween,
  formatDateForMySQL
} from '../../../utils/disciplineHelpers.js';

/**
 * API: Get Coach Discipline Report
 * Returns discipline percentages for all team members
 */
export default async function handler(req, res) {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }
  
  try {
    const { coachId, dateRange, startDate, endDate } = req.query;
    
    // Validation
    if (!coachId) {
      return res.status(400).json({ success: false, message: 'Coach ID required' });
    }
    
    if (!dateRange) {
      return res.status(400).json({ success: false, message: 'Date range required' });
    }
    
    // Parse date range
    const dates = parseDateRange(
      dateRange, 
      dateRange === 'custom' ? startDate : null,
      dateRange === 'custom' ? endDate : null
    );
    
    // DEBUG: Log dates for troubleshooting
    console.log('📅 Discipline Report Date Debug:', {
      dateRange,
      startDate,
      endDate,
      parsedStart: dates.start,
      parsedEnd: dates.end,
      formattedStart: formatDateForMySQL(dates.start),
      formattedEnd: formatDateForMySQL(dates.end)
    });
    
    // Validate custom date range
    if (dateRange === 'custom') {
      if (!startDate || !endDate) {
        return res.status(400).json({ 
          success: false, 
          message: 'Custom date range requires both startDate and endDate' 
        });
      }
      if (dates.start > dates.end) {
        return res.status(400).json({ 
          success: false, 
          message: 'Start date must be before or equal to end date' 
        });
      }
    }
    
    // Connect to database (declared here for proper cleanup in finally block)
    
    
    try {
      const pool = getPool();
    
      // Step 1: Get ALL team members (recursive) + logged-in coach
      const [members] = await pool.execute(`
        WITH RECURSIVE team_hierarchy AS (
          -- Base case: The logged-in coach themselves
          SELECT 
            UserId,
            UserName,
            Email,
            Role,
            EntryDateTime,
            UplineCoachId,
            0 as HierarchyLevel,
            CAST(UserId AS CHAR(500)) as HierarchyPath,
            TRUE as IsLoggedInCoach
          FROM team_table
          WHERE UserId = ?
            AND Status = 'active'
          
          UNION ALL
          
          -- Direct team members (Level 1)
          SELECT 
            t.UserId,
            t.UserName,
            t.Email,
            t.Role,
            t.EntryDateTime,
            t.UplineCoachId,
            1 as HierarchyLevel,
            CAST(t.UserId AS CHAR(500)) as HierarchyPath,
            FALSE as IsLoggedInCoach
          FROM team_table t
          WHERE t.UplineCoachId = ?
            AND t.Status = 'active'
          
          UNION ALL
          
          -- Recursive case: Sub-coaches' team members (Level 2+)
          SELECT 
            t.UserId,
            t.UserName,
            t.Email,
            t.Role,
            t.EntryDateTime,
            t.UplineCoachId,
            th.HierarchyLevel + 1,
            CONCAT(th.HierarchyPath, '>', t.UserId),
            FALSE as IsLoggedInCoach
          FROM team_table t
          INNER JOIN team_hierarchy th ON t.UplineCoachId = th.UserId
          WHERE t.Status = 'active'
            AND th.HierarchyLevel < 10
            AND th.HierarchyLevel > 0
            AND FIND_IN_SET(t.UserId, REPLACE(th.HierarchyPath, '>', ',')) = 0
        )
        SELECT 
          th.UserId,
          th.UserName,
          th.Email,
          th.Role,
          th.EntryDateTime,
          th.UplineCoachId,
          COALESCE(coach.UserName, NULL) as UplineCoachName,
          th.HierarchyLevel,
          th.HierarchyPath,
          th.IsLoggedInCoach
        FROM team_hierarchy th
        LEFT JOIN team_table coach ON th.UplineCoachId = coach.UserId
        ORDER BY th.HierarchyLevel, th.UserName
      `, [coachId, coachId]);
      
      // Step 2: Deduplicate members (keep lowest hierarchy level for each user)
      const uniqueMembers = [];
      const seenUserIds = new Set();
      
      // Sort by HierarchyLevel to keep the closest relationship
      const sortedMembers = [...members].sort((a, b) => a.HierarchyLevel - b.HierarchyLevel);
      
      for (const member of sortedMembers) {
        if (!seenUserIds.has(member.UserId)) {
          seenUserIds.add(member.UserId);
          uniqueMembers.push(member);
        }
      }
      
      // Step 3: Separate logged-in coach from team members
      const loggedInCoach = uniqueMembers.find(m => m.IsLoggedInCoach);
      const teamMembers = uniqueMembers.filter(m => !m.IsLoggedInCoach);
      
      if (uniqueMembers.length === 0) {
return res.status(200).json({
          success: true,
          source: 'realtime',
          lastUpdated: new Date().toISOString(),
          coachId: parseInt(coachId),
          dateRange,
          startDate: dates.start.toISOString().split('T')[0],
          endDate: dates.end.toISOString().split('T')[0],
          coachPerformance: null,
          teamMembers: [],
          coachFilters: [],
          teamSummary: {
            totalMembers: 0,
            totalTeamMembers: 0,
            totalCoaches: 0,
            averagePeriodDiscipline: 0,
            topPerformer: null,
            needsAttention: []
          }
        });
      }
      
      // Helper function to build coach filter options
      const buildCoachFilters = (allMembers, loggedInCoachId) => {
        const filters = [];
        
        // Add "My Team" filter (logged-in coach's direct members)
        const myTeamCount = allMembers.filter(m => 
          m.UplineCoachId === loggedInCoachId && !m.IsLoggedInCoach
        ).length;
        
        if (myTeamCount > 0) {
          filters.push({
            coachId: loggedInCoachId,
            coachName: 'My Team',
            memberCount: myTeamCount,
            isMyTeam: true
          });
        }
        
        // Add other sub-coaches' teams
        allMembers.forEach(member => {
          if (member.Role === 'coach' && !member.IsLoggedInCoach) {
            const teamCount = allMembers.filter(m => m.UplineCoachId === member.UserId).length;
            if (teamCount > 0) {
              filters.push({
                coachId: member.UserId,
                coachName: `${member.UserName}'s Team`,
                memberCount: teamCount,
                isMyTeam: false
              });
            }
          }
        });
        
        return filters;
      };
      
      // Step 1.5: Get current time windows for display
      const [currentTimeWindows] = await pool.execute(`
        SELECT ActivityType, WindowStartTime, WindowEndTime
        FROM activity_time_windows_table
        WHERE EffectiveToDate IS NULL
        ORDER BY FIELD(ActivityType, 'weight', 'education', 'breakfast', 'lunch', 'dinner')
      `);
      
      // Create a map for quick lookup
      const timeWindowMap = {};
      currentTimeWindows.forEach(tw => {
        timeWindowMap[tw.ActivityType] = {
          start: tw.WindowStartTime,
          end: tw.WindowEndTime
        };
      });
      
      // Helper function to format time for display (HH:MM:SS -> h:MM AM/PM)
      const formatTimeForDisplay = (timeStr) => {
        if (!timeStr) return '';
        const [hours, minutes] = timeStr.split(':');
        const hour = parseInt(hours);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
        return `${displayHour}:${minutes} ${ampm}`;
      };
      
      // Step 2: Calculate discipline for coach + all team members
      const allUserIds = uniqueMembers.map(m => m.UserId);  // Includes coach
      const disciplineData = await calculateTeamDiscipline(
        connection,
        allUserIds,
        dates.start,
        dates.end
      );
      
      // Step 3: Build coach filters
      const coachFilters = buildCoachFilters(uniqueMembers, parseInt(coachId));
      
      // Step 4: Format logged-in coach's performance data
      let coachPerformanceData = null;
      if (loggedInCoach) {
        const coachDiscipline = disciplineData.find(d => d.userId === loggedInCoach.UserId);
        
        if (coachDiscipline) {
          // Validate discipline data structure
          if (!coachDiscipline.weight || !coachDiscipline.education || 
              !coachDiscipline.breakfast || !coachDiscipline.lunch || !coachDiscipline.dinner) {
            console.warn('⚠️ Incomplete discipline data for coach:', loggedInCoach.UserId);
          }
          
          // Calculate period discipline with null safety
          const coachTotalOnTimePosts = 
            (coachDiscipline.weight?.onTimePosts || 0) +
            (coachDiscipline.education?.onTimePosts || 0) +
            (coachDiscipline.breakfast?.onTimePosts || 0) +
            (coachDiscipline.lunch?.onTimePosts || 0) +
            (coachDiscipline.dinner?.onTimePosts || 0);
          
          const coachTotalExpectedPosts = calculateExpectedPosts(dates.start, dates.end);
          
          coachPerformanceData = {
            userId: loggedInCoach.UserId,
            userName: loggedInCoach.UserName,
            email: loggedInCoach.Email,
            role: loggedInCoach.Role,
            isLoggedInCoach: true,
            uplineCoachId: loggedInCoach.UplineCoachId,
            uplineCoachName: loggedInCoach.UplineCoachName,
            periodDiscipline: {
              percentage: calculateDisciplinePercentage(
                coachTotalOnTimePosts,
                coachTotalExpectedPosts
              ),
              onTimePosts: coachTotalOnTimePosts,
              expectedPosts: coachTotalExpectedPosts
            },
            activities: {
              weight: {
                percentage: calculateDisciplinePercentage(
                  coachDiscipline.weight?.onTimePosts || 0,
                  coachDiscipline.weight?.expectedPosts || 0
                ),
                onTimePosts: coachDiscipline.weight?.onTimePosts || 0,
                expectedPosts: coachDiscipline.weight?.expectedPosts || 0,
                targetWindow: timeWindowMap.weight 
                  ? `${formatTimeForDisplay(timeWindowMap.weight.start)} - ${formatTimeForDisplay(timeWindowMap.weight.end)}`
                  : 'Not Set'
              },
              education: {
                percentage: calculateDisciplinePercentage(
                  coachDiscipline.education?.onTimePosts || 0,
                  coachDiscipline.education?.expectedPosts || 0
                ),
                onTimePosts: coachDiscipline.education?.onTimePosts || 0,
                expectedPosts: coachDiscipline.education?.expectedPosts || 0,
                targetWindow: timeWindowMap.education 
                  ? `${formatTimeForDisplay(timeWindowMap.education.start)} - ${formatTimeForDisplay(timeWindowMap.education.end)}`
                  : 'Not Set'
              },
              breakfast: {
                percentage: calculateDisciplinePercentage(
                  coachDiscipline.breakfast?.onTimePosts || 0,
                  coachDiscipline.breakfast?.expectedPosts || 0
                ),
                onTimePosts: coachDiscipline.breakfast?.onTimePosts || 0,
                expectedPosts: coachDiscipline.breakfast?.expectedPosts || 0,
                targetWindow: timeWindowMap.breakfast 
                  ? `${formatTimeForDisplay(timeWindowMap.breakfast.start)} - ${formatTimeForDisplay(timeWindowMap.breakfast.end)}`
                  : 'Not Set'
              },
              lunch: {
                percentage: calculateDisciplinePercentage(
                  coachDiscipline.lunch?.onTimePosts || 0,
                  coachDiscipline.lunch?.expectedPosts || 0
                ),
                onTimePosts: coachDiscipline.lunch?.onTimePosts || 0,
                expectedPosts: coachDiscipline.lunch?.expectedPosts || 0,
                targetWindow: timeWindowMap.lunch 
                  ? `${formatTimeForDisplay(timeWindowMap.lunch.start)} - ${formatTimeForDisplay(timeWindowMap.lunch.end)}`
                  : 'Not Set'
              },
              dinner: {
                percentage: calculateDisciplinePercentage(
                  coachDiscipline.dinner?.onTimePosts || 0,
                  coachDiscipline.dinner?.expectedPosts || 0
                ),
                onTimePosts: coachDiscipline.dinner?.onTimePosts || 0,
                expectedPosts: coachDiscipline.dinner?.expectedPosts || 0,
                targetWindow: timeWindowMap.dinner 
                  ? `${formatTimeForDisplay(timeWindowMap.dinner.start)} - ${formatTimeForDisplay(timeWindowMap.dinner.end)}`
                  : 'Not Set'
              }
            }
          };
        }
      }
      
      // Step 5: Format response data (team members only, exclude coach)
      const formattedTeamMembers = teamMembers.map(member => {
        const discipline = disciplineData.find(d => d.userId === member.UserId);
        
        if (!discipline) {
          return null; // Skip members with no data
        }
        
        // Validate discipline data structure (same as coach validation)
        if (!discipline.weight || !discipline.education || 
            !discipline.breakfast || !discipline.lunch || !discipline.dinner) {
          console.warn('⚠️ Incomplete discipline data for team member:', member.UserId);
        }
        
        // Check if this member is also a coach
        const isCoach = member.Role === 'coach';
        const subTeamCount = isCoach 
          ? uniqueMembers.filter(m => m.UplineCoachId === member.UserId).length 
          : 0;
        
        // Calculate percentages for each activity with null safety
        const activities = {
          weight: {
            percentage: calculateDisciplinePercentage(
              discipline.weight?.onTimePosts || 0,
              discipline.weight?.expectedPosts || 0
            ),
            onTimePosts: discipline.weight?.onTimePosts || 0,
            expectedPosts: discipline.weight?.expectedPosts || 0,
            targetWindow: timeWindowMap.weight 
              ? `${formatTimeForDisplay(timeWindowMap.weight.start)} - ${formatTimeForDisplay(timeWindowMap.weight.end)}`
              : 'Not Set'
          },
          education: {
            percentage: calculateDisciplinePercentage(
              discipline.education?.onTimePosts || 0,
              discipline.education?.expectedPosts || 0
            ),
            onTimePosts: discipline.education?.onTimePosts || 0,
            expectedPosts: discipline.education?.expectedPosts || 0,
            targetWindow: timeWindowMap.education 
              ? `${formatTimeForDisplay(timeWindowMap.education.start)} - ${formatTimeForDisplay(timeWindowMap.education.end)}`
              : 'Not Set'
          },
          breakfast: {
            percentage: calculateDisciplinePercentage(
              discipline.breakfast?.onTimePosts || 0,
              discipline.breakfast?.expectedPosts || 0
            ),
            onTimePosts: discipline.breakfast?.onTimePosts || 0,
            expectedPosts: discipline.breakfast?.expectedPosts || 0,
            targetWindow: timeWindowMap.breakfast 
              ? `${formatTimeForDisplay(timeWindowMap.breakfast.start)} - ${formatTimeForDisplay(timeWindowMap.breakfast.end)}`
              : 'Not Set'
          },
          lunch: {
            percentage: calculateDisciplinePercentage(
              discipline.lunch?.onTimePosts || 0,
              discipline.lunch?.expectedPosts || 0
            ),
            onTimePosts: discipline.lunch?.onTimePosts || 0,
            expectedPosts: discipline.lunch?.expectedPosts || 0,
            targetWindow: timeWindowMap.lunch 
              ? `${formatTimeForDisplay(timeWindowMap.lunch.start)} - ${formatTimeForDisplay(timeWindowMap.lunch.end)}`
              : 'Not Set'
          },
          dinner: {
            percentage: calculateDisciplinePercentage(
              discipline.dinner?.onTimePosts || 0,
              discipline.dinner?.expectedPosts || 0
            ),
            onTimePosts: discipline.dinner?.onTimePosts || 0,
            expectedPosts: discipline.dinner?.expectedPosts || 0,
            targetWindow: timeWindowMap.dinner 
              ? `${formatTimeForDisplay(timeWindowMap.dinner.start)} - ${formatTimeForDisplay(timeWindowMap.dinner.end)}`
              : 'Not Set'
          }
        };
        
        // Calculate period discipline with null safety
        const totalOnTimePosts = 
          (discipline.weight?.onTimePosts || 0) +
          (discipline.education?.onTimePosts || 0) +
          (discipline.breakfast?.onTimePosts || 0) +
          (discipline.lunch?.onTimePosts || 0) +
          (discipline.dinner?.onTimePosts || 0);
        
        const totalExpectedPosts = calculateExpectedPosts(dates.start, dates.end);
        const periodDisciplinePercentage = calculateDisciplinePercentage(
          totalOnTimePosts,
          totalExpectedPosts
        );
        
        return {
          userId: member.UserId,
          userName: member.UserName,
          email: member.Email,
          role: member.Role,
          isCoach: isCoach,
          isLoggedInCoach: false,
          subTeamCount: subTeamCount,
          uplineCoachId: member.UplineCoachId,
          uplineCoachName: member.UplineCoachName,
          hierarchyLevel: member.HierarchyLevel,
          profileImage: null, // Column doesn't exist in database
          joinedDate: member.EntryDateTime,
          periodDiscipline: {
            percentage: periodDisciplinePercentage,
            expectedPosts: totalExpectedPosts,
            onTimePosts: totalOnTimePosts,
            daysInPeriod: getDaysBetween(dates.start, dates.end)
          },
          activities
        };
      }).filter(m => m !== null);
      
      // Step 6: Calculate team summary (including coach)
      const allMembersForStats = [];
      if (coachPerformanceData) {
        allMembersForStats.push(coachPerformanceData);
      }
      allMembersForStats.push(...formattedTeamMembers);
      
      const avgPeriodDiscipline = allMembersForStats.length > 0
        ? allMembersForStats.reduce((sum, m) => sum + m.periodDiscipline.percentage, 0) / allMembersForStats.length
        : 0;
      
      const topPerformer = allMembersForStats.length > 0
        ? allMembersForStats.reduce((max, m) => 
            m.periodDiscipline.percentage > max.periodDiscipline.percentage ? m : max
          )
        : null;
      
      const needsAttention = allMembersForStats.filter(m => m.periodDiscipline.percentage < 60);
      
      // Step 7: Close connection and return response
connection = null; // Mark as closed
      
      return res.status(200).json({
        success: true,
        source: 'realtime',
        lastUpdated: new Date().toISOString(),
        coachId: parseInt(coachId),
        dateRange,
        startDate: dates.start.toISOString().split('T')[0],
        endDate: dates.end.toISOString().split('T')[0],
        coachPerformance: coachPerformanceData,
        teamMembers: formattedTeamMembers,
        coachFilters: coachFilters,
        teamSummary: {
          totalMembers: uniqueMembers.length,
          totalTeamMembers: formattedTeamMembers.length,
          totalCoaches: coachFilters.length,
          averagePeriodDiscipline: Math.round(avgPeriodDiscipline * 10) / 10,
          topPerformer: topPerformer ? {
            userId: topPerformer.userId,
            userName: topPerformer.userName,
            discipline: topPerformer.periodDiscipline.percentage
          } : null,
          needsAttention: needsAttention.map(m => ({
            userId: m.userId,
            userName: m.userName,
            discipline: m.periodDiscipline.percentage,
            reason: 'Below 60% threshold'
          }))
        }
      });
      
    } catch (innerError) {
      console.error('❌ Discipline report query error:', innerError);
      throw innerError; // Re-throw to be caught by outer catch
    } finally {
      // Ensure connection is closed even if there's an error
      if (connection) {
        try {
} catch (closeError) {
          console.error('❌ Error closing connection:', closeError);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Discipline report error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve discipline report',
      error: error.message
    });
  }
}
