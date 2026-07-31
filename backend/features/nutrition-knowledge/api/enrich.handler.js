/**
 * backend/features/nutrition-knowledge/api/enrich.handler.js
 * Optional text AI enrich — 1 credit only on successful recognised nutrition.
 */
import { isEnabled } from '../../../shared/lib/feature-flags.js';
import { ValidationError } from '../../../shared/lib/ValidationError.js';
import { estimateNutritionFromText } from '../../../shared/lib/ai-orchestration/AIGateway.js';
import {
  assertReservationValid,
  confirmCredit,
  releaseCredit,
} from '../../ai-credits/index.js';
import { pickNutrition } from '../domain/nutrition.rules.js';
import { recordAiFoodCandidate } from './resolve.handler.js';
import logger from '../../../shared/lib/logger.js';

/**
 * @param {{ userId: number, name: string, weightG: number, reservationId: string|null, macros: object|null }} input
 */
export async function enrichFoodText(input) {
  if (!isEnabled('ff.nutrition-knowledge')) {
    throw new ValidationError(404, 'Nutrition knowledge is disabled');
  }
  if (!isEnabled('ff.ai-credits')) {
    throw new ValidationError(403, 'AI credits are disabled');
  }
  if (!input.reservationId) {
    throw new ValidationError(400, 'reservationId is required for AI enrich');
  }

  await assertReservationValid({
    userId: input.userId,
    reservationId: input.reservationId,
  });

  let estimate;
  try {
    estimate = await estimateNutritionFromText({
      name: input.name,
      weightG: input.weightG,
      macros: input.macros,
    });
  } catch (err) {
    logger.error('[nutrition-knowledge.enrich] Gemini failed', {
      message: err.message,
      code: err.code ?? null,
    });
    await releaseCredit({
      userId: input.userId,
      reservationId: input.reservationId,
    }).catch(() => {});
    return {
      httpStatus: 502,
      body: {
        ok: false,
        error: {
          code: err.code || 'AI_FAILED',
          message: 'AI nutrition enrich failed',
        },
      },
    };
  }

  const nutrition = pickNutrition(estimate.nutrition);
  const confidence = Number(estimate.confidence) || 0;
  const calories = Number(nutrition.calories) || 0;
  const recognised = confidence >= 0.4 && (calories > 0 || Object.keys(nutrition).length >= 5);

  if (!recognised) {
    await confirmCredit({
      userId: input.userId,
      reservationId: input.reservationId,
      analysisResult: {
        imageType: 'other',
        type: 'other',
        confidence: 0,
        defaulted: true,
        error: 'unrecognised_food',
        details: { defaulted: true },
      },
    }).catch(() => {});
    return {
      httpStatus: 200,
      body: {
        ok: true,
        data: {
          found: false,
          deducted: false,
          reason: 'unrecognised_food',
          item: null,
        },
      },
    };
  }

  const item = {
    name: estimate.name,
    weight_g: estimate.weight_g,
    source: 'ai_enrich',
    is_liquid: estimate.isLiquid,
    portion: estimate.portion,
    ...nutrition,
    nutrition,
    confidence,
  };

  await confirmCredit({
    userId: input.userId,
    reservationId: input.reservationId,
    analysisResult: {
      imageType: 'food',
      type: 'food',
      confidence,
      details: { foods: [{ name: item.name, nutrition }] },
      fastNutrition: nutrition,
    },
  }).catch(() => {});

  // Grow master catalog (draft candidate).
  await recordAiFoodCandidate({
    foods: [{
      name: item.name,
      weight_g: item.weight_g,
      isLiquid: item.is_liquid,
      portion: item.portion,
      nutrition,
    }],
  }).catch(() => {});

  return {
    httpStatus: 200,
    body: {
      ok: true,
      data: {
        found: true,
        deducted: true,
        source: 'ai_enrich',
        item,
      },
    },
  };
}
