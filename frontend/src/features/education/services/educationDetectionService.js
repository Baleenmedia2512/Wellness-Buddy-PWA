/**
 * Secure Education Detection Service - Backend Proxy Version
 * 
 * Calls backend /api/ai/detect-image-type for meeting detection.
 * Per claude.md §8.2: API keys must NEVER be exposed to frontend.
 */

import axios from 'axios';
import { getApiBaseUrl } from '../../../config/api.config';

const API_BASE = getApiBaseUrl();

class SecureEducationDetectionService {
  constructor() {
    this.timeout = 30000; // 30 second timeout
    this.initialized = true; // Always ready - no Gemini setup needed
  }

  /**
   * Dummy initialize method for backward compatibility
   * Secure services don't need initialization - they just call backend
   */
  async initialize() {
    return Promise.resolve();
  }

  /**
   * Detect if image is a virtual meeting screenshot
   * Now calls backend instead of Gemini directly
   */
  async detectMeetingType(imageFile) {
    try {
      const formData = new FormData();
      formData.append('image', imageFile);

      const response = await axios.post(
        `${API_BASE}/api/ai/detect-image-type`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: this.timeout,
        }
      );

      if (!response.data.ok) {
        throw new Error(response.data.error?.message || 'Meeting detection failed');
      }

      const data = response.data.data;

      // Map generic response to meeting-specific format
      const isMeeting = data.type === 'meeting';
      const platform = isMeeting 
        ? (data.details?.platform || 'Online Meeting')
        : '';

      return {
        isMeeting,
        confidence: data.confidence || 0,
        platform,
        reason: isMeeting 
          ? `Detected ${platform} interface` 
          : (data.details?.reason || 'Not a meeting screenshot'),
      };

    } catch (error) {
      console.error('❌ Backend meeting detection failed:', error);
      throw new Error('Gemini AI model not initialized. Check backend configuration.');
    }
  }

  /**
   * Convert file to base64 (for backward compatibility)
   */
  async fileToBase64(file) {
    if (typeof file === 'string') {
      return file;
    }

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
export const educationDetectionService = new SecureEducationDetectionService();
export default educationDetectionService;
