// Service-level tests for firebasePhoneLogin. The repository and
// firebase-admin verifier are mocked at the module boundary so the test runs
// without DB or Firebase credentials (claude.md §9.6).

jest.mock('../firebaseAdmin.js', () => ({
  verifyFirebaseIdToken: jest.fn(),
  getFirebaseAdmin: jest.fn(),
}));

jest.mock('../auth.repository.js', () => ({
  findUserByPhone: jest.fn(),
  insertUser: jest.fn(),
  getISTTimestamp: jest.fn(() => '2026-06-04 12:00:00'),
  // unused but imported elsewhere in service:
  deactivateActiveOtps: jest.fn(),
  insertOtpToken: jest.fn(),
  fetchActiveOtp: jest.fn(),
  markOtpVerified: jest.fn(),
  findUserByEmail: jest.fn(),
  findUserByEmailLite: jest.fn(),
}));

const { verifyFirebaseIdToken } = require('../firebaseAdmin.js');
const repo = require('../auth.repository.js');
const { firebasePhoneLogin } = require('../auth.service.js');

afterEach(() => jest.clearAllMocks());

describe('firebasePhoneLogin', () => {
  it('returns 401 when firebase verification fails', async () => {
    verifyFirebaseIdToken.mockRejectedValue(new Error('Token expired'));
    const res = await firebasePhoneLogin({ idToken: 'bad', name: '' });
    expect(res.httpStatus).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when verified token has no phone_number claim', async () => {
    verifyFirebaseIdToken.mockResolvedValue({ uid: 'abc' });
    const res = await firebasePhoneLogin({ idToken: 'tok', name: '' });
    expect(res.httpStatus).toBe(400);
    expect(res.body.message).toMatch(/phone/i);
  });

  it('returns existing user with isNewUser=false', async () => {
    verifyFirebaseIdToken.mockResolvedValue({
      uid: 'firebase-uid',
      phone_number: '+919876543210',
    });
    repo.findUserByPhone.mockResolvedValue({
      UserId: 42,
      UserName: 'existing_user',
      Email: 'old@example.com',
      PhoneNumber: '+919876543210',
      Status: 'Active',
    });

    const res = await firebasePhoneLogin({ idToken: 'tok', name: 'Ignored' });

    expect(res.httpStatus).toBe(200);
    expect(res.body.isNewUser).toBe(false);
    expect(res.body.user).toEqual({
      id: 42,
      username: 'existing_user',
      email: 'old@example.com',
      phone: '+919876543210',
      status: 'Active',
    });
    expect(repo.insertUser).not.toHaveBeenCalled();
  });

  it('creates new user with phone-derived username when name is blank', async () => {
    verifyFirebaseIdToken.mockResolvedValue({
      uid: 'firebase-uid',
      phone_number: '+919876543210',
    });
    repo.findUserByPhone.mockResolvedValue(null);
    repo.insertUser.mockResolvedValue({
      UserId: 99,
      UserName: 'user_919876543210',
      Email: null,
      PhoneNumber: '+919876543210',
      Status: 'Active',
    });

    const res = await firebasePhoneLogin({ idToken: 'tok', name: '' });

    expect(res.httpStatus).toBe(200);
    expect(res.body.isNewUser).toBe(true);
    expect(repo.insertUser).toHaveBeenCalledWith(
      expect.objectContaining({
        PhoneNumber: '+919876543210',
        UserName: 'user_919876543210',
        Status: 'Active',
      }),
    );
    expect(res.body.user.email).toBe('');
    expect(res.body.user.phone).toBe('+919876543210');
  });

  it('uses provided name for new user when supplied', async () => {
    verifyFirebaseIdToken.mockResolvedValue({
      uid: 'firebase-uid',
      phone_number: '+14155551234',
    });
    repo.findUserByPhone.mockResolvedValue(null);
    repo.insertUser.mockResolvedValue({
      UserId: 100, UserName: 'Alice', Email: null, PhoneNumber: '+14155551234', Status: 'Active',
    });

    const res = await firebasePhoneLogin({ idToken: 'tok', name: 'Alice' });

    expect(repo.insertUser).toHaveBeenCalledWith(
      expect.objectContaining({ UserName: 'Alice', PhoneNumber: '+14155551234' }),
    );
    expect(res.body.isNewUser).toBe(true);
  });
});
