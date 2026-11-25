/**
 * Helpers for the Save-your-website review overview (hours + maps).
 */

const DAY_ORDER = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

const DAY_SHORT = {
  Monday: 'Mon',
  Tuesday: 'Tue',
  Wednesday: 'Wed',
  Thursday: 'Thu',
  Friday: 'Fri',
  Saturday: 'Sat',
  Sunday: 'Sun',
};

function parseHhmm(value) {
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(String(value || '').trim());
  if (!m) return null;
  const h24 = Number(m[1]);
  const minute = Number(m[2]);
  const ampm = h24 >= 12 ? 'PM' : 'AM';
  let hour12 = h24 % 12;
  if (hour12 === 0) hour12 = 12;
  return `${hour12}:${String(minute).padStart(2, '0')} ${ampm}`;
}

/** Compact day range e.g. Mon - Sat, or Mon, Wed, Fri */
export function formatWorkingDaysLabel(workingDays = []) {
  const selected = DAY_ORDER.filter((d) => workingDays.includes(d));
  if (!selected.length) return '';
  if (selected.length === 1) return DAY_SHORT[selected[0]];

  const indexes = selected.map((d) => DAY_ORDER.indexOf(d));
  let contiguous = true;
  for (let i = 1; i < indexes.length; i += 1) {
    if (indexes[i] !== indexes[i - 1] + 1) {
      contiguous = false;
      break;
    }
  }
  if (contiguous) {
    return `${DAY_SHORT[selected[0]]} - ${DAY_SHORT[selected[selected.length - 1]]}`;
  }
  return selected.map((d) => DAY_SHORT[d]).join(', ');
}

export function formatOpeningHoursSummary(timings = {}) {
  const days = formatWorkingDaysLabel(
    Array.isArray(timings.workingDays) ? timings.workingDays : [],
  );
  const open = parseHhmm(timings.openingTime);
  const close = parseHhmm(timings.closingTime);
  if (days && open && close) return `${days}: ${open} – ${close}`;
  if (open && close) return `${open} – ${close}`;
  if (days) return days;
  return '';
}

/** Extract lat,lng from maps.google.com/?q=lat,lng style links. */
export function parseLatLngFromMapsLink(mapsLink) {
  const raw = String(mapsLink || '').trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const q = url.searchParams.get('q') || '';
    const m = /^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/.exec(q);
    if (m) return { lat: Number(m[1]), lng: Number(m[2]) };
  } catch {
    // fall through
  }
  const loose = /(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/.exec(raw);
  if (loose) return { lat: Number(loose[1]), lng: Number(loose[2]) };
  return null;
}

/**
 * Build Google Maps open URL + embed iframe src from form place data.
 * Prefer stored mapsLink / googleBusinessLink; else query from centre + area + city.
 */
export function resolveMapsUrls({
  mapsLink = '',
  googleBusinessLink = '',
  centerName = '',
  locality = '',
  city = '',
  address = '',
} = {}) {
  const coords = parseLatLngFromMapsLink(mapsLink);
  const queryParts = [centerName, locality, city, address].map((s) => String(s || '').trim()).filter(Boolean);
  const query = queryParts.join(', ');

  let openUrl = String(mapsLink || googleBusinessLink || '').trim();
  if (!openUrl && coords) {
    openUrl = `https://www.google.com/maps?q=${coords.lat},${coords.lng}`;
  }
  if (!openUrl && query) {
    openUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  }

  let embedUrl = '';
  if (coords) {
    embedUrl = `https://maps.google.com/maps?q=${coords.lat},${coords.lng}&z=15&output=embed`;
  } else if (query) {
    embedUrl = `https://maps.google.com/maps?q=${encodeURIComponent(query)}&z=15&output=embed`;
  } else if (openUrl && /google\.[^/]*\/maps/i.test(openUrl)) {
    const sep = openUrl.includes('?') ? '&' : '?';
    embedUrl = `${openUrl}${sep}output=embed`;
  }

  return { openUrl, embedUrl, query };
}
