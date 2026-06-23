/**
 * card.schema.test.js — Validation schema unit tests.
 */
import { validateCreateCard, validateToken, validatePhoneSearchQuery } from '../validation/card.schema.js';

describe('validateCreateCard', () => {
  const base = { createdBy: 1, name: 'Ali Hassan' };

  it('passes with minimum required fields', () => {
    const out = validateCreateCard(base);
    expect(out.name).toBe('Ali Hassan');
    expect(out.createdBy).toBe(1);
  });

  it('throws 400 when body is null', () => {
    expect(() => validateCreateCard(null)).toThrow('Request body is missing');
  });

  it('throws 400 when createdBy is missing', () => {
    expect(() => validateCreateCard({ name: 'Ali' })).toThrow('createdBy is required');
  });

  it('throws 400 when name is empty', () => {
    expect(() => validateCreateCard({ createdBy: 1, name: '  ' })).toThrow('name is required');
  });

  it('throws 422 when name exceeds 100 chars', () => {
    expect(() => validateCreateCard({ createdBy: 1, name: 'A'.repeat(101) })).toThrow('≤ 100');
  });

  it('throws 422 for out-of-range age', () => {
    expect(() => validateCreateCard({ ...base, age: 200 })).toThrow('age must be between');
  });

  it('throws 422 for invalid gender', () => {
    expect(() => validateCreateCard({ ...base, gender: 'Unknown' })).toThrow('gender must be one of');
  });

  it('throws 422 for invalid height', () => {
    expect(() => validateCreateCard({ ...base, heightCm: 10 })).toThrow('heightCm must be between');
  });

  it('throws 422 for invalid weight', () => {
    expect(() => validateCreateCard({ ...base, weightKg: 5 })).toThrow('weightKg must be between');
  });

  it('throws 422 for out-of-range bmi', () => {
    expect(() => validateCreateCard({ ...base, bmi: 3 })).toThrow('bmi must be between');
  });

  it('throws 422 for out-of-range bmr', () => {
    expect(() => validateCreateCard({ ...base, bmr: 100 })).toThrow('bmr must be between');
  });

  it('accepts all valid fields', () => {
    const out = validateCreateCard({
      createdBy: 2, userId: 5, name: 'Priya S', age: 30, gender: 'Female',
      heightCm: 165, weightKg: 58, bmi: 21.3, fatPercent: 24, bmr: 1450,
      bodyAge: 28, recordedDate: '2026-06-09', locationName: 'Chennai',
      phoneNumber: '+919876543210',
    });
    expect(out.gender).toBe('Female');
    expect(out.bmi).toBeCloseTo(21.3);
    expect(out.userId).toBe(5);
    expect(out.phoneNumber).toBe('+919876543210');
  });

  it('accepts optional chest, waist, and hip measurements', () => {
    const out = validateCreateCard({
      ...base,
      chestCm: 95,
      waistCm: 82.5,
      hipCm: 98,
    });
    expect(out.chestCm).toBe(95);
    expect(out.waistCm).toBeCloseTo(82.5);
    expect(out.hipCm).toBe(98);
  });

  it('throws 422 for out-of-range chestCm', () => {
    expect(() => validateCreateCard({ ...base, chestCm: 10 })).toThrow('chestCm must be between');
  });

  it('allows empty phoneNumber', () => {
    const out = validateCreateCard({ ...base, phoneNumber: '' });
    expect(out.phoneNumber).toBeNull();
  });

  it('coerces numeric strings', () => {
    const out = validateCreateCard({ createdBy: '1', name: 'X', age: '25', heightCm: '170' });
    expect(out.createdBy).toBe(1);
    expect(out.age).toBe(25);
    expect(out.heightCm).toBe(170);
  });
});

describe('validateToken', () => {
  it('accepts a valid UUID', () => {
    const t = '550e8400-e29b-41d4-a716-446655440000';
    expect(validateToken(t)).toBe(t);
  });

  it('throws 400 for non-UUID', () => {
    expect(() => validateToken('not-a-uuid')).toThrow('Invalid token format');
  });

  it('throws 400 for empty string', () => {
    expect(() => validateToken('')).toThrow('Invalid token format');
  });
});

describe('validatePhoneSearchQuery', () => {
  it('passes with valid prefix and coachId', () => {
    const out = validatePhoneSearchQuery({ prefix: '93', coachId: '5' });
    expect(out.prefix).toBe('93');
    expect(out.coachId).toBe(5);
  });

  it('throws 400 when prefix is missing', () => {
    expect(() => validatePhoneSearchQuery({ coachId: '5' })).toThrow('prefix is required');
  });

  it('throws 422 when prefix is only 1 digit', () => {
    expect(() => validatePhoneSearchQuery({ prefix: '9', coachId: '5' })).toThrow('prefix must be 2–15 digits');
  });

  it('throws 422 when prefix contains letters', () => {
    expect(() => validatePhoneSearchQuery({ prefix: '9A', coachId: '5' })).toThrow('prefix must be 2–15 digits');
  });

  it('throws 400 when coachId is missing', () => {
    expect(() => validatePhoneSearchQuery({ prefix: '93' })).toThrow('coachId is required');
  });

  it('throws 400 when coachId is zero', () => {
    expect(() => validatePhoneSearchQuery({ prefix: '93', coachId: '0' })).toThrow('coachId must be a valid UserId');
  });

  it('strips spaces from prefix', () => {
    const out = validatePhoneSearchQuery({ prefix: '93 ', coachId: '5' });
    expect(out.prefix).toBe('93');
  });
});
