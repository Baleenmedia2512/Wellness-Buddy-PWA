# Hierarchical Team Structure Implementation Guide

## Overview

This implementation adds a hierarchical team structure to the Discipline page with two tabs:
- **My Teams**: Flat list view with filters (existing functionality)
- **All Teams**: Hierarchical tree view showing coach → co-coach → member relationships

## Architecture

### 1. Data Structure

```json
{
  "userId": 123,
  "userName": "Main Coach",
  "email": "coach@example.com",
  "role": "coach",
  "isCoCoach": false,
  "uplineCoachId": null,
  "directMemberCount": 3,
  "totalMemberCount": 7,
  "teamMembers": [
    {
      "userId": 456,
      "userName": "Co-Coach B",
      "role": "user",
      "isCoCoach": true,
      "uplineCoachId": 123,
      "directMemberCount": 2,
      "totalMemberCount": 2,
      "teamMembers": [
        {
          "userId": 789,
          "userName": "Member C",
          "role": "user",
          "isCoCoach": false,
          "uplineCoachId": 456,
          "directMemberCount": 0,
          "totalMemberCount": 0,
          "teamMembers": []
        }
      ]
    }
  ]
}
```

### 2. Database Schema

The existing `team_table` already supports hierarchy via the `UplineCoachId` field:

| Field | Type | Description |
|-------|------|-------------|
| UserId | int | Primary key |
| UserName | varchar | User's name |
| Email | varchar | User's email |
| Role | enum | 'user', 'coach', 'admin' |
| UplineCoachId | int | ID of the coach this user reports to |
| Status | varchar | 'Active' or 'Inactive' |
| CoCoachName | varchar | Name of co-coach (if assigned) |

**Key Points:**
- `UplineCoachId` creates the parent-child relationship
- `Role = 'coach'` identifies coaches who can have team members
- `CoCoachName` being non-empty indicates a co-coach role
- Multi-level hierarchy is supported naturally through recursive relationships

### 3. API Endpoints

#### GET /api/coach/team-hierarchy

**Purpose**: Fetch hierarchical team structure for a coach

**Request:**
```
GET /api/coach/team-hierarchy?coachId=123&includeInactive=false
```

**Parameters:**
- `coachId` (required): ID of the coach requesting the hierarchy
- `includeInactive` (optional): Include inactive users (default: false)

**Response:**
```json
{
  "success": true,
  "loggedInCoach": {
    "userId": 123,
    "userName": "Main Coach",
    "email": "coach@example.com",
    "role": "coach",
    "totalMemberCount": 7
  },
  "hierarchy": {
    "userId": 123,
    "userName": "Main Coach",
    "teamMembers": [...]
  },
  "topLevelCoaches": [...],
  "stats": {
    "totalCoaches": 5,
    "totalMembers": 20,
    "totalUsers": 25
  }
}
```

## Implementation

### Files Created

1. **Backend API**
   - `backend/pages/api/coach/team-hierarchy.js`
   - Fetches and builds hierarchical team structure

2. **Frontend Service**
   - `frontend/src/services/teamHierarchyService.js`
   - Handles API calls and data transformations

3. **Frontend Component**
   - `frontend/src/components/HierarchicalTeamView.js`
   - Reusable component for displaying team hierarchy with expand/collapse

4. **Integration Guide**
   - `frontend/src/components/DisciplineReportIntegration.guide.js`
   - Step-by-step instructions for integrating into DisciplineReport

### Key Features

#### Hierarchical Tree View
- **Expand/Collapse**: Click chevron to expand/collapse team members
- **Visual Hierarchy**: Indentation shows parent-child relationships
- **Role Indicators**: 
  - Crown icon (👑) for admins
  - Shield icon (🛡️) for coaches
  - User icon for regular users
- **Co-Coach Badge**: Purple badge and left border for co-coaches
- **Member Count**: Shows direct reports count for each node
- **Expand/Collapse All**: Utility buttons to expand or collapse entire tree

#### UI/UX Features
1. **Color Coding**:
   - Admins: Yellow background
   - Coaches: Blue background
   - Users: White background
   - Co-coaches: Purple accent border

2. **Interactive Elements**:
   - Click on node to view details
   - Click chevron to expand/collapse
   - Smooth animations for expand/collapse

3. **Responsive Design**:
   - Mobile-first approach
   - Touch-friendly tap targets
   - Horizontal scroll on mobile if needed

## Integration Steps

### Step 1: Add State Variables

In `DisciplineReport.js`, add these state variables:

```javascript
const [activeTab, setActiveTab] = useState('myTeam');
const [hierarchyData, setHierarchyData] = useState(null);
const [hierarchyLoading, setHierarchyLoading] = useState(false);
```

### Step 2: Import Components

```javascript
import HierarchicalTeamView from './HierarchicalTeamView';
import { teamHierarchyService } from '../services/teamHierarchyService';
```

### Step 3: Add Data Loading

```javascript
const loadHierarchyData = React.useCallback(async () => {
  if (!user?.id) return;
  setHierarchyLoading(true);
  try {
    const data = await teamHierarchyService.getTeamHierarchy(user.id);
    setHierarchyData(data);
  } catch (err) {
    console.error('Failed to load hierarchy:', err);
  } finally {
    setHierarchyLoading(false);
  }
}, [user?.id]);

useEffect(() => {
  if (activeTab === 'allTeams' && !hierarchyData) {
    loadHierarchyData();
  }
}, [activeTab, hierarchyData, loadHierarchyData]);
```

### Step 4: Add Tab Navigation UI

Insert after the date range selector:

```jsx
<div className="bg-white border-b border-gray-100">
  <div className="max-w-3xl mx-auto px-4">
    <div className="flex gap-2">
      <button
        onClick={() => setActiveTab('myTeam')}
        className={`flex-1 py-3 px-4 text-sm font-semibold transition-all border-b-2 ${
          activeTab === 'myTeam'
            ? 'border-green-600 text-green-700 bg-green-50/50'
            : 'border-transparent text-gray-500'
        }`}
      >
        My Teams
      </button>
      <button
        onClick={() => setActiveTab('allTeams')}
        className={`flex-1 py-3 px-4 text-sm font-semibold transition-all border-b-2 ${
          activeTab === 'allTeams'
            ? 'border-blue-600 text-blue-700 bg-blue-50/50'
            : 'border-transparent text-gray-500'
        }`}
      >
        All Teams
      </button>
    </div>
  </div>
</div>
```

### Step 5: Conditional Content Rendering

Replace the member list with:

```jsx
{activeTab === 'myTeam' ? (
  // Existing flat list view
  <div className="space-y-3">
    {/* Your existing member cards */}
  </div>
) : (
  // New hierarchical view
  <HierarchicalTeamView
    hierarchy={hierarchyData?.hierarchy}
    onNodeClick={(node) => console.log('Clicked:', node)}
    showDisciplineScores={false}
    disciplineScores={{}}
  />
)}
```

## Advanced Features

### 1. Show Discipline Scores in Hierarchy

```javascript
const disciplineScoresMap = React.useMemo(() => {
  if (!teamData) return {};
  const scores = {};
  
  if (teamData.coachPerformance) {
    scores[teamData.coachPerformance.userId] = 
      teamData.coachPerformance.periodDiscipline.percentage;
  }
  
  teamData.teamMembers?.forEach(member => {
    scores[member.userId] = member.periodDiscipline.percentage;
  });
  
  return scores;
}, [teamData]);

<HierarchicalTeamView
  showDisciplineScores={true}
  disciplineScores={disciplineScoresMap}
  // ... other props
/>
```

### 2. Click Node to Filter My Teams

```javascript
const handleNodeClick = (node) => {
  setActiveTab('myTeam');
  setTeamFilter(node.userId.toString());
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

<HierarchicalTeamView
  onNodeClick={handleNodeClick}
  // ... other props
/>
```

### 3. Search in Hierarchy

```javascript
const [hierarchySearch, setHierarchySearch] = useState('');

const handleSearch = async () => {
  const results = await teamHierarchyService.searchInHierarchy(
    user.id,
    hierarchySearch
  );
  // Display results
};
```

## Testing

### Test Cases

1. **Tab Switching**
   - ✓ Tabs switch correctly
   - ✓ State persists when switching back
   - ✓ Loading states work

2. **Hierarchy Display**
   - ✓ Multi-level hierarchy displays correctly
   - ✓ Co-coaches are visually distinct
   - ✓ Role icons show correctly
   - ✓ Member counts are accurate

3. **Expand/Collapse**
   - ✓ Individual nodes expand/collapse
   - ✓ Expand All works
   - ✓ Collapse All works
   - ✓ Animations are smooth

4. **Empty/Error States**
   - ✓ Empty hierarchy message displays
   - ✓ Loading spinner shows
   - ✓ Error messages are clear
   - ✓ Retry button works

5. **Responsive Design**
   - ✓ Works on mobile (< 640px)
   - ✓ Works on tablet (640-1024px)
   - ✓ Works on desktop (> 1024px)
   - ✓ Touch targets are adequate

## Performance Considerations

1. **Lazy Loading**: Hierarchy data only loads when "All Teams" tab is active
2. **Memoization**: Use `React.useMemo` for computed values
3. **Virtualization**: For very large teams (>100 members), consider react-window
4. **Caching**: API responses are cached on client side

## Troubleshooting

### Common Issues

**Issue**: Hierarchy doesn't load
- Check API endpoint is accessible
- Verify coachId is being passed correctly
- Check browser console for errors

**Issue**: Expand/collapse doesn't work
- Verify `teamMembers` array exists in data
- Check React state is updating correctly
- Ensure chevron click handler is not blocked

**Issue**: Visual styling is off
- Verify Tailwind CSS is configured
- Check for CSS conflicts
- Ensure `motion` components from framer-motion are available

## Future Enhancements

1. **Drag & Drop**: Reorganize team structure
2. **Bulk Actions**: Select multiple members
3. **Export**: Download hierarchy as PDF/image
4. **Filters**: Filter by role, status, discipline score
5. **Search**: Real-time search within hierarchy
6. **Analytics**: Team performance metrics per coach

## Support

For questions or issues:
1. Check the integration guide
2. Review test cases
3. Check browser console for errors
4. Verify API responses in Network tab

## Changelog

### v1.0.0 (2026-01-27)
- Initial implementation
- Backend API for team hierarchy
- Frontend service layer
- Hierarchical tree component
- Integration with Discipline Report
- Documentation and testing guide
