/**
 * status.service.js — User feature: GET /api/user/status.
 *
 * Computes the user's onboarding state and which page the client should
 * route to next. Preserves response shapes byte-identical to the legacy
 * handler.
 */
import * as repo from './user.repository.js';

const ok = (body) => ({ httpStatus: 200, body: { success: true, ...body } });

function buildSetupSkipped(user, hasTeamId, hasUpline) {
  return ok({
    setupComplete: true, hasTeamId, hasUpline, setupSkipped: true,
    teamId: user.TeamId, uplineCoachId: user.UplineCoachId, role: user.Role,
    pendingRequest: null, redirectTo: '/dashboard',
    message: hasUpline ? 'Setup skipped - Coach relationship saved' : 'Setup skipped - You can use the app',
  });
}

function buildAdminBypass(user, hasTeamId, hasUpline) {
  return ok({
    setupComplete: true, hasTeamId, hasUpline,
    teamId: user.TeamId, uplineCoachId: user.UplineCoachId, role: user.Role,
    pendingRequest: null, redirectTo: '/dashboard',
    message: 'Admin/Developer - setup not required',
  });
}

function buildUplineComplete(user, hasTeamId) {
  return ok({
    setupComplete: true, hasTeamId, hasUpline: true,
    teamId: user.TeamId || null, uplineCoachId: user.UplineCoachId,
    pendingRequest: null, redirectTo: '/dashboard',
    message: hasTeamId ? 'Setup complete' : 'Setup complete (without Team ID)',
  });
}

function isOtpExpired(request) {
  if (!request?.OtpExpiresAt) return false;
  return Date.now() >= new Date(request.OtpExpiresAt).getTime();
}

function buildPendingRequest(request, hasTeamId) {
  const expired = isOtpExpired(request);
  return ok({
    setupComplete: false, hasTeamId, hasUpline: false,
    pendingRequest: {
      id: request.Id, coachId: request.UplineCoachId, status: request.Status,
      expiresAt: request.OtpExpiresAt, requestedAt: request.RequestedAt,
      expired,
    },
    pendingRequestExpired: expired,
    redirectTo: '/setup/validate-otp',
    message: expired ? 'Coach OTP expired' : 'Waiting for OTP validation',
  });
}

function buildInactiveReactivationPending(user, request, hasTeamId) {
  return ok({
    setupComplete: false,
    hasTeamId,
    hasUpline: !!user.CoachId,
    pendingRequest: {
      id: request.Id,
      coachId: request.UplineCoachId,
      status: request.Status,
      expiresAt: request.OtpExpiresAt,
      requestedAt: request.RequestedAt,
      expired: isOtpExpired(request),
    },
    pendingRequestExpired: isOtpExpired(request),
    redirectTo: '/setup/validate-otp',
    message: isOtpExpired(request)
      ? 'Coach OTP expired'
      : 'Waiting for coach OTP to reactivate account',
  });
}

async function resolvePendingApproval(userId) {
  const request = await repo.getPendingApproval(userId);
  if (!request) return null;
  // Keep expired pending rows so the client can show expired/resend instead of
  // dropping the user back onto coach selection with no explanation.
  return request;
}

export async function getStatus({ email, userId = null }) {
  const user = userId
    ? await repo.getStatusFieldsByUserId(userId)
    : await repo.getStatusFields(email);
  if (!user) return { httpStatus: 404, body: { success: false, error: 'User not found' } };

  const hasTeamId = !!user.TeamId;
  const hasUpline = !!user.CoachId;

  if (user.SetupSkipped === true) return buildSetupSkipped(user, hasTeamId, hasUpline);
  if (user.Role === 'admin' || user.Role === 'developer') return buildAdminBypass(user, hasTeamId, hasUpline);

  // Inactive users already have a CoachId — still need pendingRequest visible
  // so the reactivation ValidateOTP screen stays open after coach OTP is sent.
  if (user.Status === 'Inactive') {
    const pending = await resolvePendingApproval(user.UserId);
    if (pending) return buildInactiveReactivationPending(user, pending, hasTeamId);
  }

  if (hasUpline) return buildUplineComplete(user, hasTeamId);

  const request = await resolvePendingApproval(user.UserId);
  if (request) return buildPendingRequest(request, hasTeamId);

  if (!hasTeamId) {
    return ok({
      setupComplete: false, hasTeamId: false, hasUpline: false,
      pendingRequest: null, redirectTo: '/setup/upline',
      message: 'Team ID is optional - You can select your coach directly',
      allowSkipTeamId: true,
    });
  }

  return ok({
    setupComplete: false, hasTeamId: true, hasUpline: false,
    teamId: user.TeamId, pendingRequest: null, redirectTo: '/setup/upline',
    message: 'Please select your upline coach',
  });
}
