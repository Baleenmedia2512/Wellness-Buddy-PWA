/**
 * Run: node --test backend/features/body-parameters-card/validation/card.schema.appointment-date.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateCreateCard,
  validateUpdateCard,
} from './card.schema.js';

describe('validateCreateCard appointmentDate', () => {
  const baseValid = {
    createdBy: 1,
    name: 'Alice Tester',
  };

  it('accepts null or omitted appointmentDate', () => {
    const res1 = validateCreateCard({ ...baseValid });
    assert.equal(res1.appointmentDate, null);

    const res2 = validateCreateCard({ ...baseValid, appointmentDate: null });
    assert.equal(res2.appointmentDate, null);
  });

  it('parses valid ISO and YYYY-MM-DD date strings', () => {
    const res1 = validateCreateCard({ ...baseValid, appointmentDate: '2026-10-22' });
    assert.equal(res1.appointmentDate, '2026-10-22');

    const res2 = validateCreateCard({ ...baseValid, appointmentDate: '2026-10-22T08:30:00.000Z' });
    assert.equal(res2.appointmentDate, '2026-10-22');
  });

  it('rejects invalid appointmentDate', () => {
    assert.throws(
      () => validateCreateCard({ ...baseValid, appointmentDate: 'invalid-date' }),
      (err) => err?.status === 422 && /appointmentDate/i.test(err?.message),
    );
  });
});

describe('validateUpdateCard appointmentDate', () => {
  const baseValidUpdate = {
    id: 10,
    name: 'Alice Tester',
  };

  it('accepts valid appointmentDate on update', () => {
    const res = validateUpdateCard({ ...baseValidUpdate, appointmentDate: '2026-10-26' });
    assert.equal(res.appointmentDate, '2026-10-26');
  });

  it('rejects invalid appointmentDate on update', () => {
    assert.throws(
      () => validateUpdateCard({ ...baseValidUpdate, appointmentDate: 'not-a-date' }),
      (err) => err?.status === 422 && /appointmentDate/i.test(err?.message),
    );
  });
});
