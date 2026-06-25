/**
 * useTokenPricing.js — fetch + cache the USD-per-million pricing config.
 *
 * Loads once on mount (when email available) and exposes a `reload`
 * callback used after saving a correction. Also tracks the live
 * USD→INR exchange rate for the editor.
 */
import { useState, useEffect, useCallback } from 'react';
import { fetchTokenPricing } from '../services/adminApi';
import { getUsdToInrRate } from '../../../shared/services/tokenCost/tokenCostConfig';
import { formatUsdInput } from '../services/tokenCostMath';

const EMPTY = { inputPerMillion: null, outputPerMillion: null };

export default function useTokenPricing(email) {
  const [perMillionCosts, setPerMillionCosts] = useState(EMPTY);
  const [originalPerMillionCosts, setOriginalPerMillionCosts] = useState(EMPTY);
  const [perMillionInputs, setPerMillionInputs] = useState({ inputPerMillion: '', outputPerMillion: '' });
  const [exchangeRate, setExchangeRate] = useState(null);

  const applyPricing = useCallback((pricing) => {
    if (!pricing) return;
    setPerMillionCosts(pricing);
    setOriginalPerMillionCosts(pricing);
    setPerMillionInputs({
      inputPerMillion: formatUsdInput(pricing.inputPerMillion),
      outputPerMillion: formatUsdInput(pricing.outputPerMillion),
    });
  }, []);

  const reload = useCallback(async () => {
    if (!email) return null;
    const pricing = await fetchTokenPricing(email);
    applyPricing(pricing);
    return pricing;
  }, [email, applyPricing]);

  const refreshExchangeRate = useCallback(async () => {
    const rate = await getUsdToInrRate();
    setExchangeRate(rate);
    return rate;
  }, []);

  useEffect(() => { if (email) reload(); }, [email, reload]);

  const updatePerMillion = useCallback((side, val) => {
    const num = parseFloat(val) || 0;
    setPerMillionInputs((prev) => ({ ...prev, [side]: val }));
    setPerMillionCosts((prev) => ({ ...prev, [side]: num }));
    return num;
  }, []);

  return {
    perMillionCosts, originalPerMillionCosts, perMillionInputs, exchangeRate,
    reload, refreshExchangeRate, updatePerMillion,
  };
}
