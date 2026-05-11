/**
 * User feature — service layer.
 * Pure business logic. Returns { httpStatus, body }. No HTTP, no direct DB.
 */
import { getISTTimestamp } from '../../utils/supabaseClient.js';
import { cache, cacheKeys } from '../../utils/cache.js';
import * as repo from './user.repository.js';

const VALID_DIETS = ['Vegetarian', 'Non-Vegetarian', 'Vegan', 'Pescatarian'];
const PHONE_RE = /^\+?[0-9]{10,15}$/;
const INACTIVITY_DAYS = 31;

function normalizeFoodName(name) {
  if (!name) return '';
  return name.toLowerCase().trim()
    .replace(/[-–—_()[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// — lookup —
export async function lookupUser({ email }) {
  const user = await repo.findByEmail(email);
  if (!user) {
    return { httpStatus: 404, body: { success: false, message: 'User not found', userNotFound: true } };
  }

  // Auto-deactivate after 31 days inactive
  if (user.Status === 'Active') {
    const lastActivityStr = user.LastActiveAt || user.EntryDateTime;
    if (lastActivityStr) {
      const days = (new Date() - new Date(lastActivityStr)) / (1000 * 60 * 60 * 24);
      if (days >= INACTIVITY_DAYS) {
        try { await repo.deactivateUser(user.UserId); user.Status = 'Inactive'; } catch { /* non-critical */ }
      }
    }
  }

  return {
    httpStatus: 200,
    body: {
      success: true,
      userId: user.UserId,
      userName: user.UserName,
      email: user.Email,
      status: user.Status,
      isActive: user.Status === 'Active',
      role: user.Role || 'user',
    },
  };
}

// — profile (GET) —
export async function getProfile({ email }) {
  const user = await repo.findProfileFull(email);
  if (!user) return { httpStatus: 404, body: { success: false, message: 'User not found' } };

  const latest = await repo.findLatestWeight(user.UserId);
  const height = user.Height ? parseFloat(user.Height) : null;
  const dietType = user.DietType || null;
  const phoneNumber = user.PhoneNumber || null;

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
        profileComplete: !!(height && dietType && phoneNumber),
        profileImage: user.ProfileImage || null,
        coachId: user.CoachId || null,
        profilePicSnooze: user.profile_pic_snooze || null,
        latestWeight: latest?.Weight ? parseFloat(latest.Weight) : null,
        latestBmr: user.Bmr ? parseFloat(user.Bmr) : null,
        weightRecordDate: latest?.CreatedAt || null,
      },
    },
  };
}

// — profile (POST: update) —
export async function updateProfile(input) {
  const { email, name, height, bmr, dietType, profileImage, phoneNumber } = input;
  const userId = await repo.findUserIdByEmail(email);
  if (!userId) return { httpStatus: 404, body: { success: false, message: 'User not found' } };

  const updateData = {};
  let cleanedPhoneNumber = null;

  if (name) updateData.UserName = name;
  if (height !== undefined && height !== null) updateData.Height = parseFloat(height);
  if (dietType && VALID_DIETS.includes(dietType)) updateData.DietType = dietType;
  if (phoneNumber && phoneNumber.trim() !== '') {
    const cleaned = phoneNumber.trim().replace(/[\s\-()]/g, '');
    if (PHONE_RE.test(cleaned)) {
      updateData.PhoneNumber = cleaned;
      cleanedPhoneNumber = cleaned;
    }
  }
  if (profileImage && profileImage.startsWith('data:image/')) {
    updateData.ProfileImage = profileImage;
    updateData.profile_pic_snooze = null;
  }

  if (Object.keys(updateData).length > 0) {
    const updated = await repo.updateUserById(userId, updateData);
    if (updated.length === 0) throw new Error(`Profile update matched 0 rows for UserId ${userId}`);
    try { await repo.touchLastActive(userId); } catch { /* non-critical */ }

    const verify = await repo.verifyProfile(userId);
    if (!verify) throw new Error(`Unable to verify profile update for UserId ${userId}`);
    if (cleanedPhoneNumber && verify.PhoneNumber !== cleanedPhoneNumber) {
      throw new Error('Phone number was not saved. Please try again.');
    }
    if (height !== undefined && height !== null) {
      const reqH = parseFloat(height);
      const savedH = verify.Height ? parseFloat(verify.Height) : null;
      if (!Number.isNaN(reqH) && savedH !== reqH) throw new Error('Height was not saved. Please try again.');
    }
    if (dietType && updateData.DietType && verify.DietType !== updateData.DietType) {
      throw new Error('Diet preference was not saved. Please try again.');
    }
  }

  let savedBmr = null;
  if (bmr !== undefined && bmr !== null) {
    const bmrValue = parseFloat(bmr);
    if (!isNaN(bmrValue) && bmrValue > 0) {
      await repo.updateBmr(userId, bmrValue);
      savedBmr = bmrValue;
    }
  }

  try { cache.delete(cacheKeys.userProfile(email)); } catch { /* non-critical */ }

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

// — context (food corrections + recent meals + diet) —
export async function getUserContext({ userId }) {
  const startTime = Date.now();
  const [userCorr, globalCorr, profile, recentMeals] = await repo.fetchUserContextData(userId);

  // Build globalPatterns map with chained corrections
  const aiMap = new Map();
  for (const row of (globalCorr.data || [])) {
    const k = normalizeFoodName(row.AiDetected);
    if (!aiMap.has(k)) aiMap.set(k, []);
    aiMap.get(k).push({
      aiDetected: row.AiDetected,
      userCorrected: row.UserCorrected,
      userId: row.UserId,
      timesCorrected: row.TimesCorrected || 1,
      lastCorrected: row.LastCorrected,
    });
  }

  const globalPatternsMap = new Map();
  for (const [normalizedAi, corrections] of aiMap.entries()) {
    const groups = new Map();
    for (const c of corrections) {
      const nc = normalizeFoodName(c.userCorrected);
      if (!groups.has(nc)) {
        groups.set(nc, {
          ai_detected: c.aiDetected,
          user_corrected: c.userCorrected,
          normalized_ai: normalizedAi,
          users: new Set(),
          total_corrections: 0,
          lastCorrected: c.lastCorrected,
        });
      }
      const g = groups.get(nc);
      g.users.add(c.userId);
      g.total_corrections += c.timesCorrected;
      if (new Date(c.lastCorrected) > new Date(g.lastCorrected)) {
        g.lastCorrected = c.lastCorrected;
        g.user_corrected = c.userCorrected;
      }
    }
    const mostRecent = [...groups.values()].sort((a, b) => new Date(b.lastCorrected) - new Date(a.lastCorrected))[0];
    if (mostRecent) {
      globalPatternsMap.set(`${normalizedAi}|${normalizeFoodName(mostRecent.user_corrected)}`, mostRecent);
    }
  }

  // Build correction chain map
  const chainMap = new Map();
  for (const p of globalPatternsMap.values()) {
    if (!chainMap.has(p.normalized_ai)) chainMap.set(p.normalized_ai, []);
    chainMap.get(p.normalized_ai).push({
      target: p.user_corrected,
      normalized_target: normalizeFoodName(p.user_corrected),
      total_corrections: p.total_corrections,
      user_count: p.users.size,
      lastCorrected: p.lastCorrected,
    });
  }
  for (const arr of chainMap.values()) {
    arr.sort((a, b) => new Date(b.lastCorrected) - new Date(a.lastCorrected));
  }

  function followChain(food, visited = new Set()) {
    const n = normalizeFoodName(food);
    if (visited.has(n)) return food;
    visited.add(n);
    const c = chainMap.get(n);
    if (!c || c.length === 0) return food;
    return followChain(c[0].target, visited);
  }

  const finalPatterns = new Map();
  for (const p of globalPatternsMap.values()) {
    const finalCorr = followChain(p.ai_detected);
    if (normalizeFoodName(finalCorr) !== p.normalized_ai) {
      const key = `${p.normalized_ai}|${normalizeFoodName(finalCorr)}`;
      if (!finalPatterns.has(key)) {
        finalPatterns.set(key, {
          ai_detected: p.ai_detected,
          user_corrected: finalCorr,
          user_count: p.users.size,
          total_corrections: p.total_corrections,
        });
      } else {
        finalPatterns.get(key).total_corrections += p.total_corrections;
      }
    }
  }

  const globalPatterns = [...finalPatterns.values()]
    .filter(p => p.user_count >= 1)
    .sort((a, b) => b.total_corrections - a.total_corrections || b.user_count - a.user_count)
    .slice(0, 100);

  const meals = (recentMeals.data || []).map(meal => {
    try {
      const ad = typeof meal.AnalysisData === 'string' ? JSON.parse(meal.AnalysisData) : meal.AnalysisData;
      const foods = (ad.detailedItems || []).map(i => i.name).filter(Boolean);
      return { foods, created_at: meal.CreatedAt };
    } catch {
      return { foods: [], created_at: meal.CreatedAt };
    }
  }).filter(m => m.foods.length > 0);

  return {
    httpStatus: 200,
    body: {
      success: true,
      data: {
        userId: parseInt(userId),
        personalCorrections: userCorr.data || [],
        globalPatterns,
        dietPreference: profile.data?.DietType || null,
        recentMeals: meals,
        metadata: {
          totalPersonalCorrections: (userCorr.data || []).length,
          totalGlobalPatterns: globalPatterns.length,
          totalRecentMeals: meals.length,
          queryTimeMs: Date.now() - startTime,
        },
      },
    },
  };
}

// — google sign-up —
export async function saveGoogleUser({ email, displayName, photoURL }) {
  const existing = await repo.findByEmailExact(email, '"UserId", "UserName", "Email", "Status", "ProfileImage"');

  if (!existing) {
    let username = displayName;
    let attempts = 0;
    while (attempts < 10 && (await repo.findUsername(username))) {
      attempts++;
      username = `${displayName}_${Date.now().toString().slice(-6)}`;
    }
    if (await repo.findUsername(username)) {
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

    const { error: insertErr } = await repo.insertUser(insertPayload);
    if (insertErr) {
      if (insertErr.code === '23505') {
        const recheck = await repo.findByEmailExact(email, '"UserId", "UserName", "Email", "Status"');
        if (recheck) {
          return {
            httpStatus: 200,
            body: {
              success: true, message: 'User already exists', isNewUser: false,
              user: { userId: recheck.UserId, userName: recheck.UserName, email: recheck.Email, status: recheck.Status },
            },
          };
        }
        return {
          httpStatus: 500,
          body: { success: false, message: 'Failed to create user account. Please try again.', error: 'Duplicate entry conflict' },
        };
      }
      throw insertErr;
    }
    return {
      httpStatus: 200,
      body: { success: true, message: 'User created successfully', isNewUser: true, username },
    };
  }

  if (photoURL && !existing.ProfileImage) {
    try { await repo.setProfileImage(email, photoURL); } catch { /* non-critical */ }
  }
  return {
    httpStatus: 200,
    body: {
      success: true, message: 'User already exists', isNewUser: false,
      user: { userId: existing.UserId, userName: existing.UserName, email: existing.Email, status: existing.Status },
    },
  };
}

// — snooze profile pic —
export async function snoozeProfilePic({ userId }) {
  if (userId === null || userId === 'null' || userId === 'DEMO_USER') {
    return { httpStatus: 200, body: { success: true } };
  }
  const row = await repo.getSnoozeRow(userId);
  if (!row) return { httpStatus: 404, body: { success: false, message: 'User not found' } };

  const existing = row.profile_pic_snooze || {};
  const snooze = {
    until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    count: (existing.count ?? 0) + 1,
    max: existing.max ?? 5,
  };
  await repo.setSnooze(userId, snooze);
  return { httpStatus: 200, body: { success: true, snooze } };
}

// — delete account (cascade) —
export async function deleteAccount({ email }) {
  const userId = await repo.findUserIdByEmail(email);
  if (!userId) return { httpStatus: 404, body: { success: false, message: 'User not found' } };

  await repo.deleteAllUserData(userId, email);
  await repo.deleteUser(userId);

  try {
    cache.delete(cacheKeys.nutritionMeals(userId));
    cache.delete(cacheKeys.nutritionMeals(userId.toString()));
    cache.delete(cacheKeys.userProfile(email));
    cache.delete(cacheKeys.userContext(userId));
    cache.delete(cacheKeys.userContext(userId.toString()));
  } catch { /* non-critical */ }

  return {
    httpStatus: 200,
    body: { success: true, message: 'Account and all associated data have been permanently deleted.' },
  };
}

// — skip-setup —
export async function skipSetup({ email, coachId }) {
  const user = await repo.findUserSkipFlag(email);
  if (!user) return { httpStatus: 404, body: { success: false, error: 'User not found' } };

  const updateData = { SetupSkipped: true };
  if (coachId) updateData.CoachId = coachId;
  await repo.updateUserByEmail(email, updateData);

  return {
    httpStatus: 200,
    body: { success: true, message: 'Setup skip recorded successfully', coachSaved: !!coachId },
  };
}

// — status —
export async function getUserStatus({ email }) {
  const user = await repo.findStatusUser(email);
  if (!user) return { httpStatus: 404, body: { success: false, error: 'User not found' } };

  const userId = user.UserId;
  const userRole = user.Role;
  const hasTeamId = !!user.TeamId;
  const hasUpline = !!user.CoachId;
  const setupSkipped = user.SetupSkipped === true;

  const baseResponse = (extra) => ({
    httpStatus: 200,
    body: { success: true, hasTeamId, hasUpline, role: userRole, ...extra },
  });

  if (setupSkipped) {
    return baseResponse({
      setupComplete: true, setupSkipped: true,
      teamId: user.TeamId, uplineCoachId: user.UplineCoachId,
      pendingRequest: null, redirectTo: '/dashboard',
      message: hasUpline ? 'Setup skipped - Coach relationship saved' : 'Setup skipped - You can use the app',
    });
  }

  if (userRole === 'admin' || userRole === 'developer') {
    return baseResponse({
      setupComplete: true, teamId: user.TeamId, uplineCoachId: user.UplineCoachId,
      pendingRequest: null, redirectTo: '/dashboard',
      message: 'Admin/Developer - setup not required',
    });
  }

  if (hasUpline) {
    return baseResponse({
      setupComplete: true, hasUpline: true, teamId: user.TeamId || null,
      uplineCoachId: user.UplineCoachId, pendingRequest: null, redirectTo: '/dashboard',
      message: hasTeamId ? 'Setup complete' : 'Setup complete (without Team ID)',
    });
  }

  const request = await repo.findPendingApprovalRequest(userId);
  if (request) {
    const expired = new Date() > new Date(request.OtpExpiresAt);
    if (expired) {
      try { await repo.deleteApprovalRequest(request.Id); } catch { /* non-critical */ }
    } else {
      return baseResponse({
        setupComplete: false, hasUpline: false,
        pendingRequest: {
          id: request.Id, coachId: request.UplineCoachId, status: request.Status,
          expiresAt: request.OtpExpiresAt, requestedAt: request.RequestedAt,
        },
        redirectTo: '/setup/validate-otp', message: 'Waiting for OTP validation',
      });
    }
  }

  if (!hasTeamId) {
    return baseResponse({
      setupComplete: false, hasUpline: false, pendingRequest: null,
      redirectTo: '/setup/upline',
      message: 'Team ID is optional - You can select your coach directly',
      allowSkipTeamId: true,
    });
  }

  return baseResponse({
    setupComplete: false, hasUpline: false, teamId: user.TeamId,
    pendingRequest: null, redirectTo: '/setup/upline',
    message: 'Please select your upline coach',
  });
}
