/**
 * Self vs friend ticket. A friend booking does not use up the member's own seat.
 */

export function selfBookingAlreadyTaken(registration) {
  if (!registration) return false;
  if (String(registration.bookingFor || '').trim().toLowerCase() === 'friend') return false;
  const paid = String(registration.paymentStatus || '').toLowerCase() === 'paid';
  return paid || Boolean(registration.entryCode);
}
