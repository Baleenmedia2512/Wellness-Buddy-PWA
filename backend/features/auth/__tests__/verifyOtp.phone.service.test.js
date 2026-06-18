import { verifyOtp } from '../auth.service.js';
import * as repo from '../auth.repository.js';

jest.mock('../auth.repository.js', () => ({
  getISTTimestamp: jest.fn(() => '2026-06-15 22:00:00.000'),
  deactivateActiveOtps: jest.fn(),
  insertOtpToken: jest.fn(),
  fetchActiveOtp: jest.fn(),
  markOtpVerified: jest.fn(),
  findUserByPhone: jest.fn(),
  findUserByEmail: jest.fn(),
  insertUser: jest.fn(),
  findOrInsertUserByPhone: jest.fn(),
}));

jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

jest.mock('../data/mdt-sms.client.js', () => ({
  sendMdtSms: jest.fn(),
  isMdtSmsConfigured: jest.fn(() => true),
}));

describe('verifyOtp phone — find-or-create', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    repo.fetchActiveOtp.mockResolvedValue({
      ID: 1,
      OTPHash: 'hash',
      ExpiresAt: '2099-01-01 00:00:00.000',
    });
    require('bcryptjs').compare.mockResolvedValue(true);
  });

  it('does NOT create a user when team_table row exists (10-digit legacy phone)', async () => {
    repo.findUserByPhone.mockResolvedValue({
      UserId: 42,
      UserName: 'Yasheer',
      Email: 'y@example.com',
      PhoneNumber: '9876543210',
      Status: 'Active',
    });

    const result = await verifyOtp({
      recipient: '+919876543210',
      otp: '123456',
      contactType: 'phone',
    });

    expect(result.httpStatus).toBe(200);
    expect(result.body.isNewUser).toBe(false);
    expect(result.body.user.id).toBe(42);
    expect(result.body.user.username).toBe('Yasheer');
    expect(repo.insertUser).not.toHaveBeenCalled();
    expect(repo.findUserByPhone).toHaveBeenCalledWith('+919876543210');
  });

  it('creates a user with 10-digit PhoneNumber when phone is new', async () => {
    repo.findUserByPhone.mockResolvedValue(null);
    repo.findOrInsertUserByPhone.mockResolvedValue({
      row: {
        UserId: 99,
        UserName: 'user_919999999999',
        Email: null,
        PhoneNumber: '9999999999',
        Status: 'Active',
      },
      isNewUser: true,
    });

    const result = await verifyOtp({
      recipient: '+919999999999',
      otp: '123456',
      contactType: 'phone',
    });

    expect(result.httpStatus).toBe(200);
    expect(result.body.isNewUser).toBe(true);
    expect(repo.findOrInsertUserByPhone).toHaveBeenCalledWith(
      expect.objectContaining({ PhoneNumber: '9999999999' }),
      '+919999999999',
    );
    expect(repo.insertUser).not.toHaveBeenCalled();
  });

  it('handles race condition (23505): returns existing user when concurrent insert wins', async () => {
    repo.findUserByPhone.mockResolvedValue(null);
    // Simulates findOrInsertUserByPhone catching the 23505 and re-fetching.
    repo.findOrInsertUserByPhone.mockResolvedValue({
      row: {
        UserId: 55,
        UserName: 'user_919999999999',
        Email: null,
        PhoneNumber: '9999999999',
        Status: 'Active',
      },
      isNewUser: false,
    });

    const result = await verifyOtp({
      recipient: '+919999999999',
      otp: '123456',
      contactType: 'phone',
    });

    expect(result.httpStatus).toBe(200);
    expect(result.body.isNewUser).toBe(false);
    expect(result.body.user.id).toBe(55);
    expect(repo.insertUser).not.toHaveBeenCalled();
  });
});
