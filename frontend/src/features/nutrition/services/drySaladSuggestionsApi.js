/**
 * Fetch the user's usual dry-salad combo for the current time slot.
 * GET /api/dry-salad/suggestions?userId=&slot=
 */
export async function fetchDrySaladSuggestions({
  apiBaseUrl,
  userId,
  slot = '',
  signal,
}) {
  if (!apiBaseUrl || !userId) {
    return { slot: null, selected: [], suggestions: [], provider: null };
  }
  const params = new URLSearchParams({
    userId: String(userId),
  });
  if (slot) params.set('slot', String(slot));

  const res = await fetch(`${apiBaseUrl}/api/dry-salad/suggestions?${params}`, { signal });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.success) {
    return { slot: null, selected: [], suggestions: [], provider: null };
  }
  return {
    slot: data.slot || null,
    selected: Array.isArray(data.selected) ? data.selected : [],
    suggestions: Array.isArray(data.suggestions) ? data.suggestions : [],
    provider: data.provider || 'slot-combo-v1',
  };
}
