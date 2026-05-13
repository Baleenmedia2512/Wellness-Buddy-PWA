/**
 * google-auth.service.js — User feature: Google sign-in user provisioning.
 *
 * Owns POST /api/user/google. Preserves response shapes byte-identical to
 * the legacy handler.
 */
import * as repo from './user.repository.js';

const { getISTTimestamp } = repo;

const existingUserResponse = (existing) => ({
  httpStatus: 200,
  body: {
    success: true,
    message: 'User already exists',
    isNewUser: false,
    user: {
      userId: existing.UserId,
      userName: existing.UserName,
      email: existing.Email,
      status: existing.Status,
    },
  },
});

async function pickUniqueUsername({ displayName, email }) {
  let username = displayName;
  let exists = true;
  let attempts = 0;
  while (exists && attempts < 10) {
    const row = await repo.findByUsername(username);
    if (!row) { exists = false; }
    else {
      attempts++;
      username = `${displayName}_${Date.now().toString().slice(-6)}`;
    }
  }
  if (exists) username = `${email.split('@')[0]}_${Date.now().toString().slice(-6)}`;
  return username;
}

export async function saveGoogleUser({ email, displayName, photoURL }) {
  const existing = await repo.findByExactEmail(email, '"UserId", "UserName", "Email", "Status", "ProfileImage"');
  if (existing) {
    if (photoURL && !existing.ProfileImage) {
      try { await repo.updateUserByEmail(email, { ProfileImage: photoURL }); } catch { /* non-fatal */ }
    }
    return existingUserResponse(existing);
  }

  const username = await pickUniqueUsername({ displayName, email });
  const currentTime = getISTTimestamp();
  const insertPayload = {
    EntryDateTime: currentTime,
    LastActiveAt: currentTime,
    EntryUser: 'Google Sign-In',
    UserName: username,
    Password: 'User@123#',
    TargetWeightInKg: 0,
    Status: 'Active',
    CoachApproved: 0,
    Email: email,
  };
  if (photoURL) insertPayload.ProfileImage = photoURL;

  const { error: insertErr } = await repo.insertUser(insertPayload);
  if (insertErr) {
    if (insertErr.code === '23505') {
      const recheck = await repo.findByExactEmail(email, '"UserId", "UserName", "Email", "Status"');
      if (recheck) return existingUserResponse(recheck);
      return {
        httpStatus: 500,
        body: {
          success: false,
          message: 'Failed to create user account. Please try again.',
          error: 'Duplicate entry conflict',
        },
      };
    }
    throw insertErr;
  }

  return {
    httpStatus: 200,
    body: { success: true, message: 'User created successfully', isNewUser: true, username },
  };
}
