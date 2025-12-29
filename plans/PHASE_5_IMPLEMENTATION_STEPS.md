# Phase 5: Hierarchical Discipline Report - Step-by-Step Implementation Guide

**Date:** December 29, 2025  
**Status:** Ready for Implementation  
**Estimated Time:** 6-8 hours

---

## 📋 Pre-Implementation Checklist

- [ ] Backup current `discipline-report.js` API file
- [ ] Backup current `DisciplineReport.js` component
- [ ] Verify MySQL version supports recursive CTEs (MySQL 8.0+)
- [ ] Test database connection
- [ ] Review current discipline calculation logic

---

## 🎯 Implementation Overview

**What We're Building:**
- Flat list of all nested team members (no grouping)
- Coach's own performance card at top
- Coach badge on each member showing their direct coach
- Team filter pills (All Teams, My Team, Coach X's Team)
- Sort functionality (highest→lowest, vice versa)

**Single API Call Strategy:**
- One endpoint returns everything (coach + all members + filters)
- Client-side filtering and sorting
- No lazy loading needed

---

## STEP 1: Update Database Query (Backend)

### File: `backend/pages/api/coach/discipline-report.js`

**Location:** Line 70-81 (current member fetch query)

**Current Code:**
```javascript
// Step 1: Get team members
const [members] = await connection.execute(`
  SELECT UserId, UserName, Email, EntryDateTime
  FROM team_table
  WHERE UplineCoachId = ?
    AND Status = 'active'
  ORDER BY UserName
`, [coachId]);
```

**Replace With:**
```javascript
// Step 1: Get ALL team members (recursive) + logged-in coach
const [members] = await connection.execute(`
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
      AND th.HierarchyLevel < 10  -- Max 10 levels deep
      AND th.HierarchyLevel > 0   -- Don't recurse from coach (level 0)
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
```

**Test Query:**
```sql
-- Test in MySQL Workbench with coachId = 1
SET @coachId = 1;
-- Run the above query, replacing ? with @coachId
```

**Expected Results:**
- Row 1: Coach themselves (HierarchyLevel = 0, IsLoggedInCoach = TRUE)
- Rows 2+: All team members with UplineCoachName populated

---

## STEP 2: Separate Coach from Team Members (Backend)

### File: `backend/pages/api/coach/discipline-report.js`

**Location:** After the member query (around line 100)

**Add New Code:**
```javascript
// Separate logged-in coach from team members
const loggedInCoach = members.find(m => m.IsLoggedInCoach);
const teamMembers = members.filter(m => !m.IsLoggedInCoach);

// If no members found (only coach exists)
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
```

---

## STEP 3: Calculate Discipline for Coach + Team (Backend)

### File: `backend/pages/api/coach/discipline-report.js`

**Location:** Replace discipline calculation section (around line 130)

**Current Code:**
```javascript
// Step 2: Calculate discipline for all members
const memberIds = members.map(m => m.UserId);
const disciplineData = await calculateTeamDiscipline(
  connection,
  memberIds,
  dates.start,
  dates.end
);
```

**Replace With:**
```javascript
// Step 2: Calculate discipline for coach + all team members
const allUserIds = members.map(m => m.UserId);  // Includes coach
const disciplineData = await calculateTeamDiscipline(
  connection,
  allUserIds,
  dates.start,
  dates.end
);
```

---

## STEP 4: Build Coach Filters Array (Backend)

### File: `backend/pages/api/coach/discipline-report.js`

**Location:** After time window map creation (around line 120)

**Add New Function:**
```javascript
// Helper function to extract coach filter options
function buildCoachFilters(members, loggedInCoachId) {
  const filters = [];
  
  // Add "My Team" filter (logged-in coach's direct members)
  const myTeamCount = members.filter(m => 
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
  members.forEach(member => {
    if (member.Role === 'coach' && !member.IsLoggedInCoach) {
      const teamCount = members.filter(m => m.UplineCoachId === member.UserId).length;
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
}

// Use the function
const coachFilters = buildCoachFilters(members, parseInt(coachId));
```

---

## STEP 5: Format Coach Performance Response (Backend)

### File: `backend/pages/api/coach/discipline-report.js`

**Location:** Before team members formatting (around line 150)

**Add New Code:**
```javascript
// Format logged-in coach's performance data
let coachPerformanceData = null;
if (loggedInCoach) {
  const coachDiscipline = disciplineData.find(d => d.userId === loggedInCoach.UserId);
  
  if (coachDiscipline) {
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
          coachDiscipline.totalOnTimePosts,
          coachDiscipline.totalExpectedPosts
        ),
        onTimePosts: coachDiscipline.totalOnTimePosts,
        expectedPosts: coachDiscipline.totalExpectedPosts
      },
      activities: {
        weight: {
          percentage: calculateDisciplinePercentage(
            coachDiscipline.weight.onTimePosts,
            coachDiscipline.weight.expectedPosts
          ),
          onTimePosts: coachDiscipline.weight.onTimePosts,
          expectedPosts: coachDiscipline.weight.expectedPosts,
          targetWindow: timeWindowMap.weight 
            ? `${formatTimeForDisplay(timeWindowMap.weight.start)} - ${formatTimeForDisplay(timeWindowMap.weight.end)}`
            : 'Not Set'
        },
        education: {
          percentage: calculateDisciplinePercentage(
            coachDiscipline.education.onTimePosts,
            coachDiscipline.education.expectedPosts
          ),
          onTimePosts: coachDiscipline.education.onTimePosts,
          expectedPosts: coachDiscipline.education.expectedPosts,
          targetWindow: timeWindowMap.education 
            ? `${formatTimeForDisplay(timeWindowMap.education.start)} - ${formatTimeForDisplay(timeWindowMap.education.end)}`
            : 'Not Set'
        },
        breakfast: {
          percentage: calculateDisciplinePercentage(
            coachDiscipline.breakfast.onTimePosts,
            coachDiscipline.breakfast.expectedPosts
          ),
          onTimePosts: coachDiscipline.breakfast.onTimePosts,
          expectedPosts: coachDiscipline.breakfast.expectedPosts,
          targetWindow: timeWindowMap.breakfast 
            ? `${formatTimeForDisplay(timeWindowMap.breakfast.start)} - ${formatTimeForDisplay(timeWindowMap.breakfast.end)}`
            : 'Not Set'
        },
        lunch: {
          percentage: calculateDisciplinePercentage(
            coachDiscipline.lunch.onTimePosts,
            coachDiscipline.lunch.expectedPosts
          ),
          onTimePosts: coachDiscipline.lunch.onTimePosts,
          expectedPosts: coachDiscipline.lunch.expectedPosts,
          targetWindow: timeWindowMap.lunch 
            ? `${formatTimeForDisplay(timeWindowMap.lunch.start)} - ${formatTimeForDisplay(timeWindowMap.lunch.end)}`
            : 'Not Set'
        },
        dinner: {
          percentage: calculateDisciplinePercentage(
            coachDiscipline.dinner.onTimePosts,
            coachDiscipline.dinner.expectedPosts
          ),
          onTimePosts: coachDiscipline.dinner.onTimePosts,
          expectedPosts: coachDiscipline.dinner.expectedPosts,
          targetWindow: timeWindowMap.dinner 
            ? `${formatTimeForDisplay(timeWindowMap.dinner.start)} - ${formatTimeForDisplay(timeWindowMap.dinner.end)}`
            : 'Not Set'
        }
      }
    };
  }
}
```

---

## STEP 6: Update Team Members Formatting (Backend)

### File: `backend/pages/api/coach/discipline-report.js`

**Location:** Team members mapping section (around line 150)

**Update Existing Code:**
```javascript
// Step 3: Format response data (team members only, exclude coach)
const formattedTeamMembers = teamMembers.map(member => {
  const discipline = disciplineData.find(d => d.userId === member.UserId);
  
  if (!discipline) {
    return null; // Skip members with no data
  }
  
  // Check if this member is also a coach
  const isCoach = member.Role === 'coach';
  const subTeamCount = isCoach 
    ? members.filter(m => m.UplineCoachId === member.UserId).length 
    : 0;
  
  // Calculate percentages for each activity
  const activities = {
    weight: {
      percentage: calculateDisciplinePercentage(
        discipline.weight.onTimePosts,
        discipline.weight.expectedPosts
      ),
      onTimePosts: discipline.weight.onTimePosts,
      expectedPosts: discipline.weight.expectedPosts,
      targetWindow: timeWindowMap.weight 
        ? `${formatTimeForDisplay(timeWindowMap.weight.start)} - ${formatTimeForDisplay(timeWindowMap.weight.end)}`
        : 'Not Set'
    },
    // ... (same for education, breakfast, lunch, dinner)
  };
  
  // Calculate overall period discipline
  const totalOnTimePosts = discipline.totalOnTimePosts;
  const totalExpectedPosts = discipline.totalExpectedPosts;
  const periodPercentage = calculateDisciplinePercentage(totalOnTimePosts, totalExpectedPosts);
  
  return {
    userId: member.UserId,
    userName: member.UserName,
    email: member.Email,
    role: member.Role,
    isCoach: isCoach,
    isLoggedInCoach: false,
    subTeamCount: subTeamCount,
    uplineCoachId: member.UplineCoachId,
    uplineCoachName: member.UplineCoachName,  // NEW: For badge display
    hierarchyLevel: member.HierarchyLevel,     // NEW: For reference
    periodDiscipline: {
      percentage: periodPercentage,
      onTimePosts: totalOnTimePosts,
      expectedPosts: totalExpectedPosts
    },
    activities: activities
  };
}).filter(member => member !== null);
```

---

## STEP 7: Update Response Structure (Backend)

### File: `backend/pages/api/coach/discipline-report.js`

**Location:** Final response section (around line 250)

**Replace Response:**
```javascript
// Calculate summary stats
const allScores = formattedTeamMembers.map(m => m.periodDiscipline.percentage);
const averageScore = allScores.length > 0 
  ? allScores.reduce((sum, score) => sum + score, 0) / allScores.length 
  : 0;

const sortedByScore = [...formattedTeamMembers].sort(
  (a, b) => b.periodDiscipline.percentage - a.periodDiscipline.percentage
);
const topPerformer = sortedByScore.length > 0 ? {
  userId: sortedByScore[0].userId,
  userName: sortedByScore[0].userName,
  score: sortedByScore[0].periodDiscipline.percentage
} : null;

const needsAttention = formattedTeamMembers
  .filter(m => m.periodDiscipline.percentage < 60)
  .map(m => ({
    userId: m.userId,
    userName: m.userName,
    score: m.periodDiscipline.percentage
  }));

// Send response
await connection.end();
return res.status(200).json({
  success: true,
  source: 'realtime',
  lastUpdated: new Date().toISOString(),
  coachId: parseInt(coachId),
  dateRange,
  startDate: dates.start.toISOString().split('T')[0],
  endDate: dates.end.toISOString().split('T')[0],
  
  // NEW: Coach's own performance
  coachPerformance: coachPerformanceData,
  
  // NEW: Flat list of all team members
  teamMembers: formattedTeamMembers,
  
  // NEW: Coach filter options
  coachFilters: coachFilters,
  
  // Updated: Team summary
  teamSummary: {
    totalMembers: members.length,  // Including coach
    totalTeamMembers: formattedTeamMembers.length,  // Excluding coach
    totalCoaches: coachFilters.length,
    averagePeriodDiscipline: averageScore,
    topPerformer: topPerformer,
    needsAttention: needsAttention
  }
});
```

---

## STEP 8: Add Required Icons (Frontend)

### File: `frontend/src/components/DisciplineReport.js`

**Location:** Import section (around line 10)

**Add New Imports:**
```javascript
import { 
  ArrowLeft, 
  RefreshCw, 
  Download, 
  Search, 
  Filter, 
  ChevronDown, 
  ChevronUp,
  Scale,
  BookOpen,
  Coffee,
  Utensils,
  Moon,
  Check,
  Settings,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ArrowUp,      // NEW: For sort button
  ArrowDown,    // NEW: For sort button
  Target        // NEW: For coach badge icon
} from 'lucide-react';
```

---

## STEP 9: Add New State Variables (Frontend)

### File: `frontend/src/components/DisciplineReport.js`

**Location:** State declarations (around line 250)

**Add New State:**
```javascript
const [teamFilter, setTeamFilter] = useState('all');  // NEW: Team filter
const [sortOrder, setSortOrder] = useState('desc');   // NEW: Sort order
```

---

## STEP 10: Update Filter and Sort Logic (Frontend)

### File: `frontend/src/components/DisciplineReport.js`

**Location:** After state declarations (around line 380)

**Replace filteredMembers with:**
```javascript
// Filter and sort team members
const filteredAndSortedMembers = teamData?.teamMembers
  ?.filter(member => {
    // Search filter
    const matchesSearch = member.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.email.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Discipline score filter
    const discipline = member.periodDiscipline.percentage;
    let matchesDiscipline = true;
    if (disciplineFilter === 'high') matchesDiscipline = discipline >= 80;
    if (disciplineFilter === 'medium') matchesDiscipline = discipline >= 60 && discipline < 80;
    if (disciplineFilter === 'low') matchesDiscipline = discipline < 60;
    
    // Team filter (NEW)
    let matchesTeam = true;
    if (teamFilter === 'myTeam') {
      matchesTeam = member.uplineCoachId === user.id;
    } else if (teamFilter !== 'all') {
      matchesTeam = member.uplineCoachId === parseInt(teamFilter);
    }

    return matchesSearch && matchesDiscipline && matchesTeam;
  })
  .sort((a, b) => {
    // Sort by discipline score (NEW)
    const scoreA = a.periodDiscipline.percentage;
    const scoreB = b.periodDiscipline.percentage;
    return sortOrder === 'desc' ? scoreB - scoreA : scoreA - scoreB;
  }) || [];
```

---

## STEP 11: Create Coach Performance Card Component (Frontend)

### File: `frontend/src/components/DisciplineReport.js`

**Location:** Before LoadingSkeleton component (around line 100)

**Add New Component:**
```javascript
const CoachPerformanceCard = ({ coach }) => {
  if (!coach) return null;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-green-50 to-green-100 rounded-2xl p-4 shadow-sm border-2 border-green-200 mb-6"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center text-white font-bold text-lg shadow-md">
            {coach.userName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-gray-900 text-lg">{coach.userName}</h3>
              <span className="text-xs bg-green-600 text-white px-2 py-1 rounded-full font-semibold">
                YOU
              </span>
            </div>
            <p className="text-xs text-gray-600">{coach.email}</p>
            <p className="text-xs text-green-700 font-semibold mt-0.5">My Performance</p>
          </div>
        </div>
        
        <div className="text-right">
          <p className={`text-3xl font-bold ${getScoreColorText(coach.periodDiscipline.percentage)}`}>
            {Math.round(coach.periodDiscipline.percentage)}%
          </p>
          <p className="text-[10px] text-gray-500 uppercase tracking-wider">Discipline</p>
          <p className="text-xs text-gray-500 mt-1">
            {coach.periodDiscipline.onTimePosts}/{coach.periodDiscipline.expectedPosts} Posts
          </p>
        </div>
      </div>
      
      {/* Activity Breakdown */}
      <div className="grid grid-cols-5 gap-2 mt-4">
        {Object.entries(coach.activities).map(([activity, data]) => (
          <div key={activity} className="text-center bg-white/60 rounded-lg p-2">
            <div className="flex justify-center mb-1">
              {activityIcons[activity]}
            </div>
            <p className={`text-sm font-bold ${getScoreColorText(data.percentage)}`}>
              {Math.round(data.percentage)}%
            </p>
            <p className="text-[9px] text-gray-500 capitalize">{activity}</p>
          </div>
        ))}
      </div>
    </motion.div>
  );
};
```

---

## STEP 12: Create Team Filter Pills Component (Frontend)

### File: `frontend/src/components/DisciplineReport.js`

**Location:** After CoachPerformanceCard component

**Add New Component:**
```javascript
const TeamFilterPills = ({ filters, activeFilter, onChange }) => {
  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
      <button
        onClick={() => onChange('all')}
        className={`whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-medium transition-all border ${
          activeFilter === 'all'
            ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-100'
            : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
        }`}
      >
        All Teams
      </button>
      {filters.map(filter => (
        <button
          key={filter.coachId}
          onClick={() => onChange(filter.isMyTeam ? 'myTeam' : filter.coachId.toString())}
          className={`whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-medium transition-all border ${
            activeFilter === (filter.isMyTeam ? 'myTeam' : filter.coachId.toString())
              ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-100'
              : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
          }`}
        >
          {filter.coachName} ({filter.memberCount})
        </button>
      ))}
    </div>
  );
};
```

---

## STEP 13: Add Sort Button to Search Bar (Frontend)

### File: `frontend/src/components/DisciplineReport.js`

**Location:** Search bar section (around line 540)

**Find:**
```javascript
<div className="flex gap-3">
  <div className="relative flex-1">
    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
    <input
      type="text"
      placeholder="Search members..."
      value={searchQuery}
      onChange={(e) => setSearchQuery(e.target.value)}
      className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
    />
  </div>
  
  {/* Discipline Filter Dropdown */}
  <div ref={filterRef} className="relative">
    {/* ... existing filter code ... */}
  </div>
</div>
```

**Add After Filter Dropdown:**
```javascript
  {/* NEW: Sort Button */}
  <button
    onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
    className="p-3 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
    title={sortOrder === 'desc' ? 'Highest First' : 'Lowest First'}
  >
    {sortOrder === 'desc' ? (
      <ArrowDown className="h-5 w-5" />
    ) : (
      <ArrowUp className="h-5 w-5" />
    )}
  </button>
</div>
```

---

## STEP 14: Add Team Filter Pills to UI (Frontend)

### File: `frontend/src/components/DisciplineReport.js`

**Location:** After search bar, before member list (around line 580)

**Add:**
```javascript
{/* NEW: Team Filter Pills */}
{teamData?.coachFilters && teamData.coachFilters.length > 0 && (
  <TeamFilterPills
    filters={teamData.coachFilters}
    activeFilter={teamFilter}
    onChange={setTeamFilter}
  />
)}
```

---

## STEP 15: Update Member Card with Coach Badge (Frontend)

### File: `frontend/src/components/DisciplineReport.js`

**Location:** Inside member card rendering (around line 600)

**Find the section after email:**
```javascript
<p className="text-xs text-gray-500">{member.email}</p>
```

**Add After It:**
```javascript
{/* NEW: Coach Badge - Shows direct coach */}
<div className="flex items-center gap-1 mt-1">
  <div className="w-3 h-3 rounded-full bg-blue-500 flex items-center justify-center">
    <span className="text-[8px] text-white">📌</span>
  </div>
  <p className="text-xs text-blue-600 font-medium">
    Coach: {member.uplineCoachName}
    {member.uplineCoachId === user.id ? ' (You)' : ''}
  </p>
</div>
```

---

## STEP 16: Add Coach Performance Card to Render (Frontend)

### File: `frontend/src/components/DisciplineReport.js`

**Location:** Main render, after header, before summary stats (around line 500)

**Add:**
```javascript
<div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
  {/* NEW: Coach's Own Performance Card */}
  {teamData?.coachPerformance && (
    <CoachPerformanceCard coach={teamData.coachPerformance} />
  )}
  
  {/* Summary Stats - existing code */}
  {/* ... */}
</div>
```

---

## STEP 17: Update Member List Rendering (Frontend)

### File: `frontend/src/components/DisciplineReport.js`

**Location:** Member list section (around line 600)

**Replace:**
```javascript
{filteredMembers.length > 0 ? (
  filteredMembers.map(member => (
```

**With:**
```javascript
{filteredAndSortedMembers.length > 0 ? (
  filteredAndSortedMembers.map(member => (
```

---

## STEP 18: Test Backend API

### Test Commands:

**1. Test Recursive Query Directly in MySQL:**
```sql
-- Replace 1 with actual coach UserId
SET @coachId = 1;

WITH RECURSIVE team_hierarchy AS (
  SELECT UserId, UserName, Email, Role, UplineCoachId, 0 as HierarchyLevel, TRUE as IsLoggedInCoach
  FROM team_table
  WHERE UserId = @coachId AND Status = 'active'
  
  UNION ALL
  
  SELECT t.UserId, t.UserName, t.Email, t.Role, t.UplineCoachId, 1 as HierarchyLevel, FALSE
  FROM team_table t
  WHERE t.UplineCoachId = @coachId AND t.Status = 'active'
  
  UNION ALL
  
  SELECT t.UserId, t.UserName, t.Email, t.Role, t.UplineCoachId, th.HierarchyLevel + 1, FALSE
  FROM team_table t
  INNER JOIN team_hierarchy th ON t.UplineCoachId = th.UserId
  WHERE t.Status = 'active' AND th.HierarchyLevel < 10 AND th.HierarchyLevel > 0
)
SELECT 
  th.UserId,
  th.UserName,
  th.Email,
  th.Role,
  th.UplineCoachId,
  COALESCE(coach.UserName, NULL) as UplineCoachName,
  th.HierarchyLevel,
  th.IsLoggedInCoach
FROM team_hierarchy th
LEFT JOIN team_table coach ON th.UplineCoachId = coach.UserId
ORDER BY th.HierarchyLevel, th.UserName;
```

**Expected Results:**
- First row: Coach (HierarchyLevel = 0)
- Following rows: All nested team members
- UplineCoachName populated for all non-root members

**2. Test API Endpoint:**
```bash
curl "http://localhost:3000/api/coach/discipline-report?coachId=1&dateRange=today"
```

**Expected Response Structure:**
```json
{
  "success": true,
  "coachPerformance": { ... },
  "teamMembers": [ ... ],
  "coachFilters": [ ... ],
  "teamSummary": { ... }
}
```

---

## STEP 19: Test Frontend Components

### Test Checklist:

- [ ] Coach performance card displays at top
- [ ] Coach performance shows correct activities breakdown
- [ ] "YOU" badge appears on coach card
- [ ] Summary stats show correct totals
- [ ] Team filter pills appear with correct counts
- [ ] "All Teams" filter shows all members
- [ ] "My Team" filter shows only direct members
- [ ] Coach-specific filters work correctly
- [ ] Sort button toggles between ↓ and ↑
- [ ] Members sort by score correctly
- [ ] Coach badge appears on each member card
- [ ] "(You)" appears when coach is logged-in user
- [ ] Search filters members correctly
- [ ] Discipline filter (high/medium/low) works
- [ ] Expand/collapse details works
- [ ] Mobile responsive layout

---

## STEP 20: Final Testing Scenarios

### Test Scenario 1: Coach A (Has 8 members)
1. Login as Coach A
2. Navigate to Discipline Report
3. Verify:
   - Coach A's performance card at top
   - 8 team members listed (not including Coach A)
   - 3 team filters: My Team, Coach B's Team, Coach C's Team
   - Default sort: Highest scores first
   - Coach badges show correct names

### Test Scenario 2: Coach B (Has 6 members)
1. Login as Coach B
2. Navigate to Discipline Report
3. Verify:
   - Coach B's performance card at top
   - 6 team members listed (4 direct + 2 from Coach C)
   - 2 team filters: My Team, Coach C's Team
   - Coach A NOT visible (only downline)

### Test Scenario 3: Filters and Sorting
1. Click "My Team" filter
2. Verify: Only direct members shown
3. Click sort button (change to ascending)
4. Verify: Lowest scores appear first
5. Type in search box
6. Verify: Results filtered by name/email
7. Select "High" discipline filter
8. Verify: Only >80% scores shown

---

## 🎉 Completion Checklist

- [ ] Backend recursive query working
- [ ] Coach separated from team members
- [ ] Coach filters generated correctly
- [ ] API response structure correct
- [ ] Coach performance card displays
- [ ] Team filter pills working
- [ ] Sort functionality working
- [ ] Coach badges on all members
- [ ] "(You)" indicator showing correctly
- [ ] All filters working together
- [ ] Mobile responsive
- [ ] Performance acceptable (<2s load)
- [ ] No console errors
- [ ] Git committed with message from previous conversation

---

## 🐛 Troubleshooting

### Issue: Recursive query returns empty
**Solution:** Check MySQL version (needs 8.0+). Run `SELECT VERSION();`

### Issue: Coach appears in team member list
**Solution:** Verify `IsLoggedInCoach` filter in frontend: `teamMembers.filter(m => !m.IsLoggedInCoach)`

### Issue: Coach filters not showing
**Solution:** Check if sub-coaches have `Role = 'coach'` in database

### Issue: Sort not working
**Solution:** Verify `filteredAndSortedMembers` is used instead of `filteredMembers`

### Issue: Coach badge shows "undefined"
**Solution:** Check `UplineCoachName` is populated in SQL query LEFT JOIN

---

## 📝 Git Commit Message

```
feat(discipline-report): Phase 5 - Hierarchical report with flat list UI

Backend:
- Add recursive CTE query to fetch all nested team members
- Include logged-in coach in results (HierarchyLevel = 0)
- Separate coach performance from team members
- Generate coach filter options dynamically
- Add UplineCoachName to member data for badges

Frontend:
- Add coach performance card at top with gradient styling
- Add team filter pills (All Teams, My Team, Coach X's Team)
- Add sort button (highest→lowest, vice versa)
- Add coach badge on each member card
- Add "(You)" indicator for logged-in coach
- Implement client-side filtering and sorting
- Update to flat list (no grouping/collapsing)

Tested with multiple hierarchy levels (Coach A → Coach B → Coach C)
```

---

**Implementation Complete! 🎊**
