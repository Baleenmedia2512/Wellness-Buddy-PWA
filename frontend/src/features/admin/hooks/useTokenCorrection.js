/**
 * useTokenCorrection.js — load + save per-time-range INR cost corrections.
 *
 * Workflow when the editor opens:
 *   1. Fetch live exchange rate + pricing config (delegated to useTokenPricing)
 *   2. GET /api/token/correction — if a row exists for this timeRange use it
 *   3. Otherwise fall back to the current dashboard summary
 *   4. Otherwise fetch a fresh /api/token/usage for totals
 */
import { useState, useCallback } from 'react';
import { fetchTokenCorrection, fetchTokenUsage, saveTokenCorrection } from '../services/adminApi';
import { clearUserPricingCache, } from '../../../shared/services/tokenCost/userPricingManager';
import { clearPricingCache } from '../../../shared/services/tokenCost/tokenCostConfig';
import { formatInrInput } from '../services/tokenCostMath';

const EMPTY_COSTS = { inputCost: 0, outputCost: 0 };

export default function useTokenCorrection({ email, timeRange, customStartDate, customEndDate, tokenData }) {
  const [tokenCosts, setTokenCosts] = useState(EMPTY_COSTS);
  const [tokenCostInputs, setTokenCostInputs] = useState({ inputCost: '', outputCost: '' });
  const [originalTokenCosts, setOriginalTokenCosts] = useState(EMPTY_COSTS);
  const [originalINRCosts, setOriginalINRCosts] = useState(EMPTY_COSTS);
  const [totalTokenCounts, setTotalTokenCounts] = useState({ inputTokens: 0, outputTokens: 0 });
  const [savingCorrection, setSavingCorrection] = useState(false);

  const applyCosts = useCallback((costs, tokens) => {
    setTokenCosts(costs);
    setTokenCostInputs({ inputCost: formatInrInput(costs.inputCost), outputCost: formatInrInput(costs.outputCost) });
    setOriginalTokenCosts(costs);
    setOriginalINRCosts(costs);
    if (tokens) setTotalTokenCounts(tokens);
  }, []);

  const loadCorrection = useCallback(async () => {
    const saved = await fetchTokenCorrection({ email, timeRange, startDate: customStartDate, endDate: customEndDate });
    if (saved) {
      const costs = { inputCost: parseFloat(saved.inputCost || 0), outputCost: parseFloat(saved.outputCost || 0) };
      const tokens = tokenData?.summary
        ? { inputTokens: tokenData.summary.totalInputTokens || 0, outputTokens: tokenData.summary.totalOutputTokens || 0 }
        : null;
      applyCosts(costs, tokens);
      return;
    }
    if (tokenData?.summary) {
      const s = tokenData.summary;
      applyCosts(
        { inputCost: parseFloat(s.totalInputCost || 0), outputCost: parseFloat(s.totalOutputCost || 0) },
        { inputTokens: s.totalInputTokens || 0, outputTokens: s.totalOutputTokens || 0 },
      );
      return;
    }
    const fresh = await fetchTokenUsage({ email, timeRange, startDate: customStartDate, endDate: customEndDate });
    if (fresh?.summary) {
      const s = fresh.summary;
      applyCosts(
        { inputCost: parseFloat(s.totalInputCost || 0), outputCost: parseFloat(s.totalOutputCost || 0) },
        { inputTokens: s.totalInputTokens || 0, outputTokens: s.totalOutputTokens || 0 },
      );
    }
  }, [email, timeRange, customStartDate, customEndDate, tokenData, applyCosts]);

  const reset = useCallback(() => applyCosts(EMPTY_COSTS), [applyCosts]);

  const setSideINR = useCallback((side, val) => {
    setTokenCosts((prev) => ({ ...prev, [side]: val }));
    setTokenCostInputs((prev) => ({ ...prev, [side]: formatInrInput(val) }));
  }, []);

  const save = useCallback(async ({ perMillionCosts }) => {
    setSavingCorrection(true);
    try {
      await saveTokenCorrection({
        email,
        originalInputCost: originalTokenCosts.inputCost,
        originalOutputCost: originalTokenCosts.outputCost,
        correctedInputCost: tokenCosts.inputCost,
        correctedOutputCost: tokenCosts.outputCost,
        inputPerMillion: perMillionCosts.inputPerMillion,
        outputPerMillion: perMillionCosts.outputPerMillion,
        timeRange, startDate: customStartDate, endDate: customEndDate,
      });
      clearUserPricingCache(email);
      clearPricingCache(email);
      setOriginalTokenCosts({ ...tokenCosts });
      return { ok: true, costs: { ...tokenCosts } };
    } catch (err) {
      return { ok: false, error: err.message };
    } finally {
      setSavingCorrection(false);
    }
  }, [email, originalTokenCosts, tokenCosts, timeRange, customStartDate, customEndDate]);

  return {
    tokenCosts, tokenCostInputs, originalINRCosts, totalTokenCounts,
    savingCorrection, loadCorrection, reset, setSideINR, save,
  };
}
