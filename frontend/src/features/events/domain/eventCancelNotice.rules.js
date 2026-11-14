/**
 * Which cancelled bookings still need a home-screen sign. Pure — no I/O.
 */

export function cancelledBookingNotes(registrations) {
  return (Array.isArray(registrations) ? registrations : [])
    .filter((row) => {
      const status = String(row?.event?.status || '').toLowerCase();
      return status === 'cancelled' || !row?.event;
    })
    .map((row) => ({
      id: row.id,
      name: row.event?.eventName || 'An event you booked',
      refunded: String(row.paymentStatus || '').toLowerCase() === 'refunded'
        && Number(row.amountCharged) > 0,
    }));
}

/**
 * @param {unknown[]} registrations
 * @param {Array<string|number>} seenIds registration ids already opened in My Bookings
 */
export function unseenCancelledBookings(registrations, seenIds) {
  const seen = new Set((seenIds || []).map((id) => String(id)));
  return cancelledBookingNotes(registrations).filter((note) => !seen.has(String(note.id)));
}

/**
 * @param {Array<{ id: unknown, name: string }>} notes
 * @returns {{ title: string, subtitle: string } | null}
 */
export function eventCancellationHomeCopy(notes) {
  const rows = Array.isArray(notes) ? notes : [];
  if (rows.length === 0) return null;
  if (rows.length === 1) {
    return {
      title: `${rows[0].name} is cancelled`,
      subtitle: 'Open My Bookings to see it.',
    };
  }
  return {
    title: `${rows.length} booked events were cancelled`,
    subtitle: 'Open My Bookings to see them.',
  };
}
