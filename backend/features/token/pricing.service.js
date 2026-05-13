/**
 * pricing.service.js — Token feature: GET `/api/token/pricing`.
 *
 * Returns the active per-model pricing or a sensible default. Original
 * behavior preserved: errors collapse into the default response with the
 * error message attached.
 */
import * as repo from './token.repository.js';

const DEFAULT_INPUT_PER_MILLION = 0.1;
const DEFAULT_OUTPUT_PER_MILLION = 0.4;

const defaults = (modelName, extra = {}) => ({
  httpStatus: 200,
  body: {
    success: true,
    data: {
      inputPerMillion: DEFAULT_INPUT_PER_MILLION,
      outputPerMillion: DEFAULT_OUTPUT_PER_MILLION,
      modelName, isDefault: true, ...extra,
    },
  },
});

export async function getPricing({ modelName }) {
  try {
    const pricing = await repo.getActivePricing(modelName);
    if (!pricing) return defaults(modelName);
    return {
      httpStatus: 200,
      body: {
        success: true,
        data: {
          inputPerMillion: parseFloat(pricing.InputCostPer1M),
          outputPerMillion: parseFloat(pricing.OutputCostPer1M),
          modelName: pricing.ModelName,
          updatedAt: pricing.UpdatedAt,
          isDefault: false,
        },
      },
    };
  } catch (error) {
    return defaults(modelName, { error: error.message });
  }
}
