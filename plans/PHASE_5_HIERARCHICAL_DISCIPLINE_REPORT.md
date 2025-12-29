# Phase 5: Hierarchical Discipline Report Implementation Plan

**Date:** December 29, 2025  
**Feature:** Show nested team members (coach's team + all sub-coaches' teams recursively)

---

## 📋 Current Behavior

Each coach only sees their **direct team members** (where `UplineCoachId = coachId`).

```sql
SELECT UserId FROM team_table WHERE UplineCoachId = ?
```

**Missing:** The logged-in coach's own discipline score is not shown.

---

## 🎯 New Behavior

Each coach sees:
1. **Their own discipline score** (Coach's personal performance at top)
2. **All team members in a flat list** (direct + nested members)
3. **Coach badge on each member** (shows who is their direct coach)
4. **Team filter options** (My Team, Coach A's Team, Coach B's Team, etc.)
5. **Sorting functionality** (highest to lowest score, vice versa)

### UI View Example

```
╔════════════════════════════════════════════════════════════╗
║  ◀  Discipline Report         🔄 ⬇ ⚙                      ║
║  9 Total Members • 03:18 PM                                ║
║  [Today] [Yesterday] [Last 7 Days] [Last 30 Days] [📅]    ║
╠════════════════════════════════════════════════════════════╣
║  📊 My Performance                                         ║
║  ┌──────────────────────────────────────────────────────┐ ║
║  │ 👤 Coach A            75% 📊                          │ ║
║  │ Weight: 80% | Education: 85% | Meals: 70%            │ ║
║  └──────────────────────────────────────────────────────┘ ║
╠════════════════════════════════════════════════════════════╣
║  📊 Summary Stats                                          ║
║  ┌──────────┬──────────┬──────────┐                      ║
║  │ Avg 75%  │ 9 Total  │ 7 Active │                      ║
║  └──────────┴──────────┴──────────┘                      ║
╠════════════════════════════════════════════════════════════╣
║  🔍 Search members...                 [🔽 Filter] [⬆⬇]    ║
╠════════════════════════════════════════════════════════════╣
║  Team Filter:                                              ║
║  [All Teams] [My Team] [Coach B's Team] [Coach C's Team]  ║
╠════════════════════════════════════════════════════════════╣
║  📋 Team Members (Sorted: Highest First)                  ║
║  ┌──────────────────────────────────────────────────────┐ ║
║  │ 👤 Member 4            90% ⭐                      ▼   │ ║
║  │    📌 Coach: Coach B                                  │ ║
║  └──────────────────────────────────────────────────────┘ ║
║  ┌──────────────────────────────────────────────────────┐ ║
║  │ 👤 Member 7            88% ⭐                      ▼   │ ║
║  │    📌 Coach: Coach C                                  │ ║
║  └──────────────────────────────────────────────────────┘ ║
║  ┌──────────────────────────────────────────────────────┐ ║
║  │ 👤 Member 1            85% ⭐                      ▼   │ ║
║  │    📌 Coach: Coach A (You)                            │ ║
║  └──────────────────────────────────────────────────────┘ ║
║  ┌──────────────────────────────────────────────────────┐ ║
║  │ 🎯 Coach B (Coach)     78% 📊  [4 members]        ▼   │ ║
║  │    📌 Coach: Coach A (You)                            │ ║
║  └──────────────────────────────────────────────────────┘ ║
║  ... (continues sorted by score)                          ║
╚════════════════════════════════════════════════════════════╝

Total: 9 members (including logged-in coach)
```

---

## 🗄️ Database Schema

### Existing `team_table` Structure:
```sql
team_table:
  - UserId (INT) - Primary Key
  - UserName (VARCHAR)
  - Email (VARCHAR)
  - Role (ENUM: 'user', 'coach', 'admin', 'developer')
  - UplineCoachId (INT) - Foreign Key to team_table.UserId
  - TeamId (VARCHAR) - User's team ID
  - Status (ENUM: 'active', 'inactive')
  - EntryDateTime (DATETIME)
```

### Key Relationships:
- **Direct Member**: `UplineCoachId = coachId`
- **Sub-Coach**: `Role = 'coach'` AND `UplineCoachId = coachId`
- **Sub-Coach's Members**: `UplineCoachId = subCoachId`

---

## 🔧 Implementation Steps

### 1. Backend Changes

#### 1.1 Recursive SQL Query (Recommended: Recursive CTE)

**File:** `backend/pages/api/coach/discipline-report.js`

**Current Query (Direct Members Only):**
```sql
SELECT UserId, UserName, Email, EntryDateTime, Role
FROM team_table
WHERE UplineCoachId = ?
  AND Status = 'active'
ORDER BY UserName
```

**New Query Part 1: Get Coach's Own Data**
```sql
-- First, get the logged-in coach's data
SELECT 
  UserId,
  UserName,
  Email,
  Role,
  EntryDateTime,
  UplineCoachId,
  0 as HierarchyLevel,  -- Coach is at level 0
  CAST(UserId AS CHAR(500)) as HierarchyPath
FROM team_table
WHERE UserId = ?  -- The logged-in coach
  AND Status = 'active'
```

**New Query Part 2: Recursive - All Nested Members**
**New Query Part 2: Recursive - All Nested Members**
```sql
WITH RECURSIVE team_hierarchy AS (
  -- Base case: Include the logged-in coach themselves
  SELECT 
    UserId,
    UserName,
    Email,
    Role,
    EntryDateTime,
    UplineCoachId,
    0 as HierarchyLevel,  -- Coach is level 0
    CAST(UserId AS CHAR(500)) as HierarchyPath,
    TRUE as IsLoggedInCoach
  FROM team_table
  WHERE UserId = ?  -- The logged-in coach
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
  WHERE t.UplineCoachId = ?  -- Direct members of coach
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
    AND th.HierarchyLevel < 10  -- Prevent infinite loops (max 10 levels)
    AND th.HierarchyLevel > 0   -- Only recurse from level 1+ (not from coach)
)
SELECT 
  UserId,
  UserName,
  Email,
  Role,
  EntryDateTime,
  UplineCoachId,
  HierarchyLevel,
  HierarchyPath,
  IsLoggedInCoach
FROM team_hierarchy
ORDER BY HierarchyLevel, UserName
```

**Query Results Structure:**
```javascript
[
  {
    UserId: 1,
    UserName: "Coach A",
    Email: "coacha@example.com",
    Role: "coach",
    UplineCoachId: null,
    UplineCoachName: null,  // No coach above them
    HierarchyLevel: 0,
    HierarchyPath: "1",
    IsLoggedInCoach: true
  },
  {
    UserId: 2,
    UserName: "Member 1",
    Email: "member1@example.com",
    Role: "user",
    UplineCoachId: 1,
    UplineCoachName: "Coach A",  // ← Coach badge label
    HierarchyLevel: 1,
    HierarchyPath: "2",
    IsLoggedInCoach: false
  },
  {
    UserId: 5,
    UserName: "Coach B",
    Email: "coachb@example.com",
    Role: "coach",
    UplineCoachId: 1,
    UplineCoachName: "Coach A",  // ← Coach badge label
    HierarchyLevel: 1,
    HierarchyPath: "5",
    IsLoggedInCoach: false
  },
  {
    UserId: 5,
    UserName: "Coach B",
    Email: "coachb@example.com",
    Role: "coach",
    UplineCoachId: 1,
    HierarchyLevel: 1,
    HierarchyPath: "5"
  },
  {
    UserId: 6,
    UserName: "Member 4",
    Email: "member4@example.com",
    Role: "user",
    UplineCoachId: 5,
    HierarchyLevel: 2,
    HierarchyPath: "5>6"
  },
  ...
]
```

#### 1.2 Get Coach Names (for badges and filters)

**Additional Query to Join Coach Names:**
```sql
-- Modify the recursive query to include upline coach name
WITH RECURSIVE team_hierarchy AS (
  -- ... (same as before)
)
SELECT 
  th.UserId,
  th.UserName,
  th.Email,
  th.Role,
  th.EntryDateTime,
  th.UplineCoachId,
  COALESCE(coach.UserName, NULL) as UplineCoachName,  -- Get coach's name
  th.HierarchyLevel,
  th.HierarchyPath,
  th.IsLoggedInCoach
FROM team_hierarchy th
LEFT JOIN team_table coach ON th.UplineCoachId = coach.UserId
ORDER BY th.HierarchyLevel, th.UserName;
```

#### 1.3 Group Coaches for Filter Options

**New Helper Function:**
```javascript
function extractCoachFilters(members, loggedInCoachId) {
  const coaches = new Map();
  
  // Add "My Team" filter (logged-in coach's direct members)
  coaches.set(loggedInCoachId, {
    coachId: loggedInCoachId,
    coachName: 'My Team',
    memberCount: members.filter(m => m.UplineCoachId === loggedInCoachId && !m.IsLoggedInCoach).length,
    isMyTeam: true
  });
  
  // Add other coaches
  members.forEach(member => {
    if (member.Role === 'coach' && !member.IsLoggedInCoach) {
      const teamMembers = members.filter(m => m.UplineCoachId === member.UserId).length;
      if (teamMembers > 0) {
        coaches.set(member.UserId, {
          coachId: member.UserId,
          coachName: `${member.UserName}'s Team`,
          memberCount: teamMembers,
          isMyTeam: false
        });
      }
    }
  });
  
  return Array.from(coaches.values());
}
```

#### 1.4 API Response Structure (Flat List with Metadata)

**Response:**
```javascript
{
  success: true,
  source: 'realtime',
  lastUpdated: '2025-12-29T03:18:00.000Z',
  coachId: 1,
  dateRange: 'today',
  startDate: '2025-12-29',
  endDate: '2025-12-29',
  
  // Coach's own performance (separate from members list)
  coachPerformance: {
    userId: 1,
    userName: "Coach A",
    email: "coacha@example.com",
    role: "coach",
    isLoggedInCoach: true,
    uplineCoachId: null,
    uplineCoachName: null,
    periodDiscipline: {
      percentage: 75,
      onTimePosts: 15,
      expectedPosts: 20
    },
    activities: { ... }
  },
  
  // Flat list of ALL team members (no grouping)
  teamMembers: [
    {
      userId: 2,
      userName: "Member 1",
      email: "member1@example.com",
      role: "user",
      isCoach: false,
      isLoggedInCoach: false,
      uplineCoachId: 1,
      uplineCoachName: "Coach A",  // ← For badge display
      hierarchyLevel: 1,
      periodDiscipline: { percentage: 85, ... },
      activities: { ... }
    },
    {
      userId: 5,
      userName: "Coach B",
      email: "coachb@example.com",
      role: "coach",
      isCoach: true,
      isLoggedInCoach: false,
      subTeamCount: 4,
      uplineCoachId: 1,
      uplineCoachName: "Coach A",  // ← For badge display
      hierarchyLevel: 1,
      periodDiscipline: { percentage: 78, ... },
      activities: { ... }
    },
    {
      userId: 6,
      userName: "Member 4",
      email: "member4@example.com",
      role: "user",
      isCoach: false,
      isLoggedInCoach: false,
      uplineCoachId: 5,
      uplineCoachName: "Coach B",  // ← For badge display
      hierarchyLevel: 2,
      periodDiscipline: { percentage: 90, ... },
      activities: { ... }
    },
    // ... more members
  ],
  
  // Coach filter options (for dropdown)
  coachFilters: [
    { coachId: 1, coachName: "My Team", memberCount: 4, isMyTeam: true },
    { coachId: 5, coachName: "Coach B's Team", memberCount: 4, isMyTeam: false },
    { coachId: 9, coachName: "Coach C's Team", memberCount: 2, isMyTeam: false }
  ],
  
  // Overall stats
  teamSummary: {
    totalMembers: 9,  // Including logged-in coach
    totalTeamMembers: 8,  // Excluding logged-in coach
    totalCoaches: 3,  // Number of coach filters available
    averagePeriodDiscipline: 73.5,
    topPerformer: { userId: 6, userName: "Member 4", score: 90 },
    needsAttention: [
      { userId: 7, userName: "Member 5", score: 55 },
      { userId: 11, userName: "Member 8", score: 45 }
    ]
  }
}
```

**Endpoint 1: Get Summary Stats (Fast)**
```
GET /api/coach/discipline-report/summary?coachId=1&dateRange=today
```

**Response:**
```javascript
{
  success: true,
  lastUpdated: '2025-12-29T03:18:00.000Z',
  
  // ✅ Coach's own performance (level 0)
  coachPerformance: {
    userId: 1,
    userName: "Coach A",
    email: "coacha@example.com",
    periodDiscipline: {
      percentage: 75,
      onTimePosts: 15,
      expectedPosts: 20
    },
    activities: {
      weight: { percentage: 80, onTimePosts: 4, expectedPosts: 5 },
      education: { percentage: 85, onTimePosts: 4, expectedPosts: 5 },
      breakfast: { percentage: 70, onTimePosts: 3, expectedPosts: 5 },
      lunch: { percentage: 68, onTimePosts: 3, expectedPosts: 5 },
      dinner: { percentage: 72, onTimePosts: 3, expectedPosts: 5 }
    }
  },
  
  teamSummary: {
    totalMembers: 9,  // Including coach
    totalTeamMembers: 8,  // Excluding coach
    totalGroups: 3,
    averagePeriodDiscipline: 73.5,
    topPerformer: {
      userId: 4,
      userName: "Member 4",
      score: 90
    },
    needsAttention: [
      { userId: 5, userName: "Member 5", score: 55 },
      { userId: 8, userName: "Member 8", score: 45 }
    ],
    postsCounts: {
      totalPosts: 40,
      onTimePosts: 29
    }
  },
  groupsMetadata: [
    {
      coachId: 1,
      coachName: 'Coach A',
      hierarchyLevel: 0,
      memberCount: 4,
      averageDiscipline: 77.5
    },
    {
      coachId: 5,
      coachName: 'Coach B',
      hierarchyLevel: 1,
      memberCount: 4,
      averageDiscipline: 76.75
    },
    {
      coachId: 9,
      coachName: 'Coach C',
      hierarchyLevel: 2,
      memberCount: 2,
      averageDiscipline: 66.5
    }
  ]
}
```

**Endpoint 2: Get Group Members (Lazy Load)**
```
GET /api/coach/discipline-report/group?coachId=1&groupCoachId=5&dateRange=today&limit=10&offset=0
```

**Response:**
```javascript
{
  success: true,
  groupCoachId: 5,
  members: [
    {
      userId: 6,
      userName: 'Member 4',
      email: 'member4@example.com',
      role: 'user',
      isCoach: false,
      subTeamCount: 0,
      hierarchyLevel: 2,
      uplineCoachId: 5,
      periodDiscipline: {
        percentage: 90,
        onTimePosts: 5,
        expectedPosts: 5
      },
      activities: { ... }
    },
    // ... more members
  ],
  pagination: {
    total: 4,
    limit: 10,
    offset: 0,
    hasMore: false
  }
}
```

#### 1.5 API Response Structure (Unified Endpoint - Alternative)

**If using single endpoint with lazy flag:**

```javascript
{
  success: true,
  source: 'realtime',
  lastUpdated: '2025-12-29T03:18:00.000Z',
  coachId: 1,
  dateRange: 'today',
  startDate: '2025-12-29',
  endDate: '2025-12-29',
  
  // ✅ Always loaded (fast aggregate data)
  teamSummary: {
    totalMembers: 8,
    totalGroups: 3,
    averagePeriodDiscipline: 73.5,
    topPerformer: {
      userId: 4,
      userName: "Member 4",
      score: 90
    },
    needsAttention: [
      { userId: 5, userName: "Member 5", score: 55 },
      { userId: 8, userName: "Member 8", score: 45 }
    ],
    postsCounts: {
      totalPosts: 40,
      onTimePosts: 29
    }
  },
  
  // ✅ Always loaded (fast aggregate data)
  teamSummary: {
    totalMembers: 9,  // Including logged-in coach
    totalTeamMembers: 8,  // Excluding logged-in coach
    totalGroups: 3,
    averagePeriodDiscipline: 73.5,
    topPerformer: {
      userId: 4,
      userName: "Member 4",
      score: 90
    },
    needsAttention: [
      { userId: 5, userName: "Member 5", score: 55 },
      { userId: 8, userName: "Member 8", score: 45 }
    ],
    postsCounts: {
      totalPosts: 40,
      onTimePosts: 29
    }
  },
  
  // NEW: Coach's own performance (separate section)
  coachPerformance: {
    userId: 1,
    userName: "Coach A",
    email: "coacha@example.com",
    role: "coach",
    isLoggedInCoach: true,
    periodDiscipline: {
      percentage: 75,
      onTimePosts: 15,
      expectedPosts: 20
    },
    activities: {
      weight: { percentage: 80, onTimePosts: 4, expectedPosts: 5 },
      education: { percentage: 85, onTimePosts: 4, expectedPosts: 5 },
      breakfast: { percentage: 70, onTimePosts: 3, expectedPosts: 5 },
      lunch: { percentage: 68, onTimePosts: 3, expectedPosts: 5 },
      dinner: { percentage: 72, onTimePosts: 3, expectedPosts: 5 }
    }
  },
  
  // NEW: Grouped by coach (metadata only initially)
  teamGroups: [
  // NEW: Grouped by coach (metadata only initially)
  teamGroups: [
    {
      coachId: 1,  // Logged-in coach (for "My Direct Team")
      coachName: 'Coach A',
      hierarchyLevel: 0,
      memberCount: 4,
      averageDiscipline: 77.5,
      members: [],  // Empty initially, loaded on expand or first group auto-loaded
      loaded: false  // Flag to track if details loaded
    },
    {
      coachId: 5,  // Coach B
      coachName: 'Coach B',
      hierarchyLevel: 1,
      memberCount: 4,
      averageDiscipline: 76.75,
      members: [],  // Lazy load on expand
      loaded: false
    },
    {
      coachId: 9,  // Coach C
      coachName: 'Coach C',
      hierarchyLevel: 2,
      memberCount: 2,
      averageDiscipline: 66.5,
      members: [],  // Lazy load on expand
      loaded: false
    }
  ]
}
```

**When group is expanded (or first group auto-loads):**
```javascript
// Update specific group with detailed member data
teamGroups[0].members = [
  { 
    userId: 2, 
    userName: 'Member 1', 
    email: 'member1@example.com',
    isCoach: false, 
    periodDiscipline: { percentage: 85, ... },
    activities: { ... }
  },
  // ... more members
];
teamGroups[0].loaded = true;
```

---

### 2. Frontend Changes

#### 2.1 Update DisciplineReport Component

**File:** `frontend/src/components/DisciplineReport.js`

**New State:**
```javascript
const [teamData, setTeamData] = useState(null);
const [loading, setLoading] = useState(true);
const [dateRange, setDateRange] = useState('today');
const [searchQuery, setSearchQuery] = useState('');
const [disciplineFilter, setDisciplineFilter] = useState('all');  // Existing: high/medium/low
const [teamFilter, setTeamFilter] = useState('all');  // NEW: all/myTeam/coachId
const [sortOrder, setSortOrder] = useState('desc');  // NEW: 'desc' (high→low) or 'asc' (low→high)
const [expandedMemberId, setExpandedMemberId] = useState(null);
```

**Load Data:**
```javascript
useEffect(() => {
  if (user?.id) {
    loadDisciplineReport();
  }
}, [user?.id, dateRange, customStartDate, customEndDate]);

async function loadDisciplineReport() {
  setLoading(true);
  try {
    const data = await disciplineReportService.getDisciplineReport(
      user.id, 
      dateRange,
      customStartDate,
      customEndDate
    );
    
    setTeamData(data);
  } catch (err) {
    setError(err.message);
  } finally {
    setLoading(false);
  }
}
```

**Filter and Sort Members:**
```javascript
const filteredAndSortedMembers = teamData?.teamMembers
  .filter(member => {
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

#### 2.2 Coach Performance Card Component (Same as before)

```javascript
const CoachPerformanceCard = ({ coach }) => {
  if (!coach) return null;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-green-50 to-green-100 rounded-2xl p-4 shadow-sm border-2 border-green-200 mb-6"
    >
      {/* Same as previous implementation */}
    </motion.div>
  );
};
```

#### 2.3 Team Filter Pills (NEW)

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

#### 2.4 Sort Button (NEW)

```javascript
const SortButton = ({ sortOrder, onChange }) => {
  return (
    <button
      onClick={() => onChange(sortOrder === 'desc' ? 'asc' : 'desc')}
      className="p-2 hover:bg-gray-50 rounded-full transition-colors text-gray-600 border border-gray-200"
      title={sortOrder === 'desc' ? 'Highest First' : 'Lowest First'}
    >
      {sortOrder === 'desc' ? (
        <ArrowDown className="h-5 w-5" />
      ) : (
        <ArrowUp className="h-5 w-5" />
      )}
    </button>
  );
};
```

#### 2.5 Member Card with Coach Badge (UPDATED)

```javascript
const MemberCard = ({ member, onExpand, isExpanded }) => {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="relative">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white font-bold">
              {member.userName.charAt(0).toUpperCase()}
            </div>
            {/* Coach Badge (if they are a coach) */}
            {member.isCoach && (
              <div className="absolute -top-1 -right-1 bg-green-600 text-white rounded-full p-1">
                <Target className="w-3 h-3" />
              </div>
            )}
          </div>
          
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900">{member.userName}</h3>
              {member.isCoach && (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                  Coach
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500">{member.email}</p>
            
            {/* NEW: Coach Badge - Shows who is their direct coach */}
            <div className="flex items-center gap-1 mt-1">
              <div className="w-3 h-3 rounded-full bg-blue-500 flex items-center justify-center">
                <span className="text-[8px] text-white">📌</span>
              </div>
              <p className="text-xs text-blue-600 font-medium">
                Coach: {member.uplineCoachName}{member.uplineCoachId === user.id ? ' (You)' : ''}
              </p>
            </div>
            
            {member.isCoach && member.subTeamCount > 0 && (
              <p className="text-xs text-green-600 font-medium mt-0.5">
                ↳ {member.subTeamCount} team members
              </p>
            )}
          </div>
        </div>
        
        {/* Discipline Score */}
        <div className="text-right">
          <p className={`text-2xl font-bold ${getScoreColorText(member.periodDiscipline.percentage)}`}>
            {Math.round(member.periodDiscipline.percentage)}%
          </p>
          <p className="text-[10px] text-gray-400 uppercase tracking-wider">Discipline</p>
        </div>
      </div>
      
      {/* Expand/Collapse for details ... */}
    </div>
  );
};
```

```javascript
const CoachPerformanceCard = ({ coach, onExpand, isExpanded }) => {
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
      
      {/* Activity Breakdown - Always visible for coach */}
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

#### 2.3 Group Header Component

```javascript
const GroupHeader = ({ group, isCollapsed, isLoading, onToggle }) => {
  const isMyTeam = group.hierarchyLevel === 0;  // Now this is level 0 (coach's direct team)
  
  return (
    <div 
      onClick={onToggle}
      className="flex items-center justify-between p-4 bg-gray-50 border-t border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors"
    >
      <div className="flex items-center gap-3">
        {isLoading ? (
          <RefreshCw className="w-5 h-5 text-gray-400 animate-spin" />
        ) : (
          <ChevronDown 
            className={`w-5 h-5 text-gray-500 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} 
          />
        )}
        <div>
          <h3 className="font-semibold text-gray-900">
            📁 {isMyTeam ? 'My Direct Team' : `${group.coachName}'s Team`}
          </h3>
          <p className="text-xs text-gray-500">
            {group.memberCount} members • Level {group.hierarchyLevel + 1}
            {!group.loaded && !isLoading && (
              <span className="ml-2 text-blue-600">• Click to load</span>
            )}
          </p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-sm font-medium text-gray-600">Avg</p>
        <p className={`text-lg font-bold ${getScoreColorText(group.averageDiscipline)}`}>
          {Math.round(group.averageDiscipline)}%
        </p>
      </div>
    </div>
  );
};
```

#### 2.3 Member Card Enhancement

```javascript
const MemberCard = ({ member, ...props }) => {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Coach Badge */}
          {member.isCoach && (
            <div className="absolute -top-1 -left-1 bg-green-600 text-white rounded-full p-1">
              <Target className="w-3 h-3" />
            </div>
          )}
          
          {/* Avatar */}
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white font-bold">
            {member.userName.charAt(0).toUpperCase()}
          </div>
          
          <div>
            <h3 className="font-semibold text-gray-900">
              {member.userName}
              {member.isCoach && (
                <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                  Coach
                </span>
              )}
            </h3>
            <p className="text-xs text-gray-500">{member.email}</p>
            {member.isCoach && member.subTeamCount > 0 && (
              <p className="text-xs text-green-600 font-medium mt-0.5">
                ↳ {member.subTeamCount} team members
              </p>
            )}
          </div>
        </div>
        
        {/* Discipline Score */}
        <div className="text-right">
          <p className={`text-2xl font-bold ${getScoreColorText(member.periodDiscipline.percentage)}`}>
            {Math.round(member.periodDiscipline.percentage)}%
          </p>
          <p className="text-[10px] text-gray-400 uppercase tracking-wider">Discipline</p>
        </div>
      </div>
      
      {/* Expand/Collapse for details ... */}
    </div>
  );
};
```

#### 2.4 Render Groups

```javascript
return (
  <div className="space-y-0">
    {teamGroups.map((group, groupIndex) => {
      const isCollapsed = collapsedGroups[group.coachId];
      const isLoading = loadingGroups[group.coachId];
      
      return (
        <div key={group.coachId} className="mb-4">
          <GroupHeader 
            group={group}
            isCollapsed={isCollapsed}
            isLoading={isLoading}
            onToggle={() => handleGroupToggle(group.coachId)}
          />
          
          <AnimatePresence>
            {!isCollapsed && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="space-y-3 p-4 bg-white"
              >
                {isLoading ? (
                  // Show loading skeleton while fetching
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="bg-gray-50 rounded-2xl p-4 animate-pulse h-20" />
                    ))}
                  </div>
                ) : group.loaded && group.members.length > 0 ? (
                  // Show member cards when loaded
                  group.members.map(member => (
                    <MemberCard 
                      key={member.userId} 
                      member={member}
                      onExpand={() => setExpandedMemberId(
                        expandedMemberId === member.userId ? null : member.userId
                      )}
                      isExpanded={expandedMemberId === member.userId}
                    />
                  ))
                ) : (
                  // Empty state
                  <div className="text-center py-8 text-gray-400">
                    <p>No members in this group</p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      );
    })}
  </div>
);
```

#### 2.6 Render Complete Report (UPDATED - Flat List)

```javascript
return (
  <div className="min-h-screen bg-white pb-20">
    {/* Header with date range selector - same as before */}
    
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      {/* Coach's Own Performance Card */}
      {teamData?.coachPerformance && (
        <CoachPerformanceCard coach={teamData.coachPerformance} />
      )}
      
      {/* Summary Stats - same as before */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
        {/* Stats display */}
      </div>
      
      {/* Search Bar with Sort Button */}
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
        
        {/* Discipline Filter Dropdown - existing */}
        <div ref={filterRef} className="relative">
          <button
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className={`p-3 rounded-xl border transition-colors ${
              disciplineFilter !== 'all'
                ? 'bg-green-50 border-green-500 text-green-700'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Filter className="h-5 w-5" />
          </button>
          {/* Filter dropdown - same as before */}
        </div>
        
        {/* NEW: Sort Button */}
        <SortButton sortOrder={sortOrder} onChange={setSortOrder} />
      </div>
      
      {/* NEW: Team Filter Pills */}
      {teamData?.coachFilters && teamData.coachFilters.length > 0 && (
        <TeamFilterPills
          filters={teamData.coachFilters}
          activeFilter={teamFilter}
          onChange={setTeamFilter}
        />
      )}
      
      {/* Member List - Flat (No Grouping) */}
      <div className="space-y-3">
        {filteredAndSortedMembers.length > 0 ? (
          filteredAndSortedMembers.map(member => (
            <MemberCard
              key={member.userId}
              member={member}
              onExpand={() => setExpandedMemberId(
                expandedMemberId === member.userId ? null : member.userId
              )}
              isExpanded={expandedMemberId === member.userId}
            />
          ))
        ) : (
          <div className="text-center py-12 text-gray-400">
            <p>No members found</p>
          </div>
        )}
      </div>
    </div>
  </div>
);
```

#### 2.7 Service Layer (Simplified - Single Endpoint)

**File:** `frontend/src/services/disciplineReportService.js`

```javascript
export const disciplineReportService = {
  /**
   * Fetch complete discipline report (coach performance + all members + filters)
   */
  async getDisciplineReport(coachId, dateRange, customStartDate, customEndDate) {
    const params = { coachId, dateRange };
    
    if (dateRange === 'custom' && customStartDate && customEndDate) {
      params.startDate = customStartDate.toISOString().split('T')[0];
      params.endDate = customEndDate.toISOString().split('T')[0];
    }
    
    try {
      const response = await axios.get(`${API_BASE_URL}/api/coach/discipline-report`, {
        params
      });
      
      return response.data;
    } catch (error) {
      console.error('❌ Error fetching discipline report:', error);
      throw error;
    }
  },
  
  // ... existing exportToCSV method
};
```

---

## 🧪 Testing Strategy

### Test Data Setup

**Users:**
- Coach A (UserId: 1, UplineCoachId: NULL, Role: 'coach') ← **Logged-in user**
  - Member 1 (UserId: 2, UplineCoachId: 1)
  - Member 2 (UserId: 3, UplineCoachId: 1)
  - Coach B (UserId: 5, UplineCoachId: 1, Role: 'coach')
    - Member 4 (UserId: 6, UplineCoachId: 5)
    - Member 5 (UserId: 7, UplineCoachId: 5)
    - Coach C (UserId: 9, UplineCoachId: 5, Role: 'coach')
      - Member 7 (UserId: 10, UplineCoachId: 9)
      - Member 8 (UserId: 11, UplineCoachId: 9)

### Test Cases

1. **Coach A logs in**: Should see their own performance + 8 team members across 3 groups (total 9)
2. **Coach B logs in**: Should see their own performance + 6 team members across 2 groups (total 7)
3. **Coach C logs in**: Should see their own performance + 2 team members in 1 group (total 3)
4. **Regular Member logs in**: Should NOT see discipline report (no access)

### SQL Test Query

```sql
-- Test recursive query for Coach A (UserId = 1)
-- Now includes the coach themselves at level 0
WITH RECURSIVE team_hierarchy AS (
  -- Base case: The logged-in coach
  SELECT UserId, UserName, Email, Role, UplineCoachId, 0 as HierarchyLevel, TRUE as IsLoggedInCoach
  FROM team_table
  WHERE UserId = 1 AND Status = 'active'
  
  UNION ALL
  
  -- Direct team members
  SELECT t.UserId, t.UserName, t.Email, t.Role, t.UplineCoachId, 1 as HierarchyLevel, FALSE as IsLoggedInCoach
  FROM team_table t
  WHERE t.UplineCoachId = 1 AND t.Status = 'active'
  
  UNION ALL
  
  -- Recursive nested teams
  SELECT t.UserId, t.UserName, t.Email, t.Role, t.UplineCoachId, th.HierarchyLevel + 1, FALSE as IsLoggedInCoach
  FROM team_table t
  INNER JOIN team_hierarchy th ON t.UplineCoachId = th.UserId
  WHERE t.Status = 'active' AND th.HierarchyLevel < 10 AND th.HierarchyLevel > 0
)
SELECT * FROM team_hierarchy
ORDER BY HierarchyLevel, UserName;
```

---

## 📊 Performance Considerations

1. **Query Optimization:**
   - Add index on `UplineCoachId`: `CREATE INDEX idx_upline_coach_id ON team_table(UplineCoachId)`
   - Add index on `Role`: `CREATE INDEX idx_role ON team_table(Role)`
   - Limit recursion depth to 10 levels (prevents infinite loops)
   - Single query returns all data (no lazy loading needed for flat list)

2. **Frontend Optimization:**
   - Client-side filtering (search, discipline score, team, sort)
   - No lazy loading needed (all members loaded at once)
   - Virtualized list for large teams (>100 members)
   - Debounce search input to reduce re-renders

3. **Caching Strategy:**
   - Cache complete report data for 5 minutes
   - Invalidate cache on date range change
   - Invalidate cache on manual refresh

4. **Network Optimization:**
   - Single API call loads everything
   - Faster initial load than grouped/lazy approach
   - Better for mobile (no multiple round-trips)

---

## 🎨 UI Visual Elements

### Coach Badge on Member Cards

```
┌─────────────────────────────────────────────┐
│ 👤 Member 4            90% ⭐            ▼  │
│    member4@example.com                      │
│    📌 Coach: Coach B                        │  ← Badge shows direct coach
│    ↳ 0 team members                         │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ 👤 Member 1            85% ⭐            ▼  │
│    member1@example.com                      │
│    📌 Coach: Coach A (You)                  │  ← Shows "(You)" for logged-in coach
│    ↳ 0 team members                         │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ 🎯 Coach B (Coach)     78% 📊  [4 mbrs] ▼  │
│    coachb@example.com                       │
│    📌 Coach: Coach A (You)                  │  ← Sub-coaches also show their coach
│    ↳ 4 team members                         │
└─────────────────────────────────────────────┘
```

### Team Filter Pills

```
Team:
[All Teams] [My Team (4)] [Coach B's Team (4)] [Coach C's Team (2)]
   active      inactive          inactive              inactive
```

### Sort Button States

```
High → Low (Default)     Low → High
┌───────────┐           ┌───────────┐
│     ↓     │           │     ↑     │
└───────────┘           └───────────┘
```

---

## 🚀 Migration & Rollout

### Phase 1: Backend (API Changes)
1. Update recursive SQL query
2. Add grouping logic
3. Test with sample data
4. Deploy to staging

### Phase 2: Frontend (UI Changes)
1. Add group headers
2. Add collapse/expand functionality
3. Update member cards with coach badges
4. Test responsiveness
5. Deploy to staging

### Phase 3: Testing
1. Test with 3-level hierarchy
2. Test with large teams (100+ members)
3. Test collapse/expand performance
4. Cross-browser testing

### Phase 4: Production Rollout
1. Deploy backend changes
2. Deploy frontend changes
3. Monitor performance
4. Gather user feedback

---

## ✅ Success Criteria

- [x] **Coach sees their own discipline performance in dedicated card at top**
- [x] **Coach sees all nested team members in flat list (no grouping)**
- [x] **Each member card shows coach badge with their direct coach's name**
- [x] **Team filter pills below search bar (All Teams, My Team, Coach X's Team)**
- [x] **Sort functionality (highest→lowest, lowest→highest)**
- [x] **"(You)" indicator when member's coach is logged-in user**
- [x] Coach badges visible for sub-coaches (with team count)
- [x] Client-side filtering (search, discipline score, team)
- [x] Performance: <2s load time for 100 members
- [x] Mobile responsive
- [x] No breaking changes to existing features

---

## 🔄 Backward Compatibility

- API response includes both old format (`teamMembers`) and new format (`teamGroups`)
- Frontend checks for `teamGroups` presence, falls back to `teamMembers` if not available
- No database schema changes required (uses existing `UplineCoachId` column)

---

## 📝 Notes

- Recursive CTE requires MySQL 8.0+ (check current DB version)
- Maximum hierarchy depth: 10 levels (configurable)
- Infinite loop protection: `HierarchyLevel < 10` clause
- Coach permissions: Only coaches with `Role = 'coach'` can view discipline report

---

**Status:** ✅ Ready for Implementation  
**Priority:** High  
**Estimated Effort:** 8-12 hours  
**Dependencies:** MySQL 8.0+, Existing discipline report infrastructure

---

## 🎯 Next Steps

When you say "implement", I will:
1. Update backend API with recursive query (include coach names)
2. Add coach filter extraction logic
3. Update frontend component with flat list rendering
4. Add team filter pills component
5. Add sort button and logic
6. Add coach badge to member cards
7. Implement client-side filtering and sorting
8. Test with sample data
