/**
 * consent.service.js — Persist User Consent Form acceptance for existing users.
 */
import { isEnabled } from '../../shared/lib/feature-flags.js';
import { nowUtc } from '../../shared/lib/datetime/index.js';
import {
  CONSENT_DECLINED_MESSAGE,
  CONSENT_REQUIRED_MESSAGE,
  CURRENT_CONSENT_VERSION,
  consentInsertFields,
  hasValidConsentAcceptance,
  isConsentRecorded,
} from '../auth/domain/consent.rules.js';
import * as repo from './user.repository.js';

/**
 * Whether the given user still needs to accept the current consent form.
 */
export async function getConsentStatus({ userId, email }) {
  if (!isEnabled('ff.consent-gate')) {
    return {
      httpStatus: 200,
      body: { success: true, consentRequired: false, consentAccepted: true, skipped: true },
    };
  }

  let row = null;
  if (userId) {
    row = await repo.findByUserId(
      userId,
      '"UserId", "Email", "ConsentAcceptedAt", "ConsentVersion"',
    );
  }
  if (!row && email) {
    row = await repo.findByEmail(
      email,
      '"UserId", "Email", "ConsentAcceptedAt", "ConsentVersion"',
    );
  }
  if (!row) {
    return { httpStatus: 404, body: { success: false, message: 'User not found' } };
  }

  const accepted = isConsentRecorded(row);
  return {
    httpStatus: 200,
    body: {
      success: true,
      consentAccepted: accepted,
      consentRequired: !accepted,
      consentVersion: row.ConsentVersion || null,
    },
  };
}

/**
 * If a newly identified user declines consent, remove the account that has
 * never accepted consent (no ConsentAcceptedAt). Existing consented users
 * cannot be deleted through this path.
 */
export async function discardUnconsentedUser({ userId, email }) {
  if (!isEnabled('ff.consent-gate')) {
    return { httpStatus: 200, body: { success: true, skipped: true } };
  }

  let row = null;
  if (userId) {
    row = await repo.findByUserId(
      userId,
      '"UserId", "Email", "PhoneNumber", "ConsentAcceptedAt"',
    );
  }
  if (!row && email) {
    row = await repo.findByEmail(
      email,
      '"UserId", "Email", "PhoneNumber", "ConsentAcceptedAt"',
    );
  }
  if (!row) {
    return { httpStatus: 404, body: { success: false, message: 'User not found' } };
  }

  if (isConsentRecorded(row)) {
    return {
      httpStatus: 403,
      body: {
        success: false,
        message: 'Consent already recorded. Use account deletion to remove the account.',
        code: 'CONSENT_ALREADY_RECORDED',
      },
    };
  }

  const emailForPurge = row.Email || email || `user-${row.UserId}@discard.local`;
  await repo.purgeUserData(row.UserId, emailForPurge);
  await repo.deleteTeamRow(row.UserId);

  return {
    httpStatus: 200,
    body: { success: true, discarded: true, userId: row.UserId },
  };
}

export async function recordConsent({
  userId, email, consentAccepted, consentVersion, ipAddress, deviceInfo,
}) {
  if (!isEnabled('ff.consent-gate')) {
    return { httpStatus: 200, body: { success: true, skipped: true } };
  }

  if (consentAccepted === false) {
    return {
      httpStatus: 403,
      body: {
        success: false,
        message: CONSENT_DECLINED_MESSAGE,
        code: 'CONSENT_DECLINED',
      },
    };
  }

  if (!hasValidConsentAcceptance({ consentAccepted, consentVersion })) {
    return {
      httpStatus: 400,
      body: {
        success: false,
        message: CONSENT_REQUIRED_MESSAGE,
        code: 'CONSENT_REQUIRED',
        expectedVersion: CURRENT_CONSENT_VERSION,
      },
    };
  }

  let row = null;
  if (userId) {
    row = await repo.findByUserId(userId, '"UserId", "Email", "ConsentAcceptedAt"');
  }
  if (!row && email) {
    row = await repo.findByEmail(email, '"UserId", "Email", "ConsentAcceptedAt"');
  }
  if (!row) {
    return { httpStatus: 404, body: { success: false, message: 'User not found' } };
  }

  const acceptedAt = nowUtc();
  const fields = consentInsertFields(acceptedAt, {
    version: consentVersion,
    ipAddress,
    deviceInfo,
  });
  await repo.updateUserById(row.UserId, fields);

  return {
    httpStatus: 200,
    body: {
      success: true,
      consentAccepted: true,
      consentVersion,
      consentAcceptedAt: acceptedAt,
    },
  };
}
