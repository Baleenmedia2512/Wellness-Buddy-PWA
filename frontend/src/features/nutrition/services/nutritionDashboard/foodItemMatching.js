// Pure helpers for matching food items inside a meal's detailed-items list.
// Used by delete + restore flows to locate an item even if its array index
// shifted between the user's action and the persistence callback.

export const getFoodSignature = (item) => {
  const name = (item?.name || "").trim().toLowerCase();
  const grams =
    item?.serving?.grams ?? item?.grams ?? item?.estimatedWeight ?? "";
  const unit =
    (item?.serving?.unit || item?.unit || "").trim().toLowerCase();
  return `${name}::${grams}::${unit}`;
};

/**
 * Find the index of an item in `items`. Prefer matching by signature against
 * `snapshot`; fall back to `fallbackIndex` when it's still in bounds; return
 * -1 when nothing matches.
 */
export const resolveFoodItemIndex = (items, fallbackIndex, snapshot) => {
  if (snapshot) {
    const snapSig = getFoodSignature(snapshot);
    const bySignature = items.findIndex(
      (item) => getFoodSignature(item) === snapSig,
    );
    if (bySignature !== -1) return bySignature;
  }

  if (fallbackIndex >= 0 && fallbackIndex < items.length) {
    return fallbackIndex;
  }

  return -1;
};
