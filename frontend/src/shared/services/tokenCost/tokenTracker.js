/**
 * Token Tracker - Handles Token Logging and Database Persistence
 *
 * This is the ONLY module that feature services should import for token tracking.
 * Call trackTokenUsage() after each AI request - that's it!
 * For multi-call operations, use trackCombinedTokenUsage() to track all calls together.
 */

import { getUsdToInrRate } from "./tokenCostConfig";
import {
  calculateTokenCosts,
  extractTokenMetadata,
} from "./tokenCostCalculator";

// API Base URL
const API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL || "http://localhost:3000";

// Deduplication: Track responses that have already been processed
// Uses WeakSet so responses can be garbage collected after processing
const processedResponses = new WeakSet();

/**
 * Track token usage from a Gemini AI response
 *
 * This is the main entry point for all token tracking.
 * Feature services should ONLY call this function.
 *
 * @param {object} params - Tracking parameters
 * @param {object} params.response - Gemini AI response object
 * @param {string} params.operationType - Type of operation (e.g., 'food_analysis', 'weight_detection')
 * @param {string} params.modelName - AI model name (default: 'gemini-2.5-flash-lite')
 * @param {string} params.userId - Current user's ID
 * @param {string} params.userEmail - Current user's email
 * @param {number} [params.processingTime] - Optional processing time in ms (for logging)
 * @returns {Promise<void>}
 */
export async function trackTokenUsage({
  response,
  operationType,
  modelName = "gemini-2.5-flash-lite",
  userId,
  userEmail,
  processingTime,
}) {
  // Never block user flow - wrap everything in try-catch
  try {
    // Validate required params
    if (!userId || !userEmail) {
      console.warn("⚠️ Token tracking skipped - user info not set");
      return;
    }

    if (!response) {
      console.warn("⚠️ Token tracking skipped - no response object");
      return;
    }

    // Deduplication: Skip if this exact response has already been tracked
    // This prevents React StrictMode double-invocations from causing duplicate DB entries
    if (processedResponses.has(response)) {
      console.log("Token tracking skipped - response already processed");
      return;
    }
    processedResponses.add(response);

    // Extract token metadata from response
    const tokenMetadata = extractTokenMetadata(response);

    // Get current exchange rate (may be null if API fails)
    const exchangeRate = await getUsdToInrRate();

    // Calculate costs (with user-specific pricing)
    const costs = await calculateTokenCosts({
      inputTokens: tokenMetadata.inputTokens,
      outputTokens: tokenMetadata.outputTokens,
      modelName,
      userEmail,
      exchangeRate,
    });

    // Log to console (development visibility)
    logTokenUsageToConsole(operationType, costs, processingTime);

    // Skip database save if exchange rate unavailable (no INR costs)
    if (!costs.hasExchangeRate) {
      console.warn("⚠️ Token usage not saved - exchange rate unavailable");
      return;
    }

    // Save to database
    await saveTokenUsageToDatabase({
      userId,
      email: userEmail,
      operationType,
      modelName,
      inputTokens: costs.inputTokens,
      outputTokens: costs.outputTokens,
      totalTokens: costs.totalTokens,
      inputTokenCost: costs.inputCostInr,
      outputTokenCost: costs.outputCostInr,
      totalTokenCost: costs.totalCostInr,
    });
  } catch (error) {
    // Fail silently - never interrupt user flow
    console.warn("⚠️ Token tracking failed:", error.message);
  }
}

/**
 * Track COMBINED token usage from multiple Gemini AI responses
 * Used when a single operation makes multiple API calls (e.g., detection + analysis)
 *
 * @param {object} params - Tracking parameters
 * @param {Array<{response: object, label: string}>} params.responses - Array of response objects with labels
 * @param {string} params.operationType - Type of operation (e.g., 'image_analysis')
 * @param {string} params.modelName - AI model name (default: 'gemini-2.5-flash-lite')
 * @param {string} params.userId - Current user's ID
 * @param {string} params.userEmail - Current user's email
 * @param {number} [params.processingTime] - Total processing time in ms
 * @returns {Promise<void>}
 */
export async function trackCombinedTokenUsage({
  responses,
  operationType,
  modelName = "gemini-2.5-flash-lite",
  userId,
  userEmail,
  processingTime,
}) {
  // Never block user flow - wrap everything in try-catch
  try {
    // Validate required params
    if (!userId || !userEmail) {
      console.warn("⚠️ Combined token tracking skipped - user info not set");
      return;
    }

    if (!responses || responses.length === 0) {
      console.warn("⚠️ Combined token tracking skipped - no responses");
      return;
    }

    // Check for duplicate processing
    for (const { response } of responses) {
      if (processedResponses.has(response)) {
        console.log(
          "Combined token tracking skipped - responses already processed",
        );
        return;
      }
    }
    // Mark all as processed
    for (const { response } of responses) {
      processedResponses.add(response);
    }

    // Get current exchange rate (may be null if API fails)
    const exchangeRate = await getUsdToInrRate();

    // Extract and calculate for each response
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    const callDetails = [];

    for (const { response, label } of responses) {
      const metadata = extractTokenMetadata(response);
      totalInputTokens += metadata.inputTokens;
      totalOutputTokens += metadata.outputTokens;

      callDetails.push({
        label,
        inputTokens: metadata.inputTokens,
        outputTokens: metadata.outputTokens,
      });
    }

    // Calculate combined costs (with user-specific pricing)
    const costs = await calculateTokenCosts({
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      modelName,
      userEmail,
      exchangeRate,
    });

    // Log totals to console
    logCombinedTotalsToConsole(operationType, costs, processingTime);

    // Skip database save if exchange rate unavailable (no INR costs)
    if (!costs.hasExchangeRate) {
      console.warn("⚠️ Token usage not saved - exchange rate unavailable");
      return;
    }

    // Save combined total to database
    await saveTokenUsageToDatabase({
      userId,
      email: userEmail,
      operationType,
      modelName,
      inputTokens: costs.inputTokens,
      outputTokens: costs.outputTokens,
      totalTokens: costs.totalTokens,
      inputTokenCost: costs.inputCostInr,
      outputTokenCost: costs.outputCostInr,
      totalTokenCost: costs.totalCostInr,
    });
  } catch (error) {
    // Fail silently - never interrupt user flow
    console.warn("⚠️ Combined token tracking failed:", error.message);
  }
}

/**
 * Log token usage to console for development visibility
 */
function logTokenUsageToConsole(operationType, costs, processingTime) {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`📊 Token Usage [${operationType}]`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`� Input Tokens:  ${costs.inputTokens}`);
  console.log(`💬 Output Tokens: ${costs.outputTokens}`);
  console.log(`📈 Total Tokens:  ${costs.totalTokens}`);
  if (processingTime) {
    console.log(`⏱️  Processing:    ${processingTime}ms`);
  }
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`💵 Input Cost (USD):  $${costs.inputCostUsd.toFixed(6)}`);
  console.log(`💵 Output Cost (USD): $${costs.outputCostUsd.toFixed(6)}`);
  console.log(`💵 Total Cost (USD):  $${costs.totalCostUsd.toFixed(6)}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  if (costs.hasExchangeRate) {
    console.log(`💰 Input Cost (INR):  ₹${costs.inputCostInr.toFixed(4)}`);
    console.log(`💰 Output Cost (INR): ₹${costs.outputCostInr.toFixed(4)}`);
    console.log(`💰 Total Cost (INR):  ₹${costs.totalCostInr.toFixed(4)}`);
    console.log(`💱 Rate: $1 = ₹${costs.exchangeRate.toFixed(2)}`);
  } else {
    console.log(`💰 INR: ⚠️ Exchange rate unavailable`);
  }
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

/**
 * Log combined totals to console (without per-call breakdown)
 */
function logCombinedTotalsToConsole(operationType, costs, processingTime) {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`📊 Token Usage [${operationType}]`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`📥 Input Tokens:  ${costs.inputTokens}`);
  console.log(`💬 Output Tokens: ${costs.outputTokens}`);
  console.log(`📈 Total Tokens:  ${costs.totalTokens}`);
  if (processingTime) {
    console.log(`⏱️  Processing:    ${processingTime}ms`);
  }
  console.log("----------------------------------------");
  console.log("💵 COSTS (USD)");
  console.log(`   📥 Input:  $${costs.inputCostUsd.toFixed(6)}`);
  console.log(`   💬 Output: $${costs.outputCostUsd.toFixed(6)}`);
  console.log(`   💰 Total:  $${costs.totalCostUsd.toFixed(6)}`);
  console.log("----------------------------------------");
  if (costs.hasExchangeRate) {
    console.log("💰 COSTS (INR)");
    console.log(`   📥 Input:  ₹${costs.inputCostInr.toFixed(4)}`);
    console.log(`   💬 Output: ₹${costs.outputCostInr.toFixed(4)}`);
    console.log(`   💰 Total:  ₹${costs.totalCostInr.toFixed(4)}`);
    // console.log(`   💱 Rate: $1 = ₹${costs.exchangeRate.toFixed(2)}`);
  } else {
    console.log("💰 INR: ⚠️ Exchange rate unavailable");
  }
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

/**
 * Save token usage to backend database
 */
async function saveTokenUsageToDatabase(tokenData) {
  const url = `${API_BASE_URL}/api/token/usage`;

  console.log("📤 Saving token usage to:", url);

  const response = await fetch(url, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    },

    body: JSON.stringify(tokenData),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  const result = await response.json();

  if (result.success) {
    console.log("✅ Token usage saved, ID:", result.id);
    if (result.tokenData) {
      console.log("📊 Token Response:", {
        "📥 Input Tokens": result.tokenData.inputTokens,
        "💬 Output Tokens": result.tokenData.outputTokens,
        "📈 Total Tokens": result.tokenData.totalTokens,
        "💰 Input Cost (INR)": `₹${Number(
          result.tokenData.inputTokenCost,
        ).toFixed(4)}`,
        "💰 Output Cost (INR)": `₹${Number(
          result.tokenData.outputTokenCost,
        ).toFixed(4)}`,
        "💰 Total Cost (INR)": `₹${Number(
          result.tokenData.totalTokenCost,
        ).toFixed(4)}`,
        "🔧 Operation": result.tokenData.operationType,
        "🤖 Model": result.tokenData.modelName,
      });
    }
  } else {
    throw new Error(result.message || "Failed to save");
  }

  return result;
}

/**
 * Create a token tracker instance for a specific service
 *
 * This provides a cleaner API for services that need to track multiple operations.
 *
 * @param {string} defaultModelName - Default model name for this service
 * @returns {object} Token tracker instance
 */
export function createTokenTracker(defaultModelName = "gemini-2.5-flash-lite") {
  let currentUserId = null;
  let currentUserEmail = null;

  return {
    /**
     * Set the current user for tracking
     */
    setCurrentUser(userId, email) {
      currentUserId = userId;
      currentUserEmail = email;
      console.log("📊 [TokenTracker] User set:", { userId, email });
    },

    /**
     * Get current user ID
     */
    getCurrentUserId() {
      return currentUserId;
    },

    /**
     * Get current user email
     */
    getCurrentUserEmail() {
      return currentUserEmail;
    },

    /**
     * Track token usage for a response
     */
    async track(response, operationType, processingTime) {
      return trackTokenUsage({
        response,
        operationType,
        modelName: defaultModelName,
        userId: currentUserId,
        userEmail: currentUserEmail,
        processingTime,
      });
    },
  };
}
