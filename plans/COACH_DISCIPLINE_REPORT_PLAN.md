# Coach Discipline Report Module - Implementation Plan

**Feature**: Discipline Report Dashboard for Coaches  
**Version**: 2.0 (Final)  
**Created**: December 26, 2025  
**Last Updated**: December 26, 2025  
**Status**: Final Plan - Ready for Implementation  

---

## 📋 TABLE OF CONTENTS

1. [Feature Overview](#1-feature-overview)
2. [System Requirements](#2-system-requirements)
3. [Database Schema](#3-database-schema)
4. [Backend API Design](#4-backend-api-design)
5. [Frontend Architecture](#5-frontend-architecture)
6. [Performance Optimization](#6-performance-optimization)
7. [Date Range Switching Strategy](#7-date-range-switching-strategy)
8. [UI/UX Design](#8-uiux-design)
9. [Security & Authorization](#9-security--authorization)
10. [Implementation Phases](#10-implementation-phases)
11. [Testing Strategy](#11-testing-strategy)

---

## 1. FEATURE OVERVIEW

### 1.1 Purpose
Provide coaches with a comprehensive dashboard to monitor their team members' discipline ratings based on consistency in logging wellness activities (Weight, Education, Breakfast, Lunch, Dinner) within designated time windows.

### 1.2 Key Capabilities
- View discipline percentages for all team members in one dashboard
- Filter by date ranges (Today, Yesterday, Last 7 Days, Last 30 Days, Custom)
- Compare individual activity performance (Weight, Education, Meals)
- Identify team members who need attention (<60% discipline)
- Track discipline improvement trends (period vs overall)
- Export reports to CSV
- Drill down into individual member details

### 1.3 Access Control
- **Who can access**: Users with Role = 'Coach' (users who have team members under their `UplineCoachId`)
- **Scope**: Coaches can only view discipline data for their direct team members
- **Authentication**: Must be logged in with valid session

---

## 2. SYSTEM REQUIREMENTS

### 2.1 Existing Data Sources
The module leverages existing database tables:

| Table | Purpose | Key Columns | Notes |
|-------|---------|-------------|-------|
| `team_table` | User profiles and coach relationships | `UserId`, `UserName`, `Email`, `UplineCoachId`, `TeamId`, `Role`, `Status` | ⚠️ No personalized meal time columns |
| `weight_records_table` | Weight posting data | `UserId` (bigint), `Weight`, `CreatedAt`, `IsDeleted` | ✅ Ready to use |
| `education_logs_table` | Education session data | `UserId` (int), `Platform`, `CreatedAt`, `IsDeleted` | ✅ Ready to use |
| `food_nutrition_data_table` | Meal posting data | `UserID` (varchar), `CreatedAt`, `IsDeleted` | ⚠️ No MealType column, inconsistent naming |

**Critical Database Issues to Handle:**

1. **No MealType Column**: `food_nutrition_data_table` doesn't have a MealType column
   - **Solution**: Infer meal type from `CreatedAt` time:
     - 5:30-8:30 AM → Breakfast
     - 12:00-4:00 PM → Lunch
     - 5:30-8:30 PM → Dinner

2. **Inconsistent User ID Naming**: 
   - `weight_records_table` uses `UserId` (bigint)
   - `education_logs_table` uses `UserId` (int)
   - `food_nutrition_data_table` uses `UserID` (varchar)
   - **Solution**: Handle all variations in queries

3. **No Personalized Meal Times**: `team_table` doesn't store user's wake-up time or preferred meal times
   - **Solution**: Use fixed time windows from `activity_time_windows_table` for all users

4. **Existing `discipline_table`**: User wants to avoid this table
   - **Solution**: Ignore it completely, build fresh calculation engine

### 2.2 Discipline Calculation Rules

#### **Target Posting Time Windows**

| Activity   | Target Posting Time              | Time Window          |
|------------|----------------------------------|----------------------|
| Weight     | User's wake-up time + 30 minutes | 3:00 AM - 6:30 AM    |
| Education  | 7:00 AM (fixed time)             | 7:15 AM - 8:45 AM    |
| Breakfast  | User's wake-up time + 2.5 hours  | 5:30 AM - 8:30 AM    |
| Lunch      | User-defined lunch time          | 12:00 PM - 4:00 PM   |
| Dinner     | User-defined dinner time         | 5:30 PM - 8:30 PM    |

#### **Calculation Formulas**

**Individual Activity Discipline %**
```
Activity Discipline % = (On-time posts / Expected posts) × 100

Where:
- On-time posts: Posts made within the target time window
- Expected posts: Number of days in selected period
```

**Overall Discipline %**
```
Overall Discipline % = (Total on-time posts / Total expected posts) × 100

Where:
- Total on-time posts: Sum of on-time posts across all activities since user joined
- Total expected posts: Days since joined × Number of tracked activities (5)
```

**Period Discipline %**
```
Period Discipline % = (Period on-time posts / Period expected posts) × 100

Where:
- Period on-time posts: On-time posts within selected date range
- Period expected posts: Days in period × Number of tracked activities (5)
```

**Discipline Improvement**
```
Discipline Improvement = Period Discipline % - Overall Discipline %

Interpretation:
- Positive (+7%): User is improving
- Negative (-5%): User's discipline has declined
- Zero (0%): Maintaining consistent discipline
```

---

## 3. DATABASE SCHEMA

### 3.1 CORE STRATEGY: Query-Based Calculation (No Cache Tables!)

**Approach**: Calculate discipline on-demand from existing activity tables using optimized queries with proper indexes and batch processing.

**Why This Approach:**
- ✅ No counter synchronization issues
- ✅ Always 100% accurate (single source of truth)
- ✅ Handles all edge cases automatically (deletes, edits, late posts)
- ✅ Simple to implement and maintain
- ✅ Fast enough with proper optimization (50-200ms)

### 3.2 New Table: `activity_time_windows_table` (Time Window Versioning)

**Purpose**: Store versioned time windows for discipline calculations. When admin changes time windows, historical posts are evaluated with original windows (no retroactive changes).

```sql
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

**How Time Window Versioning Works:**

```
Timeline Example:

Jan 1:  Weight window = 3:00-6:30 AM (Row 1: EffectiveFrom=Jan 1, EffectiveTo=NULL)
        User logs at 6:00 AM → ON-TIME ✅ (evaluated with 3:00-6:30 window)

Feb 1:  Admin changes window to 4:00-7:00 AM
        - Row 1: Set EffectiveTo = Feb 1
        - Row 2: Insert new window (EffectiveFrom=Feb 1, EffectiveTo=NULL)

Feb 15: User logs at 6:00 AM → ON-TIME ✅ (evaluated with 4:00-7:00 window)

Feb 20: Coach views "Last 60 Days" discipline
        - Jan 15 post: Evaluated with 3:00-6:30 window ✅ (window active at post time)
        - Feb 15 post: Evaluated with 4:00-7:00 window ✅ (window active at post time)
        
Result: No retroactive changes! Each post uses the window that was active when posted.
```

### 3.3 Required Indexes on Existing Tables

**Check and create missing indexes:**

```sql
-- Check existing indexes first
SHOW INDEX FROM weight_records_table;
SHOW INDEX FROM education_logs_table;
SHOW INDEX FROM food_nutrition_data_table;
SHOW INDEX FROM team_table;

-- Add missing indexes if not present
-- Weight table (check if idx_user_id and idx_created_at exist)
CREATE INDEX IF NOT EXISTS idx_weight_user_created ON weight_records_table(UserId, CreatedAt, IsDeleted);

-- Education table (check if idx_user_id exists)
CREATE INDEX IF NOT EXISTS idx_education_user_created ON education_logs_table(UserId, CreatedAt, IsDeleted);

-- Food table (note: UserID is varchar, already has MUL on UserID)
-- Add index on CreatedAt for time-based queries
CREATE INDEX IF NOT EXISTS idx_food_user_created ON food_nutrition_data_table(UserID, CreatedAt, IsDeleted);

-- Team table (check if idx_upline_coach_id exists)
CREATE INDEX IF NOT EXISTS idx_coach_members ON team_table(UplineCoachId, Status);
```

**Database Schema Compatibility Notes:**
- ✅ `weight_records_table.UserId` is `bigint` - convert to int when needed
- ✅ `education_logs_table.UserId` is `int` - direct comparison
- ⚠️ `food_nutrition_data_table.UserID` is `varchar` - handle string comparison
- ✅ All tables have `IsDeleted` column (tinyint)
- ✅ All tables have `CreatedAt` timestamp column

---

## 4. BACKEND API DESIGN

### 4.1 Main API: Get Discipline Report

**Endpoint**: `GET /api/coach/discipline-report`

**Query Parameters**:
```javascript
{
  coachId: number,        // Required: Coach's UserId
  dateRange: string,      // 'overall' | 'today' | 'yesterday' | 'last7days' | 'last30days' | 'custom'
  startDate?: string,     // Required if dateRange = 'custom' (YYYY-MM-DD)
  endDate?: string,       // Required if dateRange = 'custom' (YYYY-MM-DD)
  forceRefresh?: boolean  // Optional: Skip cache and recalculate
}
```

**Response Structure**:
```json
{
  "success": true,
  "source": "cache",
  "lastUpdated": "2025-12-26T10:30:00Z",
  "coachId": 123,
  "dateRange": "last7days",
  "startDate": "2025-12-19",
  "endDate": "2025-12-26",
  
  "teamMembers": [
    {
      "userId": 456,
      "userName": "John Doe",
      "email": "john@example.com",
      "profileImage": null,
      "joinedDate": "2025-01-15",
      
      "overallDiscipline": {
        "percentage": 78.5,
        "totalExpectedPosts": 150,
        "totalOnTimePosts": 118,
        "daysSinceJoined": 30
      },
      
      "periodDiscipline": {
        "percentage": 85.0,
        "expectedPosts": 35,
        "onTimePosts": 30,
        "daysInPeriod": 7
      },
      
      "disciplineImprovement": 6.5,
      
      "activities": {
        "weight": {
          "percentage": 90.0,
          "onTimePosts": 6,
          "expectedPosts": 7,
          "lastPosted": "2025-12-26T05:15:00",
          "targetWindow": "3:00 AM - 6:30 AM"
        },
        "education": {
          "percentage": 85.7,
          "onTimePosts": 6,
          "expectedPosts": 7,
          "lastPosted": "2025-12-25T07:30:00",
          "targetWindow": "7:15 AM - 8:45 AM"
        },
        "breakfast": {
          "percentage": 71.4,
          "onTimePosts": 5,
          "expectedPosts": 7,
          "lastPosted": "2025-12-26T07:00:00",
          "targetWindow": "5:30 AM - 8:30 AM"
        },
        "lunch": {
          "percentage": 100.0,
          "onTimePosts": 7,
          "expectedPosts": 7,
          "lastPosted": "2025-12-26T13:30:00",
          "targetWindow": "12:00 PM - 4:00 PM"
        },
        "dinner": {
          "percentage": 85.7,
          "onTimePosts": 6,
          "expectedPosts": 7,
          "lastPosted": "2025-12-26T19:00:00",
          "targetWindow": "5:30 PM - 8:30 PM"
        }
      }
    }
  ],
  
  "teamSummary": {
    "totalMembers": 15,
    "averageOverallDiscipline": 75.2,
    "averagePeriodDiscipline": 80.1,
    "topPerformer": {
      "userId": 789,
      "userName": "Sarah Johnson",
      "discipline": 95.0
    },
    "needsAttention": [
      {
        "userId": 456,
        "userName": "Mike Chen",
        "discipline": 45.0,
        "reason": "Below 60% threshold"
      }
    ]
  }
}
```

### 4.2 Refresh Cache API

**Endpoint**: `POST /api/coach/refresh-discipline-cache`

**Request Body**:
```json
{
  "coachId": 123,
  "userId": 456,           // Optional: Refresh specific member only
  "dateRange": "last7days"  // Optional: Refresh specific range only
}
```

**Response**:
```json
{
  "success": true,
  "message": "Cache refreshed successfully",
  "usersRefreshed": 1,
  "rangesRefreshed": ["last7days", "overall"],
  "calculationTime": "1.2s"
}
```

### 4.3 Cron Job: Warm Cache

**Endpoint**: `POST /api/cron/warm-discipline-cache`

**Purpose**: Runs hourly to update all cached discipline data

**Logic**:
1. Get all active coaches
2. For each coach, get their team members
3. For each member, calculate and cache:
   - `overall` (if older than 24h)
   - `last7days` (if older than 1h)
   - `last30days` (if older than 2h)
4. Log execution time and errors

---

## 5. FRONTEND ARCHITECTURE

### 5.1 Component Structure

```
frontend/src/
  pages/
    CoachDisciplineReport.js          # Main dashboard page
    
  components/
    coach/
      DisciplineTable.js               # Table view with all members
      DisciplineTableRow.js            # Individual row component
      DisciplineFilters.js             # Date range selector & filters
      TeamSummaryStats.js              # Summary cards (avg, top performer)
      MemberDetailModal.js             # Drill-down modal with charts
      DisciplineProgressBar.js         # Visual progress indicator
      ActivityBadge.js                 # Individual activity % badge
      ExportButton.js                  # CSV export functionality
      RefreshButton.js                 # Manual cache refresh
      
  services/
    disciplineReportService.js         # API calls and data formatting
    
  utils/
    disciplineCalculations.js          # Helper functions
```

### 5.2 State Management

```javascript
// Main state in CoachDisciplineReport.js
const [teamData, setTeamData] = useState(null);
const [loading, setLoading] = useState(true);
const [dateRange, setDateRange] = useState('last7days');
const [customDateRange, setCustomDateRange] = useState({ start: null, end: null });
const [filters, setFilters] = useState({
  searchQuery: '',
  sortBy: 'name',
  sortOrder: 'asc',
  disciplineFilter: 'all' // 'all' | 'high' (≥80%) | 'medium' (60-79%) | 'low' (<60%)
});
const [selectedMember, setSelectedMember] = useState(null);
const [lastUpdated, setLastUpdated] = useState(null);
const [isRefreshing, setIsRefreshing] = useState(false);
```

### 5.3 API Service Example

```javascript
// disciplineReportService.js
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

export const disciplineReportService = {
  /**
   * Fetch discipline report for coach's team
   */
  async getDisciplineReport(coachId, dateRange, customRange = null, forceRefresh = false) {
    const params = {
      coachId,
      dateRange,
      forceRefresh
    };
    
    if (dateRange === 'custom' && customRange) {
      params.startDate = customRange.start;
      params.endDate = customRange.end;
    }
    
    const response = await axios.get(`${API_BASE_URL}/api/coach/discipline-report`, {
      params
    });
    
    return response.data;
  },
  
  /**
   * Refresh cache for specific member
   */
  async refreshMemberCache(coachId, userId, dateRange) {
    const response = await axios.post(`${API_BASE_URL}/api/coach/refresh-discipline-cache`, {
      coachId,
      userId,
      dateRange
    });
    
    return response.data;
  },
  
  /**
   * Export report to CSV
   */
  exportToCSV(teamData, dateRange) {
    const headers = ['Name', 'Email', 'Overall %', 'Period %', 'Improvement', 'Weight', 'Education', 'Breakfast', 'Lunch', 'Dinner'];
    
    const rows = teamData.teamMembers.map(member => [
      member.userName,
      member.email,
      member.overallDiscipline.percentage,
      member.periodDiscipline.percentage,
      member.disciplineImprovement,
      member.activities.weight.percentage,
      member.activities.education.percentage,
      member.activities.breakfast.percentage,
      member.activities.lunch.percentage,
      member.activities.dinner.percentage
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `discipline-report-${dateRange}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  }
};
```

---

## 6. PERFORMANCE OPTIMIZATION

### 6.1 Calculation Strategy: Batch Query Processing

**Approach**: Calculate discipline on-demand using optimized batch queries that fetch all team members' data in 3-4 queries (not N queries).

```
┌──────────────────────────────────────────────────────┐
│        OPTIMIZED DISCIPLINE CALCULATION FLOW          │
├──────────────────────────────────────────────────────┤
│                                                       │
│  1. Coach Requests Report (50 team members)          │
│     ↓                                                 │
│  2. Get Team Member IDs (1 query, 5ms)               │
│     ↓                                                 │
│  3. Batch Query All Activities:                      │
│     ├─ Query 1: All weight data for all members      │
│     │           (50-100ms with indexes)              │
│     ├─ Query 2: All education data for all members   │
│     │           (50-100ms with indexes)              │
│     └─ Query 3: All meal data for all members        │
│                (50-100ms with indexes)               │
│     ↓                                                 │
│  4. Combine Results in Memory (10-20ms)              │
│     ↓                                                 │
│  5. Return Complete Report (Total: 200-400ms) ✅     │
│                                                       │
└──────────────────────────────────────────────────────┘
```

### 6.2 Performance Benchmarks (Realistic Estimates)

| Scenario | Query Time | Expected Performance |
|----------|-----------|---------------------|
| **Today (10 members)** | 50-100ms | ✅ Instant |
| **Last 7 Days (10 members)** | 100-200ms | ✅ Fast |
| **Last 30 Days (10 members)** | 200-400ms | ✅ Fast |
| **Today (50 members)** | 100-200ms | ✅ Fast |
| **Last 7 Days (50 members)** | 300-600ms | ✅ Acceptable |
| **Last 30 Days (50 members)** | 500-1000ms | ✅ Acceptable |
| **Custom range (50 members)** | 1-2 seconds | ✅ With loading UI |

**Keys to Performance:**
- ✅ Proper indexes on UserId, CreatedAt, IsDeleted
- ✅ Batch queries (all members at once, not one-by-one)
- ✅ No JOINs across large tables
- ✅ Efficient COUNT with CASE statements
- ✅ Query only when coach actually requests it

### 6.3 Batch Query Pattern (Core Performance Optimization)

**Instead of querying each member separately:**

```sql
-- BAD: N queries for N members (slow!)
FOR EACH member IN team_members:
  SELECT COUNT(*) FROM weight_records_table WHERE UserId = member.id ...

-- GOOD: 1 query for ALL members (fast!)
SELECT 
  UserId,
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
WHERE w.Simple Date Range Parsing

**All date ranges calculated on-demand using the same function:**

```javascript
// Helper: Parse date range strings to actual dates
function parseDateRange(range, customStart, customEnd) {
  const today = new Date();
  
  switch(range) {
    case 'today':
      return { start: today, end: today };
      
    case 'yesterday':
      const yesterday = subDays(today, 1);
      return { start: yesterday, end: yesterday };
      
    case 'last7days':
      return { start: subDays(today, 6), end: today };
      
    case 'last30days':
      return { start: subDays(today, 29), end: today };
      
    case 'current_month':
      return { start: startOfMonth(today), end: today };
      
    case 'overall':
      // Calculated per user from their EntryDateTime
      return 'per_user';
      
    case 'custom':
      return { start: new Date(customStart), end: new Date(customEnd) };
      
    default:
      return { start: subDays(today, 6), end: today };
  }
}

// Expected posts calculation
function calculateExpectedPosts(startDate, endDate) {
  const daysInPeriod = daysBetween(startDate, endDate) + 1; // Include both dates
  const activitiesPerDay = 5; // Weight, Education, Breakfast, Lunch, Dinner
  return daysInPeriod * activitiesPerDay;
}
```

### 7.2 Fast Switching Flow

```javascript
// Frontend: onDateRangeChange
async function handleDateRangeChange(newRange, customDates = null) {
  setLoading(true);
  
  try {
    // All date ranges calculated the same way (no cache lookup needed)
    const data = await disciplineReportService.getDisciplineReport(
      coachId, 
      newRange,
      customDates
    );
    
    setTeamData(data);
    setDateRange(newRange);
    
  } catch (error) {
    showError('Failed to load discipline report');
  } finally {
    setLoading(false);
  }
}

// Response times:
// - Today, Last 7 Days: 200-400ms ✅
// - Last 30 Days: 500-1000ms ✅
// - Custom Range: 1-2 seconds ✅ (with loading UI)
```

### 7.3 UI States

**State 1: Loading Data**
```jsx
<div className="flex items-center justify-center gap-3 py-8">
  <Spinner className="w-6 h-6" />
  <span className="text-gray-600">
    {teamSize > 30 
      ? 'Calculating discipline for large team...' 
      : 'Loading discipline report...'}
  </span>
</div>
```

**State 2: Data Loaded**
```jsx
<div className="flex items-center gap-2 text-sm text-gray-600">
  <Clock className="w-4 h-4" />
  <span>Report generated just now</span>
  <button onClick={refreshReport} className="text-blue-600 hover:underline">
    🔄 Refresh
  </button>
</div>
```

**State 3: Large Date Range Warning**
```jsx
{dateRange === 'custom' && daysBetween(startDate, endDate) > 90 && (
  <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-4">
    <span className="text-yellow-800">
      ⚠️ Large date range selected. This may take a few seconds to calculate.
    </span>
  </div>
)}
```

**State 2: Cached Data (Fresh)**
```jsx
<div className="flex items-center gap-2 text-sm text-gray-600">
  <span className="text-green-600">● Live</span>
  <span>Updated 2 minutes ago</span>
  <button onClick={forceRefresh}>🔄 Refresh</button>
</div>
```

**State 3: Cached Data (Stale)**
```jsx
<div className="flex items-center gap-2 text-sm text-orange-600">
  <span>⚠️ Data may be outdated (updated 2 hours ago)</span>
  <button onClick={forceRefresh}>🔄 Refresh Now</button>
</div>
```

**State 4: Real-time Calculation (Custom Range)**
```jsx
<div className="flex items-center gap-2">
  <Spinner />
  <span>Calculating discipline for custom range...</span>
  <ProgressBar value={65} max={100} />
</div>
```

---

## 8. UI/UX DESIGN

### 8.1 Table Layout ⭐ RECOMMENDED

```
┌─────────────────────────────────────────────────────────────────────┐
│  🏆 Team Discipline Report                        📅 Last 7 Days ▼ │
├─────────────────────────────────────────────────────────────────────┤
│  Team Average: 78.5% (+3.2% vs Overall)    15 Members    🔄 Refresh │
│  🕐 Last updated: 5 min ago                                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  🔍 Search members...   📊 Export CSV   Filter: All ▼               │
│                                                                       │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │ ☐  Name ↕   Overall  Period   Trend   W   E   B   L   D   ⋮ │ │
│  ├───────────────────────────────────────────────────────────────┤ │
│  │ ☐  🟢 Sarah Johnson                                          │ │
│  │     95.0%    98.0%   ↑+3.0%  100% 100% 90% 100% 100%   ⋮    │ │
│  ├───────────────────────────────────────────────────────────────┤ │
│  │ ☐  🟡 John Doe                                               │ │
│  │     78.5%    85.0%   ↑+6.5%   90%  86% 71% 100%  86%   ⋮    │ │
│  ├───────────────────────────────────────────────────────────────┤ │
│  │ ☐  🔴 Mike Chen                                              │ │
│  │     52.0%    45.0%   ↓-7.0%   40%  30% 50%  60%  40%   ⋮    │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  Color Coding: 🟢 ≥80%  🟡 60-79%  🔴 <60%                         │
└─────────────────────────────────────────────────────────────────────┘
```

### 8.2 Color Coding System

| Discipline Range | Color | Icon | Interpretation |
|-----------------|-------|------|----------------|
| ≥ 90% | Dark Green | 🟢 | Excellent |
| 80-89% | Light Green | 🟢 | Good |
| 70-79% | Yellow | 🟡 | Fair |
| 60-69% | Orange | 🟠 | Needs Improvement |
| < 60% | Red | 🔴 | Needs Attention |

### 8.3 Interactive Features

**1. Sortable Columns**
- Click column header to sort ascending/descending
- Multi-column sort (hold Shift + click)
- Sort by: Name, Overall %, Period %, Improvement, Individual activities

**2. Expandable Rows**
- Click "⋮" icon to expand row
- Shows detailed activity breakdown
- Mini chart showing daily posting pattern
- Quick actions: Message member, View full profile, Refresh data

**3. Filters**
- **Search**: Filter by name or email
- **Discipline Range**: All | High (≥80%) | Medium (60-79%) | Low (<60%)
- **Activity**: Filter by specific activity performance
- **Sort**: Name, Overall %, Period %, Improvement

**4. Bulk Actions**
- Select multiple members with checkboxes
- Actions: Send group message, Export selected, Refresh selected

### 8.4 Responsive Design

**Desktop (≥1024px)**
```
Full table with all columns visible
12-15 members visible without scrolling
Sticky header on scroll
```

**Tablet (768-1023px)**
```Backend & Database (Day 1-2)

**Database**:
- ✅ Create `activity_time_windows_table` with default windows
- ✅ Add required indexes to existing tables (weight, education, food)
- ✅ Test time window versioning queries

**Backend APIs**:
- ✅ Implement core calculation function: `calculateDiscipline(userId, startDate, endDate)`
- ✅ Implement batch calculation: `calculateTeamDiscipline(memberIds, startDate, endDate)`
- ✅ Create `/api/coach/discipline-report` endpoint
- ✅ Add authorization middleware (verify coach access)
- ✅ Unit tests for calculation logic

**Deliverables**:
- Working discipline calculation engine
- API endpoint returning JSON data
- Proper authorization and validation

---

### Phase 2: Frontend Dashboard (Day 3-4)

**Frontend Components**:
- ✅ Create `CoachDisciplineReport` page
- ✅ Implement `DisciplineTable` component with sortable columns
- ✅ Add date range selector dropdown (Today, Last 7 Days, Last 30 Days, Overall)
- ✅ Add search and filter functionality
- ✅ Loading states and skeleton UI
- ✅ Team summary statistics cards

**Deliverables**:
- Working dashboard with table view
- Sorting and filtering
- All pre-defined date ranges functional
- Responsive design (desktop & tablet)

---

### Phase 3: Admin Time Window Settings (Day 5)

**Backend APIs**:
- ✅ GET `/api/admin/time-windows` - Get current time windows
- ✅ POST `/api/admin/time-windows/update` - Update time window
- ✅ GET `/api/admin/time-windows/history` - View change history
- ✅ Admin authorization middleware

**Frontend Modal**:
- ✅ Create `TimeWindowSettingsModal` component
- ✅ Time picker inputs (start/end time)
- ✅ Date picker for effective date
- ✅ Reason textarea
- ✅ Display current windows and change history
- ✅ Save/cancel with confirmation dialog

**Deliverables**:
- Fully functional admin settings modal
- Time window versioning working correctly
- Historical discipline calculations preserved

---

### Phase 4: Enhanced Features (Day 6)

**Backend**:
- ✅ Add custom date range support (date picker validation)
- ✅ Implement CSV export data formatting

**Frontend**:
- ✅ Custom date range picker
- ✅ CSV export button
- ✅ Expandable row details (click to see full breakdown)
- ✅ Advanced filters (discipline range: High/Medium/Low)
- ✅ Empty states and error handling
- ✅ Mobile responsive design (auto card view)

**Deliverables**:
- Full-featured dashboard
- Export functionality
- Mobile-friendly UI

---

### Phase 5: Testing & Polish (Day 7)

**Testing**:
- ✅ Test with 50+ team members
- ✅ Test all date ranges
- ✅ Test time window changes and historical accuracy
- ✅ Test edge cases (deleted posts, late posts, no data)
- ✅ Cross-browser testing
- ✅ Performance benchmarking

**Polish**:
- ✅ Animations and transitions
- ✅ Accessibility improvements (ARIA labels, keyboard navigation)
- ✅ Final UI/UX refinements

**Deliverables**:
- Production-ready code
- Performance meeting benchmarks
- All edge cases handled
- Working dashboard with real-time calculations
- Basic table view with sorting
- Pre-defined date ranges (Today, Last 7 Days, Last 30 Days, Overall)

---

### Phase 2: Performance Optimization (2-3 days)

**Backend**:
- ✅ Implement caching logic
- ✅ Create `/api/coach/refresh-discipline-cache` endpoint
- ✅ Create `/api/cron/warm-discipline-cache` cron job
- ✅ Add cache TTL management
- ✅ Performance testing with 50+ members

**Frontend**:
- ✅ Add "Last updated" indicator
- ✅ Implement manual refresh button
- ✅ Add cache freshness visual cues
- ✅ Optimize re-renders with React.memo

**Deliverables**:
- Sub-second response times for cached ranges
- Automatic cache warming every hour
- Manual refresh capability

---

### Phase 3: Enhanced Features (2-3 days)

**Backend**:
- ✅ Add custom date range support
- ✅ Implement team summary statistics
- ✅ Add member detail endpoint for drill-down

**Frontend**:
- ✅ Custom date range picker
- ✅ Team summary cards (avg, top performer, needs attention)
- ✅ Expandable row details
- ✅ CSV export functionality
- ✅ Member detail modal with charts
- ✅ Advanced filters (discipline range, activity-specific)
- ✅ Bulk actions (select multiple, message)

**Deliverables**:
- Full-featured dashboard with all planned capabilities
- Export and reporting tools
- Drill-down analytics

---

### Phase 4: Polish & Mobile (1-2 days)

**Frontend**:
- ✅ Mobile responsive design (card view)
- ✅ Touch gestures (pull-to-refresh, swipe)
- ✅ Animations and transitions
- ✅ Empty states and error handling
- ✅ Accessibility improvements (ARIA labels, keyboard navigation)

**Testing**:
- ✅ Cross-browser testing
- ✅ Performance testing on mobile devices
- ✅ User acceptance testing with real coaches

**Deliverables**:
- Fully responsive dashboard
- Smooth user experience on all devices
- Production-ready code

---

## 11. TESTING STRATEGY

### 11.1 Backend Testing

**Unit Tests**:
```javascript
// Test discipline calculations
describe('Discipline Calculation', () => {
  test('calculates weight discipline correctly', () => {
    const posts = [
      { createdAt: '2025-12-26T05:15:00', isOnTime: true },
      { createdAt: '2025-12-25T07:00:00', isOnTime: false }
    ];
    const expected = 7; // days in period
    const result = calculateActivityDiscipline(posts, expected);
    expect(result.percentage).toBe(14.3); // 1/7 * 100
  });
  
  test('handles empty data correctly', () => {
    const result = calculateActivityDiscipline([], 7);
    expect(result.percentage).toBe(0);
    expect(result.onTimePosts).toBe(0);
  });
});
```

**Integration Tests**:
- Test cache storage and retrieval
- Test cron job execution
- Test authorization middleware
- Load testing with 100+ team members

### 11.2 Frontend Testing

**Component Tests**:
```javascript
import { render, screen, fireEvent } from '@testing-library/react';
import DisciplineTable from './DisciplineTable';

test('renders discipline table with data', () => {
  const mockData = { teamMembers: [/* mock members */] };
  render(<DisciplineTable data={mockData} />);
  expect(screen.getByText('Team Discipline Report')).toBeInTheDocument();
});

test('sorts table when column header clicked', () => {
  render(<DisciplineTable data={mockData} />);
  const nameHeader = screen.getByText('Name');
  fireEvent.click(nameHeader);
  // Assert sorting order changed
});
```

**E2E Tests** (Cypress/Playwright):
- Coach logs in → navigates to discipline report
- Changes date range → verifies data updates
- Searches for member → verifies filtering
- Exports to CSV → verifies file download
- Clicks refresh → verifies loading state

### 11.3 Performance Testing

**Metrics to Monitor**:
- API response time (p50, p95, p99)
- Cache hit rate (target: >85%)
- Database query execution time
- Frontend render time
- Time to interactive (TTI)

**Load Testing Scenarios**:
- 10 concurrent coaches viewing reports
- 50 team members per coach
- Simultaneous cache refreshes
- Custom date range calculations

---

## 12. EDGE CASES & ERROR HANDLING

### 12.1 Data Edge Cases

| Scenario | Handling |
|----------|----------|
| New member (no historical data) | Show "No data yet" with join date |
| Member with no posts in period | Display 0% with clear message |
| Incomplete user profile (missing meal times) | Use default time windows |
| Deleted posts (IsDeleted = 1) | Exclude from calculations |
| Future dates in custom range | Validate and show error |
| Date range > 1 year | Show warning: "Large range may be slow" |

### 12.2 System Error Handling

```javascript
// API error responses
{
  // Database connection error
  { success: false, error: 'Database unavailable', code: 'DB_ERROR' }
  
  // Authorization error
  { success: false, error: 'Unauthorized access', code: 'AUTH_ERROR' }
  
  // Cache miss (fallback to real-time)
  { success: true, source: 'realtime', warning: 'Cache unavailable' }
  
  // Calculation timeout
  { success: false, error: 'Calculation timeout', code: 'TIMEOUT', retry: true }
}
```

**Frontend Error UI**:
- Show toast notification for transient errors
- Display inline error message for validation issues
- Provide retry button for failed operations
- Log errors to monitoring service (Sentry, etc.)

---

## 13. FUTURE ENHANCEMENTS

### 13.1 Short-term (Next 2-3 months)
- 📊 **Trend Charts**: Visualize discipline over time with line graphs
- 📱 **Push Notifications**: Alert coaches when member drops below threshold
- 💬 **In-app Messaging**: Direct message from discipline report
- 📈 **Goal Setting**: Set discipline targets for members
- 🏅 **Achievements**: Badges for consistent performers

### 13.2 Long-term (6+ months)
- 🤖 **AI Recommendations**: Suggest personalized interventions
- 📊 **Predictive Analytics**: Forecast mem
3. **Database Rollback**: Drop `activity_time_windows_table` (can be recreated with defaults)
4. **Communication**: Notify coaches via email/in-app message

---

## 17. ADMIN TIME WINDOW MANAGEMENT

### 17.1 Time Window Settings Modal

**Access**: Admin/Developer only (role-based)

**Features**:
- View current active time windows for all activities
- Edit time windows with start/end time pickers
- Set effective date for changes (default: today)
- Add optional reason for change (audit trail)
- View complete change history

**UI Mockup**:
```
┌──────────────────────────────────────────────────────────┐
│  ⚙️ Activity Time Windows Configuration                  │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  ⚠️ Warning: Changing time windows will only affect      │
│     future activity logs. Historical discipline %        │
│     will remain calculated with original windows.        │
│                                                           │
│  ┌────────────────────────────────────────────────────┐ │
│  │ Activity: Weight Tracking                          │ │
│  │                                                     │ │
│  │ Current Window: 3:00 AM - 6:30 AM                 │ │
│  │ Active Since: Jan 1, 2025                          │ │
│  │                                                     │ │
│  │ New Window:                                        │ │
│  │ Start Time: [04:00 AM ▼]  End Time: [07:00 AM ▼] │ │
│  │                                                     │ │
│  │ Effective From: [Feb 15, 2025 ▼] (Default: Today) │ │
│  │                                                     │ │
│  │ Reason for Change (optional):                      │ │
│  │ [Extended morning window based on user feedback]   │ │
│  │                                                     │ │
│  │          [Cancel]  [Save Changes]                  │ │
│  └────────────────────────────────────────────────────┘ │
│                                                           │
│  📋 Recent Changes:                                      │
│  • Feb 15, 2025 - Weight: 3:00-6:30 → 4:00-7:00        │
│    by admin@wellness.com (Extended morning window)       │
└──────────────────────────────────────────────────────────┘
```

### 17.2 How Time Window Changes Work

**Example Timeline**:

```
Jan 1-Feb 14: Weight window = 3:00-6:30 AM
              User logs at 6:00 AM → ON-TIME ✅ (evaluated with 3:00-6:30)

Feb 15+:      Weight window = 4:00-7:00 AM
              User logs at 6:00 AM → ON-TIME ✅ (evaluated with 4:00-7:00)

Coach views "Last 60 Days" on Mar 1:
  - Jan posts: Use 3:00-6:30 window ✅ (window active at that time)
  - Feb posts: Use 4:00-7:00 window ✅ (window active at that time)
  
Result: No retroactive changes! Historical accuracy preserved.
```

**Database Operations**:

```sql
-- When admin updates time window:

-- 1. Close previous window
UPDATE activity_time_windows_table 
SET EffectiveToDate = '2025-02-15 00:00:00'
WHERE ActivityType = 'weight' AND EffectiveToDate IS NULL;

-- 2. Insert new window
INSERT INTO activity_time_windows_table 
(ActivityType, WindowStartTime, WindowEndTime, EffectiveFromDate, ChangedBy, ChangeReason)
VALUES
('weight', '04:00:00', '07:00:00', '2025-02-15 00:00:00', 'admin@wellness.com', 'Extended morning window');
```

**Discipline Query with Time Windows**:

```sql
-- Each post evaluated with correct time window
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
  AND w.IsDeleted = 0;
```

---

## CONCLUSION

This plan provides a comprehensive roadmap for implementing the Coach Discipline Report module with:

✅ **Accurate Calculations**: Query-based approach ensures 100% accuracy  
✅ **Fast Performance**: 200-1000ms response times with batch processing  
✅ **Scalability**: Handles 100+ team members efficiently  
✅ **Historical Integrity**: Time window versioning preserves historical discipline calculations  
✅ **Flexible**: Supports any date range without complex caching  
✅ **Great UX**: Intuitive table interface with loading states  
✅ **Admin Control**: Time window management with full audit trail  
✅ **Maintainability**: Simple, clean architecture with single source of truth  

**Total Estimated Development Time**: 7 days

**Ready for Implementation**: ✅ Final plan approved

---

## KEY DECISIONS MADE

1. **No Cache Tables**: Calculate on-demand from existing data (simpler, always accurate)
2. **Batch Queries**: Query all team members at once (50x faster than individual queries)
3. **Time Window Versioning**: Historical posts evaluated with original windows (no retroactive changes)
4. **Query-Based Expected Posts**: Days calculated from dates, not stored counters (handles user inactivity correctly)
5. **Admin Modal**: Centralized time window management with audit trail
6. **Meal Type Inference**: Since no MealType column exists, infer from posting time
7. **UserID Handling**: Cast varchar UserID to UNSIGNED for consistency across tables
8. **Fixed Time Windows**: Use global windows (no personalized meal times in team_table)
9. **Avoid discipline_table**: Build fresh calculation engine, ignore existing discipline_table

---

## DATABASE COMPATIBILITY NOTES

**Critical Schema Differences from Original Plan:**

| Original Assumption | Actual Schema | Solution |
|---------------------|---------------|----------|
| `food_nutrition_data_table.MealType` column | ❌ Column doesn't exist | Infer from CreatedAt time |
| `food_nutrition_data_table.UserId` (int) | `UserID` (varchar) ⚠️ | Use `CAST(UserID AS UNSIGNED)` |
| `team_table.WakeUpTime`, `LunchTime`, `DinnerTime` | ❌ Columns don't exist | Use fixed global time windows |
| `team_table.Status` (enum) | varchar ⚠️ | Check for 'active' or 'Active' |
| Personalized time windows per user | Not supported | Use `activity_time_windows_table` for global windows |

**Working With:**
- ✅ `team_table`: UserId, UserName, Email, UplineCoachId, TeamId, Role (enum: 'user', 'coach', 'admin')
- ✅ `weight_records_table`: UserId (bigint), Weight, CreatedAt, IsDeleted
- ✅ `education_logs_table`: UserId (int), Platform, CreatedAt, IsDeleted  
- ✅ `food_nutrition_data_table`: UserID (varchar), CreatedAt, IsDeleted
- ✅ `coach_teams_table`: TeamId, CoachId, CoCoachId, Status (enum: 'active', 'inactive')
- ✅ `approval_requests_table`: RequesterId, UplineCoachId, Status

---

**Document Control**  
**Last Updated**: December 26, 2025  
**Status**: Final Plan - Ready for Implementation  
**Next Review**: After Phase 2 completion  
**Approved By**: Development Team

### 15.1 Pre-Deployment
- [ ] All unit tests passing
- [ ] Integration tests passing
- [ ] Performance benchmarks met
- [ ] Security audit completed
- [ ] Code review approved
- [ ] Database migration tested in staging
- [ ] Cron job scheduled in production

### 15.2 Deployment Steps
1. [ ] Run database migration (create `discipline_cache_table`)
2. [ ] Deploy backend API changes
3. [ ] Deploy frontend changes
4. [ ] Configure cron job (hourly cache warming)
5. [ ] Verify API endpoints in production
6. [ ] Monitor error logs for 24 hours
7. [ ] Notify coaches of new feature

### 15.3 Post-Deployment
- [ ] Monitor API performance metrics
- [ ] Track cache hit rates
- [ ] Collect user feedback
- [ ] Address any bugs within 48 hours
- [ ] Plan Phase 2 enhancements based on usage data

---

## 16. ROLLBACK PLAN

If critical issues arise:

1. **Frontend Rollback**: Revert to previous version (hide menu link)
2. **Backend Rollback**: Revert API changes, disable cron job
3. **Database Rollback**: Drop `discipline_cache_table` (data not critical)
4. **Communication**: Notify coaches via email/in-app message

---

## CONCLUSION

This plan provides a comprehensive roadmap for implementing the Coach Discipline Report module with:

✅ **High Performance**: Sub-second response times through intelligent caching  
✅ **Scalability**: Handles 100+ team members efficiently  
✅ **Great UX**: Intuitive table interface with instant date range switching  
✅ **Security**: Role-based access with proper authorization  
✅ **Maintainability**: Clean architecture with well-defined APIs  

**Total Estimated Development Time**: 8-12 days (across 4 phases)

**Ready for Implementation**: ✅ All requirements documented and approved

---

**Document Control**  
**Last Updated**: December 26, 2025  
**Next Review**: After Phase 1 completion  
**Approval**: Pending stakeholder sign-off
