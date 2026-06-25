/**
 * shared/services/auth/fsm/actors/profileCheckActor.js
 * Phase 3d-a: declared, not invoked. See userStatusActor.js header.
 */

import { fetchProfileCompletion } from "../../userProfile";
import { E } from "../events";

export async function profileCheckActor(input, send, signal) {
  const { apiBaseUrl, email, afterSave, epoch } = input;
  try {
    const result = await fetchProfileCompletion({
      apiBaseUrl,
      email,
      afterSave: !!afterSave,
    });
    if (signal && signal.aborted) return;
    send({
      type: E.PROFILE_CHECK_COMPLETED,
      status: result.status,
      data: result.data,
      snooze: result.snooze,
      missingFields: result.missingFields,
      epoch,
    });
  } catch (err) {
    if (signal && signal.aborted) return;
    send({ type: E.PROFILE_CHECK_COMPLETED, status: "error", error: err, epoch });
  }
}
