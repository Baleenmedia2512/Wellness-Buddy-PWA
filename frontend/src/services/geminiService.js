import { GoogleGenerativeAI } from '@google/generative-ai';

// Comprehensive network debugging to catch ALL requests
const originalFetch = window.fetch;
const originalXMLHttpRequest = window.XMLHttpRequest;

// Override fetch
window.fetch = function(...args) {
  const url = args[0];
  
  // Check for unwanted API calls
  if (typeof url === 'string') {
    if (url.includes('spoonacular') || 
        url.includes('calorieninjas') || 
        url.includes('rapidapi') ||
        url.includes('nutritionix') ||
        url.includes('edamam')) {
      console.error('❌ UNWANTED API CALL DETECTED:', url);
      console.trace('Call stack:');
      throw new Error(`BLOCKED: Unwanted API call to ${url}`);
    }
  }
  
  return originalFetch.apply(this, args);
};

// Override XMLHttpRequest
window.XMLHttpRequest = function() {
  const xhr = new originalXMLHttpRequest();
  const originalOpen = xhr.open;
  
  xhr.open = function(method, url, ...args) {
    console.log('🌐 XHR REQUEST:', {
      method: method,
      url: url,
      timestamp: new Date().toISOString()
    });
    
    // Check for unwanted API calls
    if (typeof url === 'string') {
      if (url.includes('spoonacular') || 
          url.includes('calorieninjas') || 
          url.includes('rapidapi') ||
          url.includes('nutritionix') ||
          url.includes('edamam')) {
        console.error('❌ UNWANTED XHR API CALL DETECTED:', url);
        console.trace('Call stack:');
        throw new Error(`BLOCKED: Unwanted XHR API call to ${url}`);
      }
    }
    
    return originalOpen.apply(this, [method, url, ...args]);
  };
  
  return xhr;
};

class GeminiService {
  constructor() {
    this.apiKey = process.env.REACT_APP_GEMINI_API_KEY;
    this.genAI = null;
    this.model = null;
    
    // Add timeout and retry configuration
    this.timeout = 30000; // 30 second timeout
    this.maxRetries = 2;
    
    if (this.apiKey) {
      this.genAI = new GoogleGenerativeAI(this.apiKey);
      this.model = this.genAI.getGenerativeModel({ 
        model: "gemini-2.0-flash",
        generationConfig: {
          temperature: 0.1, // Lower temperature for more consistent responses
          topK: 1,
          topP: 0.8,
          maxOutputTokens: 2048, // Limit output to speed up response
        }
      });
    }
  }

  getApiInfo() {
    return {
      hasCredentials: !!this.apiKey,
      provider: 'Google Gemini',
      dailyLimit: 1500,
      description: 'Google Gemini AI for food image analysis (Optimized)'
    };
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

  async analyzeImageForNutrition(imageFile) {
    const startTime = Date.now();
    console.log('🔍 GeminiService: Starting optimized image analysis...');
    console.log('📸 Original image:', imageFile.name, imageFile.type, imageFile.size);
    
    if (!this.model) {
      throw new Error('Gemini API key is not configured');
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
      
      // Simplified, more focused prompt for faster processing
      const prompt = `Analyze this food image and return nutrition data in JSON format. Be quick but accurate.

RULES:
1. Estimate portions based on visual cues (plate size, typical servings)
2. Use standard nutrition values
3. Return concise JSON only

FORMAT:
{
  "foods": [
    {
      "name": "food name",
      "portion": "description like '2 idlis' or '1 cup rice'",
      "weight_g": number,
      "nutrition": {
        "calories": number,
        "protein": number,
        "carbs": number,
        "fat": number,
        "fiber": number
      }
    }
  ],
  "total": {
    "calories": number,
    "protein": number,
    "carbs": number,
    "fat": number,
    "fiber": number
  },
  "confidence": "high/medium/low"
}

Return valid JSON only, no markdown.`;

      const imagePart = {
        inlineData: {
          data: imageBase64,
          mimeType: processedImage.type
        }
      };

      // Make API call with timeout and retry logic
      const result = await this.makeApiCallWithRetry(
        () => this.model.generateContent([prompt, imagePart]),
        this.maxRetries
      );

      const response = await result.response;
      const text = response.text();

      // Parse response
      const nutritionData = this.parseJsonResponse(text);
      const processingTime = Date.now() - startTime;
      
      console.log(`✅ Analysis completed in ${processingTime}ms`);
      
      return this.transformOptimizedResponse(nutritionData, 'image');

    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(`❌ Analysis failed after ${processingTime}ms:`, error);
      throw new Error(`Analysis failed: ${error.message}`);
    }
  }

  async analyzeTextForNutrition(foodText) {
    const startTime = Date.now();
    console.log('🔍 GeminiService: Starting text analysis for:', foodText);
    
    if (!this.model) {
      throw new Error('Gemini API key is not configured');
    }

    try {
      // Simplified prompt for faster processing
      const prompt = `Provide nutrition data for "${foodText}" in standard serving size. Return JSON only.

FORMAT:
{
  "name": "${foodText}",
  "serving": "description like '1 cup cooked'",
  "weight_g": number,
  "nutrition": {
    "calories": number,
    "protein": number,
    "carbs": number,
    "fat": number,
    "fiber": number
  }
}

Use USDA values. Return valid JSON only, no markdown.`;

      const result = await this.makeApiCallWithRetry(
        () => this.model.generateContent(prompt),
        this.maxRetries
      );

      const response = await result.response;
      const text = response.text();

      const nutritionData = this.parseJsonResponse(text);
      const processingTime = Date.now() - startTime;
      
      console.log(`✅ Text analysis completed in ${processingTime}ms`);
      
      return this.transformOptimizedResponse(nutritionData, 'text');

    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(`❌ Text analysis failed after ${processingTime}ms:`, error);
      throw new Error(`Analysis failed: ${error.message}`);
    }
  }

  // Utility methods
  async makeApiCallWithRetry(apiCall, maxRetries) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 Attempt ${attempt}/${maxRetries}`);
        
        return await Promise.race([
          apiCall(),
          this.timeoutPromise(this.timeout, `API timeout after ${this.timeout}ms`)
        ]);
      } catch (error) {
        console.warn(`❌ Attempt ${attempt} failed:`, error.message);
        
        if (attempt === maxRetries) {
          throw error;
        }
        
        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        console.log(`⏳ Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  timeoutPromise(ms, message) {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    });
  }

  parseJsonResponse(text) {
    try {
      // Clean the response text
      const cleanText = text.replace(/```json\n?|\n?```/g, '').trim();
      return JSON.parse(cleanText);
    } catch (parseError) {
      console.error('Failed to parse response:', text);
      throw new Error('Invalid JSON response from API');
    }
  }

  fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  transformOptimizedResponse(data, type) {
    if (type === 'image') {
      if (!data || !data.foods || data.foods.length === 0) {
        throw new Error('No food items detected in the image');
      }

      const totalNutrition = data.total || data.foods.reduce((acc, food) => {
        const nutrition = food.nutrition;
        return {
          calories: (acc.calories || 0) + (nutrition.calories || 0),
          protein: (acc.protein || 0) + (nutrition.protein || 0),
          carbs: (acc.carbs || 0) + (nutrition.carbs || 0),
          fat: (acc.fat || 0) + (nutrition.fat || 0),
          fiber: (acc.fiber || 0) + (nutrition.fiber || 0)
        };
      }, { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });

      // Match the formatFoodsTitle helper logic
      let categoryName = '';
      const foods = data.foods || [];
      const count = foods.length || 0;
      if (count === 0) {
        categoryName = 'Unknown Food';
      } else if (count === 1) {
        categoryName = (foods[0]?.name || 'Unknown Food').trim();
      } else if (count === 2) {
        const first = (foods[0]?.name || 'Unknown Food').trim();
        const second = (foods[1]?.name || 'another item').trim();
        categoryName = `${first} & ${second}`;
      } else {
        const first = (foods[0]?.name || 'Unknown Food').trim();
        const others = count - 1;
        categoryName = `${first} + ${others} more`;
      }
      return {
        nutrition: {
          calories: Math.round(totalNutrition.calories || 0),
          protein: Math.round(totalNutrition.protein || 0),
          carbs: Math.round(totalNutrition.carbs || 0),
          fat: Math.round(totalNutrition.fat || 0),
          fiber: Math.round(totalNutrition.fiber || 0)
        },
        category: {
          name: categoryName
        },
        source: 'Google Gemini AI - Fast Analysis',
        isRealData: true,
        itemCount: data.foods.length,
        confidence: data.confidence || 'medium',
        detailedItems: data.foods.map(food => ({
          name: food.name,
          portionDescription: food.portion || 'Unknown portion',
          estimatedWeight: food.weight_g || 'Unknown',
          calories: Math.round(food.nutrition.calories || 0),
          protein: Math.round(food.nutrition.protein || 0),
          carbs: Math.round(food.nutrition.carbs || 0),
          fat: Math.round(food.nutrition.fat || 0),
          fiber: Math.round(food.nutrition.fiber || 0)
        }))
      };
    } else {
      // Text analysis
      if (!data || !data.nutrition) {
        throw new Error('No nutrition data found');
      }

      return {
        nutrition: {
          calories: Math.round(data.nutrition.calories || 0),
          protein: Math.round(data.nutrition.protein || 0),
          carbs: Math.round(data.nutrition.carbs || 0),
          fat: Math.round(data.nutrition.fat || 0),
          fiber: Math.round(data.nutrition.fiber || 0)
        },
        category: {
          name: data.name
        },
        source: 'Google Gemini AI - Fast Analysis',
        isRealData: true,
        itemCount: 1,
        servingInfo: {
          description: data.serving,
          weight: data.weight_g,
          unit: 'g'
        },
        detailedItems: [{
          name: data.name,
          portionDescription: data.serving || 'Unknown portion',
          estimatedWeight: data.weight_g || 'Unknown',
          calories: Math.round(data.nutrition.calories || 0),
          protein: Math.round(data.nutrition.protein || 0),
          carbs: Math.round(data.nutrition.carbs || 0),
          fat: Math.round(data.nutrition.fat || 0),
          fiber: Math.round(data.nutrition.fiber || 0)
        }]
      };
    }
  }

  // Legacy methods for backward compatibility
  transformGeminiResponse(geminiData) {
    console.warn('Using legacy method. Consider updating to use the optimized version.');
    return this.transformOptimizedResponse(geminiData, 'image');
  }

  transformTextResponse(geminiData) {
    console.warn('Using legacy method. Consider updating to use the optimized version.');
    return this.transformOptimizedResponse(geminiData, 'text');
  }

  transformGeminiResponseForServings(geminiData) {
    console.warn('Using legacy method. Consider updating to use the optimized version.');
    return this.transformOptimizedResponse(geminiData, 'image');
  }

  transformTextResponseForServings(geminiData) {
    console.warn('Using legacy method. Consider updating to use the optimized version.');
    return this.transformOptimizedResponse(geminiData, 'text');
  }
}

export const geminiService = new GeminiService();

export async function analyzeImageFromPlugin({ imagePath }) {
  try {
    // Load image as File object
    const response = await fetch(imagePath);
    const blob = await response.blob();
    const file = new File([blob], imagePath.split('/').pop(), { type: blob.type });
    const gemini = new GeminiService();
    const result = await gemini.analyzeImageForNutrition(file);
    // Send result back to plugin (native)
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.FoodImageAnalysis) {
      window.Capacitor.Plugins.FoodImageAnalysis.notifyAnalysisResult({ imagePath, result });
    }
    return result;
  } catch (err) {
    console.error('Error analyzing image from plugin:', err);
    return null;
  }
}