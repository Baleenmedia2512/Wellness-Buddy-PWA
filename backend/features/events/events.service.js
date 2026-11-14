import * as repo from './data/events.repo.js';
import { searchActivePeople } from './data/people.repo.js';
import logger from '../../shared/lib/logger.js';
import { sendTransactionalMail } from '../../shared/lib/smtp-mail.js';
import { buildWhatsAppShareUrl } from '../../shared/lib/whatsapp-share.rules.js';
import { isWhatsAppCloudConfigured, sendWhatsAppCloudText } from '../../shared/lib/whatsapp-cloud.client.js';
import {
  countSeatsTaken,
  countSeatsTakenByEventIds,
  findCommunityIdForUser,
  findGuestCoachContacts,
  findRegistrantPhone,
  findRegistrationByEventAndEntryCode,
  findRegistrationByEventAndUser,
  findRegistrationByIdForUser,
  hasSelfRegistration,
  findTeamUserBrief,
  findTeamUserHeightCm,
  insertEventRegistration,
  insertPaidEventRegistration,
  listEntryCodesForEvent,
  listRegistrationsByUser,
  listRegistrationsForEvent,
  markRegistrationCancelNotified,
  markRegistrationCheckedIn,
  markRegistrationFoodCheckedIn,
  markRegistrationBookingFor,
  markRegistrationRefunded,
} from './data/registrations.repo.js';
import {
  buildEventCancelledNotice,
  cancellationNoticeEmails,
  cancelledTicketCreditAmount,
  describeCancellationSettlement,
  refundableEventTicketAmount,
} from './domain/event-cancelled-notice.rules.js';
import { buildCheckInIdealWeightProgress } from './domain/check-in-ideal-weight.rules.js';
import { buildCheckInMisuseReportEmail } from './domain/check-in-misuse-report-email.rules.js';
import { buildCheckInVerifiedEmail } from './domain/check-in-verified-email.rules.js';
import { getLatestWeight } from '../user/user.repository.js';
import {
  buildRegistrationQrPayload,
  canScanEventRegistrations,
  computeRegistrationCharge,
  eventDeleteBlockedByBookings,
  parseEntryCode,
  selfBookingAlreadyTaken,
} from './domain/event.rules.js';
import { creditEventTicketRefund, debitForEventTicket } from '../wallet/data/wallet.repo.js';

const STORAGE_MESSAGE = 'Events storage is not ready. Run backend/migrations/create_events_table.sql, then npm run prisma:generate in backend, and restart the API.';
const REGISTRATION_STORAGE_MESSAGE = 'Event registration storage is not ready. Run backend/migrations/create_event_registrations_table.sql, then npm run prisma:generate in backend, and restart the API.';

function storageFailure(err) {
  const message = String(err?.message || '');
  // Stale Prisma client (model missing → undefined.findMany) or DB table absent.
  const missingRegistration = err?.code === 'P2021'
    || message.includes('event_registrations_table')
    || message.includes('event_registrations');
  if (missingRegistration) {
    return {
      httpStatus: 503,
      body: { success: false, message: REGISTRATION_STORAGE_MESSAGE },
    };
  }
  // Table missing only — do not treat additive column errors (e.g. Venue) as full storage down.
  const missingTable = err?.code === 'P2021'
    || (message.includes('events_table') && /does not exist|doesn't exist/i.test(message))
    || (/events_table/i.test(message) && /datamodel/i.test(message))
    || /reading 'findMany'/i.test(message)
    || /reading 'create'/i.test(message)
    || /reading 'findFirst'/i.test(message)
    || /reading 'updateMany'/i.test(message);
  if (!missingTable) return null;
  return {
    httpStatus: 503,
    body: { success: false, message: STORAGE_MESSAGE },
  };
}

async function run(fn) {
  try {
    return await fn();
  } catch (err) {
    const mapped = storageFailure(err);
    if (mapped) return mapped;
    throw err;
  }
}

function withEventSummary(registration, event) {
  if (!registration) return null;
  return {
    ...registration,
    qrPayload: registration.entryCode
      ? buildRegistrationQrPayload(registration.eventId, registration.entryCode)
      : null,
    event: event
      ? {
          id: event.id,
          eventName: event.eventName,
          hostName: event.hostName,
          speakers: event.speakers,
          place: event.place,
          venue: event.venue,
          places: event.places,
          eventDate: event.eventDate,
          startTime: event.startTime,
          endTime: event.endTime,
          eventDates: event.eventDates,
          ticketPrice: event.ticketPrice,
          status: event.status,
        }
      : undefined,
  };
}

async function deliverCancellationNotice(event, registration, refundAmount) {
  const contacts = await findGuestCoachContacts(registration.registrantUserId);
  const guestName = registration.name || contacts.guestName || 'Guest';
  const notice = buildEventCancelledNotice({
    guestName,
    eventName: event.eventName,
    eventDate: event.eventDate,
    place: event.place,
    refundAmount,
    ticketNumber: registration.entryCode || registration.ticketNo || '',
  });
  const emails = cancellationNoticeEmails(registration.zoomEmail, contacts.guestEmail);
  let emailed = false;
  for (const email of emails) {
    try {
      await sendTransactionalMail({
        to: email,
        subject: notice.subject,
        text: notice.text,
        html: notice.html,
      });
      emailed = true;
    } catch (err) {
      logger.warn('[events] cancellation email failed', {
        registrationId: registration.id,
        message: err?.message || String(err),
      });
    }
  }

  const phone = String(registration.phoneNumber || '').trim()
    || await findRegistrantPhone(registration.registrantUserId);
  let whatsappSent = false;
  let whatsappUrl = '';
  if (phone && isWhatsAppCloudConfigured()) {
    try {
      await sendWhatsAppCloudText({ to: phone, text: notice.whatsappText });
      whatsappSent = true;
    } catch (err) {
      if (err?.code !== 'WHATSAPP_NOT_CONFIGURED') {
        logger.warn('[events] cancellation WhatsApp failed', {
          registrationId: registration.id,
          message: err?.message || String(err),
        });
      }
    }
  }
  if (phone && !whatsappSent) {
    whatsappUrl = buildWhatsAppShareUrl({ phone, text: notice.whatsappText });
  }
  return { emailed, whatsappSent, whatsappUrl, guestName };
}

/**
 * Return paid ticket credit and tell each booker the event is cancelled.
 * Safe to run again: a registration is credited once, and the email is sent once.
 */
async function settleCancelledEventBookings(event) {
  const summary = {
    refunded: 0,
    emailed: 0,
    whatsappSent: 0,
    whatsappChats: [],
  };
  if (!event || String(event.status || '').toLowerCase() !== 'cancelled') return summary;

  const rows = await listRegistrationsForEvent(event.id);
  for (const registration of rows) {
    const status = String(registration.paymentStatus || '').toLowerCase();
    if (status !== 'paid' && status !== 'saved' && status !== 'refunded') continue;
    try {
      const refundAmount = refundableEventTicketAmount(registration);
      if (refundAmount > 0) {
        await creditEventTicketRefund({
          userId: registration.registrantUserId,
          amount: refundAmount,
          registrationId: registration.id,
        });
        await markRegistrationRefunded(registration.id);
        summary.refunded += 1;
      }
      if (registration.cancelNotifiedAt) continue;
      const credit = refundAmount > 0
        ? refundAmount
        : cancelledTicketCreditAmount(registration);
      const delivery = await deliverCancellationNotice(event, registration, credit);
      if (delivery.emailed) summary.emailed += 1;
      if (delivery.whatsappSent) summary.whatsappSent += 1;
      if (delivery.whatsappUrl) {
        summary.whatsappChats.push({
          name: delivery.guestName,
          url: delivery.whatsappUrl,
        });
      }
      if (delivery.emailed || delivery.whatsappSent) {
        await markRegistrationCancelNotified(registration.id);
      }
    } catch (err) {
      logger.warn('[events] cancellation settlement failed', {
        eventId: event.id,
        registrationId: registration.id,
        message: err?.message || String(err),
      });
    }
  }
  return summary;
}

function cancellationBody(summary) {
  const notice = describeCancellationSettlement({
    refunded: summary.refunded,
    emailed: summary.emailed,
    whatsappSent: summary.whatsappSent,
    whatsappReady: summary.whatsappChats.length,
  });
  return {
    notice,
    whatsappChats: summary.whatsappChats,
  };
}

export function listEvents(input) {
  return run(async () => {
    const events = await repo.listEventsByOwner(input.userId);
    const settlement = {
      refunded: 0,
      emailed: 0,
      whatsappSent: 0,
      whatsappChats: [],
    };
    for (const event of events) {
      if (String(event.status || '').toLowerCase() !== 'cancelled') continue;
      try {
        const part = await settleCancelledEventBookings(event);
        settlement.refunded += part.refunded;
        settlement.emailed += part.emailed;
        settlement.whatsappSent += part.whatsappSent;
        settlement.whatsappChats.push(...part.whatsappChats);
      } catch (err) {
        logger.warn('[events] cancellation settlement failed', {
          eventId: event.id,
          message: err?.message || String(err),
        });
      }
    }
    const takenMap = await countSeatsTakenByEventIds(events.map((event) => event.id));
    const withBookings = events.map((event) => {
      const seatsTaken = takenMap.get(Number(event.id)) || 0;
      return {
        ...event,
        seatsTaken,
        hasBookings: eventDeleteBlockedByBookings(seatsTaken),
      };
    });
    const settled = cancellationBody(settlement);
    return {
      httpStatus: 200,
      body: {
        success: true,
        events: withBookings,
        ...(settled.notice ? { notice: settled.notice, whatsappChats: settled.whatsappChats } : {}),
      },
    };
  });
}

export function listOpenEvents() {
  return run(async () => {
    const events = await repo.listOpenEvents();
    const takenMap = await countSeatsTakenByEventIds(events.map((event) => event.id));
    const withSeats = events.map((event) => {
      const seatCount = Number(event.seatCount) || 0;
      const seatsTaken = takenMap.get(Number(event.id)) || 0;
      const seatsLeft = seatCount > 0 ? Math.max(0, seatCount - seatsTaken) : null;
      const soldOut = seatCount > 0 && seatsTaken >= seatCount;
      return {
        ...event,
        seatsTaken,
        seatsLeft,
        soldOut,
      };
    });
    return { httpStatus: 200, body: { success: true, events: withSeats } };
  });
}

export function createEvent(input) {
  return run(async () => {
    const event = await repo.insertEvent(input);
    return { httpStatus: 201, body: { success: true, event } };
  });
}

export function updateEvent(input) {
  return run(async () => {
    const event = await repo.updateOwnedEvent(input.id, input.userId, input);
    if (!event) {
      return { httpStatus: 404, body: { success: false, message: 'Event not found.' } };
    }
    const settlement = await settleCancelledEventBookings(event);
    const settled = cancellationBody(settlement);
    return {
      httpStatus: 200,
      body: {
        success: true,
        event,
        ...(settled.notice ? { notice: settled.notice, whatsappChats: settled.whatsappChats } : {}),
      },
    };
  });
}

export function deleteEvent(input) {
  return run(async () => {
    const event = await repo.findOwnedEvent(input.id, input.userId);
    if (!event) {
      return { httpStatus: 404, body: { success: false, message: 'Event not found.' } };
    }
    const seatsTaken = await countSeatsTaken(input.id);
    if (eventDeleteBlockedByBookings(seatsTaken, event.status)) {
      return {
        httpStatus: 409,
        body: {
          success: false,
          message: 'This event already has bookings, so it cannot be deleted. You can cancel it instead.',
        },
      };
    }
    const removed = await repo.softDeleteOwnedEvent(input.id, input.userId);
    if (!removed) {
      return { httpStatus: 404, body: { success: false, message: 'Event not found.' } };
    }
    return { httpStatus: 200, body: { success: true } };
  });
}

export async function searchEventPeople(input) {
  const people = await searchActivePeople(input.q);
  return { httpStatus: 200, body: { success: true, people } };
}

/**
 * Legacy: confirmPayment absent/false → insert only (no wallet debit).
 * New UI: confirmPayment true → debit wallet, issue EntryCode + QR payload.
 *
 * Legacy removal: after no supported client needs save-only POST and app version
 * policy no longer allows that path.
 */
export function createEventRegistration(input) {
  return run(async () => {
    const event = await repo.findActiveEventById(input.eventId);
    if (!event) {
      return { httpStatus: 404, body: { success: false, message: 'Event not found.' } };
    }
    if (String(event.status || '').toLowerCase() === 'cancelled') {
      return { httpStatus: 400, body: { success: false, message: 'This event is cancelled.' } };
    }

    if (!input.confirmPayment) {
      const registration = await insertEventRegistration(input);
      return { httpStatus: 201, body: { success: true, registration } };
    }

    const bookingFor = input.bookingFor === 'friend' ? 'friend' : 'self';
    if (bookingFor !== 'friend') {
      const existing = await hasSelfRegistration(input.eventId, input.userId);
      if (selfBookingAlreadyTaken(existing)) {
        return {
          httpStatus: 409,
          body: { success: false, message: 'You are already registered for this event.' },
        };
      }
    }

    const seatsTaken = await countSeatsTaken(input.eventId);
    const nextSeats = seatsTaken + Number(input.participantCount || 1);
    if (Number(event.seatCount) > 0 && nextSeats > Number(event.seatCount)) {
      return {
        httpStatus: 409,
        body: { success: false, message: 'No seats left for this event.' },
      };
    }

    const amountCharged = computeRegistrationCharge(event.ticketPrice, input.participantCount);
    if (amountCharged == null) {
      return { httpStatus: 400, body: { success: false, message: 'Invalid ticket price.' } };
    }

    // Guest-typed ticket number is the entry / QR identity (no random 4-digit).
    const entryCode = parseEntryCode(input.ticketNo);
    if (!entryCode) {
      return {
        httpStatus: 400,
        body: { success: false, message: 'Your Ticket Number is required.' },
      };
    }
    const usedCodes = await listEntryCodesForEvent(input.eventId);
    const ticketTaken = [...usedCodes].some(
      (code) => String(code).toLowerCase() === entryCode.toLowerCase(),
    );
    if (ticketTaken) {
      return {
        httpStatus: 409,
        body: {
          success: false,
          message: 'This ticket number is already used for this event. Please enter a different number.',
        },
      };
    }

    let debit;
    try {
      debit = await debitForEventTicket({
        userId: input.userId,
        amount: amountCharged,
        eventId: input.eventId,
      });
    } catch (error) {
      if (String(error?.message) === 'WALLET_INSUFFICIENT_BALANCE') {
        return {
          httpStatus: 402,
          body: {
            success: false,
            code: 'INSUFFICIENT_WALLET_BALANCE',
            message: 'Insufficient wallet balance. Add cash to your wallet and try again.',
            amountRequired: amountCharged,
          },
        };
      }
      throw error;
    }

    let registration;
    try {
      registration = await insertPaidEventRegistration(input, {
        entryCode,
        amountCharged,
        walletLedgerId: debit.ledgerId,
      });
    } catch (error) {
      // Best-effort note: debit already happened. Prefer unique-conflict messaging.
      const message = String(error?.message || '');
      if (error?.code === 'P2002' || message.includes('Duplicate')) {
        return {
          httpStatus: 409,
          body: {
            success: false,
            message: 'This ticket number is already used for this event. Please enter a different number.',
          },
        };
      }
      throw error;
    }

    if (bookingFor === 'friend') {
      await markRegistrationBookingFor(registration.id, 'friend');
      registration = { ...registration, bookingFor: 'friend' };
    }

    return {
      httpStatus: 201,
      body: {
        success: true,
        message: 'Successfully Submitted',
        registration: withEventSummary(registration, event),
        balanceAfter: debit.balance,
      },
    };
  });
}

export function listMyEventRegistrations(input) {
  return run(async () => {
    const rows = await listRegistrationsByUser(input.userId);
    const eventsById = new Map();
    for (const row of rows) {
      if (!eventsById.has(row.eventId)) {
        eventsById.set(row.eventId, await repo.findActiveEventById(row.eventId));
      }
    }
    for (const event of eventsById.values()) {
      if (String(event?.status || '').toLowerCase() !== 'cancelled') continue;
      try {
        await settleCancelledEventBookings(event);
      } catch (err) {
        logger.warn('[events] cancellation settlement failed', {
          eventId: event?.id,
          message: err?.message || String(err),
        });
      }
    }
    const fresh = await listRegistrationsByUser(input.userId);
    const registrations = fresh.map((row) => withEventSummary(row, eventsById.get(row.eventId)));
    return { httpStatus: 200, body: { success: true, registrations } };
  });
}

export function getMyEventRegistration(input) {
  return run(async () => {
    const registration = await findRegistrationByIdForUser(input.id, input.userId);
    if (!registration) {
      return { httpStatus: 404, body: { success: false, message: 'Booking not found.' } };
    }
    const event = await repo.findActiveEventById(registration.eventId);
    return {
      httpStatus: 200,
      body: { success: true, registration: withEventSummary(registration, event) },
    };
  });
}

export function checkInEventRegistration(input) {
  return run(async () => {
    const event = await repo.findActiveEventById(input.eventId);
    if (!event) {
      return { httpStatus: 404, body: { success: false, message: 'Event not found.' } };
    }
    if (!canScanEventRegistrations(event, input.userId)) {
      return {
        httpStatus: 403,
        body: { success: false, message: 'Only the event creator or designated persons can check in guests.' },
      };
    }

    let registration = await findRegistrationByEventAndEntryCode(input.eventId, input.entryCode);
    if (!registration) {
      return { httpStatus: 404, body: { success: false, message: 'No registration found for this code.' } };
    }

    const checkInType = input.checkInType === 'food' ? 'food' : 'entry';
    const alreadyVerified = checkInType === 'food'
      ? Boolean(registration.foodCheckedInAt)
      : Boolean(registration.checkedInAt);
    const firstVerify = Boolean(input.markCheckedIn && !alreadyVerified);
    if (firstVerify && checkInType === 'food' && !registration.checkedInAt) {
      return {
        httpStatus: 409,
        body: {
          success: false,
          message: 'Complete Entry check-in first. Food can be verified only after Entry is verified.',
        },
      };
    }
    if (firstVerify) {
      registration = checkInType === 'food'
        ? await markRegistrationFoodCheckedIn(registration.id, input.userId)
        : await markRegistrationCheckedIn(registration.id, input.userId);
    }

    // Prefer live profile Community ID over registration IdNo (may be legacy user id).
    const profileCommunityId = await findCommunityIdForUser(registration.registrantUserId);
    const idNoLooksLikeUserId = String(registration.idNo || '').trim()
      === String(registration.registrantUserId || '').trim();
    const communityId = profileCommunityId
      || (!idNoLooksLikeUserId ? String(registration.idNo || '').trim() : '')
      || null;

    async function toVerifier(userId) {
      if (!userId) return null;
      const brief = await findTeamUserBrief(userId);
      if (brief) {
        return {
          userId: brief.userId,
          name: brief.name,
          communityId: brief.communityId,
        };
      }
      return { userId: Number(userId), name: null, communityId: null };
    }

    const entryVerifierUserId = registration.checkedInByUserId
      || (checkInType === 'entry' && firstVerify ? input.userId : null);
    const foodVerifierUserId = registration.foodCheckedInByUserId
      || (checkInType === 'food' && firstVerify ? input.userId : null);

    const entryCheckedInBy = await toVerifier(entryVerifierUserId);
    const foodCheckedInBy = await toVerifier(foodVerifierUserId);
    // Keep checkedInBy as the active mode verifier (entry clients unchanged).
    const checkedInBy = checkInType === 'food' ? foodCheckedInBy : entryCheckedInBy;

    if (firstVerify) {
      const to = String(registration.zoomEmail || '').trim();
      if (to.includes('@')) {
        try {
          const mail = buildCheckInVerifiedEmail({
            guestName: registration.name,
            eventName: event.eventName,
            ticketNumber: registration.entryCode || registration.ticketNo,
            verifierName: checkedInBy?.name || 'Wellness Valley team',
            verifierCommunityId: checkedInBy?.communityId || '',
            checkInType,
          });
          await sendTransactionalMail({
            to,
            subject: mail.subject,
            text: mail.text,
            html: mail.html,
          });
        } catch (err) {
          // Check-in already saved — never block verification on mail failure.
          logger.warn('[events] verified email failed', {
            registrationId: registration.id,
            checkInType,
            message: err?.message || String(err),
          });
        }
      }
    }

    // Additive guest Ideal Weight for pass UI — never blocks check-in.
    let idealWeightProgress = null;
    try {
      const heightCm = await findTeamUserHeightCm(registration.registrantUserId);
      const latest = await getLatestWeight(registration.registrantUserId);
      const currentWeightKg = latest?.Weight != null ? Number(latest.Weight) : null;
      idealWeightProgress = buildCheckInIdealWeightProgress({ heightCm, currentWeightKg });
    } catch (err) {
      logger.warn('[events] ideal weight progress failed', {
        registrationId: registration.id,
        message: err?.message || String(err),
      });
    }

    return {
      httpStatus: 200,
      body: {
        success: true,
        checkInType,
        registration: {
          ...withEventSummary(registration, event),
          communityId,
          checkedInBy,
          entryCheckedInBy,
          foodCheckedInBy,
          idealWeightProgress,
        },
        idealWeightProgress,
        photoUserId: registration.registrantUserId,
      },
    };
  });
}

/**
 * Entry check-in Report — emails guest + coach that someone may be misusing the account.
 * Does not verify, stamp, or change registration state.
 */
export function reportCheckInMisuse(input) {
  return run(async () => {
    const event = await repo.findActiveEventById(input.eventId);
    if (!event) {
      return { httpStatus: 404, body: { success: false, message: 'Event not found.' } };
    }
    if (!canScanEventRegistrations(event, input.userId)) {
      return {
        httpStatus: 403,
        body: { success: false, message: 'Only the event creator or designated persons can report misuse.' },
      };
    }

    const registration = await findRegistrationByEventAndEntryCode(input.eventId, input.entryCode);
    if (!registration) {
      return { httpStatus: 404, body: { success: false, message: 'No registration found for this code.' } };
    }

    const contacts = await findGuestCoachContacts(registration.registrantUserId);
    const reporter = await findTeamUserBrief(input.userId);
    const reportedByName = reporter?.name || 'event staff';
    const guestName = registration.name || contacts.guestName || 'Guest';
    const ticketNumber = registration.entryCode || registration.ticketNo || '';
    const guestTo = String(registration.zoomEmail || contacts.guestEmail || '').trim();
    const coachTo = String(contacts.coachEmail || '').trim();

    const recipients = [];
    if (guestTo.includes('@')) {
      recipients.push({ email: guestTo, role: 'guest' });
    }
    if (coachTo.includes('@') && coachTo.toLowerCase() !== guestTo.toLowerCase()) {
      recipients.push({ email: coachTo, role: 'coach' });
    }

    if (recipients.length === 0) {
      return {
        httpStatus: 422,
        body: {
          success: false,
          message: 'No guest or coach email is available to send this report.',
        },
      };
    }

    let emailedGuest = false;
    let emailedCoach = false;
    for (const recipient of recipients) {
      try {
        const mail = buildCheckInMisuseReportEmail({
          guestName,
          eventName: event.eventName,
          ticketNumber,
          reportedByName,
          recipientRole: recipient.role,
        });
        await sendTransactionalMail({
          to: recipient.email,
          subject: mail.subject,
          text: mail.text,
          html: mail.html,
        });
        if (recipient.role === 'guest') emailedGuest = true;
        if (recipient.role === 'coach') emailedCoach = true;
      } catch (err) {
        logger.warn('[events] check-in misuse report email failed', {
          registrationId: registration.id,
          role: recipient.role,
          message: err?.message || String(err),
        });
      }
    }

    if (!emailedGuest && !emailedCoach) {
      return {
        httpStatus: 502,
        body: { success: false, message: 'Could not send the report email. Try again.' },
      };
    }

    return {
      httpStatus: 200,
      body: {
        success: true,
        reported: true,
        emailedGuest,
        emailedCoach,
        message: emailedGuest && emailedCoach
          ? 'Report sent to guest and coach.'
          : emailedGuest
            ? 'Report sent to guest.'
            : 'Report sent to coach.',
      },
    };
  });
}
