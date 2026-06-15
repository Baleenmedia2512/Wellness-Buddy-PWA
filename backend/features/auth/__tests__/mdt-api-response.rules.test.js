import { parseMdtSendResponse } from '../domain/mdt-api-response.rules.js';

describe('parseMdtSendResponse', () => {
  it('accepts status true JSON', () => {
    expect(parseMdtSendResponse('{"status":"true","description":"SMS sent"}')).toEqual(
      expect.objectContaining({ status: 'true' }),
    );
  });

  it('throws on status false with description', () => {
    expect(() => parseMdtSendResponse(
      '{"status":"false","code":"003","description":"Invalid senderid.."}',
    )).toThrow(/Invalid senderid/i);
  });

  it('throws on empty body', () => {
    expect(() => parseMdtSendResponse('')).toThrow(/empty response/i);
  });
});
