/**
 * shared/services/auth/fsm/actors/demoSetupActor.js
 * Phase 3d-a: declared, not invoked. See userStatusActor.js header.
 */

import { silentlyCompleteDemoSetup } from "../../demoSetup";
import { E } from "../events";

export async function demoSetupActor(input, send /* signal intentionally ignored — best-effort */) {
  const { email, apiBaseUrl, epoch } = input;
  send({ type: E.DEMO_SETUP_STARTED, email, epoch });
  let success = false;
  try {
    success = await silentlyCompleteDemoSetup(email, { apiBaseUrl });
  } catch {
    success = false;
  }
  send({ type: E.DEMO_SETUP_COMPLETED, success, epoch });
}
