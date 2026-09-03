/**
 * profile.service.js — User feature: profile read/update + lifecycle ops.
 *
 * Owns: GET/UPDATE profile, snooze-profile-pic, delete-account.
 * Preserves response shapes byte-identical to the legacy handlers.
 */
import { cache, cacheKeys } from '../../utils/cache.js';
import logger from '../../shared/lib/logger.js';
import { nowUtc, addUtcDays, utcInstantToLegacyIstWallStorage, IANA_IST } from '../../shared/lib/datetime/index.js';
import { VALID_DIETS, VALID_GOAL_MODES } from './user.validators.js';
import { resolveBmrForDisplay, isValidWeightKg, computeKatchMcArdleBmr } from '../../utils/bmrCalculations.js';
import {
  buildTdeeBreakdown,
  isValidPhysicalActivityLevel,
  resolveCalorieTargetFromProfile,
} from '../../utils/tdeeCalculations.js';
import * as repo from './user.repository.js';
import {
  hasValidProfileName,
  hasValidBodyFatPercent,
  hasValidBodyFatSource,
  isProfileComplete,
} from './domain/profileCompleteness.js';
import { buildProfileCardSyncPayload } from '../body-parameters-card/domain/sync.rules.js';
import { computeBmiFromHeightWeight } from '../body-parameters-card/domain/card.rules.js';
import { getSupabaseClient } from '../../utils/supabaseClient.js';
import { resolveLeadSeatForUser } from '../../utils/coachTeamSeats.js';
import { syncProfileCommunityIdToTeamAssignment } from './communityIdTeamAssignment.service.js';
import { buildTeamFieldsFromProfileCommunityId } from './domain/communityIdTeamAssignment.rules.js';
import { deriveWeightGoalMode } from '../../utils/weightValidation.js';
import { resolveProfileTimezone } from './domain/profileTimezone.js';
import { mapTeamRowToProfileBodyMetrics, mergeProfileBodyMetrics, mapCardToProfileBodyMetrics } from './domain/profileBodyMetrics.rules.js';
import { mapTeamRecoveredHealthIssues } from './domain/recoveredHealthIssues.rules.js';
import {
  hasTransformationPhotoUpdates,
  mapTransformationPhotos,
  mergeTransformationPhotos,
} from './domain/transformationPhotos.rules.js';
import { findLatestLinkedBodyMetricsCard } from '../body-parameters-card/data/card.repo.js';
import { isEnabled } from '../../shared/lib/feature-flags.js';
import { isConsentRecorded } from '../auth/domain/consent.rules.js';
import { resolveSponsorAndIdealCoach } from '../../utils/sponsorCoachResolution.js';
import * as weightRepo from '../weight/weight.repository.js';
import { resolveMarathonWeightComparison } from '../marathon/domain/marathonWeightComparison.service.js';
import { persistAvatarKey, avatarUrlForKey, r2AvatarsEnabled } from './avatar-storage.service.js';

const notFound = () => ({ httpStatus: 404, body: { success: false, message: 'User not found' } });

export async function getProfile({ email, userId = null }) {
  const cacheKey = email
    ? cacheKeys.userProfile(String(email || '').toLowerCase())
    : cacheKeys.userProfile(`id:${userId}`);
  try {
    const cached = cache.get(cacheKey);
    if (cached) return cached;
  } catch { /* non-fatal */ }

  const user = userId
    ? await repo.getProfileByUserId(userId)
    : await repo.getProfile(email);
  if (!user) return notFound();

  const [latestWeight, initialWeightRow, latestBodyMetricsCard, sponsorIdeal, latestWeightBodyFatResolved, teamCodeFields] = await Promise.all([
    repo.getLatestWeight(user.UserId),
    repo.getInitialWeight(user.UserId),
    findLatestLinkedBodyMetricsCard(user.UserId),
    resolveSponsorAndIdealCoach(user.UserId, { viewerUserId: user.UserId }),
    repo.getLatestWeightBodyFat(user.UserId),
    repo.getTeamCodeFields(user.UserId),
  ]);
  const leadSeat = await resolveLeadSeatForUser(getSupabaseClient(), user.UserId);
  const teamId = teamCodeFields?.TeamId || leadSeat.teamId || null;
  const coachTeamId = teamCodeFields?.CoachTeamId || null;
  const teamSeat = leadSeat.seat || null;
  const canClaimTeamCode = !!user.CoachId && !teamId && !teamSeat;
  const cardMetrics = mapCardToProfileBodyMetrics(latestBodyMetricsCard);
  const teamMetrics = mapTeamRowToProfileBodyMetrics(user);
  const cardHeight = latestBodyMetricsCard?.height_cm != null
    ? parseFloat(latestBodyMetricsCard.height_cm)
    : null;
  const height = user.Height
    ? parseFloat(user.Height)
    : (Number.isFinite(cardHeight) ? cardHeight : null);
  const weightFromRecord = latestWeight?.Weight ? parseFloat(latestWeight.Weight) : null;
  const cardWeight = latestBodyMetricsCard?.weight_kg != null
    ? parseFloat(latestBodyMetricsCard.weight_kg)
    : null;
  const latestWeightKg = Number.isFinite(weightFromRecord)
    ? weightFromRecord
    : (Number.isFinite(cardWeight) ? cardWeight : null);
  const initialWeightKg = initialWeightRow?.Weight != null ? parseFloat(initialWeightRow.Weight) : null;
  const latestWeightBodyFat = hasValidBodyFatPercent(latestWeightBodyFatResolved)
    ? latestWeightBodyFatResolved
    : (latestWeight?.BodyFat != null ? parseFloat(latestWeight.BodyFat) : null);
  const resolvedWeightBodyFat = hasValidBodyFatPercent(latestWeightBodyFat) ? latestWeightBodyFat : null;
  const weightBmi = latestWeight?.Bmi != null ? parseFloat(latestWeight.Bmi) : null;
  const bodyMetrics = mergeProfileBodyMetrics({
    cardMetrics,
    teamMetrics,
    weightFatPercent: resolvedWeightBodyFat,
    weightBmi: Number.isFinite(weightBmi) ? weightBmi : null,
  });
  const derivedGoalMode = deriveWeightGoalMode({ heightCm: height, currentWeightKg: latestWeightKg });
  const dietType = user.DietType || null;
  const phoneNumber = user.PhoneNumber || null;
  const bodyGender = bodyMetrics?.gender;
  const gender = user.Gender
    || (bodyGender === 'Male' || bodyGender === 'Female' ? bodyGender : null)
    || null;
  const profileImage = user.ProfileImage || null;
  const resolvedBodyFatForBmr = hasValidBodyFatPercent(resolvedWeightBodyFat)
    ? resolvedWeightBodyFat
    : (bodyMetrics?.fatPercent ?? null);
  const latestBmr = resolveBmrForDisplay({
    storedBmr: user.Bmr,
    weightKg: latestWeightKg,
    bodyFatPercent: resolvedBodyFatForBmr,
    cardWeightKg: latestBodyMetricsCard?.weight_kg,
    cardFatPercent: latestBodyMetricsCard?.fat_percent,
    cardBmr: latestBodyMetricsCard?.bmr,
  });
  const needsBodyFat = !hasValidBodyFatSource({
    latestWeightBodyFat: resolvedWeightBodyFat,
    bodyMetrics,
  });
  const physicalActivityLevel = user.PhysicalActivityLevel || null;
  const calorieTarget = resolveCalorieTargetFromProfile({
    bmr: latestBmr,
    physicalActivityLevel,
  });
  const tdeeBreakdown = buildTdeeBreakdown({ bmr: latestBmr, physicalActivityLevel });
  const sponsorName = sponsorIdeal.sponsorName || null;
  // Backward-compatible alias: coachName remains the direct parent (sponsor).
  const coachName = sponsorName;
  const profileTimezone = resolveProfileTimezone(user.timezone_iana);
  const marathonWeightComparison = await resolveMarathonWeightComparison({
    userId: user.UserId,
    timezoneIana: profileTimezone,
  });

  // Onboarding identity uses team_table.UserName only. A BCM card name must
  // not skip the name gate for users who still have a placeholder login name.
  const persistedUserName = user.UserName;
  const nameComplete = hasValidProfileName(persistedUserName, {
    email: user.Email,
    phoneNumber,
  });
  const resolvedUserName = persistedUserName;

  const result = {
    httpStatus: 200,
    body: {
      success: true,
      data: {
        userId: user.UserId,
        userName: resolvedUserName,
        email: user.Email,
        height, dietType, phoneNumber, gender,
        weightGoalMode: derivedGoalMode || user.WeightGoalMode || 'loss',
        weightGoalModeAuto: derivedGoalMode != null,
        profileComplete: isProfileComplete({
          height,
          dietType,
          phoneNumber,
          userName: resolvedUserName,
          email: user.Email,
          gender,
          bodyMetrics,
          profileImage,
          latestWeightBodyFat: resolvedWeightBodyFat,
          // Body fat lives on weight rows; only require it once a weight exists (or will be collected with weight).
          bodyFatRequired: true,
        }),
        needsName: !nameComplete,
        needsBodyFat,
        // Still prompt to confirm weight when only BCM card has it (no weight row yet).
        needsCurrentWeight: weightFromRecord == null,
        profileImage,
        avatarUrl: (r2AvatarsEnabled() && user.ProfileImageKey)
          ? avatarUrlForKey(user.ProfileImageKey)
          : null,
        coachId: user.CoachId || null,
        coachName,
        sponsorName,
        idealCoachId: sponsorIdeal.idealCoachId || null,
        idealCoachName: sponsorIdeal.idealCoachName || null,
        teamId,
        coachTeamId,
        teamSeat,
        canClaimTeamCode,
        profilePicSnooze: user.profile_pic_snooze || null,
        latestWeight: latestWeightKg,
        initialWeight: Number.isFinite(initialWeightKg) ? initialWeightKg : null,
        initialWeightDate: initialWeightRow?.CreatedAt || null,
        latestWeightBodyFat: resolvedWeightBodyFat,
        bodyFat: resolvedWeightBodyFat,
        latestBmr,
        physicalActivityLevel,
        communityId: user.CommunityId ?? null,
        timezone: profileTimezone,
        consentAccepted: isConsentRecorded(user),
        consentRequired: isEnabled('ff.consent-gate') && !isConsentRecorded(user),
        consentVersion: user.ConsentVersion || null,
        calorieTarget,
        tdeeBreakdown,
        weightRecordDate: latestWeight?.CreatedAt || null,
        marathonWeightComparison,
        bodyMetrics,
        recoveredHealthIssues: mapTeamRecoveredHealthIssues(user.recovered_health_issues),
        transformationPhotos: mapTransformationPhotos(user.transformation_photos),
      },
    },
  };

  // Short TTL — profile is also cached client-side; update path already deletes this key
  try { cache.set(cacheKey, result, 60_000); } catch { /* non-fatal */ }
  return result;
}

function buildProfileUpdate({
  name, height, dietType, phoneNumber, profileImage, gender, weightGoalMode, physicalActivityLevel, communityId, timezoneIana,
  age, visceralFat, bodyAge, chestCm, waistCm, hipCm, recoveredHealthIssues,
  transformationPhotos, existingTransformationPhotos,
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
  if (age !== undefined) updateData.Age = age;
  if (visceralFat !== undefined) updateData.VisceralFat = visceralFat;
  if (bodyAge !== undefined) updateData.BodyAge = bodyAge;
  if (chestCm !== undefined) updateData.ChestCm = chestCm;
  if (waistCm !== undefined) updateData.WaistCm = waistCm;
  if (hipCm !== undefined) updateData.HipCm = hipCm;
  if (recoveredHealthIssues !== undefined) {
    updateData.recovered_health_issues = Array.isArray(recoveredHealthIssues)
      ? recoveredHealthIssues
      : [];
  }
  if (hasTransformationPhotoUpdates(transformationPhotos)) {
    updateData.transformation_photos = mergeTransformationPhotos(
      existingTransformationPhotos,
      transformationPhotos,
    );
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
    weightGoalMode, physicalActivityLevel, communityId, timezoneIana, bodyFat,
    currentWeight, transformationPhotos,
  } = input;

  logger.info('[profile/update] incoming request', {
    email,
    receivedCommunityId: communityId !== undefined,
    receivedBodyFat: bodyFat !== undefined,
    receivedCurrentWeight: currentWeight !== undefined,
  });
  if (communityId !== undefined) {
    logger.info('[profile/update] CommunityId validation result', {
      email,
      valid: true,
      communityId: communityId ?? null,
    });
  }

  let user;
  try {
    user = await repo.findByEmail(email, 'UserId, transformation_photos');
  } catch (err) {
    const msg = String(err?.message || err || '');
    if (!/transformation_photos/i.test(msg)) throw err;
    user = await repo.findByEmail(email, 'UserId');
  }
  if (!user) return notFound();
  const userId = user.UserId;

  const { updateData, cleanedPhoneNumber } = buildProfileUpdate({
    ...input,
    existingTransformationPhotos: user.transformation_photos,
  });

  const teamFieldsFromCommunityId = buildTeamFieldsFromProfileCommunityId(communityId);
  if (teamFieldsFromCommunityId) {
    Object.assign(updateData, teamFieldsFromCommunityId);
  }

  let savedPhysicalActivityLevel = null;
  if (physicalActivityLevel != null && isValidPhysicalActivityLevel(physicalActivityLevel)) {
    savedPhysicalActivityLevel = physicalActivityLevel;
  }

  const transformationPhotosPatch = updateData.transformation_photos !== undefined
    ? { transformation_photos: updateData.transformation_photos }
    : null;
  if (transformationPhotosPatch) {
    delete updateData.transformation_photos;
  }

  let savedCommunityId;
  if (Object.keys(updateData).length > 0) {
    await repo.updateUserById(userId, updateData);
    logger.info('[profile/update] database update result', {
      userId,
      updatedFields: Object.keys(updateData),
      communityIdSaved: updateData.CommunityId ?? null,
      teamIdSaved: updateData.TeamId ?? null,
      coachTeamIdSaved: updateData.CoachTeamId ?? null,
    });
    if (updateData.ProfileImage) {
      await persistAvatarKey(userId, updateData.ProfileImage);
    }
    try { await repo.updateUserById(userId, { LastActiveAt: nowUtc() }); } catch { /* non-fatal */ }
    const verifyRow = await repo.verifyProfile(userId);
    if (!verifyRow) throw new Error(`Unable to verify profile update for UserId ${userId}`);
    verifySaved(verifyRow, { cleanedPhoneNumber, height, dietType, gender, updateData, communityId, timezoneIana });
    if (communityId !== undefined) savedCommunityId = communityId;
  }

  if (transformationPhotosPatch) {
    try {
      await repo.updateUserById(userId, transformationPhotosPatch);
    } catch (photoErr) {
      const msg = String(photoErr?.message || photoErr || '');
      if (!/transformation_photos|column/i.test(msg)) throw photoErr;
      logger.warn('[profile/update] transformation_photos column missing; skipped', { userId });
    }
  }

  let latestWeightRow = await repo.getLatestWeight(userId);
  const latestBodyMetricsCard = await findLatestLinkedBodyMetricsCard(userId);

  // Body fat + current weight both live on weight_records_table (same row). Never team_table.
  const incomingBodyFat = bodyFat !== undefined && hasValidBodyFatPercent(bodyFat)
    ? parseFloat(bodyFat)
    : null;
  const incomingWeight = currentWeight !== undefined && currentWeight !== null && isValidWeightKg(currentWeight)
    ? parseFloat(currentWeight)
    : null;

  let savedBodyFat = incomingBodyFat;
  let savedCurrentWeight = null;

  if (incomingWeight != null && !latestWeightRow?.ID) {
    const profileHeightRow = height == null
      ? await repo.findByUserId(userId, '"Height"')
      : null;
    const effectiveHeightForBmi = height != null
      ? parseFloat(height)
      : (profileHeightRow?.Height ? parseFloat(profileHeightRow.Height) : null);
    const bmi = computeBmiFromHeightWeight(effectiveHeightForBmi, incomingWeight);
    const weightBmr = computeKatchMcArdleBmr(incomingWeight, incomingBodyFat);
    const wallNow = utcInstantToLegacyIstWallStorage(nowUtc(), IANA_IST);
    try {
      const inserted = await weightRepo.insertEntry({
        UserId: parseInt(userId, 10),
        Weight: incomingWeight,
        Bmi: bmi,
        BodyFat: incomingBodyFat,
        Bmr: weightBmr,
        CreatedAt: wallNow,
        UpdatedAt: wallNow,
      });
      latestWeightRow = {
        ID: inserted?.ID,
        Weight: incomingWeight,
        BodyFat: incomingBodyFat,
        Bmi: bmi,
        Bmr: weightBmr,
        CreatedAt: wallNow,
      };
      savedCurrentWeight = incomingWeight;
      savedBodyFat = incomingBodyFat;
      if (weightBmr != null) {
        await repo.updateUserById(userId, { Bmr: weightBmr });
      }
      logger.info('[profile/update] created weight record (Weight + BodyFat)', {
        userId,
        weightId: inserted?.ID,
        weightKg: incomingWeight,
        bodyFat: incomingBodyFat,
      });
    } catch (weightErr) {
      logger.error('[profile/update] failed to save weight record', {
        userId,
        message: weightErr?.message,
      });
      throw weightErr;
    }
  } else if (incomingBodyFat != null && latestWeightRow?.ID) {
    // Weight already exists — attach body fat onto that same latest record.
    const weightKg = latestWeightRow.Weight ? parseFloat(latestWeightRow.Weight) : null;
    const weightBmr = weightKg != null
      ? computeKatchMcArdleBmr(weightKg, incomingBodyFat)
      : null;
    const updated = await repo.updateLatestWeightBodyFat(userId, incomingBodyFat, weightBmr);
    if (updated) {
      savedBodyFat = incomingBodyFat;
      latestWeightRow = {
        ...latestWeightRow,
        BodyFat: incomingBodyFat,
        Bmr: weightBmr ?? latestWeightRow.Bmr ?? null,
      };
      if (weightBmr != null) {
        await repo.updateUserById(userId, { Bmr: weightBmr });
      }
      logger.info('[profile/update] saved BodyFat on existing weight record', {
        userId,
        weightId: updated.ID,
        bodyFat: incomingBodyFat,
      });
    }
    if (incomingWeight != null) {
      savedCurrentWeight = parseFloat(latestWeightRow.Weight);
      logger.info('[profile/update] currentWeight ignored; weight record already exists', {
        userId,
        existingWeightId: latestWeightRow.ID,
      });
    }
  } else if (incomingBodyFat != null && !latestWeightRow?.ID) {
    logger.warn('[profile/update] bodyFat ignored; no weight record to attach it to', {
      userId,
      bodyFat: incomingBodyFat,
    });
    savedBodyFat = null;
  } else if (latestWeightRow?.BodyFat != null) {
    const existing = parseFloat(latestWeightRow.BodyFat);
    if (hasValidBodyFatPercent(existing)) savedBodyFat = existing;
  }

  let savedBmr = null;
  if (bmr != null) {
    const bmrValue = parseFloat(bmr);
    if (!isNaN(bmrValue) && bmrValue > 0) {
      await repo.updateUserById(userId, { Bmr: bmrValue });
      savedBmr = bmrValue;
    }
  } else {
    const calculatedBmr = resolveBmrForDisplay({
      storedBmr: null,
      weightKg: latestWeightRow?.Weight ? parseFloat(latestWeightRow.Weight) : null,
      bodyFatPercent: savedBodyFat
        ?? (latestWeightRow?.BodyFat ? parseFloat(latestWeightRow.BodyFat) : null),
      cardWeightKg: latestBodyMetricsCard?.weight_kg,
      cardFatPercent: latestBodyMetricsCard?.fat_percent,
      cardBmr: latestBodyMetricsCard?.bmr,
    });
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

  let teamCodeSync = null;
  try {
    const teamRow = await repo.getTeamCodeFields(userId);
    const communityIdInRequest = communityId !== undefined;
    const communityForSync = communityIdInRequest
      ? communityId
      : (teamRow?.CommunityId ?? null);
    teamCodeSync = await syncProfileCommunityIdToTeamAssignment(userId, communityForSync, {
      communityIdExplicitlyUpdated: communityIdInRequest,
    });
  } catch (syncErr) {
    logger.error('[profile/update] Community ID team assignment failed', {
      userId,
      message: syncErr?.message,
    });
    throw syncErr;
  }

  try { cache.delete(cacheKeys.userProfile(String(email || '').toLowerCase())); } catch { /* non-fatal */ }

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
      bodyFat: savedBodyFat || undefined,
      currentWeight: savedCurrentWeight || undefined,
      teamId: teamCodeSync?.teamId || undefined,
      teamSeat: teamCodeSync?.teamSeat || undefined,
      coachTeamId: teamCodeSync?.coachTeamId || undefined,
      teamCodeSynced: !!(teamCodeSync?.synced),
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
    cache.delete(cacheKeys.userProfile(String(email || '').toLowerCase()));
    cache.delete(cacheKeys.userContext(user.UserId));
    cache.delete(cacheKeys.userContext(user.UserId.toString()));
  } catch { /* non-fatal */ }

  return { httpStatus: 200, body: { success: true, message: 'Account and all associated data have been permanently deleted.' } };
}
