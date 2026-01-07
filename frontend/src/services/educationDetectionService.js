import { GoogleGenerativeAI } from '@google/generative-ai';

class EducationDetectionService {
  constructor() {
    this.apiKey = process.env.REACT_APP_GEMINI_API_KEY;
    this.genAI = null;
    this.model = null;
    
    if (this.apiKey) {
      this.genAI = new GoogleGenerativeAI(this.apiKey);
      this.model = this.genAI.getGenerativeModel({ 
        model: "gemini-2.5-flash-lite",
        generationConfig: {
          temperature: 0,
          topK: 1,
          topP: 1.0, // Increased for faster, more confident predictions
          maxOutputTokens: 1024, // Reduced from 2048 (sufficient for meeting detection)
          responseMimeType: 'application/json'
        }
      });
    }
  }

  /**
   * Detect if image is a virtual meeting screenshot
   * @param {File|string} imageFile - Image file or base64 string
   * @returns {Promise<Object>} { isMeeting: boolean, confidence: number, platform: string, reason: string }
   */
  async detectMeetingType(imageFile) {
    try {
      if (!this.model) {
        throw new Error('Gemini AI model not initialized. Check REACT_APP_GEMINI_API_KEY.');
      }

      // Convert to base64
      const base64Image = await this.fileToBase64(imageFile);

      const prompt = `Is this a VIRTUAL MEETING screenshot? JSON only.

{
  "isMeeting": bool,
  "confidence": 0-1,
  "platform": "Google Meet"|"Zoom"|"MS Teams"|"Online Meeting",
  "reason": "brief"
}

PLATFORMS:
- Green theme/Meet branding → "Google Meet"
- Black toolbar/Zoom UI → "Zoom"
- Purple accents/Teams → "MS Teams"
- Other video platform → "Online Meeting"

DETECT:
✅ Video tiles, meeting controls, participant names, virtual backgrounds
❌ Food, scales, random screenshots

Confidence >0.7 only if clearly meeting.`;

      const imagePart = {
        inlineData: {
          data: base64Image.split(',')[1] || base64Image,
          mimeType: this.getMimeType(imageFile)
        }
      };

      const result = await this.model.generateContent([prompt, imagePart]);
      const response = await result.response;
      const text = response.text();
      
      const data = this.parseJsonResponse(text);

      return {
        isMeeting: data.isMeeting || false,
        confidence: data.confidence || 0,
        platform: data.platform || null,
        reason: data.reason || 'Unknown'
      };

    } catch (error) {
      console.error('❌ Education detection error:', error);
      return {
        isMeeting: false,
        confidence: 0,
        platform: null,
        reason: error.message
      };
    }
  }

  /**
   * Analyze meeting image and extract details
   * @param {File|string} imageFile - Image file or base64 string
   * @returns {Promise<Object>} { success: boolean, platform: string, topic: string, confidence: number }
   */
  async analyzeMeetingImage(imageFile) {
    try {
      if (!this.model) {
        throw new Error('Gemini AI model not initialized. Check REACT_APP_GEMINI_API_KEY.');
      }

      // Convert to base64
      const base64Image = await this.fileToBase64(imageFile);

      const prompt = `Extract meeting info. JSON only.

PLATFORMS (exact names):
- "Google Meet" (green theme)
- "Zoom" (black toolbar)
- "MS Teams" (purple)
- "Online Meeting" (other/unclear)

EXTRACT:
1. Platform (required)
2. Title/topic (if visible, else null)

{
  "platform": "Google Meet",
  "detectedTitle": "name" or null,
  "confidence": 0.95,
  "participantCount": "5-10 visible",
  "detectionReason": "brief"
}

NOTE: Titles often NOT visible in Google Meet. Be confident about platform (>0.8), conservative about title.`;

      const imagePart = {
        inlineData: {
          data: base64Image.split(',')[1] || base64Image,
          mimeType: this.getMimeType(imageFile)
        }
      };

      const result = await this.model.generateContent([prompt, imagePart]);
      const response = await result.response;
      const text = response.text();
      
      const data = this.parseJsonResponse(text);

      // ALWAYS return a valid topic (never null) - apply fallback
      return {
        success: true,
        platform: data.platform || 'Online Meeting',
        topic: data.detectedTitle || 'Education Meeting', // ✅ Fallback here
        confidence: data.confidence || 0.7,
        participantCount: data.participantCount || 'Unknown',
        detectionReason: data.detectionReason || 'Meeting detected'
      };

    } catch (error) {
      console.error('❌ Education analysis error:', error);
      return {
        success: false,
        platform: 'Online Meeting',
        topic: 'Education Meeting',
        confidence: 0,
        error: error.message
      };
    }
  }

  /**
   * Convert file to base64 string
   * @param {File|string} file - File object or base64 string
   * @returns {Promise<string>} Base64 string
   */
  async fileToBase64(file) {
    // If already a base64 string, return it
    if (typeof file === 'string') {
      return file;
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * Get MIME type from file
   * @param {File|string} file - File object or base64 string
   * @returns {string} MIME type
   */
  getMimeType(file) {
    if (typeof file === 'string') {
      // Extract mime type from base64 data URL
      const match = file.match(/^data:([^;]+);/);
      return match ? match[1] : 'image/jpeg';
    }
    return file.type || 'image/jpeg';
  }

  /**
   * Parse JSON response from Gemini (handles markdown code blocks)
   * @param {string} text - Response text
   * @returns {Object} Parsed JSON object
   */
  parseJsonResponse(text) {
    try {
      // Remove markdown code blocks if present
      let cleanText = text.trim();
      
      // Remove ```json and ``` markers
      cleanText = cleanText.replace(/^```json\s*/i, '');
      cleanText = cleanText.replace(/^```\s*/, '');
      cleanText = cleanText.replace(/\s*```$/, '');
      
      return JSON.parse(cleanText);
    } catch (error) {
      console.error('Failed to parse JSON response:', text);
      throw new Error('Invalid JSON response from AI: ' + error.message);
    }
  }
}

export const educationDetectionService = new EducationDetectionService();
