/**
 * Physical Activity onboarding gate — when to show the one-time picker.
 *
 * 'show' — profile loaded and no saved level.
 * 'hide' — already saved this session, or profile loaded with a level.
 * 'keep' — fetch failed; do not change the current screen (avoids re-prompting
 *          returning users on a network blip, and avoids skipping new users
 *          whose previous step already decided they need the picker).
 */
export function resolvePhysicalActivityGate({
  confirmedThisSession = false,
  profile = null,
  fetchFailed = false,
} = {}) {
  if (confirmedThisSession) return 'hide';
  if (fetchFailed) return 'keep';
  if (profile && !profile.physicalActivityLevel) return 'show';
  return 'hide';
}
