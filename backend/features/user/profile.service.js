/**
 * profile.service.js — User feature: profile read/update + lifecycle ops.
 *
 * Owns: GET/UPDATE profile, snooze-profile-pic, delete-account.
 * Preserves response shapes byte-identical to the legacy handlers.
 */
import { cache, cacheKeys } from '../../utils/cache.js';
import { VALID_DIETS, VALID_GOAL_MODES } from './user.validators.js';
import * as repo from './user.repository.js';

const { getISTTimestamp } = repo;
const notFound = () => ({ httpStatus: 404, body: { success: false, message: 'User not found' } });

export async function getProfile({ email }) {
  const user = await repo.getProfile(email);
  if (!user) return notFound();

  const latestWeight = await repo.getLatestWeight(user.UserId);
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
        height, dietType, phoneNumber,
        weightGoalMode: user.WeightGoalMode || 'loss',
        profileComplete: !!(height && dietType && phoneNumber),
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

function buildProfileUpdate({ name, height, dietType, phoneNumber, profileImage, weightGoalMode }) {
  const updateData = {};
  let cleanedPhoneNumber;
  if (name != null) updateData.UserName = name;
  if (height != null) updateData.Height = parseFloat(height);
  if (dietType != null && VALID_DIETS.includes(dietType)) updateData.DietType = dietType;
  if (weightGoalMode != null && VALID_GOAL_MODES.includes(weightGoalMode)) {
    updateData.WeightGoalMode = weightGoalMode;
  }
  if (phoneNumber != null && String(phoneNumber).trim() !== '') {
    const cleaned = String(phoneNumber).trim().replace(/[\s\-()]/g, '');
    if (/^\+?[0-9]{10,15}$/.test(cleaned)) { updateData.PhoneNumber = cleaned; cleanedPhoneNumber = cleaned; }
  }
  if (profileImage != null && profileImage.startsWith('data:image/')) {
    updateData.ProfileImage = profileImage;
    updateData.profile_pic_snooze = null;
  }
  return { updateData, cleanedPhoneNumber };
}

function verifySaved(verifyRow, { cleanedPhoneNumber, height, dietType, updateData }) {
  if (cleanedPhoneNumber && verifyRow.PhoneNumber !== cleanedPhoneNumber) {
    throw new Error('Phone number was not saved. Please try again.');
  }
  if (height != null) {
    const reqH = parseFloat(height);
    const savedH = verifyRow.Height ? parseFloat(verifyRow.Height) : null;
    if (!Number.isNaN(reqH) && savedH !== reqH) throw new Error('Height was not saved. Please try again.');
  }
  if (dietType != null && updateData.DietType && verifyRow.DietType !== updateData.DietType) {
    throw new Error('Diet preference was not saved. Please try again.');
  }
}

export async function updateProfile(input) {
  const { email, name, height, bmr, dietType, profileImage, phoneNumber, weightGoalMode } = input;
  const user = await repo.findByEmail(email, 'UserId');
  if (!user) return notFound();
  const userId = user.UserId;

  const { updateData, cleanedPhoneNumber } = buildProfileUpdate(input);
  if (Object.keys(updateData).length > 0) {
    const rows = await repo.updateUserByEmail(email, updateData);
    if (!rows || rows.length === 0) throw new Error(`Profile update matched 0 rows for UserId ${userId}`);
    try { await repo.updateUserById(userId, { LastActiveAt: getISTTimestamp() }); } catch { /* non-fatal */ }
    const verifyRow = await repo.verifyProfile(userId);
    if (!verifyRow) throw new Error(`Unable to verify profile update for UserId ${userId}`);
    verifySaved(verifyRow, { cleanedPhoneNumber, height, dietType, updateData });
  }

  let savedBmr = null;
  if (bmr != null) {
    const bmrValue = parseFloat(bmr);
    if (!isNaN(bmrValue) && bmrValue > 0) { await repo.updateUserById(userId, { Bmr: bmrValue }); savedBmr = bmrValue; }
  }

  try { cache.delete(cacheKeys.userProfile(email)); } catch { /* non-fatal */ }

  return {
    httpStatus: 200,
    body: {
      success: true, message: 'User profile updated successfully',
      data: {
        email,
        name: name || undefined,
        height: height ? parseFloat(height) : undefined,
        bmr: savedBmr || undefined,
        dietType: dietType || undefined,
        phoneNumber: cleanedPhoneNumber || undefined,
        weightGoalMode: weightGoalMode || undefined,
        profileImageUpdated: !!profileImage,
      },
    },
  };
}

export async function snoozeProfilePic({ userId }) {
  if (userId === 'null' || userId === null || userId === 'DEMO_USER') {
    return { httpStatus: 200, body: { success: true } };
  }
  const row = await repo.getSnoozeRow(userId);
  if (!row) return notFound();
  const existing = row.profile_pic_snooze || {};
  const newSnooze = {
    until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    count: (existing.count ?? 0) + 1,
    max: existing.max ?? 5,
  };
  await repo.setSnooze(userId, newSnooze);
  return { httpStatus: 200, body: { success: true, snooze: newSnooze } };
}

export async function deleteAccount({ email }) {
  const user = await repo.findByEmail(email, '"UserId"');
  if (!user) return notFound();

  await repo.purgeUserData(user.UserId, email);
  await repo.deleteTeamRow(user.UserId);

  try {
    cache.delete(cacheKeys.nutritionMeals(user.UserId));
    cache.delete(cacheKeys.nutritionMeals(user.UserId.toString()));
    cache.delete(cacheKeys.userProfile(email));
    cache.delete(cacheKeys.userContext(user.UserId));
    cache.delete(cacheKeys.userContext(user.UserId.toString()));
  } catch { /* non-fatal */ }

  return { httpStatus: 200, body: { success: true, message: 'Account and all associated data have been permanently deleted.' } };
}
