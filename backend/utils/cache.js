/**
 * Simple In-Memory Cache for API Responses
 * 
 * PERFORMANCE OPTIMIZATION:
 * Cache frequently accessed data to reduce database queries
 * 
 * For production, consider Redis or Vercel KV for persistence
 */

class SimpleCache {
  constructor() {
    this.cache = new Map();
    this.expiryTimes = new Map();
  }

  /**
   * Set a cache entry with TTL (Time To Live)
   * @param {string} key Cache key
   * @param {*} value Value to cache
   * @param {number} ttl Time to live in milliseconds (default: 5 minutes)
   */
  set(key, value, ttl = 300000) {
    this.cache.set(key, value);
    this.expiryTimes.set(key, Date.now() + ttl);
    
    // Auto-cleanup after TTL
    setTimeout(() => {
      this.delete(key);
    }, ttl);
  }

  /**
   * Get a cache entry
   * @param {string} key Cache key
   * @returns {*} Cached value or null if expired/not found
   */
  get(key) {
    const expiry = this.expiryTimes.get(key);
    
    // Check if expired
    if (expiry && Date.now() > expiry) {
      this.delete(key);
      return null;
    }
    
    return this.cache.get(key) || null;
  }

  /**
   * Check if key exists and is not expired
   * @param {string} key Cache key
   * @returns {boolean}
   */
  has(key) {
    return this.get(key) !== null;
  }

  /**
   * Delete a cache entry
   * @param {string} key Cache key
   */
  delete(key) {
    this.cache.delete(key);
    this.expiryTimes.delete(key);
  }

  /**
   * Delete all cache entries matching a pattern
   * @param {string} pattern Pattern to match (e.g., 'user:123:')
   */
  deletePattern(pattern) {
    const keys = Array.from(this.cache.keys());
    let deleted = 0;
    keys.forEach(key => {
      if (key.includes(pattern)) {
        this.delete(key);
        deleted++;
      }
    });
    return deleted;
  }

  /**
   * Clear all cache entries
   */
  clear() {
    this.cache.clear();
    this.expiryTimes.clear();
  }

  /**
   * Get cache statistics
   * @returns {object} Cache stats
   */
  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

// Export singleton instance
export const cache = new SimpleCache();

/**
 * Cache decorator for API handlers
 * Wraps an API handler with caching logic
 * 
 * @param {Function} handler Original API handler
 * @param {Function} keyGenerator Function to generate cache key from req
 * @param {number} ttl Cache TTL in milliseconds
 * @returns {Function} Wrapped handler
 */
export function withCache(handler, keyGenerator, ttl = 300000) {
  return async (req, res) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return handler(req, res);
    }

    const cacheKey = keyGenerator(req);
    const cached = cache.get(cacheKey);

    if (cached) {
      console.log(`✅ Cache HIT: ${cacheKey}`);
      // Add cache header
      res.setHeader('X-Cache', 'HIT');
      return res.status(200).json(cached);
    }

    console.log(`❌ Cache MISS: ${cacheKey}`);
    
    // Intercept response to cache it
    const originalJson = res.json.bind(res);
    res.json = function(data) {
      if (res.statusCode === 200) {
        cache.set(cacheKey, data, ttl);
      }
      res.setHeader('X-Cache', 'MISS');
      return originalJson(data);
    };

    return handler(req, res);
  };
}

/**
 * Helper to generate cache keys
 */
export const cacheKeys = {
  userProfile: (email) => `user:profile:${email}`,
  userContext: (userId) => `user:context:${userId}`,
  teamMembers: (coachId) => `team:members:${coachId}`,
  nutritionStats: (userId, date) => `nutrition:stats:${userId}:${date}`,
  nutritionMeals: (userId) => `nutrition:meals:${userId}`,
  educationSummary: (userId) => `education:summary:${userId}`,
};

export default cache;
