/**
 * Thin hook around meal multi-select state.
 */
import { useCallback, useState } from 'react';
import { resolveQuantityUnit, referenceWeightG } from '../../domain/nutritionFields';
import {
  computeMacroSummary,
  computeSelectedKcal,
  itemAlreadySelected,
} from './mealSelection';

export function toSelectableItem(item) {
  const qtyUnit = resolveQuantityUnit(item);
  const raw = Number(item?.servings ?? item?.servingCount);
  const servings = Number.isFinite(raw) && raw > 0
    ? Math.max(0.5, Math.round(raw * 2) / 2)
    : 1;
  return {
    ...item,
    servings,
    refWeightG: referenceWeightG(item),
    quantityUnit: qtyUnit.unit,
    quantityLabel: qtyUnit.shortLabel,
  };
}

export default function useMealSelection(initial = []) {
  const [selectedItems, setSelectedItems] = useState(initial);

  const clear = useCallback(() => setSelectedItems([]), []);

  const toggle = useCallback((item) => {
    setSelectedItems((prev) => {
      const exists = prev.some((s) => s.name === item.name);
      if (exists) return prev.filter((s) => s.name !== item.name);
      return [...prev, toSelectableItem(item)];
    });
  }, []);

  const addIfMissing = useCallback((item) => {
    setSelectedItems((prev) => {
      if (itemAlreadySelected(prev, item.name)) return prev;
      return [...prev, toSelectableItem(item)];
    });
  }, []);

  const remove = useCallback((item) => {
    setSelectedItems((prev) => prev.filter((s) => s.name !== item.name));
  }, []);

  const setQuantity = useCallback((name, rawValue) => {
    const qty = parseFloat(rawValue);
    // Half-serving steps (0.5, 1, 1.5, …); min 0.5
    const snapped = Number.isNaN(qty) || qty < 0.5
      ? 0.5
      : Math.round(qty * 2) / 2;
    setSelectedItems((prev) =>
      prev.map((s) => (s.name === name ? { ...s, servings: snapped } : s)),
    );
  }, []);

  return {
    selectedItems,
    setSelectedItems,
    toggle,
    addIfMissing,
    remove,
    clear,
    setQuantity,
    totalKcal: computeSelectedKcal(selectedItems),
    macroSummary: computeMacroSummary(selectedItems),
  };
}
