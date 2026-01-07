# 🔧 Critical API Migrations - Copy/Paste Ready

This file contains ready-to-use code snippets for updating your most critical API endpoints.

---

## 1. get-token-usage.js (Admin Dashboard)

### Find these lines (around line 1-35):
```javascript
import mysql from 'mysql2/promise';

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'wellness_buddy',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

export default async function handler(req, res) {
  // ... CORS handling ...
  
  let connection;
  try {
    // ...
    
    // Create database connection
    connection = await mysql.createConnection(dbConfig);
```

### Replace with:
```javascript
import { getPool } from '../../utils/dbPool.js';
import { cache, cacheKeys } from '../../utils/cache.js';

// Note: dbConfig is now in dbPool.js, no need to repeat it here

export default async function handler(req, res) {
  // ... CORS handling ...
  
  try {
    // ... email and parameter validation ...
    
    // Check cache (1 minute TTL for token data)
    const cacheKey = `token:usage:${email}:${timeRange}:${operationType}:${model}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      return res.status(200).json(cached);
    }
    
    // Use connection pool instead of creating new connection
    const pool = getPool();
```

### Find all instances of `connection.execute` and replace with `pool.execute`

### Remove all instances of:
```javascript
await connection.end();
```

### Before the final `res.status(200).json(...)`, add:
```javascript
const response = { /* your response object */ };

// Cache for 1 minute (token data changes frequently)
cache.set(cacheKey, response, 60000);
res.setHeader('X-Cache', 'MISS');

return res.status(200).json(response);
```

---

## 2. user/status.js (User Authentication Status)

### Find (around line 59):
```javascript
const connection = await mysql.createConnection(dbConfig);
```

### Replace with:
```javascript
import { getPool } from '../../../utils/dbPool.js';
import { cache, cacheKeys } from '../../../utils/cache.js';

// In handler function:
const pool = getPool();
```

### Add caching (before the database query):
```javascript
// Cache key based on email
const cacheKey = `user:status:${email}`;
const cached = cache.get(cacheKey);

if (cached) {
  res.setHeader('X-Cache', 'HIT');
  return res.status(200).json(cached);
}
```

### Before final response, add:
```javascript
const response = { /* your response */ };

// Cache for 2 minutes (user status can change)
cache.set(cacheKey, response, 120000);
res.setHeader('X-Cache', 'MISS');

return res.status(200).json(response);
```

### Remove:
```javascript
await connection.end();
```

---

## 3. coach/discipline-report.js (Discipline Report)

### Find (around line 78):
```javascript
try {
  connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
  });
```

### Replace with:
```javascript
import { getPool } from '../../../utils/dbPool.js';
import { cache, cacheKeys } from '../../../utils/cache.js';

try {
  // Check cache (5 minutes for discipline reports)
  const cacheKey = cacheKeys.disciplineReport(coachId, `${dateRange}:${startDate}:${endDate}`);
  const cached = cache.get(cacheKey);
  
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    return res.status(200).json(cached);
  }
  
  const pool = getPool();
```

### Replace all `connection.execute` with `pool.execute`

### Before final response:
```javascript
const response = { success: true, data: teamDiscipline, ... };

// Cache for 5 minutes
cache.set(cacheKey, response, 300000);
res.setHeader('X-Cache', 'MISS');

return res.status(200).json(response);
```

### Remove:
```javascript
await connection.end();
```

---

## 4. get-education-summary.js (Education Dashboard)

### Find (around line 28):
```javascript
connection = await mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME
});
```

### Replace with:
```javascript
import { getPool } from '../../utils/dbPool.js';
import { cache, cacheKeys } from '../../utils/cache.js';

// In handler:
const cacheKey = cacheKeys.educationSummary(userId);
const cached = cache.get(cacheKey);

if (cached) {
  res.setHeader('X-Cache', 'HIT');
  return res.status(200).json(cached);
}

const pool = getPool();
```

### Before final response:
```javascript
const response = { success: true, summary: { /* data */ } };

// Cache for 3 minutes
cache.set(cacheKey, response, 180000);
res.setHeader('X-Cache', 'MISS');

return res.status(200).json(response);
```

### Remove all:
```javascript
await connection.end();
```

---

## 5. Frontend: AdminDashboard.js

### Find (around line 504):
```javascript
const response = await fetch(url);

if (response.ok) {
  const data = await response.json();
  // ... handle data
}
```

### Replace with:
```javascript
import { apiClient } from '../services/apiClient';

// Build the endpoint
let endpoint = `/api/get-token-usage?email=${encodeURIComponent(user?.email)}`;

if (timeRange === 'custom' && customStartDate && customEndDate) {
  endpoint += `&startDate=${customStartDate.toISOString()}&endDate=${customEndDate.toISOString()}`;
} else {
  endpoint += `&timeRange=${timeRange}`;
}

try {
  const data = await apiClient.get(endpoint);
  
  if (data.success) {
    setTokenData(data);
    setLastUpdated(new Date());
  }
} catch (error) {
  console.error('Error fetching token data:', error);
  setError(error.message);
} finally {
  setLoading(false);
  setRefreshing(false);
}
```

---

## 6. Frontend: Header.js

### Find (around line 29):
```javascript
const response = await fetch(
  `${process.env.REACT_APP_API_BASE_URL}/api/user/status?email=${encodeURIComponent(email)}`
);
const data = await response.json();
```

### Replace with:
```javascript
import { apiClient } from '../services/apiClient';

const data = await apiClient.get(
  `/api/user/status?email=${encodeURIComponent(email)}`,
  { cache: true, cacheTTL: 120000 } // 2 minute cache
);
```

---

## 7. Frontend: NutritionDashboard.js

### Find multiple instances of:
```javascript
const response = await fetch(`${apiBaseUrl}/api/...`);
const data = await response.json();
```

### Replace with:
```javascript
import { apiClient } from '../services/apiClient';

const data = await apiClient.get('/api/...');
```

### For POST requests:
```javascript
// Before:
const response = await fetch(`${apiBaseUrl}/api/endpoint`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload)
});

// After:
const data = await apiClient.post('/api/endpoint', payload);
```

---

## 🎯 Quick Checklist

After making changes to each file:

- [ ] Import `getPool` from `../../utils/dbPool.js` (adjust path as needed)
- [ ] Import `cache, cacheKeys` from `../../utils/cache.js` (if caching)
- [ ] Replace `mysql.createConnection` with `getPool()`
- [ ] Replace `connection.execute` with `pool.execute`
- [ ] Remove all `connection.end()` calls
- [ ] Add cache check before database query (for GET requests)
- [ ] Add cache set before response (for GET requests)
- [ ] Add `X-Cache` header to responses
- [ ] Remove `connection` variable declarations

---

## 🧪 Testing After Each Change

1. **Save the file**
2. **Restart your backend** (if local) or **deploy to Vercel**
3. **Test the endpoint** with Postman or browser
4. **Check response headers** for `X-Cache: HIT` or `MISS`
5. **Verify response time** is < 1 second
6. **Test twice** - second request should be cached (much faster)

---

## 💡 Pro Tips

1. **Don't change everything at once** - Update 1-2 files, test, then continue
2. **Keep original files as backup** - Create `.backup` copies before editing
3. **Check Vercel logs** - Monitor for errors after deployment
4. **Clear cache after mutations** - When data changes, clear related cache
5. **Adjust TTL based on data** - Frequently changing data = shorter TTL

---

## 🚨 Common Mistakes to Avoid

❌ **DON'T** create a new pool in each file:
```javascript
// WRONG:
const pool = mysql.createPool(dbConfig);
```

✅ **DO** import and use the singleton:
```javascript
// RIGHT:
import { getPool } from '../../utils/dbPool.js';
const pool = getPool();
```

❌ **DON'T** cache mutation endpoints (POST/PUT/DELETE)

✅ **DO** cache read-only endpoints (GET)

❌ **DON'T** forget to clear cache after updates:
```javascript
// After updating user profile:
cache.delete(cacheKeys.userProfile(email));
```

---

## ⚡ Quick Deploy Command

```bash
cd backend
git add utils/dbPool.js utils/cache.js vercel.json
git add pages/api/get-user-profile.js  # and other modified files
git commit -m "feat: add connection pooling and caching for performance"
git push

cd ../frontend
git add src/services/apiClient.js
git add src/components/*.js  # modified components
git commit -m "feat: use optimized API client with retry and deduplication"
git push
```

Then check Vercel dashboard for deployment status!

---

Happy optimizing! 🚀
