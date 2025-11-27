# Phase 5: Error Handling & Retry - Testing Guide

## 🎯 What Was Implemented

**Auto-Retry System:**
- ✅ 3 retry attempts with exponential backoff (1s, 2s, 4s)
- ✅ 10-second timeout for API calls
- ✅ Visual retry counter: "Retrying... (1/3)"
- ✅ Manual retry button on max retries failure
- ✅ Proper cleanup of retry timers

---

## 🧪 Testing Checklist

### Test 1: Normal Save (Baseline)
**Goal:** Verify normal saves still work

1. Edit a food item
2. Change weight to `150`
3. Wait for save

**Expected:**
- [ ] "Saved ✓" appears after ~1 second
- [ ] No retry messages
- [ ] Green pulse animation
- [ ] Status fades after 1.5s

---

### Test 2: Network Failure - Auto Retry
**Goal:** Test automatic retry with exponential backoff

**Setup:** Simulate network failure
- Open DevTools → Network tab → Select "Offline"

**Steps:**
1. Edit food item, change weight to `200`
2. Observe retry behavior

**Expected:**
- [ ] "Retrying... (1/3)" appears with orange border
- [ ] Wait ~1 second
- [ ] "Retrying... (2/3)" appears
- [ ] Wait ~2 seconds
- [ ] "Retrying... (3/3)" appears
- [ ] Wait ~4 seconds
- [ ] After max retries: "Failed ⚠️" with red border
- [ ] "Retry" button appears next to "Failed"

**Timing Check:**
- Retry 1 → Retry 2: ~1 second delay ✅
- Retry 2 → Retry 3: ~2 second delay ✅
- Retry 3 → Failed: ~4 second delay ✅

---

### Test 3: Manual Retry Button
**Goal:** Verify manual retry works

**Setup:** Continue from Test 2 (in offline mode with "Failed" state)

**Steps:**
1. Click the "Retry" button
2. Go online (DevTools → Network → "No throttling")
3. Click "Retry" again

**Expected:**
- [ ] Clicking retry resets status
- [ ] Retry counter resets to (1/3)
- [ ] When online, retry succeeds
- [ ] "Saved ✓" appears
- [ ] Error state clears

---

### Test 4: Timeout Protection
**Goal:** Test 10-second timeout

**Setup:** Simulate slow network
- DevTools → Network → Select "Slow 3G" or "Fast 3G"

**Steps:**
1. Edit food item
2. Make a change
3. If API takes >10 seconds, should timeout

**Expected:**
- [ ] Request times out after 10 seconds
- [ ] Triggers retry logic
- [ ] Shows "Retrying..." message
- [ ] Eventually succeeds or shows error

**Note:** Hard to test without backend modification. Can verify timeout code exists in handleAutoSave.

---

### Test 5: Success After Retry
**Goal:** Verify system recovers from transient failures

**Setup:**
1. Go offline (DevTools → Network → Offline)
2. Edit item, change weight
3. Wait for 1st retry to start
4. Go back online before max retries

**Expected:**
- [ ] First attempt fails
- [ ] "Retrying... (1/3)" appears
- [ ] When back online, retry succeeds
- [ ] "Saved ✓" appears
- [ ] Retry counter resets to 0

---

### Test 6: Cancel During Retry
**Goal:** Ensure cancel stops retry attempts

**Setup:**
1. Go offline
2. Edit item, trigger save
3. Wait for retry to start
4. Click outside to close edit mode (or press Escape)

**Expected:**
- [ ] Edit mode closes immediately
- [ ] Retry timer stops (no more retries)
- [ ] No background retry attempts continue
- [ ] Console shows no errors

---

### Test 7: Multiple Items - Independent Retries
**Goal:** Verify each item has independent retry logic

**Setup:** Multiple food items visible

**Steps:**
1. Go offline
2. Edit Item 1, make change (triggers retry)
3. Edit Item 2, make change (triggers retry)

**Expected:**
- [ ] Item 1 shows "Retrying... (1/3)"
- [ ] Item 2 shows "Retrying... (1/3)" independently
- [ ] Both retry on their own schedules
- [ ] Retry counts are independent

---

### Test 8: Cleanup on Unmount
**Goal:** Verify no memory leaks

**Steps:**
1. Edit item, trigger save
2. During retry phase, navigate to different page
3. Come back, check for errors

**Expected:**
- [ ] No console errors
- [ ] No "Can't perform state update on unmounted component" warnings
- [ ] Timers properly cleaned up

---

## 🎨 Visual Verification

### Status Indicators:

**Retrying State:**
- Orange spinner icon (animated)
- Orange border on edit container
- Text: "Retrying... (X/3)" where X is current attempt
- Color: Orange/amber theme

**Failed State:**
- Red warning triangle icon
- Red border on edit container
- Text: "Failed" with "Retry" button
- Color: Red theme
- Error persists (doesn't auto-hide)

**Saved State (unchanged):**
- Green checkmark icon
- Blue border with green pulse
- Text: "Saved"
- Auto-fades after 1.5s

---

## 🔍 Console Logs to Expect

```javascript
// On first failure:
❌ Auto-save failed (attempt 1/3): [Error details]

// On retry:
❌ Auto-save failed (attempt 2/3): [Error details]

// On max retries:
❌ Auto-save failed (attempt 3/3): [Error details]

// On timeout:
❌ Auto-save failed (attempt 1/3): Error: Request timeout
```

---

## 🐛 Common Issues

### Issue: Retries happen too fast
**Check:** Verify exponential backoff timing in code (1s, 2s, 4s)

### Issue: Manual retry doesn't work
**Check:** Click handler on retry button, verify handleManualRetry function

### Issue: Error state auto-hides
**Check:** syncStatus should stay 'error' for max retries (no timeout to clear it)

### Issue: Multiple rapid retries
**Check:** retryTimeoutRef cleanup - should clear previous timeout

---

## ✅ Success Criteria

Phase 5 passes if:
- ✅ Auto-retry works with correct timing (1s, 2s, 4s)
- ✅ Retry counter displays correctly
- ✅ Manual retry button works
- ✅ Timeout protection prevents hanging requests
- ✅ UI clearly shows retry vs. saved vs. error states
- ✅ Transient network issues are handled gracefully
- ✅ No memory leaks or console errors
- ✅ Previous phase functionality intact

---

## 📊 Test Results Template

```markdown
## Phase 5 Test Results - [Your Name] - [Date]

### Test 1: Normal Save - PASS/FAIL
Notes:

### Test 2: Network Failure Auto Retry - PASS/FAIL
Timing check:
- Retry 1→2: ___s (expected: 1s)
- Retry 2→3: ___s (expected: 2s)
- Retry 3→Fail: ___s (expected: 4s)

### Test 3: Manual Retry - PASS/FAIL
Notes:

### Test 4: Timeout Protection - PASS/FAIL
Notes:

### Test 5: Success After Retry - PASS/FAIL
Notes:

### Test 6: Cancel During Retry - PASS/FAIL
Notes:

### Test 7: Independent Retries - PASS/FAIL
Notes:

### Test 8: Cleanup on Unmount - PASS/FAIL
Notes:

### Overall Assessment: PASS/FAIL

### Issues Found:
1. 
2. 

### Screenshots:
[Attach screenshots of retry states]
```

---

**Last Updated:** November 27, 2025  
**Phase Status:** Phase 5 - Implementation Complete, Testing Pending
