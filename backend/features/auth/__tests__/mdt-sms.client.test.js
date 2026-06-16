import { sendMdtSms, isMdtSmsConfigured } from '../data/mdt-sms.client.js';

const originalFetch = global.fetch;

beforeEach(() => {
  process.env.MDT_SMS_API_KEY = 'test-key';
  process.env.MDT_SMS_SENDER_ID = 'BALEEN';
  process.env.MDT_SMS_TEMPLATE_ID = '1234567890123456789012345';
  process.env.MDT_SMS_API_URL = 'http://example.test/send';
});

afterEach(() => {
  global.fetch = originalFetch;
  delete process.env.MDT_SMS_API_KEY;
  delete process.env.MDT_SMS_SENDER_ID;
  delete process.env.MDT_SMS_API_URL;
  delete process.env.MDT_SMS_TEMPLATE_ID;
});

describe('isMdtSmsConfigured', () => {
  it('returns true when key and sender are set', () => {
    expect(isMdtSmsConfigured()).toBe(true);
  });

  it('returns false when template id missing', () => {
    delete process.env.MDT_SMS_TEMPLATE_ID;
    expect(isMdtSmsConfigured()).toBe(false);
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
      text: async () => '{"status":"true","description":"SMS sent"}',
    });

    await sendMdtSms({ e164: '+919876543210', message: 'Dear 123456, test' });

    const mdtCalls = global.fetch.mock.calls.filter(([url]) =>
      String(url).includes('example.test/send'),
    );
    expect(mdtCalls).toHaveLength(1);
    const calledUrl = mdtCalls[0][0];
    expect(calledUrl).toContain('apikey=test-key');
    expect(calledUrl).toContain('senderid=BALEEN');
    expect(calledUrl).toContain('number=9876543210');
    expect(calledUrl).toContain('message=Dear');
    expect(calledUrl).toContain('format=json');
  });

  it('includes templateid when MDT_SMS_TEMPLATE_ID is set', async () => {
    process.env.MDT_SMS_TEMPLATE_ID = '1234567890123456789012345';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => '{"status":"Success","code":"011","description":"Message submitted successfully"}',
    });

    await sendMdtSms({ e164: '+919876543210', message: 'Dear 123456, test' });

    const mdtCalls = global.fetch.mock.calls.filter(([url]) =>
      String(url).includes('example.test/send'),
    );
    expect(mdtCalls[0][0]).toContain('templateid=1234567890123456789012345');
  });

  it('throws when MDT JSON says status false', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => '{"status":"false","description":"Invalid senderid.."}',
    });

    await expect(
      sendMdtSms({ e164: '+919876543210', message: 'test' }),
    ).rejects.toThrow(/Invalid senderid/i);
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
