import { validateFirebasePhoneLogin } from '../auth.validators.js';

function expectError(fn, status, msgSubstring) {
  let caught;
  try { fn(); } catch (e) { caught = e; }
  expect(caught).toBeDefined();
  expect(caught.statusCode || caught.status).toBe(status);
  if (msgSubstring) {
    expect(String(caught.message)).toEqual(expect.stringContaining(msgSubstring));
  }
}

describe('validateFirebasePhoneLogin', () => {
  it('accepts a sufficiently long idToken and trims name', () => {
    const out = validateFirebasePhoneLogin({
      idToken: 'a'.repeat(100),
      name: '  Alice Cooper  ',
    });
    expect(out.idToken.length).toBe(100);
    expect(out.name).toBe('Alice Cooper');
  });

  it('treats missing name as empty string', () => {
    const out = validateFirebasePhoneLogin({ idToken: 'x'.repeat(50) });
    expect(out.name).toBe('');
  });

  it('caps name at 60 chars', () => {
    const long = 'x'.repeat(120);
    const out = validateFirebasePhoneLogin({ idToken: 'a'.repeat(50), name: long });
    expect(out.name.length).toBe(60);
  });

  it.each([
    ['null body', null],
    ['empty body', {}],
    ['missing idToken', { name: 'x' }],
    ['non-string idToken', { idToken: 12345 }],
    ['idToken too short', { idToken: 'short' }],
  ])('rejects %s', (_label, body) => {
    expectError(() => validateFirebasePhoneLogin(body), 400, 'idToken');
  });
});
