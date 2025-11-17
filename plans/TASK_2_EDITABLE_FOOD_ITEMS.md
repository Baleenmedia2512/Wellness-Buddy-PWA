# Task 2: Editable Food Items ✏️

**Duration:** 4 days 
**Priority:** Medium  
**Release Target:** Day 5 (Thursday, 27th Nov)  
**Version:** v1.4.0  
**Dependencies:** Task 1 (Brand Detection) completed

---

## **Problem Statement**

Even with improved AI detection, users cannot:
- ❌ Correct AI misidentifications without deleting entire meal
- ❌ Adjust portion sizes after saving
- ❌ Replace one food item with another
- ❌ Fix obvious mistakes in nutrition data

**Current Limitation:** Only option is delete entire meal → re-analyze → lose timestamp

**User Impact:**
- Frustration with AI errors
- Data inaccuracy 
- Lost historical data when deleting meals
- Support requests for manual editing

---

## **Goal**

Allow users to edit individual food items within saved meals:
- ✅ Search for replacement food using Gemini AI
- ✅ Adjust serving sizes and gram amounts
- ✅ See real-time nutrition updates
- ✅ Save changes with automatic total recalculation
- ✅ Maintain data integrity across database and UI

**Target Adoption:** >30% of users edit at least one item in first week

---

## **Solution Overview**

### **Core Concept: Gemini-Powered Food Search**

Instead of maintaining a food database, leverage Gemini API as a dynamic search engine:

```
User Flow:
Click Edit → Search Food → Select Result → Adjust Serving → Preview → Save → Recalculate
```

### **Key Features**

1. **Inline Editing** - Edit without leaving the meal detail view
2. **AI Search** - Gemini returns 3-5 food variations with nutrition
3. **Flexible Serving** - Preset options + custom grams
4. **Real-time Preview** - See nutrition before saving
5. **Optimistic Updates** - Instant UI feedback
6. **Data Integrity** - Transaction-safe database updates

---

## **User Experience Flow**

### **Step-by-Step Interaction**

#### **1. View Meal Detail**
```
User opens meal from dashboard:
┌─────────────────────────────────────┐
│ Breakfast - 8:30 AM                  │
│ 450 calories                         │
├─────────────────────────────────────┤
│ Food Breakdown:                      │
│                                      │
│ [Herbalife Shake] 180 cal    [✏️]   │
│ [2 Idlis]         150 cal    [✏️]   │
│ [Sambar]          120 cal    [✏️]   │
└─────────────────────────────────────┘
```

#### **2. Click Edit**
```
User clicks ✏️ on "Herbalife Shake":
┌─────────────────────────────────────┐
│ Edit Food Item                       │
├─────────────────────────────────────┤
│ 🔍 Search: Herbalife Shake_         │
│                              [×]     │
└─────────────────────────────────────┘
```

#### **3. Search for Replacement**
```
User types "mango lassi":
┌─────────────────────────────────────┐
│ 🔍 Search: mango lassi_      [⌛]   │
├─────────────────────────────────────┤
│ 📋 Search Results:                   │
│                                      │
│ ○ Mango Lassi (Homemade)            │
│   150 cal per 1 glass (240ml)       │
│   homemade_drink                     │
│                                      │
│ ○ Mango Lassi (Sweet, Thick)        │
│   180 cal per 1 glass (240ml)       │
│   homemade_drink                     │
│                                      │
│ ○ Mango Smoothie                     │
│   120 cal per 1 cup (250ml)         │
│   homemade_drink                     │
└─────────────────────────────────────┘
```

#### **4. Select & Adjust Serving**
```
User selects "Mango Lassi (Homemade)":
┌─────────────────────────────────────┐
│ Selected: Mango Lassi (Homemade)    │
├─────────────────────────────────────┤
│ Quick Select Serving:                │
│ ○ 1 small glass (200ml) - 125 cal   │
│ ○ 1 glass (240ml) - 150 cal         │
│ ○ 1 large glass (360ml) - 225 cal   │
├─────────────────────────────────────┤
│ Custom Amount:                       │
│ Servings: [1.5]    Or Grams: [360]  │
├─────────────────────────────────────┤
│ 📊 Updated Nutrition:                │
│ 225 cal · 7.5g protein               │
│ 33g carbs · 4.5g fat                 │
└─────────────────────────────────────┘
[✓ Save Changes]  [✗ Cancel]
```

#### **5. Save & Recalculate**
```
After saving:
┌─────────────────────────────────────┐
│ Breakfast - 8:30 AM                  │
│ 495 calories (+45)          ↻        │
├─────────────────────────────────────┤
│ Food Breakdown:                      │
│                                      │
│ [Mango Lassi]     225 cal    [✏️]   │ ← Updated
│ [2 Idlis]         150 cal    [✏️]   │
│ [Sambar]          120 cal    [✏️]   │
└─────────────────────────────────────┘
```

---

## **Technical Architecture**

### **Component Structure**

```
NutritionDashboard.js
  └── Modal (Meal Detail)
        └── EditableFoodItem.js (NEW)
              ├── SearchInput
              ├── SearchResults
              ├── ServingControls
              └── NutritionPreview

geminiService.js
  └── searchFood() (NEW METHOD)

Backend API
  └── /api/update-nutrition-item (NEW ENDPOINT)
```

---

## **New Components**

### **1. EditableFoodItem.js**

**Purpose:** Self-contained edit component for each food item

**State Management (12+ variables):**
```javascript
const [isEditing, setIsEditing] = useState(false);
const [searchQuery, setSearchQuery] = useState(item.name);
const [searchResults, setSearchResults] = useState([]);
const [isSearching, setIsSearching] = useState(false);
const [selectedFood, setSelectedFood] = useState(null);
const [servingMultiplier, setServingMultiplier] = useState(1);
const [customGrams, setCustomGrams] = useState(null);
const [previewNutrition, setPreviewNutrition] = useState(null);
// ... more states
```

**Key Methods:**
- `handleSearch()` - Debounced Gemini API call
- `handleSelectFood()` - Populate serving options
- `calculateNutrition()` - Recalculate based on serving
- `handleSave()` - Update parent + backend
- `handleCancel()` - Reset to original state

**Props:**
```javascript
<EditableFoodItem
  item={foodItem}           // Current food object
  index={itemIndex}         // Array position
  onUpdate={handleUpdate}   // Callback when saved
  onCancel={handleCancel}   // Callback when cancelled
/>
```

---

### **2. Gemini Search Method**

**File:** `frontend/src/services/geminiService.js`

**New Method:**
```javascript
async searchFood(foodQuery) {
  const prompt = `
    Search for nutrition information: "${foodQuery}"
    
    Provide 3-5 most common variations with serving options.
    
    Return JSON:
    {
      "results": [
        {
          "name": "Mango Lassi (Homemade)",
          "category": "homemade_drink",
          "defaultServing": {
            "description": "1 glass",
            "grams": 240,
            "nutrition": {
              "calories": 150,
              "protein": 5,
              "carbs": 22,
              "fat": 3,
              "fiber": 0
            }
          },
          "servingOptions": [
            {
              "description": "1 small glass (200ml)",
              "grams": 200,
              "nutrition": { ... }
            },
            {
              "description": "1 large glass (360ml)",
              "grams": 360,
              "nutrition": { ... }
            }
          ],
          "per100g": {
            "calories": 63,
            "protein": 2,
            "carbs": 9,
            "fat": 1.3,
            "fiber": 0
          }
        },
        ...more results
      ]
    }
    
    Use USDA/standard nutrition values.
    Return valid JSON only.
  `;
  
  const result = await this.model.generateContent(prompt);
  const response = await result.response;
  const text = response.text();
  
  return this.parseJsonResponse(text);
}
```

---

### **3. Backend API Endpoint**

**File:** `backend/pages/api/update-nutrition-item.js` (NEW)

**Endpoint:** `PUT /api/update-nutrition-item`

**Request Body:**
```json
{
  "analysisId": 12345,
  "analysisData": {
    "foods": [
      {
        "name": "Mango Lassi (Homemade)",
        "portion": "1.5 glass",
        "weight_g": 360,
        "nutrition": { ... }
      },
      { ... }
    ],
    "total": {
      "calories": 495,
      "protein": 22,
      "carbs": 68,
      "fat": 12,
      "fiber": 8
    },
    "isEdited": true,
    "editedAt": "2025-11-14T10:30:00Z"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Nutrition item updated successfully"
}
```

**Database Updates:**
```sql
UPDATE food_nutrition_data_table SET
  AnalysisData = ?,           -- JSON with edited foods
  TotalCalories = ?,          -- Recalculated
  TotalProtein = ?,           -- Recalculated
  TotalCarbs = ?,             -- Recalculated
  TotalFat = ?,               -- Recalculated
  TotalFiber = ?,             -- Recalculated
  ProcessedBy = CONCAT(ProcessedBy, '_edited')  -- Mark as edited
WHERE ID = ?
```

---

## **Data Flow**

### **Complete Edit Flow**

```
[1] User clicks ✏️
    ↓
[2] Component enters edit mode
    ↓
[3] User types search query (debounced 500ms)
    ↓
[4] Call geminiService.searchFood(query)
    ↓
[5] Display search results
    ↓
[6] User selects food
    ↓
[7] Show serving options
    ↓
[8] User adjusts serving (real-time recalc)
    ↓
[9] User clicks Save
    ↓
[10] Calculate final nutrition
    ↓
[11] Update local state (OPTIMISTIC)
    ↓
[12] Call backend API
    ↓
[13] Database transaction
    ↓
[14] Return success
    ↓
[15] Recalculate meal totals
    ↓
[16] Refresh daily stats
    ↓
[17] Show success message
```

---

## **Key Algorithms**

### **Nutrition Recalculation**

```javascript
function calculateNutrition(food, servingMultiplier, customGrams) {
  // Determine base grams
  const baseGrams = customGrams || (food.defaultServing.grams * servingMultiplier);
  
  // Calculate ratio from per100g base
  const ratio = baseGrams / 100;
  
  // Apply ratio to per100g nutrition
  return {
    name: food.name,
    portion: customGrams 
      ? `${customGrams}g`
      : `${servingMultiplier} ${food.defaultServing.description}`,
    weight_g: baseGrams,
    nutrition: {
      calories: Math.round(food.per100g.calories * ratio),
      protein: Math.round(food.per100g.protein * ratio * 10) / 10,
      carbs: Math.round(food.per100g.carbs * ratio * 10) / 10,
      fat: Math.round(food.per100g.fat * ratio * 10) / 10,
      fiber: Math.round(food.per100g.fiber * ratio * 10) / 10
    }
  };
}
```

### **Total Recalculation**

```javascript
function recalculateTotals(updatedItems) {
  return updatedItems.reduce((acc, item) => ({
    calories: acc.calories + (item.nutrition.calories || 0),
    protein: acc.protein + (item.nutrition.protein || 0),
    carbs: acc.carbs + (item.nutrition.carbs || 0),
    fat: acc.fat + (item.nutrition.fat || 0),
    fiber: acc.fiber + (item.nutrition.fiber || 0)
  }), { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });
}
```

### **Debounced Search**

```javascript
useEffect(() => {
  if (!isEditing || searchQuery.length < 2) return;
  
  const timer = setTimeout(async () => {
    setIsSearching(true);
    try {
      const results = await geminiService.searchFood(searchQuery);
      setSearchResults(results.results || []);
    } catch (error) {
      console.error('Search failed:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, 500); // Wait 500ms after typing stops
  
  return () => clearTimeout(timer);
}, [searchQuery, isEditing]);
```

---

## **Implementation Timeline**

### **Day 1: Component Development (8 hours)**

#### **Morning (4 hours)**
**9:00 - 10:30** | Gemini Search Method (1.5 hours)
- Add `searchFood()` to geminiService.js
- Write search prompt with serving options
- Test with 10+ food queries
- Handle JSON parsing errors

**10:30 - 12:00** | Component Structure (1.5 hours)
- Create EditableFoodItem.js file
- Set up state management (12+ states)
- Build basic UI layout
- Import necessary dependencies

**12:00 - 1:00** | Lunch Break

#### **Afternoon (4 hours)**
**1:00 - 3:00** | Search UI (2 hours)
- Implement search input with debounce
- Create search results dropdown
- Style for mobile responsiveness
- Add loading spinner
- Handle empty states

**3:00 - 5:00** | Result Selection (2 hours)
- Implement result click handler
- Populate serving options
- Create serving dropdown UI
- Add custom gram input
- Wire up state changes

---

### **Day 2: Serving Controls & Refinement (8 hours)**

#### **Morning (4 hours)**
**9:00 - 11:00** | Serving Size Controls (2 hours)
- Build preset serving buttons
- Implement serving multiplier input
- Add custom gram input
- Input validation (no negatives, no zero)
- Handle edge cases (very small/large)

**11:00 - 1:00** | Nutrition Recalculation (2 hours)
- Implement calculation algorithm
- Real-time preview updates
- Test accuracy with various portions
- Edge case handling (0.1 servings, 10+ servings)

**1:00 - 2:00** | Lunch Break

#### **Afternoon (4 hours)**
**2:00 - 5:00** | UI Refinement (3 hours)
- Loading states during search
- Error messages for failures
- Empty state when no results
- Success/cancel animations
- Mobile touch optimization
- Accessibility (ARIA labels, keyboard nav)

---

### **Day 3: Integration & Backend (8 hours)**

#### **Morning (4 hours)**
**9:00 - 11:00** | Backend API (2 hours)
- Create `/api/update-nutrition-item.js`
- Write database update query
- Implement transaction handling
- Add validation logic
- Test with Postman/curl

**11:00 - 1:00** | Dashboard Integration (2 hours)
- Import EditableFoodItem into NutritionDashboard.js
- Replace read-only food items
- Wire up onUpdate callback
- Handle state updates

**1:00 - 2:00** | Lunch Break

#### **Afternoon (4 hours)**
**2:00 - 4:00** | Save Flow Implementation (2 hours)
- Implement handleUpdateItem method
- Optimistic UI updates
- API call to backend
- Error handling & rollback
- Success feedback

**4:00 - 5:00** | Total Recalculation (1 hour)
- Update meal totals after edit
- Refresh daily stats
- Update dashboard display
- Test edge cases

**5:00 - 6:00** | Cancel Flow (1 hour)
- Implement cancel handler
- Reset component state
- No database changes
- UI restoration

---

### **Day 4: Testing & Deployment (4-8 hours)**

#### **Morning (4 hours)**
**9:00 - 12:00** | End-to-End Testing (3 hours)
- Test edit single item
- Test edit multiple items
- Test cancel mid-edit
- Test network failures
- Test invalid inputs
- Test on multiple devices
- Test on different screen sizes

**12:00 - 1:00** | Lunch Break

#### **Afternoon (2-4 hours)**
**1:00 - 3:00** | Bug Fixes (2 hours)
- Fix issues found in testing
- Handle edge cases
- Performance optimization
- Memory leak checks

**3:00 - 4:00** | Polish & Documentation (1 hour)
- Add smooth animations
- Improve accessibility
- Code comments
- User help text
- Build for production

**4:00 - 5:00** | Deployment (1 hour)
- Deploy frontend
- Deploy backend API
- Test on production
- Monitor logs

**5:00+** | Post-Deploy (Optional)
- Monitor user feedback
- Quick fixes if needed

---

## **Testing Strategy**

### **Unit Tests**

#### **Nutrition Calculation**
```javascript
test('calculates nutrition correctly for 1.5 servings', () => {
  const food = {
    per100g: { calories: 63, protein: 2 },
    defaultServing: { grams: 240 }
  };
  const result = calculateNutrition(food, 1.5, null);
  expect(result.nutrition.calories).toBe(227); // 63 * (240 * 1.5 / 100)
});

test('calculates nutrition correctly for custom grams', () => {
  const food = {
    per100g: { calories: 63, protein: 2 }
  };
  const result = calculateNutrition(food, 1, 300);
  expect(result.nutrition.calories).toBe(189); // 63 * (300 / 100)
});
```

#### **Input Validation**
```javascript
test('prevents negative serving values', () => {
  const input = -1;
  expect(validateServing(input)).toBe(false);
});

test('prevents zero gram values', () => {
  const input = 0;
  expect(validateGrams(input)).toBe(false);
});
```

---

### **Integration Tests**

#### **Search Flow**
```javascript
test('search returns results from Gemini', async () => {
  const results = await geminiService.searchFood('mango lassi');
  expect(results.results.length).toBeGreaterThan(0);
  expect(results.results[0]).toHaveProperty('name');
  expect(results.results[0]).toHaveProperty('per100g');
});
```

#### **Database Update**
```javascript
test('updates database correctly', async () => {
  const response = await fetch('/api/update-nutrition-item', {
    method: 'PUT',
    body: JSON.stringify({ analysisId: 123, analysisData: {...} })
  });
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.success).toBe(true);
});
```

---

### **User Scenario Tests**

#### **Scenario 1: Happy Path**
```
1. Open meal detail modal
2. Click edit on first item
3. Type "mango lassi" in search
4. Wait for results (should see 3-5 options)
5. Select first result
6. Adjust serving to 1.5
7. Verify preview shows updated nutrition
8. Click Save
9. Verify item updated in list
10. Verify totals recalculated
```
**Expected:** All steps succeed, data persists

---

#### **Scenario 2: Cancel Mid-Edit**
```
1. Click edit
2. Search for food
3. Select result
4. Adjust serving
5. Click Cancel
6. Verify no changes saved
7. Verify original item still displayed
```
**Expected:** No database changes, UI restored

---

#### **Scenario 3: Network Failure**
```
1. Start edit flow
2. Disconnect network
3. Try to save
4. Verify error message shown
5. Reconnect network
6. Retry save
7. Verify success
```
**Expected:** Graceful error handling, retry works

---

#### **Scenario 4: Invalid Input**
```
1. Edit item
2. Select food
3. Enter negative serving (-1)
4. Try to save
5. Verify validation prevents save
6. Enter valid serving (1.5)
7. Save succeeds
```
**Expected:** Validation catches invalid input

---

#### **Scenario 5: Multiple Edits**
```
1. Edit item 1 → Save
2. Edit item 2 → Save
3. Edit item 3 → Save
4. Verify all changes saved
5. Verify totals correct (sum of all items)
6. Verify daily stats updated
```
**Expected:** All edits persist, totals accurate

---

#### **Scenario 6: Mobile Touch**
```
1. Test on actual mobile device
2. Verify all buttons tappable (min 44x44px)
3. Verify keyboard doesn't obscure inputs
4. Verify dropdown scrollable on small screens
5. Verify animations smooth
```
**Expected:** Full functionality on mobile

---

### **Edge Cases**

- ✅ Search with 1 character (should not trigger)
- ✅ Search with special characters (!@#$%)
- ✅ Search returns 0 results
- ✅ Search returns 1 result only
- ✅ Very small portion (0.1 servings)
- ✅ Very large portion (20 servings)
- ✅ Custom grams = 1g
- ✅ Custom grams = 10000g
- ✅ Gemini API timeout
- ✅ Database connection lost
- ✅ User navigates away during edit
- ✅ Rapid clicks on save button
- ✅ Edit same item twice quickly
- ✅ Open edit on 2 devices simultaneously

---

## **Success Metrics**

### **Technical Metrics**
| Metric | Target | Measurement |
|--------|--------|-------------|
| **Search Response Time** | <3 seconds | 95th percentile |
| **Save Success Rate** | >99% | Errors / Total attempts |
| **Database Integrity** | 100% | No orphaned/corrupted records |
| **API Error Rate** | <1% | 4xx, 5xx responses |
| **Mobile Performance** | <5s total flow | Start edit → Save complete |

### **User Metrics**
| Metric | Target | Measurement |
|--------|--------|-------------|
| **Feature Adoption** | >30% | Users who edit ≥1 item |
| **Edits per User** | 2-3/week | Average for active editors |
| **Search Success** | >80% | Searches with selection |
| **Cancel Rate** | <20% | Cancels / Total edits |
| **User Satisfaction** | >4.0/5.0 | App store ratings mentioning edit |

---

## **Risk Assessment**

| Risk | Likelihood | Impact | Mitigation | Rollback |
|------|------------|--------|------------|----------|
| Complex state causes bugs | Medium | High | Thorough testing, code review | Feature flag disable |
| Database corruption | Low | Critical | Transactions, validation | Database restore |
| Search returns poor results | Medium | Medium | Fallback to manual entry | N/A (search optional) |
| Performance issues | Medium | Medium | Optimize rendering, lazy load | Feature flag disable |
| Concurrent edit conflicts | Low | Medium | Optimistic locking | Last-write-wins |
| Gemini API quota exceeded | Low | Medium | Monitor usage, cache results | Temporary disable search |

---

## **Rollback Plan**

### **Immediate Rollback (10 minutes)**

**If Critical Issue Detected:**

**Option 1: Feature Flag Disable**
```javascript
// In NutritionDashboard.js
const ENABLE_EDIT_FEATURE = false; // Toggle to disable

{ENABLE_EDIT_FEATURE && (
  <button onClick={() => setIsEditing(true)}>✏️</button>
)}
```

**Option 2: Code Revert**
- Revert Git commit
- Redeploy frontend
- Backend API remains (won't be called)

**Affected Systems:**
- Frontend: EditableFoodItem removed from UI
- Backend: API endpoint inactive (no calls)
- Database: Existing edited data unchanged

---

### **Partial Rollback**

**If Search Issues Only:**
- Keep edit UI
- Remove search functionality
- Allow manual nutrition entry only

**If Save Issues Only:**
- Keep search working
- Disable save button
- Users can browse but not persist

---

## **Deployment Checklist**

### **Pre-Deploy**
- [ ] All unit tests passing
- [ ] Integration tests passing
- [ ] End-to-end tests passing
- [ ] Code reviewed and approved
- [ ] Mobile testing complete
- [ ] Performance benchmarks met
- [ ] Security review passed

### **Deploy Steps**
1. [ ] Deploy backend API first
2. [ ] Test API endpoint with Postman
3. [ ] Deploy frontend with feature flag enabled
4. [ ] Smoke test in production
5. [ ] Monitor logs for 1 hour
6. [ ] Enable for 10% users (gradual rollout)
7. [ ] Monitor for 24 hours
8. [ ] Enable for 100% users

### **Post-Deploy**
- [ ] Watch error logs
- [ ] Monitor Gemini API usage
- [ ] Track database performance
- [ ] Gather user feedback
- [ ] Quick fixes if needed

---

## **Monitoring & Alerts**

### **Set Up Alerts For:**

**Critical Alerts (Immediate Action):**
- Database connection failures
- API error rate >5%
- Data corruption detected
- App crash rate >1%

**Warning Alerts (Check Within 1 Hour):**
- Search response time >5s
- Gemini API quota >80%
- Save success rate <95%
- High rollback rate (>10% cancels)

**Info Alerts (Daily Review):**
- Feature adoption rate
- Most searched foods
- Common edit patterns
- User feedback sentiment

---

## **Post-Release Activities**

### **Week 1: Monitoring**
- Daily log reviews
- User feedback analysis
- Performance optimization
- Quick bug fixes

### **Week 2-4: Optimization**
- Identify most searched foods
- Consider caching frequent searches
- Optimize database queries
- Refine UI based on usage patterns

### **Month 2+: Enhancements**
- Add "favorite foods" quick access
- Meal templates (save common meals)
- Barcode scanning integration
- Voice search ("edit this to 2 servings")

---

## **Future Enhancements**

### **Short-term (1-2 months)**
- **Undo Edit:** Allow reverting to AI original
- **Edit History:** Track all changes with timestamps
- **Batch Edit:** Edit multiple items at once
- **Smart Suggestions:** "Similar to your recent searches"

### **Medium-term (3-6 months)**
- **Custom Foods:** Add user's own recipes
- **Meal Builder:** Pre-compose meals before logging
- **Sync Across Devices:** Real-time edit sync
- **Voice Input:** "Change this to mango smoothie"

### **Long-term (6-12 months)**
- **AI Learning:** Improve search based on user corrections
- **Barcode Scanner:** Edit by scanning package
- **Photo Re-Analysis:** Take new photo to re-identify
- **Community Database:** Share custom foods

---

## **Known Limitations**

### **Current Version Constraints**

**Search:**
- ✅ Depends on Gemini API availability
- ✅ Limited to 3-5 results per search
- ✅ No offline mode
- ✅ English language only (for now)

**Serving Sizes:**
- ✅ No automatic portion detection from photo
- ✅ Relies on user judgment for custom amounts
- ✅ Limited to standard measurement units

**Data:**
- ✅ Edits don't update original AI model
- ✅ No version history (only latest edit saved)
- ✅ Can't edit items from background service (yet)

---

## **Documentation & Support**

### **User-Facing Help Text**

**In-App Tutorial:**
```
🎉 New Feature: Edit Food Items!

Tap the ✏️ icon next to any food to:
• Search for a different food
• Adjust serving sizes
• Fix nutrition data

Your changes are saved automatically.
```

**Help Section:**
```
Q: Can I edit food items after saving?
A: Yes! Tap the ✏️ icon in meal details.

Q: How do I change serving size?
A: After selecting a food, use the serving controls.

Q: Will this affect my daily totals?
A: Yes, totals update automatically when you save.
```

---

### **Developer Documentation**

**Code Comments:**
- All major functions documented
- Complex algorithms explained
- Edge cases noted

**API Documentation:**
```
PUT /api/update-nutrition-item

Request:
{
  analysisId: number,
  analysisData: AnalysisData
}

Response:
{
  success: boolean,
  message: string
}

Errors:
400 - Invalid request
500 - Database error
```

---

## **Contact & Escalation**

**Developer:** [Your Name]  
**Technical Lead:** [Lead Name]  
**Product Manager:** [PM Name]

**Issue Tracking:**
- GitHub Issues on `MAD_Main` branch
- Label: `feature/editable-food-items`

**Emergency Contact:**
- On-Call: [Phone/Email]
- Database Admin: [Phone/Email]

---

**Document Version:** 1.0  
**Last Updated:** November 14, 2025  
**Status:** Ready for Implementation  
**Dependencies:** Task 1 (Brand Detection) must be completed first

---

**END OF TASK 2 DOCUMENTATION**
