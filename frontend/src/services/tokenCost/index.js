/**
 * Token Cost Module - Public API
 * 
 * Import from this file for all token tracking needs.
 * 
 * Usage in feature services:
 * 
 * import { trackTokenUsage, createTokenTracker, trackCombinedTokenUsage } from './tokenCost';
 * 
 * // Option 1: Direct tracking (single call)
 * await trackTokenUsage({
 *   response,
 *   operationType: 'food_analysis',
 *   userId: this.currentUserId,
 *   userEmail: this.currentUserEmail,
 *   processingTime
 * });
 * 
 * // Option 2: Create a tracker instance
 * const tokenTracker = createTokenTracker('gemini-2.5-flash-lite');
 * tokenTracker.setCurrentUser(userId, email);
 * await tokenTracker.track(response, 'food_analysis', processingTime);
 * 
 * // Option 3: Combined tracking (multiple calls)
 * await trackCombinedTokenUsage({
 *   responses: [
 *     { response: detectionResponse, label: 'Detection' },
 *     { response: analysisResponse, label: 'Analysis' }
 *   ],
 *   operationType: 'image_analysis',
 *   userId, userEmail, processingTime
 * });
 */

// Main tracking functions - use these in feature services
export { trackTokenUsage, trackCombinedTokenUsage, createTokenTracker } from './tokenTracker';

// Configuration - for advanced usage or updates
export { 
  MODEL_PRICING, 
  CURRENCY_CONFIG, 
  getUsdToInrRate, 
  getModelPricing 
} from './tokenCostConfig';

// Calculator - for testing or custom implementations
export { 
  calculateTokenCosts, 
  extractTokenMetadata 
} from './tokenCostCalculator';
