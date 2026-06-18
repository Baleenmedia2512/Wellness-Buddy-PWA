/**
 * Secure Weight Detection Service - Backend Proxy Version
 * 
 * Calls backend /api/ai/detect-weight instead of Gemini directly.
 * Per claude.md §8.2: API keys must NEVER be exposed to frontend.
 */

import axios from 'axios';
import { debugLog } from '../../../shared/utils/logger.js';
import { getApiBaseUrl } from '../../../config/api.config';

const API_BASE = getApiBaseUrl();

class SecureWeightDetectionService {
  constructor() {
    this.timeout = 60000; // 60 second timeout
    this.maxRetries = 2;
    this.initialized = true; // Always ready - no Gemini setup needed
  }

  /**
   * Dummy initialize method for backward compatibility
   * Secure services don't need initialization - they just call backend
   */
  async initialize() {
    debugLog('✅ SecureWeightDetectionService: Already initialized (backend proxy)');
    return Promise.resolve();
  }

  /**
   * Detect if image is a weight scale and extract weight value
   * Now calls backend instead of Gemini directly
   */
  async detectImageType(imageFile) {
    debugLog('🔒 SecureWeightDetection: Calling backend...');

    try {
      const formData = new FormData();
      formData.append('image', imageFile);

      const response = await axios.post(
        `${API_BASE}/api/ai/detect-weight`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: this.timeout,
        }
      );

      if (!response.data.ok) {
        throw new Error(response.data.error?.message || 'Weight detection failed');
      }

      const data = response.data.data;

      return {
        isWeightScale: data.isWeightScale || false,
        confidence: data.confidence || 0,
        reason: data.reason || '',
      };

    } catch (error) {
      console.error('❌ Backend weight detection failed:', error);
      throw error;
    }
  }

  /**
   * Detect weight value from scale image
   */
  async detectWeight(imageFile) {
    debugLog('🔒 SecureWeightDetection: Extracting weight from scale...');

    try {
      const formData = new FormData();
      formData.append('image', imageFile);

      const response = await axios.post(
        `${API_BASE}/api/ai/detect-weight`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: this.timeout,
        }
      );

      if (!response.data.ok) {
        throw new Error(response.data.error?.message || 'Weight extraction failed');
      }

      const data = response.data.data;

      return {
        weight: data.weight || null,
        unit: data.unit || 'kg',
        confidence: data.confidence || 0,
        isWeightScale: data.isWeightScale || false,
        reason: data.reason || '',
      };

    } catch (error) {
      console.error('❌ Weight extraction failed:', error);
      throw error;
    }
  }

  /**
   * Convert file to base64 (for backward compatibility if needed)
   */
  async fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
}

// Export singleton
export const weightDetectionService = new SecureWeightDetectionService();
export default weightDetectionService;
