/**
 * useCorrectionsController.js — wires the Corrections tab to its
 * pricing + correction sub-hooks. Encapsulates:
 *   - Loading saved correction + pricing on tab entry
 *   - Recalculating INR side when USD side changes
 *   - Saving + reloading pricing + applying to live summary
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import useTokenPricing from './useTokenPricing';
import useTokenCorrection from './useTokenCorrection';
import { recalcSideINR } from '../services/tokenCostMath';

const SIDE_FIELD = { inputPerMillion: 'inputCost', outputPerMillion: 'outputCost' };
const SIDE_TOKENS = { inputPerMillion: 'inputTokens', outputPerMillion: 'outputTokens' };

export default function useCorrectionsController({ email, timeRange, customStartDate, customEndDate, tokenData, applyCorrectionToSummary, isActive }) {
  const pricing = useTokenPricing(email);
  const correction = useTokenCorrection({ email, timeRange, customStartDate, customEndDate, tokenData });
  const [showSuccess, setShowSuccess] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const loadedKey = useRef(null);

  // Load correction + exchange rate the first time the tab becomes active
  // for a given (email, timeRange, customRange) tuple.
  useEffect(() => {
    if (!isActive || !email) return;
    const key = `${email}|${timeRange}|${customStartDate?.toISOString() || ''}|${customEndDate?.toISOString() || ''}`;
    if (loadedKey.current === key) return;
    loadedKey.current = key;
    pricing.refreshExchangeRate();
    correction.loadCorrection();
  }, [isActive, email, timeRange, customStartDate, customEndDate, pricing, correction]);

  const onChangeUsd = useCallback((side, val) => {
    const numVal = pricing.updatePerMillion(side, val);
    const next = recalcSideINR({
      tokens: correction.totalTokenCounts[SIDE_TOKENS[side]],
      usdPerMillion: numVal,
      originalUsdPerMillion: pricing.originalPerMillionCosts[side],
      originalInr: correction.originalINRCosts[SIDE_FIELD[side]],
      exchangeRate: pricing.exchangeRate,
    });
    if (next != null) correction.setSideINR(SIDE_FIELD[side], next);
  }, [pricing, correction]);

  const onSave = useCallback(async () => {
    const result = await correction.save({ perMillionCosts: pricing.perMillionCosts });
    if (!result.ok) { alert(`Failed to save: ${result.error || 'Unknown error'}`); return; }
    await pricing.reload();
    applyCorrectionToSummary(result.costs.inputCost, result.costs.outputCost);
    setShowSuccess(true);
    setSavedFlash(true);
    setTimeout(() => setShowSuccess(false), 1500);
    setTimeout(() => setSavedFlash(false), 2000);
  }, [correction, pricing, applyCorrectionToSummary]);

  return {
    perMillionInputs: pricing.perMillionInputs,
    perMillionCosts: pricing.perMillionCosts,
    exchangeRate: pricing.exchangeRate,
    tokenCosts: correction.tokenCosts,
    tokenCostInputs: correction.tokenCostInputs,
    savingCorrection: correction.savingCorrection,
    showSuccess, savedFlash,
    onChangeUsd, onSave,
  };
}
