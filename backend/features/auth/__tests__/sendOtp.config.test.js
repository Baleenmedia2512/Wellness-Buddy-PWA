import { sendOtp } from '../auth.service.js';

describe('sendOtp phone config guard', () => {
  const saved = { ...process.env };

  afterEach(() => {
    process.env.MDT_SMS_API_KEY = saved.MDT_SMS_API_KEY;
    process.env.MDT_SMS_SENDER_ID = saved.MDT_SMS_SENDER_ID;
    process.env.MDT_SMS_TEMPLATE_ID = saved.MDT_SMS_TEMPLATE_ID;
  });

  it('returns 503 when DLT template id is missing', async () => {
    process.env.MDT_SMS_API_KEY = 'test-key';
    process.env.MDT_SMS_SENDER_ID = 'BALEEN';
    delete process.env.MDT_SMS_TEMPLATE_ID;

    const result = await sendOtp({ recipient: '+919876543210', contactType: 'phone' });

    expect(result.httpStatus).toBe(503);
    expect(result.body.success).toBe(false);
    expect(result.body.missingConfig).toEqual(['MDT_SMS_TEMPLATE_ID']);
    expect(result.body.senderIdHint).toBe('BA***EN');
    expect(result.body.templateIdHint).toBe('not-set');
  });
});
