/**
 * Pure helpers for AI credit UX — never scare users for temporary pending holds.
 * Status fields come from GET /api/ai-credits/status only.
 */

/**
 * @typedef {'disabled'|'outside_window'|'available'|'busy'|'exhausted'} AiCreditPhase
 */

/**
 * Classify credit status for UI (classify screen, retry flows).
 * - available: user can start AI now
 * - busy: slots held by in-flight AI (pending) — not consumed yet
 * - exhausted: today's detections fully used (confirmed charges)
 * - outside_window: AI mode on but outside admin-enabled meal windows
 * - disabled: AI mode off or zero limit
 *
 * @param {object|null|undefined} status
 * @returns {{ phase: AiCreditPhase, used: number, limit: number, pending: number, remaining: number, leftToday: number }}
 */
export function getAiCreditUiState(status) {
  const limit = Math.max(0, Number(status?.dailyLimit) || 0);
  const used = Math.max(0, Number(status?.used) || 0);
  const pending = Math.max(0, Number(status?.pending) || 0);
  const remaining = Math.max(0, Number(status?.remaining) ?? limit - used - pending);
  const leftToday = Math.max(0, limit - used);

  if (!status?.enabled || limit <= 0) {
    return { phase: 'disabled', used, limit, pending, remaining, leftToday: 0 };
  }
  if (status.availableInWindow === false) {
    return { phase: 'outside_window', used, limit, pending, remaining, leftToday };
  }
  if (used >= limit) {
    return { phase: 'exhausted', used, limit, pending, remaining: 0, leftToday: 0 };
  }
  if (remaining <= 0 && pending > 0) {
    return { phase: 'busy', used, limit, pending, remaining: 0, leftToday };
  }
  return { phase: 'available', used, limit, pending, remaining, leftToday };
}

/**
 * User-facing copy when reserve fails — calm, no "token used" language.
 * @param {string|null|undefined} reason
 */
export function reserveFailureMessage(reason) {
  switch (reason) {
    case 'pending_holds':
      return 'AI detect is temporarily unavailable — try again in a few minutes, or pick a type below. Your credits are not used yet.';
    case 'daily_exhausted':
    case 'limit_reached':
      return 'You\'ve used today\'s AI detections — pick a type below. More unlock at midnight.';
    case 'outside_window':
      return 'AI detect is only available during configured meal times — pick a type below to log manually.';
    case 'disabled':
      return 'AI detect is unavailable right now — pick a type below to log manually.';
    case 'not_eligible_downline':
      return 'AI food analysis is only available for eligible downline members. You can still log food manually.';
    case 'outside_ai_window':
      return 'AI food analysis is available during lunch (12:00–4:00 PM) and dinner (5:30–8:30 PM). You can still log food manually.';
    default:
      return 'Could not start AI — pick a type below to log manually.';
  }
}

/**
 * Short label for the Auto Detect button area.
 * @param {ReturnType<typeof getAiCreditUiState>} ui
 * @param {{ running?: boolean }} [opts]
 */
export function autoDetectButtonLabel(ui, { running = false } = {}) {
  if (running) return 'Starting…';
  if (ui.phase === 'busy') return 'Unavailable';
  if (ui.phase === 'exhausted') return 'Unlock on';
  if (ui.phase === 'outside_window') return 'Meal times only';
  return 'Auto Detect';
}

/**
 * Second line under the Auto Detect label (busy / exhausted states).
 * @param {ReturnType<typeof getAiCreditUiState>} ui
 */
export function autoDetectButtonSubtitle(ui) {
  if (ui.phase === 'busy') return 'Try again later';
  if (ui.phase === 'outside_window') return 'Outside AI window';
  return null;
}

/**
 * Credits badge under the Auto Detect button.
 * @param {ReturnType<typeof getAiCreditUiState>} ui
 */
export function autoDetectCreditsBadge(ui) {
  if (ui.phase === 'disabled' || ui.limit <= 0) return null;
  if (ui.phase === 'exhausted') return null;
  if (ui.phase === 'outside_window') return null;
  return `${ui.leftToday} of ${ui.limit} left today`;
}

/**
 * Whether the primary Auto Detect action should be interactable.
 * Busy state stays clickable so the user can retry after holds clear.
 */
export function isAutoDetectEnabled(ui, { running = false, closing = false } = {}) {
  if (closing || running) return false;
  if (ui.phase === 'disabled' || ui.phase === 'exhausted' || ui.phase === 'outside_window') {
    return false;
  }
  return true;
}
