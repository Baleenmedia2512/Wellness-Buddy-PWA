/**
 * Fetch Latest + Often added with from GET /api/food-suggestions.
 */
export async function fetchFoodSuggestions({
  apiBaseUrl,
  userId,
  anchor = '',
  exclude = [],
  limit = 8,
  signal,
}) {
  if (!apiBaseUrl || !userId) {
    return { latest: [], oftenWith: [], provider: null };
  }
  const params = new URLSearchParams({
    userId: String(userId),
    limit: String(limit),
  });
  if (anchor) params.set('anchor', anchor);
  if (exclude.length) params.set('exclude', exclude.join(','));

  const res = await fetch(`${apiBaseUrl}/api/food-suggestions?${params}`, { signal });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.success) {
    return { latest: [], oftenWith: [], provider: null };
  }
  return {
    latest: Array.isArray(data.latest) ? data.latest : [],
    oftenWith: Array.isArray(data.oftenWith) ? data.oftenWith : [],
    provider: data.provider || 'frequency-v1',
  };
}
