/**
 * User-Specific Pricing Manager
 *
 * Fetches and caches user-specific token pricing configurations
 * Falls back to default pricing from tokenCostConfig.js
 */

import { getModelPricing } from "./tokenCostConfig";

// Cache for user-specific pricing (keyed by email)
const userPricingCache = new Map();
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

/**
 * Fetch user-specific pricing from API
 * @param {string} email - User's email
 * @param {string} modelName - AI model name
 * @returns {Promise<object>} Pricing object { inputPerMillion, outputPerMillion }
 */
export async function fetchUserPricing(
  email,
  modelName = "gemini-2.5-flash-lite",
) {
  if (!email) {
    console.warn("⚠️ No email provided, using default pricing");
    return await getModelPricing(modelName);
  }

  // Check cache first
  const cacheKey = `${email}_${modelName}`;
  const cached = userPricingCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log("💾 Using cached user pricing for:", email);
    return cached.pricing;
  }

  // Skip fetch in non-browser environment
  if (typeof window === "undefined") {
    console.warn("⚠️ Cannot fetch user pricing in non-browser environment");
    return await getModelPricing(modelName);
  }

  try {
    const apiBaseUrl = process.env.REACT_APP_API_BASE_URL || "";
    const response = await fetch(
      `${apiBaseUrl}/api/token/pricing?email=${encodeURIComponent(
        email,
      )}&modelName=${modelName}`,
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
        const pricing = {
          inputPerMillion: data.data.inputPerMillion,
          outputPerMillion: data.data.outputPerMillion,
        };

        // Cache the result
        userPricingCache.set(cacheKey, {
          pricing,
          timestamp: Date.now(),
        });

        console.log(
          `💰 ${
            data.data.isDefault ? "Default" : "Custom"
          } pricing loaded for ${email}:`,
          pricing,
        );
        return pricing;
      }
    }

    throw new Error("Failed to fetch user pricing");
  } catch (error) {
    console.error("❌ Error fetching user pricing:", error.message);
    console.log("📊 Falling back to default pricing");

    // Return default pricing on error
    return await getModelPricing(modelName);
  }
}

/**
 * Clear user pricing cache (call when pricing is updated)
 * @param {string} email - User's email (optional, clears all if not provided)
 */
export function clearUserPricingCache(email = null) {
  if (email) {
    // Clear specific user's cache
    for (const key of userPricingCache.keys()) {
      if (key.startsWith(email)) {
        userPricingCache.delete(key);
      }
    }
    console.log("🗑️ Cleared pricing cache for:", email);
  } else {
    // Clear all cache
    userPricingCache.clear();
    console.log("🗑️ Cleared all pricing cache");
  }
}

/**
 * Get model pricing (user-specific if available, otherwise default)
 * This is a synchronous function that uses cached data
 * Call fetchUserPricing first to populate the cache
 *
 * @param {string} modelName - AI model name
 * @param {string} email - User's email (optional)
 * @returns {object} Pricing object { inputPerMillion, outputPerMillion }
 */
export async function getUserModelPricing(modelName, email = null) {
  if (email) {
    const cacheKey = `${email}_${modelName}`;
    const cached = userPricingCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.pricing;
    }
  }

  // Return default pricing from API
  return await getModelPricing(modelName);
}
