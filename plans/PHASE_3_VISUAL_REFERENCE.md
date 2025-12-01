# 🎨 Phase 3: Visual States Reference

## Status Indicator Appearance

### 1. Idle (Hidden)
```
[No indicator shown]
```
- Default state
- Edit mode not active or no recent saves

---

### 2. Syncing
```
┌────────────────────────┐
│  ⟳  Syncing...        │  (Blue background)
└────────────────────────┘
```
- **Trigger**: When auto-save starts
- **Color**: Blue background (`bg-blue-50`)
- **Icon**: Rotating spinner
- **Text**: "Syncing..."
- **Duration**: Until save completes

---

### 3. Saved ✓
```
┌────────────────────────┐
│  ✓  Saved             │  (Green background)
└────────────────────────┘
```
- **Trigger**: After successful save
- **Color**: Green background (`bg-green-50`)
- **Icon**: Checkmark
- **Text**: "Saved"
- **Duration**: 1.5 seconds, then fades to idle
- **Animation**: Smooth fade-in and fade-out

---

### 4. Error ⚠️
```
┌────────────────────────┐
│  ⚠️  Failed to save    │  (Red background)
└────────────────────────┘
```
- **Trigger**: If save throws error
- **Color**: Red background (`bg-red-50`)
- **Icon**: Warning triangle
- **Text**: "Failed to save"
- **Duration**: Stays visible until resolved
- **Animation**: Shake on appear

---

## Complete UI Layout

### Edit Mode - With Status Indicator

```
┌─────────────────────────────────────────┐
│  🍗 Grilled Chicken Breast              │
│  Search or Edit Food...                 │
│                                         │
│  ┌─────────────────────────────┐       │
│  │  Serving Size: 1 breast ▼  │       │
│  └─────────────────────────────┘       │
│                                         │
│  ┌─────────────────────────────┐       │
│  │  Weight: [150]g             │       │
│  └─────────────────────────────┘       │
│                                         │
│  Nutrition Pills Here...                │
│                                         │
│  ┌────────────────────────────┐        │ ← Phase 3
│  │  ✓  Saved                 │        │   Status
│  └────────────────────────────┘        │   Indicator
│                                         │
│  ┌──────────┐  ┌──────────┐           │
│  │   Done   │  │  Cancel  │           │
│  └──────────┘  └──────────┘           │
└─────────────────────────────────────────┘
```

---

## State Transitions

### Normal Save Flow
```
User types weight
    ↓
Idle → Syncing (1s delay)
    ↓
Syncing → Saved ✓
    ↓
Saved ✓ → Idle (after 1.5s)
```

### Instant Save Flow (dropdown/food)
```
User selects food
    ↓
Idle → Syncing (150ms delay)
    ↓
Syncing → Saved ✓
    ↓
Saved ✓ → Idle (after 1.5s)
```

### Error Flow
```
User changes data
    ↓
Idle → Syncing
    ↓
Network error / validation fails
    ↓
Syncing → Error ⚠️
    ↓
Error ⚠️ → stays visible
```

---

## Color Palette

| State | Background | Border | Text | Icon |
|-------|-----------|--------|------|------|
| Syncing | `bg-blue-50` | `border-blue-200` | `text-blue-700` | Blue spinner |
| Saved | `bg-green-50` | `border-green-200` | `text-green-700` | Green ✓ |
| Error | `bg-red-50` | `border-red-200` | `text-red-700` | Red ⚠️ |

---

## Animation Details

### Syncing Spinner
```css
/* Continuous rotation */
animation: spin 1s linear infinite;
border: 2px solid blue;
border-top: 2px solid transparent;
```

### Saved Fade
```css
/* Fade in */
0ms: opacity 0, translateY(-4px)
300ms: opacity 1, translateY(0)

/* Hold */
1500ms delay

/* Fade out */
1500ms: opacity 1
1800ms: opacity 0
```

### Error Shake
```css
/* Shake animation */
0%: translateX(0)
25%: translateX(-4px)
50%: translateX(0)
75%: translateX(4px)
100%: translateX(0)
```

---

## Responsive Behavior

### Mobile (< 640px)
- Status indicator full width
- Buttons stack vertically if needed
- Touch-friendly tap targets (44px min)

### Desktop (≥ 640px)
- Status indicator centered
- Buttons side-by-side
- Hover states active

---

## Accessibility Features

### Screen Reader Announcements
```html
<div role="status" aria-live="polite">
  Syncing...
  Saved
  Failed to save
</div>
```

### Color Independence
- ✅ Icon conveys meaning
- ✅ Text conveys meaning
- ✅ Color enhances (not required)

### Keyboard Navigation
- Status is focusable for screen readers
- Doesn't trap focus
- Announces state changes

---

## Testing Visual States

### How to See Each State

**Syncing**:
1. Type in weight field
2. Immediately see blue spinner

**Saved**:
1. Type in weight field
2. Wait 1s
3. See green checkmark
4. Watch it fade after 1.5s

**Error**:
1. Disconnect internet
2. Try to change food
3. See red warning

---

## Code Snippets

### Trigger Syncing
```js
setSyncStatus('syncing');
```

### Trigger Saved
```js
setSyncStatus('saved');
setTimeout(() => setSyncStatus('idle'), 1500);
```

### Trigger Error
```js
setSyncStatus('error');
```

---

## Design Rationale

### Why Above Buttons?
- Most visible placement
- Doesn't interfere with editing
- Natural reading flow (top to bottom)

### Why 1.5 Second Fade?
- Long enough to read
- Short enough not to annoy
- Feels responsive

### Why Blue/Green/Red?
- **Blue**: Neutral, in-progress
- **Green**: Success, positive feedback
- **Red**: Error, needs attention
- Industry-standard color meanings

---

## Browser Compatibility

- ✅ Chrome/Edge (Chromium)
- ✅ Firefox
- ✅ Safari
- ✅ Mobile browsers
- ✅ PWA mode (Capacitor)

---

## Performance

- **Minimal re-renders**: Status uses independent state
- **GPU-accelerated**: CSS transforms and opacity
- **No layout thrashing**: Fixed height prevents reflow
- **Smooth 60fps**: Optimized animations

---

This visual reference can be shared with designers/stakeholders to show exactly what users will see! 🎨
