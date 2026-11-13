/**
 * Home Premium expiry banner copy. Pure.
 * @param {{ daysLeft?: number|null, expiresAtDisplay?: string|null }} input
 * @returns {string}
 */
export function buildPremiumExpiryBannerLabel({
  daysLeft = null,
  expiresAtDisplay = null,
} = {}) {
  const days = Number(daysLeft);
  const when = typeof expiresAtDisplay === 'string' && expiresAtDisplay.trim()
    ? expiresAtDisplay.trim()
    : '';
  const withTime = when ? ` (${when})` : '';

  if (!Number.isFinite(days) || days < 1) {
    return `Your current plan expires today${withTime}. Please recharge.`;
  }
  if (days === 1) {
    return `Your current plan expires in 1 day${withTime}. Please recharge.`;
  }
  return `Your current plan expires in ${days} days${withTime}. Please recharge.`;
}
