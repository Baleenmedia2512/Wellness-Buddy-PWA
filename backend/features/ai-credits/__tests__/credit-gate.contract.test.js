/**
 * Gate contract: credit-gated orchestrate requires pending reservation.
 * Run: node --test backend/features/ai-credits/__tests__/credit-gate.contract.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Mirrors pages/api/ai/orchestrate.js credit gate decision (pure).
 */
export function shouldRejectOrchestrateWithoutReservation({
  featureEnabled,
  creditGated,
  reservationStatus,
  reservationUserId,
  requestUserId,
}) {
  if (!featureEnabled || !creditGated) return { reject: false };
  if (!reservationStatus || reservationStatus !== 'pending') {
    return { reject: true, code: 'CREDIT_RESERVATION_NOT_PENDING' };
  }
  if (Number(reservationUserId) !== Number(requestUserId)) {
    return { reject: true, code: 'CREDIT_RESERVATION_INVALID' };
  }
  return { reject: false };
}

describe('orchestrate credit gate', () => {
  it('rejects gated call without pending reservation', () => {
    const r = shouldRejectOrchestrateWithoutReservation({
      featureEnabled: true,
      creditGated: true,
      reservationStatus: null,
      reservationUserId: null,
      requestUserId: 1,
    });
    assert.equal(r.reject, true);
  });

  it('allows gated call with pending reservation for same user', () => {
    const r = shouldRejectOrchestrateWithoutReservation({
      featureEnabled: true,
      creditGated: true,
      reservationStatus: 'pending',
      reservationUserId: 9,
      requestUserId: 9,
    });
    assert.equal(r.reject, false);
  });

  it('does not gate when feature off or creditGated false', () => {
    assert.equal(
      shouldRejectOrchestrateWithoutReservation({
        featureEnabled: false,
        creditGated: true,
        reservationStatus: null,
      }).reject,
      false,
    );
    assert.equal(
      shouldRejectOrchestrateWithoutReservation({
        featureEnabled: true,
        creditGated: false,
        reservationStatus: null,
      }).reject,
      false,
    );
  });
});
