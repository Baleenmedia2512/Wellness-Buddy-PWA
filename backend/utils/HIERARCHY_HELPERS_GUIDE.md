# Hierarchy Helpers - Universal Team Count Utilities

**Location:** `backend/utils/hierarchyHelpers.js`

## Overview

Generic reusable utilities for calculating team statistics in hierarchical structures. Works for **ANY metric or report type**: attendance, discipline scores, weight loss, activity counts, sales performance, etc.

## Key Concept

The helpers calculate two types of counts for each person in the hierarchy:
- **Direct Team Count**: Stats for immediate team members only (children)
- **Full Team Count**: Stats for all descendants (children, grandchildren, etc.)

The "qualified" count can represent anything:
- ✅ People who attended
- 📊 People with score >= 80
- 💪 People who lost weight
- 🎯 People who met their goal
- 📱 People who logged activity today

---

## Core Functions

### 1. `buildHierarchyWithMetricCounts()`

Main function to build hierarchy with team counts.

```javascript
buildHierarchyWithMetricCounts(members, dataMap, transformFn, conditionFn)
```

**Parameters:**
- `members` - Flat array from `getDualCoachingTeamHierarchy()`
- `dataMap` - Map of `userId` -> your metric data
- `transformFn` - Function to shape the data for each node
- `conditionFn` - Function to determine if someone "qualifies"

**Returns:** Hierarchy with `directTeamCount` and `fullTeamCount` on each node

---

## 📋 Usage Examples

### Example 1: Club Attendance Report

```javascript
import { buildHierarchyWithMetricCounts, calculateHierarchyStats } from '../utils/hierarchyHelpers.js';

// Build attendance map
const attendanceMap = new Map();
attendanceLogs.forEach(log => {
  if (!attendanceMap.has(log.UserId)) {
    attendanceMap.set(log.UserId, { clubs: [], timestamps: [] });
  }
  attendanceMap.get(log.UserId).clubs.push(clubInfo);
  attendanceMap.get(log.UserId).timestamps.push(log.CreatedAt);
});

// Transform function: Define what data each node should have
const transformFn = (userId, dataMap, data) => {
  return data ? {
    attended: true,
    clubs: data.clubs,
    count: data.clubs.length,
    lastAttendance: data.timestamps[data.timestamps.length - 1],
  } : {
    attended: false,
    clubs: [],
    count: 0,
  };
};

// Condition function: When is someone "qualified"?
const conditionFn = (child) => child.metrics?.attended === true;

// Build hierarchy
const hierarchy = buildHierarchyWithMetricCounts(
  teamHierarchy,
  attendanceMap,
  transformFn,
  conditionFn
);

// Calculate overall stats
const stats = calculateHierarchyStats(
  hierarchy,
  (root) => root.metrics?.attended === true
);

console.log(hierarchy.directTeamCount);  // { total: 3, qualified: 2 }
console.log(hierarchy.fullTeamCount);    // { total: 20, qualified: 15 }
console.log(stats);                      // { totalMembers: 21, qualifiedMembers: 15, qualificationRate: 71.4 }
```

### Example 2: Discipline Score Report

```javascript
// Build discipline map
const disciplineMap = new Map();
disciplineRecords.forEach(record => {
  disciplineMap.set(record.UserId, {
    score: record.Score,
    grade: record.Grade,
    onTimeActivities: record.OnTimeCount,
    lateActivities: record.LateCount,
  });
});

// Transform: Shape the discipline data
const transformFn = (userId, dataMap, data) => ({
  score: data?.score || 0,
  grade: data?.grade || 'N/A',
  onTime: data?.onTimeActivities || 0,
  late: data?.lateActivities || 0,
  hasData: !!data,
});

// Condition: Score >= 80 is "qualified"
const conditionFn = (child) => child.metrics?.score >= 80;

const hierarchy = buildHierarchyWithMetricCounts(
  teamHierarchy,
  disciplineMap,
  transformFn,
  conditionFn
);

// Result:
// hierarchy.directTeamCount = { total: 5, qualified: 3 }  // 3 of 5 direct members have score >= 80
// hierarchy.fullTeamCount = { total: 25, qualified: 18 }  // 18 of 25 total members have score >= 80
```

### Example 3: Weight Loss Report

```javascript
// Build weight map
const weightMap = new Map();
weightRecords.forEach(record => {
  weightMap.set(record.UserId, {
    current: record.CurrentWeight,
    previous: record.PreviousWeight,
    loss: record.PreviousWeight - record.CurrentWeight,
    target: record.TargetWeight,
  });
});

// Transform: Weight loss data
const transformFn = (userId, dataMap, data) => ({
  currentWeight: data?.current || 0,
  weightLoss: data?.loss || 0,
  targetWeight: data?.target || 0,
  meetsTarget: data ? (data.current <= data.target) : false,
});

// Condition: Lost weight (loss > 0)
const conditionFn = (child) => child.metrics?.weightLoss > 0;

const hierarchy = buildHierarchyWithMetricCounts(
  teamHierarchy,
  weightMap,
  transformFn,
  conditionFn
);

// Result:
// hierarchy.directTeamCount = { total: 4, qualified: 3 }  // 3 of 4 direct members lost weight
// hierarchy.fullTeamCount = { total: 15, qualified: 11 }  // 11 of 15 total members lost weight
```

### Example 4: Activity Goal Achievement

```javascript
// Build activity map
const activityMap = new Map();
activityRecords.forEach(record => {
  activityMap.set(record.UserId, {
    logged: record.ActivitiesLogged,
    goal: record.DailyGoal,
    streak: record.Streak,
  });
});

// Transform: Activity data
const transformFn = (userId, dataMap, data) => ({
  activitiesLogged: data?.logged || 0,
  dailyGoal: data?.goal || 3,
  streak: data?.streak || 0,
  metGoal: data ? (data.logged >= data.goal) : false,
});

// Condition: Met daily goal
const conditionFn = (child) => child.metrics?.metGoal === true;

const hierarchy = buildHierarchyWithMetricCounts(
  teamHierarchy,
  activityMap,
  transformFn,
  conditionFn
);
```

### Example 5: Simple Boolean (Has Data or Not)

```javascript
// Simplest case: Just check if someone has any data at all
const dataMap = new Map([[123, { hasActivity: true }], [456, { hasActivity: true }]]);

// No transform needed - use default
const hierarchy = buildHierarchyWithMetricCounts(
  teamHierarchy,
  dataMap
);

// Default condition checks if metrics exists
// hierarchy.directTeamCount = { total: 5, qualified: 2 }  // 2 of 5 have data
```

---

## Helper Functions

### `calculateHierarchyStats(hierarchy, conditionFn)`

Get overall statistics for the entire hierarchy.

```javascript
const stats = calculateHierarchyStats(
  hierarchy,
  (root) => root.metrics?.score >= 80
);

// Returns:
// {
//   totalMembers: 21,        // Total people in hierarchy (including root)
//   qualifiedMembers: 15,    // How many meet the condition
//   qualificationRate: 71.4  // Percentage (rounded to 1 decimal)
// }
```

### `buildDataMap(records, userIdField, transformFn)`

Quickly build a Map from database query results.

```javascript
// Simple map - use records as-is
const map = buildDataMap(attendanceLogs);

// Transformed map
const map = buildDataMap(
  disciplineRecords,
  'UserId',
  (record) => ({
    score: record.Score,
    grade: record.Grade,
  })
);
```

### `calculateFullTeamStats(children, conditionFn)`

Low-level function to calculate stats for an array of children.

```javascript
const stats = calculateFullTeamStats(
  node.teamMembers,
  (child) => child.metrics?.attended === true
);

// Returns: { total: 10, qualified: 7 }
```

---

## 🎯 Frontend Display

Use the counts in your React components:

```javascript
{node.directTeamCount && node.directTeamCount.total > 0 && (
  <span className="badge">
    Direct: {node.directTeamCount.qualified}/{node.directTeamCount.total}
  </span>
)}

{node.fullTeamCount && node.fullTeamCount.total > 0 && (
  <span className="badge">
    Full Team: {node.fullTeamCount.qualified}/{node.fullTeamCount.total}
  </span>
)}
```

---

## 📊 Data Structure

Each node in the returned hierarchy:

```javascript
{
  userId: 123,
  userName: "John Doe",
  email: "john@example.com",
  role: "coach",
  hierarchyLevel: 0,
  
  // Your custom metric data (from transformFn)
  metrics: {
    // ... whatever you defined in transformFn
  },
  
  // Direct team stats (immediate children)
  directTeamCount: {
    total: 3,      // Total direct team members
    qualified: 2,  // How many meet the condition
  },
  
  // Full team stats (all descendants)
  fullTeamCount: {
    total: 10,     // Total descendants
    qualified: 7,  // How many meet the condition
  },
  
  // Processed children (recursive structure)
  teamMembers: [...]
}
```

---

## 🔄 Migration from Old Code

**Before (Manual Counting):**
```javascript
const buildHierarchy = (members) => {
  // ... manual parent-child relationship building
  // ... manual counting logic
  // ... 50+ lines of code
};
```

**After (Using Helpers):**
```javascript
const hierarchy = buildHierarchyWithMetricCounts(
  members,
  dataMap,
  transformFn,
  conditionFn
);
// Done! 5 lines of code
```

---

## ⚡ Performance

- **Time Complexity:** O(n) where n = number of team members
- **Space Complexity:** O(n) for the hierarchy structure
- **Optimization:** Uses Map for O(1) lookups
- **Suitable for:** Teams up to 10,000+ members

---

## 🧪 Testing Example

```javascript
const mockTeam = [
  { UserId: 1, UserName: 'Coach', HierarchyLevel: 0, HierarchyParent: null, IsLoggedInCoach: true },
  { UserId: 2, UserName: 'Member1', HierarchyLevel: 1, HierarchyParent: 1 },
  { UserId: 3, UserName: 'Member2', HierarchyLevel: 1, HierarchyParent: 1 },
  { UserId: 4, UserName: 'SubMember', HierarchyLevel: 2, HierarchyParent: 2 },
];

const dataMap = new Map([
  [1, { attended: true }],
  [2, { attended: true }],
  // 3 and 4 did not attend
]);

const hierarchy = buildHierarchyWithMetricCounts(
  mockTeam,
  dataMap,
  (userId, map, data) => ({ attended: !!data }),
  (child) => child.metrics?.attended === true
);

// Assertions
assert(hierarchy.directTeamCount.total === 2);      // 2 direct children
assert(hierarchy.directTeamCount.qualified === 1);  // Only Member1 attended
assert(hierarchy.fullTeamCount.total === 3);        // 3 total descendants
assert(hierarchy.fullTeamCount.qualified === 1);    // Only Member1 attended (SubMember didn't)
```

---

## 📦 Quick Reference

| Function | Purpose | Returns |
|----------|---------|---------|
| `buildHierarchyWithMetricCounts()` | Main function - build hierarchy with counts | Hierarchy object |
| `calculateHierarchyStats()` | Get overall stats | `{ totalMembers, qualifiedMembers, qualificationRate }` |
| `calculateFullTeamStats()` | Count descendants for array | `{ total, qualified }` |
| `buildDataMap()` | Convert array to Map | Map object |

---

## 💡 Pro Tips

1. **Keep transformFn simple** - It's called for every node
2. **Use meaningful condition names** - `(child) => child.metrics?.metGoal` is clearer than `(c) => c.m?.mg`
3. **Default conditions** - If you don't provide a conditionFn, it checks if metrics has any data
4. **Reuse the same helpers** - One codebase for all reports!
5. **Frontend compatibility** - Frontend can check `node.metrics || node.attendance` for backward compatibility

---

## 🚀 Ready to Use

Import and use in any API endpoint:

```javascript
import { buildHierarchyWithMetricCounts, calculateHierarchyStats } from '../utils/hierarchyHelpers.js';
```

That's it! Universal team counting for all your reports. 🎉
