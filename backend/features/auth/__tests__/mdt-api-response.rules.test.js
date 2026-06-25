import { parseMdtSendResponse } from '../domain/mdt-api-response.rules.js';

describe('parseMdtSendResponse', () => {
  it('accepts official Success + code 011 JSON', () => {
    const body = '{"status":"Success","code":"011","description":"Message submitted successfully","data":{"messageid":"x","totnumber":"1","totalcredit":"1"}}';
    expect(parseMdtSendResponse(body)).toEqual(
      expect.objectContaining({ status: 'Success', code: '011' }),
    );
  });

  it('accepts legacy status true JSON', () => {
    expect(parseMdtSendResponse('{"status":"true","description":"SMS sent"}')).toEqual(
      expect.objectContaining({ status: 'true' }),
    );
  });

  it('throws on status false with description', () => {
    expect(() => parseMdtSendResponse(
      '{"status":"false","code":"003","description":"Invalid senderid.."}',
    )).toThrow(/Invalid senderid/i);
  });

  it('throws on documented error code 008 insufficient credit', () => {
    expect(() => parseMdtSendResponse(
      '{"status":"false","code":"008","description":"You have insufficient credit!"}',
    )).toThrow(/insufficient credit/i);
  });

  it('throws on empty body', () => {
    expect(() => parseMdtSendResponse('')).toThrow(/empty response/i);
  });
});
