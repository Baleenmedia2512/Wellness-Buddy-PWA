/**
 * Token Cost Configuration - Single Source of Truth
 *
 * All AI model pricing and currency conversion rates are defined here.
 * Pricing is fetched from database via API - no hardcoded defaults.
 */

// Currency Configuration
export const CURRENCY_CONFIG = {
  // Exchange rate API (no fallback - live rate only)
  exchangeRateApiUrl: "https://open.er-api.com/v6/latest/USD",
  exchangeRateTimeout: 10000, // 10 seconds
};

// Cached pricing from API
let cachedPricing = null;
let pricingLastFetchTime = null;
const PRICING_CACHE_DURATION = 60 * 60 * 1000; // 1 hour cache

// Cached exchange rate (shared across all services)
let cachedExchangeRate = null;
let lastFetchTime = null;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour cache

/**
 * Fetch pricing from API for a specific model
 * @param {string} email - User email
 * @param {string} modelName - Model name
 * @returns {Promise<object|null>} Pricing data or null if unavailable
 */
async function fetchPricingFromAPI(email, modelName) {
  if (typeof window === "undefined") {
    console.warn("⚠️ Cannot fetch pricing in non-browser environment");
    return null;
  }

  try {
    const apiBaseUrl = process.env.REACT_APP_API_BASE_URL;
    const response = await fetch(
      `${apiBaseUrl}/api/get-token-pricing?email=${encodeURIComponent(
        email,
      )}&modelName=${encodeURIComponent(modelName)}`,
      {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      },
    );

    if (response.ok) {
      const data = await response.json();
      if (data.success && data.data) {
        console.log("📊 Pricing fetched from API:", data.data);
        return {
          inputPerMillion: data.data.inputPerMillion,
          outputPerMillion: data.data.outputPerMillion,
          isDefault: data.data.isDefault,
        };
      }
    }

    throw new Error("Invalid pricing data from API");
  } catch (error) {
    console.error("❌ Pricing fetch failed:", error.message);
    return null;
  }
}

/**
 * Get pricing for a specific model (with API fetch and caching)
 * @param {string} modelName - Name of the AI model
 * @param {string} email - User email (optional, for user-specific pricing)
 * @returns {Promise<object>} Pricing rates { inputPerMillion, outputPerMillion }
 */
export async function getModelPricing(modelName, email = null) {
  // Return cached pricing if still valid
  if (
    cachedPricing &&
    pricingLastFetchTime &&
    Date.now() - pricingLastFetchTime < PRICING_CACHE_DURATION
  ) {
    return cachedPricing;
  }

  // Fetch from API - required, no hardcoded fallback
  const apiPricing = await fetchPricingFromAPI(email, modelName);
  if (apiPricing) {
    cachedPricing = apiPricing;
    pricingLastFetchTime = Date.now();
    return apiPricing;
  }

  // If API fails and no cache, throw error
  if (!cachedPricing) {
    throw new Error(
      "Unable to fetch pricing from API and no cached pricing available",
    );
  }

  // Return stale cache as last resort
  console.warn("⚠️ Using stale cached pricing");
  return cachedPricing;
}

/**
 * Clear cached pricing (useful when pricing is updated)
 * @param {string} email - User email
 */
export function clearPricingCache(email) {
  cachedPricing = null;
  pricingLastFetchTime = null;
  console.log("🗑️ Pricing cache cleared for:", email);
}

/**
 * Get USD to INR exchange rate (with caching, no fallback)
 * @returns {Promise<number|null>} Exchange rate or null if unavailable
 */
export async function getUsdToInrRate() {
  // Return cached rate if still valid
  if (
    cachedExchangeRate &&
    lastFetchTime &&
    Date.now() - lastFetchTime < CACHE_DURATION
  ) {
    return cachedExchangeRate;
  }

  // Skip fetch in non-browser environment
  if (typeof window === "undefined") {
    console.warn("⚠️ Cannot fetch exchange rate in non-browser environment");
    return cachedExchangeRate; // Return cached or null
  }

  try {
    const fetchWithTimeout = Promise.race([
      fetch(CURRENCY_CONFIG.exchangeRateApiUrl),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Exchange rate timeout")),
          CURRENCY_CONFIG.exchangeRateTimeout,
        ),
      ),
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

    throw new Error("Invalid exchange rate data from API");
  } catch (error) {
    console.error("❌ Exchange rate fetch failed:", error.message);
    console.warn("⚠️ Cost calculations will use cached rate or be skipped");
  }

  // Return cached rate if available, otherwise null (no fallback)
  return cachedExchangeRate;
}
