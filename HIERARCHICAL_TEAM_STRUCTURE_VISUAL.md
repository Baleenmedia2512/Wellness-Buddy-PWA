# Hierarchical Team Structure - Visual Reference

## UI Flow Diagram

```
┌─────────────────────────────────────────────────────┐
│           DISCIPLINE REPORT HEADER                  │
│  ← Back    Discipline Report    🔄 📥 ⚙️           │
│                                                      │
│  📅 Today  Yesterday  Last 7 Days  Last 30 Days 📅  │
└─────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────┐
│         TAB NAVIGATION                               │
│  ┌──────────────┐  ┌──────────────┐                │
│  │  My Teams ✓  │  │  All Teams   │                │
│  └──────────────┘  └──────────────┘                │
└─────────────────────────────────────────────────────┘
```

## Tab 1: My Teams (Existing Flat List View)

```
┌─────────────────────────────────────────────────────┐
│  SUMMARY STATS                                       │
│  ┌──────────┬──────────┬──────────┐                │
│  │  85.2%   │    15    │  12 / 15 │                │
│  │  Avg     │  Members │  On Time │                │
│  └──────────┴──────────┴──────────┘                │
└─────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────┐
│  🔍 Search...            🔽 All Scores              │
└─────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────┐
│  TEAM FILTERS                                        │
│  [All Teams] [My Team (8)] [John's Team (4)]       │
└─────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────┐
│  MEMBER LIST                                         │
│  ┌────────────────────────────────────────┐        │
│  │  [A] Alice Johnson                     │ 92%    │
│  │      alice@example.com                 │        │
│  │      Coach: You                         │        │
│  └────────────────────────────────────────┘        │
│  ┌────────────────────────────────────────┐        │
│  │  [B] Bob Smith                          │ 88%    │
│  │      bob@example.com                    │        │
│  │      Coach: You                         │  ∨     │
│  ├────────────────────────────────────────┤        │
│  │  ⚖️ 90%  📚 85%  ☕ 88%  🍽️ 90%  🌙 85% │        │
│  └────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────┘
```

## Tab 2: All Teams (New Hierarchical Tree View)

```
┌─────────────────────────────────────────────────────┐
│  TEAM HIERARCHY                                      │
│  Expand coaches and co-coaches to see their teams   │
│  ┌────────┬────────┐                                │
│  │ 🛡️ 5   │ 👥 20  │                                │
│  │ Coaches│ Members│                                │
│  └────────┴────────┘                                │
│                                                      │
│  [Expand All]  [Collapse All]                       │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  HIERARCHY TREE                                      │
│                                                      │
│  ∨ [M] Main Coach (You)                        👤 8 │
│  │  └── alice@example.com                           │
│  │                                                   │
│  ├─ ∨ [B] Bob Smith (Co-Coach) ●●●           👤 3   │
│  │  │   └── bob@example.com                         │
│  │  │                                                │
│  │  ├── [C] Charlie Brown                      88%  │
│  │  │   └── charlie@example.com                     │
│  │  │                                                │
│  │  ├── [D] Diana Prince                       92%  │
│  │  │   └── diana@example.com                       │
│  │  │                                                │
│  │  └─ › [E] Eve Adams (Co-Coach) ●●●          👤 2 │
│  │       └── eve@example.com                        │
│  │                                                   │
│  ├── [F] Frank Castle                           76%  │
│  │   └── frank@example.com                          │
│  │                                                   │
│  └── [G] Grace Hopper                           94%  │
│      └── grace@example.com                          │
│                                                      │
│  ∨ [J] John Doe (Coach)                         👤 4 │
│     └── john@example.com                             │
│     (collapsed - click to expand)                    │
└─────────────────────────────────────────────────────┘
```

## Visual Hierarchy Key

### Node Types & Styling

#### 1. Main Coach (Logged-in User)
```
┌──────────────────────────────────────────────┐
│ ∨ [M] Main Coach (You)                  👤 8 │ ← Blue background
│ │  └── coach@example.com                     │
└──────────────────────────────────────────────┘
```
- **Background**: Blue (`bg-blue-50`)
- **Border**: Blue (`border-blue-200`)
- **Icon**: Shield 🛡️
- **Label**: "(You)"

#### 2. Regular Coach
```
┌──────────────────────────────────────────────┐
│ › [J] John Doe (Coach)                  👤 4 │ ← Blue background
│    └── john@example.com                      │
└──────────────────────────────────────────────┘
```
- **Background**: Blue (`bg-blue-50`)
- **Border**: Blue (`border-blue-200`)
- **Icon**: Shield 🛡️

#### 3. Co-Coach
```
┌──────────────────────────────────────────────┐
│ ∨ [B] Bob Smith (Co-Coach) ●●●          👤 3 │ ← Purple left border
│ │  └── bob@example.com                       │
└──────────────────────────────────────────────┘
```
- **Background**: White (`bg-white`)
- **Border**: Gray + **Purple left border** (`border-l-4 border-l-purple-500`)
- **Badge**: Purple "CO-COACH" label
- **Icon**: User 👤

#### 4. Regular Member
```
┌──────────────────────────────────────────────┐
│    [C] Charlie Brown                    88%  │ ← White background
│    └── charlie@example.com                   │
└──────────────────────────────────────────────┘
```
- **Background**: White (`bg-white`)
- **Border**: Gray (`border-gray-200`)
- **Icon**: User 👤

#### 5. Admin
```
┌──────────────────────────────────────────────┐
│ [A] Admin User                               │ ← Yellow background
│    └── admin@example.com                     │
└──────────────────────────────────────────────┘
```
- **Background**: Yellow (`bg-yellow-50`)
- **Border**: Yellow (`border-yellow-200`)
- **Icon**: Crown 👑

## Interaction States

### 1. Collapsed Node (Has Children)
```
› [B] Bob Smith (Co-Coach)                 👤 3
  └── bob@example.com
```
- **Chevron**: Right-pointing (`›`)
- **State**: Children hidden

### 2. Expanded Node (Has Children)
```
∨ [B] Bob Smith (Co-Coach)                 👤 3
│ └── bob@example.com
│
├── [C] Charlie Brown                      88%
│   └── charlie@example.com
```
- **Chevron**: Down-pointing (`∨`)
- **State**: Children visible
- **Children**: Indented 24px

### 3. Leaf Node (No Children)
```
   [C] Charlie Brown                       88%
   └── charlie@example.com
```
- **Chevron**: None (placeholder space)
- **State**: No children to expand

### 4. Hover State
```
┌──────────────────────────────────────────────┐
│ › [B] Bob Smith (Co-Coach)              👤 3 │ ← Shadow on hover
└──────────────────────────────────────────────┘
```
- **Effect**: Box shadow increases
- **Cursor**: Pointer
- **Background**: Slight brightening

## Discipline Scores Integration (Optional)

When `showDisciplineScores={true}`:

```
┌──────────────────────────────────────────────┐
│ [C] Charlie Brown                        88% │
│     charlie@example.com                      │
│                                         SCORE│
└──────────────────────────────────────────────┘
```

Score colors:
- **Green** (≥80%): `text-green-600`
- **Yellow** (60-79%): `text-yellow-600`
- **Red** (<60%): `text-red-600`

## Indentation Levels

```
Level 0 (Root):
[M] Main Coach
└── 0px indent

  Level 1 (Direct Reports):
  [B] Bob Smith
  └── 24px indent

    Level 2 (Sub-team):
    [C] Charlie Brown
    └── 48px indent

      Level 3 (Deep nesting):
      [D] Diana Prince
      └── 72px indent
```

## Responsive Behavior

### Mobile (< 640px)
- Full-width cards
- Touch-friendly tap targets (min 44px)
- Smaller text on badges
- Compact spacing

### Tablet (640-1024px)
- Slightly wider cards
- Balanced spacing
- Standard text sizes

### Desktop (> 1024px)
- Max-width container (3xl = 768px)
- Centered layout
- Comfortable spacing
- Hover effects enabled

## Animation Details

### Expand Animation
```
Initial: height: 0, opacity: 0
Animate: height: auto, opacity: 1
Duration: 200ms
Easing: ease-out
```

### Collapse Animation
```
Initial: height: auto, opacity: 1
Exit: height: 0, opacity: 0
Duration: 200ms
Easing: ease-in
```

### Card Hover
```
Transform: scale(1.01)
Shadow: shadow-md
Duration: 150ms
```

## Empty States

### No Hierarchy Data
```
┌─────────────────────────────────────────┐
│                                         │
│            👥 (Large icon)              │
│                                         │
│        No team structure found          │
│                                         │
│         [Retry Button]                  │
│                                         │
└─────────────────────────────────────────┘
```

### Loading State
```
┌─────────────────────────────────────────┐
│                                         │
│          ⏳ (Spinning loader)           │
│                                         │
│        Loading team hierarchy...        │
│                                         │
└─────────────────────────────────────────┘
```

## Click Actions

### Node Click
1. **My Teams Tab**: Filter by clicked coach
2. **Detail View**: Show member discipline details
3. **Navigation**: Navigate to member profile

### Chevron Click
1. **Expand**: Show children with animation
2. **Collapse**: Hide children with animation
3. **State**: Toggle expanded state

### Expand All
1. Collect all node IDs with children
2. Add to expanded set
3. Trigger re-render

### Collapse All
1. Clear expanded set
2. Trigger re-render
3. All nodes collapsed

## Example Hierarchy Structures

### Simple 2-Level
```
Main Coach
├── Member A
├── Member B
└── Member C
```

### 3-Level with Co-Coach
```
Main Coach
├── Co-Coach Bob
│   ├── Member C
│   └── Member D
├── Member E
└── Member F
```

### Complex Multi-Level
```
Main Coach
├── Co-Coach Bob
│   ├── Co-Coach Eve
│   │   ├── Member X
│   │   └── Member Y
│   ├── Member C
│   └── Member D
├── Co-Coach Alice
│   ├── Member G
│   └── Member H
└── Member F
```

## Performance Tips

1. **Lazy Load**: Only load visible nodes
2. **Virtual Scrolling**: For >100 nodes
3. **Memoization**: Cache computed values
4. **Debounce**: Search and filter operations
5. **Skeleton Loading**: Show structure while loading

## Accessibility

- **ARIA Labels**: Screen reader support
- **Keyboard Navigation**: Tab through nodes
- **Focus Indicators**: Clear focus states
- **Color Contrast**: WCAG AA compliant
- **Touch Targets**: Minimum 44x44px
