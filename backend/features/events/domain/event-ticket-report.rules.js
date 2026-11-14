/**
 * Ticket QR lifecycle and the host ticket report. No I/O.
 * A code is allowed once, then entry-only is closed, then food closes it.
 * The event end (or cancellation, or a returned credit) expires every remaining code.
 * Attendance follows the entry stamp: a scanned guest is Attended.
 */

function scheduleOf(event) {
  const raw = Array.isArray(event?.eventDates) ? event.eventDates : [];
  const dates = raw
    .map((item) => {
      const date = String(item?.date || item?.eventDate || '').slice(0, 10);
      const endMatch = /^(\d{2}):(\d{2})/.exec(String(item?.endTime || '').trim());
      return {
        date,
        endTime: endMatch ? `${endMatch[1]}:${endMatch[2]}` : null,
      };
    })
    .filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item.date));
  if (dates.length === 0) {
    const date = String(event?.eventDate || '').slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const endMatch = /^(\d{2}):(\d{2})/.exec(String(event?.endTime || '').trim());
      dates.push({
        date,
        endTime: endMatch ? `${endMatch[1]}:${endMatch[2]}` : null,
      });
    }
  }
  dates.sort((a, b) => a.date.localeCompare(b.date));
  return dates;
}

/** 'cancelled' | 'ended' | null. `now` is { date: 'YYYY-MM-DD', time: 'HH:mm' } in IST. */
export function eventQrExpiredReason(event, now) {
  const status = String(event?.status || '').toLowerCase();
  if (status === 'cancelled') return 'cancelled';
  const dates = scheduleOf(event);
  if (dates.length === 0 || !now?.date) return null;
  const last = dates[dates.length - 1];
  const endTime = last.endTime || '23:59';
  if (now.date > last.date) return 'ended';
  if (now.date === last.date && String(now.time || '00:00') > endTime) return 'ended';
  return null;
}

function paymentStatus(registration) {
  return String(registration?.paymentStatus || '').toLowerCase();
}

function hasTicketCode(registration) {
  return Boolean(String(registration?.entryCode || '').trim());
}

export function registrationIsSoldTicket(registration) {
  if (!hasTicketCode(registration)) return false;
  return paymentStatus(registration) !== 'refunded';
}

/**
 * Whether this scan may proceed.
 * @returns {{ allow: true } | { allow: false, message: string }}
 */
export function ticketScanDecision({ event, registration, checkInType, now }) {
  const kind = checkInType === 'food' ? 'food' : 'entry';
  const expired = eventQrExpiredReason(event, now);
  if (expired === 'cancelled') {
    return { allow: false, message: 'This QR has expired. The event is cancelled.' };
  }
  if (expired === 'ended') {
    return { allow: false, message: 'This QR has expired. The event has ended.' };
  }
  if (paymentStatus(registration) === 'refunded') {
    return { allow: false, message: 'This QR has expired. The ticket credit was returned.' };
  }
  if (!hasTicketCode(registration)) {
    return { allow: false, message: 'This code is not an allowed ticket.' };
  }
  const entryDone = Boolean(registration?.checkedInAt);
  const foodDone = Boolean(registration?.foodCheckedInAt);
  if (foodDone) {
    return { allow: false, message: 'This QR has expired. Entry and food are both scanned.' };
  }
  if (kind === 'food' && !entryDone) {
    return {
      allow: false,
      message: 'Complete Entry check-in first. Food can be verified only after Entry is verified.',
    };
  }
  if (kind === 'entry' && entryDone) {
    return {
      allow: false,
      message: 'Entry is already scanned. This QR is only allowed for food.',
    };
  }
  return { allow: true };
}

function qrState(event, registration, now) {
  const expired = eventQrExpiredReason(event, now);
  if (paymentStatus(registration) === 'refunded') {
    return { qrStatus: 'Expired', qrNote: 'Ticket credit was returned.' };
  }
  if (expired === 'cancelled') {
    return { qrStatus: 'Expired', qrNote: 'The event is cancelled.' };
  }
  if (expired === 'ended') {
    return { qrStatus: 'Expired', qrNote: 'The event has ended.' };
  }
  if (registration?.foodCheckedInAt) {
    return { qrStatus: 'Expired', qrNote: 'Entry and food are both scanned.' };
  }
  if (registration?.checkedInAt) {
    return { qrStatus: 'Entry scanned', qrNote: 'Entry scanned. Food scan is still allowed.' };
  }
  return { qrStatus: 'Allowed', qrNote: 'Allowed for entry.' };
}

/** Attended only when entry was scanned. An entry stamp is never reported as Not attended. */
export function ticketAttendanceLabel(registration) {
  return registration?.checkedInAt ? 'Attended' : 'Not attended';
}

export function buildEventTicketReport(event, registrations, now) {
  const source = Array.isArray(registrations) ? registrations : [];
  const rows = source
    .filter((registration) => hasTicketCode(registration))
    .map((registration) => {
      const code = String(registration.entryCode).trim();
      const state = qrState(event, registration, now);
      return {
        ticketNumber: code,
        guestName: String(registration.name || '').trim() || 'Guest',
        qrCode: code,
        entryStatus: registration.checkedInAt ? 'Entry scanned' : 'Not scanned',
        foodStatus: registration.foodCheckedInAt ? 'Food scanned' : 'Not scanned',
        attendance: ticketAttendanceLabel(registration),
        qrStatus: state.qrStatus,
        qrNote: state.qrNote,
        participantCount: Number(registration.participantCount) > 0
          ? Number(registration.participantCount)
          : 1,
      };
    })
    .sort((a, b) => a.ticketNumber.localeCompare(b.ticketNumber));

  const sold = rows.filter((row) => row.qrNote !== 'Ticket credit was returned.');
  return {
    eventId: event?.id ?? null,
    eventName: String(event?.eventName || '').trim() || 'Event',
    ticketsSold: sold.length,
    allowedQr: rows.filter((row) => row.qrStatus === 'Allowed').length,
    entryScanned: rows.filter((row) => row.entryStatus === 'Entry scanned').length,
    foodScanned: rows.filter((row) => row.foodStatus === 'Food scanned').length,
    attended: rows.filter((row) => row.attendance === 'Attended').length,
    notAttended: rows.filter((row) => row.attendance === 'Not attended').length,
    expired: rows.filter((row) => row.qrStatus === 'Expired').length,
    rows,
  };
}
