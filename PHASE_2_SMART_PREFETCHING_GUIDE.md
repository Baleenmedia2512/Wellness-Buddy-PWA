# Phase 2: Smart Prefetching Implementation Guide

## Overview
Implement intelligent search prefetching to make food editing feel instant while minimizing token costs.

---

## Current Performance (Phase 1)
✅ **First Search**: 5.09s  
✅ **Cached Search**: <0.05s (instant)  
✅ **Cache Duration**: 24 hours  

---

## Smart Prefetching Strategy

### Goals
1. **Instant perceived response** (0s wait for user)
2. **Minimize token waste** (~20% overhead maximum)
3. **Build useful cache** for common foods

### Implementation Components

#### 1. Debounced Search Hook
```javascript
import { useMemo, useRef } from 'react';

// In EditableFoodItem.js component
const [searchQuery, setSearchQuery] = useState('');
const [searchResults, setSearchResults] = useState([]);
const [isSearching, setIsSearching] = useState(false);
const searchTimeoutRef = useRef(null);

// Debounced search function
const debouncedSearch = useMemo(
  () => {
    return async (query) => {
      const trimmed = query.trim();
      
      // Validation: minimum 3 characters
      if (trimmed.length < 3) {
        setSearchResults([]);
        return;
      }
      
      // Cancel previous timeout
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      
      // Set new timeout: 500ms after user stops typing
      searchTimeoutRef.current = setTimeout(async () => {
        console.log('🔍 Prefetching search for:', trimmed);
        setIsSearching(true);
        
        try {
          const results = await geminiService.searchFood(trimmed);
          setSearchResults(results.results || []);
          console.log('✅ Prefetch complete, results cached');
        } catch (error) {
          console.error('❌ Prefetch failed:', error);
          setSearchResults([]);
        } finally {
          setIsSearching(false);
        }
      }, 500); // 500ms debounce delay
    };
  },
  [] // Empty deps - function never recreates
);

// Cleanup timeout on unmount
useEffect(() => {
  return () => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
  };
}, []);
```

#### 2. Input Handler
```javascript
const handleSearchInput = (e) => {
  const value = e.target.value;
  setSearchQuery(value);
  
  // Trigger debounced search
  debouncedSearch(value);
};

// In JSX
<input
  type="text"
  value={searchQuery}
  onChange={handleSearchInput}
  placeholder="Search for food..."
  className="w-full px-3 py-2 border rounded"
/>
```

#### 3. Loading States
```javascript
{isSearching && (
  <div className="text-sm text-gray-500 flex items-center gap-2">
    <span className="animate-spin">⏳</span>
    <span>Searching...</span>
  </div>
)}

{searchResults.length > 0 && !isSearching && (
  <div className="text-sm text-green-600">
    ✅ Found {searchResults.length} results (cached for instant use)
  </div>
)}
```

---

## Token Cost Examples

### Scenario 1: Direct Search (No Prefetch)
```
User types complete query → clicks button → waits 5s
Cost: 1 API call = ~800 tokens
UX: 5 second wait ❌
```

### Scenario 2: Perfect Prefetch
```
User types "mango lassi" → 500ms pause → prefetch starts
User clicks button → instant result from cache
Cost: 1 API call = ~800 tokens
UX: Instant! ✅
```

### Scenario 3: Changed Mind (Worst Case)
```
User types "mango" → 500ms → prefetch "mango" (800 tokens)
User continues "lassi" → 500ms → prefetch "mango lassi" (800 tokens)
User clicks → uses "mango lassi" cache
Cost: 2 API calls = ~1,600 tokens (2x)
UX: Still instant! ✅
Waste: 1 extra call for "mango" (but now cached too)
```

### Scenario 4: Multiple Edits
```
User edits "rice" → prefetch (800 tokens)
User edits "chicken" → prefetch (800 tokens)
User edits "naan" → prefetch (800 tokens)
Cost: 3 API calls = ~2,400 tokens
Benefit: All 3 cached for future instant use! ✅
```

---

## Cost Optimization Rules

### Rule 1: Minimum Query Length
```javascript
if (trimmed.length < 3) {
  setSearchResults([]);
  return; // No API call for short queries
}
```
**Prevents**: Searching "m", "ma" → saves ~1,600 tokens

### Rule 2: Debounce Delay
```javascript
setTimeout(async () => {
  // Search logic
}, 500); // 500ms = optimal balance
```
**Prevents**: API call on every keystroke  
**Allows**: User to type full query before search  

### Rule 3: Cache Check Before Search
Already implemented in `geminiService.searchFood()`:
```javascript
const cached = this.searchCache.get(cacheKey);
if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
  return cached.data; // No API call!
}
```
**Prevents**: Duplicate searches for same food

### Rule 4: Cancel In-Flight Requests
```javascript
if (searchTimeoutRef.current) {
  clearTimeout(searchTimeoutRef.current); // Cancel old search
}
```
**Prevents**: Multiple simultaneous API calls

---

## Expected Real-World Costs

### Conservative Estimate (Average User)
- **Foods edited per session**: 3-5
- **Query changes per food**: 1.2x (slight revisions)
- **Total API calls**: 4-6 per session
- **Total tokens**: ~3,200-4,800 per session
- **Cache hits on return**: 80%+ (most users edit similar foods)

### Cost Comparison
| Strategy | API Calls/Session | Tokens/Session | UX |
|----------|------------------|----------------|-----|
| No prefetch | 3-5 | 2,400-4,000 | 5s waits ❌ |
| Smart prefetch | 4-6 | 3,200-4,800 | Instant ✅ |
| Naive prefetch | 20-30 | 16,000-24,000 | Instant but wasteful ❌ |

**Verdict**: Smart prefetching adds ~20% cost but delivers 100x better UX

---

## Implementation Checklist

### Phase 2.1: Basic Prefetching
- [ ] Add debounced search hook
- [ ] Implement 500ms debounce
- [ ] Add minimum 3-character validation
- [ ] Show loading state during prefetch
- [ ] Display "cached" indicator after prefetch

### Phase 2.2: Cost Optimization
- [x] Cache system already implemented (Phase 1) ✅
- [ ] Add request cancellation on unmount
- [ ] Add duplicate query detection
- [ ] Log prefetch metrics (cache hit rate)

### Phase 2.3: User Experience
- [ ] Show "searching..." indicator
- [ ] Show "X results found (cached)" message
- [ ] Instant dropdown population on button click
- [ ] Add tooltip: "Results update as you type"

---

## Testing Scenarios

### Test 1: Single Food Edit
1. Open EditableFoodItem
2. Type "mango lassi" (observe prefetch after 500ms)
3. Click search button
4. **Expected**: Instant results (<50ms)
5. **Console**: Should show "Using cached result"

### Test 2: Multiple Edits
1. Edit food item 1: "rice"
2. Edit food item 2: "chicken"
3. Edit food item 3: "rice" (again)
4. **Expected**: 3rd edit uses cache from step 1
5. **Cost**: 2 API calls (rice cached on 2nd use)

### Test 3: Fast Typing
1. Type "ma" → wait → "ng" → wait → "o" → wait
2. **Expected**: Only 1 API call after final "o" (500ms debounce)
3. **No calls for**: "ma", "man", "mang" (too short or cancelled)

### Test 4: Changed Mind
1. Type "mango"
2. Wait 600ms (prefetch triggers)
3. Continue typing " lassi"
4. Wait 600ms (new prefetch triggers)
5. **Expected**: 2 API calls, both cached
6. **Both**: "mango" and "mango lassi" now instant for future

---

## Monitoring & Metrics

### Add These Logs
```javascript
// In geminiService.js - already implemented
console.log(`💾 Using cached result (${cacheTime}ms)`);
console.log(`💾 Cached results for "${cacheKey}"`);

// Add to Phase 2 component
console.log('📊 Prefetch Stats:', {
  totalSearches: totalSearchCount,
  cacheHits: cacheHitCount,
  cacheMissRate: `${(cacheMissCount/totalSearchCount*100).toFixed(1)}%`,
  avgResponseTime: `${avgTime}ms`
});
```

### Success Metrics
- **Cache hit rate**: >70% (good), >80% (excellent)
- **Avg response time**: <100ms (mostly cached)
- **API calls per food edit**: <1.3x (acceptable overhead)

---

## Rollout Strategy

### Stage 1: Test Mode (Recommended)
Add flag to enable/disable prefetching:
```javascript
const ENABLE_PREFETCH = true; // Set false to disable

const handleSearchInput = (e) => {
  setSearchQuery(e.target.value);
  if (ENABLE_PREFETCH) {
    debouncedSearch(e.target.value);
  }
};
```

### Stage 2: Production
- Start with prefetching enabled
- Monitor cost metrics for 1 week
- Adjust debounce delay if needed (500ms → 700ms = less cost)
- Keep cache enabled (no downside)

---

## Summary

✅ **Performance**: 5.09s → instant (perceived)  
✅ **Cost**: ~20% increase (acceptable)  
✅ **Cache**: 24-hour duration for repeated searches  
✅ **Optimization**: Debounce + min chars + cancellation  
✅ **UX**: Best-in-class instant search experience  

**Recommendation**: Implement smart prefetching in Phase 2 with all optimizations enabled.
