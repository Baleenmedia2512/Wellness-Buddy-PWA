/**
 * Run: node --test frontend/src/features/body-parameters-card/domain/formValidation.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getBcmParentNeededHint,
  getBcmRequiredFieldError,
  getFirstMissingBcmRequiredField,
  isBcmParentFilled,
} from './formValidation.rules.js';

describe('getBcmRequiredFieldError', () => {
  it('asks for name immediately when empty', () => {
    assert.equal(getBcmRequiredFieldError('name', { name: '' }), 'Name is required');
    assert.equal(getBcmRequiredFieldError('name', { name: '  ' }), 'Name is required');
    assert.equal(getBcmRequiredFieldError('name', { name: 'Ada' }), null);
  });

  it('asks for phone immediately when empty or incomplete', () => {
    assert.equal(getBcmRequiredFieldError('phoneNumber', { phoneNumber: '' }), 'Phone number is required');
    assert.equal(
      getBcmRequiredFieldError('phoneNumber', { phoneNumber: '98765' }),
      'Please enter a valid phone number (10–15 digits)',
    );
    assert.equal(getBcmRequiredFieldError('phoneNumber', { phoneNumber: '9876543210' }), null);
  });
});

describe('getFirstMissingBcmRequiredField', () => {
  it('prefers name over phone so save can scroll to the first gap', () => {
    assert.equal(getFirstMissingBcmRequiredField({ name: '', phoneNumber: '' }), 'name');
    assert.equal(getFirstMissingBcmRequiredField({ name: 'Ada', phoneNumber: '' }), 'phoneNumber');
    assert.equal(getFirstMissingBcmRequiredField({ name: 'Ada', phoneNumber: '9876543210' }), null);
  });
});

describe('isBcmParentFilled', () => {
  it('treats Male/Female as a filled gender', () => {
    assert.equal(isBcmParentFilled('gender', { gender: '' }), false);
    assert.equal(isBcmParentFilled('gender', { gender: 'Male' }), true);
  });
});

describe('getBcmParentNeededHint', () => {
  it('asks on Gender for the metric the user just opened', () => {
    assert.equal(
      getBcmParentNeededHint('gender', { fatPercent: '', gender: '' }, { requestedFor: 'fatPercent' }),
      'Please select gender for Fat%',
    );
    assert.equal(
      getBcmParentNeededHint('gender', { chestCm: '', gender: '' }, { requestedFor: 'chestCm' }),
      'Please select gender for Chest',
    );
    assert.equal(
      getBcmParentNeededHint('gender', { waistCm: '92', gender: '' }),
      'Please select gender for Waist',
    );
    assert.equal(
      getBcmParentNeededHint('gender', { hipCm: '88', gender: 'Female' }),
      null,
    );
  });

  it('asks on Height when Weight is opened first', () => {
    assert.equal(
      getBcmParentNeededHint('heightCm', { weightKg: '', heightCm: '' }, { requestedFor: 'weightKg' }),
      'Please enter height for Weight',
    );
    assert.equal(
      getBcmParentNeededHint('heightCm', { weightKg: '62', heightCm: '165' }),
      null,
    );
  });

  it('asks on Age when Body Age is opened first', () => {
    assert.equal(
      getBcmParentNeededHint('age', { bodyAge: '', age: '' }, { requestedFor: 'bodyAge' }),
      'Please enter age for Body Age',
    );
    assert.equal(
      getBcmParentNeededHint('age', { bodyAge: '30', age: '28' }),
      null,
    );
  });
});
