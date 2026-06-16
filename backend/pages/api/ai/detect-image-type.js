/**
 * Backend API endpoint for Gemini-powered image type detection
 * 
 * Detects whether an image is food, weight scale, or virtual meeting.
 * Keeps the Gemini API key secure on the server side.
 */

import formidable from 'formidable';
import fs from 'fs';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Only POST allowed' } });
  }

  try {
    const geminiApiKey = process.env.GEMINI_API_KEY;
    
    if (!geminiApiKey) {
      console.error('GEMINI_API_KEY not configured');
      return res.status(500).json({ 
        ok: false, 
        error: { code: 'SERVER_CONFIG_ERROR', message: 'AI service not configured' } 
      });
    }

    // Parse form data
    const form = formidable({ maxFileSize: 10 * 1024 * 1024 });
    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve([fields, files]);
      });
    });

    const imageFile = files.image?.[0] || files.image;
    
    if (!imageFile) {
      return res.status(400).json({ 
        ok: false, 
        error: { code: 'MISSING_IMAGE', message: 'No image file provided' } 
      });
    }

    // Read image
    const imageBuffer = fs.readFileSync(imageFile.filepath);
    const imageBase64 = imageBuffer.toString('base64');
    const mimeType = imageFile.mimetype || 'image/jpeg';

    // Initialize Gemini
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-lite',
      generationConfig: {
        temperature: 0,
        topK: 1,
        topP: 1.0,
        maxOutputTokens: 512,
        responseMimeType: 'application/json',
      },
    });

    const prompt = `Analyze this image and determine its type. Return JSON:

{
  "type": "food" | "weight_scale" | "meeting" | "other",
  "confidence": 0.0-1.0,
  "details": {
    // For food: { "hasFood": true }
    // For weight_scale: { "isWeightScale": true, "reason": "..." }
    // For meeting: { "isMeeting": true, "platform": "Google Meet|Zoom|Teams|Other" }
    // For other: { "reason": "..." }
  }
}

Criteria:
- "food": Contains edible food, drinks, meals, snacks
- "weight_scale": Shows a weighing scale with visible numbers
- "meeting": Virtual meeting screenshot (Google Meet, Zoom, Teams UI visible)
- "other": None of the above`;

    // Call Gemini
    const result = await model.generateContent([
      {
        inlineData: {
          mimeType,
          data: imageBase64,
        },
      },
      prompt,
    ]);

    const responseText = result.response.text();
    const detectionData = JSON.parse(responseText);

    // Clean up
    fs.unlinkSync(imageFile.filepath);

    return res.status(200).json({
      ok: true,
      data: detectionData,
    });

  } catch (error) {
    console.error('Image detection error:', error);
    
    return res.status(500).json({
      ok: false,
      error: {
        code: 'DETECTION_FAILED',
        message: 'Failed to detect image type',
        details: error.message,
      },
    });
  }
}
