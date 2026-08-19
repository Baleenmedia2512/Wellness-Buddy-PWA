/**
 * bcmDeviceContact.js
 * Save a newly created BCM member to the coach's device contacts.
 * Contact display name: "{name} {venue} {yy/mm/dd}"
 *
 * Native only (Capacitor + @capacitor-community/contacts). Web/PWA no-ops.
 * Never throws to callers — BCM save/share must not fail if contacts are denied.
 */
import { Capacitor } from '@capacitor/core';
import { debugLog } from '../../../shared/utils/logger.js';
import { buildBcmContactDisplayName } from '../domain/bcmContactName.rules.js';

export { buildBcmContactDisplayName, formatBcmContactDate } from '../domain/bcmContactName.rules.js';

function digitsOnlyPhone(phone) {
  const raw = String(phone || '').trim();
  if (!raw) return '';
  const hasPlus = raw.startsWith('+');
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  return hasPlus ? `+${digits}` : digits;
}

/**
 * Persist member phone to device contacts after BCM create for a new team member.
 * @param {{
 *   name?: string|null,
 *   venue?: string|null,
 *   recordedDate?: string|null,
 *   phoneNumber?: string|null,
 * }} opts
 * @returns {Promise<{ ok: boolean, skipped?: boolean, reason?: string }>}
 */
export async function saveBcmMemberToDeviceContacts(opts = {}) {
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
    const { Contacts, PhoneType } = await import('@capacitor-community/contacts');

    const perm = await Contacts.requestPermissions();
    if (perm?.contacts !== 'granted') {
      debugLog('📱 [BCM contact] permission not granted', perm);
      return { ok: false, skipped: true, reason: 'permission' };
    }

    await Contacts.createContact({
      contact: {
        name: { given: displayName },
        phones: [{ type: PhoneType?.Mobile ?? 'mobile', number: phone }],
      },
    });

    debugLog('📱 [BCM contact] saved', { displayName, phone });
    return { ok: true };
  } catch (err) {
    debugLog('📱 [BCM contact] save failed', err?.message || err);
    return { ok: false, skipped: true, reason: err?.message || 'error' };
  }
}
