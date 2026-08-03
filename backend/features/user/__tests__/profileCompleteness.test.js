/**
 * Unit tests for profile completeness / placeholder name detection.
 * Run: node --test backend/features/user/__tests__/profileCompleteness.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  hasValidProfileName,
  hasValidProfileGender,
  isPlaceholderUserName,
  isProfileComplete,
} from '../domain/profileCompleteness.js';

describe('isPlaceholderUserName', () => {
  it('treats empty name as placeholder', () => {
    assert.equal(isPlaceholderUserName(''), true);
    assert.equal(isPlaceholderUserName(null), true);
  });

  it('treats phone-derived user_<digits> as placeholder', () => {
    assert.equal(isPlaceholderUserName('user_919876543210'), true);
  });

  it('treats email local-part as placeholder', () => {
    assert.equal(
      isPlaceholderUserName('adithya', { email: 'adithya@example.com' }),
      true,
    );
  });

  it('accepts a real chosen name', () => {
    assert.equal(
      isPlaceholderUserName('Adithya Kumar', { email: 'adithya@example.com' }),
      false,
    );
  });
});

describe('hasValidProfileGender', () => {
  it('accepts profile Gender', () => {
    assert.equal(hasValidProfileGender('Male'), true);
    assert.equal(hasValidProfileGender('Female'), true);
  });

  it('accepts BPC bodyMetrics.gender when profile gender missing', () => {
    assert.equal(hasValidProfileGender(null, { gender: 'Female' }), true);
  });

  it('rejects missing gender', () => {
    assert.equal(hasValidProfileGender(null, null), false);
  });
});

describe('isProfileComplete', () => {
  it('requires name, email, height, diet, gender — not phone', () => {
    assert.equal(
      isProfileComplete({
        height: 170,
        dietType: 'Vegetarian',
        userName: 'Adithya Kumar',
        email: 'adithya@example.com',
        gender: 'Male',
      }),
      true,
    );

    assert.equal(
      isProfileComplete({
        height: 170,
        dietType: 'Vegetarian',
        userName: 'Adithya Kumar',
        email: 'adithya@example.com',
        phoneNumber: '',
        gender: 'Male',
      }),
      true,
    );

    assert.equal(
      isProfileComplete({
        height: 170,
        dietType: 'Vegetarian',
        userName: 'Adithya Kumar',
        email: 'adithya@example.com',
        gender: null,
      }),
      false,
    );
  });

  it('accepts BPC gender when team Gender missing', () => {
    assert.equal(
      isProfileComplete({
        height: 170,
        dietType: 'Vegetarian',
        userName: 'Adithya Kumar',
        email: 'adithya@example.com',
        gender: null,
        bodyMetrics: { gender: 'Female' },
      }),
      true,
    );
  });

  it('is incomplete when email missing', () => {
    assert.equal(
      isProfileComplete({
        height: 170,
        dietType: 'Vegetarian',
        userName: 'Adithya Kumar',
        email: '',
        gender: 'Male',
      }),
      false,
    );
  });

  it('requires profileImage when provided', () => {
    assert.equal(
      isProfileComplete({
        height: 170,
        dietType: 'Vegetarian',
        userName: 'Adithya Kumar',
        email: 'adithya@example.com',
        gender: 'Male',
        profileImage: null,
      }),
      false,
    );
    assert.equal(
      isProfileComplete({
        height: 170,
        dietType: 'Vegetarian',
        userName: 'Adithya Kumar',
        email: 'adithya@example.com',
        gender: 'Male',
        profileImage: 'data:image/jpeg;base64,abc',
      }),
      true,
    );
  });
});

describe('hasValidProfileName', () => {
  it('returns false for placeholder and true for real names', () => {
    assert.equal(hasValidProfileName('user_123', { phoneNumber: '+91123' }), false);
    assert.equal(hasValidProfileName('Priya Sharma', { email: 'priya@example.com' }), true);
  });
});
