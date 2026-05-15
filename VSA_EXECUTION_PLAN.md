# VSA Normalization Execution Plan
## Controlled Refactoring for Oversized Files (STRICT IDEAL ONLY)

**Status:** Active Execution
**Target:** Reduce 79 oversized files across frontend/backend with STRICT discipline (no overflow tolerance)
**Validation:** ESLint compliance + Build success + Identical behavior before/after

---

## 1. Architecture Guidelines

### Size Targets (STRICT - No Overflow)
| Component Type | Ideal Range | Max Allowed |
|---|---|---|
| Presentation Components | 80–120 LOC | 150 |
| Services/APIs | 100–150 LOC | 180 |
| Page Orchestrators | 150–200 LOC | 250 |
| API Wrappers | 120–160 LOC | 200 |
| Utilities | 60–100 LOC | 140 |
| Custom Hooks | 30–60 LOC | 100 |

### Extraction Hierarchy (Apply in Order)
1. **Pure Functions/Utilities** (no dependencies) → Extract first
2. **API Services** (fetch/http wrappers) → Extract second
3. **Custom Hooks** (state managers) → Extract third
4. **Sub-Components** (presentation) → Extract last
5. **Main Component** (orchestrator) → Refactor to use extracts

### Import Path Rules
- **Feature-based extracts** → Stay within feature folder
- **Cross-feature utilities** → Go to `shared/lib/` or `shared/utils/`
- **Page orchestrators** → Create feature domain if they span multiple features
- **Shared components** → Never migrate from features to pages

---

## 2. Production-Ready Slices (No Action Needed)
### Frontend (8 slices)
- `auth` - 18 LOC ✓
- `background-analysis` - 30 LOC ✓
- `counselling` - 112 LOC ✓
- `food-corrections` - 61 LOC ✓
- `misc` - 25 LOC ✓
- `team` - 139 LOC ✓
- `token` - 41 LOC ✓
- `water` - 132 LOC ✓

### Backend (5 slices)
- `misc` - 127 LOC ✓
- `nutrition-centers` - 131 LOC ✓
- `screen` - 68 LOC ✓
- `token` - Mixed (some files 150+, some under) 
- `water` - 58 LOC ✓

**Total Ready:** 13 frontend + 5 backend = **18 slices** (40% of total)

---

## 3. Phase 1: Critical High-Impact Extractions

### Priority 1: Wellness-University Feature (NEW FEATURE)
**Source:** `frontend/src/pages/WellnessUniversityReport.js` (1,578 LOC)
**Difficulty:** Medium
**Impact:** Single page orchestrator, isolated feature domain

**Extraction Steps:**
1. Create feature folder: `frontend/src/features/wellness-university/`
2. Extract API service: `enrollmentApiService.js` (68 LOC)
   - `fetchUserProfile(email)` - Get current user ID
   - `fetchTeamHierarchy(userId)` - Get team structure with CoachId/CoCoachId
   - `fetchEnrollments(email)` - Get program enrollments
   - `fetchAllTeamMembers(userId)` - Get full team list
   - Error handling & cache-busting
3. Extract utilities: `hierarchyTreeBuilder.js` (87 LOC)
   - `buildHierarchy(teamMembers, userId)` - Recursive tree builder
   - `getDirectReports(userId, allMembers)` - Filter direct reports
   - `getFullTeam(directMembers, allMembers)` - Recursive downline builder
   - `toggleNodeExpansion(nodeId, expandedSet)` - UI expansion state
   - `filterMembersBySearch(members, query)` - Search filtering
   - `formatNodeData(member)` - Display formatting
4. Extract hooks:
   - `useEnrollmentSearch.js` (48 LOC) - Search state + debounce
   - `useProgramViewState.js` (45 LOC) - View type + expansion tracking
5. Refactor main: `WellnessUniversityReport.js` (target: 180-200 LOC)
   - Import all extracts
   - Delegate API calls to service
   - Delegate state to hooks
   - Keep: Rendering + event handlers
6. Create barrel: `index.js` - Default export

**Validation:**
- ESLint: 0 errors
- Build: Successful
- Behavior: Identical before/after
- File deleted from pages/ folder

**Expected Outcome:**
- 1,578 LOC → 248 LOC total (87% reduction)
- Main component: 198 LOC
- All dependencies ready for Phase 2

---

## 4. Phase 2: High-Complexity Shared Components

### Priority 2A: NutritionCard Component
**Source:** `frontend/src/features/nutrition/components/NutritionCard.js` (1,478 LOC)
**Difficulty:** High
**Impact:** Shared across multiple features, complex state management

**Extraction Candidates:**
- `nutritionMath.js` - Calorie/macro calculations (120-140 LOC)
- `nutritionValidation.js` - Input validation rules (80-100 LOC)
- `useNutritionForm.js` - Form state management (90-120 LOC)
- `useFoodSearch.js` - Search + autocomplete state (50-70 LOC)
- `useMealTiming.js` - Meal schedule state (40-60 LOC)
- `FoodItemCard.js` - Sub-component for individual items (100-120 LOC)
- Main component target: 150-180 LOC

### Priority 2B: ActivityTimeReport Component
**Source:** `frontend/src/features/activity/ActivityTimeReport.js` (973 LOC)
**Difficulty:** High
**Impact:** Critical aggregation logic, sensitive calculations

**Extraction Candidates:**
- `activityAggregation.js` - Group/sum logic (120-150 LOC)
- `timeReportCalculations.js` - Duration + goal math (100-130 LOC)
- `useActivityFilters.js` - Filter state (50-70 LOC)
- `useActivityGrouping.js` - Grouping state (40-60 LOC)
- Main component target: 150-180 LOC

---

## 5. Phase 3: Medium-Complexity Components

### Files in 250-400 LOC Range (8 files)
1. `frontend/src/features/weight/components/WeightChart.js` (377 LOC)
2. `frontend/src/features/admin/AdminDashboard.js` (367 LOC)
3. `frontend/src/features/education/EducationHub.js` (333 LOC)
4. `frontend/src/features/nutrition-centers/components/CentersList.js` (790 LOC)
5. `frontend/src/features/screen/components/DailyScreen.js` (954 LOC)
6. `frontend/src/features/leaderboard/components/LeaderboardView.js` (501 LOC)
7. Backend: `features/weight/weight.service.js` (259 LOC)
8. Backend: `features/auth/auth.service.js` (215 LOC)

**Strategy:**
- Extract 2-3 utilities per file
- Create 1-2 sub-components per file
- Target: 150-200 LOC main component

---

## 6. Phase 4: Backend Service Consolidation

### Backend Files Over 150 LOC (9 files)
1. `features/activity/time-report.service.js` (235 LOC)
2. `features/auth/auth.service.js` (215 LOC)
3. `features/education/education.service.js` (211 LOC)
4. `features/food-corrections/food-corrections.service.js` (231 LOC)
5. `features/background-analysis/analysis.service.js` (193 LOC)
6. `features/user/user.repository.js` (196 LOC)
7. `features/token/token.repository.js` (184 LOC)
8. `features/activity/activity.service.js` (151 LOC)
9. `features/food-corrections/food-corrections.repository.js` (152 LOC)

**Extraction Strategy:**
- **Validation logic** → `*-validation.js` (shared per feature)
- **Database queries** → Separate repository methods
- **Business logic** → Helper functions
- **Constants** → Separate config file
- Target: Services 150-180 LOC, Repositories 140-160 LOC

---

## 7. Excluded Files (DO NOT MODIFY)

### App.js (Explicit Exception)
- Reason: Router configuration, lazy-loading orchestration
- Size: ~5,700 LOC (acceptable due to role)
- Status: ⚠️ Out of scope

### Auth FSM Files (Architecture Pattern)
- Location: `frontend/src/features/auth/fsm/`
- Reason: Finite state machines require complete state definitions
- Size: Can exceed ideal range due to state pattern
- Status: ⚠️ Out of scope

---

## 8. Extraction Patterns

### Pattern 1: Pure Utility Functions
```javascript
// Extract math/logic operations
export const calculateMacros = (calories, ratio) => { ... };
export const validateInput = (value) => { ... };
```

### Pattern 2: API Service Wrapper
```javascript
export const fetchData = async (params) => {
  try {
    const response = await fetch(url);
    return response.json();
  } catch (err) {
    console.error(err);
    throw err;
  }
};
```

### Pattern 3: Custom Hook
```javascript
export const useCustomState = () => {
  const [state, setState] = useState(initial);
  const handler = useCallback(() => { ... }, []);
  return { state, handler };
};
```

### Pattern 4: Sub-Component
```javascript
const SubComponent = ({ props }) => (
  <div>Isolated presentation logic</div>
);
export default SubComponent;
```

---

## 9. Validation Checklist

### Per-File Validation
- [ ] **Import Resolution**: All imports resolve without errors
- [ ] **ESLint**: 0 errors, acceptable warnings
- [ ] **Build**: `npm run build` completes successfully
- [ ] **Behavior**: Feature works identically before/after
- [ ] **LOC Count**: Component at or below ideal range
- [ ] **Comments**: JSDoc on public functions
- [ ] **No Orphaned Exports**: All exports used or removed

### Cross-File Validation
- [ ] **Circular Dependencies**: None detected
- [ ] **Shared Utilities**: Used by multiple components
- [ ] **Path Consistency**: Relative imports work across refactors
- [ ] **API Stability**: No changed signatures

### Build Validation
- [ ] **No Import Errors**: All modules found
- [ ] **No Runtime Errors**: Console clean on load
- [ ] **Bundle Size**: Comparable to before
- [ ] **Dev Server**: Starts without errors
- [ ] **Hot Reload**: Works after file changes

---

## 10. Implementation Timeline

### Week 1: Phase 1 (Wellness-University)
- Days 1-2: Extract API service + utilities
- Days 3-4: Extract hooks + create main component
- Day 5: Validation + bug fixes

### Week 2: Phase 2 (NutritionCard + ActivityTimeReport)
- Days 1-3: NutritionCard extractions
- Days 3-4: ActivityTimeReport extractions
- Day 5: Cross-component validation

### Week 3: Phase 3 (Medium-Complexity)
- Days 1-2: WeightChart + AdminDashboard
- Days 3-4: EducationHub + CentersList
- Day 5: Testing + rollup

### Week 4: Phase 4 (Backend Services)
- Days 1-5: Backend service consolidation + validation

---

## 11. Risk Mitigation

### Risk: Breaking Changes in Complex Logic
**Mitigation:** Extract pure functions first; test extensively before integrating

### Risk: Import Path Conflicts
**Mitigation:** Use absolute paths; verify after each extraction

### Risk: Performance Regression
**Mitigation:** Compare bundle size before/after; profile hooks for unnecessary re-renders

### Risk: Lost Business Logic
**Mitigation:** Preserve all original code; only refactor structure

---

## 12. Success Criteria

✅ **All 79 oversized files normalized** OR **High-priority files extracted**
✅ **Build passes** without errors
✅ **ESLint passes** with 0 errors
✅ **Behavior identical** before/after each extraction
✅ **No circular dependencies** introduced
✅ **All files at or below ideal LOC range**

---

## 13. Commands Reference

### Validate Line Count
```bash
# Single file
wc -l path/to/file.js

# All files in feature
find frontend/src/features/feature-name -name "*.js" -exec wc -l {} +

# Aggregate count
find frontend/src/features -name "*.js" | xargs wc -l
```

### ESLint Check
```bash
npx eslint src/features/feature-name --max-warnings 0
```

### Build & Test
```bash
npm run build
npm start
```

---

## 14. Next Immediate Steps

1. **Phase 1 Ready:** Wellness-University feature (1,578 LOC → 248 LOC)
   - All extraction logic documented
   - Import paths defined
   - Validation checklist prepared

2. **Start Extraction:** Follow Phase 1 pattern for other high-priority files

3. **Track Progress:** Update this plan with completed files as you go

---

**Last Updated:** May 15, 2026
**Status:** Phase 1 Active
**Completion Target:** End of Week 4
