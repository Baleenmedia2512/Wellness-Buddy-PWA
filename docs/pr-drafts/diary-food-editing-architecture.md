# Diary Food Editing Architecture

## Component Hierarchy

```
Dashboard.js (Shell Layer)
│
├─ DiaryFeed Component
│  └─ FoodRow (displays meal name + calories)
│     └─ onClick → handleEntryOpen('food')
│
└─ Modal Layer (when food entry opened)
   │
   └─ FoodMealEditor (orchestration wrapper)
      │
      ├─ State Management
      │  ├─ foodEditState
      │  │  ├─ selectedMeal (meal metadata)
      │  │  ├─ localDetailedItems (array of editable items)
      │  │  ├─ localNutrition (totals)
      │  │  ├─ editingStates (per-item edit mode)
      │  │  ├─ isEditing (blocking flag)
      │  │  ├─ isSaving (network activity)
      │  │  └─ saveStatus (success/error indicator)
      │  │
      │  └─ foodUndoState
      │     └─ { [mealId]: { originalMeal, expiresAt } }
      │
      ├─ Hooks
      │  ├─ useMealMutations
      │  │  ├─ handleFoodUpdate (edit item)
      │  │  ├─ handleDeleteFoodItem (soft delete)
      │  │  ├─ handleRestoreFoodItem (undo)
      │  │  └─ handleDeleteMeal (delete all)
      │  │
      │  └─ useResolveUserId (auth)
      │
      ├─ MealAnalysisModal (full editing UI)
      │  └─ NutritionAnalysisPanel
      │     └─ EditableFoodItem (per-item component)
      │        ├─ Nutrition display (P/C/F/Fiber bars)
      │        ├─ Edit button → inline form
      │        └─ Delete button → soft delete
      │
      └─ UndoRow (deletion banner)
         ├─ Countdown timer (10 seconds)
         ├─ "Undo" button → handleRestoreFoodItem
         └─ Auto-expire → permanent deletion
```

## Data Flow

### Opening Food Entry
```
User clicks FoodRow
  ↓
handleEntryOpen(entry)
  ↓
Transform payload:
  diary.payload → meal object format
  ↓
parseAnalysisData(analysisData)
  → { detailedItems, nutrition }
  ↓
transformDbItemToEditable(items)
  → editable format with serving sizes
  ↓
setFoodEditState({ selectedMeal, localDetailedItems, ... })
  ↓
setOpenEntry({ kind: 'food' })
  ↓
Render FoodMealEditor
  ↓
Render MealAnalysisModal
  ↓
Display EditableFoodItem components
```

### Editing Food Item
```
User clicks "Edit" on food item
  ↓
handleEditingChange(index, true)
  → setFoodEditState({ ...prev, editingStates: { [index]: true } })
  ↓
Inline form appears
  ↓
User adjusts values
  ↓
User clicks outside / "Save"
  ↓
handleFoodUpdate(index, newValues)
  ↓
Optimistic update:
  setLocalDetailedItems([...items, newItem])
  ↓
Backend API: PUT /api/nutrition/update
  ↓
setIsSaving(false)
  setSaveStatus('success')
  ↓
Auto-hide success indicator (2s)
  ↓
reloadDiary()
```

### Deleting Food Item
```
User clicks trash icon on item
  ↓
handleDeleteFoodItem(itemId)
  ↓
Set deletingId (loading state)
  ↓
Backend API: DELETE /api/nutrition/item/{itemId}
  ↓
setFoodUndoState({
  [mealId]: {
    originalMeal: meal,
    expiresAt: Date.now() + 10000
  }
})
  ↓
Render UndoRow with countdown
  ↓
User Options:
  │
  ├─ Click "Undo"
  │  ↓
  │  handleRestoreFoodItem()
  │  ↓
  │  Backend API: POST /api/nutrition/restore/{itemId}
  │  ↓
  │  Remove from foodUndoState
  │  ↓
  │  reloadDiary()
  │
  └─ Wait 10 seconds
     ↓
     Timer expires
     ↓
     onExpire() → remove from foodUndoState
     ↓
     Permanent deletion
     ↓
     reloadDiary()
```

### Deleting Full Meal
```
User clicks "Delete Meal" button
  ↓
handleDeleteMeal(mealId)
  ↓
Backend API: DELETE /api/nutrition/meal/{mealId}
  ↓
setFoodUndoState({ [mealId]: { originalMeal, expiresAt } })
  ↓
Render UndoRow
  ↓
[Same undo flow as item deletion]
  ↓
On permanent delete:
  setOpenEntry(null)
  setFoodEditState(null)
  onMealDelete()
  reloadDiary()
```

## State Lifecycle

```
CLOSED → OPENING → EDITING → SAVING → SAVED → CLOSING → CLOSED
  ↑         ↓         ↓         ↓        ↓        ↓
  │    foodEditState  │    isSaving   saveStatus │
  │    initialized    │    = true     = success  │
  │                   │                           │
  └───────────────────┴───────────────────────────┘
           onClose / onMealDelete

DELETING → UNDO_PENDING → [RESTORED | PERMANENT_DELETE]
    ↓           ↓              ↓              ↓
deletingId  foodUndoState  restore API   expired
  set       with expiresAt    call        timer
```

## Hook Dependencies

```
FoodMealEditor
  │
  ├─ useMealMutations
  │  ├─ useMealItemMutations
  │  │  └─ API: nutrition/services/nutritionDashboard/*
  │  │
  │  └─ useMealDeleteMutations
  │     └─ API: nutrition/services/nutritionDashboard/*
  │
  └─ useResolveUserId
     └─ Determines target userId for mutations
```

## API Endpoints Used

| Endpoint | Method | Purpose | Used By |
|----------|--------|---------|---------|
| `/api/nutrition/update` | PUT | Update item nutrition | handleFoodUpdate |
| `/api/nutrition/item/{id}` | DELETE | Soft delete item | handleDeleteFoodItem |
| `/api/nutrition/restore/{id}` | POST | Restore deleted item | handleRestoreFoodItem |
| `/api/nutrition/meal/{id}` | DELETE | Delete full meal | handleDeleteMeal |
| `/api/nutrition/undo/{id}` | POST | Undo meal deletion | handleRestoreFoodItem |
| `/api/diary/list` | GET | Reload diary after changes | reloadDiary |

## Performance Optimizations

1. **Refs for DOM Access**
   - `itemRefs`: direct DOM manipulation for scroll/focus
   - `isAutoSaveUpdateRef`: prevent duplicate saves

2. **Debounced Auto-Save**
   - 350ms delay on edit blur
   - Prevents network spam during typing

3. **Optimistic Updates**
   - UI updates immediately
   - Reverted only on network error

4. **Lazy Modal Mounting**
   - FoodMealEditor only rendered when `openEntry.kind === 'food'`
   - State cleared on unmount

5. **Keyed Undo State**
   - Multiple concurrent undos supported
   - O(1) lookup by meal ID

## Error Handling

```
Network Failure
  ↓
catch block in mutation hook
  ↓
setError(errorMessage)
  ↓
Modal displays error banner
  ↓
Optimistic update reverted
  ↓
User can retry
```

## Testing Strategy

### Unit Tests (TODO)
- `FoodMealEditor` state management
- Undo expiry logic
- Data transformation functions

### Integration Tests (TODO)
- Full edit → save flow
- Delete → undo flow
- Delete → expiry flow
- Multi-item concurrent edits

### E2E Tests (TODO)
- Open food from diary
- Edit multiple items
- Delete with undo
- Delete full meal
- Network failure recovery

---

**Architecture Pattern**: Orchestration Wrapper + Hook Composition  
**Complexity**: Medium (reuses 90% existing patterns)  
**Maintainability**: High (follows VSA, single responsibility)
