/**
 * Token Cost Configuration - Single Source of Truth
 * 
 * All AI model pricing and currency conversion rates are defined here.
 * Do NOT hardcode pricing in individual service files.
 */

// Gemini Model Pricing (USD per 1 million tokens)
// Source: https://ai.google.dev/pricing
// Last updated: January 2026
export const MODEL_PRICING = {
  'gemini-2.5-flash-lite': {
    inputPerMillion: 0.10,   // $0.10 per 1M input tokens
    outputPerMillion: 0.40   // $0.40 per 1M output tokens
  }
};

// Currency Configuration
export const CURRENCY_CONFIG = {
  // Exchange rate API (no fallback - live rate only)
  exchangeRateApiUrl: 'https://open.er-api.com/v6/latest/USD',
  exchangeRateTimeout: 10000 // 10 seconds
};

// Cached exchange rate (shared across all services)
let cachedExchangeRate = null;
let lastFetchTime = null;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour cache

/**
 * Get USD to INR exchange rate (with caching, no fallback)
 * @returns {Promise<number|null>} Exchange rate or null if unavailable
 */
export async function getUsdToInrRate() {
  // Return cached rate if still valid
  if (cachedExchangeRate && lastFetchTime && (Date.now() - lastFetchTime < CACHE_DURATION)) {
    return cachedExchangeRate;
  }

  // Skip fetch in non-browser environment
  if (typeof window === 'undefined') {
    console.warn('⚠️ Cannot fetch exchange rate in non-browser environment');
    return cachedExchangeRate; // Return cached or null
  }

  try {
    const fetchWithTimeout = Promise.race([
      fetch(CURRENCY_CONFIG.exchangeRateApiUrl),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Exchange rate timeout')), CURRENCY_CONFIG.exchangeRateTimeout)
      )
    ]);

    const response = await fetchWithTimeout;
    
    if (response.ok) {
      const data = await response.json();
      const rate = data.rates?.INR;
      
      if (rate && rate > 0) {
        cachedExchangeRate = rate;
        lastFetchTime = Date.now();
        console.log(`💱 Exchange rate updated: $1 = ₹${rate.toFixed(2)}`);
        return rate;
      }
    }
    
    throw new Error('Invalid exchange rate data from API');
  } catch (error) {
    console.error('❌ Exchange rate fetch failed:', error.message);
    console.warn('⚠️ Cost calculations will use cached rate or be skipped');
  }

  // Return cached rate if available, otherwise null (no fallback)
  return cachedExchangeRate;
}

/**
 * Get pricing for a specific model
 * @param {string} modelName - Name of the AI model
 * @returns {object} Pricing rates { inputPerMillion, outputPerMillion }
 */
export function getModelPricing(modelName) {
  return MODEL_PRICING[modelName] || MODEL_PRICING['gemini-2.5-flash-lite'];
}
