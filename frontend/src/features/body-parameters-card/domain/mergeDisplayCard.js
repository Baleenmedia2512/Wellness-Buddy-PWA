/**
 * mergeDisplayCard.js — form pre-cap + saved API card for share preview.
 */
export function mergeDisplayCard(card, preCapCard) {
  const typedVenue = String(preCapCard?.locationName || '').trim();
  const savedVenue = String(card?.locationName || '').trim();
  const venue = savedVenue || typedVenue;
  const preIssues = Array.isArray(preCapCard?.recoveredHealthIssues)
    ? preCapCard.recoveredHealthIssues.filter(Boolean)
    : [];
  const apiIssues = Array.isArray(card?.recoveredHealthIssues)
    ? card.recoveredHealthIssues.filter(Boolean)
    : [];
  const recoveredHealthIssues = apiIssues.length > 0 ? apiIssues : preIssues;

  if (card) {
    return {
      ...preCapCard,
      ...card,
      locationName: venue,
      creatorName: card.creatorName || preCapCard?.creatorName || '',
      recoveredHealthIssues,
    };
  }
  return preCapCard
    ? { ...preCapCard, recoveredHealthIssues }
    : null;
}
