import { GoogleGenerativeAI } from '@google/generative-ai';
import { createTokenTracker } from './tokenCost';

// Network interception/overrides removed — no global fetch/XHR blocking in production or development.
// If you need to block or audit external APIs, add a dev-only diagnostic wrapper that returns a rejected Promise instead of throwing.

class EducationDetectionService {
  constructor() {
    this.apiKey = process.env.REACT_APP_GEMINI_API_KEY;
    this.genAI = null;
    this.model = null;

    // API Base URL for backend calls
    this.apiBaseUrl = process.env.REACT_APP_API_BASE_URL;

    // Token tracking via centralized module
    this.tokenTracker = createTokenTracker('gemini-2.5-flash-lite');

    // Timeout configuration
    this.timeout = 30000; // 30 second timeout
    this.maxRetries = 3; // Maximum retry attempts

    // Session tracking for aggregate metrics
    this.sessionMetrics = {
      totalRequests: 0,
      totalTokens: 0,
      totalPromptTokens: 0,
      totalCompletionTokens: 0,
      totalProcessingTime: 0,
      requestsByType: {},
      errors: 0,
      startTime: new Date().toISOString()
    };

    if (this.apiKey) {
      this.genAI = new GoogleGenerativeAI(this.apiKey);
      this.model = this.genAI.getGenerativeModel({
        model: "gemini-2.5-flash-lite",
        generationConfig: {
          temperature: 0, // 0 for maximum speed (deterministic)
          topK: 1,
          topP: 0.95,
          maxOutputTokens: 2048, // Reduced for education detection
          candidateCount: 1,
          responseMimeType: 'application/json'
        }
      });
    }
  }

  // Method to set current user info for token tracking
  setCurrentUser(userId, userEmail) {
    this.tokenTracker.setCurrentUser(userId, userEmail);
  }

  getSessionMetrics() {
    const sessionDuration = Date.now() - new Date(this.sessionMetrics.startTime).getTime();
    const avgTokensPerRequest = this.sessionMetrics.totalRequests > 0
      ? Math.round(this.sessionMetrics.totalTokens / this.sessionMetrics.totalRequests)
      : 0;

    return {
      ...this.sessionMetrics,
      sessionDuration: sessionDuration,
      sessionDurationFormatted: `${Math.round(sessionDuration / 1000)}s`,
      avgTokensPerRequest: avgTokensPerRequest,
      errorRate: this.sessionMetrics.totalRequests > 0
        ? ((this.sessionMetrics.errors / this.sessionMetrics.totalRequests) * 100).toFixed(2) + '%'
        : '0%'
    };
  }

  logError(error, requestType) {
    this.sessionMetrics.errors++;
    console.error(`❌ Error [${requestType}]:`, {
      'Error Message': error.message,
      'Total Errors': this.sessionMetrics.errors,
      'Error Rate': `${((this.sessionMetrics.errors / Math.max(this.sessionMetrics.totalRequests, 1)) * 100).toFixed(2)}%`
    });
  }

  // Utility methods
  timeoutPromise(ms, message) {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    });
  }

  // Optimized image preprocessing
  async preprocessImage(imageFile) {
    const maxSize = 1024 * 1024; // 1MB max
    const maxDimension = 1024; // Max width/height

    // If image is already small enough, return as-is
    if (imageFile.size <= maxSize) {
      return imageFile;
    }

    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        // Calculate new dimensions
        let { width, height } = img;
        const ratio = Math.min(maxDimension / width, maxDimension / height);

        if (ratio < 1) {
          width *= ratio;
          height *= ratio;
        }

        canvas.width = width;
        canvas.height = height;

        // Draw and compress
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob((blob) => {
          if (blob) {
            resolve(new File([blob], imageFile.name, { type: 'image/jpeg' }));
          } else {
            reject(new Error('Failed to compress image'));
          }
        }, 'image/jpeg', 0.8); // 80% quality
      };

      img.onerror = reject;
      img.src = URL.createObjectURL(imageFile);
    });
  }

  /**
   * Detect if image is a virtual meeting screenshot
   * @param {File|string} imageFile - Image file or base64 string
   * @returns {Promise<Object>} { isMeeting: boolean, confidence: number, platform: string, reason: string }
   */
  async detectMeetingType(imageFile, options = {}) {
    const startTime = Date.now();
    console.log('🔍 EducationDetectionService: Starting meeting detection...');
    console.log('📸 Original image:', imageFile.name, imageFile.type, imageFile.size);

    if (!this.model) {
      throw new Error('Gemini AI model not initialized. Check REACT_APP_GEMINI_API_KEY.');
    }

    try {
      // Preprocess image for faster processing
      const processedImage = await this.preprocessImage(imageFile);
      console.log('📸 Processed image size:', processedImage.size);

      // Convert to base64 with timeout
      const imageBase64 = await Promise.race([
        this.fileToBase64(processedImage),
        this.timeoutPromise(10000, 'Image processing timeout')
      ]);

      console.log('📋 Image converted to base64, length:', imageBase64.length);

      const prompt = `Analyze this image and determine if it shows a VIRTUAL MEETING screenshot.\n\nReturn ONLY this JSON format:\n{\n  "isMeeting": true or false,\n  "confidence": 0.0 to 1.0,\n  "platform": "Google Meet" or "Zoom" or "MS Teams" or "Online Meeting",\n  "reason": "brief explanation"\n}`;

// Return ONLY this JSON format:
// {
//   "isMeeting": true or false,
//   "confidence": 0.0 to 1.0,
//   "platform": "Google Meet" or "Zoom" or "MS Teams" or "Online Meeting",
//   "reason": "brief explanation"
// }

// PLATFORM NAMING RULES:
// - Google Meet interface → "Google Meet"
// - Zoom meeting → "Zoom"
// - Microsoft Teams → "MS Teams"
// - Any other video platform → "Online Meeting"
// - Unknown or unclear → "Online Meeting"

// DETECTION CRITERIA:
// ✅ Virtual meeting indicators:
// - Google Meet interface (green theme, Meet branding, participant tiles)
// - Zoom meeting (black toolbar, gallery/speaker view, Zoom UI)
// - Microsoft Teams (purple accents, Teams interface, call window)
// - WebEx, Skype, or other video conferencing platforms
// - Multiple participant video tiles or grid view
// - Meeting controls (mute, camera, share screen buttons)
// - Virtual backgrounds or participant names overlays

// ❌ NOT meetings:
// - Food on plate
// - Weight scale
// - Random screenshots (desktop, apps, websites)
// - Photos of people not in a meeting context
// - Social media screenshots

// Be precise. Return confidence > 0.7 only if clearly a meeting screenshot.`;


      const imagePart = {
        inlineData: {
          data: imageBase64.split(',')[1] || imageBase64,
          mimeType: this.getMimeType(processedImage)
        }
      };

      // Make API call directly with timeout (no retries)
      const result = await Promise.race([
        this.model.generateContent([prompt, imagePart]),
        this.timeoutPromise(this.timeout, `API timeout after ${this.timeout}ms`)
      ]);

      const response = await result.response;
      const text = response.text();

      // Parse response
      const data = this.parseJsonResponse(text);
      const processingTime = Date.now() - startTime;

      // Log token usage via centralized tracker
      this.tokenTracker.track(response, 'education_detection', processingTime);

      console.log(`✅ Meeting detection completed in ${processingTime}ms`);

      return {
        isMeeting: data.isMeeting || false,
        confidence: data.confidence || 0,
        platform: data.platform || null,
        reason: data.reason || 'Unknown',
        processingTime: processingTime
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.logError(error, 'education_detection');
      console.error(`❌ Meeting detection failed after ${processingTime}ms:`, error);
      throw new Error(`Meeting detection failed: ${error.message}`);
    }
  }

  /**
   * Analyze meeting image and extract details (backward-compatible)
   * Returns { success, platform, topic, confidence, participantCount }
   */
  async analyzeMeetingImage(imageFile, options = {}) {
    const startTime = Date.now();
    console.log('🔍 EducationDetectionService: Starting meeting ANALYSIS...');

    // Accept optional user info to ensure token usage gets persisted
    if (options?.userId && options?.userEmail) {
      this.setCurrentUser(options.userId, options.userEmail);
    }

    if (!this.model) {
      throw new Error('Gemini AI model not initialized. Check REACT_APP_GEMINI_API_KEY.');
    }

    try {
      // Preprocess image and convert to base64
      const processedImage = await this.preprocessImage(imageFile);
      const imageBase64 = await Promise.race([
        this.fileToBase64(processedImage),
        this.timeoutPromise(10000, 'Image processing timeout')
      ]);

      const prompt = `Analyze this virtual meeting screenshot and extract meeting information.

PLATFORM NAMING RULES (IMPORTANT):
- Google Meet interface → Return "Google Meet"
- Zoom meeting → Return "Zoom"
- Microsoft Teams → Return "MS Teams"
- WebEx, Skype, or any other platform → Return "Online Meeting"
- Unknown or unclear → Return "Online Meeting"

EXTRACT INFORMATION:
1. Platform name (required) - Use ONLY the names above
2. Meeting title/topic (optional) - Look for meeting name, window title, or topic text
   - Often NOT visible in Google Meet
   - Sometimes shown in Zoom meeting title bar
   - May appear in Teams interface

Return ONLY this JSON format:
{
  "platform": "Google Meet",
  "detectedTitle": "Wellness Workshop" or null,
  "confidence": 0.95,
  "participantCount": "5-10 people visible",
  "detectionReason": "Shows Google Meet interface with green theme and multiple participants"
}

IMPORTANT:
- MUST use exact platform names: "Google Meet", "Zoom", "MS Teams", or "Online Meeting"
- If meeting title is NOT visible or unclear, set detectedTitle to null
- Platform detection is more reliable than title extraction
- Be confident about platform (>0.8) but conservative about title detection
- Count approximate participants if visible`;

      const imagePart = {
        inlineData: {
          data: imageBase64.split(',')[1] || imageBase64,
          mimeType: this.getMimeType(processedImage)
        }
      };

      // Make API call directly with timeout (no retries)
      const result = await Promise.race([
        this.model.generateContent([prompt, imagePart]),
        this.timeoutPromise(this.timeout, `API timeout after ${this.timeout}ms`)
      ]);

      const response = await result.response;
      const text = response.text();
      const data = this.parseJsonResponse(text);
      const processingTime = Date.now() - startTime;

      // Log token usage via centralized tracker
      this.tokenTracker.track(response, 'education_analysis', processingTime);

      // Apply fallback for topic
      const topic = data.detectedTitle || data.title || 'Education Meeting';

      console.log('✅ Meeting analysis completed in', processingTime, 'ms, result:', { platform: data.platform, topic, confidence: data.confidence, participantCount: data.participantCount });

      return {
        success: true,
        platform: data.platform || null,
        topic: topic,
        confidence: data.confidence || 0,
        participantCount: data.participantCount || null,
        raw: data
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.logError(error, 'education_analysis');
      console.error(`❌ Meeting analysis failed after ${processingTime}ms:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Parse response text into JSON safely
  parseJsonResponse(text) {
    try {
      // Clean the response text
      let cleanText = text.replace(/```json\n?|\n?```/g, '').trim();

      // Try to parse the JSON
      let parsed;
      try {
        parsed = JSON.parse(cleanText);
      } catch (firstError) {
        // If parsing fails, it might be truncated - try to fix common issues
        console.warn('⚠️ Initial JSON parse failed, attempting fixes...');

        // Check if it's an incomplete array - try to close it
        if (cleanText.includes('[') && !cleanText.endsWith(']')) {
          console.warn('⚠️ Detected incomplete array, attempting to close');
          // Count opening and closing brackets to determine how many to add
          const openBrackets = (cleanText.match(/\[/g) || []).length;
          const closeBrackets = (cleanText.match(/\]/g) || []).length;
          const openBraces = (cleanText.match(/\{/g) || []).length;
          const closeBraces = (cleanText.match(/\}/g) || []).length;

          // Add missing closing characters
          for (let i = 0; i < openBraces - closeBraces; i++) cleanText += '}';
          for (let i = 0; i < openBrackets - closeBrackets; i++) cleanText += ']';

          console.log('🔧 Attempted fix, trying parse again...');
          parsed = JSON.parse(cleanText);
        } else {
          throw firstError;
        }
      }

      // Handle both formats: {results: [...]} or directly [...]
      if (Array.isArray(parsed)) {
        console.log('✅ Parsed array format, wrapping in results object');
        return { results: parsed };
      }

      // If already has results property, return as-is
      if (parsed.results) {
        console.log('✅ Parsed object with results property');
        return parsed;
      }

      // If it has foods property (nutrition analysis format), return as-is
      if (parsed.foods) {
        console.log('✅ Parsed nutrition analysis with foods property');
        return parsed;
      }

      // Unknown format - return as-is without warning (could be valid response)
      return parsed;
    } catch (parseError) {
      console.error('❌ Failed to parse response. Length:', text.length);
      console.error('❌ First 500 chars:', text.substring(0, 500));
      console.error('❌ Last 500 chars:', text.substring(text.length - 500));
      console.error('❌ Parse error:', parseError.message);
      throw new Error('Invalid JSON response from API');
    }
  }

  // Helper to convert File or base64 string to base64 data URI
  fileToBase64(file) {
    return new Promise((resolve, reject) => {
      if (typeof file === 'string' && file.startsWith('data:')) return resolve(file);
      if (typeof file === 'string') return resolve(`data:image/png;base64,${file}`);
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }


  //  /**
  //  * Get MIME type from file
  //  * @param {File|string} file - File object or base64 string
  //  * @returns {string} MIME type
  //  */
  getMimeType(file) {
    if (typeof file === 'string') return 'image/png';
    return file.type || 'image/png';
  }

//    /**
//    * Parse JSON response from Gemini (handles markdown code blocks)
//    * @param {string} text - Response text
//    * @returns {Object} Parsed JSON object
//    */
//   parseJsonResponse(text) {
//     try {
//       // Remove markdown code blocks if present
//       let cleanText = text.trim();
      
//       // Remove ```json and ``` markers
//       cleanText = cleanText.replace(/^```json\s*/i, '');
//       cleanText = cleanText.replace(/^```\s*/, '');
//       cleanText = cleanText.replace(/\s*```$/, '');
      
//       return JSON.parse(cleanText);
//     } catch (error) {
//       console.error('Failed to parse JSON response:', text);
//       throw new Error('Invalid JSON response from AI: ' + error.message);
//     }
//   }
// }
}

const educationDetectionService = new EducationDetectionService();
export { educationDetectionService };
export default educationDetectionService;
