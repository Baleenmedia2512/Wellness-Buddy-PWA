/**
 * GeminiService — stub retained for components that import it (FoodCorrectionsDebugPanel,
 * NutritionDashboard). All actual AI analysis now goes through orchestratorService
 * → POST /api/ai/orchestrate (single Gemini call).
 */

import { debugLog } from '../utils/logger.js';

class SecureGeminiService {
  constructor() {
    this.sessionMetrics = {
      totalRequests: 0,
      errors: 0,
      startTime: new Date().toISOString(),
    };
    this.initialized = true; // Always ready - no setup needed
  }

  /**
   * Dummy initialize method for backward compatibility
   * Secure services don't need initialization - they just call backend
   */
  async initialize() {
    debugLog('✅ SecureGeminiService: Already initialized (backend proxy)');
    return Promise.resolve();
  }

  getApiInfo() {
    return {
      hasCredentials: true,
      provider: 'Google Gemini via orchestratorService',
      description: 'All AI analysis now routes through POST /api/ai/orchestrate',
    };
  }

  getSessionMetrics() {
    return { ...this.sessionMetrics };
  }
}

// Export singleton instance
export const geminiService = new SecureGeminiService();
export default geminiService;
