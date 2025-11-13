# Quick Visual Reference - Weight Tab Horizontal Calendar

## What You'll See

### Desktop View
```
╔═════════════════════════════════════════════════════════════════════╗
║                         WEIGHT DASHBOARD                            ║
╠═════════════════════════════════════════════════════════════════════╣
║                                                                     ║
║  ◄   ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐   ►  ║
║      │ Sun │ │ Mon │ │ Tue │ │Wed 🟣│ │ Thu │ │ Fri │ │ Sat │      ║
║      │  9  │ │ 10  │ │ 11  │ │ 12  │ │ 13  │ │ 14  │ │ 15  │      ║
║      └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘      ║
║                                 •                                   ║
║                            (today dot)                              ║
║                                                                     ║
║  ┌────────────────────────────────────────────────────────────┐   ║
║  │  Current Weight                                    ⚖️       │   ║
║  │  72.5 kg                                          📈 +0.3kg │   ║
║  │  Today at 9:30 AM                                           │   ║
║  │                                                              │   ║
║  │  Entries: 12  |  Lowest: 71.8  |  Highest: 73.2           │   ║
║  └────────────────────────────────────────────────────────────┘   ║
║                                                                     ║
║  ┌────────────────────────────────────────────────────────────┐   ║
║  │          📷  Capture Weight from Scale                      │   ║
║  └────────────────────────────────────────────────────────────┘   ║
║                                                                     ║
║  Entries for Today:                                                ║
║  • 72.5 kg - 9:30 AM ─────── (+0.2 kg) 🔺                         ║
║  • 72.3 kg - 7:00 AM ─────── (-0.1 kg) 🔻                         ║
║                                                                     ║
╚═════════════════════════════════════════════════════════════════════╝
```

### Mobile View
```
╔═══════════════════════════════════════╗
║      WEIGHT DASHBOARD                 ║
╠═══════════════════════════════════════╣
║                                       ║
║ ← swipe to scroll →                  ║
║                                       ║
║ [7] [8] [9] │NOV│ [10] [11] [12🟣] […]║
║             vertical  (selected)      ║
║             month                     ║
║             label                     ║
║                                       ║
║ ┌───────────────────────────────┐    ║
║ │ Current Weight      ⚖️         │    ║
║ │ 72.5 kg             +0.3kg 📈 │    ║
║ │ Today                         │    ║
║ └───────────────────────────────┘    ║
║                                       ║
║ ┌───────────────────────────────┐    ║
║ │  📷  Capture Weight           │    ║
║ └───────────────────────────────┘    ║
║                                       ║
║ Entries for Today:                   ║
║ • 72.5 kg - 9:30 AM (+0.2) 🔺       ║
║ • 72.3 kg - 7:00 AM (-0.1) 🔻       ║
║                                       ║
╚═══════════════════════════════════════╝
```

## Color Legend

### Desktop Calendar Dates:
- **🟣 Purple Gradient:** Selected date (from-purple-400 to-indigo-500)
- **⬜ White/Gray:** Today (not selected) with white background
- **⚪ Light Gray:** Other past dates (clickable)
- **⚫ Grayed Out:** Future dates (disabled)
- **• Small Dot:** Today indicator (purple when not selected, white when selected)

### Month Separators:
```
┌────┐
│ N  │ ← Vertical text
│ O  │
│ V  │
└────┘
```
Appears between dates when month changes

## How It Works

### Navigation:
1. **Desktop:**
   - Click **◄** (left arrow) to go back 1 week
   - Click **►** (right arrow) to go forward 1 week
   - Click any date button to jump to that date

2. **Mobile:**
   - **Swipe left** to see earlier dates
   - **Swipe right** to see later dates
   - **Tap** any date to select it
   - Auto-scrolls to keep selected date centered

### Date States:
| State | Appearance | Action |
|-------|------------|--------|
| Selected | Purple gradient, white text | Currently viewing |
| Today | White bg, gray text, purple dot | Click to select |
| Past | Light gray bg, gray text | Click to select |
| Future | Very light gray, disabled | Cannot select |
| Month Change | Vertical text separator | Visual indicator |

## Entry Filtering

### When Date Has Entries:
```
Entries for Today:
├─ 72.5 kg - 9:30 AM
├─ 72.3 kg - 7:00 AM
└─ 71.8 kg - 6:00 AM
```

### When Date Has NO Entries:
```
Recent Entries:
├─ 72.5 kg - Nov 12 (Yesterday)
├─ 72.3 kg - Nov 11
└─ 71.8 kg - Nov 10
```
Shows last 10 entries from entire history

## Example Scenarios

### Scenario 1: Viewing Today (Wednesday Nov 12)
```
Desktop Calendar Shows:
Sun 9 | Mon 10 | Tue 11 | [Wed 12] | Thu 13 | Fri 15 | Sat 16
                          ↑ selected   (future dates disabled →)

Entries Section:
"Entries for Today"
• All entries from Nov 12, 2025
```

### Scenario 2: Viewing Last Week (Wednesday Nov 5)
```
Desktop Calendar Shows:
Sun 2 | Mon 3 | Tue 4 | [Wed 5] | Thu 6 | Fri 7 | Sat 8
                        ↑ selected

Entries Section:
"Entries for Wed, Nov 5"
• All entries from Nov 5, 2025
```

### Scenario 3: Month Transition (Nov 30 → Dec 1)
```
Desktop Calendar Shows:
Fri 28 | Sat 29 | [Sun 30] │DEC│ Mon 1 | Tue 2 | Wed 3
                  ↑ selected  ↑ month separator
```

## Comparison with Nutrition Tab

Both tabs now use **identical calendar design**:

| Feature | Nutrition Tab | Weight Tab |
|---------|--------------|------------|
| Layout | Horizontal week | ✅ Horizontal week |
| Days Shown | 7 (-3 to +3) | ✅ 7 (-3 to +3) |
| Mobile View | 21-day scroll | ✅ 21-day scroll |
| Month Separators | Yes | ✅ Yes |
| Today Indicator | Dot | ✅ Dot |
| Auto-scroll | Yes | ✅ Yes |
| **Color Theme** | 🟢 Emerald/Teal | 🟣 **Purple/Indigo** |

**Only difference:** Color scheme!

## Testing Quick Checklist

Run through these to verify everything works:

### Desktop:
- [ ] Can see 7 days at once
- [ ] Left arrow goes back 1 week
- [ ] Right arrow goes forward (stops at today)
- [ ] Click date changes view
- [ ] Purple gradient on selected date
- [ ] Small dot shows on today
- [ ] Month separator appears when crossing months

### Mobile:
- [ ] Can swipe through dates
- [ ] Selected date auto-scrolls to center
- [ ] Tap date selects it
- [ ] Purple gradient visible

### Data:
- [ ] Shows "Entries for [Date]" when date has data
- [ ] Shows "Recent Entries" when date has no data
- [ ] Weight entries match selected date
- [ ] Capture button works from any date

---

**Ready to test!** 🚀

Open Dashboard → Weight tab and you'll see the beautiful horizontal week calendar just like in the Nutrition tab!
