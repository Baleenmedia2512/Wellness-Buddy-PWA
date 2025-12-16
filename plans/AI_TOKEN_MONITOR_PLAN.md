# AI Token Monitor Dashboard - Implementation Plan

## Overview
A mobile-friendly admin dashboard to monitor AI token consumption metrics with real-time analytics and cost tracking in rupees.

## Design Principles
- **Mobile-First**: Optimized for mobile screens (320px - 480px)
- **Glassmorphism**: Modern glass effect with blur and transparency
- **Color Scheme**: White background, light green (#dcfce7, #bbf7d0) and green (#22c55e, #16a34a, #15803d)
- **Clean & Modern**: No gradients, clear typography, easy to read metrics
- **Accessible**: High contrast, readable fonts, touch-friendly targets

## Features

### 1. **Overview Cards**
- Total Tokens Used (Input + Output)
- Total Cost (₹)
- Average Cost per Request
- Most Used Operation Type
- Most Used Model

### 2. **Real-Time Metrics**
- Today's Usage
- This Week's Usage
- This Month's Usage
- Time-based filtering

### 3. **Cost Breakdown**
- Input Token Cost
- Output Token Cost
- Cost by Operation Type
- Cost by Model

### 4. **Usage Analytics**
- Tokens per operation (food_analysis, weight_detection)
- Model comparison (gemini-2.5-flash-lite)
- Daily/Weekly/Monthly trends
- Peak usage times

### 5. **Interactive Features**
- Demo Data Toggle (development mode)
- Date Range Filter
- Operation Type Filter
- Model Filter
- Refresh Data button
- Export to CSV (future enhancement)

### 6. **Visual Components**
- Glassmorphic cards with subtle shadows
- Progress bars for token distribution
- Animated counters for numbers
- Color-coded operation types
- Responsive grid layout

## Technical Architecture

### Backend API: `/api/get-token-usage.js`

#### Endpoint
```
GET /api/get-token-usage?email={email}&timeRange={range}&operationType={type}&model={model}
```

#### Parameters
- `email` (required): User email for authentication
- `timeRange` (optional): `today`, `week`, `month`, `all` (default: `month`)
- `operationType` (optional): Filter by operation type
- `model` (optional): Filter by model name

#### Response Structure
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalTokens": 1000,
      "totalInputTokens": 600,
      "totalOutputTokens": 400,
      "totalCost": 0.05,
      "totalInputCost": 0.03,
      "totalOutputCost": 0.02,
      "averageCostPerRequest": 0.005,
      "requestCount": 10,
      "mostUsedOperation": "food_analysis",
      "mostUsedModel": "gemini-2.5-flash-lite"
    },
    "byOperation": [
      {
        "operationType": "food_analysis",
        "totalTokens": 800,
        "totalCost": 0.04,
        "requestCount": 8
      }
    ],
    "byModel": [
      {
        "modelName": "gemini-2.5-flash-lite",
        "totalTokens": 1000,
        "totalCost": 0.05,
        "requestCount": 10
      }
    ],
    "recentUsage": [
      {
        "id": 1,
        "operationType": "food_analysis",
        "modelName": "gemini-2.5-flash-lite",
        "inputTokens": 100,
        "outputTokens": 50,
        "totalTokens": 150,
        "totalCost": 0.005,
        "createdAt": "2025-12-16T12:00:00Z"
      }
    ],
    "dailyStats": [
      {
        "date": "2025-12-16",
        "totalTokens": 500,
        "totalCost": 0.025,
        "requestCount": 5
      }
    ]
  }
}
```

#### SQL Queries
```sql
-- Summary statistics
SELECT 
  SUM(InputTokens) as totalInputTokens,
  SUM(OutputTokens) as totalOutputTokens,
  SUM(TotalTokens) as totalTokens,
  SUM(InputTokenCost) as totalInputCost,
  SUM(OutputTokenCost) as totalOutputCost,
  SUM(TotalTokenCost) as totalCost,
  COUNT(*) as requestCount,
  AVG(TotalTokenCost) as averageCostPerRequest
FROM ai_token_usage_table
WHERE CreatedAt >= ?

-- By operation type
SELECT 
  OperationType,
  SUM(TotalTokens) as totalTokens,
  SUM(TotalTokenCost) as totalCost,
  COUNT(*) as requestCount
FROM ai_token_usage_table
WHERE CreatedAt >= ?
GROUP BY OperationType

-- By model
SELECT 
  ModelName,
  SUM(TotalTokens) as totalTokens,
  SUM(TotalTokenCost) as totalCost,
  COUNT(*) as requestCount
FROM ai_token_usage_table
WHERE CreatedAt >= ?
GROUP BY ModelName

-- Daily statistics
SELECT 
  DATE(CreatedAt) as date,
  SUM(TotalTokens) as totalTokens,
  SUM(TotalTokenCost) as totalCost,
  COUNT(*) as requestCount
FROM ai_token_usage_table
WHERE CreatedAt >= ?
GROUP BY DATE(CreatedAt)
ORDER BY date DESC
```

### Frontend Component: `AdminDashboard.js`

#### Component Structure
```
AdminDashboard/
├── Header (Title, Filters, Demo Toggle)
├── Summary Cards
│   ├── Total Tokens Card
│   ├── Total Cost Card
│   ├── Avg Cost Card
│   └── Request Count Card
├── Quick Stats
│   ├── Most Used Operation
│   └── Most Used Model
├── Usage by Operation (Cards)
├── Usage by Model (Cards)
├── Recent Activity (List)
└── Footer (Last Updated)
```

#### State Management
```javascript
const [tokenData, setTokenData] = useState(null);
const [loading, setLoading] = useState(true);
const [timeRange, setTimeRange] = useState('month');
const [operationFilter, setOperationFilter] = useState('all');
const [modelFilter, setModelFilter] = useState('all');
const [showDemoData, setShowDemoData] = useState(false);
const [lastUpdated, setLastUpdated] = useState(null);
```

#### Demo Data Structure
```javascript
const DEMO_DATA = {
  summary: {
    totalTokens: 2753,
    totalInputTokens: 1887,
    totalOutputTokens: 866,
    totalCost: 0.0851,
    totalInputCost: 0.0397,
    totalOutputCost: 0.0454,
    averageCostPerRequest: 0.0425,
    requestCount: 2,
    mostUsedOperation: "food_analysis",
    mostUsedModel: "gemini-2.5-flash-lite"
  },
  // ... more demo data
};
```

## UI Components Design

### 1. **Glassmorphic Card Component**
```css
.glass-card {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(34, 197, 94, 0.1);
  border-radius: 16px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
}
```

### 2. **Summary Card**
- Large number display (2rem - 2.5rem)
- Label with icon
- Trend indicator (optional)
- Subtle animation on load

### 3. **Progress Bar**
- Green fill (#22c55e)
- Light gray background
- Percentage label
- Smooth animation

### 4. **Filter Pills**
- Rounded buttons
- Active state: green background
- Inactive state: white with green border
- Touch-friendly (min 44px height)

### 5. **Time Range Selector**
- Horizontal pill buttons
- Single selection
- Options: Today, Week, Month, All

### 6. **Operation/Model Cards**
- Icon + Title
- Token count
- Cost in ₹
- Request count
- Percentage of total

### 7. **Recent Activity List**
- Compact list items
- Operation type badge
- Timestamp
- Token + Cost display
- Dividers between items

## Responsive Design Breakpoints

```css
/* Mobile (default) */
@media (max-width: 640px) {
  - Single column layout
  - Full width cards
  - Stacked filters
  - Larger touch targets
}

/* Tablet */
@media (min-width: 641px) and (max-width: 1024px) {
  - 2 column grid for summary cards
  - Slightly larger cards
}

/* Desktop */
@media (min-width: 1025px) {
  - 3-4 column grid
  - Sidebar layout (optional)
  - Max width 1200px
}
```

## Color Palette

```javascript
const colors = {
  primary: {
    50: '#f0fdf4',   // lightest green
    100: '#dcfce7',  // very light green
    200: '#bbf7d0',  // light green
    300: '#86efac',
    400: '#4ade80',
    500: '#22c55e',  // main green
    600: '#16a34a',  // darker green
    700: '#15803d',  // darkest green
  },
  neutral: {
    0: '#ffffff',    // white
    50: '#f9fafb',   // very light gray
    100: '#f3f4f6',  // light gray
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
  },
  glass: {
    white: 'rgba(255, 255, 255, 0.8)',
    lightGreen: 'rgba(220, 252, 231, 0.6)',
  }
};
```

## Animation & Interactions

### 1. **Number Counter Animation**
- Animate from 0 to actual value on load
- Duration: 1000ms
- Easing: ease-out

### 2. **Card Entrance**
- Fade in + slide up
- Stagger delay (100ms between cards)
- Duration: 300ms

### 3. **Skeleton Loading**
- Pulse animation for loading state
- Match actual card dimensions
- Light gray shimmer

### 4. **Refresh Button**
- Rotate icon on click
- Loading spinner during fetch
- Success feedback

### 5. **Toggle Switch (Demo Data)**
- Smooth slide animation
- Color transition
- Haptic feedback (mobile)

## Integration Steps

### 1. **Backend Setup**
- Create `/api/get-token-usage.js`
- Implement SQL queries with parameterized dates
- Add error handling and validation
- Test with sample data

### 2. **Frontend Component**
- Create `AdminDashboard.js` in `frontend/src/components/`
- Implement responsive layout with Tailwind CSS
- Add demo data for development
- Create reusable sub-components (Card, StatItem, etc.)

### 3. **App Integration**
- Add state in `App.js` for dashboard visibility
- Pass `onShowAdminDashboard` to `Header.js`
- Add conditional rendering for dashboard modal/page
- Handle navigation and closing

### 4. **Testing**
- Test API with different time ranges
- Verify mobile responsiveness (320px - 480px)
- Test demo data toggle
- Check loading states
- Verify calculations

### 5. **Future Enhancements** (Post-MVP)
- Add role-based access control (admin only)
- Export data to CSV
- Add charts/graphs (lightweight library)
- Real-time updates with WebSocket
- Email alerts for high usage
- Budget setting and warnings
- Comparison with previous periods
- Detailed drill-down views

## Security Considerations (Future)

### 1. **Role Validation**
- Use `lookup-user-id` API to check role
- Cache role in session to avoid multiple calls
- Validate on both frontend and backend
- Return 403 if not admin

### 2. **Data Privacy**
- Don't expose user emails in logs
- Aggregate data only
- Implement rate limiting

### 3. **API Security**
- Validate all query parameters
- Sanitize SQL inputs (use parameterized queries)
- Add API key or JWT validation
- Implement CORS properly

## File Structure

```
Wellness-Buddy-PWA/
├── backend/
│   └── pages/
│       └── api/
│           └── get-token-usage.js (NEW)
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── AdminDashboard.js (NEW)
│       │   └── Header.js (UPDATED)
│       └── App.js (UPDATED)
└── plans/
    └── AI_TOKEN_MONITOR_PLAN.md (THIS FILE)
```

## Development Timeline

1. **Planning & Design**: 30 mins ✓
2. **Backend API**: 1 hour
3. **Frontend Component**: 2 hours
4. **Integration & Testing**: 1 hour
5. **Polish & Refinement**: 30 mins

**Total Estimated Time**: 5 hours

## Success Criteria

- ✓ Mobile-friendly (works perfectly on 375px width)
- ✓ Glassmorphism design with green color scheme
- ✓ Demo data toggle for development
- ✓ All metrics display correctly
- ✓ Fast loading (< 1 second)
- ✓ Smooth animations
- ✓ Easy to understand metrics
- ✓ No gradients (solid colors only)
- ✓ Clean, modern UI
- ✓ API responds in < 500ms

## Notes

- For development, admin restriction is disabled
- Demo data is hardcoded and matches the database schema
- Role column will be added to team table for future admin checks
- Costs are displayed in Indian Rupees (₹)
- All timestamps are in IST or user's local timezone
