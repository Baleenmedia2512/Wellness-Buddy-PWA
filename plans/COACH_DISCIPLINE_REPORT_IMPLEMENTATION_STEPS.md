# Coach Discipline Report - Step-by-Step Implementation Guide

**Feature**: Discipline Report Dashboard for Coaches  
**Implementation Date**: December 26, 2025  
**Estimated Time**: 7 Days  
**Approach**: Query-Based Calculation (No Cache, No Stored Scores)

---

## 📋 QUICK START CHECKLIST

- [ ] Phase 1: Database Setup (Day 1-2)
- [ ] Phase 2: Backend API (Day 3-4)
- [ ] Phase 3: Frontend Dashboard (Day 5-6)
- [ ] Phase 4: Admin Time Window Modal (Day 7)
- [ ] Phase 5: Testing & Deployment

---

## 🎯 PHASE 1: DATABASE SETUP (Day 1-2)

### Step 1.1: Create Time Windows Table

**File**: `sql/create_activity_time_windows.sql`

```sql
-- Create time window versioning table
CREATE TABLE IF NOT EXISTS activity_time_windows_table (
  ID INT AUTO_INCREMENT PRIMARY KEY,
  
  -- Which activity this applies to
  ActivityType VARCHAR(50) NOT NULL COMMENT 'weight, education, breakfast, lunch, dinner',
  
  -- Time window definition
  WindowStartTime TIME NOT NULL COMMENT 'Start of on-time window (e.g., 03:00:00)',
  WindowEndTime TIME NOT NULL COMMENT 'End of on-time window (e.g., 06:30:00)',
  
  -- When this window is/was active
  EffectiveFromDate DATETIME NOT NULL COMMENT 'When this window became active',
  EffectiveToDate DATETIME NULL COMMENT 'When this window ended (NULL = currently active)',
  
  -- Audit trail
  ChangedBy VARCHAR(100) COMMENT 'Admin email/username who made the change',
  ChangeReason TEXT COMMENT 'Optional reason for time window change',
  CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Indexes
  INDEX idx_activity_effective (ActivityType, EffectiveFromDate, EffectiveToDate)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 
COMMENT='Time window history for discipline calculations - preserves historical accuracy';

-- Insert default time windows (system initialization)
INSERT INTO activity_time_windows_table 
(ActivityType, WindowStartTime, WindowEndTime, EffectiveFromDate, ChangedBy) 
VALUES
('weight', '03:00:00', '06:30:00', '2025-01-01 00:00:00', 'system'),
('education', '07:15:00', '08:45:00', '2025-01-01 00:00:00', 'system'),
('breakfast', '05:30:00', '08:30:00', '2025-01-01 00:00:00', 'system'),
('lunch', '12:00:00', '16:00:00', '2025-01-01 00:00:00', 'system'),
('dinner', '17:30:00', '20:30:00', '2025-01-01 00:00:00', 'system');
```

**Run Migration:**
```bash
# Connect to database and run
mysql -u your_user -p baleeed5_wellness < sql/create_activity_time_windows.sql
```

**Verify:**
```sql
-- Check table created
SHOW TABLES LIKE 'activity_time_windows_table';

-- Check data inserted
SELECT * FROM activity_time_windows_table;

-- Should see 5 rows (one for each activity)
```

---

### Step 1.2: Add Indexes to Existing Tables

**File**: `sql/add_discipline_indexes.sql`

```sql
-- Check existing indexes first
SHOW INDEX FROM weight_records_table;
SHOW INDEX FROM education_logs_table;
SHOW INDEX FROM food_nutrition_data_table;
SHOW INDEX FROM team_table;

-- Add missing indexes for performance
-- Weight table
CREATE INDEX IF NOT EXISTS idx_weight_user_created 
ON weight_records_table(UserId, CreatedAt, IsDeleted);

-- Education table
CREATE INDEX IF NOT EXISTS idx_education_user_created 
ON education_logs_table(UserId, CreatedAt, IsDeleted);

-- Food table (UserID is varchar)
CREATE INDEX IF NOT EXISTS idx_food_user_created 
ON food_nutrition_data_table(UserID, CreatedAt, IsDeleted);

-- Team table
CREATE INDEX IF NOT EXISTS idx_coach_members 
ON team_table(UplineCoachId, Status);
```

**Run Migration:**
```bash
mysql -u your_user -p baleeed5_wellness < sql/add_discipline_indexes.sql
```

**Verify:**
```sql
-- Check indexes created
SHOW INDEX FROM weight_records_table WHERE Key_name LIKE 'idx_%';
SHOW INDEX FROM education_logs_table WHERE Key_name LIKE 'idx_%';
SHOW INDEX FROM food_nutrition_data_table WHERE Key_name LIKE 'idx_%';
SHOW INDEX FROM team_table WHERE Key_name LIKE 'idx_%';
```

---

### Step 1.3: Test Database Queries

**File**: `sql/test_discipline_queries.sql`

```sql
-- Test 1: Get team members for a coach
SELECT UserId, UserName, Email, EntryDateTime
FROM team_table
WHERE UplineCoachId = 123  -- Replace with actual coach ID
  AND Status = 'active'
LIMIT 5;

-- Test 2: Get weight posts with time window join
SELECT 
  w.UserId,
  w.CreatedAt,
  w.Weight,
  tw.WindowStartTime,
  tw.WindowEndTime,
  TIME(w.CreatedAt) as PostTime,
  CASE 
    WHEN TIME(w.CreatedAt) BETWEEN tw.WindowStartTime AND tw.WindowEndTime 
    THEN 'ON-TIME' 
    ELSE 'LATE' 
  END as Status
FROM weight_records_table w
LEFT JOIN activity_time_windows_table tw ON (
  tw.ActivityType = 'weight'
  AND w.CreatedAt >= tw.EffectiveFromDate
  AND (w.CreatedAt < tw.EffectiveToDate OR tw.EffectiveToDate IS NULL)
)
WHERE w.UserId IN (456, 457, 458)  -- Replace with actual user IDs
  AND DATE(w.CreatedAt) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
  AND w.IsDeleted = 0
ORDER BY w.UserId, w.CreatedAt;

-- Test 3: Get meal posts with inferred meal type
SELECT 
  CAST(UserID AS UNSIGNED) as UserId,
  CreatedAt,
  TIME(CreatedAt) as PostTime,
  CASE
    WHEN TIME(CreatedAt) BETWEEN '05:30:00' AND '08:30:00' THEN 'breakfast'
    WHEN TIME(CreatedAt) BETWEEN '12:00:00' AND '16:00:00' THEN 'lunch'
    WHEN TIME(CreatedAt) BETWEEN '17:30:00' AND '20:30:00' THEN 'dinner'
    ELSE 'unknown'
  END as MealType
FROM food_nutrition_data_table
WHERE CAST(UserID AS UNSIGNED) IN (456, 457, 458)
  AND DATE(CreatedAt) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
  AND IsDeleted = 0
ORDER BY UserId, CreatedAt;

-- Test 4: Batch query for all activities (performance test)
SET @coachId = 123;  -- Replace with actual coach ID
SET @startDate = DATE_SUB(CURDATE(), INTERVAL 7 DAY);
SET @endDate = CURDATE();

-- Get team member IDs
SET @memberIds = (
  SELECT GROUP_CONCAT(UserId)
  FROM team_table
  WHERE UplineCoachId = @coachId
    AND Status = 'active'
);

-- This should complete in <500ms for 50 members
SELECT COUNT(*) as total_posts
FROM weight_records_table
WHERE UserId IN (@memberIds)
  AND DATE(CreatedAt) BETWEEN @startDate AND @endDate
  AND IsDeleted = 0;
```

**Expected Results:**
- Test 1: Should return team members
- Test 2: Should show ON-TIME/LATE status correctly
- Test 3: Should infer meal types correctly
- Test 4: Should complete in <500ms

---

## 🎯 PHASE 2: BACKEND API (Day 3-4)

### Step 2.1: Create Database Helper Functions

**File**: `backend/utils/disciplineHelpers.js`

```javascript
const mysql = require('mysql2/promise');

/**
 * Parse date range string to actual dates
 */
function parseDateRange(range, customStart, customEnd) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  switch(range) {
    case 'today':
      return { start: today, end: today };
      
    case 'yesterday':
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return { start: yesterday, end: yesterday };
      
    case 'last7days':
      const last7 = new Date(today);
      last7.setDate(last7.getDate() - 6);
      return { start: last7, end: today };
      
    case 'last30days':
      const last30 = new Date(today);
      last30.setDate(last30.getDate() - 29);
      return { start: last30, end: today };
      
    case 'current_month':
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      return { start: monthStart, end: today };
      
    case 'custom':
      return { 
        start: new Date(customStart), 
        end: new Date(customEnd) 
      };
      
    default:
      const defaultStart = new Date(today);
      defaultStart.setDate(defaultStart.getDate() - 6);
      return { start: defaultStart, end: today };
  }
}

/**
 * Calculate expected posts for a date range
 */
function calculateExpectedPosts(startDate, endDate) {
  const oneDay = 24 * 60 * 60 * 1000;
  const days = Math.round(Math.abs((endDate - startDate) / oneDay)) + 1;
  const activitiesPerDay = 5; // Weight, Education, Breakfast, Lunch, Dinner
  return days * activitiesPerDay;
}

/**
 * Format date for MySQL query
 */
function formatDateForMySQL(date) {
  return date.toISOString().split('T')[0];
}

/**
 * Calculate discipline percentage
 */
function calculateDisciplinePercentage(onTimePosts, expectedPosts) {
  if (expectedPosts === 0) return 0;
  return Math.round((onTimePosts / expectedPosts) * 1000) / 10; // Round to 1 decimal
}

module.exports = {
  parseDateRange,
  calculateExpectedPosts,
  formatDateForMySQL,
  calculateDisciplinePercentage
};
```

---

### Step 2.2: Create Core Calculation Function

**File**: `backend/utils/disciplineCalculations.js`

```javascript
const mysql = require('mysql2/promise');
const { formatDateForMySQL } = require('./disciplineHelpers');

/**
 * Calculate discipline for a single team member
 */
async function calculateMemberDiscipline(connection, userId, startDate, endDate, userJoinDate) {
  const startDateStr = formatDateForMySQL(startDate);
  const endDateStr = formatDateForMySQL(endDate);
  
  // Query 1: Weight posts
  const [weightRows] = await connection.query(`
    SELECT 
      COUNT(*) as totalPosts,
      COUNT(CASE 
        WHEN TIME(w.CreatedAt) BETWEEN tw.WindowStartTime AND tw.WindowEndTime 
        THEN 1 
      END) as onTimePosts
    FROM weight_records_table w
    LEFT JOIN activity_time_windows_table tw ON (
      tw.ActivityType = 'weight'
      AND w.CreatedAt >= tw.EffectiveFromDate
      AND (w.CreatedAt < tw.EffectiveToDate OR tw.EffectiveToDate IS NULL)
    )
    WHERE w.UserId = ?
      AND DATE(w.CreatedAt) BETWEEN ? AND ?
      AND w.IsDeleted = 0
  `, [userId, startDateStr, endDateStr]);
  
  // Query 2: Education posts
  const [educationRows] = await connection.query(`
    SELECT 
      COUNT(*) as totalPosts,
      COUNT(CASE 
        WHEN TIME(e.CreatedAt) BETWEEN tw.WindowStartTime AND tw.WindowEndTime 
        THEN 1 
      END) as onTimePosts
    FROM education_logs_table e
    LEFT JOIN activity_time_windows_table tw ON (
      tw.ActivityType = 'education'
      AND e.CreatedAt >= tw.EffectiveFromDate
      AND (e.CreatedAt < tw.EffectiveToDate OR tw.EffectiveToDate IS NULL)
    )
    WHERE e.UserId = ?
      AND DATE(e.CreatedAt) BETWEEN ? AND ?
      AND e.IsDeleted = 0
  `, [userId, startDateStr, endDateStr]);
  
  // Query 3: Meal posts (breakfast, lunch, dinner)
  const [mealRows] = await connection.query(`
    SELECT 
      CASE
        WHEN TIME(f.CreatedAt) BETWEEN '05:30:00' AND '08:30:00' THEN 'breakfast'
        WHEN TIME(f.CreatedAt) BETWEEN '12:00:00' AND '16:00:00' THEN 'lunch'
        WHEN TIME(f.CreatedAt) BETWEEN '17:30:00' AND '20:30:00' THEN 'dinner'
      END as MealType,
      COUNT(*) as totalPosts,
      COUNT(CASE 
        WHEN TIME(f.CreatedAt) BETWEEN tw.WindowStartTime AND tw.WindowEndTime 
        THEN 1 
      END) as onTimePosts
    FROM food_nutrition_data_table f
    LEFT JOIN activity_time_windows_table tw ON (
      tw.ActivityType = CASE
        WHEN TIME(f.CreatedAt) BETWEEN '05:30:00' AND '08:30:00' THEN 'breakfast'
        WHEN TIME(f.CreatedAt) BETWEEN '12:00:00' AND '16:00:00' THEN 'lunch'
        WHEN TIME(f.CreatedAt) BETWEEN '17:30:00' AND '20:30:00' THEN 'dinner'
      END
      AND f.CreatedAt >= tw.EffectiveFromDate
      AND (f.CreatedAt < tw.EffectiveToDate OR tw.EffectiveToDate IS NULL)
    )
    WHERE CAST(f.UserID AS UNSIGNED) = ?
      AND DATE(f.CreatedAt) BETWEEN ? AND ?
      AND f.IsDeleted = 0
      AND TIME(f.CreatedAt) BETWEEN '05:30:00' AND '20:30:00'
    GROUP BY MealType
  `, [userId, startDateStr, endDateStr]);
  
  // Organize meal data
  const mealData = {
    breakfast: { totalPosts: 0, onTimePosts: 0 },
    lunch: { totalPosts: 0, onTimePosts: 0 },
    dinner: { totalPosts: 0, onTimePosts: 0 }
  };
  
  mealRows.forEach(row => {
    if (row.MealType) {
      mealData[row.MealType] = {
        totalPosts: row.totalPosts,
        onTimePosts: row.onTimePosts
      };
    }
  });
  
  // Calculate expected posts
  const oneDay = 24 * 60 * 60 * 1000;
  const daysInPeriod = Math.round(Math.abs((endDate - startDate) / oneDay)) + 1;
  const expectedPostsPerActivity = daysInPeriod;
  
  // Return structured data
  return {
    weight: {
      totalPosts: weightRows[0].totalPosts,
      onTimePosts: weightRows[0].onTimePosts,
      expectedPosts: expectedPostsPerActivity
    },
    education: {
      totalPosts: educationRows[0].totalPosts,
      onTimePosts: educationRows[0].onTimePosts,
      expectedPosts: expectedPostsPerActivity
    },
    breakfast: {
      ...mealData.breakfast,
      expectedPosts: expectedPostsPerActivity
    },
    lunch: {
      ...mealData.lunch,
      expectedPosts: expectedPostsPerActivity
    },
    dinner: {
      ...mealData.dinner,
      expectedPosts: expectedPostsPerActivity
    }
  };
}

/**
 * Calculate discipline for entire team (batch processing)
 */
async function calculateTeamDiscipline(connection, memberIds, startDate, endDate) {
  const results = [];
  
  // Process all members
  for (const memberId of memberIds) {
    try {
      const disciplineData = await calculateMemberDiscipline(
        connection, 
        memberId, 
        startDate, 
        endDate
      );
      
      results.push({
        userId: memberId,
        ...disciplineData
      });
    } catch (error) {
      console.error(`Error calculating discipline for user ${memberId}:`, error);
      // Continue with next member
    }
  }
  
  return results;
}

module.exports = {
  calculateMemberDiscipline,
  calculateTeamDiscipline
};
```

---

### Step 2.3: Create Main API Endpoint

**File**: `backend/pages/api/coach/discipline-report.js`

```javascript
const mysql = require('mysql2/promise');
const { calculateTeamDiscipline } = require('../../../utils/disciplineCalculations');
const { 
  parseDateRange, 
  calculateExpectedPosts,
  calculateDisciplinePercentage 
} = require('../../../utils/disciplineHelpers');

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }
  
  try {
    const { coachId, dateRange, startDate, endDate } = req.query;
    
    // Validation
    if (!coachId) {
      return res.status(400).json({ success: false, error: 'Coach ID required' });
    }
    
    if (!dateRange) {
      return res.status(400).json({ success: false, error: 'Date range required' });
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
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });
    
    try {
      // Step 1: Get team members
      const [members] = await connection.query(`
        SELECT UserId, UserName, Email, ProfileImage, EntryDateTime
        FROM team_table
        WHERE UplineCoachId = ?
          AND Status = 'active'
        ORDER BY UserName
      `, [coachId]);
      
      if (members.length === 0) {
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
            averageOverallDiscipline: 0,
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
          profileImage: member.ProfileImage,
          joinedDate: member.EntryDateTime,
          periodDiscipline: {
            percentage: periodDisciplinePercentage,
            expectedPosts: totalExpectedPosts,
            onTimePosts: totalOnTimePosts,
            daysInPeriod: Math.round(Math.abs((dates.end - dates.start) / (24 * 60 * 60 * 1000))) + 1
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
      
      // Step 5: Return response
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
      await connection.end();
    }
    
  } catch (error) {
    console.error('Discipline report error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
}
```

---

### Step 2.4: Test Backend API

**Create test file**: `test-discipline-api.js`

```javascript
const axios = require('axios');

async function testDisciplineAPI() {
  const API_URL = 'http://localhost:3000/api/coach/discipline-report';
  
  console.log('🧪 Testing Discipline Report API\n');
  
  // Test 1: Last 7 Days
  console.log('Test 1: Last 7 Days');
  try {
    const response = await axios.get(API_URL, {
      params: {
        coachId: 123, // Replace with actual coach ID
        dateRange: 'last7days'
      }
    });
    console.log('✅ Success:', response.data.teamMembers.length, 'members');
    console.log('   Avg Discipline:', response.data.teamSummary.averagePeriodDiscipline + '%');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  
  // Test 2: Today
  console.log('\nTest 2: Today');
  try {
    const response = await axios.get(API_URL, {
      params: {
        coachId: 123,
        dateRange: 'today'
      }
    });
    console.log('✅ Success:', response.data.teamMembers.length, 'members');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  
  // Test 3: Custom Range
  console.log('\nTest 3: Custom Range');
  try {
    const response = await axios.get(API_URL, {
      params: {
        coachId: 123,
        dateRange: 'custom',
        startDate: '2025-12-01',
        endDate: '2025-12-26'
      }
    });
    console.log('✅ Success:', response.data.teamMembers.length, 'members');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  
  console.log('\n✅ All tests completed');
}

testDisciplineAPI();
```

**Run tests:**
```bash
cd backend
node test-discipline-api.js
```

---

## 🎯 PHASE 3: FRONTEND DASHBOARD (Day 5-6)

### Step 3.1: Create API Service

**File**: `frontend/src/services/disciplineReportService.js`

```javascript
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000';

export const disciplineReportService = {
  /**
   * Fetch discipline report for coach's team
   */
  async getDisciplineReport(coachId, dateRange, customRange = null) {
    const params = {
      coachId,
      dateRange
    };
    
    if (dateRange === 'custom' && customRange) {
      params.startDate = customRange.start;
      params.endDate = customRange.end;
    }
    
    try {
      const response = await axios.get(`${API_BASE_URL}/api/coach/discipline-report`, {
        params
      });
      
      return response.data;
    } catch (error) {
      console.error('Error fetching discipline report:', error);
      throw error;
    }
  },
  
  /**
   * Export report to CSV
   */
  exportToCSV(teamData, dateRange) {
    const headers = [
      'Name',
      'Email',
      'Period %',
      'Weight %',
      'Education %',
      'Breakfast %',
      'Lunch %',
      'Dinner %'
    ];
    
    const rows = teamData.teamMembers.map(member => [
      member.userName,
      member.email,
      member.periodDiscipline.percentage,
      member.activities.weight.percentage,
      member.activities.education.percentage,
      member.activities.breakfast.percentage,
      member.activities.lunch.percentage,
      member.activities.dinner.percentage
    ]);
    
    const csv = [headers, ...rows]
      .map(row => row.join(','))
      .join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `discipline-report-${dateRange}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  }
};
```

---

### Step 3.2: Create Dashboard Page

**File**: `frontend/src/pages/CoachDisciplineReport.js`

```javascript
import React, { useState, useEffect } from 'react';
import { disciplineReportService } from '../services/disciplineReportService';
import DisciplineTable from '../components/coach/DisciplineTable';
import DisciplineFilters from '../components/coach/DisciplineFilters';
import TeamSummaryStats from '../components/coach/TeamSummaryStats';
import './CoachDisciplineReport.css';

function CoachDisciplineReport() {
  const [teamData, setTeamData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dateRange, setDateRange] = useState('last7days');
  const [customDateRange, setCustomDateRange] = useState({ start: null, end: null });
  const [filters, setFilters] = useState({
    searchQuery: '',
    sortBy: 'name',
    sortOrder: 'asc',
    disciplineFilter: 'all'
  });
  
  // Get coach ID from session/context
  const coachId = 123; // TODO: Get from auth context
  
  // Load discipline report
  useEffect(() => {
    loadDisciplineReport();
  }, [dateRange, customDateRange]);
  
  async function loadDisciplineReport() {
    setLoading(true);
    setError(null);
    
    try {
      const data = await disciplineReportService.getDisciplineReport(
        coachId,
        dateRange,
        dateRange === 'custom' ? customDateRange : null
      );
      
      setTeamData(data);
    } catch (err) {
      setError('Failed to load discipline report');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }
  
  function handleDateRangeChange(newRange) {
    setDateRange(newRange);
  }
  
  function handleCustomDateChange(start, end) {
    setCustomDateRange({ start, end });
    setDateRange('custom');
  }
  
  function handleExportCSV() {
    if (teamData) {
      disciplineReportService.exportToCSV(teamData, dateRange);
    }
  }
  
  function handleRefresh() {
    loadDisciplineReport();
  }
  
  if (loading) {
    return (
      <div className="discipline-report-loading">
        <div className="spinner"></div>
        <p>Loading discipline report...</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="discipline-report-error">
        <p>{error}</p>
        <button onClick={handleRefresh}>Retry</button>
      </div>
    );
  }
  
  return (
    <div className="coach-discipline-report">
      <div className="report-header">
        <h1>🏆 Team Discipline Report</h1>
        <div className="report-actions">
          <button onClick={handleRefresh} className="btn-refresh">
            🔄 Refresh
          </button>
          <button onClick={handleExportCSV} className="btn-export">
            📊 Export CSV
          </button>
        </div>
      </div>
      
      <TeamSummaryStats summary={teamData?.teamSummary} />
      
      <DisciplineFilters
        dateRange={dateRange}
        onDateRangeChange={handleDateRangeChange}
        onCustomDateChange={handleCustomDateChange}
        filters={filters}
        onFiltersChange={setFilters}
      />
      
      <DisciplineTable
        teamMembers={teamData?.teamMembers || []}
        filters={filters}
        loading={loading}
      />
      
      <div className="report-footer">
        <p className="last-updated">
          🕐 Last updated: {new Date(teamData?.lastUpdated).toLocaleString()}
        </p>
      </div>
    </div>
  );
}

export default CoachDisciplineReport;
```

---

### Step 3.3: Create Table Component

**File**: `frontend/src/components/coach/DisciplineTable.js`

```javascript
import React, { useState, useMemo } from 'react';
import './DisciplineTable.css';

function DisciplineTable({ teamMembers, filters, loading }) {
  const [expandedRows, setExpandedRows] = useState(new Set());
  
  // Filter and sort members
  const filteredMembers = useMemo(() => {
    let filtered = [...teamMembers];
    
    // Search filter
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      filtered = filtered.filter(m => 
        m.userName.toLowerCase().includes(query) ||
        m.email.toLowerCase().includes(query)
      );
    }
    
    // Discipline filter
    if (filters.disciplineFilter !== 'all') {
      filtered = filtered.filter(m => {
        const discipline = m.periodDiscipline.percentage;
        if (filters.disciplineFilter === 'high') return discipline >= 80;
        if (filters.disciplineFilter === 'medium') return discipline >= 60 && discipline < 80;
        if (filters.disciplineFilter === 'low') return discipline < 60;
        return true;
      });
    }
    
    // Sort
    filtered.sort((a, b) => {
      let aVal, bVal;
      
      if (filters.sortBy === 'name') {
        aVal = a.userName;
        bVal = b.userName;
      } else if (filters.sortBy === 'period') {
        aVal = a.periodDiscipline.percentage;
        bVal = b.periodDiscipline.percentage;
      }
      
      if (filters.sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });
    
    return filtered;
  }, [teamMembers, filters]);
  
  function toggleRow(userId) {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(userId)) {
      newExpanded.delete(userId);
    } else {
      newExpanded.add(userId);
    }
    setExpandedRows(newExpanded);
  }
  
  function getDisciplineColor(percentage) {
    if (percentage >= 90) return 'excellent';
    if (percentage >= 80) return 'good';
    if (percentage >= 70) return 'fair';
    if (percentage >= 60) return 'needs-improvement';
    return 'needs-attention';
  }
  
  function getDisciplineIcon(percentage) {
    if (percentage >= 80) return '🟢';
    if (percentage >= 60) return '🟡';
    return '🔴';
  }
  
  if (loading) {
    return <div className="table-loading">Loading...</div>;
  }
  
  if (filteredMembers.length === 0) {
    return <div className="table-empty">No team members found</div>;
  }
  
  return (
    <div className="discipline-table-container">
      <table className="discipline-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Period %</th>
            <th>Weight</th>
            <th>Education</th>
            <th>Breakfast</th>
            <th>Lunch</th>
            <th>Dinner</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredMembers.map(member => (
            <React.Fragment key={member.userId}>
              <tr className={`member-row ${getDisciplineColor(member.periodDiscipline.percentage)}`}>
                <td>
                  {getDisciplineIcon(member.periodDiscipline.percentage)}
                  {' '}
                  {member.userName}
                </td>
                <td className="discipline-cell">
                  <strong>{member.periodDiscipline.percentage}%</strong>
                  <div className="discipline-details">
                    {member.periodDiscipline.onTimePosts}/{member.periodDiscipline.expectedPosts}
                  </div>
                </td>
                <td>{member.activities.weight.percentage}%</td>
                <td>{member.activities.education.percentage}%</td>
                <td>{member.activities.breakfast.percentage}%</td>
                <td>{member.activities.lunch.percentage}%</td>
                <td>{member.activities.dinner.percentage}%</td>
                <td>
                  <button 
                    onClick={() => toggleRow(member.userId)}
                    className="btn-expand"
                  >
                    {expandedRows.has(member.userId) ? '▼' : '▶'}
                  </button>
                </td>
              </tr>
              
              {expandedRows.has(member.userId) && (
                <tr className="expanded-row">
                  <td colSpan="8">
                    <div className="expanded-content">
                      <h4>Activity Breakdown for {member.userName}</h4>
                      <div className="activity-details">
                        {Object.entries(member.activities).map(([activity, data]) => (
                          <div key={activity} className="activity-card">
                            <h5>{activity.charAt(0).toUpperCase() + activity.slice(1)}</h5>
                            <p className="percentage">{data.percentage}%</p>
                            <p className="counts">
                              {data.onTimePosts} on-time / {data.expectedPosts} expected
                            </p>
                            <p className="window">Window: {data.targetWindow}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default DisciplineTable;
```

---

### Step 3.4: Create Filter Component

**File**: `frontend/src/components/coach/DisciplineFilters.js`

```javascript
import React from 'react';
import './DisciplineFilters.css';

function DisciplineFilters({ 
  dateRange, 
  onDateRangeChange, 
  onCustomDateChange,
  filters,
  onFiltersChange 
}) {
  
  function handleDateRangeSelect(e) {
    onDateRangeChange(e.target.value);
  }
  
  function handleSearchChange(e) {
    onFiltersChange({ ...filters, searchQuery: e.target.value });
  }
  
  function handleDisciplineFilterChange(e) {
    onFiltersChange({ ...filters, disciplineFilter: e.target.value });
  }
  
  return (
    <div className="discipline-filters">
      <div className="filter-group">
        <label>📅 Date Range:</label>
        <select value={dateRange} onChange={handleDateRangeSelect}>
          <option value="today">Today</option>
          <option value="yesterday">Yesterday</option>
          <option value="last7days">Last 7 Days</option>
          <option value="last30days">Last 30 Days</option>
          <option value="current_month">Current Month</option>
          <option value="custom">Custom Range</option>
        </select>
      </div>
      
      <div className="filter-group">
        <label>🔍 Search:</label>
        <input
          type="text"
          placeholder="Search members..."
          value={filters.searchQuery}
          onChange={handleSearchChange}
        />
      </div>
      
      <div className="filter-group">
        <label>📊 Filter by Discipline:</label>
        <select 
          value={filters.disciplineFilter} 
          onChange={handleDisciplineFilterChange}
        >
          <option value="all">All Members</option>
          <option value="high">High (≥80%)</option>
          <option value="medium">Medium (60-79%)</option>
          <option value="low">Low (<60%)</option>
        </select>
      </div>
    </div>
  );
}

export default DisciplineFilters;
```

---

### Step 3.5: Create Summary Stats Component

**File**: `frontend/src/components/coach/TeamSummaryStats.js`

```javascript
import React from 'react';
import './TeamSummaryStats.css';

function TeamSummaryStats({ summary }) {
  if (!summary) return null;
  
  return (
    <div className="team-summary-stats">
      <div className="stat-card">
        <div className="stat-value">{summary.totalMembers}</div>
        <div className="stat-label">Team Members</div>
      </div>
      
      <div className="stat-card">
        <div className="stat-value">{summary.averagePeriodDiscipline}%</div>
        <div className="stat-label">Average Discipline</div>
      </div>
      
      {summary.topPerformer && (
        <div className="stat-card top-performer">
          <div className="stat-value">🏆 {summary.topPerformer.userName}</div>
          <div className="stat-label">
            Top Performer ({summary.topPerformer.discipline}%)
          </div>
        </div>
      )}
      
      {summary.needsAttention.length > 0 && (
        <div className="stat-card needs-attention">
          <div className="stat-value">⚠️ {summary.needsAttention.length}</div>
          <div className="stat-label">Needs Attention</div>
        </div>
      )}
    </div>
  );
}

export default TeamSummaryStats;
```

---

## 🎯 PHASE 4: ADMIN TIME WINDOW MODAL (Day 7)

**Architecture Decision**: Time Window Settings integrated directly into Discipline Report module
- Icon button in header (⚙️) next to refresh and download buttons
- Only visible to admin/developer roles
- Opens modal overlay showing current time windows
- Displays last updated timestamp for each activity
- Allows inline editing with effective date and reason

### Step 4.1: Create Admin API Endpoints

**File**: `backend/pages/api/admin/time-windows.js`

```javascript
const mysql = require('mysql2/promise');

export default async function handler(req, res) {
  // Get current time windows
  if (req.method === 'GET') {
    try {
      const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
      });
      
      const [rows] = await connection.query(`
        SELECT 
          ActivityType,
          WindowStartTime,
          WindowEndTime,
          EffectiveFromDate,
          EffectiveToDate,
          ChangedBy,
          ChangeReason,
          CreatedAt as LastUpdated
        FROM activity_time_windows_table
        WHERE EffectiveToDate IS NULL
        ORDER BY ActivityType
      `);
      
      await connection.end();
      
      return res.status(200).json({
        success: true,
        timeWindows: rows
      });
      
    } catch (error) {
      console.error('Error fetching time windows:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
  
  // Update time window
  if (req.method === 'POST') {
    try {
      const {
        activityType,
        windowStartTime,
        windowEndTime,
        effectiveFromDate,
        changedBy,
        changeReason
      } = req.body;
      
      // Validation
      if (!activityType || !windowStartTime || !windowEndTime || !effectiveFromDate || !changedBy) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields'
        });
      }
      
      const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
      });
      
      await connection.beginTransaction();
      
      try {
        // Close previous window
        await connection.query(`
          UPDATE activity_time_windows_table
          SET EffectiveToDate = ?
          WHERE ActivityType = ?
            AND EffectiveToDate IS NULL
        `, [effectiveFromDate, activityType]);
        
        // Insert new window
        await connection.query(`
          INSERT INTO activity_time_windows_table
          (ActivityType, WindowStartTime, WindowEndTime, EffectiveFromDate, ChangedBy, ChangeReason)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [
          activityType,
          windowStartTime,
          windowEndTime,
          effectiveFromDate,
          changedBy,
          changeReason || null
        ]);
        
        await connection.commit();
        await connection.end();
        
        return res.status(200).json({
          success: true,
          message: 'Time window updated successfully'
        });
        
      } catch (error) {
        await connection.rollback();
        await connection.end();
        throw error;
      }
      
    } catch (error) {
      console.error('Error updating time window:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
  
  return res.status(405).json({ success: false, error: 'Method not allowed' });
}
```

---
Integrate Time Window Settings into Discipline Report

**Update File**: `frontend/src/components/DisciplineReport.js`

Add settings icon button in header (only for admin/developer):
```javascript
// In header section, add after download button:
{(userRole === 'admin' || userRole === 'developer') && (
  <button
    onClick={() => setShowTimeWindowModal(true)}
    className="p-2 hover:bg-gray-50 rounded-full transition-colors text-gray-600"
    title="Configure Time Windows"
  >
    <Settings className="h-5 w-5" />
  </button>
)}
```

**Create Modal Component**: `frontend/src/components/TimeWindowSettingsModal.js`

```javascript
import React, { useState, useEffect } from 'react';
import { X, Clock, Save } from 'lucide-react';
import axios from 'axios';

function TimeWindowSettingsModal({ isOpen, onClose, userRol
function TimeWindowSettingsModal({ isOpen, onClose }) {
  const [timeWindows, setTimeWindows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [formData, setFormData] = useState({
    windowStartTime: '',
    windowEndTime: '',
    effectiveFromDate: new Date().toISOString().split('T')[0],
    changeReason: ''
  });
  
  useEffect(() => {
    if (isOpen) {
      loadTimeWindows();
    }
  }, [isOpen]);
  
  async function loadTimeWindows() {
    try {
      const response = await axios.get('/api/admin/time-windows');
      setTimeWindows(response.data.timeWindows);
    } catch (error) {
      console.error('Error loading time windows:', error);
    } finally {
      setLoading(false);
    }
  }
  
  function handleEditWindow(window) {
    setSelectedActivity(window.ActivityType);
    setFormData({
      windowStartTime: window.WindowStartTime,
      windowEndTime: window.WindowEndTime,
      effectiveFromDate: new Date().toISOString().split('T')[0],
      changeReason: ''
    });
  }
  
  async function handleSaveChanges() {
    if (!selectedActivity) return;
    
    try {
      await axios.post('/api/admin/time-windows', {
        activityType: selectedActivity,
        windowStartTime: formData.windowStartTime,
        windowEndTime: formData.windowEndTime,
        effectiveFromDate: formData.effectiveFromDate,
        changedBy: 'admin@wellness.com', // TODO: Get from auth
        changeReasonfixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Clock className="h-5 w-5 text-green-600" />
              Activity Time Windows
            </h2>
            <p className="text-xs text-gray-500 mt-1">Configure on-time posting windows</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>
        
        {/* Warning */}
        <div className="mx-6 mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
          <p className="text-xs text-amber-800">
            ⚠️ <strong>Note:</strong> Changes only affect future calculations. Historical discipline scores remain accurate with original windows.
          </p>
        </div>
        
        {/* Body - Scrollable */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          <div className="space-y-4">
            {timeWindows.map(window => (
              <div key={window.ActivityType} className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-gray-900 capitalize">{window.ActivityType}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Last updated: {new Date(window.LastUpdated).toLocaleDateString()} at {new Date(window.LastUpdated).toLocaleTimeString()}
                    </p>
                  </div>
                  <button 
                    onClick={() => handleEditWindow(window)}
                    className="px-3 py-1.5 text-sm font-medium text-green-700 hover:bg-green-100 rounded-lg transition-colors"
                  >
                    Edit
                  </button>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Window:</span>
                    <span className="ml-2 font-semibold text-gray-900">
                      {window.WindowStartTime.slice(0, 5)} - {window.WindowEndTime.slice(0, 5)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Active Since:</span>
                    <span className="ml-2 font-semibold text-gray-900">
                      {new Date(window.EffectiveFromDate).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            ))}  {window.WindowStartTime} - {window.WindowEndTime}
                    </td>
                    <td>
                      {new Date(window.EffectiveFromDate).toLocaleDateString()}
                    </td>
                    <td>
                      <button 
                        onClick={() => handleEditWindow(window)}
                        className="btn-edit"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {selectedActivity && (
            <div className="edit-window-form">
              <h3>Edit Time Window: {selectedActivity}</h3>
              
              <div className="form-group">
                <label>Start Time:</label>
                <input
                  type="time"
                  value={formData.windowStartTime}
                  onChange={(e) => setFormData({ ...formData, windowStartTime: e.target.value })}
                />
              </div>
              
              <div className="form-group">
                <label>End Time:</label>
                <input
                  type="time"
                  value={formData.windowEndTime}
                  onChange={(e) => setFormData({ ...formData, windowEndTime: e.target.value })}
                />
              </div>
              
              <div className="form-group">
                <label>Effective From Date:</label>
                <input
                  type="date"
                  value={formData.effectiveFromDate}
                  onChange={(e) => setFormData({ ...formData, effectiveFromDate: e.target.value })}
                />
              </div>
              
              <div className="form-group">
                <label>Reason for Change (optional):</label>
                <textarea
                  value={formData.changeReason}
                  onChange={(e) => setFormData({ ...formData, changeReason: e.target.value })}
                  placeholder="e.g., Extended morning window based on user feedback"
                />
              </div>
              
              <div className="form-actions">
                <button onClick={() => setSelectedActivity(null)} className="btn-cancel">
                  Cancel
                </button>
                <button onClick={handleSaveChanges} className="btn-save">
                  Save Changes
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default TimeWindowSettingsModal;
```

---

## 🎯 PHASE 5: TESTING & DEPLOYMENT

### Step 5.1: Unit Tests

**File**: `backend/tests/disciplineCalculations.test.js`

```javascript
const { calculateDisciplinePercentage } = require('../utils/disciplineHelpers');

describe('Discipline Calculations', () => {
  test('calculates percentage correctly', () => {
    expect(calculateDisciplinePercentage(7, 7)).toBe(100);
    expect(calculateDisciplinePercentage(5, 7)).toBe(71.4);
    expect(calculateDisciplinePercentage(0, 7)).toBe(0);
  });
  
  test('handles zero expected posts', () => {
    expect(calculateDisciplinePercentage(0, 0)).toBe(0);
  });
  
  test('rounds to 1 decimal place', () => {
    expect(calculateDisciplinePercentage(2, 3)).toBe(66.7);
  });
});
```

**Run tests:**
```bash
cd backend
npm test
```

---

### Step 5.2: Integration Testing Checklist

- [ ] Test with 1 team member
- [ ] Test with 10 team members
- [ ] Test with 50+ team members
- [ ] Test all date ranges (Today, Last 7 Days, Last 30 Days, Custom)
- [ ] Test search functionality
- [ ] Test filters (High/Medium/Low)
- [ ] Test CSV export
- [ ] Test admin time window changes
- [ ] Test time window versioning (historical accuracy)
- [ ] Test edge cases (no data, deleted posts, future dates)

---

### Step 5.3: Performance Testing

**File**: `test-performance.js`

```javascript
const axios = require('axios');

async function testPerformance() {
  const API_URL = 'http://localhost:3000/api/coach/discipline-report';
  const coachId = 123; // Coach with 50+ members
  
  console.log('⏱️ Performance Test: 50 members, Last 30 Days\n');
  
  const startTime = Date.now();
  
  const response = await axios.get(API_URL, {
    params: {
      coachId,
      dateRange: 'last30days'
    }
  });
  
  const endTime = Date.now();
  const duration = endTime - startTime;
  
  console.log('✅ Response time:', duration, 'ms');
  console.log('✅ Team members:', response.data.teamMembers.length);
  console.log('✅ Target: <1000ms');
  
  if (duration < 1000) {
    console.log('🎉 PASS: Performance meets target');
  } else {
    console.log('⚠️ FAIL: Performance below target');
  }
}

testPerformance();
```

---

### Step 5.4: Deployment Checklist

**Pre-Deployment:**
- [ ] All unit tests passing
- [ ] Integration tests completed
- [ ] Performance benchmarks met (<1000ms for 50 members)
- [ ] Database migrations tested in staging
- [ ] Frontend builds without errors
- [ ] Backend API tested in staging
- [ ] Code review completed
- [ ] Documentation updated

**Deployment Steps:**
1. [ ] Backup production database
2. [ ] Run database migration (create activity_time_windows_table)
3. [ ] Run index creation script
4. [ ] Deploy backend changes
5. [ ] Deploy frontend changes
6. [ ] Test API endpoints in production
7. [ ] Verify discipline calculations with real data
8. [ ] Monitor error logs for 24 hours

**Post-Deployment:**
- [ ] Test with real coach accounts
- [ ] Verify performance metrics
- [ ] Collect user feedback
- [ ] Address any bugs within 48 hours
- [ ] Document lessons learned

---

## 📊 IMPLEMENTATION TIMELINE

| Day | Phase | Tasks | Deliverables |
|-----|-------|-------|--------------|
| 1-2 | Database | Create time windows table, add indexes, test queries | Working database schema |
| 3-4 | Backend | Create calculation functions, API endpoints, test | Working API with JSON response |
| 5-6 | Frontend | Create dashboard, table, filters, summary stats | Working UI |
| 7 | Admin | Create time window modal, test versioning | Admin settings functional |
| 7 | Testing | Integration tests, performance tests, bug fixes | Production-ready code |

**Total Time**: 7 Days

---

## ✅ SUCCESS CRITERIA

- [ ] Coach can view discipline report for all team members
- [ ] All date ranges work correctly (Today, Last 7 Days, Last 30 Days, Custom)
- [ ] Discipline calculations are accurate (verified against manual calculation)
- [ ] Response time <1000ms for 50 members
- [ ] Time window versioning preserves historical accuracy
- [ ] Admin can edit time windows
- [ ] CSV export works
- [ ] Search and filters work
- [ ] Mobile responsive design
- [ ] No critical bugs

---

## 🔗 QUICK REFERENCE

**Key Files:**
- Database: `sql/create_activity_time_windows.sql`
- Backend API: `backend/pages/api/coach/discipline-report.js`
- Calculation Logic: `backend/utils/disciplineCalculations.js`
- Frontend Page: `frontend/src/pages/CoachDisciplineReport.js`
- Table Component: `frontend/src/components/coach/DisciplineTable.js`
- Admin Modal: `frontend/src/components/admin/TimeWindowSettingsModal.js`

**Test Commands:**
```bash
# Backend tests
cd backend
npm test

# Performance test
node test-performance.js

# Frontend build
cd frontend
npm run build

# Start dev server
npm run start
```

**Database Queries:**
```sql
-- Check time windows
SELECT * FROM activity_time_windows_table;

-- Check indexes
SHOW INDEX FROM weight_records_table;

-- Test discipline calculation
-- (See sql/test_discipline_queries.sql)
```

---

## 📞 SUPPORT

**Questions?**
- Review main plan: `COACH_DISCIPLINE_REPORT_PLAN.md`
- Check database schema: Section 3
- Review API design: Section 4
- Check frontend architecture: Section 5

**Ready to implement? Start with Phase 1! 🚀**
