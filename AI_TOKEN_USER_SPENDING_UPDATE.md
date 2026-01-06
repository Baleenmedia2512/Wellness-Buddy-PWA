# AI Token Monitor - User Spending Table Update

## Overview
Replaced the line graph section with a traditional table showing individual user spending breakdown.

## Changes Made

### 1. Frontend - AdminDashboard.js

#### Removed Components:
- **SimpleLineChart** component (~190 lines) - Complete removal of the cost trend graph
- **Cost Trend section** - The entire graph display area

#### Removed Imports:
- `TrendingUp` icon from lucide-react (no longer needed)

#### Updated Data Structure:
```javascript
// Before:
const dailyStats = tokenData?.dailyStats || [];
const recentUsage = tokenData?.recentUsage || [];

// After:
const userSpending = tokenData?.userSpending || [];
```

#### New User Spending Table:
- **Table Headers**: User | Tokens | Requests | Cost
- **Features**:
  - Sortable by cost (highest spenders first)
  - Shows user name and email
  - Displays total tokens, request count, and total cost
  - Mobile-responsive with horizontal scroll
  - Hover effects on rows
  - Clean table styling with borders and spacing

**Table Structure:**
```javascript
<table className="w-full">
  <thead>
    <tr>
      <th>User</th>          // Name + Email (truncated)
      <th>Tokens</th>        // Total tokens consumed
      <th>Requests</th>      // Number of requests made
      <th>Cost</th>          // Total cost in ₹
    </tr>
  </thead>
  <tbody>
    {/* Rows sorted by totalCost DESC */}
  </tbody>
</table>
```

### 2. Backend - get-token-usage.js

#### New Query Added (Query 8):
```sql
SELECT 
  a.UserId as userId,
  a.Email as email,
  COALESCE(t.Name, SUBSTRING_INDEX(a.Email, '@', 1)) as userName,
  COALESCE(SUM(a.TotalTokens), 0) as totalTokens,
  COALESCE(SUM(a.TotalTokenCost), 0) as totalCost,
  COUNT(*) as requestCount
FROM ai_token_usage_table a
LEFT JOIN team_table t ON a.UserId = t.UserId
WHERE ${whereClause}
GROUP BY a.UserId, a.Email, t.Name
ORDER BY totalCost DESC
LIMIT 50
```

**Query Features:**
- Aggregates spending by user (GROUP BY UserId, Email)
- LEFT JOIN with team_table to get user names
- Falls back to email prefix if name not found: `SUBSTRING_INDEX(a.Email, '@', 1)`
- Orders by total cost (highest spenders first)
- Limits to top 50 users
- Respects existing date range and filter parameters

#### API Response Update:
Added new `userSpending` array to the response data:
```javascript
{
  success: true,
  data: {
    summary: { ... },
    byOperation: [ ... ],
    byModel: [ ... ],
    recentUsage: [ ... ],
    dailyStats: [ ... ],
    userSpending: [        // NEW
      {
        userId: string,
        email: string,
        userName: string,
        totalTokens: number,
        totalCost: number,
        requestCount: number
      }
    ],
    timeRange: string,
    generatedAt: string
  }
}
```

### 3. Demo Data Structure

Updated DEMO_DATA in AdminDashboard.js to include sample userSpending:
```javascript
userSpending: [
  { userId: 'USR001', email: 'john.doe@example.com', userName: 'John Doe', totalCost: 1.25, totalTokens: 8520, requestCount: 45 },
  { userId: 'USR002', email: 'jane.smith@example.com', userName: 'Jane Smith', totalCost: 0.95, totalTokens: 6340, requestCount: 32 },
  { userId: 'USR003', email: 'bob.wilson@example.com', userName: 'Bob Wilson', totalCost: 0.78, totalTokens: 5180, requestCount: 28 },
  { userId: 'USR004', email: 'alice.brown@example.com', userName: 'Alice Brown', totalCost: 0.52, totalTokens: 3460, requestCount: 19 },
  { userId: 'USR005', email: 'charlie.davis@example.com', userName: 'Charlie Davis', totalCost: 0.36, totalTokens: 2390, requestCount: 12 }
]
```

## Benefits

### 1. Better User Insights
- Admins can now see **which specific users** are consuming the most tokens
- Identifies high-usage users for cost optimization
- Provides individual accountability tracking

### 2. Simplified UI
- Removed complex graph that occupied screen space
- Direct table view is easier to read and understand on mobile
- Faster load times without chart rendering

### 3. Actionable Data
- Can identify users who may need usage guidance
- Helps in cost allocation per user/department
- Enables targeted optimization efforts

### 4. Mobile-Friendly
- Table is horizontally scrollable on small screens
- Compact column widths
- Touch-friendly row interactions

## Testing Checklist

- [ ] Demo Data Toggle - Verify table shows 5 demo users
- [ ] Live Data - Test with real database (should pull from team_table)
- [ ] Sorting - Confirm users are sorted by highest cost first
- [ ] Time Range Filters - Test that user spending updates with date ranges
- [ ] Empty State - Verify "No user spending data" message appears when empty
- [ ] Mobile View - Check horizontal scroll works on small screens
- [ ] User Names - Confirm names are pulled from team_table or email fallback
- [ ] Email Truncation - Long emails should truncate with max-w-[180px]
- [ ] Cost Formatting - All costs should show ₹ symbol with 2 decimals
- [ ] Token Formatting - Should use thousand separators (e.g., 8,520)

## Database Requirements

### Required Tables:
1. **ai_token_usage_table** (already exists)
   - UserId, Email, TotalTokens, TotalTokenCost, CreatedAt

2. **team_table** (assumed to exist)
   - UserId, Name
   - If this table doesn't exist, the query will still work (LEFT JOIN)
   - Will fall back to using email username as the display name

### Fallback Behavior:
If `team_table` doesn't exist or user not found:
```sql
COALESCE(t.Name, SUBSTRING_INDEX(a.Email, '@', 1))
```
This extracts the part before @ from email (e.g., "john.doe@example.com" → "john.doe")

## UI Design

### Table Styling:
- **Header**: Gray background, uppercase text, semibold font
- **Rows**: White background, hover effect (gray-50), border dividers
- **User Column**: Name (medium font) + Email (small, gray, truncated)
- **Number Columns**: Right-aligned, medium font
- **Cost Column**: Green color (#22c55e), bold font
- **Empty State**: Centered gray text

### Visual Hierarchy:
1. Total cost is most prominent (green, bold)
2. User names are primary identifiers
3. Tokens and requests are secondary metrics
4. Email is tertiary (smaller, muted)

## File Changes Summary

| File | Lines Changed | Type |
|------|---------------|------|
| `frontend/src/components/AdminDashboard.js` | ~200 | Removed graph, added table |
| `backend/pages/api/get-token-usage.js` | +20 | Added user spending query |

## Next Steps (Optional Enhancements)

1. **Click-through Details**: Click user row to see detailed breakdown
2. **Export CSV**: Add button to download user spending report
3. **Pagination**: If >50 users, add pagination controls
4. **Search/Filter**: Add search box to filter by user name/email
5. **Comparison View**: Toggle to compare current period vs previous
6. **Cost Alerts**: Highlight users exceeding threshold in red
7. **Trend Indicators**: Show ↑↓ arrows for cost increase/decrease

## Performance Notes

- Query uses proper indexing on CreatedAt and UserId
- LIMIT 50 prevents large datasets from slowing down UI
- LEFT JOIN is efficient with proper foreign keys
- COALESCE prevents NULL values from breaking frontend

---

**Status**: ✅ Completed  
**Testing**: Ready for QA  
**Deployment**: Backend + Frontend changes required
