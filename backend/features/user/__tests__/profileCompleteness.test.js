/**
 * Unit tests for profile completeness / placeholder name detection.
 * Run: node --test backend/features/user/__tests__/profileCompleteness.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  hasValidProfileName,
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

describe('isProfileComplete', () => {
  it('requires height, diet, phone, and a real name', () => {
    assert.equal(
      isProfileComplete({
        height: 170,
        dietType: 'Vegetarian',
        phoneNumber: '+919876543210',
        userName: 'adithya',
        email: 'adithya@example.com',
      }),
      false,
    );

    assert.equal(
      isProfileComplete({
        height: 170,
        dietType: 'Vegetarian',
        phoneNumber: '+919876543210',
        userName: 'Adithya Kumar',
        email: 'adithya@example.com',
      }),
      true,
    );
  });

  it('is incomplete when phone is missing', () => {
    assert.equal(
      isProfileComplete({
        height: 170,
        dietType: 'Vegetarian',
        phoneNumber: '',
        userName: 'Adithya Kumar',
        email: 'adithya@example.com',
      }),
      false,
    );
  });
});

describe('hasValidProfileName', () => {
  it('returns false for placeholder and true for real names', () => {
    assert.equal(hasValidProfileName('user_123', { phoneNumber: '+91123' }), false);
    assert.equal(hasValidProfileName('Priya Sharma', { email: 'priya@example.com' }), true);
  });
});
