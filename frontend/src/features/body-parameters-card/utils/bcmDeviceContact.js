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

async function ensureContactsPermission() {
  const { granted } = await PermissionManager.checkPermission('contacts');
  if (granted) return true;
  const { granted: nowGranted } = await PermissionManager.requestPermission('contacts');
  return Boolean(nowGranted);
}

/**
 * Find existing BCM-managed contact ids for this phone (stored id + address-book scan).
 * @param {object} Contacts
 * @param {string} phone
 * @returns {Promise<string[]>}
 */
async function findBcmContactIds(Contacts, phone) {
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
    return { ok: false, skipped: true, reason: 'web' };
  }

  const phone = digitsOnlyPhone(opts.phoneNumber);
  const displayName = buildBcmContactDisplayName({
    name: opts.name,
    venue: opts.venue,
    recordedDate: opts.recordedDate,
  });
  if (!phone || !displayName) {
    return { ok: false, skipped: true, reason: 'missing-fields' };
  }

  try {
    const allowed = await ensureContactsPermission();
    if (!allowed) {
      debugLog('📱 [BCM contact] permission denied — skip save');
      return { ok: false, skipped: true, reason: 'permission' };
    }

    const { Contacts, PhoneType } = await import('@capacitor-community/contacts');
    const existingIds = await findBcmContactIds(Contacts, phone);
    let updated = false;

    for (const contactId of existingIds) {
      try {
        await Contacts.deleteContact({ contactId });
        updated = true;
      } catch (err) {
        debugLog('📱 [BCM contact] delete failed', contactId, err?.message || err);
      }
    }
    if (existingIds.length) clearStoredContactId(phone);

    const { contactId } = await Contacts.createContact({
      contact: {
        name: { given: displayName },
        note: BCM_CONTACT_NOTE,
        phones: [{ type: PhoneType?.Mobile ?? 'mobile', number: phone }],
      },
    });

    if (contactId) writeStoredContactId(phone, contactId);

    debugLog('📱 [BCM contact] upserted', { displayName, phone, updated, contactId });
    return { ok: true, updated };
  } catch (err) {
    debugLog('📱 [BCM contact] upsert failed', err?.message || err);
    return { ok: false, skipped: true, reason: err?.message || 'error' };
  }
}

/** @deprecated Use upsertBcmMemberToDeviceContacts */
export async function saveBcmMemberToDeviceContacts(opts) {
  return upsertBcmMemberToDeviceContacts(opts);
}
