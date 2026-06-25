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

function buildPendingRequest(request, hasTeamId) {
  return ok({
    setupComplete: false, hasTeamId, hasUpline: false,
    pendingRequest: {
      id: request.Id, coachId: request.UplineCoachId, status: request.Status,
      expiresAt: request.OtpExpiresAt, requestedAt: request.RequestedAt,
    },
    redirectTo: '/setup/validate-otp', message: 'Waiting for OTP validation',
  });
}

export async function getStatus({ email }) {
  const user = await repo.getStatusFields(email);
  if (!user) return { httpStatus: 404, body: { success: false, error: 'User not found' } };

  const hasTeamId = !!user.TeamId;
  const hasUpline = !!user.CoachId;

  if (user.SetupSkipped === true) return buildSetupSkipped(user, hasTeamId, hasUpline);
  if (user.Role === 'admin' || user.Role === 'developer') return buildAdminBypass(user, hasTeamId, hasUpline);
  if (hasUpline) return buildUplineComplete(user, hasTeamId);

  const request = await repo.getPendingApproval(user.UserId);
  if (request) {
    if (new Date() > new Date(request.OtpExpiresAt)) {
      await repo.deleteApproval(request.Id);
    } else {
      return buildPendingRequest(request, hasTeamId);
    }
  }

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
