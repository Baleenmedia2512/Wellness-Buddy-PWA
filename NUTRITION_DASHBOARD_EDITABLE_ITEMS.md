# Nutrition Dashboard - Editable Food Items Feature

## Overview
Added the ability to edit food items directly within the Nutrition Dashboard meal detail modal, matching the functionality available in NutritionCard.

## Features Implemented

### 1. **Editable Food Items**
- Users can click the edit icon on any food item to enter edit mode
- Search and replace misidentified foods
- Adjust serving sizes and portions
- All changes automatically recalculate total nutrition

### 2. **Dynamic Modal Resizing**
- Modal height: `80vh` by default
- Expands to `90vh` when any food item is being edited
- Ensures search results and serving dropdowns are fully visible

### 3. **Real-time Nutrition Updates**
- Total calories, protein, carbs, fat, and fiber update instantly
- Macro badges in modal header reflect current totals
- Changes are calculated from all food items

### 4. **Save Changes to Database**
- Save/Cancel buttons appear when any item is edited
- Updates stored in `food_nutrition_data_table`
- Changes persist across dashboard and all views
- Daily stats automatically refresh after save

## Technical Implementation

### Files Modified

#### 1. **NutritionDashboard.js**
**New State Variables:**
```javascript
const [localDetailedItems, setLocalDetailedItems] = useState([]);
const [localNutrition, setLocalNutrition] = useState({});
const [isEditing, setIsEditing] = useState(false);
const [isSaving, setIsSaving] = useState(false);
const [editingStates, setEditingStates] = useState({});
```

**Key Functions:**
- `handleEditingChange(index, isItemEditing)` - Tracks which items are being edited
- `handleFoodUpdate(index, updatedFood)` - Updates food item and recalculates totals
- `recalculateTotals(items)` - Sums nutrition from all food items
- `handleSaveMealUpdates()` - Saves changes to database via API

**Changes:**
- Replaced static food item divs with `<EditableFoodItem>` components
- Added Save/Cancel buttons that appear when editing
- Dynamic modal height based on editing state
- Macro badges use `localNutrition` for real-time updates

#### 2. **EditableFoodItem.js**
**New Props:**
- `onEditingChange` - Optional callback to notify parent when editing state changes

**New Effect:**
```javascript
useEffect(() => {
  if (onEditingChange) {
    onEditingChange(index, isEditing);
  }
}, [isEditing, index, onEditingChange]);
```

#### 3. **update-nutrition-analysis.js** (New API)
**Endpoint:** `PUT /api/update-nutrition-analysis`

**Request Body:**
```javascript
{
  id: number,              // Meal ID
  analysisData: {
    foods: [{
      name: string,
      portion: string,
      weight_g: number,
      nutrition: { calories, protein, carbs, fat, fiber }
    }],
    total: { calories, protein, carbs, fat, fiber },
    confidence: string
  },
  totalCalories: number,
  totalProtein: number,
  totalCarbs: number,
  totalFat: number,
  totalFiber: number
}
```

**Response:**
```javascript
{
  success: boolean,
  message: string,
  data: { id, analysisData, nutrition }
}
```

## User Workflow

### Editing a Logged Meal:
1. Open Nutrition Dashboard
2. Click on any meal card to view details
3. Click edit icon on any food item
4. Search for a different food OR adjust serving size
5. Save changes (updates nutrition totals)
6. Click "Save Changes" button to persist to database
7. Modal updates and daily stats refresh

### Cancel Changes:
1. Click "Cancel" button
2. All changes are reverted to original values
3. Modal returns to view mode

## Data Flow

```
User clicks edit
  ↓
EditableFoodItem enters edit mode
  ↓
onEditingChange(index, true) → NutritionDashboard
  ↓
editingStates[index] = true
  ↓
isEditing = true (any item editing)
  ↓
Modal height → 90vh
  ↓
User modifies food item
  ↓
handleFoodUpdate(index, updatedFood)
  ↓
localDetailedItems[index] = updatedFood
  ↓
recalculateTotals(localDetailedItems)
  ↓
localNutrition updated
  ↓
Macro badges re-render with new totals
  ↓
User clicks "Save Changes"
  ↓
handleSaveMealUpdates()
  ↓
POST to /api/update-nutrition-analysis
  ↓
Database updated
  ↓
analyses state refreshed
  ↓
selectedMeal updated
  ↓
loadDailyStats() called
  ↓
Modal shows updated data
```

## Database Schema

**Table:** `food_nutrition_data_table`

**Updated Fields:**
- `AnalysisData` (JSON) - Contains foods array with updated items
- `TotalCalories` - Recalculated from all food items
- `TotalProtein` - Recalculated from all food items
- `TotalCarbs` - Recalculated from all food items
- `TotalFat` - Recalculated from all food items
- `TotalFiber` - Recalculated from all food items

## Error Handling

### API Errors:
- Network failures show alert message
- Database errors logged to console
- User-friendly error messages displayed
- isSaving state reset on error

### Validation:
- Required fields validated before save
- AnalysisData format verified
- Meal ID must exist

## UI/UX Features

### Visual Indicators:
- Edit icon appears on hover for each food item
- Save/Cancel buttons only visible when editing
- Loading spinner during save operation
- Disabled buttons during save (prevents double-submit)
- Modal expands smoothly when entering edit mode

### Responsive Design:
- Works on all screen sizes
- Modal adapts height based on content
- Scrollable food items list
- Touch-friendly buttons

## Testing Checklist

- [x] Edit single food item
- [x] Edit multiple food items
- [x] Cancel changes reverts to original
- [x] Save changes updates database
- [x] Nutrition totals update correctly
- [x] Modal height adjusts properly
- [x] Daily stats refresh after save
- [x] Error handling works
- [x] Disabled buttons during save
- [x] Search functionality in edit mode
- [x] Serving size adjustments work

## Future Enhancements

1. **Optimistic Updates** - Update UI before API response
2. **Undo/Redo** - Multi-level undo for edits
3. **Bulk Edit** - Edit multiple items at once
4. **Auto-save** - Save changes automatically after timeout
5. **Edit History** - Track all changes to meals
6. **Duplicate Detection** - Warn when adding duplicate foods

## Notes

- EditableFoodItem component is shared between NutritionCard and NutritionDashboard
- onEditingChange callback is optional (NutritionCard doesn't use it)
- Modal height change is inline style for precise control
- Local state (localDetailedItems, localNutrition) initialized from selectedMeal
- Changes only persist after clicking "Save Changes"

## Related Files

- `frontend/src/components/NutritionDashboard.js`
- `frontend/src/components/EditableFoodItem.js`
- `frontend/src/components/NutritionCard.js`
- `backend/pages/api/update-nutrition-analysis.js`
- `backend/utils/db.js`
