/**
 * Secure Image Type Detector - Backend Proxy Coordinator
 * 
 * This service coordinates image detection by calling the appropriate backend services.
 * Per claude.md §8.2: API keys must NEVER be exposed to frontend.
 * 
 * Architecture:
 * - Food detection → geminiService.analyzeImageForNutrition() → backend /api/ai/analyze-nutrition
 * - Weight detection → weightDetectionService.detectWeight() → backend /api/ai/detect-weight  
 * - Meeting detection → educationDetectionService.detectMeetingType() → backend /api/ai/detect-image-type
 */

import { weightDetectionService } from '../../features/weight';
import { geminiService } from './geminiService';
import { debugLog } from '../utils/logger.js';
import axios from 'axios';
import { getApiBaseUrl } from '../../config/api.config';

const API_BASE = getApiBaseUrl();

class SecureImageTypeDetector {
  constructor() {
    this.initialized = true; // Always ready - no Gemini setup needed
    this.timeout = 60000; // 60 second timeout
  }

  /**
   * Dummy initialize for backward compatibility
   */
  async initialize() {
    debugLog('✅ SecureImageTypeDetector: Already initialized (backend proxy)');
    return Promise.resolve();
  }

  /**
   * Set current user for token tracking (kept for compatibility)
   */
  setCurrentUser(userId, userEmail) {
    this.userId = userId;
    this.userEmail = userEmail;
  }

  /**
   * Quick classification to determine image type
   * Calls backend /api/ai/detect-image-type
   */
  async classifyImageTypeFast(imageFile) {
    debugLog('🔍 SecureImageTypeDetector: Quick classification...');
    
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
        throw new Error(response.data.error?.message || 'Classification failed');
      }

      const data = response.data.data;

      // Normalize backend type values to the frontend's canonical types:
      //   'weight_scale' → 'weight'      (detect-image-type returns 'weight_scale')
      //   'meeting'      → 'education'
      //   'smartwatch'   → 'smartwatch'  (already matches App.js expectation)
      const TYPE_MAP = { weight_scale: 'weight', meeting: 'education' };
      const rawType = data.type || 'food';
      const normalizedType = TYPE_MAP[rawType] || rawType;

      return {
        type: normalizedType,
        confidence: data.confidence || 0,
        details: data.details || {},
      };

    } catch (error) {
      console.error('❌ Image classification failed:', error);
      // Default to food on error
      return {
        type: 'food',
        confidence: 0.5,
        details: {},
      };
    }
  }

  /**
   * Detect image type and extract relevant data
   * This is the main entry point - it classifies first, then calls the appropriate service
   */
  async detectImageType(image, imageFile = null) {
    const startTime = Date.now();
    
    try {
      debugLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      debugLog('🚀 [IMAGE-DETECTOR] Starting secure image analysis...');

      // Convert data URL to File if needed
      let imgFile = imageFile || image;
      if (typeof image === 'string' && image.startsWith('data:')) {
        imgFile = this.dataURLToFile(image);
      }

      // Step 1: Quick classification
      debugLog('📸 [IMAGE-DETECTOR] Step 1: Classifying image type...');
      const classification = await this.classifyImageTypeFast(imgFile);
      
      debugLog(`✅ [IMAGE-DETECTOR] Classified as: ${classification.type} (confidence: ${classification.confidence})`);

      // Step 2: Route to appropriate service for detailed analysis
      let result;

      if (classification.type === 'weight') {
        debugLog('⚖️ [IMAGE-DETECTOR] Routing to weight detection service...');
        const weightData = await weightDetectionService.detectWeight(imgFile);

        // App.js reads detectedType.details.weightValue (not .weight)
        // weightDetectionService returns { weight, unit, confidence, isWeightScale }
        // so we normalise the field name here.
        result = {
          type: 'weight',
          confidence: weightData.confidence || classification.confidence,
          details: {
            ...weightData,
            weightValue: weightData.weightValue ?? weightData.weight ?? null,
          },
          duration: Date.now() - startTime,
        };

      } else if (classification.type === 'education') {
        debugLog('📚 [IMAGE-DETECTOR] Routing to education detection service...');
        
        // Education detection would go here, but for now return classification
        result = {
          type: 'education',
          confidence: classification.confidence,
          details: classification.details,
          duration: Date.now() - startTime,
        };

      } else if (classification.type === 'smartwatch') {
        debugLog('⌚ [IMAGE-DETECTOR] Smartwatch detected — using classification details directly...');
        // No second API call needed — classification already returns caloriesBurned/source
        result = {
          type: 'smartwatch',
          confidence: classification.confidence,
          details: classification.details,
          duration: Date.now() - startTime,
        };

      } else {
        // Default to food
        debugLog('🍽️ [IMAGE-DETECTOR] Routing to nutrition analysis service...');
        const nutritionData = await geminiService.analyzeImageForNutrition(
          imgFile,
          this.userId,
          null
        );

        // geminiService now returns numeric confidence (0-1) directly
        result = {
          type: 'food',
          confidence: nutritionData.confidence || 0.9,
          details: nutritionData,
          duration: Date.now() - startTime,
        };
      }

      debugLog(`✅ [IMAGE-DETECTOR] SUCCESS after ${result.duration}ms`);
      debugLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error(`❌ [IMAGE-DETECTOR] FAILED after ${duration} ms`);
      console.error(`❌ [IMAGE-DETECTOR] Error:`, error.message);
      console.error(`❌ [IMAGE-DETECTOR] Error type:`, error.constructor.name);
      console.error(`❌ [IMAGE-DETECTOR] Stack:`, error.stack);
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      throw error;
    }
  }

  /**
   * Helper: Convert data URL to File object
   */
  dataURLToFile(dataUrl) {
    const arr = dataUrl.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], 'image.jpg', { type: mime });
  }

  /**
   * Helper: Convert File to base64
   */
  async fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
}

// Export singleton
export const imageTypeDetector = new SecureImageTypeDetector();
export default imageTypeDetector;
