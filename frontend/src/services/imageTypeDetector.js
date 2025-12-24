// src/services/imageTypeDetector.js
import { weightDetectionService } from './weightDetectionService';
import { educationDetectionService } from './educationDetectionService';

/**
 * Image Type Detector Service using Gemini AI
 * Detects whether an image contains education meeting, weight scale, or food
 * Priority: education > weight > food (default)
 */
class ImageTypeDetector {
  constructor() {
    this.initialized = false;
  }

  /**
   * Initialize the detector (uses Gemini AI service)
   */
  async initialize() {
    if (this.initialized) return;
    
    console.log('🔧 Initializing Image Type Detector (Gemini AI)...');
    
    try {
      await weightDetectionService.initialize();
      this.initialized = true;
      console.log('✅ Image Type Detector initialized with Gemini AI');
    } catch (error) {
      console.error('❌ Failed to initialize Gemini AI:', error);
      throw new Error('Failed to initialize image type detector');
    }
  }

  /**
   * Detect image type: 'education', 'weight', or 'food' using Gemini AI
   * Detection priority: education > weight > food (default)
   * @param {string|File} image - Image data URL or File object
   * @param {File} imageFile - Optional: File object for additional analysis
   * @returns {Promise<{type: 'education'|'weight'|'food', confidence: number, details: object}>}
   */
  async detectImageType(image, imageFile = null) {
    try {
      console.log('🔍 Analyzing image type with Gemini AI...');

      // Initialize if not already done
      if (!this.initialized) {
        await this.initialize();
      }

      // Convert data URL to File if needed
      let imgFile = imageFile || image;
      if (typeof image === 'string' && image.startsWith('data:')) {
        imgFile = this.dataURLToFile(image);
      }

      // ✅ PRIORITY 1: Check for education/meeting first (highest priority)
      const meetingCheck = await educationDetectionService.detectMeetingType(imgFile);
      if (meetingCheck.isMeeting && meetingCheck.confidence > 0.7) {
        console.log('✅ Detected EDUCATION MEETING with Gemini AI');
        return {
          type: 'education',
          confidence: meetingCheck.confidence,
          details: {
            isMeeting: true,
            platform: meetingCheck.platform,
            reason: meetingCheck.reason,
            aiAnalysis: true
          }
        };
      }

      // ✅ PRIORITY 2: Check for weight scale
      const detection = await weightDetectionService.detectImageType(imgFile);
      
      let type = 'food'; // Default to food
      let confidence = 0.5;

      if (detection.isWeightScale && detection.confidence > 0.6) {
        type = 'weight';
        confidence = detection.confidence;
        console.log('✅ Detected WEIGHT SCALE with Gemini AI');
      } else if (!detection.isWeightScale && detection.confidence > 0.6) {
        type = 'food';
        confidence = detection.confidence;
        console.log('✅ Detected FOOD IMAGE with Gemini AI');
      }

      // console.log(`📊 Image type: ${type.toUpperCase()} (confidence: ${(confidence * 100).toFixed(1)}%)`);

      return {
        type,
        confidence,
        details: {
          isWeightScale: detection.isWeightScale,
          geminiConfidence: detection.confidence,
          reason: detection.reason,
          aiAnalysis: true
        }
      };

    } catch (error) {
      console.error('❌ Image type detection failed:', error);
      
      // Default to food on error (safer assumption)
      return {
        type: 'food',
        confidence: 0.3,
        details: {
          error: error.message,
          defaulted: true
        }
      };
    }
  }

  /**
   * Convert data URL to File object
   */
  dataURLToFile(dataURL, filename = 'image.jpg') {
    const arr = dataURL.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    
    return new File([u8arr], filename, { type: mime });
  }

  /**
   * Quick check - same as detectImageType but with AI
   * Kept for backward compatibility
   */
  async quickCheck(image) {
    const result = await this.detectImageType(image);
    return {
      type: result.type,
      confidence: result.confidence
    };
  }

  /**
   * Cleanup resources
   */
  async terminate() {
    if (this.initialized) {
      await weightDetectionService.terminate();
      this.initialized = false;
      // console.log('🔚 Image Type Detector terminated');
    }
  }
}

// Export singleton instance
export const imageTypeDetector = new ImageTypeDetector();
