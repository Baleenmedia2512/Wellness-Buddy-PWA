# AI Personalization Implementation Plan

**Project:** Wellness Buddy PWA - AI Learning System  
**Start Date:** December 4, 2025  
**Duration:** 5 Days  
**Developer:** Team with AI Assistance

---

## **Executive Summary**

Build a personalization layer that makes Gemini AI smarter for each user by learning from their food corrections and dietary preferences. The system will track user edits, build user-specific and global correction patterns, and inject this context into Gemini prompts to improve accuracy over time.

**Expected Improvement:**
- Week 1: 70% → 78% accuracy (+8% from global patterns)
- Week 4: 78% → 87% accuracy (+9% from personal patterns)
- Month 2: 87% → 93% accuracy (mature personalized system)

---

## **Current System Analysis**

### **Existing Database Tables:**

**1. `team_table` (User Management)**
```sql
- UserId (INT, Primary Key)
- UserName (VARCHAR)
- Email (VARCHAR, Unique)
- Status (ENUM: 'Active', 'Inactive')
- Height (DECIMAL) - recently added
- Age (INT) - REMOVED in migration
- Gender (ENUM) - REMOVED in migration
```

**2. `food_nutrition_data_table` (Nutrition Records)**
```sql
- ID (INT, Primary Key)
- UserId (BIGINT, Foreign Key → team_table.UserId)
- ImagePath (VARCHAR)
- ImageBase64 (LONGTEXT)
- AnalysisData (JSON) - stores: { foods: [], total: {}, confidence: '' }
- TotalCalories, TotalProtein, TotalCarbs, TotalFat, TotalFiber (DECIMAL)
- ProcessedBy (ENUM: 'manual_app', 'background_service')
- IsDeleted (TINYINT, Default: 0)
- CreatedAt, UpdatedAt (TIMESTAMP)
```

**3. `weight_records_table` (Weight Tracking)**
```sql
- ID, UserId, Weight, Bmi, BodyFat, MuscleMass, Bmr
- WeightImageBase64, CreatedAt, IsDeleted
```

### **Existing Components:**

**Backend APIs:**
- ✅ `save-background-analysis.js` - Saves nutrition analysis
- ✅ `get-background-analysis.js` - Fetches user's nutrition history
- ✅ `update-nutrition-analysis.js` - Updates existing nutrition records
- ✅ `lookup-user-id.js` - Converts email to UserId
- ✅ `save-google-user.js` - Creates/updates user in team_table
- ✅ `update-user-profile.js` - Updates user profile data

**Frontend Services:**
- ✅ `geminiService.js` - Handles Gemini API calls for food analysis
- ✅ `nutritionSaveService.js` - Saves nutrition data to backend
- ✅ `getUserId.js` - Fetches UserId from email

**Frontend Components:**
- ✅ `EditableFoodItem.js` (1219 lines) - Complex food editing with:
  - Search functionality
  - Serving size adjustments
  - Custom gram input
  - Auto-save with debouncing
  - Optimistic UI updates
- ✅ `UserProfileModal.js` - New user profile setup
- ✅ `NutritionDashboard.js` - Main nutrition display

---

## **What We Need to Build**

### **New Database Tables:**

**1. `food_corrections` (Personal + Global Tracking)**
```sql
CREATE TABLE food_corrections (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  ai_detected VARCHAR(255) NOT NULL,
  user_corrected VARCHAR(255) NOT NULL,
  times_corrected INT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_corrected TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_user_id (user_id),
  INDEX idx_ai_detected (ai_detected),
  INDEX idx_global_pattern (ai_detected, user_corrected)
);
```

**2. Update `team_table` (Add Diet Type)**
```sql
ALTER TABLE team_table
ADD COLUMN diet_type ENUM('vegetarian', 'vegan', 'non-vegetarian', 'pescatarian') NULL 
COMMENT 'User dietary preference';
```

### **New Backend APIs:**

**1. `save-food-correction.js`**
- Tracks when user edits food (aiDetected → userCorrected)
- Upserts correction (increment if exists)

**2. `get-user-context.js`**
- Fetches personal corrections (TOP 10)
- Fetches global corrections (TOP 5)
- Fetches user profile (diet_type)
- Fetches recent meals (last 10)
- Returns combined context object

**3. Update `update-user-profile.js`**
- Add diet_type field handling

### **Modified Components:**

**1. `geminiService.js`**
- Add userContext parameter
- Build dynamic prompts with personal + global corrections
- Inject diet type and recent meals

**2. `EditableFoodItem.js`**
- Track corrections when user saves
- Call save-food-correction API

**3. `ProfileSettings.js` (New)**
- Simple UI for diet type selection
- Saves to team_table via API

**4. `GeminiApiClient.java` (Android)**
- Add context parameter
- Mirror JS prompt logic

---

## **Implementation Plan (Development + Testing Integrated)**

### **DAY 1 - Food Correction Tracking System** ✅ Starting Today

**WP(AI/L) - Food Correction Tracking - Save user's food name edits to database and show them in a debug panel**  
*Complete correction tracking with database, APIs, frontend, debug tools, tested on web + Android*

**Development + Testing Activities:**
- [ ] **Database Setup:** Create `food_corrections` table with proper indexes → Test with sample inserts/queries
- [ ] **Backend API:** Build `save-food-correction.js` → Test with Postman (insert, update, frequency increment)
- [ ] **Frontend Integration:** Modify `EditableFoodItem.js` to call API, add "Correction saved ✓" → Test: Upload food → Edit name → Verify confirmation → Check database
- [ ] **Debug Panel:** Create developer panel showing all corrections → Test with multiple corrections, verify sorting
- [ ] **Android Integration:** Add correction tracking to Android → Test: Upload on Android → Edit → Verify sync with web

**Testing Scenarios:**
- Upload food → Edit name → See "Correction saved ✓" → Verify in database
- Make 3 corrections → Check debug panel shows all → Verify frequency counts
- Test on Android → Make correction → Check web debug panel → Verify syncs

**Deliverables:**
- ✅ Full correction tracking working on web + Android
- ✅ Debug panel functional
- ✅ Database operations verified

---

### **DAY 2 - Diet Profile & Context Loading System**

**WP(AI/L) - Diet Preference - Add diet type dropdown (Veg/Non-Veg/Vegan/Pescatarian) to user profile**  
*Add diet type to profile, integrate into UserProfileModal, tested on web + Android*

**Development + Testing Activities:**
- [ ] **Database Update:** Add `diet_type` column to `team_table` → Test with sample data
- [ ] **Backend API:** Update `update-user-profile.js` for diet_type → Test save/fetch with Postman
- [ ] **Frontend UI:** Add diet dropdown to `UserProfileModal.js`, show "Profile updated ✓" → Test: Set diet → Close app → Reopen → Verify persists
- [ ] **Android Integration:** Add diet dropdown to Android profile → Test: Set on web → Check Android → Verify syncs (and vice versa)

**Testing Scenarios:**
- Select diet → Save → See confirmation → Close/reopen → Verify persists
- Set diet on web → Check Android → Verify syncs
- Change diet → Verify updates everywhere

---

**WP(AI/L) - User Context Loading - Load user's corrections, global patterns, diet, and recent meals on app startup**  
*Build context API, cache on startup, tested on web + Android*

**Development + Testing Activities:**
- [ ] **Backend API:** Create `get-user-context.js` fetching corrections (TOP 10), global patterns (TOP 5), diet, recent meals → Test query performance (<50ms)
- [ ] **Frontend Service:** Create `userContextService.js`, fetch and cache on startup, add "Loading preferences..." → Test: Open app → Verify single API call → Check caching
- [ ] **Android Integration:** Implement context loading on Android startup → Test: Open app → Verify loads → Test offline handling

**Testing Scenarios:**
- Open app → See "Loading preferences..." → Check network tab → Verify 1 API call
- Test with no internet → Verify graceful handling
- Test on Android → Verify same context loads

**Deliverables:**
- ✅ Diet profile working on web + Android
- ✅ Context loading system functional
- ✅ All data syncs between platforms

---

### **DAY 3-4 - AI Personalization, Global Patterns & Performance** (2 Days: Dec 6-7, 2025)

**WP(AI/L) - AI Personalization - Make Gemini AI remember user's corrections and diet preference in every analysis**  
*Integrate context into AI prompts, build debug tools, test learning on web + Android*

**Development + Testing Activities:**
- [ ] **AI Prompt Integration:** Modify `geminiService.js` to inject user context (corrections, diet, recent meals) → Test: Upload lemon rice → AI wrong → Correct → Upload again → Verify AI learned
- [x] **Visual-First AI Logic:** ✅ **COMPLETED (Dec 12, 2025)** - Implemented smart AI prioritization with visual evidence > user corrections
  - Added liquid food detection (volume_ml, unit, isLiquid fields)
  - Color-aware AI: "Yellow shake = Mango, Pink = Strawberry" (visual priority)
  - Smart corrections: "This context is for REFERENCE ONLY, not absolute rules"
  - Priority hierarchy: Visual Evidence > User Corrections > Diet Preferences > Global Patterns
  - Files modified: `geminiService.js` (buildPersonalizedPrompt, transformOptimizedResponse)
- [ ] **Prompt Debug Panel:** Create developer panel showing actual AI prompt with context → Test: Verify shows corrections, diet, recent meals in prompt
- [ ] **Diet Context:** Ensure AI respects diet preference → Test: Set Veg diet → Upload ambiguous food → Verify AI prioritizes veg options
- [ ] **Android AI Integration:** Update `GeminiApiClient.java` with context parameter → Test: Upload → AI wrong → Correct → Upload again → Verify learned
- [ ] **Cross-Platform Learning:** Test corrections on one platform affect other → Test: Correct on web → Test AI on Android → Verify learned (and vice versa)

**Testing Scenarios:**
- Personal Learning: Upload food → Correct name → Upload same food → Verify AI uses correction
- Diet Integration: Set diet to Vegetarian → Upload rice → Verify AI prioritizes veg options
- Recent Meals: Upload lemon rice 3x → Upload rice → Verify AI biases toward lemon rice
- Cross-Platform: Correct on web → Upload on Android → Verify AI learned

---

**WP(AI/L) - Global Patterns - Make AI learn from all users' corrections to help new users get better detection**  
*Test multi-user corrections create global patterns, verify on web + Android*

**Development + Testing Activities:**
- [ ] **Test Data Creation:** Create 5 test users with overlapping corrections → Test: 3+ users correct same food → Query global patterns → Verify appears
- [ ] **Global Pattern Debug Panel:** Create developer panel showing "Top 5 Global Corrections" → Test: Verify shows patterns sorted by frequency
- [ ] **Multi-User Testing (Web):** Create new user → Upload food that others corrected → Test: Verify AI uses global pattern immediately
- [ ] **Multi-User Testing (Android):** Create new Android user → Upload food with global pattern → Test: Verify AI benefits from global corrections

**Testing Scenarios:**
- Create Users A, B, C → All correct "Tamarind Rice" → "Lemon Rice"
- Create new User D → Upload tamarind rice → Verify AI detects "Lemon Rice" immediately
- Check global patterns panel → Verify correction appears
- Test on Android with new user → Verify uses global pattern

---

**WP(AI/L) - Performance Optimization - Ensure app stays fast even with 100+ corrections stored**  
*Ensure speed with large datasets, optimize queries, test on web + Android*

**Development + Testing Activities:**
- [ ] **Load Testing:** Create user with 100+ corrections → Test context loads <2s, queries <50ms → Add indexes if needed
- [ ] **Web Performance:** Test with 100+ corrections → Verify app loads <2s, AI responds <5s, no console errors
- [ ] **Android Performance:** Test with 100+ corrections → Verify app loads <3s, AI responds <5s → Test memory stability (keep open 30min)
- [ ] **Bug Fixes:** Fix any performance issues, console errors, or UX problems found during testing

**Testing Scenarios:**
- Insert 100+ corrections → Measure load times
- Test AI analysis → Measure response times
- Test on slow 3G → Verify acceptable performance
- Memory leak test → Keep app open 30min → Check memory usage

**Deliverables:**
- ✅ AI personalization working on web + Android
- ✅ Debug tools showing AI prompts
- ✅ Global patterns working for multi-user scenarios
- ✅ Performance acceptable with large datasets
- ✅ All bugs fixed on both platforms

---

### **DAY 5 - Cross-Platform Sync & Production Deployment**

**WP(AI/L) - Cross-Platform Sync - Verify corrections and preferences sync perfectly between web and Android**  
*Thoroughly test sync between web and Android*

**Development + Testing Activities:**
- [ ] **Web → Android Sync:** Correct food on web → Upload on Android → Test: Verify AI remembers | Change diet on web → Check Android → Verify updates
- [ ] **Android → Web Sync:** Correct food on Android → Upload on web → Test: Verify AI remembers | Make correction on Android → Check web debug panel → Verify appears
- [ ] **Edge Cases:** Test offline editing, concurrent changes → Test: Make different corrections on both → Verify conflict resolution

**Testing Scenarios:**
- Correction sync testing (both directions)
- Diet preference sync testing
- Real-time data visibility testing
- Offline/concurrent change handling

---

**WP(AI/L) - Production Deployment - Remove debug panels, deploy to live servers, and verify everything works**  
*Remove debug features, deploy, verify in production*

**Development + Testing Activities:**
- [ ] **Production Build:** Hide/remove all debug panels → Build production versions (web + Android) → Test locally → Verify no debug features visible
- [ ] **Deployment:** Deploy backend APIs and frontend to live servers → Update Android app → Test live app with real account
- [ ] **Production Verification:** Make corrections in production → Verify saved → Upload similar food → Verify AI learned → Monitor error logs

**Testing Scenarios:**
- Verify no debug panels in production build
- Test live app with real account
- End-to-end flow in production
- Monitor for errors

**Deliverables:**
- ✅ Cross-platform sync verified
- ✅ Production deployment successful
- ✅ All features working in live environment

---

## **Technical Architecture**

### **Data Flow:**

```
User uploads food image
    ↓
Frontend calls geminiService.analyzeImageForNutrition(image, userId)
    ↓
geminiService fetches user context via API
    ↓
Backend queries:
  - Personal corrections (TOP 10, ordered by frequency)
  - Global corrections (TOP 5, 3+ users affected)
  - User profile (diet_type)
  - Recent meals (last 10)
    ↓
Build dynamic prompt:
  "GLOBAL PATTERNS: [common corrections]
   USER PREFERENCES: [personal corrections]
   DIET: [vegetarian/etc]
   RECENT MEALS: [last 10 foods]
   [Standard analysis prompt]"
    ↓
Send to Gemini API
    ↓
Get personalized result
    ↓
If user edits → Save correction → Improves future accuracy
```

### **Prompt Structure:**

```
=== GLOBAL FOOD PATTERNS ===
Common corrections across all users:
- "Puliyodarai Rice" → Often "Lemon Rice" (12 users corrected)
- "Chocolate Milkshake" → Often "Protein Shake" (8 users corrected)

=== USER'S PREFERENCES ===
This user's food patterns:
- "Tamarind Rice" → "Lemon Rice" (corrected 5x)
- Diet: Vegetarian

=== RECENT ACTIVITY ===
Recently ate: Lemon Rice, Idli, Dosa, Sambar, Curd Rice

Now analyze this food image and return nutrition data...
[Standard prompt continues]
```

### **Database Queries:**

**Personal Corrections (TOP 10):**
```sql
SELECT ai_detected, user_corrected, times_corrected
FROM food_corrections
WHERE user_id = ?
ORDER BY times_corrected DESC
LIMIT 10
```

**Global Corrections (TOP 5):**
```sql
SELECT 
  ai_detected, 
  user_corrected, 
  COUNT(DISTINCT user_id) as affected_users,
  SUM(times_corrected) as total_corrections
FROM food_corrections
GROUP BY ai_detected, user_corrected
HAVING affected_users >= 3 AND total_corrections >= 5
ORDER BY total_corrections DESC
LIMIT 5
```

**Recent Meals:**
```sql
SELECT JSON_EXTRACT(AnalysisData, '$.category.name') as food_name
FROM food_nutrition_data_table
WHERE UserId = ? AND IsDeleted = 0
ORDER BY CreatedAt DESC
LIMIT 10
```

---

## **Testing Strategy**

### **Unit Tests:**
- ✅ Correction save/fetch APIs
- ✅ Context building logic
- ✅ Prompt generation
- ✅ Database queries

### **Integration Tests:**
- ✅ End-to-end correction flow
- ✅ Personal learning verification
- ✅ Global pattern creation
- ✅ Android background analysis

### **User Scenarios:**
1. **New User:** No history → Normal analysis
2. **User with Corrections:** Uploads similar food → Uses correction
3. **Multiple Users:** Same correction → Global pattern emerges
4. **Diet Filter:** Vegetarian user → AI prioritizes veg foods
5. **Recent Meals:** Frequent lemon rice eater → AI expects lemon rice

### **Performance Tests:**
- API response times <500ms
- Context query <50ms
- No memory leaks
- Concurrent user handling

---

## **Success Metrics**

### **Technical Metrics:**
- ✅ All APIs respond in <500ms
- ✅ Context fetch in <50ms
- ✅ Database properly indexed
- ✅ No console errors
- ✅ Memory usage stable

### **Business Metrics:**
- ✅ 85%+ accuracy from Day 1 (global patterns)
- ✅ 92%+ accuracy by Week 4 (personal patterns)
- ✅ 80% reduction in user corrections
- ✅ Improved user satisfaction
- ✅ Lower support tickets

### **User Experience:**
- ✅ Seamless correction tracking (no extra steps)
- ✅ Profile setup in <30 seconds
- ✅ Visible accuracy improvements
- ✅ No performance degradation

---

## **Risk Mitigation**

| Risk | Mitigation |
|------|------------|
| Long prompts slow down API | Limit to TOP 10 personal + TOP 5 global |
| User changes diet | Profile editable anytime |
| Privacy concerns | Data stays in our DB, not shared with Google |
| Poor global detection | Require 3+ users before creating pattern |
| Breaking existing features | Extensive testing, feature flag rollback |

---

## **Token & Cost Analysis**

**Current Average Prompt:** ~200 tokens  
**With User Context:** ~350 tokens (+150)  
**Cost Increase:** +75% per request  
**Actual Cost:** $0.000015 → $0.000026 per request

**Monthly Cost (100 users, 300 requests each):**
- Before: $0.45/month
- After: $0.78/month
- **Increase: $0.33/month** ✅ Negligible

**ROI:** Reduces re-analysis from corrections, saves more than it costs

---

## **Team Responsibilities**

### **Backend Developer:**
- Database migrations
- API endpoints
- Query optimization

### **Frontend Developer:**
- React components
- Service integration
- UI/UX

### **Android Developer:**
- Java client updates
- Background service
- Testing

### **QA:**
- Test scenarios
- Performance testing
- Bug reporting

---

## **Post-Implementation**

### **Monitoring:**
- Track correction frequency
- Monitor global pattern emergence
- Analyze accuracy improvements
- Watch API performance

### **Future Enhancements:**
- Regional/cultural patterns
- Meal templates
- Favorite foods
- Barcode scanning integration

---

## **Status Tracking**

**Last Updated:** December 4, 2025  
**Current Status:** ⏳ Ready to Start - Day 1 Afternoon Session  
**Completion:** 0% (0/5 days)

---

## **Task Breakdown for Microsoft To Do**

### **DAY 1 - Food Correction Tracking System (December 4, 2025)**

**WP(AI/L) - Food Correction Tracking - Save user's food name edits to database and show them in a debug panel**  
*Complete correction tracking with database, APIs, frontend, debug tools, tested on web + Android*

1. ☐ **[Day 1 - Dev+Test]** Database setup + testing
   - **Build:** Create `food_corrections` table with proper indexes
   - **Test:** Insert test correction → Verify saved → Query back → Verify structure

2. ☐ **[Day 1 - Dev+Test]** Backend API + Postman testing
   - **Build:** Create `save-food-correction.js` API (insert/update logic)
   - **Test:** Postman - Insert new correction → Verify 200 response → Update existing → Verify times_corrected increments

3. ☐ **[Day 1 - Dev+Test]** Frontend integration + end-to-end testing
   - **Build:** Modify `EditableFoodItem.js` to call API on save, add "Correction saved ✓" message
   - **Test:** Upload food → Edit name → See confirmation → Check database → Verify saved

4. ☐ **[Day 1 - Dev+Test]** Debug panel + data verification
   - **Build:** Create developer panel showing all user corrections (dev mode only)
   - **Test:** Make 3 corrections → Check panel shows all → Verify sorting by frequency

5. ☐ **[Day 1 - Dev+Test]** Android integration + cross-platform testing
   - **Build:** Integrate correction tracking in Android `EditableFoodItem`
   - **Test:** Upload on Android → Edit name → See "Correction saved ✓" → Check web debug panel → Verify sync

---

### **DAY 2 - Diet Profile & Context Loading (December 5, 2025)**

**WP(AI/L) - Diet Preference - Add diet type dropdown (Veg/Non-Veg/Vegan/Pescatarian) to user profile**  
*Add diet type to profile, integrate into UserProfileModal, tested on web + Android*

6. ☐ **[Day 2 - Dev+Test]** Diet database + backend testing
   - **Build:** Add `diet_type` column to `team_table`, update `update-user-profile.js`
   - **Test:** Postman - Save diet → Verify saved → Fetch profile → Verify diet returned

7. ☐ **[Day 2 - Dev+Test]** Profile UI + persistence testing
   - **Build:** Add diet dropdown to `UserProfileModal.js`, show "Profile updated ✓"
   - **Test:** Set diet to Vegetarian → Save → Close app → Reopen → Verify persists

8. ☐ **[Day 2 - Dev+Test]** Android profile + sync testing
   - **Build:** Add diet dropdown to Android profile screen
   - **Test:** Set diet on web → Check Android → Verify syncs | Change on Android → Check web → Verify syncs

**WP(AI/L) - User Context Loading - Load user's corrections, global patterns, diet, and recent meals on app startup**  
*Build context API, cache on startup, tested on web + Android*

9. ☐ **[Day 2 - Dev+Test]** Context API + query testing
   - **Build:** Create `get-user-context.js` fetching corrections (TOP 10), global patterns (TOP 5), diet, recent meals (last 10)
   - **Test:** Postman - Call API → Verify returns all 4 data sections → Check query performance (<50ms)

10. ☐ **[Day 2 - Dev+Test]** Frontend caching + loading UI testing
    - **Build:** Create `userContextService.js` to fetch and cache on startup, add "Loading preferences..." indicator
    - **Test:** Open app → See loading indicator → Check network tab (1 API call) → Verify cached for session

11. ☐ **[Day 2 - Dev+Test]** Android context loading + performance testing
    - **Build:** Implement context loading in Android app startup
    - **Test:** Open Android → Verify loading indicator → Check logs → Verify single API call → Test offline graceful handling

---

### **DAY 3-4 - AI Personalization, Global Patterns & Performance (December 6-7, 2025)**

**WP(AI/L) - AI Personalization - Make Gemini AI remember user's corrections and diet preference in every analysis**  
*Integrate context into AI prompts, build debug tools, test learning on web + Android*

12. ☐ **[Day 3 - Dev+Test]** AI prompt integration + learning testing
    - **Build:** Modify `geminiService.js` to inject user context into prompts (corrections, diet, recent meals)
    - **Test:** Upload lemon rice → AI detects wrong → Correct to "Lemon Rice" → Upload again → Verify AI detects correctly

13. ☐ **[Day 3 - Dev+Test]** Prompt debug panel + context verification
    - **Build:** Create developer panel showing actual AI prompt with user context
    - **Test:** Check panel → Verify shows corrections list → Verify shows diet type → Verify shows recent meals

14. ☐ **[Day 3 - Dev+Test]** Diet context testing
    - **Build:** Ensure AI respects diet preference in detection logic
    - **Test:** Set diet to Veg → Upload ambiguous food → Verify AI prioritizes veg options | Set to Non-Veg → Verify different detection

15. ☐ **[Day 3 - Dev+Test]** Android AI integration + learning testing
    - **Build:** Update `GeminiApiClient.java` with context parameter, mirror JS prompt logic
    - **Test:** Upload food on Android → AI wrong → Correct → Upload again → Verify AI learned | Check prompt includes context

16. ☐ **[Day 3 - Dev+Test]** Cross-platform learning verification
    - **Build:** Ensure corrections made on one platform affect AI on other platform
    - **Test:** Correct on web → Test AI on Android → Verify learned | Correct on Android → Test on web → Verify learned

**WP(AI/L) - Global Patterns - Make AI learn from all users' corrections to help new users get better detection**  
*Test multi-user corrections create global patterns, verify on web + Android*

17. ☐ **[Day 4 - Dev+Test]** Test data creation + global query testing
    - **Build:** Create 5 test users with overlapping corrections
    - **Test:** User A, B, C correct "Tamarind Rice" → "Lemon Rice" → Query global patterns → Verify appears (3+ users)

18. ☐ **[Day 4 - Dev+Test]** Global pattern debug panel + verification
    - **Build:** Create developer panel showing "Top 5 Global Corrections"
    - **Test:** Check panel → Verify shows global patterns → Verify sorted by total_corrections

19. ☐ **[Day 4 - Dev+Test]** Multi-user pattern testing on web
    - **Build:** Ensure new users benefit from existing global patterns
    - **Test:** Create new User D → Upload tamarind rice → Verify AI detects as "Lemon Rice" immediately (using global pattern)

20. ☐ **[Day 4 - Dev+Test]** Global pattern testing on Android
    - **Build:** Verify Android uses global patterns for new users
    - **Test:** Create new Android user → Upload food others corrected → Verify AI uses global pattern

**WP(AI/L) - Performance Optimization - Ensure app stays fast even with 100+ corrections stored**  
*Ensure speed with large datasets, optimize queries, test on web + Android*

21. ☐ **[Day 4 - Dev+Test]** Load testing + query optimization
    - **Build:** Add database indexes if needed, optimize context queries
    - **Test:** Create user with 100+ corrections → Measure context load time (<2s) → Check query execution time (<50ms)

22. ☐ **[Day 4 - Dev+Test]** Web performance testing
    - **Build:** Optimize frontend caching and rendering
    - **Test:** 100+ corrections → App loads <2s → AI responds <5s → No console errors

23. ☐ **[Day 4 - Dev+Test]** Android performance + memory testing
    - **Build:** Optimize Android context loading and caching
    - **Test:** 100+ corrections → App loads <3s → AI responds <5s → Keep open 30min → Check memory stable

24. ☐ **[Day 4 - Dev+Test]** Bug fixes + UX polish
    - **Build:** Fix any issues found during testing
    - **Test:** Test all flows → Fix console errors → Verify smooth UX on both platforms

---

### **DAY 5 - Cross-Platform Sync & Production (December 8, 2025)**

**WP(AI/L) - Cross-Platform Sync - Verify corrections and preferences sync perfectly between web and Android**  
*Thoroughly test sync between web and Android*

25. ☐ **[Day 5 - Dev+Test]** Web-to-Android sync testing
    - **Build:** Verify real-time sync mechanisms
    - **Test:** Correct food on web → Upload on Android → Verify AI remembers | Change diet on web → Check Android → Verify updates

26. ☐ **[Day 5 - Dev+Test]** Android-to-web sync testing
    - **Build:** Verify bidirectional sync works correctly
    - **Test:** Correct food on Android → Upload on web → Verify AI remembers | Make correction on Android → Check web debug panel → Verify appears

27. ☐ **[Day 5 - Dev+Test]** Edge case + conflict testing
    - **Build:** Handle offline edits and concurrent changes
    - **Test:** Make different corrections on both platforms → Verify conflict resolution | Test offline editing → Come online → Verify syncs

**WP(AI/L) - Production Deployment - Remove debug panels, deploy to live servers, and verify everything works**  
*Remove debug features, deploy, verify in production*

28. ☐ **[Day 5 - Dev+Test]** Production build preparation + testing
    - **Build:** Hide/remove all debug panels and developer features
    - **Test:** Build production versions → Test locally → Verify no debug features visible → Test all core features work

29. ☐ **[Day 5 - Dev+Test]** Deployment + production verification
    - **Build:** Deploy backend APIs and frontend to live servers, update Android app
    - **Test:** Test live app with real account → Make corrections → Verify saved → Upload similar food → Verify AI learned | Monitor error logs

---

**Total: 29 tasks across 5 days (7 WP items) - Each task includes both development and testing**

---

## **Daily Progress Log**

### **Day 1 - December 4, 2025**
- [ ] Started: [Time]
- [ ] Tasks Completed: 0/5
- [ ] WPs Completed: 0/1
- [ ] Issues Encountered: None
- [ ] Status: Not Started

### **Day 2 - December 5, 2025**
- [ ] Started: [Time]
- [ ] Tasks Completed: 0/6
- [ ] WPs Completed: 0/2
- [ ] Issues Encountered: None
- [ ] Status: Not Started

### **Day 3-4 - December 6-7, 2025** (2 Days)
- [ ] Started: [Time]
- [ ] Tasks Completed: 0/13
- [ ] WPs Completed: 0/3
- [ ] Issues Encountered: None
- [ ] Status: Not Started

### **Day 5 - December 8, 2025**
- [ ] Started: [Time]
- [ ] Tasks Completed: 0/5
- [ ] WPs Completed: 0/2
- [ ] Issues Encountered: None
- [ ] Status: Not Started

---

**Ready to begin implementation!** 🚀
