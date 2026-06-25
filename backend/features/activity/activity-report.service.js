/**
 * Activity Report Service
 * Orchestrates activity report generation for downline members
 */
import { getDualCoachingTeamHierarchy } from '../../utils/disciplineCalculationsSupabase.js';
import { ValidationError } from '../../shared/lib/ValidationError.js';
import * as repo from './activity-report.repository.js';

/**
 * Parse date range and return start/end dates
 */
function parseDateRange(dateRange, customStartDate, customEndDate) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  let startDate, endDate;
  
  switch (dateRange) {
    case 'today':
      startDate = new Date(today);
      endDate = new Date(today);
      break;
    case 'yesterday':
      startDate = new Date(today);
      startDate.setDate(startDate.getDate() - 1);
      endDate = new Date(startDate);
      break;
    case 'last7days':
      endDate = new Date(today);
      startDate = new Date(today);
      startDate.setDate(startDate.getDate() - 6);
      break;
    case 'last30days':
      endDate = new Date(today);
      startDate = new Date(today);
      startDate.setDate(startDate.getDate() - 29);
      break;
    case 'custom':
      if (!customStartDate || !customEndDate) {
        throw new ValidationError(400, 'Custom date range requires startDate and endDate');
      }
      startDate = new Date(customStartDate);
      endDate = new Date(customEndDate);
      break;
    default:
      throw new ValidationError(400, 'Invalid dateRange');
  }
  
  return { startDate, endDate };
}

/**
 * Format date for SQL query (YYYY-MM-DD)
 */
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Extract date and time from ISO timestamp
 */
function extractDateTime(timestamp) {
  const dateMatch = String(timestamp || '').match(/^(\d{4}-\d{2}-\d{2})/);
  const timeMatch = String(timestamp || '').match(/(\d{2}:\d{2}:\d{2})/);
  return {
    date: dateMatch ? dateMatch[1] : null,
    time: timeMatch ? timeMatch[1] : null,
  };
}

/**
 * Get activity counts summary for all activity types
 */
export async function getActivitySummary({ userId, role, dateRange, startDate: customStart, endDate: customEnd }) {
  // Parse date range
  const { startDate, endDate } = parseDateRange(dateRange, customStart, customEnd);
  const startStr = formatDate(startDate);
  const endStr = formatDate(endDate);
  
  // Get downline members
  // admin/developer → all active members
  // coach          → their full downline hierarchy
  // member         → only themselves
  let downlineMembers = [];
  if (role === 'admin' || role === 'developer') {
    downlineMembers = await repo.fetchAllActiveMembers();
  } else if (role === 'member') {
    downlineMembers = [{ UserId: userId }];
  } else {
    // coach
    const hierarchy = await getDualCoachingTeamHierarchy(userId, false);
    downlineMembers = hierarchy || [];
  }
  
  const userIds = downlineMembers.map(m => m.UserId).filter(Boolean);
  
  if (userIds.length === 0) {
    return {
      httpStatus: 200,
      body: {
        success: true,
        dateRange,
        startDate: startStr,
        endDate: endStr,
        summary: {
          weight: 0,
          education: 0,
          breakfast: 0,
          lunch: 0,
          dinner: 0,
          water: 0,
          calories: 0,
        },
      },
    };
  }
  
  // Fetch all activity records
  const [weightRecords, educationRecords, foodRecords, stepRecords] = await Promise.all([
    repo.fetchWeightRecords(userIds, startStr, endStr),
    repo.fetchEducationRecords(userIds, startStr, endStr),
    repo.fetchFoodRecords(userIds, startStr, endStr),
    repo.fetchStepRecords(userIds, startStr, endStr),
  ]);
  
  // Get time windows for meal filtering
  const timeWindows = await repo.fetchTimeWindows();
  
  // Count unique members per activity type
  const counts = {
    weight: new Set(weightRecords.map(r => r.UserId)).size,
    education: new Set(educationRecords.map(r => parseInt(r.UserId, 10))).size,
    breakfast: new Set(repo.filterFoodByMealTime(foodRecords, 'breakfast', timeWindows).map(r => parseInt(r.UserID, 10))).size,
    lunch: new Set(repo.filterFoodByMealTime(foodRecords, 'lunch', timeWindows).map(r => parseInt(r.UserID, 10))).size,
    dinner: new Set(repo.filterFoodByMealTime(foodRecords, 'dinner', timeWindows).map(r => parseInt(r.UserID, 10))).size,
    water: new Set(repo.filterWaterRecords(foodRecords).map(r => parseInt(r.UserID, 10))).size,
    calories: new Set(stepRecords.filter(r => (r.Steps || 0) > 0 || (r.CaloriesBurned || 0) > 0).map(r => r.UserId)).size,
  };
  
  return {
    httpStatus: 200,
    body: {
      success: true,
      dateRange,
      startDate: startStr,
      endDate: endStr,
      summary: counts,
    },
  };
}

/**
 * Get per-member education attendance summary for all downline members.
 * Includes members with 0 attendance so coaches can spot who hasn't attended.
 */
export async function getActivityMemberSummary({ userId, role, dateRange, startDate: customStart, endDate: customEnd }) {
  const { startDate, endDate } = parseDateRange(dateRange, customStart, customEnd);
  const startStr = formatDate(startDate);
  const endStr = formatDate(endDate);

  // Get downline members
  let downlineMembers = [];
  if (role === 'admin' || role === 'developer') {
    downlineMembers = await repo.fetchAllActiveMembers();
  } else if (role === 'member') {
    downlineMembers = [{ UserId: userId }];
  } else {
    const hierarchy = await getDualCoachingTeamHierarchy(userId, false);
    downlineMembers = hierarchy || [];
  }

  const userIds = downlineMembers.map(m => m.UserId).filter(Boolean);

  if (userIds.length === 0) {
    return {
      httpStatus: 200,
      body: {
        success: true,
        dateRange,
        startDate: startStr,
        endDate: endStr,
        members: [],
        stats: { totalMembers: 0, attended: 0, notAttended: 0, topMember: null, avgAttendance: 0 },
      },
    };
  }

  // Fetch member details and coach names
  const members = await repo.fetchMemberDetails(userIds);
  const coachIds = [...new Set(members.map(m => m.CoachId).filter(Boolean))];
  const coachNames = await repo.fetchCoachNames(coachIds);

  // Build member info map (keyed by both numeric and string UserId)
  const memberMap = {};
  members.forEach(member => {
    const info = {
      name: member.UserName || 'N/A',
      phone: member.PhoneNumber || 'N/A',
      coachName: coachNames[member.CoachId] || 'N/A',
    };
    memberMap[member.UserId] = info;
    memberMap[String(member.UserId)] = info;
  });

  // Fetch education records and count per member
  const educationRecords = await repo.fetchEducationRecords(userIds, startStr, endStr);
  const countMap = {};
  educationRecords.forEach(record => {
    const key = String(record.UserId);
    countMap[key] = (countMap[key] || 0) + 1;
  });

  // Build member list with counts — include ALL downline members (even 0 attendance)
  const memberList = userIds.map(uid => {
    const info = memberMap[uid] || memberMap[String(uid)] || {};
    return {
      userId: uid,
      memberName: info.name || 'N/A',
      coachName: info.coachName || 'N/A',
      educationCount: countMap[String(uid)] || 0,
    };
  }).sort((a, b) => b.educationCount - a.educationCount);

  // Compute summary stats
  const attended = memberList.filter(m => m.educationCount > 0).length;
  const notAttended = memberList.length - attended;
  const totalCount = memberList.reduce((sum, m) => sum + m.educationCount, 0);
  const topMember = memberList[0]?.educationCount > 0 ? memberList[0] : null;
  const avgAttendance = memberList.length > 0
    ? Math.round((totalCount / memberList.length) * 10) / 10
    : 0;

  return {
    httpStatus: 200,
    body: {
      success: true,
      dateRange,
      startDate: startStr,
      endDate: endStr,
      members: memberList,
      stats: {
        totalMembers: memberList.length,
        attended,
        notAttended,
        topMember: topMember ? { name: topMember.memberName, count: topMember.educationCount } : null,
        avgAttendance,
      },
    },
  };
}

/**
 * Get detailed activity records for a specific activity type
 */
export async function getActivityDetails({ userId, role, activityType, dateRange, startDate: customStart, endDate: customEnd }) {
  // Parse date range
  const { startDate, endDate } = parseDateRange(dateRange, customStart, customEnd);
  const startStr = formatDate(startDate);
  const endStr = formatDate(endDate);
  
  // Get downline members
  // admin/developer → all active members
  // coach          → their full downline hierarchy
  // member         → only themselves
  let downlineMembers = [];
  if (role === 'admin' || role === 'developer') {
    downlineMembers = await repo.fetchAllActiveMembers();
  } else if (role === 'member') {
    downlineMembers = [{ UserId: userId }];
  } else {
    // coach
    const hierarchy = await getDualCoachingTeamHierarchy(userId, false);
    downlineMembers = hierarchy || [];
  }
  
  const userIds = downlineMembers.map(m => m.UserId).filter(Boolean);
  
  if (userIds.length === 0) {
    return {
      httpStatus: 200,
      body: {
        success: true,
        activityType,
        dateRange,
        startDate: startStr,
        endDate: endStr,
        records: [],
      },
    };
  }
  
  // Fetch member details and coach names
  const members = await repo.fetchMemberDetails(userIds);
  const coachIds = [...new Set(members.map(m => m.CoachId).filter(Boolean))];
  const coachNames = await repo.fetchCoachNames(coachIds);
  
  // Build member info map — keyed by both numeric and string UserId
  // because education_logs_table stores UserId as string while others are numeric
  // NOTE: team_table does NOT have City/Village columns — education records
  // carry their own City/Village from education_logs_table directly.
  const memberMap = {};
  members.forEach(member => {
    const info = {
      name: member.UserName || 'N/A',
      phone: member.PhoneNumber || 'N/A',
      email: member.Email || '',
      city: 'N/A',
      village: 'N/A',
      role: member.Role || 'member',
      coachName: coachNames[member.CoachId] || 'N/A',
    };
    memberMap[member.UserId] = info;         // numeric key
    memberMap[String(member.UserId)] = info; // string key
  });
  
  let records = [];
  
  // Fetch activity-specific records
  switch (activityType) {
    case 'weight':
      {
        const weightRecords = await repo.fetchWeightRecords(userIds, startStr, endStr);
        records = weightRecords.map(record => {
          const member = memberMap[record.UserId] || {};
          const { date, time } = extractDateTime(record.CreatedAt);
          return {
            userId: record.UserId,
            memberName: member.name,
            city: record.City || member.city || 'N/A',
            village: record.Village || member.village || 'N/A',
            phone: member.phone,
            coachName: member.coachName,
            date,
            time,
            clubName: record.CenterName || 'N/A',
            weight: record.Weight || 'N/A',
          };
        });
      }
      break;
      
    case 'education':
      {
        const educationRecords = await repo.fetchEducationRecords(userIds, startStr, endStr);
        
        // Fetch nutrition center names for records that don't have center_name stored
        const centerIds = [...new Set(
          educationRecords
            .filter(r => !r.center_name && r.nutrition_center_id)
            .map(r => r.nutrition_center_id)
        )];
        const centerMap = centerIds.length > 0 ? await repo.fetchNutritionCenters(centerIds) : {};
        
        records = educationRecords.map(record => {
          // UserId in education_logs_table is stored as string
          const uidKey = String(record.UserId);
          const member = memberMap[uidKey] || {};
          const { date, time } = extractDateTime(record.CreatedAt);
          // Prefer the stored center_name; fall back to looked-up center name
          const clubName = record.center_name || centerMap[record.nutrition_center_id] || 'N/A';
          
          return {
            userId: uidKey,
            memberName: member.name || 'N/A',
            city: record.City || member.city || 'N/A',
            village: record.Village || member.village || 'N/A',
            phone: member.phone || 'N/A',
            coachName: member.coachName || 'N/A',
            date,
            time,
            clubName,
            attendanceType: record.attendance_type || 'N/A',
            topic: record.Topic || 'N/A',
          };
        });
      }
      break;
      
    case 'breakfast':
    case 'lunch':
    case 'dinner':
      {
        const foodRecords = await repo.fetchFoodRecords(userIds, startStr, endStr);
        const timeWindows = await repo.fetchTimeWindows();
        const mealRecords = repo.filterFoodByMealTime(foodRecords, activityType, timeWindows);
        
        records = mealRecords.map(record => {
          const memberUserId = parseInt(record.UserID, 10);
          const member = memberMap[memberUserId] || {};
          const { date, time } = extractDateTime(record.CreatedAt);
          
          return {
            userId: memberUserId,
            memberName: member.name,
            city: record.City || member.city || 'N/A',
            village: record.Village || member.village || 'N/A',
            phone: member.phone,
            coachName: member.coachName,
            date,
            time,
            clubName: record.CenterName || 'N/A',
            calories: record.TotalCalories || 0,
            mealType: activityType,
          };
        });
      }
      break;
      
    case 'water':
      {
        const foodRecords = await repo.fetchFoodRecords(userIds, startStr, endStr);
        const waterRecords = repo.filterWaterRecords(foodRecords);
        
        records = waterRecords.map(record => {
          const memberUserId = parseInt(record.UserID, 10);
          const member = memberMap[memberUserId] || {};
          const { date, time } = extractDateTime(record.CreatedAt);
          const volumeLiters = repo.calculateWaterVolume(record);
          
          return {
            userId: memberUserId,
            memberName: member.name,
            city: record.City || member.city || 'N/A',
            village: record.Village || member.village || 'N/A',
            phone: member.phone,
            coachName: member.coachName,
            date,
            time,
            clubName: record.CenterName || 'N/A',
            waterLiters: volumeLiters,
          };
        });
      }
      break;
      
    case 'calories':
      {
        const stepRecords = await repo.fetchStepRecords(userIds, startStr, endStr);
        
        records = stepRecords.map(record => {
          const member = memberMap[record.UserId] || {};
          const { date, time } = extractDateTime(record.CreatedAt);
          
          return {
            userId: record.UserId,
            memberName: member.name,
            city: member.city,
            village: member.village,
            phone: member.phone,
            coachName: member.coachName,
            date,
            time,
            clubName: 'N/A',
            caloriesBurned: record.CaloriesBurned || 0,
            steps: record.Steps || 0,
          };
        });
      }
      break;
      
    default:
      throw new ValidationError(400, `Invalid activityType: ${activityType}`);
  }
  
  return {
    httpStatus: 200,
    body: {
      success: true,
      activityType,
      dateRange,
      startDate: startStr,
      endDate: endStr,
      records,
    },
  };
}
