/**
 * Token Cost Calculator - Pure Function
 *
 * Calculates token costs based on model pricing and exchange rate.
 * No side effects, no API calls - just math.
 */

import { getModelPricing } from "./tokenCostConfig";

/**
 * Calculate token costs in both USD and INR
 *
 * @param {object} params - Calculation parameters
 * @param {number} params.inputTokens - Number of input/prompt tokens
 * @param {number} params.outputTokens - Number of output/completion tokens
 * @param {string} params.modelName - Name of the AI model
 * @param {number|null} params.exchangeRate - USD to INR exchange rate (null if unavailable)
 * @returns {Promise<object>} Calculated costs
 */
export async function calculateTokenCosts({
  inputTokens,
  outputTokens,
  modelName,
  exchangeRate,
}) {
  // Get pricing for the model
  const pricing = await getModelPricing(modelName);

  console.log("🔢 [CALC] Pricing:", pricing);

  // Ensure valid numbers (default to 0 for missing values)
  const safeInputTokens = inputTokens || 0;
  const safeOutputTokens = outputTokens || 0;

  // Calculate USD costs: (tokens / 1,000,000) × price_per_million
  const inputCostUsd = (safeInputTokens / 1000000) * pricing.inputPerMillion;
  const outputCostUsd = (safeOutputTokens / 1000000) * pricing.outputPerMillion;
  const totalCostUsd = inputCostUsd + outputCostUsd;

  console.log("🔢 [CALC] Input:", {
    tokens: safeInputTokens,
    pricePerM: pricing.inputPerMillion,
    costUsd: inputCostUsd,
  });
  console.log("🔢 [CALC] Output:", {
    tokens: safeOutputTokens,
    pricePerM: pricing.outputPerMillion,
    costUsd: outputCostUsd,
  });
  console.log(
    "🔢 [CALC] Total USD:",
    totalCostUsd,
    "=",
    inputCostUsd,
    "+",
    outputCostUsd,
  );

  // Convert to INR only if exchange rate is available (no fallback)
  const hasExchangeRate = exchangeRate && exchangeRate > 0;
  const inputCostInr = hasExchangeRate ? inputCostUsd * exchangeRate : null;
  const outputCostInr = hasExchangeRate ? outputCostUsd * exchangeRate : null;
  const totalCostInr = hasExchangeRate ? totalCostUsd * exchangeRate : null;

  return {
    // Token counts
    inputTokens: safeInputTokens,
    outputTokens: safeOutputTokens,
    totalTokens: safeInputTokens + safeOutputTokens,

    // USD costs (always available)
    inputCostUsd,
    outputCostUsd,
    totalCostUsd,

    // INR costs (null if exchange rate unavailable)
    inputCostInr,
    outputCostInr,
    totalCostInr,

    // Metadata
    modelName,
    exchangeRate: exchangeRate || null,
    hasExchangeRate,
  };
}

/**
 * Extract token metadata from Gemini AI response
 *
 * @param {object} response - Gemini AI response object
 * @returns {object} Extracted token counts
 */
export function extractTokenMetadata(response) {
  const usageMetadata = response?.usageMetadata || {};

  // Thinking tokens are charged as output but reported separately
  // Google charges: Output price = candidatesTokenCount + thoughtsTokenCount
  const thinkingTokens = usageMetadata.thoughtsTokenCount || 0;
  const candidateTokens = usageMetadata.candidatesTokenCount || 0;

  // Output tokens for billing = visible output + thinking tokens
  const totalOutputTokens = candidateTokens + thinkingTokens;

  if (thinkingTokens > 0) {
    console.log(
      `🧠 Thinking tokens detected: ${thinkingTokens} (charged as output)`,
    );
  }

  return {
    inputTokens: usageMetadata.promptTokenCount || 0,
    outputTokens: totalOutputTokens,
    thinkingTokens: thinkingTokens,
    candidateTokens: candidateTokens,
    totalTokens: (usageMetadata.promptTokenCount || 0) + totalOutputTokens,
  };
}
