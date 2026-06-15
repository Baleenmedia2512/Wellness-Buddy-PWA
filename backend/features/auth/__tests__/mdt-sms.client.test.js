import { sendMdtSms, isMdtSmsConfigured } from '../data/mdt-sms.client.js';

const originalFetch = global.fetch;

beforeEach(() => {
  process.env.MDT_SMS_API_KEY = 'test-key';
  process.env.MDT_SMS_SENDER_ID = 'MDTDMO';
  process.env.MDT_SMS_API_URL = 'http://example.test/send';
});

afterEach(() => {
  global.fetch = originalFetch;
  delete process.env.MDT_SMS_API_KEY;
  delete process.env.MDT_SMS_SENDER_ID;
  delete process.env.MDT_SMS_API_URL;
});

describe('isMdtSmsConfigured', () => {
  it('returns true when key and sender are set', () => {
    expect(isMdtSmsConfigured()).toBe(true);
  });

  it('returns false when key missing', () => {
    delete process.env.MDT_SMS_API_KEY;
    expect(isMdtSmsConfigured()).toBe(false);
  });
});

describe('sendMdtSms', () => {
  it('calls MDT API with encoded query params', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => 'OK',
    });

    await sendMdtSms({ e164: '+919876543210', message: 'Dear 123456, test' });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const calledUrl = global.fetch.mock.calls[0][0];
    expect(calledUrl).toContain('apikey=test-key');
    expect(calledUrl).toContain('senderid=MDTDMO');
    expect(calledUrl).toContain('number=919876543210');
    expect(calledUrl).toContain('message=Dear');
  });

  it('throws when HTTP status is not ok', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'error',
    });

    await expect(
      sendMdtSms({ e164: '+919876543210', message: 'test' }),
    ).rejects.toThrow(/MDT SMS HTTP 500/);
  });
});
