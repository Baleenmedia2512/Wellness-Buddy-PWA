import {
  validateMedicalCondition,
  MEDICAL_CONDITION_MAX_LENGTH,
} from '../domain/medicalConditionValidation.js';

describe('validateMedicalCondition', () => {
  it('rejects empty and whitespace-only values', () => {
    expect(validateMedicalCondition('')).toEqual({
      valid: false,
      value: '',
      message: 'Please enter your medical condition.',
    });
    expect(validateMedicalCondition('   ')).toEqual({
      valid: false,
      value: '',
      message: 'Please enter your medical condition.',
    });
  });

  it('trims and accepts valid catalog-style names', () => {
    expect(validateMedicalCondition('  Diabetes Type 2  ')).toEqual({
      valid: true,
      value: 'Diabetes Type 2',
      message: '',
    });
  });

  it('accepts allowed punctuation in custom conditions', () => {
    expect(validateMedicalCondition("Rare (Blood) Disorder - Stage 1")).toEqual({
      valid: true,
      value: "Rare (Blood) Disorder - Stage 1",
      message: '',
    });
  });

  it('rejects disallowed characters', () => {
    const result = validateMedicalCondition('Condition@Home');
    expect(result.valid).toBe(false);
    expect(result.message).toContain('Only letters');
  });

  it('rejects values longer than the max length', () => {
    const tooLong = 'a'.repeat(MEDICAL_CONDITION_MAX_LENGTH + 1);
    const result = validateMedicalCondition(tooLong);
    expect(result.valid).toBe(false);
    expect(result.message).toContain(String(MEDICAL_CONDITION_MAX_LENGTH));
  });
});
