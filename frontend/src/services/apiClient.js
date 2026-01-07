/**
 * Optimized API Client
 * 
 * PERFORMANCE IMPROVEMENTS:
 * - Request deduplication (prevents duplicate simultaneous requests)
 * - Automatic retry with exponential backoff
 * - Request timeout configuration
 * - Response caching
 * - Error handling with user-friendly messages
 */

class APIClient {
  constructor() {
    this.baseURL = process.env.REACT_APP_API_BASE_URL;
    this.pendingRequests = new Map(); // For deduplication
    this.cache = new Map(); // Simple client-side cache
    this.defaultTimeout = 15000; // 15 seconds
  }

  /**
   * Generate cache key from URL and params
   */
  getCacheKey(url, options) {
    const method = options?.method || 'GET';
    const body = options?.body ? JSON.stringify(options.body) : '';
    return `${method}:${url}:${body}`;
  }

  /**
   * Check if a request is already pending (deduplication)
   */
  isPending(cacheKey) {
    return this.pendingRequests.has(cacheKey);
  }

  /**
   * Wait for pending request instead of creating a duplicate
   */
  async waitForPending(cacheKey) {
    return this.pendingRequests.get(cacheKey);
  }

  /**
   * Fetch with timeout
   */
  async fetchWithTimeout(url, options = {}, timeout = this.defaultTimeout) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Request timeout - please check your internet connection');
      }
      throw error;
    }
  }

  /**
   * Retry logic with exponential backoff
   */
  async fetchWithRetry(url, options = {}, maxRetries = 3) {
    let lastError;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await this.fetchWithTimeout(url, options);
        
        // Don't retry on 4xx errors (client errors)
        if (response.status >= 400 && response.status < 500) {
          return response;
        }
        
        // Retry on 5xx errors (server errors) or network issues
        if (response.ok || response.status < 500) {
          return response;
        }
        
        throw new Error(`Server error: ${response.status}`);
      } catch (error) {
        lastError = error;
        
        // Don't retry on last attempt
        if (attempt === maxRetries - 1) break;
        
        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`⚠️ Request failed, retrying in ${delay}ms... (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError;
  }

  /**
   * Main GET request method with all optimizations
   */
  async get(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const cacheKey = this.getCacheKey(url, { method: 'GET' });

    // DISABLED: Client-side caching can cause stale data after mutations
    // Cache is now handled at backend level with proper invalidation
    // if (options.cache !== false) {
    //   const cached = this.cache.get(cacheKey);
    //   if (cached && Date.now() - cached.timestamp < (options.cacheTTL || 60000)) {
    //     console.log(`✅ Client cache HIT: ${endpoint}`);
    //     return cached.data;
    //   }
    // }

    // Check if request is already pending (deduplication)
    if (this.isPending(cacheKey)) {
      console.log(`⏳ Deduplicating request: ${endpoint}`);
      return this.waitForPending(cacheKey);
    }

    // Create and store the pending request
    const requestPromise = (async () => {
      try {
        const response = await this.fetchWithRetry(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            ...options.headers,
          },
          cache: 'no-store', // Disable browser cache
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || errorData.message || `HTTP ${response.status}`);
        }

        const data = await response.json();

        // DISABLED: Caching removed to prevent stale data issues
        // Backend handles caching with proper invalidation
        // if (options.cache !== false) {
        //   this.cache.set(cacheKey, {
        //     data,
        //     timestamp: Date.now(),
        //   });
        // }

        return data;
      } finally {
        // Remove from pending requests
        this.pendingRequests.delete(cacheKey);
      }
    })();

    this.pendingRequests.set(cacheKey, requestPromise);
    return requestPromise;
  }

  /**
   * Main POST request method
   */
  async post(endpoint, body, options = {}) {
    const url = `${this.baseURL}${endpoint}`;

    const response = await this.fetchWithRetry(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || errorData.message || `HTTP ${response.status}`);
    }

    return await response.json();
  }

  /**
   * Batch multiple GET requests
   */
  async batchGet(endpoints) {
    const promises = endpoints.map(endpoint => this.get(endpoint));
    return Promise.all(promises);
  }

  /**
   * Clear cache
   */
  clearCache(pattern) {
    if (pattern) {
      // Clear specific cache entries matching pattern
      for (const key of this.cache.keys()) {
        if (key.includes(pattern)) {
          this.cache.delete(key);
        }
      }
    } else {
      // Clear all cache
      this.cache.clear();
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys()),
    };
  }
}

// Export singleton instance
export const apiClient = new APIClient();

export default apiClient;
