# AI Token Monitor - Quick Start & Testing Guide

## 🚀 Quick Start (5 Minutes)

### Step 1: Start the Backend Server
```bash
cd backend
npm run dev
# Backend should start on http://localhost:3000
```

### Step 2: Start the Frontend
```bash
cd frontend
npm start
# Frontend should start on http://localhost:3001
```

### Step 3: Open the App
1. Navigate to `http://localhost:3001`
2. Sign in with your account
3. Click your avatar (top-right)
4. Select "AI Token Monitor" from the menu

### Step 4: Test with Demo Data
1. Look for the yellow "Demo Mode" banner
2. Toggle the switch to **ON** (green)
3. You should see demo data immediately:
   - Total Tokens: 2,753
   - Total Cost: ₹0.0851
   - 2 API requests
   - Food analysis and weight detection breakdowns

### Step 5: Test Time Range Filters
1. Tap each filter pill: **Today**, **Week**, **Month**, **All**
2. Notice the active pill turns green
3. With demo data, all filters show the same data
4. With real data, filters will update the metrics

### Step 6: Test Refresh
1. Scroll down to see the green floating button (bottom-right)
2. Tap the refresh button
3. Icon should spin during refresh
4. "Last updated" timestamp should update

### Step 7: Test with Real Data
1. Toggle demo mode to **OFF** (gray)
2. Dashboard will fetch real data from the API
3. If you have no token usage, it will show zeros
4. Check browser console for any API errors

## 🧪 Testing Checklist

### ✅ Visual Testing (Mobile - 375px width)

#### Header Section
- [ ] Dashboard title displays correctly
- [ ] Close (X) button is visible
- [ ] Header stays sticky when scrolling
- [ ] Backdrop blur effect is visible
- [ ] Time range pills are horizontally scrollable

#### Demo Mode Banner
- [ ] Yellow banner displays at top
- [ ] Toggle switch works (tap to toggle)
- [ ] Switch slides smoothly between states
- [ ] Active state is green, inactive is gray

#### Summary Cards
- [ ] 4 cards in 2x2 grid layout
- [ ] Cards have glassmorphic effect (semi-transparent white)
- [ ] Icons render correctly (Activity, DollarSign, TrendingUp, Zap)
- [ ] Numbers are large and bold
- [ ] Input/Output breakdown shows in Total Tokens card
- [ ] Request count shows in Total Cost card

#### Quick Stats Card
- [ ] Card displays with Sparkles icon
- [ ] Most used operation shows with colored badge
- [ ] Primary model name displays

#### Usage by Operation Section
- [ ] Section header "Usage by Operation" displays
- [ ] Each operation has its own card
- [ ] Operation badges are color-coded (green/blue)
- [ ] Percentage displays in top-right
- [ ] 2x2 stats grid shows Tokens, Cost, Requests, Avg/Request
- [ ] Progress bar animates to correct percentage
- [ ] Progress bar is green

#### Recent Activity Section
- [ ] Section header with Clock icon displays
- [ ] List contains activity items
- [ ] Each item shows operation badge + timestamp
- [ ] Tokens and cost display correctly
- [ ] Input → Output flow shows
- [ ] Items are separated by borders

#### Footer
- [ ] "Last updated" timestamp displays
- [ ] Time format is readable (e.g., "Dec 16, 12:43 PM")

#### Floating Refresh Button
- [ ] Green circular button at bottom-right
- [ ] Button floats above content
- [ ] Icon is visible (RefreshCw)
- [ ] Button has shadow

### ✅ Interaction Testing

#### Time Range Filters
- [ ] Tap "Today" - pill turns green, data updates
- [ ] Tap "Week" - pill turns green, data updates
- [ ] Tap "Month" - pill turns green, data updates
- [ ] Tap "All" - pill turns green, data updates
- [ ] Only one pill is active at a time
- [ ] Pills are horizontally scrollable on small screens

#### Demo Data Toggle
- [ ] Tap toggle switch
- [ ] Switch slides to opposite side
- [ ] Background color changes (green/gray)
- [ ] Data updates immediately
- [ ] Console shows no errors

#### Refresh Button
- [ ] Tap floating button
- [ ] Icon rotates/spins during refresh
- [ ] Button is disabled during refresh (opacity 50%)
- [ ] "Last updated" timestamp updates after refresh
- [ ] Data re-fetches from API (or reloads demo data)

#### Close Button
- [ ] Tap X button in header
- [ ] Dashboard closes
- [ ] Returns to main app screen
- [ ] No console errors

### ✅ API Testing

#### Demo Mode (No API calls)
```bash
# Open browser console (F12)
# Toggle demo mode ON
# Check console - should see NO API calls
# Data loads instantly from DEMO_DATA constant
```

#### Real Mode (API calls)
```bash
# Open browser console (F12)
# Toggle demo mode OFF
# Check console for:
# - Fetch request to /api/get-token-usage
# - Response status 200
# - JSON response with data object
```

#### API Response Validation
```bash
# Make direct API call
curl "http://localhost:3000/api/get-token-usage?email=test@example.com&timeRange=month"

# Expected response:
{
  "success": true,
  "data": {
    "summary": { ... },
    "byOperation": [ ... ],
    "byModel": [ ... ],
    "recentUsage": [ ... ],
    "dailyStats": [ ... ],
    "timeRange": "month",
    "generatedAt": "2025-12-16T..."
  }
}
```

### ✅ Responsive Testing

#### Mobile (320px - 480px)
- [ ] Dashboard fits screen width
- [ ] No horizontal scrolling (except time filters)
- [ ] Text is readable without zooming
- [ ] Touch targets are at least 44px
- [ ] Cards stack vertically (except 2x2 grid)

#### Tablet (640px - 1024px)
- [ ] Dashboard is centered
- [ ] Cards have appropriate spacing
- [ ] Text remains readable

#### Desktop (> 1024px)
- [ ] Dashboard max-width is 448px (max-w-md)
- [ ] Content is centered
- [ ] Hover effects work on buttons

### ✅ Browser Testing

#### Chrome/Edge
- [ ] Backdrop blur works
- [ ] All animations smooth
- [ ] No console errors

#### Safari (iOS)
- [ ] Backdrop blur works
- [ ] Touch interactions responsive
- [ ] No layout shifts

#### Firefox
- [ ] Backdrop blur works (v103+)
- [ ] Colors render correctly
- [ ] No console errors

### ✅ Performance Testing

#### Load Time
- [ ] Initial render < 1 second
- [ ] Lazy loading works (Suspense)
- [ ] No flash of unstyled content

#### API Response Time
- [ ] API responds in < 500ms
- [ ] Loading state shows during fetch
- [ ] No UI blocking

#### Smooth Animations
- [ ] Progress bars animate smoothly (500ms)
- [ ] Toggle switch slides smoothly
- [ ] Refresh icon spins smoothly
- [ ] No janky scrolling

## 🐛 Common Issues & Fixes

### Issue: Dashboard won't open
**Symptoms**: Click "AI Token Monitor" but nothing happens

**Fix**:
1. Check browser console for errors
2. Verify AdminDashboard.js exists in `frontend/src/components/`
3. Verify import path in App.js: `import('./components/AdminDashboard')`
4. Clear browser cache and reload

### Issue: API returns 404
**Symptoms**: "Failed to fetch token usage data" in console

**Fix**:
1. Verify backend is running on port 3000
2. Check `get-token-usage.js` exists in `backend/pages/api/`
3. Test API directly: `curl http://localhost:3000/api/get-token-usage?email=test@example.com`
4. Check REACT_APP_API_BASE_URL in frontend/.env

### Issue: Demo data not showing
**Symptoms**: Toggle is ON but data is zeros

**Fix**:
1. Check browser console for errors
2. Verify DEMO_DATA constant in AdminDashboard.js
3. Check showDemoData state in React DevTools
4. Hard refresh browser (Ctrl+Shift+R)

### Issue: Database connection error
**Symptoms**: API returns 500, error in backend logs

**Fix**:
1. Verify MySQL is running
2. Check database name: `wellness_buddy`
3. Check table exists: `ai_token_usage_table`
4. Verify .env variables:
   ```
   DB_HOST=localhost
   DB_USER=root
   DB_PASS=
   DB_NAME=wellness_buddy
   ```

### Issue: Glassmorphism not visible
**Symptoms**: Cards look solid white, no blur effect

**Fix**:
1. Update browser to latest version
2. Check backdrop-filter support: caniuse.com/css-backdrop-filter
3. Fallback: Cards will still look good with solid white

### Issue: Touch targets too small
**Symptoms**: Hard to tap buttons on mobile

**Fix**:
1. Check button padding: should be `py-2` or `py-3`
2. Verify minimum height: 44px
3. Increase padding in Tailwind classes

### Issue: Horizontal scrolling on mobile
**Symptoms**: Can scroll left/right on dashboard

**Fix**:
1. Check for elements wider than screen
2. Verify `max-w-md` on container
3. Add `overflow-x-hidden` if needed
4. Check time filter pills (intentional horizontal scroll)

## 📊 Sample Test Data

### Create Test Token Records (SQL)
```sql
-- Insert test records into ai_token_usage_table
INSERT INTO ai_token_usage_table 
(UserId, Email, OperationType, ModelName, InputTokens, OutputTokens, TotalTokens, InputTokenCost, OutputTokenCost, TotalTokenCost, CreatedAt)
VALUES
(1, 'test@example.com', 'food_analysis', 'gemini-2.5-flash-lite', 1037, 146, 1183, 0.0070, 0.0397, 0.0467, NOW()),
(1, 'test@example.com', 'weight_detection', 'gemini-2.5-flash-lite', 850, 120, 970, 0.0058, 0.0326, 0.0384, NOW());
```

### Verify Data
```sql
-- Check total records
SELECT COUNT(*) FROM ai_token_usage_table;

-- Check recent records
SELECT * FROM ai_token_usage_table ORDER BY CreatedAt DESC LIMIT 10;

-- Check aggregations
SELECT 
  OperationType,
  COUNT(*) as requests,
  SUM(TotalTokens) as total_tokens,
  SUM(TotalTokenCost) as total_cost
FROM ai_token_usage_table
GROUP BY OperationType;
```

## 🎯 Success Criteria

Your implementation is successful if:

✅ **Visual**
- All UI elements render correctly on mobile (375px)
- Glassmorphism effect is visible
- Colors match design (green shades, no gradients)
- Icons display properly
- Text is readable

✅ **Functional**
- Demo mode toggle works
- Time range filters update data
- Refresh button fetches new data
- Close button returns to main app
- No console errors

✅ **Performance**
- Dashboard loads in < 1 second
- API responds in < 500ms
- Animations are smooth (60fps)
- No UI blocking during data fetch

✅ **Mobile**
- Fits screen width (no horizontal scroll)
- Touch targets are ≥ 44px
- Scrolling is smooth
- Responsive layout works

## 📝 Test Report Template

Copy this template to document your testing:

```markdown
# AI Token Monitor - Test Report

**Date**: YYYY-MM-DD
**Tester**: Your Name
**Environment**: Local Development
**Browser**: Chrome/Safari/Firefox (Version)
**Device**: Desktop/Mobile (Model)

## Visual Tests
- [ ] Header displays correctly
- [ ] Summary cards in 2x2 grid
- [ ] Glassmorphism effect visible
- [ ] Icons render properly
- [ ] Colors match design

## Functional Tests
- [ ] Demo toggle works
- [ ] Time filters update data
- [ ] Refresh button works
- [ ] Close button works
- [ ] No console errors

## API Tests
- [ ] API returns 200 status
- [ ] Response format correct
- [ ] Data aggregations accurate
- [ ] Time filters work
- [ ] Error handling works

## Performance
- Load time: ___ seconds
- API response: ___ ms
- Smooth animations: Yes/No

## Issues Found
1. Issue description
   - Severity: High/Medium/Low
   - Steps to reproduce
   - Expected vs Actual

## Screenshots
[Attach screenshots of dashboard]

## Notes
[Any additional observations]
```

## 🚀 Next Steps After Testing

1. **Fix Issues**: Address any bugs found during testing
2. **Add Role Check**: Implement admin-only access (future)
3. **Hide Demo Toggle**: Remove in production build
4. **Optimize Queries**: Add database indexes if slow
5. **Add Charts**: Consider lightweight chart library
6. **Export Feature**: Add CSV export option

---

**Testing Guide Version**: 1.0  
**Last Updated**: December 16, 2025  
**Estimated Testing Time**: 30 minutes  
**Required Tools**: Browser DevTools, MySQL client
