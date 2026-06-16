/**
 * Backend API endpoint for Gemini-powered nutrition analysis
 * 
 * Handles image analysis for food nutrition detection.
 * This endpoint keeps the Gemini API key secure on the server side.
 * 
 * Per claude.md §8.2: API keys must NEVER be exposed to the frontend.
 */

import formidable from 'formidable';
import fs from 'fs';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

// Response schema (same as frontend's FOOD_ANALYSIS_SCHEMA)
const NUTRITION_FIELDS = {
  calories: { type: SchemaType.NUMBER },
  protein: { type: SchemaType.NUMBER },
  carbs: { type: SchemaType.NUMBER },
  fat: { type: SchemaType.NUMBER },
  fiber: { type: SchemaType.NUMBER },
  sugar: { type: SchemaType.NUMBER },
  sodium: { type: SchemaType.NUMBER },
  cholesterol: { type: SchemaType.NUMBER },
  glycemic_index: { type: SchemaType.NUMBER },
  vitamin_a: { type: SchemaType.NUMBER },
  vitamin_c: { type: SchemaType.NUMBER },
  vitamin_d: { type: SchemaType.NUMBER },
  vitamin_e: { type: SchemaType.NUMBER },
  vitamin_k: { type: SchemaType.NUMBER },
  vitamin_b1: { type: SchemaType.NUMBER },
  vitamin_b2: { type: SchemaType.NUMBER },
  vitamin_b3: { type: SchemaType.NUMBER },
  vitamin_b6: { type: SchemaType.NUMBER },
  vitamin_b9: { type: SchemaType.NUMBER },
  vitamin_b12: { type: SchemaType.NUMBER },
  calcium: { type: SchemaType.NUMBER },
  iron: { type: SchemaType.NUMBER },
  magnesium: { type: SchemaType.NUMBER },
  potassium: { type: SchemaType.NUMBER },
  zinc: { type: SchemaType.NUMBER },
  phosphorus: { type: SchemaType.NUMBER },
};

const FOOD_ANALYSIS_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    foods: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          name: { type: SchemaType.STRING },
          portion: { type: SchemaType.STRING },
          weight_g: { type: SchemaType.NUMBER },
          volume_ml: { type: SchemaType.NUMBER },
          unit: { type: SchemaType.STRING },
          isLiquid: { type: SchemaType.BOOLEAN },
          nutrition: {
            type: SchemaType.OBJECT,
            properties: NUTRITION_FIELDS,
            required: Object.keys(NUTRITION_FIELDS),
          },
        },
        required: ['name', 'portion', 'unit', 'isLiquid', 'nutrition'],
      },
    },
    total: {
      type: SchemaType.OBJECT,
      properties: NUTRITION_FIELDS,
      required: Object.keys(NUTRITION_FIELDS),
    },
    confidence: { type: SchemaType.STRING },
  },
  required: ['foods', 'total', 'confidence'],
};

export const config = {
  api: {
    bodyParser: false, // Disable body parsing for multipart/form-data
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Only POST allowed' } });
  }

  try {
    // Get Gemini API key from server environment (SECURE - not exposed to frontend)
    const geminiApiKey = process.env.GEMINI_API_KEY;
    
    if (!geminiApiKey) {
      console.error('GEMINI_API_KEY not configured in backend environment');
      return res.status(500).json({ 
        ok: false, 
        error: { code: 'SERVER_CONFIG_ERROR', message: 'AI service not configured' } 
      });
    }

    // Parse multipart form data
    const form = formidable({ maxFileSize: 10 * 1024 * 1024 }); // 10MB limit
    
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

    // Read image file
    const imageBuffer = fs.readFileSync(imageFile.filepath);
    const imageBase64 = imageBuffer.toString('base64');
    const mimeType = imageFile.mimetype || 'image/jpeg';

    // Initialize Gemini AI
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-lite',
      generationConfig: {
        temperature: 0,
        topK: 1,
        topP: 1.0,
        maxOutputTokens: 4096,
        responseMimeType: 'application/json',
        responseSchema: FOOD_ANALYSIS_SCHEMA,
      },
    });

    // Prepare prompt
    const prompt = `Analyze this food image and provide detailed nutritional information.

Return a JSON object with:
1. Array of detected foods with individual nutrition
2. Total combined nutrition for the entire meal
3. Confidence level (high/medium/low)

For each food item, provide:
- Name and portion size
- Weight (g) or volume (ml)
- All 26 nutritional values (9 macros + 17 vitamins/minerals)

Be accurate with micronutrients - estimate based on typical values for each food.
If unsure about a specific nutrient, estimate conservatively rather than returning 0.`;

    // Call Gemini API
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
    const analysisData = JSON.parse(responseText);

    // Clean up temporary file
    fs.unlinkSync(imageFile.filepath);

    // Return standardized response
    return res.status(200).json({
      ok: true,
      data: analysisData,
    });

  } catch (error) {
    console.error('Gemini API error:', error);
    
    return res.status(500).json({
      ok: false,
      error: {
        code: 'AI_ANALYSIS_FAILED',
        message: 'Failed to analyze image',
        details: error.message,
      },
    });
  }
}
