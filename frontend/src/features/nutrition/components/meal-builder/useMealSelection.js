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
  return {
    ...item,
    servings: 1,
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
    setSelectedItems((prev) =>
      prev.map((s) =>
        s.name === name
          ? { ...s, servings: Number.isNaN(qty) || qty < 0 ? 0 : qty }
          : s,
      ),
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
