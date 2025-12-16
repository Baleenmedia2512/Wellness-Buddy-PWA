# AI Token Monitor Dashboard - Visual Component Structure

## Component Hierarchy

```
AdminDashboard (Full-screen modal)
├── Header (Sticky, backdrop-blur)
│   ├── Icon + Title + Subtitle
│   ├── Close Button (X)
│   └── Time Range Filters (Horizontal Pills)
│       ├── Today
│       ├── Week
│       ├── Month
│       └── All
├── Content Area (Scrollable)
│   ├── Demo Mode Toggle (Yellow Banner)
│   │   ├── Icon + "Demo Mode" Label
│   │   └── Toggle Switch
│   ├── Summary Cards Grid (2x2)
│   │   ├── Total Tokens Card
│   │   │   ├── Icon (Activity)
│   │   │   ├── Label
│   │   │   ├── Value (Large)
│   │   │   └── Breakdown (Input ↑ / Output ↓)
│   │   ├── Total Cost Card
│   │   │   ├── Icon (DollarSign)
│   │   │   ├── Label
│   │   │   ├── Value (₹ format)
│   │   │   └── Request Count
│   │   ├── Avg/Request Card
│   │   │   ├── Icon (TrendingUp)
│   │   │   ├── Label
│   │   │   └── Value (₹ format)
│   │   └── Requests Card
│   │       ├── Icon (Zap)
│   │       ├── Label
│   │       └── Value
│   ├── Quick Stats Card
│   │   ├── Header (Sparkles icon + "Quick Stats")
│   │   ├── Most Used Operation (Badge)
│   │   └── Primary Model (Badge)
│   ├── Usage by Operation Section
│   │   ├── Section Header
│   │   └── Operation Cards (Repeating)
│   │       ├── Operation Badge + Percentage
│   │       ├── Stats Grid (2x2)
│   │       │   ├── Tokens
│   │       │   ├── Cost
│   │       │   ├── Requests
│   │       │   └── Avg/Request
│   │       └── Progress Bar
│   ├── Recent Activity Section
│   │   ├── Section Header (Clock icon + "Recent Activity")
│   │   └── Activity List
│   │       └── Activity Items (Repeating)
│   │           ├── Operation Badge + Timestamp
│   │           └── Stats Row
│   │               ├── Tokens
│   │               ├── Cost
│   │               └── Input → Output
│   └── Last Updated Footer (Text)
└── Floating Refresh Button (Fixed, bottom-right)
    └── RefreshCw Icon (Animated when loading)
```

## Layout Visualization (Mobile)

```
┌─────────────────────────────────────┐
│  🎯 AI Token Monitor          ✕     │  ← Sticky Header (blur)
│  Real-time usage analytics          │
│                                      │
│  [Today][Week][Month][All]          │  ← Time Filters
├─────────────────────────────────────┤
│                                      │
│  ⚠️ Demo Mode              [○─]     │  ← Demo Toggle (Yellow)
│                                      │
│  ┌────────────┬────────────┐        │
│  │ 📊 2,753   │ 💰 ₹0.09  │        │  ← Summary Cards
│  │ Total      │ Total      │        │    (2x2 Grid)
│  │ Tokens     │ Cost       │        │
│  │ ↑1887 ↓866 │ 2 requests │        │
│  ├────────────┼────────────┤        │
│  │ 📈 ₹0.04   │ ⚡ 2       │        │
│  │ Avg/Req    │ Requests   │        │
│  └────────────┴────────────┘        │
│                                      │
│  ┌──────────────────────────┐       │
│  │ ✨ Quick Stats            │       │  ← Quick Stats
│  │ Most Used: [food_analysis]│       │
│  │ Model: gemini-2.5-flash   │       │
│  └──────────────────────────┘       │
│                                      │
│  Usage by Operation                  │  ← Section Header
│  ┌──────────────────────────┐       │
│  │ [food_analysis]      43%  │       │  ← Operation Card
│  │ Tokens: 1,183             │       │
│  │ Cost: ₹0.0467             │       │
│  │ [████████░░░] 43%         │       │    Progress Bar
│  └──────────────────────────┘       │
│  ┌──────────────────────────┐       │
│  │ [weight_detection]   35%  │       │  ← Operation Card
│  │ Tokens: 970               │       │
│  │ Cost: ₹0.0384             │       │
│  │ [███████░░░░] 35%         │       │
│  └──────────────────────────┘       │
│                                      │
│  🕐 Recent Activity                  │  ← Section Header
│  ┌──────────────────────────┐       │
│  │ [food_analysis]  12:43 PM │       │  ← Activity Item
│  │ 1,183 tokens • ₹0.0467    │       │
│  │ 1037 → 146                │       │
│  ├──────────────────────────┤       │
│  │ [weight_detection] 11:43  │       │  ← Activity Item
│  │ 970 tokens • ₹0.0384      │       │
│  │ 850 → 120                 │       │
│  └──────────────────────────┘       │
│                                      │
│  Last updated: Dec 16, 12:43 PM     │  ← Footer
│                                      │
│                          [🔄]        │  ← Floating Refresh
└─────────────────────────────────────┘
```

## Color Coding

### Background Colors
- **Dashboard BG**: `bg-gradient-to-b from-green-50 to-white`
- **Header**: `bg-white/80 backdrop-blur-lg`
- **Cards**: `bg-white/80 backdrop-blur-sm`
- **Demo Banner**: `bg-yellow-50`

### Border Colors
- **Cards**: `border-green-100`
- **Demo Banner**: `border-yellow-200`
- **Dividers**: `border-gray-100`

### Text Colors
- **Primary**: `text-gray-800`
- **Secondary**: `text-gray-600`
- **Tertiary**: `text-gray-500`
- **Accent**: `text-green-600`
- **Cost**: `text-green-600`

### Badge Colors

#### Operation Type Badges
```
[food_analysis]
bg-green-100
text-green-700
border-green-200

[weight_detection]
bg-blue-100
text-blue-700
border-blue-200

[default/unknown]
bg-gray-100
text-gray-700
border-gray-200
```

### Button States

#### Time Range Pills
```
Active:
bg-green-500
text-white
shadow-md

Inactive:
bg-white
text-gray-600
border border-gray-200
hover:border-green-300
```

#### Demo Toggle
```
ON (Demo Active):
bg-green-500

OFF (Demo Inactive):
bg-gray-300

Switch Ball:
bg-white (always)
```

#### Floating Refresh Button
```
Normal:
bg-green-500
text-white
shadow-lg

Hover:
bg-green-600

Disabled (Refreshing):
bg-green-500
opacity-50
```

## Spacing System

### Card Spacing
- **Outer Margin**: `mb-6` (between sections)
- **Inner Padding**: `p-4` (within cards)
- **Grid Gap**: `gap-3` (between grid items)

### Element Spacing
- **Icon + Text**: `space-x-2` (horizontal)
- **Stats Grid**: `gap-2` (grid cells)
- **List Items**: No gap (use borders)

### Touch Targets
- **Minimum Height**: 44px for all interactive elements
- **Button Padding**: `px-4 py-2` (pill buttons)
- **FAB Size**: 56px × 56px (floating button)

## Typography Scale

### Headings
- **Dashboard Title**: `text-lg font-bold text-gray-800`
- **Section Headers**: `text-sm font-semibold text-gray-700`
- **Card Labels**: `text-xs font-medium text-gray-500`

### Values
- **Large Numbers**: `text-2xl font-bold text-gray-800`
- **Medium Numbers**: `text-xl font-bold text-gray-800`
- **Small Numbers**: `text-sm font-semibold text-gray-800`

### Supporting Text
- **Subtitles**: `text-xs text-gray-500`
- **Descriptions**: `text-sm text-gray-600`
- **Timestamps**: `text-xs text-gray-500`

## Icon Sizes

- **Header Icon**: `h-5 w-5`
- **Card Icons**: `h-4 w-4`
- **Section Icons**: `h-4 w-4`
- **FAB Icon**: `h-5 w-5`
- **Close Icon**: `h-5 w-5`

## Border Radius

- **Cards**: `rounded-2xl` (16px)
- **Pills**: `rounded-full`
- **Badges**: `rounded-full`
- **Buttons (square)**: `rounded-lg` (8px)
- **Progress Bars**: `rounded-full`
- **FAB**: `rounded-full`

## Shadow System

- **Cards**: `shadow-sm` (subtle)
- **Header**: `shadow-sm` (subtle)
- **FAB**: `shadow-lg` (elevated)
- **Active Pills**: `shadow-md` (medium)

## Animation Classes

### Loading States
```css
.animate-spin {
  /* For refresh icon */
  animation: spin 1s linear infinite;
}
```

### Transitions
```css
.transition-all {
  transition-property: all;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 150ms;
}

.transition-colors {
  transition-property: color, background-color, border-color;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 150ms;
}

.duration-500 {
  /* For progress bars */
  transition-duration: 500ms;
}
```

### Hover Effects
```css
hover:bg-gray-50    /* Subtle hover for cards */
hover:bg-green-600  /* Darker green for buttons */
hover:scale-110     /* Scale up for FAB */
active:scale-95     /* Scale down on press */
```

## Responsive Breakpoints

### Mobile (Default)
```css
/* < 640px */
- Single column
- Full width cards
- Stacked filters (horizontal scroll)
- 2x2 summary grid
```

### Tablet
```css
@media (min-width: 640px) {
  /* 640px - 1024px */
  - Slightly wider cards
  - More horizontal spacing
}
```

### Desktop
```css
@media (min-width: 1024px) {
  /* > 1024px */
  - Max width: 448px (max-w-md)
  - Centered layout
  - Desktop hover states
}
```

## Accessibility

### ARIA Labels (To be added)
```jsx
<button aria-label="Close dashboard">
<button aria-label="Refresh data">
<div role="status" aria-live="polite"> {/* For loading states */}
```

### Keyboard Navigation
- Tab through interactive elements
- Enter/Space to activate buttons
- Escape to close dashboard

### Screen Reader Support
- Semantic HTML (section, header, button)
- Descriptive text for icons
- Live regions for dynamic updates

## Performance Optimizations

### React Optimizations
- `React.lazy()` for code splitting
- `useCallback` for stable function references
- `useMemo` for expensive calculations (future)
- Conditional rendering to avoid unnecessary DOM

### CSS Optimizations
- Tailwind's JIT compiler
- Minimal custom CSS
- Hardware-accelerated properties (backdrop-filter)
- No inline styles (except dynamic widths)

### Image Optimizations
- Icons from lucide-react (SVG)
- No external images to load
- Icon size optimization

## Browser Support

### Modern Features Used
- **Backdrop Filter**: For glassmorphism (fallback: solid bg)
- **CSS Grid**: For card layouts
- **Flexbox**: For alignment
- **Custom Properties**: Via Tailwind (compiled)

### Minimum Browser Versions
- Chrome 76+ (backdrop-filter)
- Safari 13+ (backdrop-filter)
- Firefox 103+ (backdrop-filter)
- Edge 79+ (backdrop-filter)

### Fallbacks
```css
/* If backdrop-filter not supported */
.glass-card {
  background: rgba(255, 255, 255, 0.95);
  /* Increase opacity for better readability */
}
```

## Data Flow Diagram

```
User Action
    ↓
Component Event Handler
    ↓
State Update (useState)
    ↓
useEffect Triggered
    ↓
Fetch API Call
    ↓
Backend API (/api/get-token-usage)
    ↓
Database Query (MySQL)
    ↓
SQL Aggregation
    ↓
Format Response
    ↓
Return JSON
    ↓
Frontend Receives Data
    ↓
Update State (setTokenData)
    ↓
React Re-renders
    ↓
UI Updates with New Data
```

## State Management Flow

```
Initial State
├── loading: true
├── tokenData: null
├── showDemoData: false
└── timeRange: 'month'
    ↓
Component Mount
    ↓
fetchTokenData()
    ↓
[Demo Mode Check]
    ├── If showDemoData = true → Load DEMO_DATA
    └── If showDemoData = false → Fetch from API
    ↓
Update State
├── loading: false
├── tokenData: { summary, byOperation, ... }
├── lastUpdated: new Date()
└── refreshing: false
    ↓
User Interaction
├── Change timeRange → Refetch
├── Toggle showDemoData → Reload
└── Click Refresh → Refetch
```

---

**Visual Reference Version**: 1.0  
**Last Updated**: December 16, 2025  
**Mobile Width**: 375px (iPhone standard)  
**Design System**: Tailwind CSS v3+
