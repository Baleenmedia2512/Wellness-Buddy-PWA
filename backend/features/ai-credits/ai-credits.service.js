/**
 * ai-credits service — status, reserve, confirm, release, admin config.
 */
import { todayInTimezone, IANA_IST } from '../../shared/lib/datetime/index.js';
import { getUserTimezoneIana } from '../user/domain/userTimezone.js';
import { ValidationError } from '../../shared/lib/ValidationError.js';
import * as userRepo from '../user/user.repository.js';
import { getSupabaseClient } from '../../utils/supabaseClient.js';
import { compareSemver } from '../app-version/domain/version.rules.js';
import { assertAiCreditsAdmin } from './domain/permissions/credits.policy.js';
import {
  buildStatus,
  canReserve,
  normalizeConfig,
  shouldDeductAiCredit,
  STALE_PENDING_RESERVATION_MS,
} from './domain/credits.rules.js';
import {
  evaluateAiAvailability,
  normalizeAvailabilityWindows,
  hasAnyAvailabilitySlotEnabled,
} from './domain/availability.rules.js';
import {
  evaluateAiFoodAnalysisAccess,
  shouldEnforceAiFoodAccess,
} from './domain/ai-food-access.rules.js';
import * as repo from './data/ai-credits.repo.js';

const REQUESTER_COLUMNS = '"UserId", "Role"';
const ACCESS_COLUMNS = '"UserId", "Role", "CoachId"';

/**
 * Server-side leaf-downline + AI window facts for a user (never trust client role).
 * @param {number} userId
 * @param {string} [timezoneIana]
 */
async function loadAiFoodAccessContext(userId, timezoneIana = IANA_IST) {
  const row = await userRepo.findByUserId(userId, ACCESS_COLUMNS);
  const supabase = getSupabaseClient();
  const { count, error } = await supabase
    .from('team_table')
    .select('UserId', { count: 'exact', head: true })
    .eq('CoachId', userId);
  if (error) {
    throw new ValidationError(500, 'Failed to resolve team membership');
  }
  const decision = evaluateAiFoodAnalysisAccess({
    role: row?.Role ?? null,
    hasDownlineMembers: (count ?? 0) > 0,
    coachId: row?.CoachId ?? null,
    now: new Date(),
    timezoneIana: timezoneIana || IANA_IST,
  });
  return {
    eligibleForAiFoodAnalysis: decision.eligible,
    aiFoodAnalysisWindowOpen: decision.windowOpen,
    aiFoodAnalysisAllowed: decision.allowed,
    aiFoodAnalysisDenyReason: decision.reason,
  };
}

function withAccessFields(status, access) {
  return {
    ...status,
    eligibleForAiFoodAnalysis: access?.eligibleForAiFoodAnalysis ?? false,
    aiFoodAnalysisWindowOpen: access?.aiFoodAnalysisWindowOpen ?? false,
    aiFoodAnalysisAllowed: access?.aiFoodAnalysisAllowed ?? false,
    aiFoodAnalysisDenyReason: access?.aiFoodAnalysisDenyReason ?? null,
  };
}

async function resolveRequester({ requesterUserId, requesterEmail }) {
  if (requesterEmail) {
    const byEmail = await userRepo.findByEmail(requesterEmail, REQUESTER_COLUMNS);
    if (byEmail) return byEmail;
  }
  if (requesterUserId != null && requesterUserId !== '') {
    const byId = await userRepo.findByUserId(requesterUserId, REQUESTER_COLUMNS);
    if (byId) return byId;
  }
  return null;
}

async function loadDayContext(userId) {
  const timezoneIana = await getUserTimezoneIana(userId);
  const usageDate = todayInTimezone(timezoneIana);
  const configRow = await repo.getLatestConfig();
  const config = repo.configOrDefault(configRow);
  const availability = evaluateAiAvailability({
    now: new Date(),
    timezoneIana,
    availabilityWindows: config.availabilityWindows,
  });
  // Syncs credits_limit_snapshot to live admin config (mid-day changes take effect).
  const usage = await repo.ensureUsageRow(userId, usageDate, config.dailyAiCredits);
  await repo.expireStalePendingReservations(userId, usageDate, STALE_PENDING_RESERVATION_MS);
  const pending = await repo.countPendingReservations(userId, usageDate);
  // Prefer live config so admin Save is reflected even if snapshot update races.
  const limit = config.dailyAiCredits;
  const used = usage?.credits_used ?? 0;
  return {
    timezoneIana,
    usageDate,
    config,
    usage,
    pending,
    limit,
    used,
    availability,
  };
}

function statusFromContext(ctx) {
  const avail = ctx.availability || {};
  return buildStatus({
    enabled: ctx.config.aiModeEnabled,
    dailyLimit: ctx.limit,
    used: ctx.used,
    usageDate: ctx.usageDate,
    timezoneIana: ctx.timezoneIana,
    pendingReservations: ctx.pending,
    availableInWindow: avail.availableInWindow !== false,
    activeMealWindow: avail.activeMealWindow ?? null,
    availabilityWindows: avail.availabilityWindows
      ?? normalizeAvailabilityWindows(ctx.config.availabilityWindows),
    anySlotEnabled: avail.anySlotEnabled !== false,
  });
}

export async function getStatus({ userId, appVersion = null }) {
  const uid = Number.parseInt(String(userId), 10);
  if (!Number.isFinite(uid) || uid <= 0) {
    throw new ValidationError(400, 'userId is required');
  }
  const ctx = await loadDayContext(uid);
  const status = statusFromContext(ctx);
  const access = await loadAiFoodAccessContext(uid, ctx.timezoneIana);
  // Always surface access facts for UI; enforcement uses appVersion on reserve.
  void appVersion;
  return {
    httpStatus: 200,
    body: { ok: true, data: withAccessFields(status, access) },
  };
}

export async function reserveCredit({ userId, appVersion = null }) {
  const uid = Number.parseInt(String(userId), 10);
  if (!Number.isFinite(uid) || uid <= 0) {
    throw new ValidationError(400, 'userId is required');
  }
  const ctx = await loadDayContext(uid);
  const effectiveEnabled = Boolean(ctx.config.aiModeEnabled)
    && ctx.availability?.anySlotEnabled !== false;
  const access = await loadAiFoodAccessContext(uid, ctx.timezoneIana);
  const status = withAccessFields(statusFromContext(ctx), access);

  const gate = canReserve({
    enabled: effectiveEnabled,
    dailyLimit: ctx.limit,
    used: ctx.used,
    pendingReservations: ctx.pending,
    availableInWindow: ctx.availability?.availableInWindow !== false,
  });
  if (!gate.allowed) {
    return {
      httpStatus: 200,
      body: {
        ok: true,
        data: {
          allowed: false,
          reason: gate.reason,
          reservationId: null,
          ...status,
        },
      },
    };
  }

  // §5.1: leaf + window gates for versioned clients; missing version → legacy.
  if (shouldEnforceAiFoodAccess(appVersion, compareSemver) && !access.aiFoodAnalysisAllowed) {
    return {
      httpStatus: 200,
      body: {
        ok: true,
        data: {
          allowed: false,
          reason: access.aiFoodAnalysisDenyReason || 'not_eligible_downline',
          reservationId: null,
          ...status,
        },
      },
    };
  }

  const reservation = await repo.createReservation({
    userId: uid,
    usageDate: ctx.usageDate,
  });
  return {
    httpStatus: 200,
    body: {
      ok: true,
      data: {
        allowed: true,
        reason: null,
        reservationId: reservation.id,
        ...status,
        // Reserve just created — reflect the new hold in remaining.
        remaining: Math.max(0, status.remaining - 1),
      },
    },
  };
}

/**
 * Defense-in-depth for /api/ai/orchestrate — reject non-eligible / outside-window
 * callers when the client version enforces AI food access rules.
 *
 * @param {{ userId: string|number|null|undefined, appVersion?: string|null }}
 * @throws {ValidationError}
 */
export async function assertAiFoodAnalysisAccess({ userId, appVersion = null }) {
  if (!shouldEnforceAiFoodAccess(appVersion, compareSemver)) return;
  const uid = Number.parseInt(String(userId), 10);
  if (!Number.isFinite(uid) || uid <= 0) {
    const err = new ValidationError(400, 'userId is required for AI food analysis');
    err.code = 'MISSING_USER_ID';
    throw err;
  }
  const timezoneIana = await getUserTimezoneIana(uid);
  const access = await loadAiFoodAccessContext(uid, timezoneIana);
  if (access.aiFoodAnalysisAllowed) return;
  const err = new ValidationError(
    403,
    access.aiFoodAnalysisDenyReason === 'outside_ai_window'
      ? 'AI food analysis is only available during lunch (12:00–4:00 PM) and dinner (5:30–8:30 PM)'
      : 'AI food analysis is only available for eligible downline members',
  );
  err.code = access.aiFoodAnalysisDenyReason === 'outside_ai_window'
    ? 'OUTSIDE_AI_WINDOW'
    : 'NOT_ELIGIBLE_DOWNLINE';
  throw err;
}

export async function confirmCredit({ userId, reservationId, analysisResult = null }) {
  const uid = Number.parseInt(String(userId), 10);
  if (!Number.isFinite(uid) || uid <= 0) {
    throw new ValidationError(400, 'userId is required');
  }
  if (!reservationId) {
    throw new ValidationError(400, 'reservationId is required');
  }

  const reservation = await repo.getReservation(reservationId);
  if (!reservation || Number(reservation.user_id) !== uid) {
    throw new ValidationError(404, 'Reservation not found');
  }

  if (reservation.status === 'confirmed') {
    const ctx = await loadDayContext(uid);
    return {
      httpStatus: 200,
      body: {
        ok: true,
        data: {
          deducted: false,
          alreadyConfirmed: true,
          ...statusFromContext(ctx),
        },
      },
    };
  }

  if (reservation.status !== 'pending') {
    throw new ValidationError(409, `Reservation is ${reservation.status}`);
  }

  // Deduct on completed AI classification (food / weight / education / watch / other).
  // Release when analysis is missing or looks like a technical failure (e.g. Gemini 401).
  if (!shouldDeductAiCredit(analysisResult)) {
    await repo.resolveReservation(reservationId, 'released');
    const ctx = await loadDayContext(uid);
    return {
      httpStatus: 200,
      body: {
        ok: true,
        data: {
          deducted: false,
          reason: 'technical_failure',
          ...statusFromContext(ctx),
        },
      },
    };
  }

  const updated = await repo.resolveReservation(reservationId, 'confirmed');
  if (!updated) {
    // Lost race — already resolved
    const again = await repo.getReservation(reservationId);
    if (again?.status === 'confirmed') {
      const ctx = await loadDayContext(uid);
      return {
        httpStatus: 200,
        body: {
          ok: true,
          data: {
            deducted: false,
            alreadyConfirmed: true,
            ...statusFromContext(ctx),
          },
        },
      };
    }
    throw new ValidationError(409, 'Reservation could not be confirmed');
  }

  await repo.incrementCreditsUsed(uid, reservation.usage_date);
  const ctx = await loadDayContext(uid);
  return {
    httpStatus: 200,
    body: {
      ok: true,
      data: {
        deducted: true,
        ...statusFromContext(ctx),
      },
    },
  };
}

export async function releaseCredit({ userId, reservationId }) {
  const uid = Number.parseInt(String(userId), 10);
  if (!Number.isFinite(uid) || uid <= 0) {
    throw new ValidationError(400, 'userId is required');
  }
  if (!reservationId) {
    throw new ValidationError(400, 'reservationId is required');
  }
  const reservation = await repo.getReservation(reservationId);
  if (!reservation || Number(reservation.user_id) !== uid) {
    throw new ValidationError(404, 'Reservation not found');
  }

  const priorStatus = reservation.status;

  // Consumed credits cannot be released — only pending holds are refundable.
  if (priorStatus === 'confirmed') {
    const ctx = await loadDayContext(uid);
    return {
      httpStatus: 200,
      body: {
        ok: true,
        data: {
          released: false,
          alreadyConsumed: true,
          alreadyReleased: false,
          ...statusFromContext(ctx),
        },
      },
    };
  }

  if (priorStatus === 'pending') {
    const updated = await repo.resolveReservation(reservationId, 'released');
    if (!updated) {
      // Concurrent release or confirm won the race — re-read for idempotent response.
      const again = await repo.getReservation(reservationId);
      const ctx = await loadDayContext(uid);
      if (again?.status === 'released') {
        return {
          httpStatus: 200,
          body: {
            ok: true,
            data: {
              released: true,
              alreadyReleased: true,
              alreadyConsumed: false,
              ...statusFromContext(ctx),
            },
          },
        };
      }
      if (again?.status === 'confirmed') {
        return {
          httpStatus: 200,
          body: {
            ok: true,
            data: {
              released: false,
              alreadyConsumed: true,
              alreadyReleased: false,
              ...statusFromContext(ctx),
            },
          },
        };
      }
      throw new ValidationError(409, 'Reservation could not be released');
    }
  }

  const ctx = await loadDayContext(uid);
  return {
    httpStatus: 200,
    body: {
      ok: true,
      data: {
        released: true,
        alreadyReleased: priorStatus === 'released',
        alreadyConsumed: false,
        ...statusFromContext(ctx),
      },
    },
  };
}

/** Server-side gate used by orchestrate when creditGated=true. */
export async function assertReservationValid({ userId, reservationId }) {
  const uid = Number.parseInt(String(userId), 10);
  if (!Number.isFinite(uid) || uid <= 0) {
    const err = new Error('userId is required for credit-gated AI');
    err.status = 400;
    err.code = 'CREDIT_USER_REQUIRED';
    throw err;
  }
  if (!reservationId) {
    const err = new Error('reservationId is required for credit-gated AI');
    err.status = 400;
    err.code = 'CREDIT_RESERVATION_REQUIRED';
    throw err;
  }
  const reservation = await repo.getReservation(reservationId);
  if (!reservation || Number(reservation.user_id) !== uid) {
    const err = new Error('Invalid AI credit reservation');
    err.status = 403;
    err.code = 'CREDIT_RESERVATION_INVALID';
    throw err;
  }
  if (reservation.status !== 'pending') {
    const err = new Error(`AI credit reservation is ${reservation.status}`);
    err.status = 409;
    err.code = 'CREDIT_RESERVATION_NOT_PENDING';
    throw err;
  }
  return reservation;
}

export async function getAdminConfig({ requesterUserId, requesterEmail }) {
  const requester = await resolveRequester({ requesterUserId, requesterEmail });
  if (!requester) throw new ValidationError(404, 'Requester not found');
  assertAiCreditsAdmin(requester);
  const row = await repo.getLatestConfig();
  const config = repo.configOrDefault(row);
  const availabilityWindows = normalizeAvailabilityWindows(config.availabilityWindows);
  // Display AI Mode as Off when no slots are enabled (even if DB flag was left true).
  const aiModeEnabled = Boolean(config.aiModeEnabled)
    && hasAnyAvailabilitySlotEnabled(availabilityWindows);
  return {
    httpStatus: 200,
    body: {
      ok: true,
      data: {
        dailyAiCredits: config.dailyAiCredits,
        aiModeEnabled,
        availabilityWindows,
        updatedAt: config.updatedAt,
        updatedByUserId: config.updatedByUserId,
      },
    },
  };
}

export async function putAdminConfig({
  requesterUserId,
  requesterEmail,
  dailyAiCredits,
  aiModeEnabled,
  availabilityWindows,
}) {
  const requester = await resolveRequester({ requesterUserId, requesterEmail });
  if (!requester) throw new ValidationError(404, 'Requester not found');
  assertAiCreditsAdmin(requester);
  const normalized = normalizeConfig({ dailyAiCredits, aiModeEnabled, availabilityWindows });
  const saved = await repo.insertConfig({
    dailyAiCredits: normalized.dailyAiCredits,
    aiModeEnabled: normalized.aiModeEnabled,
    availabilityWindows: normalized.availabilityWindows,
    updatedByUserId: requester.UserId,
  });
  return {
    httpStatus: 200,
    body: {
      ok: true,
      data: {
        dailyAiCredits: saved.daily_ai_credits,
        aiModeEnabled: saved.ai_mode_enabled,
        availabilityWindows: normalizeAvailabilityWindows(
          saved.availability_windows ?? normalized.availabilityWindows,
        ),
        updatedAt: saved.updated_at,
        updatedByUserId: saved.updated_by_user_id,
      },
    },
  };
}
