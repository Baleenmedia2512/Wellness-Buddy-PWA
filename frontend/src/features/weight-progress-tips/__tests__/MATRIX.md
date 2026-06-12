# Weight Progress Tips — Testing Matrix

| Capability | Unit | Integration | E2E | Permissions | Edge cases |
|------------|------|-------------|-----|-------------|------------|
| `checkReverseProgress` domain logic | ✅ | N/A | N/A | N/A | ✅ (loss, gain, neutral, missing inputs, string values) |
| `computeCalorieTarget` domain logic | ✅ | N/A | N/A | N/A | ✅ (loss/gain/maintain, null BMR, NaN) |
| `computeProteinTarget` domain logic | ✅ | N/A | N/A | N/A | ✅ (valid, null, zero, negative) |
| `calculateWaterTarget` domain logic | ✅ | N/A | N/A | N/A | ✅ (valid, null, zero, negative) |
| `generateTips` — calorie tips | ✅ | N/A | N/A | N/A | ✅ (over/under target, within range, no BMR) |
| `generateTips` — protein tips | ✅ | N/A | N/A | N/A | ✅ (low protein, gain priority, no weight) |
| `generateTips` — carb/fat tips | ✅ | N/A | N/A | N/A | ✅ (loss only, gain skipped) |
| `generateTips` — water tips | ✅ | N/A | N/A | N/A | ✅ (no water, below 80%, adequate) |
| `generateTips` — activity tips | ✅ | N/A | N/A | N/A | ✅ (zero steps, low steps, sufficient, null activity) |
| `generateTips` — sort order | ✅ | N/A | N/A | N/A | ✅ (high → medium → low) |
| `generateTips` — fallback tip | ✅ | N/A | N/A | N/A | ✅ (no issues detected) |
| Fetch weight progress check (API client) | ✅ | ⏳ | ⏳ | N/A | ✅ (cache invalidation, CORS, network errors, malformed responses) |
| Modal renders comparison with real targets | ⏳ | ⏳ | ⏳ | N/A | ⏳ |
| Modal shown after weight save | ⏳ | ⏳ | ⏳ | N/A | ⏳ |
| Modal shown after weight edit-save | ⏳ | ⏳ | ⏳ | N/A | ⏳ |
| Modal NOT shown when no reverse progress | ⏳ | ⏳ | ⏳ | N/A | ⏳ |

## Edge Cases Covered

### Domain — `checkReverseProgress`
- ✅ Loss mode: weight increased beyond threshold → reverse progress
- ✅ Loss mode: weight decreased → favorable (no reverse)
- ✅ Gain mode: weight decreased beyond threshold → reverse progress
- ✅ Gain mode: weight increased → favorable (no reverse)
- ✅ Change below 0.3 kg → neutral (normal fluctuation)
- ✅ Exact same weight → neutral
- ✅ Missing inputs → no reverse progress (safe default)
- ✅ String weight values parsed correctly

### Domain — `generateTips`
- ✅ Calorie over target in loss mode → high-priority tip with exact numbers
- ✅ Calorie under target in gain mode → high-priority tip with exact numbers
- ✅ No calorie tip when within 100 kcal of target
- ✅ No calorie tip when calorieTarget=0 (BMR unavailable)
- ✅ Protein below 80% of target → tip with shortfall
- ✅ Protein tip is `high` priority in gain mode
- ✅ No protein tip when proteinTarget=0 (weight unavailable)
- ✅ Carb tip only fires in loss mode
- ✅ Fat tip only fires in loss mode
- ✅ Water tip fires when intake is 0 (clear message)
- ✅ Water tip fires when intake is below 80% of target
- ✅ No water tip when intake is adequate
- ✅ Activity tip fires when steps < 5000 (including 0)
- ✅ No activity tip when steps ≥ 5000
- ✅ null activityYesterday treated as 0 steps
- ✅ Tips sorted: high → medium → low
- ✅ Fallback tip returned when no specific issues found

### API Client — Cache-Control Headers
- ✅ Browser cache invalidation when origin changes (localhost:3001 → localhost:3000)
- ✅ Cache-Control: no-cache header present
- ✅ Pragma: no-cache header present
- ✅ cache: no-store fetch option present
- ✅ Network failure handling
- ✅ HTTP error responses (400, 500)
- ✅ API-level errors (ok: false)
- ✅ Malformed JSON responses

## Notes

- Backend domain tests live at `backend/features/weight-progress-tips/__tests__/weight-progress-rules.test.js`
- Frontend API client tests live at `frontend/src/features/weight-progress-tips/__tests__/weightProgressClient.test.js`
- **Critical fix:** Water stub replaced with real `food_nutrition_data_table` query
- **Critical fix:** Activity data now fetched from `daily_step_activity`
- **Critical fix:** Tips now compare yesterday vs personal targets (BMR-based), not today vs yesterday deltas
- **Critical fix:** Modal shows real calorie/protein targets from API, not `yesterday * 0.9` heuristic
