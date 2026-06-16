/**
 * Backend API endpoint for Gemini-powered weight scale reading
 * 
 * Analyzes weight scale images and extracts the weight value.
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
      return res.status(500).json({ 
        ok: false, 
        error: { code: 'SERVER_CONFIG_ERROR', message: 'AI service not configured' } 
      });
    }

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

    const imageBuffer = fs.readFileSync(imageFile.filepath);
    const imageBase64 = imageBuffer.toString('base64');
    const mimeType = imageFile.mimetype || 'image/jpeg';

    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-lite',
      generationConfig: {
        temperature: 0.1,
        topK: 1,
        topP: 1.0,
        maxOutputTokens: 512,
        responseMimeType: 'application/json',
      },
    });

    const prompt = `Extract weight from this scale image. Return JSON:

{
  "weight": number (in kg),
  "unit": "kg" | "lbs",
  "confidence": 0.0-1.0,
  "isWeightScale": boolean,
  "reason": "brief explanation"
}

Read the number carefully. If multiple numbers visible, choose the main/largest display.
Convert to kg if shown in lbs (divide by 2.205).
Return null for weight if not a scale or unreadable.`;

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
    const weightData = JSON.parse(responseText);

    fs.unlinkSync(imageFile.filepath);

    return res.status(200).json({
      ok: true,
      data: weightData,
    });

  } catch (error) {
    console.error('Weight detection error:', error);
    
    return res.status(500).json({
      ok: false,
      error: {
        code: 'WEIGHT_DETECTION_FAILED',
        message: 'Failed to detect weight',
        details: error.message,
      },
    });
  }
}
