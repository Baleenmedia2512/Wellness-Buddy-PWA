/**
 * shared/services/auth/fsm/machine.js
 * ---------------------------------------------------------------------------
 * Pure reducer for the auth core machine. No imports of React, helpers, or
 * any side-effect-producing module. Easy to unit-test in isolation.
 *
 * Signature:
 *   transition(state, event) -> { next, effects }
 *
 * Where:
 *   state   = { core: string, ctx: object }
 *   event   = { type: string, ...payload }
 *   effects = Array<{ type: 'after', delayMs, event }>
 *
 * Effects in shadow mode are limited to delayed transitions. `invoke` /
 * `cancel` effects are reserved for Phase 3d-b when actors are activated.
 * ---------------------------------------------------------------------------
 */

import { E } from "./events";
import { S } from "./states";

export const initialState = Object.freeze({
  core: S.IDLE,
  ctx: Object.freeze({
    apiBaseUrl: null,
    platform: null,
    user: null,
    userEmail: null,
    role: null,
    epoch: 0,
    isFreshSignIn: false,
    failOpen: false,
    signingOut: false,
    signOutReason: null,
    snooze: null,
    error: null,
  }),
});

const noEffects = Object.freeze([]);

function go(core, ctx, effects = noEffects) {
  return { next: { core, ctx }, effects };
}
function stay(state) {
  return { next: state, effects: noEffects };
}
function bump(ctx) {
  return { ...ctx, epoch: ctx.epoch + 1 };
}

/**
 * Pure transition function.
 * @param {{ core: string, ctx: object }} state
 * @param {{ type: string }} event
 */
export function transition(state, event) {
  if (!event || !event.type) return stay(state);
  const { core, ctx } = state;

  // ─── Universal transitions (apply in most states) ──────────────────────
  if (
    event.type === E.SIGN_OUT_REQUESTED &&
    core !== S.SIGNING_OUT &&
    core !== S.TERMINAL_LOGGED_OUT
  ) {
    return go(
      S.SIGNING_OUT,
      { ...bump(ctx), signingOut: true, signOutReason: event.reason || "user" },
      [{ type: "after", delayMs: 2000, event: { type: E.SIGNOUT_SAFETY_ELAPSED } }],
    );
  }
  if (event.type === E.ACCOUNT_DELETED) {
    return go(S.BLOCKED_ACCOUNT_DELETED, {
      ...bump(ctx),
      signingOut: false,
      user: null,
      userEmail: null,
    });
  }
  if (
    event.type === E.AUTH_CHANGED &&
    !event.user &&
    core !== S.UNAUTHENTICATED &&
    core !== S.IDLE &&
    core !== S.BOOTING
  ) {
    if (core === S.SIGNING_OUT) {
      return go(S.TERMINAL_LOGGED_OUT, {
        ...bump(ctx),
        user: null,
        userEmail: null,
        signingOut: false,
      });
    }
    if (core === S.TERMINAL_LOGGED_OUT) return stay(state);
    return go(S.UNAUTHENTICATED, {
      ...bump(ctx),
      user: null,
      userEmail: null,
    });
  }

  // ─── Per-state transitions ─────────────────────────────────────────────
  switch (core) {
    case S.IDLE:
      if (event.type === E.BOOT) {
        return go(S.BOOTING, {
          ...ctx,
          apiBaseUrl: event.apiBaseUrl || ctx.apiBaseUrl,
          platform: event.platform || ctx.platform,
        });
      }
      break;

    case S.BOOTING:
      if (event.type === E.RESTORE_SESSION) {
        if (event.accountDeleted) return go(S.BLOCKED_ACCOUNT_DELETED, ctx);
        if (event.signedOut || event.forceLoggedOut) {
          return go(S.TERMINAL_LOGGED_OUT, ctx);
        }
        return go(S.UNAUTHENTICATED, {
          ...ctx,
          userEmail: event.cachedEmail || null,
          role: event.cachedRole || null,
        });
      }
      break;

    case S.UNAUTHENTICATED:
      if (event.type === E.AUTH_CHANGED && event.user) {
        return go(
          S.CHECKING_USER_STATUS,
          bump({
            ...ctx,
            user: event.user,
            userEmail: event.user.email || event.user.Email || ctx.userEmail,
            isFreshSignIn: false,
          }),
        );
      }
      if (event.type === E.SIGN_IN_REQUESTED) {
        return go(S.SIGNING_IN, ctx);
      }
      break;

    case S.SIGNING_IN:
      if (event.type === E.SIGN_IN_SUCCESS) {
        return go(
          S.CHECKING_USER_STATUS,
          bump({
            ...ctx,
            user: event.user,
            userEmail:
              (event.user && (event.user.email || event.user.Email)) || ctx.userEmail,
            isFreshSignIn: true,
          }),
        );
      }
      if (event.type === E.SIGN_IN_FAILED || event.type === E.SIGN_IN_CANCELLED) {
        return go(S.UNAUTHENTICATED, { ...ctx, error: event.error || null });
      }
      break;

    case S.CHECKING_USER_STATUS:
      if (event.type === E.USER_STATUS_RESOLVED) {
        switch (event.result) {
          case "userNotFound":
            return go(S.BLOCKED_USER_NOT_FOUND, ctx);
          case "inactive":
            return go(S.BLOCKED_INACTIVE, ctx);
          case "newUser":
          case "active":
            return go(
              S.CHECKING_SETUP_STATUS,
              {
                ...ctx,
                role: event.role || ctx.role,
                failOpen: !!event.failOpen,
              },
              [
                {
                  type: "after",
                  delayMs: 1000,
                  event: { type: E.SETUP_DELAY_ELAPSED },
                },
              ],
            );
          default:
            return stay(state);
        }
      }
      break;

    case S.CHECKING_SETUP_STATUS:
      if (event.type === E.SETUP_STATUS_RESOLVED) {
        switch (event.result) {
          case "skipped":
            return go(S.CHECKING_PROFILE, ctx);
          case "pendingOtp":
            if (event.coachOtpVerified) return go(S.CHECKING_PROFILE, ctx);
            if (event.isDemo) return go(S.DEMO_BOOTSTRAPPING, ctx);
            return go(S.OTP_PENDING, ctx);
          case "incomplete":
            if (event.isDemo) return go(S.DEMO_BOOTSTRAPPING, ctx);
            return go(S.SETUP_WIZARD_REQUIRED, ctx);
          case "complete":
            return go(S.CHECKING_PROFILE, ctx);
          case "error":
            // Fail-soft: continue to profile check; mark degraded.
            return go(S.CHECKING_PROFILE, { ...ctx, failOpen: true });
          default:
            return stay(state);
        }
      }
      break;

    case S.OTP_PENDING:
      if (event.type === E.OTP_VERIFIED) {
        return go(S.CHECKING_PROFILE, ctx);
      }
      break;

    case S.SETUP_WIZARD_REQUIRED:
      if (
        event.type === E.SETUP_WIZARD_COMPLETED ||
        event.type === E.SETUP_WIZARD_SKIPPED
      ) {
        return go(S.CHECKING_PROFILE, ctx);
      }
      break;

    case S.DEMO_BOOTSTRAPPING:
      if (event.type === E.DEMO_SETUP_COMPLETED) {
        return go(S.CHECKING_PROFILE, ctx);
      }
      break;

    case S.CHECKING_PROFILE:
      if (event.type === E.PROFILE_CHECK_COMPLETED) {
        if (event.status === "complete") {
          return go(S.CHECKING_PROFILE_PICTURE, ctx, [
            { type: "after", delayMs: 400, event: { type: E.PICTURE_DELAY_ELAPSED } },
          ]);
        }
        if (event.status === "incomplete") {
          return go(S.PROFILE_GATE_REQUIRED, {
            ...ctx,
            snooze: event.snooze || null,
          });
        }
        // 'error' → degraded ready (don't block user on backend hiccup)
        return go(S.DEGRADED_READY, { ...ctx, failOpen: true });
      }
      break;

    case S.PROFILE_GATE_REQUIRED:
      if (event.type === E.PROFILE_CHECK_COMPLETED && event.status === "complete") {
        return go(S.CHECKING_PROFILE_PICTURE, ctx);
      }
      break;

    case S.CHECKING_PROFILE_PICTURE:
      if (event.type === E.PROFILE_PICTURE_CHECK_COMPLETED) {
        if (event.status === "valid" || event.status === "snoozed") {
          return go(S.READY, ctx);
        }
        if (event.status === "missing") {
          return go(S.PROFILE_PICTURE_GATE_REQUIRED, {
            ...ctx,
            snooze: event.snooze || null,
          });
        }
        // 'error' → ready (don't block; matches legacy fail-soft)
        return go(S.READY, { ...ctx, failOpen: true });
      }
      break;

    case S.PROFILE_PICTURE_GATE_REQUIRED:
      if (
        event.type === E.PROFILE_PICTURE_CHECK_COMPLETED &&
        event.status === "valid"
      ) {
        return go(S.READY, ctx);
      }
      break;

    case S.READY:
    case S.DEGRADED_READY:
      if (event.type === E.FOREGROUND_RECHECK) {
        return go(S.CHECKING_USER_STATUS, bump(ctx));
      }
      break;

    case S.SIGNING_OUT:
      if (
        event.type === E.SIGN_OUT_COMPLETED ||
        event.type === E.SIGNOUT_SAFETY_ELAPSED
      ) {
        return go(S.TERMINAL_LOGGED_OUT, {
          ...ctx,
          user: null,
          userEmail: null,
          signingOut: false,
        });
      }
      break;

    case S.TERMINAL_LOGGED_OUT:
      if (event.type === E.AUTH_CHANGED && event.user) {
        // Silent re-auth blocked: force sign-out.
        return go(
          S.SIGNING_OUT,
          {
            ...bump(ctx),
            signingOut: true,
            signOutReason: "silentReauthBlocked",
            user: null,
            userEmail: null,
          },
          [{ type: "after", delayMs: 2000, event: { type: E.SIGNOUT_SAFETY_ELAPSED } }],
        );
      }
      if (event.type === E.SIGN_IN_REQUESTED) {
        return go(S.SIGNING_IN, ctx);
      }
      break;

    case S.BLOCKED_INACTIVE:
    case S.BLOCKED_USER_NOT_FOUND:
    case S.BLOCKED_ACCOUNT_DELETED:
      // Only sign-out can leave a blocked state (handled by universal handler).
      break;

    default:
      break;
  }

  return stay(state);
}
