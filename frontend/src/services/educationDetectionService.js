import { GoogleGenerativeAI } from '@google/generative-ai';

class EducationDetectionService {
  constructor() {
    this.apiKey = process.env.REACT_APP_GEMINI_API_KEY;
    this.genAI = null;
    this.model = null;
    
    if (this.apiKey) {
      this.genAI = new GoogleGenerativeAI(this.apiKey);
      this.model = this.genAI.getGenerativeModel({ 
        model: "gemini-2.0-flash-exp",
        generationConfig: {
          temperature: 0,
          topK: 1,
          topP: 0.95,
          maxOutputTokens: 2048,
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

      const prompt = `Analyze this image and determine if it shows a VIRTUAL MEETING screenshot.

Return ONLY this JSON format:
{
  "isMeeting": true or false,
  "confidence": 0.0 to 1.0,
  "platform": "Google Meet" or "Zoom" or "MS Teams" or "Online Meeting",
  "reason": "brief explanation"
}

PLATFORM NAMING RULES:
- Google Meet interface → "Google Meet"
- Zoom meeting → "Zoom"
- Microsoft Teams → "MS Teams"
- Any other video platform → "Online Meeting"
- Unknown or unclear → "Online Meeting"

DETECTION CRITERIA:
✅ Virtual meeting indicators:
- Google Meet interface (green theme, Meet branding, participant tiles)
- Zoom meeting (black toolbar, gallery/speaker view, Zoom UI)
- Microsoft Teams (purple accents, Teams interface, call window)
- WebEx, Skype, or other video conferencing platforms
- Multiple participant video tiles or grid view
- Meeting controls (mute, camera, share screen buttons)
- Virtual backgrounds or participant names overlays

❌ NOT meetings:
- Food on plate
- Weight scale
- Random screenshots (desktop, apps, websites)
- Photos of people not in a meeting context
- Social media screenshots

Be precise. Return confidence > 0.7 only if clearly a meeting screenshot.`;

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
