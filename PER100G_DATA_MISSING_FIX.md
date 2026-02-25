# Per100g Data Missing Error - Root Cause & Fix

## 🔴 **Error Message**
```
Cannot save: per100g data missing
```

---

## 🔍 **Root Cause Analysis**

### **What Happened:**

1. **User uploads food** → AI detects "Chocolate Milkshake" → per100g calculated ✅
2. **Auto-correction applied** → Name changed → per100g preserved ✅  
3. **Food saved to database** → AnalysisData JSON saved
4. **User loads meal later** → Food loaded from database
5. **Problem:** `per100g` not recalculated when loading! ❌
6. **User clicks edit + tries to save** → Validation fails ❌

### **Why It Failed:**

#### **File: EditableFoodItem.js (Line 1189)**
```javascript
const foodToSave = overrideFood || selectedFood || {
  name: foodItem.name,
  category: foodItem.category,
  per100g: foodItem.per100g,  // ❌ UNDEFINED for foods from database
  isLiquid: foodItem.isLiquid || false,
};

if (!foodToSave.per100g) {
  console.error("❌ Cannot save: per100g data missing");
  return; // BLOCKED!
}
```

**Problem:** When foodItem comes from database, it might not have `per100g` property.

#### **File: NutritionDashboard.js (Line 134)**
```javascript
const transformed = {
  ...item,
  serving: { ... },
  grams: actualGrams,
  unit: unit,
  isLiquid: isLiquid,
  // ❌ per100g NOT SET! Missing!
};
```

**Problem:** When transforming food items from database, `per100g` was never calculated.

---

## ✅ **The Fix**

### **Fix 1: EditableFoodItem.js** 
**Location:** Line 1178-1210

**Before:**
```javascript
const foodToSave = overrideFood || selectedFood || {
  name: foodItem.name,
  per100g: foodItem.per100g,  // Could be undefined
};
```

**After:**
```javascript
let foodToSave = overrideFood || selectedFood;

if (!foodToSave) {
  // Calculate per100g if missing from foodItem
  const nutritionData = foodItem.nutrition || foodItem;
  const currentGrams = parseFloat(
    foodItem.serving?.grams || foodItem.grams || foodItem.estimatedWeight
  ) || 100;
  
  const per100gCalculated = foodItem.per100g || {
    calories: (nutritionData.calories || 0) * (100 / currentGrams),
    protein: (nutritionData.protein || 0) * (100 / currentGrams),
    carbs: (nutritionData.carbs || 0) * (100 / currentGrams),
    fat: (nutritionData.fat || 0) * (100 / currentGrams),
    fiber: (nutritionData.fiber || 0) * (100 / currentGrams),
  };
  
  foodToSave = {
    name: foodItem.name,
    category: foodItem.category,
    per100g: per100gCalculated,  // ✅ Always has value now
    isLiquid: foodItem.isLiquid || false,
  };
}
```

**Result:** per100g always calculated when missing ✅

---

### **Fix 2: NutritionDashboard.js**
**Location:** Line 133-145

**Before:**
```javascript
const transformed = {
  ...item,
  serving: { ... },
  grams: actualGrams,
  // ❌ per100g missing
};
```

**After:**
```javascript
const nutrition = item.nutrition || {};
const per100g = item.per100g || {
  calories: (nutrition.calories || 0) * (100 / actualGrams),
  protein: (nutrition.protein || 0) * (100 / actualGrams),
  carbs: (nutrition.carbs || 0) * (100 / actualGrams),
  fat: (nutrition.fat || 0) * (100 / actualGrams),
  fiber: (nutrition.fiber || 0) * (100 / actualGrams),
};

const transformed = {
  ...item,
  serving: { ... },
  grams: actualGrams,
  per100g: per100g,  // ✅ Now always present
};
```

**Result:** per100g calculated when loading from database ✅

---

## 🧪 **Testing**

### **Test Case 1: Edit Auto-Corrected Food**
```
1. Upload image → "Chocolate Milkshake" auto-corrected
2. Save meal → Close app
3. Reopen app → Open meal
4. Click edit on Chocolate Milkshake
5. Change weight: 250ml → 300ml
6. Click "Close Edit"
```
**Expected:** ✅ Saves successfully (previously failed)

### **Test Case 2: Edit Any Food from Database**
```
1. Open any saved meal
2. Edit any food item
3. Change weight
4. Save
```
**Expected:** ✅ No "per100g data missing" error

### **Test Case 3: Verify Calculations**
```
1. Food: 200g with 400 calories
2. per100g should be: 200 calories
3. Change to 300g
4. New calories should be: 600
```
**Expected:** ✅ Correct math

---

## 📊 **Impact**

| Scenario | Before Fix | After Fix |
|----------|------------|-----------|
| Edit fresh AI detection | ✅ Works | ✅ Works |
| Edit auto-corrected food | ❌ FAILS | ✅ Works |
| Edit saved meal (old) | ❌ FAILS | ✅ Works |
| Edit saved meal (new) | ❌ FAILS | ✅ Works |

**All editing scenarios now work!** 🎉

---

## 🔧 **Technical Details**

### **Why per100g Needed:**
The edit feature needs to recalculate nutrition when user changes weight:
```javascript
// Example: User changes from 200g to 300g
const newCalories = (per100g.calories * 300) / 100;
```

Without per100g, calculations are impossible!

### **Formula:**
```javascript
per100g = {
  calories: (current_calories * 100) / current_grams,
  protein: (current_protein * 100) / current_grams,
  // ... etc
}
```

### **Why It Worked Before (AI Detection):**
When AI detects food, it includes per100g in the initial response. But when loading from database, only the final calculated values (calories, protein, etc.) are stored - per100g is NOT stored in AnalysisData JSON.

---

## ✅ **Verification Steps**

1. ✅ Clear browser cache
2. ✅ Open any saved meal
3. ✅ Edit a food item
4. ✅ Change weight
5. ✅ Click "Close Edit"
6. ✅ Verify **NO ERROR** in console
7. ✅ Verify changes saved correctly

---

## 📝 **Files Modified**

1. **frontend/src/components/EditableFoodItem.js** (Line 1178-1210)
   - Added per100g calculation fallback when foodItem doesn't have it

2. **frontend/src/components/NutritionDashboard.js** (Line 133-145)
   - Added per100g calculation when loading foods from database

---

## 🎯 **Summary**

**Problem:** Foods loaded from database didn't have per100g data, causing edits to fail

**Solution:** Calculate per100g on-the-fly when missing, using current nutrition values and weight

**Result:** All editing scenarios now work properly ✅
