/**
 * Client consent constants — must match backend/features/auth/domain/consent.rules.js
 */
import { Capacitor } from '@capacitor/core';
import storage from '../../../shared/lib/storage.js';

export const CURRENT_CONSENT_VERSION = '2026-07-31';

const STORAGE_KEY = 'consent.acceptedVersion';

export function getStoredConsentVersion() {
  try {
    return storage.get(STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

export function hasLocalConsentAcceptance() {
  return getStoredConsentVersion() === CURRENT_CONSENT_VERSION;
}

export function persistLocalConsentAcceptance(version = CURRENT_CONSENT_VERSION) {
  storage.set(STORAGE_KEY, version);
}

export function clearLocalConsentAcceptance() {
  try {
    storage.remove(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** Platform + UA snapshot for consent audit (IP is captured server-side). */
export function buildClientDeviceInfo() {
  let platform = 'web';
  try {
    platform = Capacitor.getPlatform?.() || 'web';
  } catch {
    platform = 'web';
  }
  const ua = typeof navigator !== 'undefined' ? (navigator.userAgent || '') : '';
  return `${platform}; ${ua}`.trim().slice(0, 500);
}

export function consentPayload() {
  if (!hasLocalConsentAcceptance()) {
    return { consentAccepted: false, consentVersion: '', deviceInfo: buildClientDeviceInfo() };
  }
  return {
    consentAccepted: true,
    consentVersion: CURRENT_CONSENT_VERSION,
    deviceInfo: buildClientDeviceInfo(),
  };
}
