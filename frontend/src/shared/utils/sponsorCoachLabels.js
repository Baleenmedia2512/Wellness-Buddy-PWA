/**
 * frontend/src/shared/utils/sponsorCoachLabels.js
 *
 * ADR-0007 — Sponsor (direct CoachId) + Ideal-Weight Coach labels.
 * Hide Coach entirely when idealCoachName is null/empty.
 */

function cleanName(value) {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s || /^n\/?a$/i.test(s) || /^no (coach|sponsor)$/i.test(s)) return null;
  return s;
}

/**
 * @param {{ sponsorName?: string|null, coachName?: string|null, idealCoachName?: string|null }} data
 * @returns {{ sponsorName: string|null, idealCoachName: string|null }}
 */
export function resolveSponsorCoachNames(data = {}) {
  return {
    sponsorName: cleanName(data.sponsorName) || cleanName(data.coachName),
    idealCoachName: cleanName(data.idealCoachName),
  };
}

/**
 * Compact one-line subtitle (CSV / plain text). Prefer two-line UI for cards.
 * e.g. "Sponsor: Adithya · Coach: Yasheer" or "Sponsor: Adithya" or "No Sponsor"
 */
export function formatSponsorCoachSubtitle(data, { emptySponsor = 'No Sponsor' } = {}) {
  const { sponsorName, idealCoachName } = resolveSponsorCoachNames(data);
  if (!sponsorName && !idealCoachName) return emptySponsor;
  if (idealCoachName) {
    return `Sponsor: ${sponsorName || emptySponsor} · Coach: ${idealCoachName}`;
  }
  return `Sponsor: ${sponsorName || emptySponsor}`;
}
