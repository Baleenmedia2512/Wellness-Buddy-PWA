/**
 * ai-credits service — status, reserve, confirm, release, admin config.
 */
import { todayInTimezone } from '../../shared/lib/datetime/index.js';
import { getUserTimezoneIana } from '../user/domain/userTimezone.js';
import { ValidationError } from '../../shared/lib/ValidationError.js';
import * as userRepo from '../user/user.repository.js';
import { assertAiCreditsAdmin } from './domain/permissions/credits.policy.js';
import {
  buildStatus,
  canReserve,
  normalizeConfig,
  isSuccessfulFoodAnalysis,
} from './domain/credits.rules.js';
import * as repo from './data/ai-credits.repo.js';

const REQUESTER_COLUMNS = '"UserId", "Role"';

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
  const usage = await repo.ensureUsageRow(userId, usageDate, config.dailyAiCredits);
  const pending = await repo.countPendingReservations(userId, usageDate);
  const limit = usage?.credits_limit_snapshot ?? config.dailyAiCredits;
  const used = usage?.credits_used ?? 0;
  return {
    timezoneIana,
    usageDate,
    config,
    usage,
    pending,
    limit,
    used,
  };
}

export async function getStatus({ userId }) {
  const uid = Number.parseInt(String(userId), 10);
  if (!Number.isFinite(uid) || uid <= 0) {
    throw new ValidationError(400, 'userId is required');
  }
  const ctx = await loadDayContext(uid);
  const status = buildStatus({
    enabled: ctx.config.aiModeEnabled,
    dailyLimit: ctx.limit,
    used: ctx.used,
    usageDate: ctx.usageDate,
    timezoneIana: ctx.timezoneIana,
  });
  return {
    httpStatus: 200,
    body: { ok: true, data: status },
  };
}

export async function reserveCredit({ userId }) {
  const uid = Number.parseInt(String(userId), 10);
  if (!Number.isFinite(uid) || uid <= 0) {
    throw new ValidationError(400, 'userId is required');
  }
  const ctx = await loadDayContext(uid);
  const gate = canReserve({
    enabled: ctx.config.aiModeEnabled,
    dailyLimit: ctx.limit,
    used: ctx.used,
    pendingReservations: ctx.pending,
  });
  if (!gate.allowed) {
    const status = buildStatus({
      enabled: ctx.config.aiModeEnabled,
      dailyLimit: ctx.limit,
      used: ctx.used,
      usageDate: ctx.usageDate,
      timezoneIana: ctx.timezoneIana,
    });
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

  const reservation = await repo.createReservation({
    userId: uid,
    usageDate: ctx.usageDate,
  });
  const status = buildStatus({
    enabled: ctx.config.aiModeEnabled,
    dailyLimit: ctx.limit,
    used: ctx.used,
    usageDate: ctx.usageDate,
    timezoneIana: ctx.timezoneIana,
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
        // remaining display includes this hold for UX
        remaining: Math.max(0, status.remaining - 1),
      },
    },
  };
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
          ...buildStatus({
            enabled: ctx.config.aiModeEnabled,
            dailyLimit: ctx.limit,
            used: ctx.used,
            usageDate: ctx.usageDate,
            timezoneIana: ctx.timezoneIana,
          }),
        },
      },
    };
  }

  if (reservation.status !== 'pending') {
    throw new ValidationError(409, `Reservation is ${reservation.status}`);
  }

  // Only deduct on successful food analysis when result is provided.
  if (analysisResult != null && !isSuccessfulFoodAnalysis(analysisResult)) {
    await repo.resolveReservation(reservationId, 'released');
    const ctx = await loadDayContext(uid);
    return {
      httpStatus: 200,
      body: {
        ok: true,
        data: {
          deducted: false,
          reason: 'not_food_success',
          ...buildStatus({
            enabled: ctx.config.aiModeEnabled,
            dailyLimit: ctx.limit,
            used: ctx.used,
            usageDate: ctx.usageDate,
            timezoneIana: ctx.timezoneIana,
          }),
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
            ...buildStatus({
              enabled: ctx.config.aiModeEnabled,
              dailyLimit: ctx.limit,
              used: ctx.used,
              usageDate: ctx.usageDate,
              timezoneIana: ctx.timezoneIana,
            }),
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
        ...buildStatus({
          enabled: ctx.config.aiModeEnabled,
          dailyLimit: ctx.limit,
          used: ctx.used,
          usageDate: ctx.usageDate,
          timezoneIana: ctx.timezoneIana,
        }),
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
  if (reservation.status === 'pending') {
    await repo.resolveReservation(reservationId, 'released');
  }
  const ctx = await loadDayContext(uid);
  return {
    httpStatus: 200,
    body: {
      ok: true,
      data: {
        released: reservation.status === 'pending' || reservation.status === 'released',
        ...buildStatus({
          enabled: ctx.config.aiModeEnabled,
          dailyLimit: ctx.limit,
          used: ctx.used,
          usageDate: ctx.usageDate,
          timezoneIana: ctx.timezoneIana,
        }),
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
  return {
    httpStatus: 200,
    body: {
      ok: true,
      data: {
        dailyAiCredits: config.dailyAiCredits,
        aiModeEnabled: config.aiModeEnabled,
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
}) {
  const requester = await resolveRequester({ requesterUserId, requesterEmail });
  if (!requester) throw new ValidationError(404, 'Requester not found');
  assertAiCreditsAdmin(requester);
  const normalized = normalizeConfig({ dailyAiCredits, aiModeEnabled });
  const saved = await repo.insertConfig({
    dailyAiCredits: normalized.dailyAiCredits,
    aiModeEnabled: normalized.aiModeEnabled,
    updatedByUserId: requester.UserId,
  });
  return {
    httpStatus: 200,
    body: {
      ok: true,
      data: {
        dailyAiCredits: saved.daily_ai_credits,
        aiModeEnabled: saved.ai_mode_enabled,
        updatedAt: saved.updated_at,
        updatedByUserId: saved.updated_by_user_id,
      },
    },
  };
}
