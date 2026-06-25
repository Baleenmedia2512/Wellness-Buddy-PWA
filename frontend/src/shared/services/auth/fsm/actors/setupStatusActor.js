/**
 * shared/services/auth/fsm/actors/setupStatusActor.js
 * Phase 3d-a: declared, not invoked. See userStatusActor.js header.
 */

import { fetchSetupStatus } from "../../userSetup";
import { E } from "../events";

const DEMO_EMAIL = "testereasywork@gmail.com";

export async function setupStatusActor(input, send, signal) {
  const { apiBaseUrl, email, epoch, coachOtpVerified } = input;
  try {
    const status = await fetchSetupStatus({ apiBaseUrl, email });
    if (signal && signal.aborted) return;
    send({
      type: E.SETUP_STATUS_RESOLVED,
      result: status.result,
      raw: status.raw,
      isDemo: (email || "").toLowerCase().trim() === DEMO_EMAIL,
      coachOtpVerified: !!coachOtpVerified,
      epoch,
    });
  } catch (err) {
    if (signal && signal.aborted) return;
    send({
      type: E.SETUP_STATUS_RESOLVED,
      result: "error",
      error: err,
      epoch,
    });
  }
}
