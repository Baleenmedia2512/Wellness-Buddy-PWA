/**
 * Read-only Premium price for a member's Community Position (base + GST).
 */
import { ValidationError } from '../../../shared/lib/ValidationError.js';
import {
  getPremiumPricingConfig,
  resolvePremiumQuote,
} from '../domain/premiumPricing.rules.js';

/**
 * @param {{ eventLevel?: unknown }} input
 */
export function getPremiumQuote(input) {
  const quote = resolvePremiumQuote(input.eventLevel, getPremiumPricingConfig());
  if (!quote) {
    throw new ValidationError(
      422,
      'Set Community Position on your profile before paying',
    );
  }
  return {
    httpStatus: 200,
    body: {
      ok: true,
      data: {
        positionCode: quote.positionCode,
        baseAmount: quote.baseAmount,
        gstAmount: quote.gstAmount,
        gstRate: quote.gstRate,
        amount: quote.totalAmount,
      },
    },
  };
}
