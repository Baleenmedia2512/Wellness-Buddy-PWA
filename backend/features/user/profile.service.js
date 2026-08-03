/**
 * profile.service.js — User feature: profile read/update + lifecycle ops.
 *
 * Owns: GET/UPDATE profile, snooze-profile-pic, delete-account.
 * Preserves response shapes byte-identical to the legacy handlers.
 */
import { cache, cacheKeys } from '../../utils/cache.js';
import logger from '../../shared/lib/logger.js';
import { nowUtc, addUtcDays } from '../../shared/lib/datetime/index.js';
import { VALID_DIETS, VALID_GOAL_MODES } from './user.validators.js';
import { computeKatchMcArdleBmr } from '../../utils/bmrCalculations.js';
import {
  buildTdeeBreakdown,
  isValidPhysicalActivityLevel,
  resolveCalorieTargetFromProfile,
} from '../../utils/tdeeCalculations.js';
import * as repo from './user.repository.js';
import {
  hasValidProfileName,
  isProfileComplete,
} from './domain/profileCompleteness.js';
import { buildProfileCardSyncPayload } from '../body-parameters-card/domain/sync.rules.js';
import { deriveWeightGoalMode } from '../../utils/weightValidation.js';
import { resolveProfileTimezone } from './domain/profileTimezone.js';
import { mapCardToProfileBodyMetrics, hasCoachRecordedBodyMetrics } from './domain/profileBodyMetrics.rules.js';
import { findLatestLinkedBodyMetricsCard } from '../body-parameters-card/data/card.repo.js';
import { isEnabled } from '../../shared/lib/feature-flags.js';
import { isConsentRecorded } from '../auth/domain/consent.rules.js';

const notFound = () => ({ httpStatus: 404, body: { success: false, message: 'User not found' } });

export async function getProfile({ email }) {
  const user = await repo.getProfile(email);
  if (!user) return notFound();

  const [latestWeight, latestBodyMetricsCard, coachRow] = await Promise.all([
    repo.getLatestWeight(user.UserId),
    findLatestLinkedBodyMetricsCard(user.UserId),
    user.CoachId
      ? repo.findByUserId(user.CoachId, '"UserId", "UserName"')
      : Promise.resolve(null),
  ]);
  const bodyMetricsMapped = mapCardToProfileBodyMetrics(latestBodyMetricsCard);
  const bodyMetrics = hasCoachRecordedBodyMetrics(bodyMetricsMapped) ? bodyMetricsMapped : null;
  const height = user.Height ? parseFloat(user.Height) : null;
  const latestWeightKg = latestWeight?.Weight ? parseFloat(latestWeight.Weight) : null;
  const derivedGoalMode = deriveWeightGoalMode({ heightCm: height, currentWeightKg: latestWeightKg });
  const dietType = user.DietType || null;
  const phoneNumber = user.PhoneNumber || null;
  const bodyGender = bodyMetrics?.gender;
  const gender = user.Gender
    || (bodyGender === 'Male' || bodyGender === 'Female' ? bodyGender : null)
    || null;
  const profileImage = user.ProfileImage || null;
  const latestBmr = user.Bmr ? parseFloat(user.Bmr) : null;
  const physicalActivityLevel = user.PhysicalActivityLevel || null;
  const calorieTarget = resolveCalorieTargetFromProfile({
    bmr: latestBmr,
    physicalActivityLevel,
  });
  const tdeeBreakdown = buildTdeeBreakdown({ bmr: latestBmr, physicalActivityLevel });
  const coachName = coachRow?.UserName ? String(coachRow.UserName).trim() : null;

  return {
    httpStatus: 200,
    body: {
      success: true,
      data: {
        userId: user.UserId,
        userName: user.UserName,
        email: user.Email,
        height, dietType, phoneNumber, gender,
        weightGoalMode: derivedGoalMode || user.WeightGoalMode || 'loss',
        weightGoalModeAuto: derivedGoalMode != null,
        profileComplete: isProfileComplete({
          height,
          dietType,
          phoneNumber,
          userName: user.UserName,
          email: user.Email,
          gender,
          bodyMetrics,
          profileImage,
        }),
        needsName: !hasValidProfileName(user.UserName, {
          email: user.Email,
          phoneNumber,
        }),
        profileImage,
        coachId: user.CoachId || null,
        coachName,
        profilePicSnooze: user.profile_pic_snooze || null,
        latestWeight: latestWeight?.Weight ? parseFloat(latestWeight.Weight) : null,
        latestBmr,
        physicalActivityLevel,
        communityId: user.CommunityId ?? null,
        timezone: resolveProfileTimezone(user.timezone_iana),
        consentAccepted: isConsentRecorded(user),
        consentRequired: isEnabled('ff.consent-gate') && !isConsentRecorded(user),
        consentVersion: user.ConsentVersion || null,
        calorieTarget,
        tdeeBreakdown,
        weightRecordDate: latestWeight?.CreatedAt || null,
        bodyMetrics,
      },
    },
  };
}

function buildProfileUpdate({
  name, height, dietType, phoneNumber, profileImage, gender, weightGoalMode, physicalActivityLevel, communityId, timezoneIana,
}) {
  const updateData = {};
  let cleanedPhoneNumber;
  if (name != null) updateData.UserName = name;
  if (height != null) updateData.Height = parseFloat(height);
  if (dietType != null && VALID_DIETS.includes(dietType)) updateData.DietType = dietType;
  if (gender != null && ['Male', 'Female'].includes(gender)) {
    updateData.Gender = gender;
  }
  if (weightGoalMode != null && VALID_GOAL_MODES.includes(weightGoalMode)) {
    updateData.WeightGoalMode = weightGoalMode;
  }
  if (physicalActivityLevel != null && isValidPhysicalActivityLevel(physicalActivityLevel)) {
    updateData.PhysicalActivityLevel = physicalActivityLevel;
  }
  if (communityId !== undefined) updateData.CommunityId = communityId;
  if (timezoneIana !== undefined) updateData.timezone_iana = timezoneIana;
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

function verifySaved(verifyRow, { cleanedPhoneNumber, height, dietType, gender, updateData, communityId, timezoneIana }) {
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
  if (gender != null && updateData.Gender && verifyRow.Gender !== updateData.Gender) {
    throw new Error('Gender was not saved. Please try again.');
  }
  if (communityId !== undefined) {
    const expected = updateData.CommunityId ?? null;
    const saved = verifyRow.CommunityId ?? null;
    if (saved !== expected) throw new Error('Community ID was not saved. Please try again.');
  }
  if (timezoneIana !== undefined) {
    const expected = updateData.timezone_iana;
    const saved = verifyRow.timezone_iana ?? null;
    if (saved !== expected) throw new Error('Timezone was not saved. Please try again.');
  }
}

export async function updateProfile(input) {
  const {
    email, name, height, bmr, dietType, profileImage, phoneNumber, gender,
    weightGoalMode, physicalActivityLevel, communityId, timezoneIana,
  } = input;

  logger.info('[profile/update] incoming request', {
    email,
    receivedCommunityId: communityId !== undefined,
  });
  if (communityId !== undefined) {
    logger.info('[profile/update] CommunityId validation result', {
      email,
      valid: true,
      communityId: communityId ?? null,
    });
  }

  const user = await repo.findByEmail(email, 'UserId');
  if (!user) return notFound();
  const userId = user.UserId;

  const { updateData, cleanedPhoneNumber } = buildProfileUpdate(input);

  let savedPhysicalActivityLevel = null;
  if (physicalActivityLevel != null && isValidPhysicalActivityLevel(physicalActivityLevel)) {
    savedPhysicalActivityLevel = physicalActivityLevel;
  }

  let savedCommunityId;
  if (Object.keys(updateData).length > 0) {
    await repo.updateUserById(userId, updateData);
    logger.info('[profile/update] database update result', {
      userId,
      updatedFields: Object.keys(updateData),
      communityIdSaved: updateData.CommunityId ?? null,
    });
    try { await repo.updateUserById(userId, { LastActiveAt: nowUtc() }); } catch { /* non-fatal */ }
    const verifyRow = await repo.verifyProfile(userId);
    if (!verifyRow) throw new Error(`Unable to verify profile update for UserId ${userId}`);
    verifySaved(verifyRow, { cleanedPhoneNumber, height, dietType, gender, updateData, communityId, timezoneIana });
    if (communityId !== undefined) savedCommunityId = communityId;
  }

  const latestWeightRow = await repo.getLatestWeight(userId);

  let savedBmr = null;
  if (bmr != null) {
    const bmrValue = parseFloat(bmr);
    if (!isNaN(bmrValue) && bmrValue > 0) {
      await repo.updateUserById(userId, { Bmr: bmrValue });
      savedBmr = bmrValue;
    }
  } else {
    const calculatedBmr = computeKatchMcArdleBmr(
      latestWeightRow?.Weight ? parseFloat(latestWeightRow.Weight) : null,
      latestWeightRow?.BodyFat ? parseFloat(latestWeightRow.BodyFat) : null,
    );
    if (calculatedBmr !== null) {
      await repo.updateUserById(userId, { Bmr: calculatedBmr });
      savedBmr = calculatedBmr;
    }
  }

  const profileHeightRow = await repo.findByUserId(userId, '"Height"');
  const effectiveHeight = height != null
    ? parseFloat(height)
    : (profileHeightRow?.Height ? parseFloat(profileHeightRow.Height) : null);
  const derivedGoalMode = deriveWeightGoalMode({
    heightCm: effectiveHeight,
    currentWeightKg: latestWeightRow?.Weight ? parseFloat(latestWeightRow.Weight) : null,
  });
  if (derivedGoalMode) {
    await repo.updateUserById(userId, { WeightGoalMode: derivedGoalMode });
  }

  // Profile → latest Body Parameters Card (direct DB patch — no BPC handler — prevents loops).
  try {
    const dbProfile = await repo.findByUserId(
      userId,
      '"UserName", "Height", "Bmr", "Gender"',
    );
    const cardSync = buildProfileCardSyncPayload(
      {
        name: dbProfile?.UserName ?? name,
        height: dbProfile?.Height != null
          ? parseFloat(dbProfile.Height)
          : (height != null ? parseFloat(height) : null),
        bmr: savedBmr ?? (dbProfile?.Bmr != null ? parseFloat(dbProfile.Bmr) : bmr),
        gender: gender ?? dbProfile?.Gender ?? null,
      },
      { savedBmr, latestWeight: latestWeightRow },
    );

    if (Object.keys(cardSync).length > 0) {
      const syncResult = await repo.syncProfileToLatestBodyParamsCard(userId, cardSync);
      if (syncResult.synced) {
        logger.info('[profile/update] synced to latest body-params card', {
          userId,
          fields: syncResult.fields,
        });
      } else if (syncResult.error) {
        logger.warn('[profile/update] body-params card sync failed (non-fatal)', {
          userId,
          message: syncResult.error,
          attemptedFields: Object.keys(cardSync),
        });
      } else {
        logger.info('[profile/update] body-params card sync skipped', {
          userId,
          attemptedFields: Object.keys(cardSync),
        });
      }
    }
  } catch (syncErr) {
    // Non-fatal — profile fields are already saved; card sync is best-effort.
    logger.error('[profile/update] body-params card sync failed (non-fatal)', {
      userId,
      message: syncErr?.message,
    });
  }

  try { cache.delete(cacheKeys.userProfile(email)); } catch { /* non-fatal */ }

  const refreshedUser = await repo.getProfile(email);
  const effectiveBmr = savedBmr ?? (refreshedUser?.Bmr ? parseFloat(refreshedUser.Bmr) : null);
  const effectiveActivity = savedPhysicalActivityLevel
    ?? refreshedUser?.PhysicalActivityLevel
    ?? null;
  const calorieTarget = resolveCalorieTargetFromProfile({
    bmr: effectiveBmr,
    physicalActivityLevel: effectiveActivity,
  });

  const responseBody = {
    success: true, message: 'User profile updated successfully',
    data: {
      email,
      name: name || undefined,
      height: height ? parseFloat(height) : undefined,
      bmr: savedBmr || undefined,
      dietType: dietType || undefined,
      phoneNumber: cleanedPhoneNumber || undefined,
      gender: gender || undefined,
      weightGoalMode: derivedGoalMode || weightGoalMode || undefined,
      physicalActivityLevel: savedPhysicalActivityLevel || undefined,
      communityId: savedCommunityId !== undefined
        ? savedCommunityId
        : refreshedUser?.CommunityId ?? undefined,
      timezone: resolveProfileTimezone(refreshedUser?.timezone_iana),
      calorieTarget: calorieTarget || undefined,
      profileImageUpdated: !!profileImage,
    },
  };

  logger.info('[profile/update] response sent', {
    email,
    httpStatus: 200,
    communityId: responseBody.data.communityId ?? null,
  });

  return {
    httpStatus: 200,
    body: responseBody,
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
    until: addUtcDays(nowUtc(), 1),
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
