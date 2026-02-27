# 🔄 Cache Update Mechanism

## Overview
This document explains how the Wellness Valley PWA ensures users **immediately get the latest version** when the app is updated.

---

## 🎯 Problem We Solved
**Before:** Users would see stale/cached content after app updates because:
- Static cache name (`wellness-valley-v2`) never changed
- Cache-first strategy served old files
- No notification when updates were available

**After:** Users get the latest version immediately with:
- ✅ Dynamic cache versioning (unique per build)
- ✅ Network-first strategy for HTML
- ✅ Automatic update notifications
- ✅ Instant cache invalidation on deployment

---

## 🏗️ How It Works

### 1. **Build-Time Cache Versioning**
Every build generates a unique cache version:

```javascript
// service-worker.js
const VERSION = '2.0.1709040123456'; // Unique timestamp per build
const CACHE_NAME = `wellness-valley-${VERSION}`;
```

**Process:**
1. Developer runs `npm run build`
2. React builds the app
3. `postbuild` script runs automatically
4. `update-sw-version.js` replaces `BUILD_TIMESTAMP` with current timestamp
5. Service worker now has unique cache name

### 2. **Smart Caching Strategy**

#### **HTML/Navigation (Network-First)**
```javascript
// Always fetch latest HTML first, fallback to cache if offline
fetch(request) → cache → offline page
```
✅ Ensures users see latest app version immediately

#### **Static Assets (Cache-First)**
```javascript
// CSS/JS/images served from cache for speed
cache → network → store in cache
```
✅ Fast loading while staying up-to-date

#### **API Calls (Network-Only)**
```javascript
// Never cache API responses in service worker
Always fetch from server
```
✅ Real-time data, no stale API responses

### 3. **Automatic Update Detection**

**Service Worker (`service-worker.js`):**
```javascript
self.addEventListener('activate', () => {
  // 1. Delete all old caches
  // 2. Take control of all pages immediately
  // 3. Notify all open tabs about update
  clients.postMessage({ type: 'SW_UPDATED', version })
});
```

**Frontend (`index.js`):**
```javascript
navigator.serviceWorker.addEventListener('message', (event) => {
  if (event.data.type === 'SW_UPDATED') {
    // Show user-friendly update prompt
    if (confirm('New version available! Update now?')) {
      window.location.reload();
    }
  }
});
```

### 4. **Periodic Update Checks**
Every 5 minutes, check for new version:
```javascript
setInterval(() => registration.update(), 5 * 60 * 1000);
```

---

## 📦 Cache Types

### **App Cache** (`wellness-valley-{VERSION}`)
Stores static app files:
- HTML, CSS, JavaScript
- Icons, images
- Manifest file

### **Data Cache** (Future Enhancement)
Could store:
- User preferences
- Nutrition data for offline use
- Recent meals history

---

## 🚀 Deployment Flow

```
Developer                Build System              User's Browser
   │                          │                          │
   │─── npm run build ───────>│                          │
   │                          │                          │
   │                   [React Build]                     │
   │                          │                          │
   │                   [postbuild script]                │
   │                    Update VERSION                   │
   │                    to timestamp                     │
   │                          │                          │
   │─── Deploy to server ────>│                          │
   │                          │                          │
   │                          │<─── User visits app ────│
   │                          │                          │
   │                          │─── New SW detected ────>│
   │                          │                          │
   │                          │   [Install new SW]       │
   │                          │   [Delete old cache]     │
   │                          │                          │
   │                          │── Show update prompt ───>│
   │                          │                          │
   │                          │<─── User clicks OK ─────│
   │                          │                          │
   │                          │─── Reload with new ────>│
   │                          │     version               │
```

---

## 🧪 Testing Updates

### **Local Testing:**
1. Build version 1:
   ```powershell
   npm run build
   npx serve -s build -l 3000
   ```

2. Make a visible change (e.g., change button color)

3. Build version 2:
   ```powershell
   npm run build
   ```

4. The running app should detect update and prompt user

### **Browser DevTools Testing:**
1. Open Chrome DevTools → Application → Service Workers
2. Check "Update on reload"
3. See cache versions change with each reload
4. Verify old caches are deleted

### **Network Simulation:**
1. DevTools → Network → Offline
2. Reload app
3. Should still work (cached version)
4. Go online → new version detected

---

## 📊 Cache Statistics

**View cache stats in browser console:**
```javascript
cacheStats() // Shows memory usage, entries, hit rate
```

**Clear cache manually:**
```javascript
window.__cacheManager.clearAll()
```

---

## 🔧 Configuration

### **Cache TTLs** (frontend/src/services/cacheManager.js)
```javascript
ttls: {
  userContext: 5 * 60 * 1000,        // 5 minutes
  disciplineReport: 3 * 60 * 1000,   // 3 minutes
  foodCorrections: 5 * 60 * 1000,    // 5 minutes
  default: 5 * 60 * 1000             // 5 minutes
}
```

### **Update Check Interval** (frontend/src/index.js)
```javascript
setInterval(() => registration.update(), 5 * 60 * 1000); // 5 minutes
```

---

## ⚠️ Important Notes

1. **Production Only**: Service worker only active in production builds
   ```javascript
   if (process.env.NODE_ENV === 'production') { ... }
   ```

2. **HTTPS Required**: Service workers only work on HTTPS (or localhost)

3. **Cache Names**: Never manually increment cache name - it's automatic

4. **API Caching**: API responses are NOT cached by service worker
   - Handled by `cacheManager.js` (in-memory, session-based)

---

## 🐛 Troubleshooting

### **Users not seeing updates?**
1. Check browser console for service worker logs
2. Verify `postbuild` script ran (`✅ Service Worker version updated` in build logs)
3. Check cache name has unique timestamp
4. Clear browser cache: DevTools → Application → Clear Storage

### **Update prompt not showing?**
1. Check if `navigator.serviceWorker.addEventListener('message')` is registered
2. Verify old service worker is being replaced (not just updated)
3. Check console for `🔄 [PWA] Update found, installing...`

### **Files still cached?**
1. Service worker might be stuck: DevTools → Application → Service Workers → Unregister
2. Hard refresh: `Ctrl + Shift + R` (Windows) or `Cmd + Shift + R` (Mac)
3. Check `activate` event is deleting old caches

---

## 📝 Summary

✅ **Automatic cache versioning** - Each build = new cache  
✅ **Immediate updates** - Network-first for HTML  
✅ **User notifications** - Prompts to reload for updates  
✅ **Offline support** - Cached fallbacks when network fails  
✅ **Zero configuration** - All automatic on build  
✅ **Memory efficient** - Old caches auto-deleted  

**Result:** Users **always see the latest version** within 5 minutes of deployment! 🎉
