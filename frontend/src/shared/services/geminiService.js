/**
 * Secure Gemini Service - Backend Proxy Version
 * 
 * This service now calls YOUR BACKEND instead of Gemini directly.
 * API keys are kept secure on the server side per claude.md §8.2.
 * 
 * Migration path:
 * 1. Add GEMINI_API_KEY to Vercel backend environment (without REACT_APP_ prefix)
 * 2. Deploy backend with new /api/ai/* endpoints
 * 3. Replace old geminiService with this file
 * 4. Remove REACT_APP_GEMINI_API_KEY from frontend .env
 */

import axios from 'axios';
import { getUserContext, formatContextForAI } from "./userIdentity";
import { debugLog } from '../utils/logger.js';
import { getApiBaseUrl } from '../../config/api.config';

const API_BASE = getApiBaseUrl();

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
      hasCredentials: true, // Always true - credentials are on backend
      provider: "Google Gemini (Secure Backend Proxy)",
      dailyLimit: 1500,
      description: "Secure Gemini AI via backend proxy",
    };
  }

  /**
   * Analyze food image for nutrition
   * Now calls backend /api/ai/analyze-nutrition instead of Gemini directly
   */
  async analyzeImageForNutrition(imageFile, userId = null, userContext = null) {
    const startTime = Date.now();
    debugLog('🔒 SecureGeminiService: Calling backend for nutrition analysis...');

    try {
      this.sessionMetrics.totalRequests++;

      // Prepare form data
      const formData = new FormData();
      formData.append('image', imageFile);
      
      if (userId) {
        formData.append('userId', userId);
      }

      // Optional: Send user context for personalization
      if (userContext || userId) {
        try {
          const context = userContext || await getUserContext(userId);
          formData.append('userContext', JSON.stringify(context));
        } catch (error) {
          console.warn('Failed to load user context:', error);
        }
      }

      // Call backend API (your server handles Gemini)
      const response = await axios.post(
        `${API_BASE}/api/ai/analyze-nutrition`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          timeout: 60000, // 60 second timeout
        }
      );

      if (!response.data.ok) {
        throw new Error(response.data.error?.message || 'Analysis failed');
      }

      const nutritionData = response.data.data;
      const processingTime = Date.now() - startTime;

      debugLog(`✅ Backend analysis completed in ${processingTime}ms`);

      // Return in the same format as the old service
      return {
        foods: nutritionData.foods || [],
        total: nutritionData.total || {},
        confidence: nutritionData.confidence || 'medium',
        source: 'gemini-backend',
        processingTime,
      };

    } catch (error) {
      this.sessionMetrics.errors++;
      const processingTime = Date.now() - startTime;
      console.error(`❌ Backend analysis failed after ${processingTime}ms:`, error);
      
      throw new Error(
        error.response?.data?.error?.message || 
        error.message || 
        'Failed to analyze image'
      );
    }
  }

  /**
   * Detect image type (food, weight, meeting, other)
   * Calls backend /api/ai/detect-image-type
   */
  async detectImageType(imageFile) {
    debugLog('🔒 Calling backend for image type detection...');

    try {
      const formData = new FormData();
      formData.append('image', imageFile);

      const response = await axios.post(
        `${API_BASE}/api/ai/detect-image-type`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 30000,
        }
      );

      if (!response.data.ok) {
        throw new Error(response.data.error?.message || 'Detection failed');
      }

      return response.data.data;

    } catch (error) {
      console.error('Image type detection failed:', error);
      throw error;
    }
  }

  /**
   * Detect weight from scale image
   * Calls backend /api/ai/detect-weight
   */
  async detectWeight(imageFile) {
    debugLog('🔒 Calling backend for weight detection...');

    try {
      const formData = new FormData();
      formData.append('image', imageFile);

      const response = await axios.post(
        `${API_BASE}/api/ai/detect-weight`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 30000,
        }
      );

      if (!response.data.ok) {
        throw new Error(response.data.error?.message || 'Weight detection failed');
      }

      return response.data.data;

    } catch (error) {
      console.error('Weight detection failed:', error);
      throw error;
    }
  }

  /**
   * Get session metrics
   */
  getSessionMetrics() {
    const sessionDuration = Date.now() - new Date(this.sessionMetrics.startTime).getTime();
    const errorRate = this.sessionMetrics.totalRequests > 0
      ? ((this.sessionMetrics.errors / this.sessionMetrics.totalRequests) * 100).toFixed(2) + '%'
      : '0%';

    return {
      ...this.sessionMetrics,
      sessionDuration,
      sessionDurationFormatted: `${Math.round(sessionDuration / 1000)}s`,
      errorRate,
    };
  }
}

// Export singleton instance
export const geminiService = new SecureGeminiService();
export default geminiService;
