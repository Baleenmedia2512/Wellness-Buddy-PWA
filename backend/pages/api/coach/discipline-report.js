import mysql from 'mysql2/promise';
import { calculateTeamDiscipline } from '../../../utils/disciplineCalculations.js';
import { 
  parseDateRange, 
  calculateExpectedPosts,
  calculateDisciplinePercentage,
  getDaysBetween 
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
    
    // Connect to database
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME
    });
    
    try {
      // Step 1: Get team members (Note: ProfileImage column doesn't exist in team_table)
      const [members] = await connection.execute(`
        SELECT UserId, UserName, Email, EntryDateTime
        FROM team_table
        WHERE UplineCoachId = ?
          AND Status = 'active'
        ORDER BY UserName
      `, [coachId]);
      
      if (members.length === 0) {
        await connection.end();
        return res.status(200).json({
          success: true,
          source: 'realtime',
          lastUpdated: new Date().toISOString(),
          coachId: parseInt(coachId),
          dateRange,
          startDate: dates.start.toISOString().split('T')[0],
          endDate: dates.end.toISOString().split('T')[0],
          teamMembers: [],
          teamSummary: {
            totalMembers: 0,
            averagePeriodDiscipline: 0
          }
        });
      }
      
      // Step 2: Calculate discipline for all members
      const memberIds = members.map(m => m.UserId);
      const disciplineData = await calculateTeamDiscipline(
        connection,
        memberIds,
        dates.start,
        dates.end
      );
      
      // Step 3: Format response data
      const teamMembers = members.map(member => {
        const discipline = disciplineData.find(d => d.userId === member.UserId);
        
        if (!discipline) {
          return null; // Skip members with no data
        }
        
        // Calculate percentages for each activity
        const activities = {
          weight: {
            percentage: calculateDisciplinePercentage(
              discipline.weight.onTimePosts,
              discipline.weight.expectedPosts
            ),
            onTimePosts: discipline.weight.onTimePosts,
            expectedPosts: discipline.weight.expectedPosts,
            targetWindow: '3:00 AM - 6:30 AM'
          },
          education: {
            percentage: calculateDisciplinePercentage(
              discipline.education.onTimePosts,
              discipline.education.expectedPosts
            ),
            onTimePosts: discipline.education.onTimePosts,
            expectedPosts: discipline.education.expectedPosts,
            targetWindow: '7:15 AM - 8:45 AM'
          },
          breakfast: {
            percentage: calculateDisciplinePercentage(
              discipline.breakfast.onTimePosts,
              discipline.breakfast.expectedPosts
            ),
            onTimePosts: discipline.breakfast.onTimePosts,
            expectedPosts: discipline.breakfast.expectedPosts,
            targetWindow: '5:30 AM - 8:30 AM'
          },
          lunch: {
            percentage: calculateDisciplinePercentage(
              discipline.lunch.onTimePosts,
              discipline.lunch.expectedPosts
            ),
            onTimePosts: discipline.lunch.onTimePosts,
            expectedPosts: discipline.lunch.expectedPosts,
            targetWindow: '12:00 PM - 4:00 PM'
          },
          dinner: {
            percentage: calculateDisciplinePercentage(
              discipline.dinner.onTimePosts,
              discipline.dinner.expectedPosts
            ),
            onTimePosts: discipline.dinner.onTimePosts,
            expectedPosts: discipline.dinner.expectedPosts,
            targetWindow: '5:30 PM - 8:30 PM'
          }
        };
        
        // Calculate period discipline
        const totalOnTimePosts = 
          discipline.weight.onTimePosts +
          discipline.education.onTimePosts +
          discipline.breakfast.onTimePosts +
          discipline.lunch.onTimePosts +
          discipline.dinner.onTimePosts;
        
        const totalExpectedPosts = calculateExpectedPosts(dates.start, dates.end);
        const periodDisciplinePercentage = calculateDisciplinePercentage(
          totalOnTimePosts,
          totalExpectedPosts
        );
        
        return {
          userId: member.UserId,
          userName: member.UserName,
          email: member.Email,
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
      
      // Step 4: Calculate team summary
      const avgPeriodDiscipline = teamMembers.length > 0
        ? teamMembers.reduce((sum, m) => sum + m.periodDiscipline.percentage, 0) / teamMembers.length
        : 0;
      
      const topPerformer = teamMembers.length > 0
        ? teamMembers.reduce((max, m) => 
            m.periodDiscipline.percentage > max.periodDiscipline.percentage ? m : max
          )
        : null;
      
      const needsAttention = teamMembers.filter(m => m.periodDiscipline.percentage < 60);
      
      // Step 5: Close connection and return response
      await connection.end();
      
      return res.status(200).json({
        success: true,
        source: 'realtime',
        lastUpdated: new Date().toISOString(),
        coachId: parseInt(coachId),
        dateRange,
        startDate: dates.start.toISOString().split('T')[0],
        endDate: dates.end.toISOString().split('T')[0],
        teamMembers,
        teamSummary: {
          totalMembers: teamMembers.length,
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
      
    } finally {
      // Ensure connection is closed even if there's an error
      if (connection) {
        await connection.end();
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
