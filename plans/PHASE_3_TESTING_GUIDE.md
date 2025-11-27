# Phase 3: Visual Feedback - Testing Guide

## 🎯 Overview
Test the sync status indicator that shows "Syncing...", "Saved ✓", and "Failed ⚠️" states during auto-save operations.

## 📋 Pre-Test Setup
1. **Start the app**: `npm start` in `frontend/` directory
2. **Open Nutrition Dashboard**: Click "Nutrition" from main menu
3. **Load a meal**: Breakfast, Lunch, or Dinner with existing food items

---

## ✅ Test Cases

### Test 1: Weight Change - Debounced Save (Phase 1)
**Expected Behavior**: After typing weight, see "Syncing..." → "Saved ✓" → fade out

**Steps**:
1. Click **Edit** on any food item
2. Change weight in grams field (e.g., `100` → `150`)
3. Stop typing and wait 1 second

**Pass Criteria**:
- [ ] "Syncing..." appears with spinning loader
- [ ] After ~1s, changes to "Saved ✓" with checkmark
- [ ] "Saved ✓" fades out after 1.5 seconds
- [ ] Status indicator is smooth, no flickering
- [ ] Edit mode stays open

**Fail If**:
- Status doesn't appear
- Multiple status indicators appear
- Status doesn't fade out
- Edit mode closes

---

### Test 2: Food Selection - Instant Save (Phase 2)
**Expected Behavior**: Instant "Syncing..." when selecting food, then "Saved ✓"

**Steps**:
1. Click **Edit** on a food item
2. Search for a food (e.g., "chicken")
3. Click a search result

**Pass Criteria**:
- [ ] "Syncing..." appears immediately (within 150ms)
- [ ] Changes to "Saved ✓" quickly
- [ ] Checkmark is green and clear
- [ ] Fades out after 1.5s
- [ ] Edit mode stays open

**Fail If**:
- Delay before status appears
- Status is wrong color
- Doesn't fade out

---

### Test 3: Dropdown Change - Instant Save (Phase 2)
**Expected Behavior**: Instant sync status when changing serving size

**Steps**:
1. Click **Edit** on a food item with multiple serving sizes
2. Open serving dropdown
3. Select different serving size (e.g., "1 cup" → "1 piece")

**Pass Criteria**:
- [ ] "Syncing..." appears instantly
- [ ] Changes to "Saved ✓" 
- [ ] Weight updates correctly
- [ ] Status fades out
- [ ] Edit mode stays open

**Fail If**:
- No status indicator
- Wrong serving size saved
- Multiple indicators appear

---

### Test 4: Rapid Changes - No Flickering
**Expected Behavior**: Only final "Saved ✓" appears, no flickering

**Steps**:
1. Click **Edit** on a food item
2. Rapidly type in weight field: `1` → `10` → `100` → `150`
3. Stop typing

**Pass Criteria**:
- [ ] See "Syncing..." during typing
- [ ] Only ONE final "Saved ✓" after typing stops
- [ ] No multiple status indicators
- [ ] Smooth animation, no flickering
- [ ] Final value is 150g

**Fail If**:
- Multiple "Saved ✓" appear
- Status flickers/bounces
- Wrong final value saved

---

### Test 5: Error State (Simulated)
**Expected Behavior**: "Failed ⚠️" appears and stays visible on error

**Steps**:
1. **Simulate error**: Temporarily break internet connection OR modify code to throw error
2. Click **Edit** on a food item
3. Try to change weight or food

**Pass Criteria**:
- [ ] "Failed to save" appears in red
- [ ] Warning icon (⚠️) visible
- [ ] Status stays visible (doesn't fade)
- [ ] Can still edit and retry

**Fail If**:
- No error indicator
- Error fades away
- Can't retry

---

### Test 6: Done Button - No Status After Close
**Expected Behavior**: Clicking "Done" closes edit mode and clears status

**Steps**:
1. Click **Edit** on a food item
2. Change weight (see "Saved ✓")
3. Immediately click **Done** button

**Pass Criteria**:
- [ ] Edit mode closes
- [ ] Status indicator disappears
- [ ] No lingering status in closed view
- [ ] Changes are persisted

**Fail If**:
- Status still visible after closing
- Changes not saved
- Edit mode doesn't close

---

### Test 7: Multiple Items - Independent Status
**Expected Behavior**: Each food item has its own sync status

**Steps**:
1. Click **Edit** on first food item
2. Change weight (see "Syncing...")
3. While first is syncing, click **Edit** on second food item
4. Change weight on second item

**Pass Criteria**:
- [ ] First item shows its own status
- [ ] Second item shows its own status
- [ ] Statuses don't interfere with each other
- [ ] Both save correctly

**Fail If**:
- Statuses mix between items
- Only one status appears
- Saves conflict

---

### Test 8: Accessibility - Screen Reader
**Expected Behavior**: Status announcements are accessible

**Steps**:
1. Enable screen reader (NVDA/JAWS on Windows, VoiceOver on Mac)
2. Click **Edit** on a food item
3. Change weight

**Pass Criteria**:
- [ ] Screen reader announces "Syncing"
- [ ] Screen reader announces "Saved"
- [ ] Status is navigable with keyboard
- [ ] Color is not the only indicator (has text + icon)

**Fail If**:
- No announcements
- Only color changes (no text/icon)
- Not keyboard accessible

---

## 📊 Summary Checklist

After running all tests:

- [ ] **Test 1**: Weight change shows status ✓
- [ ] **Test 2**: Food selection shows status ✓
- [ ] **Test 3**: Dropdown shows status ✓
- [ ] **Test 4**: No flickering on rapid changes ✓
- [ ] **Test 5**: Error state works ✓
- [ ] **Test 6**: Done button clears status ✓
- [ ] **Test 7**: Multiple items independent ✓
- [ ] **Test 8**: Accessibility works ✓

**Total Passed**: ___/8

---

## 🎨 Visual Verification

Check that:
- [ ] Status indicator is centered and readable
- [ ] Colors are appropriate (blue=syncing, green=saved, red=error)
- [ ] Animations are smooth (no jank)
- [ ] Spinner rotates smoothly
- [ ] Checkmark appears crisp
- [ ] Text is legible on all backgrounds
- [ ] Works on mobile and desktop

---

## 🐛 Common Issues

### Status doesn't appear
- Check console for errors
- Verify `syncStatus` state is updating
- Check if `onUpdate` is being called

### Multiple statuses appear
- Check if Phase 1 timer is being cleared properly
- Verify `isInstantSavingRef` is working

### Status doesn't fade
- Check `syncStatusTimeoutRef` is clearing
- Verify setTimeout is running

### Wrong color/icon
- Check `syncStatus` value in state
- Verify CSS classes are applied

---

## ✅ Success Criteria
Phase 3 passes if:
1. **All 8 tests pass** ✅
2. **Visual feedback is smooth** ✅
3. **Accessible to screen readers** ✅
4. **No performance issues** ✅
5. **Works on mobile & desktop** ✅

---

## 🚀 Next Phase
After Phase 3 passes → **Phase 4: Optimistic Updates**
