/**
 * bcmDeviceContact.js
 * Create or overwrite coach device contacts for BCM members.
 * Display name: "{name} {venueShort}{yymmdd}" e.g. "praveen slc260820"
 *
 * Plugin has no updateContact — overwrite = delete prior BCM contact + create.
 * Only deletes contacts we created (stored id / note marker / BCM name pattern).
 *
 * Permission: prefer app-entry grant; else request on save; denial skips quietly.
 * Never blocks WhatsApp share.
 */
import { Capacitor } from '@capacitor/core';
import { Contacts, PhoneType } from '@capacitor-community/contacts';
import { debugLog } from '../../../shared/utils/logger.js';
import { buildBcmContactDisplayName } from '../domain/bcmContactName.rules.js';
import { normalizePhoneDigits, phonesMatch } from '../domain/bcmContactPhone.rules.js';
import * as PermissionManager from '../../../shared/services/permissionManager.js';

export { buildBcmContactDisplayName, formatBcmContactDate } from '../domain/bcmContactName.rules.js';
export { normalizePhoneDigits, phonesMatch } from '../domain/bcmContactPhone.rules.js';

const BCM_CONTACT_NOTE = 'Wellness Valley BCM';
const CONTACT_ID_PREFIX = 'wv.bcm.contactId.';

/** Trailing yymmdd (new) or yy/mm/dd (legacy) used in BCM contact display names. */
const BCM_NAME_DATE_RE = /(?:\d{6}|\d{2}\/\d{2}\/\d{2})\s*$/;

function contactIdStorageKey(phone) {
  const digits = normalizePhoneDigits(phone);
  const key = digits.length >= 10 ? digits.slice(-10) : digits;
  return key ? `${CONTACT_ID_PREFIX}${key}` : null;
}

function readStoredContactId(phone) {
  try {
    const key = contactIdStorageKey(phone);
    if (!key || typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key) || null;
  } catch {
    return null;
  }
}

function writeStoredContactId(phone, contactId) {
  try {
    const key = contactIdStorageKey(phone);
    if (!key || !contactId || typeof localStorage === 'undefined') return;
    localStorage.setItem(key, contactId);
  } catch {
    /* ignore quota / private mode */
  }
}

function clearStoredContactId(phone) {
  try {
    const key = contactIdStorageKey(phone);
    if (!key || typeof localStorage === 'undefined') return;
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

function digitsOnlyPhone(phone) {
  const raw = String(phone || '').trim();
  if (!raw) return '';
  const hasPlus = raw.startsWith('+');
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  return hasPlus ? `+${digits}` : digits;
}

function contactDisplayName(contact) {
  return String(
    contact?.name?.display
    || contact?.name?.given
    || '',
  ).trim();
}

function looksLikeBcmContact(contact) {
  const note = String(contact?.note || '');
  if (note.includes(BCM_CONTACT_NOTE)) return true;
  return BCM_NAME_DATE_RE.test(contactDisplayName(contact));
}

/**
 * TEMP debug (OPPO F29 Pro): show createContact failure on device screen.
 * Remove once the OEM Contacts issue is diagnosed.
 */
function showBcmContactSaveFailedAlert(details) {
  try {
    const text = typeof details === 'string'
      ? details
      : Object.entries(details || {})
        .filter(([, v]) => v != null && v !== '')
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n');
    // eslint-disable-next-line no-alert -- temporary BCM contact debug on OPPO F29 Pro
    window.alert(`BCM Contact Save Failed\n\n${text || '(no details)'}`);
  } catch {
    /* ignore alert failures */
  }
}

/** Pull message/code from Capacitor / plugin Error shapes. */
function formatCreateContactError(err) {
  const message = err?.message || String(err);
  const code = err?.code ?? err?.errorCode ?? err?.error_code ?? null;
  let raw = '';
  try {
    raw = JSON.stringify(err, Object.getOwnPropertyNames(err || {}));
  } catch {
    raw = String(err);
  }
  return {
    message,
    code: code != null ? String(code) : '(none)',
    name: err?.name || '(none)',
    raw,
  };
}

/**
 * Best-effort OS prompt. Always call createContact afterward — native plugin
 * also requests permission when needed. Do not gate only on canRequest
 * (Android first-install often reports denied).
 */
async function ensureContactsPermission() {
  const nativeOk = await PermissionManager.isContactsNativeAvailable();
  if (!nativeOk) {
    return false;
  }
  const { granted, status } = await PermissionManager.checkPermission('contacts');
  if (granted || status === 'limited') return true;
  const { granted: nowGranted, status: nowStatus } = await PermissionManager.requestPermission('contacts');
  return Boolean(nowGranted || nowStatus === 'limited');
}

/**
 * Find existing BCM-managed contact ids for this phone (stored id + address-book scan).
 * @param {string} phone
 * @returns {Promise<string[]>}
 */
async function findBcmContactIds(phone) {
  const ids = new Set();
  const stored = readStoredContactId(phone);
  if (stored) ids.add(stored);

  try {
    const { contacts } = await Contacts.getContacts({
      projection: { name: true, phones: true, note: true },
    });
    for (const c of contacts || []) {
      if (!c?.contactId) continue;
      const phoneHit = (c.phones || []).some((p) => phonesMatch(p?.number, phone));
      if (!phoneHit) continue;
      if (looksLikeBcmContact(c) || (stored && c.contactId === stored)) {
        ids.add(c.contactId);
      }
    }
  } catch (err) {
    debugLog('📱 [BCM contact] getContacts failed', err?.message || err);
  }

  return [...ids];
}

/**
 * Create or overwrite device contact for a BCM member (venue/name/date changes).
 * @param {{
 *   name?: string|null,
 *   venue?: string|null,
 *   recordedDate?: string|null,
 *   phoneNumber?: string|null,
 * }} opts
 * @returns {Promise<{ ok: boolean, skipped?: boolean, reason?: string, updated?: boolean }>}
 */
export async function upsertBcmMemberToDeviceContacts(opts = {}) {
  if (!Capacitor.isNativePlatform()) {
    console.warn('[BCM contact] skipped — not a native app (web)');
    return { ok: false, skipped: true, reason: 'web' };
  }

  const phone = digitsOnlyPhone(opts.phoneNumber);
  const displayName = buildBcmContactDisplayName({
    name: opts.name,
    venue: opts.venue,
    recordedDate: opts.recordedDate,
  });
  if (!phone || !displayName) {
    console.warn('[BCM contact] skipped — missing phone or display name', {
      hasPhone: Boolean(phone),
      hasName: Boolean(displayName),
    });
    return { ok: false, skipped: true, reason: 'missing-fields' };
  }

  try {
    const nativeOk = await PermissionManager.isContactsNativeAvailable();
    if (!nativeOk) {
      console.error(
        '[BCM contact] Native Contacts plugin missing — rebuild iOS after: npx cap sync ios && pod install',
      );
      return { ok: false, skipped: true, reason: 'plugin-missing' };
    }

    // Prompt when possible; still attempt createContact (native re-requests).
    const allowed = await ensureContactsPermission();
    if (!allowed) {
      console.warn(
        '[BCM contact] Contacts not granted — enable in Settings → Wellness Valley → Contacts',
      );
    }

    const existingIds = await findBcmContactIds(phone);
    let updated = false;

    for (const contactId of existingIds) {
      try {
        await Contacts.deleteContact({ contactId });
        updated = true;
      } catch (err) {
        console.warn('[BCM contact] delete failed', contactId, err?.message || err);
      }
    }
    if (existingIds.length) clearStoredContactId(phone);

    let createResult;
    try {
      createResult = await Contacts.createContact({
        contact: {
          name: { given: displayName },
          note: BCM_CONTACT_NOTE,
          phones: [{ type: PhoneType?.Mobile ?? 'mobile', number: phone }],
        },
      });
    } catch (createErr) {
      const formatted = formatCreateContactError(createErr);
      console.warn('[BCM contact] upsert failed', formatted.message, formatted);
      debugLog('📱 [BCM contact] upsert failed', formatted);
      showBcmContactSaveFailedAlert({
        platform: Capacitor.getPlatform(),
        permissionGranted: allowed,
        message: formatted.message,
        code: formatted.code,
        name: formatted.name,
        raw: formatted.raw,
      });
      const denied = /permission|denied|not authorized|access/i.test(formatted.message);
      return {
        ok: false,
        skipped: true,
        reason: denied ? 'permission' : (formatted.message || 'error'),
      };
    }

    const contactId = createResult?.contactId;
    if (!contactId) {
      console.warn('[BCM contact] createContact returned no contactId', {
        displayName,
        phoneTail: phone.slice(-4),
        permissionGranted: allowed,
        createResult,
      });
      let rawResult = '';
      try {
        rawResult = JSON.stringify(createResult ?? null);
      } catch {
        rawResult = String(createResult);
      }
      showBcmContactSaveFailedAlert({
        platform: Capacitor.getPlatform(),
        permissionGranted: allowed,
        message: 'createContact returned no contactId',
        code: '(none)',
        raw: rawResult,
      });
      return {
        ok: false,
        skipped: true,
        reason: allowed ? 'create-failed' : 'permission',
      };
    }

    writeStoredContactId(phone, contactId);

    console.warn('[BCM contact] saved', {
      displayName,
      phoneTail: phone.slice(-4),
      updated,
      contactId,
      permissionGranted: allowed,
    });
    debugLog('📱 [BCM contact] upserted', { displayName, phone, updated, contactId });
    return { ok: true, updated };
  } catch (err) {
    const formatted = formatCreateContactError(err);
    console.warn('[BCM contact] upsert failed', formatted.message, formatted);
    debugLog('📱 [BCM contact] upsert failed', formatted);
    showBcmContactSaveFailedAlert({
      platform: Capacitor.getPlatform(),
      message: formatted.message,
      code: formatted.code,
      name: formatted.name,
      raw: formatted.raw,
    });
    const denied = /permission|denied|not authorized|access/i.test(formatted.message);
    return {
      ok: false,
      skipped: true,
      reason: denied ? 'permission' : (formatted.message || 'error'),
    };
  }
}

/** @deprecated Use upsertBcmMemberToDeviceContacts */
export async function saveBcmMemberToDeviceContacts(opts) {
  return upsertBcmMemberToDeviceContacts(opts);
}
