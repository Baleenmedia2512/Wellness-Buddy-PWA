import { debugLog } from '../utils/logger.js';

/**
 * Global Cache Manager for All Services
 * Provides unified caching and request deduplication across the app
 * 
 * Features:
 * - Automatic cache expiration
 * - Request deduplication (prevent duplicate simultaneous calls)
 * - Memory-efficient storage
 * - Per-service TTL configuration
 */

class CacheManager {
  constructor() {
    this.cache = new Map();
    this.pendingRequests = new Map();
    
    // Default TTLs for different data types (in milliseconds)
    this.ttls = {
      userContext: 5 * 60 * 1000,        // 5 minutes
      teamHierarchy: 3 * 60 * 1000,      // 3 minutes
      foodCorrections: 5 * 60 * 1000,    // 5 minutes
      reverseLookup: 10 * 60 * 1000,     // 10 minutes
      weightHistory: 2 * 60 * 1000,      // 2 minutes
      educationLogs: 2 * 60 * 1000,      // 2 minutes
      nutritionStats: 3 * 60 * 1000,     // 3 minutes
      default: 5 * 60 * 1000             // 5 minutes
    };
  }

  /**
   * Generate cache key from service and parameters
   */
  generateKey(service, ...params) {
    const paramStr = params
      .map(p => typeof p === 'object' ? JSON.stringify(p) : String(p))
      .join(':');
    return `${service}:${paramStr}`;
  }

  /**
   * Get cached data if valid
   */
  get(key, ttl) {
    const cached = this.cache.get(key);
    if (!cached) return null;

    const now = Date.now();
    const effectiveTTL = ttl || this.ttls.default;
    
    if (now - cached.timestamp < effectiveTTL) {
      debugLog(`⚡ [CACHE-HIT] ${key}`);
      return cached.data;
    }

    // Expired - remove from cache
    this.cache.delete(key);
    return null;
  }

  /**
   * Set cached data
   */
  set(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Clear specific cache entry
   */
  clear(key) {
    this.cache.delete(key);
  }

  /**
   * Clear all cache entries matching a pattern
   */
  clearPattern(pattern) {
    let count = 0;
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
        count++;
      }
    }
    debugLog(`🗑️ [CACHE] Cleared ${count} entries matching "${pattern}"`);
  }

  /**
   * Clear all cache
   */
  clearAll() {
    this.cache.clear();
    this.pendingRequests.clear();
    debugLog('🗑️ [CACHE] Cleared all cache');
  }

  /**
   * Get cache size
   */
  getSize() {
    return this.cache.size;
  }

  /**
   * Execute a function with cache and deduplication
   * Prevents duplicate simultaneous requests
   * 
   * @param {string} key - Cache key
   * @param {function} fn - Async function to execute
   * @param {number} ttl - Time to live in milliseconds
   * @returns {Promise} - Function result
   */
  async execute(key, fn, ttl) {
    // Check cache first
    const cached = this.get(key, ttl);
    if (cached !== null) {
      return cached;
    }

    // Check if request is already in flight
    if (this.pendingRequests.has(key)) {
      debugLog(`⏳ [DEDUP] Waiting for pending request: ${key}`);
      return this.pendingRequests.get(key);
    }

    // Execute the function and cache the promise
    const promise = fn()
      .then(result => {
        this.set(key, result);
        this.pendingRequests.delete(key);
        return result;
      })
      .catch(error => {
        this.pendingRequests.delete(key);
        throw error;
      });

    this.pendingRequests.set(key, promise);
    return promise;
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const stats = {
      cacheSize: this.cache.size,
      pendingRequests: this.pendingRequests.size,
      hitRate: 0,
      totalMemoryKB: 0
    };

    // Calculate approximate memory usage
    for (const [key, value] of this.cache.entries()) {
      try {
        const size = JSON.stringify(value).length;
        stats.totalMemoryKB += size / 1024;
      } catch (e) {
        // Skip items that can't be stringified
      }
    }

    stats.totalMemoryKB = Math.round(stats.totalMemoryKB);

    return stats;
  }

  /**
   * Log cache statistics to console
   */
  logStats() {
    const stats = this.getStats();
    debugLog('📊 [CACHE-STATS]', {
      'Cache Entries': stats.cacheSize,
      'Pending Requests': stats.pendingRequests,
      'Memory (KB)': stats.totalMemoryKB,
      'Entries': Array.from(this.cache.keys()).slice(0, 10) // Show first 10
    });
  }
}

// Export singleton instance
export const cacheManager = new CacheManager();

// Export convenience functions
export const clearCache = (pattern) => {
  if (pattern) {
    cacheManager.clearPattern(pattern);
  } else {
    cacheManager.clearAll();
  }
};

export const getCacheStats = () => cacheManager.getStats();

// Expose to window for debugging in browser console
if (typeof window !== 'undefined') {
  window.__cacheManager = cacheManager;
  window.cacheStats = () => cacheManager.logStats();
}

export default cacheManager;
