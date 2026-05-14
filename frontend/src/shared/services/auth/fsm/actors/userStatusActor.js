/**
 * shared/services/auth/fsm/actors/userStatusActor.js
 * ---------------------------------------------------------------------------
 * Actor wrapping `fetchUserStatus`. Declared in Phase 3d-a but NOT invoked by
 * the runtime — shadow mode observes events bridged from App.js instead.
 * Phase 3d-b's `driveLifecycle` will start invoking this actor.
 *
 * Contract: actor functions are pure orchestration — no React, no helpers
 * other than the Phase 3b HTTP modules.
 * ---------------------------------------------------------------------------
 */

import { fetchUserStatus } from "../../userSetup";
import { E } from "../events";

/**
 * @param {{ apiBaseUrl: string, email: string, epoch: number }} input
 * @param {(event: object) => void} send
 * @param {AbortSignal} [signal]
 */
export async function userStatusActor(input, send, signal) {
  const { apiBaseUrl, email, epoch } = input;
  try {
    const result = await fetchUserStatus({ apiBaseUrl, email });
    if (signal && signal.aborted) return;
    send({
      type: E.USER_STATUS_RESOLVED,
      result: result.result,
      role: result.role,
      failOpen: !!result.error,
      epoch,
    });
  } catch (err) {
    if (signal && signal.aborted) return;
    send({
      type: E.USER_STATUS_RESOLVED,
      result: "active",
      failOpen: true,
      error: err,
      epoch,
    });
  }
}
