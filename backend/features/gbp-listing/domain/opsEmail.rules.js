/**
 * Ops notification email for a submitted GBP request.
 */

/**
 * @param {object} req toPublicGbpRequest shape + optional mediaFolderKey
 * @returns {{ subject: string, text: string }}
 */
export function buildGbpOpsEmail(req = {}) {
  const id = req.id || '?';
  const name = String(req.businessName || 'Untitled').trim() || 'Untitled';
  const city = String(req.city || '').trim();
  const subject = `GBP request #${id} — ${name}${city ? ` — ${city}` : ''}`;

  const lines = [
    'A coach submitted a Google Maps Listing request.',
    '',
    `Request ID: ${id}`,
    `Coach UserId: ${req.userId ?? ''}`,
    `Coach name: ${req.userName || ''}`,
    `Center ID: ${req.centerId ?? ''}`,
    `Center name: ${req.centerName || ''}`,
    '',
    `Business name: ${name}`,
    `Category: ${req.primaryCategory || ''}`,
    `Phone: ${req.phone || ''}`,
    `WhatsApp: ${req.whatsapp || ''}`,
    `Website: ${req.websiteUrl || ''}`,
    '',
    `Street: ${req.streetAddress || ''}`,
    `Landmark: ${req.landmark || ''}`,
    `Area: ${req.area || ''}`,
    `City: ${req.city || ''}`,
    `State: ${req.state || ''}`,
    `PIN: ${req.pincode || ''}`,
    `Show address: ${req.showAddress === false ? 'No' : 'Yes'}`,
    '',
    `Hours: ${(req.workingDays || []).join(', ') || '—'}`,
    `Open: ${req.openingTime || '—'}  Close: ${req.closingTime || '—'}`,
    `Weekly holiday: ${req.weeklyHoliday || '—'}`,
    '',
    `Description: ${req.description || '—'}`,
    '',
    `Media folder: ${req.mediaFolderKey || ''}`,
    `Photos: ${req.photoCount ?? (req.mediaFiles || []).filter((f) => f.kind === 'photo').length}`,
    `Files: ${(req.mediaFiles || []).length}`,
    '',
    'Open the admin Google Maps Listing queue in the app to mark In progress / Live.',
  ];

  return { subject, text: lines.join('\n') };
}

/**
 * @param {string|undefined|null} envValue process.env.GBP_LISTING_OPS_EMAIL
 * @returns {string[]}
 */
export function parseOpsEmailList(envValue) {
  return String(envValue || '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.includes('@'));
}
