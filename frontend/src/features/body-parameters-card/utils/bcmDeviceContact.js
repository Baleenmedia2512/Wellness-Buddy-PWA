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
import BcmContacts from '../../../shared/plugins/bcmContactsPlugin.js';

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
 * Android: OEM-safe native insert. iOS: community Contacts plugin.
 */
async function createBcmDeviceContact({ displayName, phone }) {
  if (Capacitor.getPlatform() === 'android') {
    return BcmContacts.createContact({
      displayName,
      phone,
      note: BCM_CONTACT_NOTE,
    });
  }
  return Contacts.createContact({
    contact: {
      name: { given: displayName },
      note: BCM_CONTACT_NOTE,
      phones: [{ type: PhoneType?.Mobile ?? 'mobile', number: phone }],
    },
  });
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
    if (!nativeOk && Capacitor.getPlatform() !== 'android') {
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
    let updated = existingIds.length > 0;

    let createResult;
    try {
      createResult = await createBcmDeviceContact({ displayName, phone });
    } catch (createErr) {
      const formatted = formatCreateContactError(createErr);
      console.warn('[BCM contact] upsert failed', formatted.message, formatted);
      debugLog('📱 [BCM contact] upsert failed', formatted);
      const denied = /permission|denied|not authorized|access|WRITE_CONTACTS/i.test(formatted.message);
      return {
        ok: false,
        skipped: true,
        reason: denied ? 'permission' : (formatted.message || 'error'),
      };
    }

    if (createResult?.openedEditor) {
      console.warn('[BCM contact] opened system contact editor', {
        displayName,
        phoneTail: phone.slice(-4),
        permissionGranted: allowed,
      });
      return { ok: true, updated, openedEditor: true };
    }

    const contactId = createResult?.contactId;
    if (!contactId) {
      console.warn('[BCM contact] createContact returned no contactId', {
        displayName,
        phoneTail: phone.slice(-4),
        permissionGranted: allowed,
        createResult,
      });
      return {
        ok: false,
        skipped: true,
        reason: allowed ? 'create-failed' : 'permission',
      };
    }

    for (const oldId of existingIds) {
      if (String(oldId) === String(contactId)) continue;
      try {
        await Contacts.deleteContact({ contactId: oldId });
      } catch (err) {
        console.warn('[BCM contact] delete failed', oldId, err?.message || err);
      }
    }
    if (existingIds.length) clearStoredContactId(phone);
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
    const denied = /permission|denied|not authorized|access|WRITE_CONTACTS/i.test(formatted.message);
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
