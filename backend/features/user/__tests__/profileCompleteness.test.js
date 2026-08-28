/**
 * Unit tests for profile completeness / placeholder name detection.
 * Run: node --test backend/features/user/__tests__/profileCompleteness.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  hasValidProfileName,
  hasValidProfileGender,
  hasValidBodyFatSource,
  isPlaceholderUserName,
  isOnboardingIdentityComplete,
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

  it('does not treat email local-part as a placeholder', () => {
    assert.equal(
      isPlaceholderUserName('adithya', { email: 'adithya@example.com' }),
      false,
    );
    assert.equal(
      isPlaceholderUserName('SURESH', { email: 'suresh@gmail.com' }),
      false,
    );
    assert.equal(
      isPlaceholderUserName('suresh', { email: 'suresh@gmail.com' }),
      false,
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

describe('hasValidBodyFatSource', () => {
  it('accepts weight or BPC body fat', () => {
    assert.equal(hasValidBodyFatSource({ bodyFat: 22 }), true);
    assert.equal(hasValidBodyFatSource({ latestWeightBodyFat: 18 }), true);
    assert.equal(hasValidBodyFatSource({ bodyMetrics: { fatPercent: 20 } }), true);
  });

  it('rejects missing body fat', () => {
    assert.equal(hasValidBodyFatSource({}), false);
  });
});

describe('isOnboardingIdentityComplete', () => {
  it('requires a real name only (email comes later)', () => {
    assert.equal(
      isOnboardingIdentityComplete({
        userName: 'Adithya Kumar',
        email: '',
      }),
      true,
    );
    assert.equal(
      isOnboardingIdentityComplete({
        userName: 'PRAVEEN',
      }),
      true,
    );
  });

  it('rejects phone placeholder name', () => {
    assert.equal(
      isOnboardingIdentityComplete({
        userName: 'user_919876543210',
        email: 'a@b.com',
      }),
      false,
    );
  });

  it('does not treat a BCM-style name as replacing a missing team UserName', () => {
    assert.equal(
      isOnboardingIdentityComplete({
        userName: 'user_919876543210',
        phoneNumber: '+919876543210',
      }),
      false,
    );
  });
});

describe('isProfileComplete', () => {
  it('requires name, email, height, diet, gender, body fat — not phone', () => {
    assert.equal(
      isProfileComplete({
        height: 170,
        dietType: 'Vegetarian',
        userName: 'Adithya Kumar',
        email: 'adithya@example.com',
        gender: 'Male',
        bodyFat: 22,
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
        bodyFat: 22,
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
        bodyFat: 22,
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
      }),
      false,
    );
  });

  it('accepts BPC gender + fat when team fields missing', () => {
    assert.equal(
      isProfileComplete({
        height: 170,
        dietType: 'Vegetarian',
        userName: 'Adithya Kumar',
        email: 'adithya@example.com',
        gender: null,
        bodyMetrics: { gender: 'Female', fatPercent: 24 },
      }),
      true,
    );
  });

  it('does not require optional Age / V-Fat / circumferences for completeness', () => {
    assert.equal(
      isProfileComplete({
        height: 170,
        dietType: 'Vegetarian',
        userName: 'Adithya Kumar',
        email: 'adithya@example.com',
        gender: 'Male',
        bodyFat: 22,
        bodyMetrics: {
          age: null,
          visceralFat: null,
          bodyAge: null,
          chestCm: null,
          waistCm: null,
          hipCm: null,
        },
      }),
      true,
    );
  });

  it('skips body-fat prompt when weight already has fat %', () => {
    assert.equal(
      isProfileComplete({
        height: 170,
        dietType: 'Vegetarian',
        userName: 'Adithya Kumar',
        email: 'adithya@example.com',
        gender: 'Male',
        latestWeightBodyFat: 18,
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
        bodyFat: 22,
      }),
      false,
    );
  });

  it('does not require profileImage (avatar is Centre transform photo)', () => {
    assert.equal(
      isProfileComplete({
        height: 170,
        dietType: 'Vegetarian',
        userName: 'Adithya Kumar',
        email: 'adithya@example.com',
        gender: 'Male',
        bodyFat: 22,
        profileImage: null,
      }),
      true,
    );
    assert.equal(
      isProfileComplete({
        height: 170,
        dietType: 'Vegetarian',
        userName: 'Adithya Kumar',
        email: 'adithya@example.com',
        gender: 'Male',
        bodyFat: 22,
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
