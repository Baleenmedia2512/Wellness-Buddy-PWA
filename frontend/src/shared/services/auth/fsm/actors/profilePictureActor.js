/**
 * shared/services/auth/fsm/actors/profilePictureActor.js
 * Phase 3d-a: declared, not invoked. See userStatusActor.js header.
 */

import { fetchProfilePicture } from "../../userProfile";
import { E } from "../events";

export async function profilePictureActor(input, send, signal) {
  const { apiBaseUrl, email, epoch } = input;
  try {
    const result = await fetchProfilePicture({ apiBaseUrl, email });
    if (signal && signal.aborted) return;
    send({
      type: E.PROFILE_PICTURE_CHECK_COMPLETED,
      status: result.status,
      source: result.source,
      snooze: result.snooze,
      profileImage: result.profileImage,
      epoch,
    });
  } catch (err) {
    if (signal && signal.aborted) return;
    send({
      type: E.PROFILE_PICTURE_CHECK_COMPLETED,
      status: "error",
      error: err,
      epoch,
    });
  }
}
