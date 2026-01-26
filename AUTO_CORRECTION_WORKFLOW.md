# Auto-Correction Workflow

## Overview

When a user uploads an image, the system now automatically applies their past food name corrections.

## Workflow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ 1. USER UPLOADS IMAGE                                       │
│    - Take photo or select from gallery                      │
└──────────────────────┬──────────────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. AI ANALYZES IMAGE                                        │
│    - Gemini AI detects: "Mango Shake"                       │
│    - Along with other foods in the image                    │
└──────────────────────┬──────────────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. CHECK FOOD_CORRECTIONS_TABLE                             │
│    - Query: SELECT * FROM food_corrections_table            │
│             WHERE UserId = <current_user_id>                │
│    - Find: "Mango Shake" → "Herbalife Formula 1"            │
│    - TimesCorrected: 5                                      │
└──────────────────────┬──────────────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. APPLY CORRECTIONS AUTOMATICALLY                          │
│    ✅ Match found: "Mango Shake" → "Herbalife Formula 1"   │
│    - Replace AI name with user's preferred name             │
│    - Store original AI name for reference                   │
│    - Mark as auto-corrected                                 │
└──────────────────────┬──────────────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. SHOW CORRECTED NAME TO USER                              │
│    - Display: "Herbalife Formula 1" (not "Mango Shake")     │
│    - User sees their preferred name immediately ✅          │
│    - No need to manually edit again                         │
└─────────────────────────────────────────────────────────────┘
```

## Example Scenarios

### Scenario 1: User Has Correction History

```
AI Detects:     "Mango Shake"
User History:   "Mango Shake" → "Herbalife Formula 1" (corrected 5 times)
Result Shown:   "Herbalife Formula 1" ✅
```

### Scenario 2: No Correction History

```
AI Detects:     "Butter Chicken"
User History:   (no correction for this food)
Result Shown:   "Butter Chicken" (original AI detection)
```

### Scenario 3: Multiple Foods with Corrections

```
AI Detects:     ["Naan", "Butter Chicken", "Yellow Rice"]
User History:
  - "Naan" → "Whole Wheat Chapathi" (corrected 3 times)
  - "Yellow Rice" → "Lemon Rice" (corrected 2 times)
Result Shown:   ["Whole Wheat Chapathi", "Butter Chicken", "Lemon Rice"] ✅
```

## Implementation Files Modified

### 1. `frontend/src/services/foodCorrectionService.js`

**New Function:** `applyUserCorrections(foods, userId)`

- Fetches user's correction history from database
- Creates a map of AI names → User corrected names
- Applies corrections to detected foods
- Logs all corrections applied

**Lines:** ~80-165

### 2. `frontend/src/App.js`

**Import Added:**

```javascript
import { applyUserCorrections } from "./services/foodCorrectionService";
```

**Code Modified:** After AI detection (line ~1303)

```javascript
let foods = detectedType.details.foods;

// 🎯 APPLY USER'S PAST CORRECTIONS AUTOMATICALLY
try {
  const userId = user?.id || (await getUserId(user));
  if (userId) {
    foods = await applyUserCorrections(foods, userId);
  }
} catch (error) {
  console.warn(
    "⚠️ Failed to apply corrections, using original AI detection:",
    error,
  );
}
```

## Console Logs to Watch

### When Corrections Are Applied:

```
🔄 [AUTO-CORRECT] Fetching user corrections for userId: 339
📝 [AUTO-CORRECT] Found 5 corrections in database
✅ [AUTO-CORRECT] Applying correction: "Mango Shake" → "Herbalife Formula 1" (corrected 5x)
✅ [AUTO-CORRECT] Applying correction: "Naan" → "Whole Wheat Chapathi" (corrected 3x)
🎯 [AUTO-CORRECT] Applied 2 automatic corrections
```

### When No Corrections Found:

```
🔄 [AUTO-CORRECT] Fetching user corrections for userId: 339
📝 [AUTO-CORRECT] No corrections found for this user
```

## Database Query Used

The system queries:

```sql
SELECT
  "AiDetected",
  "UserCorrected",
  "TimesCorrected"
FROM food_corrections_table
WHERE "UserId" = ?
ORDER BY "TimesCorrected" DESC, "LastCorrected" DESC
LIMIT 10
```

## Benefits

✅ **Faster Workflow** - No need to manually correct same foods repeatedly
✅ **Personalized** - Learns each user's preferences individually
✅ **Transparent** - Logs show exactly what was corrected
✅ **Fallback Safe** - If correction fails, shows original AI detection
✅ **Non-intrusive** - Only applies if correction history exists

## Testing Steps

1. **First Time:**
   - Upload image with "Mango Shake"
   - AI shows "Mango Shake"
   - Edit to "Herbalife Formula 1"
   - Save correction ✅

2. **Second Time:**
   - Upload DIFFERENT image with "Mango Shake"
   - System auto-applies correction
   - Shows "Herbalife Formula 1" immediately ✅

3. **Check Console:**
   - See auto-correction logs
   - Verify correct name is applied

## Future Enhancements

- [ ] Show indicator when name was auto-corrected
- [ ] Allow user to revert auto-correction
- [ ] Confidence threshold for auto-corrections
- [ ] Fuzzy matching for similar names
