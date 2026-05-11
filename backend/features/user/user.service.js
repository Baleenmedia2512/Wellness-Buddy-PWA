/**
 * User feature — service layer. Preserves response shapes byte-identical
 * to the legacy flat handlers it replaces.
 */
import { cache, cacheKeys } from '../../utils/cache.js';
import { VALID_DIETS } from './user.validators.js';
import * as repo from './user.repository.js';

const { getISTTimestamp } = repo;

// ─── get-user-profile ────────────────────────────────────────────────────────
export async function getProfile({ email }) {
  const user = await repo.getProfile(email);
  if (!user) return { httpStatus: 404, body: { success: false, message: 'User not found' } };

  const latestWeight = await repo.getLatestWeight(user.UserId);
  const height = user.Height ? parseFloat(user.Height) : null;
  const dietType = user.DietType || null;
  const phoneNumber = user.PhoneNumber || null;
  const profileComplete = !!(height && dietType && phoneNumber);

  return {
    httpStatus: 200,
    body: {
      success: true,
      data: {
        userId: user.UserId,
        userName: user.UserName,
        email: user.Email,
        height,
        dietType,
        phoneNumber,
        profileComplete,
        profileImage: user.ProfileImage || null,
        coachId: user.CoachId || null,
        profilePicSnooze: user.profile_pic_snooze || null,
        latestWeight: latestWeight?.Weight ? parseFloat(latestWeight.Weight) : null,
        latestBmr: user.Bmr ? parseFloat(user.Bmr) : null,
        weightRecordDate: latestWeight?.CreatedAt || null,
      },
    },
  };
}

// ─── update-user-profile ─────────────────────────────────────────────────────
export async function updateProfile(input) {
  const { email, name, height, bmr, dietType, profileImage, phoneNumber } = input;

  const user = await repo.findByEmail(email, 'UserId');
  if (!user) return { httpStatus: 404, body: { success: false, message: 'User not found' } };
  const userId = user.UserId;

  const updateData = {};
  let cleanedPhoneNumber;

  if (name !== undefined && name !== null) updateData.UserName = name;
  if (height !== undefined && height !== null) updateData.Height = parseFloat(height);
  if (dietType !== undefined && dietType !== null && VALID_DIETS.includes(dietType)) {
    updateData.DietType = dietType;
  }

  if (phoneNumber !== undefined && phoneNumber !== null && String(phoneNumber).trim() !== '') {
    const cleaned = String(phoneNumber).trim().replace(/[\s\-()]/g, '');
    if (/^\+?[0-9]{10,15}$/.test(cleaned)) {
      updateData.PhoneNumber = cleaned;
      cleanedPhoneNumber = cleaned;
    }
  }

  if (profileImage !== undefined && profileImage !== null && profileImage.startsWith('data:image/')) {
    updateData.ProfileImage = profileImage;
    updateData.profile_pic_snooze = null;
  }

  if (Object.keys(updateData).length > 0) {
    const rows = await repo.updateUserByEmail(email, updateData);
    if (!rows || rows.length === 0) {
      throw new Error(`Profile update matched 0 rows for UserId ${userId}`);
    }

    // LastActiveAt
    try { await repo.updateUserById(userId, { LastActiveAt: getISTTimestamp() }); } catch { /* non-fatal */ }

    // Verify
    const verifyRow = await repo.verifyProfile(userId);
    if (!verifyRow) throw new Error(`Unable to verify profile update for UserId ${userId}`);

    if (cleanedPhoneNumber && verifyRow.PhoneNumber !== cleanedPhoneNumber) {
      throw new Error('Phone number was not saved. Please try again.');
    }
    if (height !== undefined && height !== null) {
      const reqHeight = parseFloat(height);
      const savedHeight = verifyRow.Height ? parseFloat(verifyRow.Height) : null;
      if (!Number.isNaN(reqHeight) && savedHeight !== reqHeight) {
        throw new Error('Height was not saved. Please try again.');
      }
    }
    if (dietType !== undefined && dietType !== null && updateData.DietType
        && verifyRow.DietType !== updateData.DietType) {
      throw new Error('Diet preference was not saved. Please try again.');
    }
  }

  // BMR
  let savedBmr = null;
  if (bmr !== undefined && bmr !== null) {
    const bmrValue = parseFloat(bmr);
    if (!isNaN(bmrValue) && bmrValue > 0) {
      await repo.updateUserById(userId, { Bmr: bmrValue });
      savedBmr = bmrValue;
    }
  }

  try { cache.delete(cacheKeys.userProfile(email)); } catch { /* non-fatal */ }

  return {
    httpStatus: 200,
    body: {
      success: true,
      message: 'User profile updated successfully',
      data: {
        email,
        name: name || undefined,
        height: height ? parseFloat(height) : undefined,
        bmr: savedBmr || undefined,
        dietType: dietType || undefined,
        phoneNumber: cleanedPhoneNumber || undefined,
        profileImageUpdated: !!profileImage,
      },
    },
  };
}

// ─── lookup-user-id ──────────────────────────────────────────────────────────
export async function lookupUser({ email }) {
  const user = await repo.findByEmail(email, '"UserId", "UserName", "Email", "Status", "Role", "LastActiveAt", "EntryDateTime"');
  if (!user) {
    return { httpStatus: 404, body: { success: false, message: 'User not found', userNotFound: true } };
  }

  // Auto-deactivation after 31 days inactivity
  if (user.Status === 'Active') {
    const lastActivityStr = user.LastActiveAt || user.EntryDateTime;
    if (lastActivityStr) {
      const diffDays = (Date.now() - new Date(lastActivityStr).getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays >= 31) {
        await repo.setUserStatus(user.UserId, 'Inactive');
        user.Status = 'Inactive';
      }
    }
  }

  const isActive = user.Status === 'Active';
  return {
    httpStatus: 200,
    body: {
      success: true,
      userId: user.UserId,
      userName: user.UserName,
      email: user.Email,
      status: user.Status,
      isActive,
      role: user.Role || 'user',
    },
  };
}

// ─── save-google-user ────────────────────────────────────────────────────────
export async function saveGoogleUser({ email, displayName, photoURL }) {
  const existing = await repo.findByExactEmail(email, '"UserId", "UserName", "Email", "Status", "ProfileImage"');

  if (existing) {
    if (photoURL && !existing.ProfileImage) {
      try { await repo.updateUserByEmail(email, { ProfileImage: photoURL }); } catch { /* non-fatal */ }
    }
    return {
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
    };
  }

  // Choose unique username
  let username = displayName;
  let usernameExists = true;
  let attempts = 0;
  while (usernameExists && attempts < 10) {
    const row = await repo.findByUsername(username);
    if (!row) { usernameExists = false; }
    else {
      attempts++;
      username = `${displayName}_${Date.now().toString().slice(-6)}`;
    }
  }
  if (usernameExists) {
    username = `${email.split('@')[0]}_${Date.now().toString().slice(-6)}`;
  }

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

  const { data: insertData, error: insertErr } = await repo.insertUser(insertPayload);

  if (insertErr) {
    if (insertErr.code === '23505') {
      const recheck = await repo.findByExactEmail(email, '"UserId", "UserName", "Email", "Status"');
      if (recheck) {
        return {
          httpStatus: 200,
          body: {
            success: true, message: 'User already exists', isNewUser: false,
            user: { userId: recheck.UserId, userName: recheck.UserName, email: recheck.Email, status: recheck.Status },
          },
        };
      }
      return { httpStatus: 500, body: { success: false, message: 'Failed to create user account. Please try again.', error: 'Duplicate entry conflict' } };
    }
    throw insertErr;
  }

  return {
    httpStatus: 200,
    body: { success: true, message: 'User created successfully', isNewUser: true, username },
  };
}

// ─── snooze-profile-pic ──────────────────────────────────────────────────────
export async function snoozeProfilePic({ userId }) {
  // Demo bypass
  if (userId === 'null' || userId === null || userId === 'DEMO_USER') {
    return { httpStatus: 200, body: { success: true } };
  }
  const row = await repo.getSnoozeRow(userId);
  if (!row) return { httpStatus: 404, body: { success: false, message: 'User not found' } };

  const existing = row.profile_pic_snooze || {};
  const newSnooze = {
    until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    count: (existing.count ?? 0) + 1,
    max: existing.max ?? 5,
  };
  await repo.setSnooze(userId, newSnooze);
  return { httpStatus: 200, body: { success: true, snooze: newSnooze } };
}

// ─── delete-user-account ─────────────────────────────────────────────────────
export async function deleteAccount({ email }) {
  const user = await repo.findByEmail(email, '"UserId"');
  if (!user) return { httpStatus: 404, body: { success: false, message: 'User not found' } };

  await repo.purgeUserData(user.UserId, email);
  await repo.deleteTeamRow(user.UserId);

  try {
    cache.delete(cacheKeys.nutritionMeals(user.UserId));
    cache.delete(cacheKeys.nutritionMeals(user.UserId.toString()));
    cache.delete(cacheKeys.userProfile(email));
    cache.delete(cacheKeys.userContext(user.UserId));
    cache.delete(cacheKeys.userContext(user.UserId.toString()));
  } catch { /* non-fatal */ }

  return {
    httpStatus: 200,
    body: { success: true, message: 'Account and all associated data have been permanently deleted.' },
  };
}

// ─── skip-setup ──────────────────────────────────────────────────────────────
export async function skipSetup({ email, coachId }) {
  const user = await repo.findByEmail(email, 'UserId, SetupSkipped');
  if (!user) return { httpStatus: 404, body: { success: false, error: 'User not found' } };

  const updateData = { SetupSkipped: true };
  if (coachId) updateData.CoachId = coachId;
  await repo.updateUserByEmail(email, updateData);
  return {
    httpStatus: 200,
    body: { success: true, message: 'Setup skip recorded successfully', coachSaved: !!coachId },
  };
}

// ─── user/status ─────────────────────────────────────────────────────────────
export async function getStatus({ email }) {
  const user = await repo.getStatusFields(email);
  if (!user) return { httpStatus: 404, body: { success: false, error: 'User not found' } };

  const userId = user.UserId;
  const userRole = user.Role;
  const hasTeamId = !!user.TeamId;
  const hasUpline = !!user.CoachId;
  const setupSkipped = user.SetupSkipped === true;

  if (setupSkipped) {
    return {
      httpStatus: 200,
      body: {
        success: true, setupComplete: true, hasTeamId, hasUpline, setupSkipped: true,
        teamId: user.TeamId, uplineCoachId: user.UplineCoachId, role: userRole,
        pendingRequest: null, redirectTo: '/dashboard',
        message: hasUpline ? 'Setup skipped - Coach relationship saved' : 'Setup skipped - You can use the app',
      },
    };
  }

  if (userRole === 'admin' || userRole === 'developer') {
    return {
      httpStatus: 200,
      body: {
        success: true, setupComplete: true, hasTeamId, hasUpline,
        teamId: user.TeamId, uplineCoachId: user.UplineCoachId, role: userRole,
        pendingRequest: null, redirectTo: '/dashboard',
        message: 'Admin/Developer - setup not required',
      },
    };
  }

  if (hasUpline) {
    return {
      httpStatus: 200,
      body: {
        success: true, setupComplete: true, hasTeamId, hasUpline: true,
        teamId: user.TeamId || null, uplineCoachId: user.UplineCoachId,
        pendingRequest: null, redirectTo: '/dashboard',
        message: hasTeamId ? 'Setup complete' : 'Setup complete (without Team ID)',
      },
    };
  }

  const request = await repo.getPendingApproval(userId);
  if (request) {
    if (new Date() > new Date(request.OtpExpiresAt)) {
      await repo.deleteApproval(request.Id);
    } else {
      return {
        httpStatus: 200,
        body: {
          success: true, setupComplete: false, hasTeamId, hasUpline: false,
          pendingRequest: {
            id: request.Id, coachId: request.UplineCoachId, status: request.Status,
            expiresAt: request.OtpExpiresAt, requestedAt: request.RequestedAt,
          },
          redirectTo: '/setup/validate-otp',
          message: 'Waiting for OTP validation',
        },
      };
    }
  }

  if (!hasTeamId) {
    return {
      httpStatus: 200,
      body: {
        success: true, setupComplete: false, hasTeamId: false, hasUpline: false,
        pendingRequest: null, redirectTo: '/setup/upline',
        message: 'Team ID is optional - You can select your coach directly',
        allowSkipTeamId: true,
      },
    };
  }

  return {
    httpStatus: 200,
    body: {
      success: true, setupComplete: false, hasTeamId: true, hasUpline: false,
      teamId: user.TeamId, pendingRequest: null, redirectTo: '/setup/upline',
      message: 'Please select your upline coach',
    },
  };
}

// ─── get-user-context (kept here because URL is /api/user/context) ──────────
function normalizeFoodName(name) {
  if (!name) return '';
  return name.toLowerCase().trim().replace(/[-–—_()[\]{}]/g, ' ').replace(/\s+/g, ' ').trim();
}

export async function getContext({ userId }) {
  const startTime = Date.now();
  const [userCorrectionsResult, globalPatternsResult, userProfileResult, recentMealsResult] =
    await repo.getUserContextData(userId);

  // ── Process global patterns: most-recent correction wins ──
  const aiDetectionMap = new Map();
  if (globalPatternsResult.data) {
    for (const row of globalPatternsResult.data) {
      const k = normalizeFoodName(row.AiDetected);
      if (!aiDetectionMap.has(k)) aiDetectionMap.set(k, []);
      aiDetectionMap.get(k).push({
        aiDetected: row.AiDetected, userCorrected: row.UserCorrected, userId: row.UserId,
        timesCorrected: row.TimesCorrected || 1, lastCorrected: row.LastCorrected,
      });
    }
  }

  const globalPatternsMap = new Map();
  aiDetectionMap.forEach((corrections, normalizedAi) => {
    const groups = new Map();
    for (const corr of corrections) {
      const nc = normalizeFoodName(corr.userCorrected);
      if (!groups.has(nc)) {
        groups.set(nc, {
          ai_detected: corr.aiDetected, user_corrected: corr.userCorrected,
          normalized_ai: normalizedAi, users: new Set(), total_corrections: 0,
          lastCorrected: corr.lastCorrected,
        });
      }
      const g = groups.get(nc);
      g.users.add(corr.userId);
      g.total_corrections += corr.timesCorrected;
      if (new Date(corr.lastCorrected) > new Date(g.lastCorrected)) {
        g.lastCorrected = corr.lastCorrected;
        g.user_corrected = corr.userCorrected;
      }
    }
    const mostRecent = Array.from(groups.values())
      .sort((a, b) => new Date(b.lastCorrected) - new Date(a.lastCorrected))[0];
    if (mostRecent) {
      globalPatternsMap.set(`${normalizedAi}|${normalizeFoodName(mostRecent.user_corrected)}`, mostRecent);
    }
  });

  // Correction chains
  const correctionChainMap = new Map();
  globalPatternsMap.forEach((p) => {
    const k = p.normalized_ai;
    if (!correctionChainMap.has(k)) correctionChainMap.set(k, []);
    correctionChainMap.get(k).push({
      target: p.user_corrected, normalized_target: normalizeFoodName(p.user_corrected),
      total_corrections: p.total_corrections, user_count: p.users.size,
      lastCorrected: p.lastCorrected,
    });
  });
  correctionChainMap.forEach((arr) => arr.sort((a, b) => new Date(b.lastCorrected) - new Date(a.lastCorrected)));

  const followChain = (foodName, visited = new Set()) => {
    const n = normalizeFoodName(foodName);
    if (visited.has(n)) return foodName;
    visited.add(n);
    const arr = correctionChainMap.get(n);
    if (!arr?.length) return foodName;
    return followChain(arr[0].target, visited);
  };

  const finalGlobalPatterns = new Map();
  globalPatternsMap.forEach((p) => {
    const final = followChain(p.ai_detected);
    if (normalizeFoodName(final) !== p.normalized_ai) {
      const key = `${p.normalized_ai}|${normalizeFoodName(final)}`;
      if (!finalGlobalPatterns.has(key)) {
        finalGlobalPatterns.set(key, {
          ai_detected: p.ai_detected, user_corrected: final,
          user_count: p.users.size, total_corrections: p.total_corrections,
        });
      } else {
        finalGlobalPatterns.get(key).total_corrections += p.total_corrections;
      }
    }
  });

  const globalPatterns = Array.from(finalGlobalPatterns.values())
    .filter((p) => p.user_count >= 1)
    .sort((a, b) => (b.total_corrections - a.total_corrections) || (b.user_count - a.user_count))
    .slice(0, 100);

  const recentMeals = (recentMealsResult.data || []).map((meal) => {
    try {
      const ad = typeof meal.AnalysisData === 'string' ? JSON.parse(meal.AnalysisData) : meal.AnalysisData;
      const foods = (ad?.detailedItems || []).map((i) => i.name).filter(Boolean);
      return { foods, created_at: meal.CreatedAt };
    } catch {
      return { foods: [], created_at: meal.CreatedAt };
    }
  }).filter((m) => m.foods.length > 0);

  return {
    httpStatus: 200,
    body: {
      success: true,
      data: {
        userId: parseInt(userId),
        personalCorrections: userCorrectionsResult.data || [],
        globalPatterns,
        dietPreference: userProfileResult.data?.DietType || null,
        recentMeals,
        metadata: {
          totalPersonalCorrections: (userCorrectionsResult.data || []).length,
          totalGlobalPatterns: globalPatterns.length,
          totalRecentMeals: recentMeals.length,
          queryTimeMs: Date.now() - startTime,
        },
      },
    },
  };
}
